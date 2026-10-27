<script lang="ts">
	import type { Tile } from '../lib/meeting.svelte';
	import { autoplay } from '../lib/autoplay.svelte';
	import { t } from '../lib/i18n.svelte';
	import Icon from './Icon.svelte';

	let {
		tile,
		speaking = false,
		pinned = false,
		fit = false,
		onpin,
		onhide,
		volume = 1,
		onvolume,
		stats,
	}: {
		tile: Tile;
		speaking?: boolean;
		pinned?: boolean;
		fit?: boolean;
		onpin: () => void;
		onhide?: () => void;
		volume?: number;
		onvolume?: (v: number) => void;
		stats?: () => Promise<{ size: string; fps: number; kbps: number; lost: number; rtt: number } | null>;
	} = $props();

	let showVolume = $state(false);
	let info = $state<Awaited<ReturnType<NonNullable<typeof stats>>>>(null);
	let showInfo = $state(false);

	$effect(() => {
		if (!showInfo || !stats) return;
		const get = () => stats().then(s => (info = s));
		get();
		const id = setInterval(get, 1000);
		return () => clearInterval(id);
	});

	const video = $derived(!!tile.stream?.getVideoTracks().length);
	const pip = typeof document !== 'undefined' && document.pictureInPictureEnabled;
	let figure: HTMLElement;
	let el: HTMLVideoElement;

	function full() {
		if (document.fullscreenElement) document.exitFullscreen();
		else figure.requestFullscreen?.().catch(() => {});
	}
</script>

<figure bind:this={figure} class:share={tile.label !== 'camera'} class:mirror={tile.mirror} class:fit class:speaking>
	<video
		bind:this={el}
		autoplay
		playsinline
		muted={tile.local}
		hidden={!video}
		{@attach el => {
			// Assigning srcObject restarts loading, even with the same stream.
			if (el.srcObject !== tile.stream) el.srcObject = tile.stream;
			el.volume = volume;
			if (tile.stream && !tile.local)
				el.play().catch(e => {
					if (e.name === 'NotAllowedError') autoplay.blocked = true;
				});
		}}
	></video>
	{#if !video}
		<div class="avatar">{tile.name.slice(0, 1).toUpperCase()}</div>
	{/if}
	<div class="actions" class:on={pinned}>
		{#if onhide}
			<button title={t('tile.hideSelf')} aria-label={t('tile.hideSelf')} onclick={onhide}><Icon name="eye-off" /></button>
		{/if}
		{#if pip && video && !tile.local}
			<button title={t('tile.pip')} aria-label={t('tile.pip')} onclick={() => el.requestPictureInPicture().catch(() => {})}>
				<Icon name="picture-in-picture-2" />
			</button>
		{/if}
		{#if onvolume && !tile.local}
			<button aria-pressed={showVolume} title={t('tile.volume')} aria-label={t('tile.volume')} onclick={() => (showVolume = !showVolume)}>
				<Icon name={volume === 0 ? 'volume-x' : 'volume-2'} />
			</button>
		{/if}
		{#if stats}
			<button aria-pressed={showInfo} title={t('tile.stats')} aria-label={t('tile.stats')} onclick={() => (showInfo = !showInfo)}>
				<Icon name="info" />
			</button>
		{/if}
		<button title={t('tile.fullscreen')} aria-label={t('tile.fullscreen')} onclick={full}><Icon name="maximize" /></button>
		<button class:pinned title={t(pinned ? 'tile.unpin' : 'tile.pin')} aria-label={t(pinned ? 'tile.unpin' : 'tile.pin')} onclick={onpin}>
			<Icon name={pinned ? 'pin-off' : 'pin'} />
		</button>
	</div>
	{#if showVolume && onvolume}
		<input
			class="volume"
			type="range"
			min="0"
			max="1"
			step="0.05"
			value={volume}
			aria-label={t('tile.volume')}
			oninput={e => onvolume(Number(e.currentTarget.value))}
		/>
	{/if}
	{#if showInfo && info}
		<dl class="info">
			{#if info.size}<dt>{t('stats.size')}</dt><dd>{info.size} · {info.fps} fps</dd>{/if}
			<dt>{t('stats.rate')}</dt><dd>{info.kbps} kbps</dd>
			<dt>{t('stats.loss')}</dt><dd>{info.lost.toFixed(1)}%</dd>
			{#if info.rtt}<dt>RTT</dt><dd>{info.rtt} ms</dd>{/if}
		</dl>
	{/if}
	<figcaption>
		{#if tile.hand}<span class="hand"><Icon name="hand" /></span>{/if}
		{tile.name}
	</figcaption>
</figure>

<style>
	figure {
		position: relative;
		margin: 0;
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		border-radius: .75rem;
		background: var(--tile);
	}
	figure::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		transition: box-shadow .15s;
	}
	.speaking::after {
		box-shadow: inset 0 0 0 3px #8fb9ff;
	}
	video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.share video,
	.fit video {
		object-fit: contain;
	}
	.mirror:not(.share) video {
		transform: scaleX(-1);
	}
	.avatar {
		display: grid;
		place-items: center;
		width: min(4.5rem, 40%);
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--accent);
		color: var(--accent-fg);
		font-size: 1.75rem;
		font-weight: 600;
	}
	figcaption {
		display: flex;
		align-items: center;
		gap: .25rem;
		position: absolute;
		left: .5rem;
		bottom: .5rem;
		max-width: calc(100% - 1rem);
		padding: .125rem .5rem;
		border-radius: .375rem;
		background: rgb(0 0 0 / .55);
		color: #fff;
		font-size: .8125rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.hand {
		display: flex;
		color: #fbbc04;
	}
	.actions {
		position: absolute;
		top: .5rem;
		right: .5rem;
		display: flex;
		gap: .25rem;
		opacity: 0;
		transition: opacity .15s;
	}
	.actions button {
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: rgb(0 0 0 / .55);
		color: #fff;
	}
	.actions [aria-pressed='true'] {
		background: #8fb9ff;
		color: #111318;
	}
	.volume {
		position: absolute;
		top: 3.25rem;
		right: .75rem;
		width: 8rem;
	}
	.info {
		position: absolute;
		top: 3.25rem;
		left: .5rem;
		display: grid;
		grid-template-columns: auto auto;
		gap: .125rem .5rem;
		margin: 0;
		padding: .375rem .5rem;
		border-radius: .375rem;
		background: rgb(0 0 0 / .65);
		color: #fff;
		font-size: .75rem;
		font-variant-numeric: tabular-nums;
	}
	.info dd {
		margin: 0;
	}
	.actions .pinned {
		background: #8fb9ff;
		color: #111318;
	}
	figure:hover .actions,
	.actions:focus-within,
	.actions.on {
		opacity: 1;
	}
	@media (hover: none) {
		.actions {
			opacity: 1;
		}
	}
	:global(figure:fullscreen) {
		border-radius: 0;
	}
</style>
