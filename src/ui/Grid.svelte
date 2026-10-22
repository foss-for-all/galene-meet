<script lang="ts">
	import type { Tile as T } from '../lib/meeting.svelte';
	import Tile from './Tile.svelte';

	let { tiles }: { tiles: T[] } = $props();

	let w = $state(1);
	let h = $state(1);

	const cols = $derived.by(() => {
		let best = 1;
		let area = 0;
		for (let c = 1; c <= tiles.length; c++) {
			const rows = Math.ceil(tiles.length / c);
			const tw = Math.min(w / c, (h / rows) * 16 / 9);
			if (tw > area) {
				area = tw;
				best = c;
			}
		}
		return best;
	});
</script>

<section bind:clientWidth={w} bind:clientHeight={h} style:--cols={cols} style:--rows={Math.ceil(tiles.length / cols)}>
	{#each tiles as tile (tile.key)}
		<Tile {tile} />
	{/each}
</section>

<style>
	section {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		grid-template-rows: repeat(var(--rows), 1fr);
		gap: .5rem;
		padding: .5rem;
	}
</style>
