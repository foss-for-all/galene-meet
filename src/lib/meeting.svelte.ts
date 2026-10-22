import { ServerConnection, type Credentials, type Stream } from '../../vendor/galene/protocol.js';

export type Tile = {
	key: string;
	name: string;
	label: string;
	stream: MediaStream | null;
	local: boolean;
};

export class Meeting {
	sc = new ServerConnection();
	joined = $state(false);
	closed = $state(false);
	error = $state('');
	perms = $state<string[]>([]);
	#v = $state(0);

	tiles = $derived.by(() => {
		this.#v;
		return this.#tiles();
	});

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
		sc.onerror = e => {
			this.error = e instanceof Error ? e.message : String(e);
		};
		sc.onclose = () => {
			this.closed = true;
			bump();
		};
		sc.connect(endpoint);
	}

	leave() {
		this.sc.close();
	}

	#tiles(): Tile[] {
		const sc = this.sc;
		const cams = new Map<string, Stream>();
		const shares: Tile[] = [];
		const tile = (user: string, s?: Stream): Tile => ({
			key: s?.id ?? user,
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
		return [...shares, ...Object.keys(sc.users).map(id => tile(id, cams.get(id)))];
	}
}
