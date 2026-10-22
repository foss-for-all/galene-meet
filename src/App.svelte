<script lang="ts">
	import { callback, loggedIn, login, logout, token } from './lib/auth';
	import { GROUP, ROOM } from './lib/config';
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
	let waiting = $state(false);
	let ended = $state(false);
	let attempt = $state(0);

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
		if (meeting?.joined) waiting = false;
	});

	$effect(() => {
		if (!meeting?.closed) return;
		if (meeting.waiting && !member) {
			ended ||= meeting.joined;
			waiting = true;
			attempt++;
		} else {
			error = meeting.error;
		}
		meeting = null;
	});

	$effect(() => {
		if (!waiting) return;
		attempt;
		const id = setTimeout(() => join(name), RETRY);
		return () => clearTimeout(id);
	});

	async function join(n: string) {
		name = n;
		error = '';
		const t = await token();
		member = t !== null;
		const m = new Meeting();
		try {
			await m.open(GROUP + room, t ? null : n, t ? { type: 'token', token: t } : { type: 'password', password: '' });
			meeting = m;
		} catch (e) {
			if (waiting) attempt++;
			else error = e instanceof Error ? e.message : String(e);
		}
	}

	function cancel() {
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
		onjoin={join}
		onlogin={signin}
		onlogout={() => {
			logout();
			member = false;
		}}
	/>
{/if}
