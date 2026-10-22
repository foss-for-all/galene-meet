<script lang="ts">
	import type { Meeting } from '../lib/meeting.svelte';
	import Grid from './Grid.svelte';

	let { meeting }: { meeting: Meeting } = $props();
</script>

<div class="room">
	<Grid tiles={meeting.tiles} />
	<nav>
		<button class="danger" onclick={() => meeting.leave()}>나가기</button>
	</nav>
</div>

<style>
	.room {
		height: 100%;
		display: flex;
		flex-direction: column;
		background: var(--stage);
		color: #fff;
	}
	nav {
		display: flex;
		justify-content: center;
		gap: .5rem;
		padding: .5rem;
	}
</style>
