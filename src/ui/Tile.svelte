<script lang="ts">
	import type { Tile } from '../lib/meeting.svelte';

	let { tile }: { tile: Tile } = $props();

	const video = $derived(!!tile.stream?.getVideoTracks().length);
</script>

<figure class:share={tile.label !== 'camera'} class:local={tile.local}>
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
	<figcaption>{tile.name}</figcaption>
</figure>

<style>
	figure {
		position: relative;
		margin: 0;
		min-width: 0;
		min-height: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		border-radius: .75rem;
		background: var(--tile);
	}
	video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.share video {
		object-fit: contain;
	}
	.local:not(.share) video {
		transform: scaleX(-1);
	}
	.avatar {
		display: grid;
		place-items: center;
		width: 4.5rem;
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--accent);
		color: var(--accent-fg);
		font-size: 1.75rem;
		font-weight: 600;
	}
	figcaption {
		position: absolute;
		left: .5rem;
		bottom: .5rem;
		padding: .125rem .5rem;
		border-radius: .375rem;
		background: rgb(0 0 0 / .55);
		color: #fff;
		font-size: .8125rem;
	}
</style>
