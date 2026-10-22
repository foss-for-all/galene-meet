<script lang="ts">
	import { callback, loggedIn, login, logout, token } from './lib/auth';
	import { autoplay } from './lib/autoplay.svelte';
	import { GROUP, ROOM } from './lib/config';
	import { t } from './lib/i18n.svelte';
	import { Meeting } from './lib/meeting.svelte';
	import Lobby from './ui/Lobby.svelte';
	import Room from './ui/Room.svelte';
	import Waiting from './ui/Waiting.svelte';

	const RETRY = 5000;

	// Any path becomes a valid room name, so links like /Weekly_Sync still work.
	function normalize(path: string) {
		let s = path.slice(1);
		try {
			s = decodeURIComponent(s);
		} catch {}
		return s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '');
	}

	let room = $state(normalize(location.pathname));
	let member = $state(loggedIn());
	let error = $state('');
	let meeting = $state<Meeting | null>(null);
	let name = '';
	let media = { cam: false, mic: false };
	let waiting = $state(false);
	let ended = $state(false);
	let attempt = $state(0);
	let gen = 0;
	const busy = $derived(!!meeting && !meeting.joined);

	const params = new URLSearchParams(location.search);
	if (params.has('code') || params.has('error')) {
		history.replaceState(null, '', '/');
		callback(params)
			.then(r => {
				room = r;
				member = true;
			})
			.catch(e => (error = e.message));
	}

	$effect(() => {
		if (ROOM.test(room) && location.pathname !== '/' + room) history.replaceState(null, '', '/' + room);
	});

	$effect(() => {
		if (!meeting?.joined) return;
		waiting = false;
		meeting.start(media);
	});

	$effect(() => {
		if (!meeting?.closed) return;
		if (meeting.waiting && !member) {
			ended ||= meeting.joined;
			waiting = true;
			attempt++;
		} else if (waiting && !meeting.rejected) {
			attempt++;
		} else {
			error = meeting.error || (waiting ? t('err.connection') : '');
			waiting = ended = false;
		}
		meeting = null;
	});

	$effect(() => {
		if (!waiting) return;
		attempt;
		const id = setTimeout(() => join(name), RETRY);
		return () => clearTimeout(id);
	});

	async function join(n: string, want = media) {
		if (busy) return;
		const g = ++gen;
		name = n;
		media = want;
		error = '';
		if (!waiting) ended = false;
		const tok = await token();
		if (g !== gen) return;
		if (member && !tok) {
			member = false;
			waiting = false;
			error = t('auth.expired');
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
			if (waiting) attempt++;
			else error = e instanceof Error ? e.message : String(e);
		}
	}

	function cancel() {
		gen++;
		waiting = ended = false;
		meeting?.leave();
		meeting = null;
	}

	const signin = () => login(room).catch(e => (error = e.message));
</script>

{#if meeting?.joined}
	<Room {meeting} />
{:else if waiting}
	<Waiting {room} {ended} {member} onlogin={signin} oncancel={cancel} />
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
