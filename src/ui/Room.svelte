<script lang="ts">
	import type { Meeting } from '../lib/meeting.svelte';
	import Grid from './Grid.svelte';

	let { meeting }: { meeting: Meeting } = $props();

	const present = $derived(meeting.perms.includes('present'));

	$effect(() => {
		if (!meeting.notice) return;
		const t = setTimeout(() => (meeting.notice = ''), 5000);
		return () => clearTimeout(t);
	});
</script>

<div class="room">
	{#if meeting.notice}
		<p class="notice" role="status">{meeting.notice}</p>
	{/if}
	<Grid tiles={meeting.tiles} />
	<nav>
		{#if present}
			<button aria-pressed={meeting.mic} onclick={() => meeting.toggleMic()}>마이크</button>
			<button aria-pressed={meeting.cam} onclick={() => meeting.toggleCam()}>카메라</button>
			<button aria-pressed={meeting.screen} onclick={() => meeting.toggleScreen()}>화면 공유</button>
		{/if}
		<button class="danger" onclick={() => meeting.leave()}>나가기</button>
	</nav>
</div>

<style>
	.room {
		position: relative;
		flex: 1;
		min-height: 0;
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
	nav button {
		border-color: #3a3f4b;
	}
	nav button[aria-pressed='true'] {
		background: #fff;
		color: #111318;
	}
	.notice {
		position: absolute;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1;
		margin: 0;
		padding: .5rem 1rem;
		border-radius: .5rem;
		background: #2d313b;
	}
</style>
