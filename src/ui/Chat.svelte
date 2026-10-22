<script lang="ts">
	import { tick } from 'svelte';
	import { t } from '../lib/i18n.svelte';
	import type { Meeting } from '../lib/meeting.svelte';

	let { meeting }: { meeting: Meeting } = $props();

	let text = $state('');
	let log: HTMLOListElement;

	const fmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });

	function parts(s: string) {
		return s.split(/(https?:\/\/[^\s<>"]+)/g).map((p, i) => ({ p, link: i % 2 === 1 }));
	}

	$effect.pre(() => {
		meeting.messages.length;
		if (!log || log.scrollHeight - log.scrollTop - log.clientHeight < 80)
			tick().then(() => log.scrollTo({ top: log.scrollHeight }));
	});

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const t = text.trim();
		if (!t) return;
		meeting.send(t);
		text = '';
	}
</script>

<aside>
	<ol bind:this={log}>
		{#each meeting.messages as m (m.key)}
			<li class:mine={m.mine} class:me={m.me}>
				<header>
					<b>{m.name}</b>
					{#if m.private}<span>{t('chat.private')}</span>{/if}
					<time datetime={m.time.toISOString()}>{fmt.format(m.time)}</time>
				</header>
				<p>
					{#each parts(m.text) as { p, link }}
						{#if link}<a href={p} target="_blank" rel="noopener noreferrer">{p}</a>{:else}{p}{/if}
					{/each}
				</p>
			</li>
		{/each}
	</ol>
	<form onsubmit={submit}>
		<input bind:value={text} placeholder={t('chat.placeholder')} aria-label={t('chat.placeholder')} autocomplete="off" />
	</form>
</aside>

<style>
	aside {
		width: 20rem;
		display: flex;
		flex-direction: column;
		border-left: 1px solid #2a2e37;
		background: #181a20;
	}
	ol {
		flex: 1;
		margin: 0;
		padding: .75rem;
		list-style: none;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: .75rem;
	}
	header {
		display: flex;
		gap: .5rem;
		align-items: baseline;
		font-size: .8125rem;
	}
	header span,
	time {
		color: #9aa0ad;
	}
	time {
		margin-left: auto;
		font-variant-numeric: tabular-nums;
	}
	p {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.me p {
		font-style: italic;
	}
	.mine b {
		color: #8fb9ff;
	}
	a {
		color: #8fb9ff;
	}
	form {
		padding: .75rem;
	}
	input {
		width: 100%;
		border-color: #3a3f4b;
	}
	@media (max-width: 40rem) {
		aside {
			position: absolute;
			inset: 0;
			z-index: 2;
			width: auto;
		}
	}
</style>
