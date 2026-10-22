<script lang="ts">
	import type { Tile } from '../lib/meeting.svelte';
	import Icon from './Icon.svelte';

	let {
		tile,
		speaking = false,
		pinned = false,
		fit = false,
		onpin,
	}: { tile: Tile; speaking?: boolean; pinned?: boolean; fit?: boolean; onpin: () => void } = $props();

	const video = $derived(!!tile.stream?.getVideoTracks().length);
</script>

<figure class:share={tile.label !== 'camera'} class:local={tile.local} class:fit class:speaking>
	<video
		autoplay
		playsinline
		muted={tile.local}
		hidden={!video}
		{@attach el => {
			el.srcObject = tile.stream;
		}}
	></video>
	{#if !video}
		<div class="avatar">{tile.name.slice(0, 1).toUpperCase()}</div>
	{/if}
	<button class="pin" class:on={pinned} title={pinned ? '고정 해제' : '고정'} onclick={onpin}>
		<Icon name={pinned ? 'pin-off' : 'pin'} />
	</button>
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
	.local:not(.share) video {
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
	.pin {
		position: absolute;
		top: .5rem;
		right: .5rem;
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: rgb(0 0 0 / .55);
		color: #fff;
		opacity: 0;
		transition: opacity .15s;
	}
	figure:hover .pin,
	.pin:focus-visible,
	.pin.on {
		opacity: 1;
	}
	@media (hover: none) {
		.pin {
			opacity: 1;
		}
	}
</style>
