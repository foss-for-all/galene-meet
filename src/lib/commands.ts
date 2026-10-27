import { t, type Key } from './i18n.svelte';
import type { Advanced, Meeting } from './meeting.svelte';

// Chat commands with the names, arguments and permissions of Galene's own client (static/galene.js).

const UNITS: Record<string, number> = { s: 1e3, min: 6e4, h: 36e5, d: 864e5, mon: 31 * 864e5, yr: 365 * 864e5 };

export function expiration(s?: string): number | string | null {
	if (!s) return null;
	const m = /^([0-9]+)(s|min|h|d|mon|yr)$/.exec(s);
	if (m) return Number(m[1]) * UNITS[m[2]];
	const d = new Date(s);
	if (Number.isNaN(d.getTime())) throw new Error(t('cmd.badExpiry'));
	return d.toISOString();
}

function token(link: string) {
	const m = /^https?:\/\/.*?token=([^&?#]+)/.exec(link);
	if (m) return decodeURIComponent(m[1]);
	if (/^https?:\/\//.test(link)) throw new Error(t('cmd.badLink'));
	return link;
}

export function pick(accept = ''): Promise<File | null> {
	return new Promise(resolve => {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = accept;
		input.onchange = () => resolve(input.files?.[0] ?? null);
		input.click();
	});
}

type Need = 'op' | 'present' | 'record' | 'token' | 'optoken';
type Command = { help: Key; args?: string; need?: Need; run: (m: Meeting, rest: string) => unknown };

function user(m: Meeting, name: string) {
	const id = m.find(name);
	if (!id) throw new Error(t('cmd.noUser', { name }));
	return id;
}

const action = (kind: Parameters<Meeting['act']>[0], help: Key): Command => ({
	help,
	args: '<user>',
	need: 'op',
	run: (m, r) => m.act(kind, user(m, r.trim())),
});

const SETTINGS: Record<string, keyof Advanced> = {
	forcerelay: 'forceRelay',
	send: 'send',
	simulcast: 'simulcast',
	request: 'receive',
	receive: 'receive',
	hqaudio: 'hqaudio',
	preprocessing: 'processing',
	blackboardmode: 'blackboard',
	mirrorview: 'mirror',
	filter: 'filter',
};

const COMMANDS: Record<string, Command> = {
	help: { help: 'cmd.help', run: m => help(m) },
	me: { help: 'cmd.me', args: '<text>', run: (m, r) => m.send('/me ' + r) },
	msg: {
		help: 'cmd.msg',
		args: '<user> <message>',
		run: (m, r) => {
			const [name, ...rest] = r.trim().split(/\s+/);
			if (!rest.length) throw new Error(t('cmd.args', { args: '<user> <message>' }));
			m.send(rest.join(' '), user(m, name));
		},
	},
	leave: { help: 'cmd.leave', run: m => m.leave() },
	clear: { help: 'cmd.clear', need: 'op', run: m => m.clearChat() },
	lock: { help: 'cmd.lock', args: '[message]', need: 'op', run: (m, r) => m.sc.groupAction('lock', r.trim() || undefined) },
	unlock: { help: 'cmd.unlock', need: 'op', run: m => m.sc.groupAction('unlock') },
	record: { help: 'cmd.record', need: 'record', run: m => m.sc.groupAction('record') },
	unrecord: { help: 'cmd.unrecord', need: 'record', run: m => m.sc.groupAction('unrecord') },
	subgroups: { help: 'cmd.subgroups', need: 'op', run: m => m.subgroups() },
	invite: {
		help: 'cmd.invite',
		args: '[user] [expiration]',
		need: 'token',
		run: (m, r) => {
			const [username, exp] = r.trim().split(/\s+/);
			m.makeInvite({ username: username || undefined, expires: (expiration(exp) as number) ?? UNITS.d, permissions: m.guestPerms() });
		},
	},
	reinvite: {
		help: 'cmd.reinvite',
		args: '<link> [expiration]',
		need: 'optoken',
		run: (m, r) => {
			const [link, exp] = r.trim().split(/\s+/);
			m.editInvite(token(link), (expiration(exp) as number) ?? UNITS.d);
		},
	},
	revoke: { help: 'cmd.revoke', args: '<link>', need: 'optoken', run: (m, r) => m.editInvite(token(r.trim()), -UNITS.s) },
	listtokens: { help: 'cmd.listtokens', need: 'optoken', run: m => m.listInvites(true) },
	renegotiate: { help: 'cmd.renegotiate', run: m => m.renegotiate() },
	replace: { help: 'cmd.replace', run: m => m.renegotiate() },
	sharescreen: { help: 'cmd.sharescreen', need: 'present', run: m => !m.screen && m.toggleScreen() },
	unsharescreen: { help: 'cmd.unsharescreen', run: m => m.screen && m.toggleScreen() },
	kick: action('kick', 'cmd.kick'),
	identify: action('identify', 'cmd.identify'),
	op: action('op', 'cmd.op'),
	unop: action('unop', 'cmd.unop'),
	present: action('present', 'cmd.present'),
	unpresent: action('unpresent', 'cmd.unpresent'),
	shutup: action('shutup', 'cmd.shutup'),
	unshutup: action('unshutup', 'cmd.unshutup'),
	mute: action('mute', 'cmd.mute'),
	muteall: { help: 'cmd.muteall', need: 'op', run: m => m.muteAll() },
	warn: {
		help: 'cmd.warn',
		args: '<user> <message>',
		need: 'op',
		run: (m, r) => {
			const [name, ...rest] = r.trim().split(/\s+/);
			if (!rest.length) throw new Error(t('cmd.args', { args: '<user> <message>' }));
			m.warn(rest.join(' '), user(m, name));
		},
	},
	wall: { help: 'cmd.wall', args: '<message>', need: 'op', run: (m, r) => m.warn(r.trim()) },
	raise: { help: 'cmd.raise', run: m => !m.hand && m.raiseHand() },
	unraise: { help: 'cmd.unraise', run: m => m.hand && m.raiseHand() },
	presentfile: {
		help: 'cmd.presentfile',
		need: 'present',
		run: async m => {
			const f = await pick('audio/*,video/*');
			if (f) await m.presentFile(f);
		},
	},
	sendfile: {
		help: 'cmd.sendfile',
		args: '<user>',
		run: async (m, r) => {
			const id = user(m, r.trim());
			const f = await pick();
			if (f) m.sendFile(id, f);
		},
	},
	'relay-test': {
		help: 'cmd.relaytest',
		run: async m => {
			m.local(t('cmd.relayRunning'));
			const start = Date.now();
			try {
				const rtt = await m.relayTest();
				m.local(t('cmd.relayOk', { ms: Date.now() - start, rtt }));
			} catch (e) {
				m.local(t('cmd.relayFail', { error: String(e) }));
			}
		},
	},
	set: {
		help: 'cmd.set',
		args: '<setting> [value]',
		run: (m, r) => {
			const [k, v] = r.trim().split(/\s+/);
			const key = SETTINGS[k?.toLowerCase()];
			if (!key) throw new Error(t('cmd.badSetting', { names: Object.keys(SETTINGS).join(', ') }));
			const cur = m.adv[key];
			const value = typeof cur === 'boolean' ? v === undefined || v === 'true' || v === 'on' : v;
			m.advance({ [key]: value });
		},
	},
	unset: {
		help: 'cmd.unset',
		args: '<setting>',
		run: (m, r) => {
			const key = SETTINGS[r.trim().toLowerCase()];
			if (!key) throw new Error(t('cmd.badSetting', { names: Object.keys(SETTINGS).join(', ') }));
			if (typeof m.adv[key] === 'boolean') m.advance({ [key]: false });
		},
	},
};

function allowed(m: Meeting, need?: Need) {
	const p = m.perms;
	if (!need) return true;
	if (need === 'optoken') return p.includes('op') && p.includes('token');
	return p.includes(need);
}

function help(m: Meeting) {
	const lines = Object.entries(COMMANDS)
		.filter(([, c]) => allowed(m, c.need))
		.map(([n, c]) => `/${n}${c.args ? ' ' + c.args : ''}: ${t(c.help)}`);
	m.local(lines.join('\n'));
}

// Returns false when the line is not a command and should be sent as chat.
export async function command(m: Meeting, line: string): Promise<boolean> {
	if (!line.startsWith('/') || line.startsWith('//')) return false;
	const sp = line.indexOf(' ');
	const name = (sp < 0 ? line.slice(1) : line.slice(1, sp)).toLowerCase();
	const rest = sp < 0 ? '' : line.slice(sp + 1);
	const c = COMMANDS[name];
	if (!c) {
		m.local(t('cmd.unknown', { name }));
		return true;
	}
	if (!allowed(m, c.need)) {
		m.local(t('cmd.denied', { name }));
		return true;
	}
	try {
		await c.run(m, rest);
	} catch (e) {
		m.local(e instanceof Error ? e.message : String(e));
	}
	return true;
}
