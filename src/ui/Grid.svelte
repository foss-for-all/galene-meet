<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	let { items, key, item }: { items: T[]; key: (it: T) => string; item: Snippet<[T]> } = $props();

	const GAP = 8;
	let w = $state(1);
	let h = $state(1);

	const fit = $derived.by(() => {
		const n = Math.max(items.length, 1);
		let best = { cols: 1, tw: 0 };
		for (let cols = 1; cols <= n; cols++) {
			const rows = Math.ceil(n / cols);
			const tw = Math.min((w - GAP * (cols - 1)) / cols, ((h - GAP * (rows - 1)) / rows) * 16 / 9);
			if (tw > best.tw) best = { cols, tw };
		}
		return best;
	});
</script>

<section bind:clientWidth={w} bind:clientHeight={h}>
	<div style:grid-template-columns="repeat({fit.cols}, {fit.tw}px)" style:grid-auto-rows="{(fit.tw * 9) / 16}px">
		{#each items as it (key(it))}
			{@render item(it)}
		{/each}
	</div>
</section>

<style>
	section {
		flex: 1;
		min-width: 0;
		min-height: 0;
		margin: .5rem;
		display: grid;
		place-items: center;
		overflow: hidden;
	}
	div {
		display: grid;
		gap: 8px;
		justify-content: center;
	}
</style>
