<script lang="ts">
	let { read }: { read: () => number } = $props();

	let el: HTMLSpanElement;

	$effect(() => {
		let id = 0;
		const tick = () => {
			el.style.setProperty('--l', String(Math.min(1, Math.sqrt(read() * 6))));
			id = requestAnimationFrame(tick);
		};
		id = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(id);
	});
</script>

<span class="meter" bind:this={el} aria-hidden="true"><span></span></span>

<style>
	.meter {
		display: block;
		height: .25rem;
		border-radius: .125rem;
		background: rgb(127 127 127 / .3);
		overflow: hidden;
	}
	.meter > span {
		display: block;
		height: 100%;
		width: 100%;
		transform-origin: left;
		transform: scaleX(var(--l, 0));
		background: #34c759;
		transition: transform 60ms linear;
	}
</style>
