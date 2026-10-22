<script lang="ts">
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
	<h2>참가자 {meeting.people.length}</h2>
	<ul>
		{#each sorted as p (p.id)}
			<li>
				<span class="name">{p.name}{#if p.self}<small> (나)</small>{/if}</span>
				{#if p.hand}<span class="hand" title="손 들기"><Icon name="hand" /></span>{/if}
				{#if p.perms.includes('op')}<small class="tag">진행자</small>{/if}
				{#if op && !p.self}
					<details>
						<summary title="관리">...</summary>
						<menu>
							<li><button onclick={e => act(e, 'mute', p.id)}>마이크 끄기</button></li>
							{#if p.perms.includes('present')}
								<li><button onclick={e => act(e, 'unpresent', p.id)}>발표 권한 빼기</button></li>
							{:else}
								<li><button onclick={e => act(e, 'present', p.id)}>발표 권한 주기</button></li>
							{/if}
							{#if p.perms.includes('op')}
								<li><button onclick={e => act(e, 'unop', p.id)}>진행자 해제</button></li>
							{:else}
								<li><button onclick={e => act(e, 'op', p.id)}>진행자로 지정</button></li>
							{/if}
							<li><button class="kick" onclick={e => act(e, 'kick', p.id)}>내보내기</button></li>
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
