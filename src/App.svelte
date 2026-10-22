<script lang="ts">
	import { callback, loggedIn, login, logout, token } from './lib/auth';
	import { GROUP, ROOM } from './lib/config';
	import { Meeting } from './lib/meeting.svelte';
	import Lobby from './ui/Lobby.svelte';
	import Room from './ui/Room.svelte';

	let room = $state(location.pathname.slice(1).toLowerCase());
	let member = $state(loggedIn());
	let error = $state('');
	let meeting = $state<Meeting | null>(null);

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
		if (meeting?.closed) {
			error = meeting.error;
			meeting = null;
		}
	});

	async function join(name: string) {
		error = '';
		const t = await token();
		member = t !== null;
		const m = new Meeting();
		try {
			await m.open(GROUP + room, t ? null : name, t ? { type: 'token', token: t } : { type: 'password', password: '' });
			meeting = m;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}
</script>

{#if meeting?.joined}
	<Room {meeting} />
{:else}
	<Lobby
		bind:room
		{member}
		{error}
		onjoin={join}
		onlogin={() => login(room).catch(e => (error = e.message))}
		onlogout={() => {
			logout();
			member = false;
		}}
	/>
{/if}
