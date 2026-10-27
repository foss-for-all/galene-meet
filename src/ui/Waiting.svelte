<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import Lang from './Lang.svelte';
	import Logo from './Logo.svelte';

	let {
		room,
		mode,
		member,
		onlogin,
		oncancel,
	}: {
		room: string;
		mode: 'wait' | 'ended' | 'reconnect';
		member: boolean;
		onlogin?: () => void;
		oncancel: () => void;
	} = $props();

	let copied = $state(false);
	const link = $derived(`${location.origin}/${room}`);

	async function copy() {
		await navigator.clipboard.writeText(link);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<main>
	<div class="logo"><Logo /></div>
	<h1>{t(mode === 'reconnect' ? 'reconnect.title' : 'wait.title')}</h1>
	<p>{t(mode === 'reconnect' ? 'reconnect.body' : mode === 'ended' ? 'wait.ended' : 'wait.body')}</p>
	<div class="link">
		<code>{link}</code>
		<button onclick={copy}>{t(copied ? 'wait.copied' : 'wait.copy')}</button>
	</div>
	<div class="row">
		{#if onlogin && !member && mode !== 'reconnect'}
			<button class="primary" onclick={onlogin}>{t('lobby.login')}</button>
		{/if}
		<button onclick={oncancel}>{t('wait.cancel')}</button>
	</div>
	<Lang />
</main>

<style>
	main {
		width: min(26rem, 100% - 2rem);
		margin: auto;
		display: grid;
		gap: 1rem;
		justify-items: center;
		text-align: center;
	}
	.logo {
		animation: pulse 2s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: .45;
			transform: scale(.94);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.logo {
			animation: none;
		}
	}
	h1 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		text-wrap: balance;
	}
	p {
		margin: 0;
		color: color-mix(in srgb, var(--fg) 75%, transparent);
		text-wrap: balance;
	}
	.link {
		width: 100%;
		display: flex;
		gap: .5rem;
		align-items: center;
		padding-left: .875rem;
		border: 1px solid var(--line);
		border-radius: .5rem;
	}
	code {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: left;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: .875rem;
	}
	.link button {
		flex: none;
		border: none;
		border-left: 1px solid var(--line);
		border-radius: 0 .5rem .5rem 0;
	}
	.row {
		display: flex;
		gap: .5rem;
	}
</style>
