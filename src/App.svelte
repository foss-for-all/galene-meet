<script lang="ts">
	import { callback, loggedIn, login, logout, token } from './lib/auth';
	import { autoplay } from './lib/autoplay.svelte';
	import { GROUP, ROOM } from './lib/config';
	import { t } from './lib/i18n.svelte';
	import { Meeting } from './lib/meeting.svelte';
	import Lobby from './ui/Lobby.svelte';
	import Room from './ui/Room.svelte';
	import Waiting from './ui/Waiting.svelte';

	const RETRY = { wait: 5000, reconnect: 2000 };

	// Any path becomes a valid room name, so links like /Weekly_Sync still work.
	function normalize(path: string) {
		let s = path.slice(1);
		try {
			s = decodeURIComponent(s);
		} catch {}
		return s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
	}

	const params = new URLSearchParams(location.search);
	// Old portal links: /?room=<name>.
	let room = $state(normalize(location.pathname === '/' && params.has('room') ? '/' + params.get('room') : location.pathname));
	let member = $state(loggedIn());
	let error = $state('');
	let meeting = $state<Meeting | null>(null);
	let name = '';
	let media = { cam: false, mic: false };
	let retry = $state<'wait' | 'reconnect' | null>(null);
	let ended = $state(false);
	let attempt = $state(0);
	let gen = 0;
	const busy = $derived(!!meeting && !meeting.joined);

	if (params.has('code') || params.has('error')) {
		history.replaceState(null, '', '/');
		callback(params)
			.then(r => {
				room = r.room;
				member = true;
				if (r.resume) join('', r.resume);
			})
			.catch(e => (error = e.message));
	}

	$effect(() => {
		if (ROOM.test(room) && location.pathname !== '/' + room) history.replaceState(null, '', '/' + room);
	});

	$effect(() => {
		if (!meeting?.joined) return;
		retry = null;
		meeting.start(media);
	});

	$effect(() => {
		if (!meeting?.closed) return;
		if (meeting.joined) media = meeting.want;
		if (meeting.waiting && !member) {
			ended ||= meeting.joined;
			retry = 'wait';
			attempt++;
		} else if (retry && !meeting.rejected) {
			attempt++;
		} else if (meeting.joined && !meeting.rejected && !meeting.left) {
			retry = 'reconnect';
			attempt++;
		} else {
			error = meeting.error || (retry ? t('err.connection') : '');
			retry = null;
			ended = false;
		}
		meeting = null;
	});

	$effect(() => {
		if (!retry) return;
		attempt;
		const id = setTimeout(() => join(name), RETRY[retry]);
		return () => clearTimeout(id);
	});

	async function join(n: string, want = media) {
		if (busy) return;
		const g = ++gen;
		name = n;
		media = want;
		error = '';
		if (!retry) ended = false;
		const tok = await token();
		if (g !== gen) return;
		if (member && !tok) {
			// Leaving for SSO while offline would strand the user on an error page.
			if (retry) {
				const up = await fetch(`/group/${GROUP + room}/.status`, { signal: AbortSignal.timeout(5000) })
					.then(r => r.ok)
					.catch(() => false);
				if (g !== gen) return;
				if (!up) {
					attempt++;
					return;
				}
			}
			// No refresh tokens for this client: go back through the SSO session.
			login(room, media).catch(e => {
				member = false;
				retry = null;
				error = e instanceof Error ? e.message : t('auth.expired');
			});
			return;
		}
		const m = new Meeting();
		autoplay.blocked = false;
		meeting = m;
		try {
			await m.open(GROUP + room, tok ? null : n, tok ? { type: 'token', token: tok } : { type: 'password', password: '' });
		} catch (e) {
			if (g !== gen) return;
			meeting = null;
			if (retry) attempt++;
			else error = e instanceof Error ? e.message : String(e);
		}
	}

	function cancel() {
		gen++;
		retry = null;
		ended = false;
		meeting?.leave();
		meeting = null;
	}

	const signin = () => login(room).catch(e => (error = e.message));
</script>

{#if meeting?.joined}
	<Room {meeting} />
{:else if retry}
	<Waiting {room} mode={retry === 'reconnect' ? 'reconnect' : ended ? 'ended' : 'wait'} {member} onlogin={signin} oncancel={cancel} />
{:else}
	<Lobby
		bind:room
		{member}
		{error}
		{busy}
		onjoin={join}
		oncancel={cancel}
		onlogin={signin}
		onlogout={() => {
			logout();
			member = false;
		}}
	/>
{/if}
