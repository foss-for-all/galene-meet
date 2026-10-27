<script lang="ts">
	import { tick } from 'svelte';
	import { command } from '../lib/commands';
	import { t } from '../lib/i18n.svelte';
	import type { Meeting } from '../lib/meeting.svelte';
	import Icon from './Icon.svelte';

	let { meeting }: { meeting: Meeting } = $props();

	const op = $derived(meeting.perms.includes('op'));
	const others = $derived(meeting.people.filter(p => !p.self));

	$effect(() => {
		if (meeting.dm && !others.some(p => p.id === meeting.dm)) meeting.dm = '';
	});

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

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		const line = text.trim();
		if (!line) return;
		text = '';
		if (await command(meeting, line)) return;
		meeting.send(line.startsWith('//') ? line.slice(1) : line, meeting.dm);
	}

	function close(e: MouseEvent) {
		(e.currentTarget as HTMLElement).closest('details')!.open = false;
	}
</script>

<aside>
	<ol bind:this={log}>
		{#each meeting.messages as m (m.key)}
			<li class:mine={m.mine} class:me={m.me} class:system={m.system} class:private={m.private}>
				<header>
					{#if !m.system}<b>{m.name}</b>{/if}
					{#if m.to}
						<span>{t('chat.to', { name: m.to })}</span>
					{:else if m.private && m.source}
						<button class="reply" onclick={() => (meeting.dm = m.source ?? '')}>{t('chat.private')}</button>
					{/if}
					<time datetime={m.time.toISOString()}>{fmt.format(m.time)}</time>
					{#if op && (m.source || m.id) && !m.system}
						<details>
							<summary title={t('people.manage')} aria-label={t('people.manage')}>...</summary>
							<menu>
								{#if m.id}
									<li><button onclick={e => (close(e), meeting.deleteMessage(m.id, m.source ?? ''))}>{t('chat.delete')}</button></li>
								{/if}
								{#if m.source}
									<li><button onclick={e => (close(e), meeting.deleteMessage(undefined, m.source!))}>{t('chat.deleteAll', { name: m.name })}</button></li>
								{/if}
							</menu>
						</details>
					{/if}
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
		<select bind:value={meeting.dm} aria-label={t('chat.recipient')} class:dm={!!meeting.dm}>
			<option value="">{t('chat.everyone')}</option>
			{#each others as p (p.id)}
				<option value={p.id}>{t('chat.privateTo', { name: p.name })}</option>
			{/each}
		</select>
		<div class="row">
			<input bind:value={text} placeholder={t('chat.placeholder')} aria-label={t('chat.placeholder')} autocomplete="off" />
			<button type="submit" title={t('chat.send')} aria-label={t('chat.send')}><Icon name="send" /></button>
		</div>
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
	.system p {
		color: #9aa0ad;
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-size: .8125rem;
	}
	.private:not(.system) {
		padding-left: .5rem;
		border-left: 2px solid #c49bff;
	}
	.reply {
		height: auto;
		padding: 0;
		border: none;
		color: #c49bff;
		font-size: .8125rem;
		text-decoration: underline;
	}
	details {
		position: relative;
	}
	summary {
		list-style: none;
		cursor: pointer;
		padding: 0 .25rem;
		color: #9aa0ad;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	menu {
		position: absolute;
		right: 0;
		z-index: 3;
		margin: .25rem 0 0;
		padding: .25rem;
		list-style: none;
		border-radius: .5rem;
		background: #2d313b;
		box-shadow: 0 .5rem 1.5rem rgb(0 0 0 / .4);
	}
	menu button {
		width: 100%;
		height: 2.25rem;
		border: none;
		text-align: left;
		white-space: nowrap;
	}
	menu button:hover {
		background: #3a3f4b;
	}
	form {
		display: grid;
		gap: .5rem;
		padding: .75rem;
	}
	.row {
		display: flex;
		gap: .375rem;
	}
	input {
		flex: 1;
		min-width: 0;
		font-size: 1rem;
		border-color: #3a3f4b;
	}
	.row button {
		display: grid;
		place-items: center;
		width: 2.75rem;
		padding: 0;
		border-color: #3a3f4b;
	}
	select {
		font: inherit;
		font-size: 1rem;
		height: 2.25rem;
		border-radius: .5rem;
		border: 1px solid #3a3f4b;
		padding: 0 .5rem;
		background: #181a20;
		color: inherit;
	}
	select.dm {
		border-color: #c49bff;
		color: #c49bff;
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
