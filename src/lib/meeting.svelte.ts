import { ServerConnection, type Credentials, type Stream } from '../../vendor/galene/protocol.js';

export type Tile = {
	key: string;
	user: string;
	name: string;
	hand: boolean;
	label: string;
	stream: MediaStream | null;
	local: boolean;
};

export type Message = {
	key: string;
	name: string;
	time: Date;
	text: string;
	me: boolean;
	mine: boolean;
	private: boolean;
};

export type Person = {
	id: string;
	name: string;
	perms: string[];
	hand: boolean;
	self: boolean;
};

export class Meeting {
	sc = new ServerConnection();
	joined = $state(false);
	closed = $state(false);
	error = $state('');
	perms = $state<string[]>([]);
	notice = $state('');
	mic = $state(false);
	cam = $state(false);
	screen = $state(false);
	messages = $state<Message[]>([]);
	#v = $state(0);

	tiles = $derived.by(() => {
		this.#v;
		return this.#tiles();
	});

	#users = $derived.by(() => {
		this.#v;
		return Object.entries(this.sc.users).map(([id, u]): Person => ({
			id,
			name: u.username,
			perms: u.permissions,
			hand: !!u.data?.raisehand,
			self: id === this.sc.id,
		}));
	});

	// Galene's disk writer joins the group as a "system" user while recording.
	people = $derived(this.#users.filter(u => !u.perms.includes('system')));
	recording = $derived(this.#users.some(u => u.perms.includes('system')));

	async open(group: string, username: string | null, creds: Credentials) {
		const r = await fetch(`/group/${group}/.status`);
		if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
		const { endpoint } = await r.json();
		const sc = this.sc;
		const bump = () => this.#v++;

		sc.onconnected = () => sc.join(group, username, creds);
		sc.onjoined = (kind, _group, perms, _status, _data, _error, message) => {
			switch (kind) {
			case 'join':
			case 'change':
				this.joined = true;
				this.perms = perms;
				if (!perms.includes('present')) Object.values(sc.up).forEach(s => s.close());
				sc.request({ '': ['audio', 'video-low'], screenshare: ['audio', 'video'] });
				break;
			case 'redirect':
				sc.close();
				location.href = message;
				break;
			case 'fail':
				this.error = message;
				sc.close();
				break;
			case 'leave':
				sc.close();
				break;
			}
			bump();
		};
		sc.onuser = bump;
		sc.ondownstream = s => {
			s.ondowntrack = bump;
			s.onclose = bump;
		};
		sc.onchat = (id, source, dest, username, time, _privileged, _history, kind, message) => {
			this.messages.push({
				key: id ?? crypto.randomUUID(),
				name: username,
				time,
				text: message,
				me: kind === 'me',
				mine: source === sc.id,
				private: !!dest,
			});
		};
		sc.onusermessage = (_id, _dest, _username, _time, _privileged, kind, _error, message) => {
			switch (kind) {
			case 'error':
			case 'warning':
			case 'info':
				this.notice = String(message);
				break;
			case 'mute':
				this.#up('camera')?.stream?.getAudioTracks().forEach(t => (t.enabled = false));
				this.mic = false;
				this.notice = '마이크가 꺼졌습니다.';
				break;
			case 'clearchat':
				this.messages = [];
				break;
			}
		};
		sc.onerror = e => {
			this.error = e instanceof Error ? e.message : String(e);
		};
		sc.onclose = () => {
			this.closed = true;
			bump();
		};
		sc.connect(endpoint);
	}

	send(text: string) {
		if (text.startsWith('/me ')) this.sc.chat('me', '', text.slice(4));
		else this.sc.chat('', '', text);
	}

	leave() {
		this.sc.close();
	}

	hand = $derived(this.#users.some(u => u.self && u.hand));

	raiseHand() {
		this.sc.userAction('setdata', this.sc.id, { raisehand: this.hand ? null : true });
	}

	act(kind: 'mute' | 'kick' | 'op' | 'unop' | 'present' | 'unpresent', id: string) {
		if (kind === 'mute') this.sc.userMessage('mute', id);
		else this.sc.userAction(kind, id);
	}

	record() {
		this.sc.groupAction(this.recording ? 'unrecord' : 'record');
	}

	#up(label: string) {
		return Object.values(this.sc.up).find(s => s.label === label);
	}

	#publish(label: string, media: MediaStream, old?: Stream) {
		const c = this.sc.newUpStream(old?.localId);
		c.label = label;
		c.setStream(media);
		for (const t of media.getTracks()) {
			const simulcast = label === 'camera' && t.kind === 'video';
			c.pc.addTransceiver(t, {
				direction: 'sendonly',
				streams: [media],
				sendEncodings: simulcast ? [{ rid: 'h' }, { rid: 'l', scaleResolutionDownBy: 2, maxBitrate: 100_000 }] : undefined,
			});
			t.onended = () => c.close();
		}
		c.onclose = replace => {
			media.getTracks().forEach(t => t.stop());
			if (!replace && label === 'camera') this.mic = this.cam = false;
			if (!replace && label === 'screenshare') this.screen = false;
			this.#v++;
		};
		c.onerror = e => {
			this.notice = String(e);
		};
		this.#v++;
	}

	async #camera(audio: boolean, video: boolean) {
		const old = this.#up('camera');
		if (!audio && !video) {
			old?.close();
			return;
		}
		const media = await navigator.mediaDevices.getUserMedia({ audio, video });
		media.getAudioTracks().forEach(t => (t.enabled = this.mic));
		this.#publish('camera', media, old);
		this.cam = video;
	}

	#fail = (e: unknown) => {
		this.notice = e instanceof Error ? e.message : String(e);
	};

	async toggleMic() {
		const a = this.#up('camera')?.stream?.getAudioTracks()[0];
		this.mic = !this.mic;
		if (a) a.enabled = this.mic;
		else await this.#camera(true, this.cam).catch(e => {
			this.mic = false;
			this.#fail(e);
		});
	}

	async toggleCam() {
		const audio = !!this.#up('camera')?.stream?.getAudioTracks().length;
		await this.#camera(audio, !this.cam).catch(this.#fail);
	}

	async toggleScreen() {
		const s = this.#up('screenshare');
		if (s) {
			s.close();
			return;
		}
		try {
			this.#publish('screenshare', await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }));
			this.screen = true;
		} catch (e) {
			this.#fail(e);
		}
	}

	#tiles(): Tile[] {
		const sc = this.sc;
		const cams = new Map<string, Stream>();
		const shares: Tile[] = [];
		const tile = (user: string, s?: Stream): Tile => ({
			key: s?.id ?? user,
			user,
			hand: !!sc.users[user]?.data?.raisehand,
			name: sc.users[user]?.username ?? s?.username ?? '',
			label: s?.label ?? 'camera',
			stream: s?.stream ?? null,
			local: user === sc.id,
		});
		for (const s of [...Object.values(sc.up), ...Object.values(sc.down)]) {
			const user = s.up ? sc.id : s.source ?? '';
			if (s.label === 'camera') cams.set(user, s);
			else shares.push(tile(user, s));
		}
		const people = Object.entries(sc.users).filter(([, u]) => !u.permissions.includes('system'));
		return [...shares, ...people.map(([id]) => tile(id, cams.get(id)))];
	}
}
