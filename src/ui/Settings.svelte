<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import type { Meeting } from '../lib/meeting.svelte';
	import Backgrounds from './Backgrounds.svelte';
	import Devices from './Devices.svelte';
	import Lang from './Lang.svelte';
	import Meter from './Meter.svelte';

	let { meeting, onclose }: { meeting: Meeting; onclose: () => void } = $props();

</script>

<dialog
	{@attach el => {
		el.showModal();
	}}
	onclose={onclose}
>
	<h2>{t('settings.title')}</h2>
	<Devices camId={meeting.camId} micId={meeting.micId} onchange={o => meeting.configure(o)} />
	{#if meeting.mic}
		<Meter read={() => meeting.level()} />
	{/if}
	<Backgrounds value={meeting.background} selected={meeting.bgId} onchange={o => meeting.configure(o)} />
	<label>
		{t('settings.lang')}
		<Lang />
	</label>
	<form method="dialog">
		<button class="primary">{t('settings.close')}</button>
	</form>
</dialog>

<style>
	dialog {
		color-scheme: dark;
		--bg: #181a20;
		--fg: #fff;
		--line: #3a3f4b;
		--accent: #8fb9ff;
		--warn: #fbbc04;
		--warn-bg: #2e2610;
		width: min(26rem, 100% - 2rem);
		border: none;
		border-radius: .75rem;
		padding: 1.25rem;
		background: #1f2229;
		color: #fff;
		display: grid;
		gap: 1rem;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / .5);
	}
	h2 {
		margin: 0;
		font-size: 1.125rem;
	}
	label {
		display: grid;
		gap: .25rem;
		font-size: .875rem;
		font-weight: 600;
	}
	form {
		display: flex;
		justify-content: flex-end;
	}
</style>
