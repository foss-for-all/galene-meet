import { analyse, type Level } from './audio';
import { get as image } from './images';
import { play } from './sounds.svelte';
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
	mirror: boolean;
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

export const REACTIONS = ['thumbs-up', 'heart', 'laugh', 'party-popper', 'circle-question-mark'] as const;
export type Reaction = (typeof REACTIONS)[number];

// The same knobs and values as Galene's own client (static/galene.js).
export type Advanced = {
	send: 'lowest' | 'low' | 'normal' | 'unlimited';
	simulcast: 'auto' | 'on' | 'off';
	receive: 'everything' | 'low' | 'screenshare' | 'audio';
	hqaudio: boolean;
	processing: boolean;
	blackboard: boolean;
	mirror: boolean;
};

const ADVANCED: Advanced = {
	send: 'normal',
	simulcast: 'auto',
	receive: 'everything',
	hqaudio: false,
	processing: true,
	blackboard: false,
	mirror: true,
};

const RATE = { lowest: 150_000, low: 300_000, normal: 700_000, unlimited: null };
const LOW_RATE = 100_000;

function advanced(): Advanced {
	try {
		return { ...ADVANCED, ...JSON.parse(localStorage.getItem('meet-adv') ?? '{}') };
	} catch {
		return { ...ADVANCED };
	}
}

