<script lang="ts">
	import type { Meeting } from '../lib/meeting.svelte';
	import Icon from './Icon.svelte';

	let { meeting }: { meeting: Meeting } = $props();
</script>

<ul aria-live="polite">
	{#each meeting.reactions as r (r.id)}
		<li style:--x="{(r.id * 6) | 0}rem">
			<span class="icon {r.icon}"><Icon name={r.icon} /></span>
			<span class="name">{r.name}</span>
		</li>
	{/each}
</ul>

<style>
	ul {
		position: absolute;
		left: 1rem;
		bottom: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
		pointer-events: none;
		z-index: 2;
	}
	li {
		position: absolute;
		bottom: 0;
		left: var(--x);
		display: grid;
		justify-items: center;
		gap: .125rem;
		animation: rise 4s ease-out forwards;
	}
	.icon {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		background: rgb(0 0 0 / .45);
	}
	.icon :global(svg) {
		width: 1.75rem;
		height: 1.75rem;
	}
	.thumbs-up { color: #8fb9ff; }
	.heart { color: #ff6b81; }
	.laugh { color: #fbbc04; }
	.party-popper { color: #ff9f43; }
	.circle-question-mark { color: #c49bff; }
	.name {
		padding: 0 .375rem;
		border-radius: .25rem;
		background: rgb(0 0 0 / .55);
		color: #fff;
		font-size: .75rem;
		white-space: nowrap;
	}
	@keyframes rise {
		0% { opacity: 0; transform: translateY(1rem) scale(.6); }
		10% { opacity: 1; transform: translateY(0) scale(1); }
		75% { opacity: 1; }
		100% { opacity: 0; transform: translateY(-14rem); }
	}
	@media (prefers-reduced-motion: reduce) {
		li {
			animation: fade 4s linear forwards;
		}
		@keyframes fade {
			0%, 80% { opacity: 1; }
			100% { opacity: 0; }
		}
	}
</style>
