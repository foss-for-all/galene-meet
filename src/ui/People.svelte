<script lang="ts">
	import { expiration, pick } from '../lib/commands';
	import { t } from '../lib/i18n.svelte';
	import type { Meeting } from '../lib/meeting.svelte';
	import Icon from './Icon.svelte';

	let { meeting, onmessage }: { meeting: Meeting; onmessage: (id: string) => void } = $props();

	const canInvite = $derived(meeting.perms.includes('token'));
	const canList = $derived(canInvite && meeting.perms.includes('op'));
	let expires = $state('1d');
	let allowPresent = $state(true);
	let inviteName = $state('');
	let warnText = $state('');

	function close(e: MouseEvent) {
		(e.currentTarget as HTMLElement).closest('details')!.open = false;
	}

	function makeInvite() {
		meeting.makeInvite({
			username: inviteName.trim() || undefined,
			expires: expiration(expires) as number,
			permissions: allowPresent ? meeting.guestPerms() : meeting.guestPerms().filter(p => p !== 'present'),
		});
		if (canList) setTimeout(() => meeting.listInvites(), 500);
	}

	async function sendFile(e: MouseEvent, id: string) {
		close(e);
		const f = await pick();
		if (f) meeting.sendFile(id, f);
	}

	function warn(e: MouseEvent, id: string) {
		const text = warnText.trim();
		if (!text) return;
		close(e);
		meeting.warn(text, id);
		warnText = '';
	}

	$effect(() => {
		if (canList) meeting.listInvites();
	});

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
	{#if op}
		<div class="tools">
			<button onclick={() => meeting.muteAll()}><Icon name="volume-x" />{t('people.muteAll')}</button>
			<button onclick={() => meeting.lowerHands()}><Icon name="hand" />{t('people.lowerHands')}</button>
			<button aria-pressed={meeting.locked} onclick={() => meeting.lock()}>
				<Icon name={meeting.locked ? 'lock' : 'lock-open'} />{t(meeting.locked ? 'people.unlock' : 'people.lock')}
			</button>
			<button onclick={() => meeting.subgroups()}><Icon name="users" />{t('people.subgroups')}</button>
		</div>
	{/if}
	{#if canInvite}
		<details class="invite">
			<summary><Icon name="ticket" />{t('invite.title')}</summary>
			<div class="form">
				<input bind:value={inviteName} placeholder={t('invite.username')} aria-label={t('invite.username')} />
				<select bind:value={expires} aria-label={t('invite.expires')}>
					{#each ['1h', '1d', '7d', '1mon'] as e (e)}
						<option value={e}>{t(`invite.exp.${e}` as 'invite.exp.1h')}</option>
					{/each}
				</select>
				<label><input type="checkbox" bind:checked={allowPresent} />{t('invite.present')}</label>
				<button class="primary" onclick={makeInvite}>{t('invite.create')}</button>
			</div>
			{#if meeting.invite}
				<div class="link">
					<code>{meeting.invite}</code>
					<button title={t('wait.copy')} aria-label={t('wait.copy')} onclick={() => navigator.clipboard.writeText(meeting.invite)}><Icon name="copy" /></button>
				</div>
			{/if}
			{#if canList && meeting.tokens.length}
				<ul class="tokens">
					{#each meeting.tokens as tk (tk.token)}
						<li>
							<span>{tk.username || t('invite.anyone')} · {tk.expires ? new Date(tk.expires).toLocaleString() : '-'}</span>
							<button title={t('wait.copy')} aria-label={t('wait.copy')} onclick={() => navigator.clipboard.writeText(meeting.link(tk.token))}><Icon name="copy" /></button>
							<button onclick={() => (meeting.editInvite(tk.token, 864e5), setTimeout(() => meeting.listInvites(), 500))}>{t('invite.extend')}</button>
							<button class="kick" onclick={() => (meeting.editInvite(tk.token, -1000), setTimeout(() => meeting.listInvites(), 500))}>{t('invite.revoke')}</button>
						</li>
					{/each}
				</ul>
			{/if}
		</details>
	{/if}
	<ul>
		{#each sorted as p (p.id)}
			<li>
				<span class="name">
					{p.name}{#if p.self}<small> {t('people.you')}</small>{/if}
					{#if p.account !== p.name}<small class="account">{p.account}</small>{/if}
				</span>
				{#if p.hand}<span class="hand" title={t('tb.handUp')}><Icon name="hand" /></span>{/if}
				{#if p.perms.includes('op')}<small class="tag">{t('people.op')}</small>{/if}
				{#if !p.self}
					<details>
						<summary title={t('people.manage')} aria-label={t('people.manage')}>...</summary>
						<menu>
							<li><button onclick={e => (close(e), onmessage(p.id))}>{t('people.message')}</button></li>
							<li><button onclick={e => sendFile(e, p.id)}>{t('people.sendFile')}</button></li>
							{#if op}
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
							{#if p.perms.includes('message')}
								<li><button onclick={e => act(e, 'shutup', p.id)}>{t('people.shutup')}</button></li>
							{:else}
								<li><button onclick={e => act(e, 'unshutup', p.id)}>{t('people.unshutup')}</button></li>
							{/if}
							<li><button onclick={e => act(e, 'identify', p.id)}>{t('people.identify')}</button></li>
							<li class="warnrow">
								<input bind:value={warnText} placeholder={t('people.warnText')} aria-label={t('people.warnText')} />
								<button onclick={e => warn(e, p.id)}>{t('people.warn')}</button>
							</li>
							<li><button class="kick" onclick={e => act(e, 'kick', p.id)}>{t('people.kick')}</button></li>
							{/if}
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
	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: .375rem;
		padding: 0 .75rem .75rem;
	}
	.tools button {
		display: flex;
		align-items: center;
		gap: .375rem;
		height: 2rem;
		padding: 0 .625rem;
		border: 1px solid #3a3f4b;
		border-radius: 1rem;
		font-size: .8125rem;
	}
	.invite {
		padding: 0 .75rem .75rem;
	}
	.invite summary {
		display: flex;
		align-items: center;
		gap: .375rem;
		cursor: pointer;
		font-size: .875rem;
		font-weight: 600;
	}
	.invite :global(svg) {
		width: 1rem;
		height: 1rem;
	}
	.form {
		display: grid;
		gap: .375rem;
		margin-top: .5rem;
	}
	.form input,
	.form select,
	.warnrow input {
		font: inherit;
		font-size: 1rem;
		height: 2.25rem;
		min-width: 0;
		border-radius: .5rem;
		border: 1px solid #3a3f4b;
		padding: 0 .5rem;
		background: #181a20;
		color: inherit;
	}
	.form label {
		display: flex;
		align-items: center;
		gap: .375rem;
		font-size: .875rem;
	}
	.link {
		display: flex;
		gap: .375rem;
		align-items: center;
		margin-top: .5rem;
	}
	.link code {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: .75rem;
	}
	.link button,
	.tokens button {
		height: 2rem;
		padding: 0 .5rem;
		border-color: #3a3f4b;
		font-size: .8125rem;
	}
	.tokens {
		margin: .5rem 0 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: .375rem;
	}
	.tokens li {
		display: flex;
		gap: .25rem;
		align-items: center;
		font-size: .75rem;
	}
	.tokens span {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.warnrow {
		display: flex;
		gap: .25rem;
		padding: .25rem;
	}
	.warnrow button {
		width: auto;
	}
	.tools button[aria-pressed='true'] {
		border-color: #fbbc04;
		color: #ffe08a;
	}
	.tools :global(svg) {
		width: 1rem;
		height: 1rem;
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
