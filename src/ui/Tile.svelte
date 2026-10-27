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
	}: { tile: Tile; speaking?: boolean; pinned?: boolean; fit?: boolean; onpin: () => void; onhide?: () => void } = $props();

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
		<button title={t('tile.fullscreen')} aria-label={t('tile.fullscreen')} onclick={full}><Icon name="maximize" /></button>
		<button class:pinned title={t(pinned ? 'tile.unpin' : 'tile.pin')} aria-label={t(pinned ? 'tile.unpin' : 'tile.pin')} onclick={onpin}>
			<Icon name={pinned ? 'pin-off' : 'pin'} />
		</button>
	</div>
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