export type Person = {
	id: string;
	name: string;
	account: string;
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
	bgId = $state(localStorage.getItem('meet-bg-id') ?? '');
	adv = $state<Advanced>(advanced());
	reactions = $state<{ id: number; name: string; icon: Reaction }[]>([]);
	#reacted = 0;
	speaking = $state<string[]>([]);
	locked = $state(false);
	ptt = $state(false);
	joinedAt = $state(0);
	hideSelf = $state(localStorage.getItem('meet-hide-self') === '1');
	#settled = false;
	#known = new Map<string, boolean>();
	#hands = new Set<string>();
	#level = new Map<string, number>();
	#cand = '';
	#candSince = 0;
	#mutedTalk = 0;
	#warned = 0;
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
			name: this.#display(id),
			account: u.username,
			perms: u.permissions,
			hand: !!u.data?.raisehand,
			self: id === this.sc.id,
		}));
	});

	// Galene's disk writer joins the group as a "system" user while recording.
	people = $derived(this.#users.filter(u => !u.perms.includes('system')));
	recording = $derived(this.#users.some(u => u.perms.includes('system')));

	// The display name lives in user data; the username stays the account name (members) or the joining name.
	#display(id: string | null, fallback = '') {
		const u = id ? this.sc.users[id] : undefined;
		const n = u?.data?.name;
		return (typeof n === 'string' && n.trim().slice(0, 64)) || u?.username || fallback;
	}

	rename(name: string) {
		const n = name.trim().slice(0, 64);
		this.sc.userAction('setdata', this.sc.id, { name: n || null });
	}

	myName = $derived.by(() => {
		this.#v;
		return this.#display(this.sc.id);
	});

	async open(group: string, username: string | null, creds: Credentials, name = '') {
		const r = await fetch(`/group/${group}/.status`, { signal: AbortSignal.timeout(10_000) });
		if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
		const { endpoint } = await r.json();
		if (this.#left) return;
		const sc = this.sc;
		const bump = () => this.#v++;

		sc.onconnected = () => sc.join(group, username, creds, name ? { name } : undefined);
		sc.onjoined = (kind, _group, perms, status, _data, _error, message) => {
			switch (kind) {
			case 'join':
			case 'change':
				if (!this.joined) {
					this.joinedAt = Date.now();
					// The user list arrives right after joining; sounds start once it has.
					setTimeout(() => (this.#settled = true), 2000);
				}
				this.locked = !!status?.locked;
				this.joined = true;
				this.perms = perms;
				if (!perms.includes('present')) {
					Object.values(sc.up).forEach(s => s.close());
					this.want = { cam: false, mic: false };
				}
				sc.request(this.#request());
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
		sc.onuser = (id, kind) => {
			this.#notify(id, kind);
			bump();
		};
		sc.ondownstream = s => {
			s.ondowntrack = bump;
			s.onclose = bump;
			s.setStatsInterval(300);
		};
		sc.onchat = (id, source, dest, username, time, _privileged, history, kind, message) => {
			if (!history && source !== sc.id && this.#settled) play('chat');
			this.messages.push({
				key: id ?? crypto.randomUUID(),
				name: this.#display(source, username),
				time,
				text: message,
				me: kind === 'me',
				mine: source === sc.id,
				private: !!dest,
			});
		};
		sc.onusermessage = (source, _dest, username, _time, privileged, kind, _error, message) => {
			if (kind === 'reaction') {
				if (REACTIONS.includes(message as Reaction))
					this.#show(this.#display(source, username), message as Reaction, source === sc.id);
				return;
			}
			// Any guest may send these kinds; only the server and operators are believed.
			if (!privileged) return;
			switch (kind) {
			case 'kicked':
				this.rejected = true;
				this.waiting = message === NO_OP;
				this.error = this.notice = server(String(message));
				break;
			case 'error':
				this.notice = server(String(message));
				break;
			case 'warning':
			case 'info':
				this.notice = server(String(message));
				break;
			case 'mute':
				this.#up('camera')?.stream?.getAudioTracks().forEach(t => (t.enabled = false));
				this.mic = false;
				this.want.mic = false;
				this.notice = t('notice.muted');
				break;
			case 'lowerhand':
				if (this.hand) this.raiseHand();
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

	#notify(id: string, kind: string) {
		const u = this.sc.users[id];
		if (kind === 'add' && u) this.#known.set(id, u.permissions.includes('system'));
		const self = id === this.sc.id;
		if (kind === 'delete') {
			if (this.#settled && !self && this.#known.get(id) === false) play('leave');
			this.#known.delete(id);
			this.#hands.delete(id);
			return;
		}
		if (kind === 'add' && this.#settled && !self && !u?.permissions.includes('system')) play('join');
		const hand = !!u?.data?.raisehand;
		if (hand && !this.#hands.has(id) && !self && this.#settled) play('hand');
		if (hand) this.#hands.add(id);
		else this.#hands.delete(id);
	}

	#heard(user: string) {
		this.#last.set(user, Date.now());
	}

	// The big tile follows whoever has talked for a moment, not every cough, and waits for a pause.
	#pick(now: number) {
		let best = '';
		let top = 0.04;
		for (const [u, e] of this.#level) if (e > top && u !== this.sc.id) [best, top] = [u, e];
		if (!best || best === this.speaker) {
			this.#cand = '';
			return;
		}
		if (this.#cand !== best) {
			this.#cand = best;
			this.#candSince = now;
			return;
		}
		const quiet = !this.speaker || now - (this.#last.get(this.speaker) ?? 0) > 1000;
		if (now - this.#candSince > 800 && quiet) this.speaker = best;
	}

	#detect() {
		const now = Date.now();
		for (const s of Object.values(this.sc.down)) {
			if (!s.source) continue;
			let e = 0;
			for (const t of Object.values(s.stats)) e = Math.max(e, t['inbound-rtp']?.audioEnergy ?? 0);
			this.#level.set(s.source, (this.#level.get(s.source) ?? 0) * 0.5 + e * 0.5);
			if (e > 0.04) this.#heard(s.source);
		}
		for (const u of this.#level.keys()) if (!this.sc.users[u]) this.#level.delete(u);
		this.#pick(now);
		const raw = this.#mon?.read() ?? 0;
		if ((this.mic || this.ptt) && raw > 0.03) this.#heard(this.sc.id);
		this.#mutedTalk = !this.mic && !this.ptt && raw > 0.05 ? this.#mutedTalk + 1 : 0;
		if (this.#mutedTalk >= 5 && now - this.#warned > 30_000) {
			this.#warned = now;
			this.notice = t('notice.mutedTalk');
		}
		const list = [...this.#last].filter(([, t]) => now - t < 700).map(([u]) => u).sort();
		if (list.join() !== this.speaking.join()) this.speaking = list;
	}

	#request(): Record<string, string[]> {
		switch (this.adv.receive) {
		case 'audio':
			return { '': ['audio'] };
		case 'screenshare':
			return { '': ['audio'], screenshare: ['audio', 'video'] };
		case 'low':
			return { '': ['audio', 'video-low'] };
		default:
			return { '': ['audio', 'video-low'], screenshare: ['audio', 'video'] };
		}
	}

	quality(main: string | null, all: boolean) {
		const mode = this.adv.receive;
		for (const s of Object.values(this.sc.down)) {
			const share = s.label === 'screenshare';
			const want =
				mode === 'audio' || (mode === 'screenshare' && !share) ? ['audio']
				: mode === 'low' ? ['audio', 'video-low']
				: mode === 'screenshare' || all || s.id === main || share ? ['audio', 'video']
				: ['audio', 'video-low'];
			const key = want.join();
			if (s.userdata.want === key) continue;
			s.userdata.want = key;
			s.request(want);
		}
	}

	#simulcast(bps: number | null) {
		if (this.adv.simulcast !== 'auto') return this.adv.simulcast === 'on';
		return this.people.length > 2 && (bps === null || bps >= 2 * LOW_RATE);
	}

	react(icon: Reaction) {
		const now = Date.now();
		if (now - this.#reacted < 300) return;
		this.#reacted = now;
		this.sc.userMessage('reaction', '', icon);
	}

	#show(name: string, icon: Reaction, mine = false) {
		if (!mine) play('reaction');
		const r = { id: Math.random(), name, icon };
		this.reactions = [...this.reactions.slice(-19), r];
		setTimeout(() => (this.reactions = this.reactions.filter(x => x !== r)), 4000);
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
		const bps = label === 'camera' ? RATE[this.adv.send] : null;
		const simulcast = label === 'camera' && this.#simulcast(bps);
		for (const t of media.getTracks()) {
			let enc: RTCRtpEncodingParameters[] | undefined;
			if (t.kind === 'video') {
				if (label === 'camera' && this.adv.blackboard) t.contentHint = 'detail';
				// Firefox rejects a rid on a single encoding.
				enc = simulcast
					? [{ rid: 'h', maxBitrate: bps ?? undefined }, { rid: 'l', scaleResolutionDownBy: 2, maxBitrate: LOW_RATE }]
					: bps ? [{ maxBitrate: bps }] : undefined;
			} else if (this.adv.hqaudio) {
				enc = [{ maxBitrate: 128_000 }];
			}
			c.pc.addTransceiver(t, { direction: 'sendonly', streams: [media], sendEncodings: enc });
			if (label !== 'camera') t.onended = () => c.close();
		}
		c.onclose = replace => {
			media.getTracks().forEach(t => t.stop());
			stop?.();
			if (!replace && label === 'camera') {
				this.mic = this.cam = false;
				this.#mon?.stop();
				this.#mon = null;
			}
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
				audio: audio && {
					deviceId: this.micId || undefined,
					echoCancellation: this.adv.processing,
					noiseSuppression: this.adv.processing,
					autoGainControl: this.adv.processing,
				},
				video: video && {
					deviceId: this.camId || undefined,
					width: { ideal: this.adv.blackboard ? 1920 : 1280 },
					height: { ideal: this.adv.blackboard ? 1080 : 720 },
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
		// A missing image falls back to blur; a failed effect sends no video rather than the room.
		const url = this.background === 'image' && this.bgId ? await image(this.bgId).catch(() => null) : null;
		if (video && (this.background === 'blur' || this.background === 'image')) {
			try {
				const { applyEffect } = await import('./background');
				const fx = await applyEffect(
					media,
					url ? { kind: 'image', image: await createImageBitmap(await (await fetch(url)).blob()) } : { kind: 'blur' },
				);
				out = fx.stream;
				fx.ready.catch(() => {
					this.notice = t('notice.fxFailed');
					this.#serial(async () => {
						if (this.#up('camera')?.userdata.source === media) await this.#camera(this.#audioLive(), false);
					});
				});
				stop = () => {
					fx.stop();
					drop();
				};
			} catch {
				this.notice = t('notice.fxFailed');
				media.getVideoTracks().forEach(tr => {
					tr.stop();
					media.removeTrack(tr);
				});
				video = false;
				if (!audio) return;
			}
		}
		if (!this.#alive) {
			stop?.();
			return drop();
		}
		this.#publish('camera', out, old, stop, media);
		this.cam = video;
	}

	async configure(o: { camId?: string; micId?: string; background?: string; bgId?: string }) {
		Object.assign(this, o);
		localStorage.setItem('meet-cam', this.camId);
		localStorage.setItem('meet-mic', this.micId);
		localStorage.setItem('meet-bg', this.background);
		localStorage.setItem('meet-bg-id', this.bgId);
		const device = 'camId' in o || 'micId' in o;
		await this.#serial(async () => {
			if (this.#up('camera')) await this.#camera(this.#audioLive(), this.cam, device);
		});
	}

	async advance(o: Partial<Advanced>) {
		this.adv = { ...this.adv, ...o };
		localStorage.setItem('meet-adv', JSON.stringify(this.adv));
		if ('receive' in o) this.sc.request(this.#request());
		if (!Object.keys(o).some(k => k !== 'receive' && k !== 'mirror')) return;
		await this.#serial(async () => {
			if (this.#up('camera')) await this.#camera(this.#audioLive(), this.cam);
		});
	}

	// Reads a copy of the mic that stays enabled, so talking while muted is noticed.
	#meter(media: MediaStream) {
		this.#mon?.stop();
		this.#mon = null;
		const track = media.getAudioTracks()[0];
		if (!track) return;
		const copy = track.clone();
		copy.enabled = true;
		const l = analyse(copy);
		this.#mon = {
			read: l.read,
			stop: () => {
				l.stop();
				copy.stop();
			},
		};
	}

	level() {
		return (this.mic || this.ptt) && this.#mon ? this.#mon.read() : 0;
	}

	// Push to talk: opens a muted mic while held. Needs an audio track, i.e. the mic was on once.
	talk(on: boolean) {
		const a = this.#up('camera')?.stream?.getAudioTracks().find(tr => tr.readyState === 'live');
		if (!a || this.mic) return false;
		a.enabled = on;
		this.ptt = on;
		return true;
	}

	setHideSelf(v: boolean) {
		this.hideSelf = v;
		if (v) this.notice = t('notice.selfHidden');
		localStorage.setItem('meet-hide-self', v ? '1' : '');
	}

	muteAll() {
		for (const p of this.people) if (!p.self) this.sc.userMessage('mute', p.id);
	}

	lowerHands() {
		this.sc.userMessage('lowerhand', '');
	}

	lock() {
		this.sc.groupAction(this.locked ? 'unlock' : 'lock');
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
			name: this.#display(user, s?.username ?? ''),
			label: s?.label ?? 'camera',
			stream: s?.stream ?? null,
			local: user === sc.id,
			mirror: user === sc.id && this.adv.mirror,
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
