<script lang="ts">
	import { add, list, remove, type Image } from '../lib/images';
	import { t } from '../lib/i18n.svelte';
	import { support } from '../lib/support';
	import Icon from './Icon.svelte';

	let {
		value,
		selected,
		onchange,
	}: { value: string; selected: string; onchange: (o: { background?: string; bgId?: string }) => void } = $props();

	let images = $state<Image[]>([]);
	let warned = $state(false);
	let loading = $state(false);

	const reload = () => list().then(l => (images = l)).catch(() => {});
	reload();

	function pick(background: string, bgId?: string) {
		if (background !== 'none' && !support.effects) warned = true;
		else onchange(bgId === undefined ? { background } : { background, bgId });
	}

	async function upload(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!support.effects) {
			warned = true;
			return;
		}
		if (!file) return;
		loading = true;
		try {
			const { loadImage } = await import('../lib/background');
			const bgId = await add(await loadImage(file));
			await reload();
			onchange({ background: 'image', bgId });
		} finally {
			loading = false;
		}
	}

	async function drop(id: string) {
		await remove(id);
		await reload();
		if (id === selected) onchange({ background: value === 'image' ? 'none' : value, bgId: '' });
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
		{#each images as im (im.id)}
			<div class="thumb">
				<button
					type="button"
					aria-pressed={value === 'image' && selected === im.id}
					style:background-image="url({im.url})"
					title={t('settings.image')}
					aria-label={t('settings.image')}
					aria-disabled={!support.effects}
					onclick={() => pick('image', im.id)}
				></button>
				<button type="button" class="remove" title={t('settings.remove')} aria-label={t('settings.remove')} onclick={() => drop(im.id)}>
					<Icon name="x" />
				</button>
			</div>
		{/each}
		<label class="upload" class:loading aria-disabled={!support.effects || loading}>
			{t('settings.upload')}
			<input type="file" accept="image/*" disabled={loading} onchange={upload} />
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
		width: 100%;
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
		box-shadow: 0 0 0 1px var(--accent);
	}
	.thumb {
		position: relative;
	}
	.thumb > button:first-child {
		background-size: cover;
		background-position: center;
	}
	.bg .remove {
		position: absolute;
		top: -.375rem;
		right: -.375rem;
		width: 1.375rem;
		height: 1.375rem;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: #2d313b;
		color: #fff;
	}
	.remove :global(svg) {
		width: .875rem;
		height: .875rem;
	}
	.upload input {
		display: none;
	}
	.loading {
		opacity: .5;
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
