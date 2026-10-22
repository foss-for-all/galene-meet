<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import { support } from '../lib/support';
	import Icon from './Icon.svelte';

	let {
		value,
		image,
		onchange,
	}: { value: string; image: string; onchange: (o: { background?: string; bgImage?: string }) => void } = $props();

	let warned = $state(false);

	function pick(background: string) {
		if (background !== 'none' && !support.effects) warned = true;
		else onchange({ background });
	}

	async function upload(e: Event) {
		if (!support.effects) {
			warned = true;
			return;
		}
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const { loadImage } = await import('../lib/background');
		onchange({ background: 'image', bgImage: await loadImage(file) });
	}
</script>

<fieldset>
	<legend>{t('settings.bg')}</legend>
	<div class="bg">
		<button type="button" aria-pressed={value === 'none'} onclick={() => pick('none')}>{t('settings.none')}</button>
		<button
			type="button"
			aria-pressed={value === 'blur'}
			aria-disabled={!support.effects}
			title={support.effects ? undefined : t('why.effects')}
			onclick={() => pick('blur')}
		>
			{t('settings.blur')}
		</button>
		{#if image}
			<button
				type="button"
				class="thumb"
				aria-pressed={value === 'image'}
				style:background-image="url({image})"
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

<style>
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
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
		gap: .5rem;
	}
	.bg button,
	.upload {
		height: 3rem;
		padding: 0 .5rem;
		text-align: center;
		border: 2px solid var(--line);
		border-radius: .5rem;
		display: grid;
		place-items: center;
		font-size: .875rem;
		font-weight: 400;
		cursor: pointer;
	}
	.bg button[aria-pressed='true'] {
		border-color: var(--accent);
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
		border: 1px solid var(--warn);
		border-radius: .5rem;
		background: var(--warn-bg);
		color: var(--fg);
		font-size: .875rem;
	}
</style>
