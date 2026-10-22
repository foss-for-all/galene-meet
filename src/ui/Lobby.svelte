<script lang="ts">
	import { ROOM } from '../lib/config';
	import { t } from '../lib/i18n.svelte';
	import { support } from '../lib/support';
	import Lang from './Lang.svelte';
	import Logo from './Logo.svelte';

	let {
		room = $bindable(),
		member,
		error,
		busy,
		onjoin,
		onlogin,
		onlogout,
	}: {
		room: string;
		member: boolean;
		error: string;
		busy: boolean;
		onjoin: (name: string) => void;
		onlogin: () => void;
		onlogout: () => void;
	} = $props();

	let name = $state(localStorage.getItem('meet-name') ?? '');
	let msg = $state('');
	const shown = $derived(msg || error);

	function randomRoom() {
		const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
		let s = '';
		crypto.getRandomValues(new Uint8Array(12)).forEach((x, i) => {
			s += (i && i % 4 === 0 ? '-' : '') + abc[x % abc.length];
		});
		room = s;
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!support.webrtc || busy) return;
		room = room.trim().toLowerCase();
		if (!ROOM.test(room)) {
			msg = t('lobby.badRoom');
			return;
		}
		if (e.submitter?.getAttribute('value') === 'login') {
			onlogin();
			return;
		}
		name = name.trim();
		if (!member && !name) {
			msg = t('lobby.noName');
			return;
		}
		msg = '';
		localStorage.setItem('meet-name', name);
		onjoin(name);
	}
</script>

<main>
	<Logo />
	<h1>Galene</h1>
	{#if !support.webrtc}
		<p class="unsupported" role="alert">{t('lobby.unsupported')}</p>
	{/if}
	<form onsubmit={submit} novalidate>
		<label for="room">{t('lobby.room')}</label>
		<div class="row">
			<input id="room" bind:value={room} maxlength="64" autocomplete="off" autocapitalize="none" spellcheck="false" />
			<button type="button" onclick={randomRoom}>{t('lobby.random')}</button>
		</div>
		{#if member}
			<button type="submit" class="primary" aria-disabled={!support.webrtc || busy}>{t('lobby.join')}</button>
			<button type="button" class="link" onclick={onlogout}>{t('lobby.logout')}</button>
		{:else}
			<label for="name">{t('lobby.name')}</label>
			<input id="name" bind:value={name} maxlength="64" autocomplete="nickname" />
			<div class="row">
				<button type="submit" value="login" class="primary" aria-disabled={!support.webrtc}>{t('lobby.login')}</button>
				<button type="submit" value="guest" aria-disabled={!support.webrtc || busy}>{t('lobby.guest')}</button>
			</div>
		{/if}
	</form>
	<p role="alert">{shown}</p>
	<Lang />
</main>

<style>
	main {
		width: min(22rem, 100% - 2rem);
		margin: auto;
		display: grid;
		gap: 1.25rem;
		justify-items: center;
	}
	h1 {
		margin: -.5rem 0 0;
		font-size: 1.25rem;
		font-weight: 600;
	}
	form {
		width: 100%;
		display: grid;
		gap: .5rem;
	}
	label {
		font-size: .875rem;
		font-weight: 600;
	}
	.row {
		display: flex;
		gap: .5rem;
	}
	.row > :global(*) {
		flex: 1;
	}
	.row > button[type='button'] {
		flex: none;
	}
	#room {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
	}
	.link {
		border: none;
		height: auto;
		font-size: .875rem;
		text-decoration: underline;
	}
	.unsupported {
		padding: .75rem 1rem;
		border: 1px solid var(--warn);
		border-radius: .5rem;
		color: var(--fg);
		background: var(--warn-bg);
	}
	p {
		margin: 0;
		min-height: 1.5em;
		color: var(--err);
		font-size: .875rem;
		text-align: center;
	}
</style>
