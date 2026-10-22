<script lang="ts">
	import type { Meeting, Tile as T } from '../lib/meeting.svelte';
	import Grid from './Grid.svelte';
	import Tile from './Tile.svelte';

	let { meeting, layout }: { meeting: Meeting; layout: 'grid' | 'speaker' } = $props();

	let pinned = $state<string | null>(null);

	const tiles = $derived(meeting.tiles);
	const main = $derived.by(() => {
		const pin = tiles.find(t => t.key === pinned);
		if (pin) return pin;
		const share = tiles.find(t => t.label !== 'camera');
		if (share) return share;
		if (layout === 'speaker')
			return tiles.find(t => t.user === meeting.speaker && t.label === 'camera') ?? tiles.find(t => !t.local) ?? tiles[0];
	});
	const rest = $derived(main ? tiles.filter(t => t !== main) : tiles);

	$effect(() => {
		meeting.quality(main?.key ?? null, !main && tiles.length <= 4);
	});
</script>

{#snippet cell(t: T)}
	{@render tile(t, false)}
{/snippet}

{#snippet tile(t: T, fit: boolean)}
	<Tile
		tile={t}
		{fit}
		speaking={t.label === 'camera' && meeting.speaking.includes(t.user)}
		pinned={pinned === t.key}
		onpin={() => (pinned = pinned === t.key ? null : t.key)}
	/>
{/snippet}

{#if main}
	<div class="spot">
		<div class="main">{@render tile(main, true)}</div>
		{#if rest.length}
			<div class="strip">
				{#each rest as t (t.key)}
					<div class="cell">{@render tile(t, false)}</div>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<Grid items={tiles} key={t => t.key} item={cell} />
{/if}

<style>
	.spot {
		flex: 1;
		min-width: 0;
		min-height: 0;
		display: flex;
		gap: .5rem;
		padding: .5rem;
	}
	.main {
		flex: 1;
		min-width: 0;
		min-height: 0;
	}
	.strip {
		width: 13rem;
		display: flex;
		flex-direction: column;
		gap: .5rem;
		overflow-y: auto;
	}
	.cell {
		flex: none;
		aspect-ratio: 16 / 9;
	}
	@media (max-width: 40rem) {
		.spot {
			flex-direction: column;
		}
		.strip {
			width: auto;
			height: 6rem;
			flex-direction: row;
			overflow: auto hidden;
		}
		.cell {
			height: 100%;
		}
	}
</style>
