<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import type { Meeting } from '../lib/meeting.svelte';
	import { support } from '../lib/support';
	import Devices from './Devices.svelte';
	import Icon from './Icon.svelte';
	import Lang from './Lang.svelte';
	import Meter from './Meter.svelte';

	let { meeting, onclose }: { meeting: Meeting; onclose: () => void } = $props();

	let warned = $state(false);

	function pick(background: string) {
		if (background !== 'none' && !support.effects) warned = true;
		else meeting.configure({ background });
	}

	async function upload(e: Event) {
		if (!support.effects) {
			warned = true;
			return;
		}
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const { loadImage } = await import('../lib/background');
		meeting.configure({ background: 'image', bgImage: await loadImage(file) });
	}
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
	<fieldset>
		<legend>{t('settings.bg')}</legend>
		<div class="bg">
			<button aria-pressed={meeting.background === 'none'} onclick={() => pick('none')}>{t('settings.none')}</button>
			<button aria-pressed={meeting.background === 'blur'} aria-disabled={!support.effects} title={support.effects ? undefined : t('why.effects')} onclick={() => pick('blur')}>{t('settings.blur')}</button>
			{#if meeting.bgImage}
				<button
					class="thumb"
					aria-pressed={meeting.background === 'image'}
					style:background-image="url({meeting.bgImage})"
					title={t('settings.image')}
					aria-label={t('settings.image')}
					aria-disabled={!support.effects}
					onclick={() => pick('image')}
				></button>
			{/if}
			<label class="upload" aria-disabled={!support.effects}>
				{t('settings.upload')}
				<input type="file" accept="image/*" onchange={upload} />
			</label>
		</div>
		{#if warned || !support.effects}
			<p class="warn" role="alert"><Icon name="triangle-alert" />{t('why.effects')}</p>
		{/if}
	</fieldset>
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
	fieldset {
		margin: 0;
		padding: 0;
		border: none;
	}
	legend {
		margin-bottom: .25rem;
		font-size: .875rem;
		font-weight: 600;
	}
	.bg {
		display: flex;
		flex-wrap: wrap;
		gap: .5rem;
	}
	.bg button,
	.upload {
		height: 3.5rem;
		min-width: 5rem;
		border: 2px solid #3a3f4b;
		border-radius: .5rem;
		display: grid;
		place-items: center;
		font-weight: 400;
		cursor: pointer;
	}
	.bg button[aria-pressed='true'] {
		border-color: #8fb9ff;
	}
	.thumb {
		background-size: cover;
		background-position: center;
	}
	.upload input {
		display: none;
	}
	.warn {
		display: flex;
		align-items: center;
		gap: .5rem;
		margin: .5rem 0 0;
		padding: .5rem .75rem;
		border: 1px solid #fbbc04;
		border-radius: .5rem;
		background: #2e2610;
		color: #ffe08a;
		font-size: .875rem;
	}
	form {
		display: flex;
		justify-content: flex-end;
	}
</style>
