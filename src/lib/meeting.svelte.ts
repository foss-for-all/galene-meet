import { analyse, type Level } from './audio';
import { t, type Key } from './i18n.svelte';
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

// Galene's autokick: refused on join, or kicked when the last operator leaves.
const NO_OP = 'there are no operators in this group';

const SERVER: Record<string, Key> = {
	[NO_OP]: 'err.noOp',
	'you have been kicked out': 'err.kicked',
	'too many users': 'err.full',
	'not authorised': 'err.notAuth',
	'this username is taken': 'err.nameTaken',
};

const MEDIA: Record<string, Key> = {
	NotAllowedError: 'err.denied',
	SecurityError: 'err.denied',
	NotFoundError: 'err.noDevice',
	OverconstrainedError: 'err.noDevice',
	NotReadableError: 'err.busy',
};

function server(msg: string) {
	return SERVER[msg] ? t(SERVER[msg]) : msg;
}

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
	waiting = $state(false);
	rejected = $state(false);
	error = $state('');
	perms = $state<string[]>([]);
	notice = $state('');
	mic = $state(false);
	cam = $state(false);
	screen = $state(false);
	messages = $state<Message[]>([]);
	camId = $state(localStorage.getItem('meet-cam') ?? '');
	micId = $state(localStorage.getItem('meet-mic') ?? '');
	background = $state(localStorage.getItem('meet-bg') ?? 'none');
	bgImage = $state(localStorage.getItem('meet-bg-image') ?? '');
	speaking = $state<string[]>([]);
	speaker = $state<string | null>(null);
	#v = $state(0);
	#last = new Map<string, number>();
	#mon: Level | null = null;
	#timer = 0;
	#left = false;
	#queue: Promise<unknown> = Promise.resolve();
	// What the user asked for, kept across a dropped connection.
	want = { cam: false, mic: false };

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
		const r = await fetch(`/group/${group}/.status`, { signal: AbortSignal.timeout(10_000) });
		if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
		const { endpoint } = await r.json();
		if (this.#left) return;
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
				this.rejected = true;
				this.waiting = message === NO_OP;
				this.error = server(message);
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
			s.setStatsInterval(300);
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
		sc.onusermessage = (_id, _dest, _username, _time, privileged, kind, _error, message) => {
			// Any guest may send these kinds; only the server and operators are believed.
			if (!privileged) return;
			switch (kind) {
			case 'error':
			case 'kicked':
				this.rejected = true;
				this.waiting = message === NO_OP;
				this.error = this.notice = server(String(message));
				break;
			case 'warning':
			case 'info':
				this.notice = server(String(message));
				break;
			case 'mute':
				this.#up('camera')?.stream?.getAudioTracks().forEach(t => (t.enabled = false));
				this.mic = false;
				this.notice = t('notice.muted');
				break;
			case 'clearchat':
				this.messages = [];
				break;
			}
		};
		sc.onerror = () => {
			this.error ||= t('err.connection');
		};
		sc.onclose = () => {
			clearInterval(this.#timer);
			this.#mon?.stop();
			this.closed = true;
			bump();
		};
		sc.connect(endpoint);
		this.#timer = setInterval(() => this.#detect(), 300);
	}

	#heard(user: string) {
		this.#last.set(user, Date.now());
		if (user !== this.sc.id) this.speaker = user;
	}

	#detect() {
		for (const s of Object.values(this.sc.down)) {
			const loud = Object.values(s.stats).some(t => t['inbound-rtp']?.audioEnergy > 0.04);
			if (loud && s.source) this.#heard(s.source);
		}
		if (this.level() > 0.03) this.#heard(this.sc.id);
		const now = Date.now();
		const list = [...this.#last].filter(([, t]) => now - t < 700).map(([u]) => u).sort();
		if (list.join() !== this.speaking.join()) this.speaking = list;
	}

	quality(main: string | null, all: boolean) {
		for (const s of Object.values(this.sc.down)) {
			const want = all || s.id === main || s.label === 'screenshare' ? 'video' : 'video-low';
			if (s.userdata.want === want) continue;
			s.userdata.want = want;
			s.request(['audio', want]);
		}
	}

	send(text: string) {
		if (text.startsWith('/me ')) this.sc.chat('me', '', text.slice(4));
		else this.sc.chat('', '', text);
	}

	get left() {
		return this.#left;
	}

	leave() {
		this.#left = true;
		this.error = '';
		this.sc.close();
	}

	get #alive() {
		return !this.closed && this.sc.socket?.readyState === WebSocket.OPEN;
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

	#publish(label: string, media: MediaStream, old?: Stream, stop?: () => void, source = media) {
		const c = this.sc.newUpStream(old?.localId);
		c.label = label;
		c.setStream(media);
		c.userdata.stop = stop;
		c.userdata.source = source;
		for (const t of media.getTracks()) {
			const simulcast = label === 'camera' && t.kind === 'video';
			c.pc.addTransceiver(t, {
				direction: 'sendonly',
				streams: [media],
				sendEncodings: simulcast ? [{ rid: 'h' }, { rid: 'l', scaleResolutionDownBy: 2, maxBitrate: 100_000 }] : undefined,
			});
			if (label !== 'camera') t.onended = () => c.close();
		}
		c.onclose = replace => {
			media.getTracks().forEach(t => t.stop());
			stop?.();
			if (!replace && label === 'camera') this.mic = this.cam = false;
			if (!replace && label === 'screenshare') this.screen = false;
			this.#v++;
		};
		c.onerror = e => {
			this.notice = String(e);
		};
		this.#v++;
	}

	// Camera changes run one at a time, each reading the state the previous one left.
	#serial(f: () => Promise<void>): Promise<void> {
		const p = this.#queue
			.then(f)
			.catch(this.#fail)
			.then(() => {
				if (this.#alive) this.want = { cam: this.cam, mic: this.mic };
			});
		this.#queue = p;
		return p;
	}

	#audioLive() {
		return !!this.#up('camera')?.stream?.getAudioTracks().some(t => t.readyState === 'live');
	}

	async #camera(audio: boolean, video: boolean, release = false) {
		const old = this.#up('camera');
		if (!audio && !video) {
			old?.close();
			return;
		}
		// Some platforms open only one camera at a time.
		if (release && old) {
			old.userdata.stop?.();
			old.stream?.getTracks().forEach(t => t.stop());
		}
		let media: MediaStream;
		try {
			media = await navigator.mediaDevices.getUserMedia({
				audio: audio && (this.micId ? { deviceId: this.micId } : true),
				video: video && {
					deviceId: this.camId || undefined,
					width: { ideal: 1280 },
					height: { ideal: 720 },
					frameRate: { ideal: 30, max: 30 },
				},
			});
		} catch (e) {
			if (release) old?.close();
			throw e;
		}
		const drop = () => media.getTracks().forEach(t => t.stop());
		if (!this.#alive) return drop();
		media.getAudioTracks().forEach(t => (t.enabled = this.mic));
		// One unplugged device can end both tracks at once: recover once, from what is still live.
		let lost = false;
		const onlost = () => {
			if (lost || this.#up('camera')?.userdata.source !== media) return;
			lost = true;
			setTimeout(() => {
				const live = (kind: string) => media.getTracks().some(t => t.kind === kind && t.readyState === 'live');
				if (!live('audio')) this.mic = false;
				if (this.cam && !live('video')) this.notice = t('notice.camEnded');
				this.#serial(() => this.#camera(live('audio'), live('video'), true));
			}, 100);
		};
		media.getTracks().forEach(t => (t.onended = onlost));
		this.#meter(media);
		let out = media;
		let stop: (() => void) | undefined;
		const image = this.background === 'image' && this.bgImage;
		if (video && (this.background === 'blur' || image)) {
			try {
				const { applyEffect } = await import('./background');
				const fx = await applyEffect(
					media,
					image ? { kind: 'image', image: await createImageBitmap(await (await fetch(image)).blob()) } : { kind: 'blur' },
				);
				out = fx.stream;
				stop = () => {
					fx.stop();
					drop();
				};
			} catch (e) {
				this.#fail(e);
			}
		}
		if (!this.#alive) {
			stop?.();
			return drop();
		}
		this.#publish('camera', out, old, stop, media);
		this.cam = video;
	}

	async configure(o: { camId?: string; micId?: string; background?: string; bgImage?: string }) {
		Object.assign(this, o);
		localStorage.setItem('meet-cam', this.camId);
		localStorage.setItem('meet-mic', this.micId);
		localStorage.setItem('meet-bg', this.background);
		try {
			localStorage.setItem('meet-bg-image', this.bgImage);
		} catch {
			this.notice = t('notice.bgTooBig');
		}
		const device = 'camId' in o || 'micId' in o;
		await this.#serial(async () => {
			if (this.#up('camera')) await this.#camera(this.#audioLive(), this.cam, device);
		});
	}

	#meter(media: MediaStream) {
		this.#mon?.stop();
		const track = media.getAudioTracks()[0];
		this.#mon = track ? analyse(track) : null;
	}

	level() {
		return this.mic && this.#mon ? this.#mon.read() : 0;
	}

	#fail = (e: unknown) => {
		const key = e instanceof Error && MEDIA[e.name];
		this.notice = key ? t(key) : e instanceof Error ? e.message : String(e);
	};

	toggleMic() {
		return this.#serial(async () => {
			const a = this.#up('camera')?.stream?.getAudioTracks().find(t => t.readyState === 'live');
			this.mic = !this.mic;
			if (a) a.enabled = this.mic;
			else
				await this.#camera(true, this.cam).catch(e => {
					this.mic = false;
					throw e;
				});
		});
	}

	#started = false;

	start(o: { cam: boolean; mic: boolean }) {
		if (this.#started || !this.perms.includes('present')) return;
		this.#started = true;
		if (!o.cam && !o.mic) return;
		this.#serial(async () => {
			this.mic = o.mic;
			await this.#camera(o.mic, o.cam).catch(e => {
				this.mic = false;
				throw e;
			});
		});
	}

	toggleCam() {
		return this.#serial(() => this.#camera(this.#audioLive(), !this.cam));
	}

	async toggleScreen() {
		const s = this.#up('screenshare');
		if (s) {
			s.close();
			return;
		}
		try {
			const media = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
			if (!this.#alive) return media.getTracks().forEach(t => t.stop());
			this.#publish('screenshare', media);
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
