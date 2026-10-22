<script lang="ts">
	import { icons } from '../../vendor/lucide/icons';

	let { name }: { name: keyof typeof icons } = $props();
</script>

<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
	{@html icons[name]}
</svg>

<style>
	svg {
		width: 1.25rem;
		height: 1.25rem;
		flex: none;
	}
</style>
