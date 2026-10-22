<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import type { Meeting } from '../lib/meeting.svelte';
	import Icon from './Icon.svelte';

	let { meeting }: { meeting: Meeting } = $props();

	const op = $derived(meeting.perms.includes('op'));

	function act(e: MouseEvent, kind: Parameters<Meeting['act']>[0], id: string) {
		(e.currentTarget as HTMLElement).closest('details')!.open = false;
		meeting.act(kind, id);
	}
	const sorted = $derived(
		[...meeting.people].sort((a, b) => +b.hand - +a.hand || +b.self - +a.self || a.name.localeCompare(b.name)),
	);
</script>

<aside>
	<h2>{t('people.title', { n: meeting.people.length })}</h2>
	<ul>
		{#each sorted as p (p.id)}
			<li>
				<span class="name">
					{p.name}{#if p.self}<small> {t('people.you')}</small>{/if}
					{#if p.account !== p.name}<small class="account">{p.account}</small>{/if}
				</span>
				{#if p.hand}<span class="hand" title={t('tb.handUp')}><Icon name="hand" /></span>{/if}
				{#if p.perms.includes('op')}<small class="tag">{t('people.op')}</small>{/if}
				{#if op && !p.self}
					<details>
						<summary title={t('people.manage')} aria-label={t('people.manage')}>...</summary>
						<menu>
							<li><button onclick={e => act(e, 'mute', p.id)}>{t('people.mute')}</button></li>
							{#if p.perms.includes('present')}
								<li><button onclick={e => act(e, 'unpresent', p.id)}>{t('people.unpresent')}</button></li>
							{:else}
								<li><button onclick={e => act(e, 'present', p.id)}>{t('people.present')}</button></li>
							{/if}
							{#if p.perms.includes('op')}
								<li><button onclick={e => act(e, 'unop', p.id)}>{t('people.op.remove')}</button></li>
							{:else}
								<li><button onclick={e => act(e, 'op', p.id)}>{t('people.op.add')}</button></li>
							{/if}
							<li><button class="kick" onclick={e => act(e, 'kick', p.id)}>{t('people.kick')}</button></li>
						</menu>
					</details>
				{/if}
			</li>
		{/each}
	</ul>
</aside>

<style>
	aside {
		width: 20rem;
		display: flex;
		flex-direction: column;
		border-left: 1px solid #2a2e37;
		background: #181a20;
		overflow-y: auto;
	}
	h2 {
		margin: 0;
		padding: .75rem;
		font-size: .9375rem;
		font-weight: 600;
	}
	ul {
		margin: 0;
		padding: 0 .75rem .75rem;
		list-style: none;
	}
	ul > li {
		display: flex;
		align-items: center;
		gap: .5rem;
		min-height: 2.5rem;
	}
	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	small {
		color: #9aa0ad;
	}
	.account {
		display: block;
		font-size: .75rem;
	}
	.tag {
		padding: 0 .375rem;
		border: 1px solid #3a3f4b;
		border-radius: .25rem;
		font-size: .75rem;
	}
	.hand {
		display: flex;
		color: #fbbc04;
	}
	details {
		position: relative;
	}
	summary {
		list-style: none;
		cursor: pointer;
		padding: 0 .5rem;
		border-radius: .25rem;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover {
		background: #2d313b;
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
	.kick {
		color: #ff8a80;
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
