<script lang="ts">
	import { autoplay, resume } from '../lib/autoplay.svelte';
	import { pick } from '../lib/commands';
	import { t, type Key } from '../lib/i18n.svelte';
	import { REACTIONS, type Meeting } from '../lib/meeting.svelte';
	import { support } from '../lib/support';
	import Chat from './Chat.svelte';
	import Icon from './Icon.svelte';
	import Meter from './Meter.svelte';
	import People from './People.svelte';
	import Reactions from './Reactions.svelte';
	import Settings from './Settings.svelte';
	import Stage from './Stage.svelte';

	let { meeting }: { meeting: Meeting } = $props();

	const present = $derived(meeting.perms.includes('present'));
	const noPresent = $derived(present ? null : ('why.present' as const));
	const noShare = $derived(support.share ? noPresent : ('why.share' as const));
	const noRecord = $derived(meeting.perms.includes('record') ? null : ('why.record' as const));

	let settings = $state(false);
	let settingsButton: HTMLButtonElement;
	let moreButton: HTMLButtonElement;

	function closeSettings() {
		settings = false;
		(settingsButton.offsetParent ? settingsButton : moreButton).focus();
	}
	let more = $state(false);
	let reacting = $state(false);
	let warning = $state('');
	let layout = $state<'grid' | 'speaker'>('grid');
	let panel = $state<'chat' | 'people' | null>(null);
	let seen = $state(0);
	const unread = $derived(panel === 'chat' ? 0 : meeting.messages.length - seen);
	const hands = $derived(meeting.people.filter(p => p.hand).length);

	function run(why: Key | null, f: () => void) {
		more = false;
		if (why) warning = t(why);
		else f();
	}

	const toggle = (p: 'chat' | 'people') => (panel = panel === p ? null : p);

	$effect(() => {
		if (panel === 'chat' || meeting.messages.length < seen) seen = meeting.messages.length;
	});

	$effect(() => {
		if (!meeting.notice) return;
		const id = setTimeout(() => (meeting.notice = ''), 5000);
		return () => clearTimeout(id);
	});

	let now = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});
	const elapsed = $derived.by(() => {
		const sec = Math.max(0, Math.floor((now - meeting.joinedAt) / 1000));
		const h = Math.floor(sec / 3600);
		const mm = String(Math.floor((sec % 3600) / 60)).padStart(h ? 2 : 1, '0');
		const ss = String(sec % 60).padStart(2, '0');
		return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
	});

	async function presentFile() {
		if (meeting.playing) return meeting.stopFile();
		const f = await pick('audio/*,video/*');
		if (f) await meeting.presentFile(f);
	}

	const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

	async function copyLink() {
		const room = (meeting.sc.group ?? '').replace(/^meet\//, '');
		await navigator.clipboard.writeText(`${location.origin}/${room}`).catch(() => {});
		meeting.notice = t('notice.copied');
	}

	// Single-key shortcuts like Meet's, ignored while typing or in a dialog.
	function typing(e: KeyboardEvent) {
		const el = e.target as HTMLElement;
		return e.ctrlKey || e.metaKey || e.altKey || settings || !!el.closest('input, textarea, select, [contenteditable], dialog');
	}

	function keydown(e: KeyboardEvent) {
		if (typing(e)) return;
		if (e.code === 'Space') {
			// A control focused from the keyboard keeps Space; one merely clicked does not.
			const el = e.target as HTMLElement;
			if (el.matches?.(':focus-visible') && el.closest('button, summary, a, [role="button"]')) return;
			e.preventDefault();
			if (!e.repeat && present) meeting.talk(true);
			return;
		}
		if (e.repeat) return;
		const k = e.key.toLowerCase();
		if (k === 'm') run(noPresent, () => meeting.toggleMic());
		else if (k === 'v') run(noPresent, () => meeting.toggleCam());
		else if (k === 'h') meeting.raiseHand();
		else if (k === 'c') toggle('chat');
		else if (k === 'p') toggle('people');
	}

	function keyup(e: KeyboardEvent) {
		if (e.code === 'Space' && meeting.ptt) {
			e.preventDefault();
			meeting.talk(false);
		}
	}

	// Asks before a reload or close: the last host leaving ends the meeting for everyone.
	$effect(() => {
		const ask = (e: BeforeUnloadEvent) => {
			if (meeting.closed) return;
			e.preventDefault();
			e.returnValue = '';
		};
		addEventListener('beforeunload', ask);
		return () => removeEventListener('beforeunload', ask);
	});

	$effect(() => {
		if (!warning) return;
		const id = setTimeout(() => (warning = ''), 4000);
		return () => clearTimeout(id);
	});
</script>

<svelte:window onkeydown={keydown} onkeyup={keyup} onblur={() => meeting.ptt && meeting.talk(false)} />

{#if settings}
	<Settings {meeting} onclose={closeSettings} />
{/if}

<div class="room">
	<div class="status">
		<span class="clock">{elapsed}</span>
		{#if meeting.recording}
			<span class="rec" role="status"><Icon name="circle-dot" />{t('room.recording')}</span>
		{/if}
		{#if meeting.locked}
			<span role="status"><Icon name="lock" />{t('room.locked')}</span>
		{/if}
		{#if meeting.ptt}
			<span class="ptt" role="status"><Icon name="mic" />{t('room.ptt')}</span>
		{/if}
	</div>
	{#if autoplay.blocked}
		<button class="unmute primary" onclick={resume}>{t('room.unmute')}</button>
	{/if}
	{#if meeting.notice}
		<p class="notice" role="status">{meeting.notice}</p>
	{/if}
	<div class="stage" class:side={panel !== null}>
		<Stage {meeting} {layout} />
		<Reactions {meeting} />
		{#if meeting.transfers.length}
			<ul class="transfers">
				{#each meeting.transfers as x (x.f.fullid())}
					<li>
						<Icon name="paperclip" />
						<div>
							<b>{x.f.name}</b>
							<small>
								{t(x.f.up ? 'file.to' : 'file.from', { name: x.f.username })} · {kb(x.f.size)}
								{#if x.state === 'connected'}· {Math.round((100 * x.done) / Math.max(1, x.f.size))}%{/if}
								· {t(`file.${x.state}` as 'file.done')}
							</small>
							{#if x.state === 'offered'}<small class="ip">{t('file.ip')}</small>{/if}
						</div>
						{#if x.state === 'offered'}
							<button class="primary" onclick={() => x.f.receive()}>{t('file.accept')}</button>
						{/if}
						{#if x.state !== 'done' && x.state !== 'cancelled' && x.state !== 'closed'}
							<button onclick={() => x.f.cancel()}>{t(x.f.up ? 'file.cancel' : 'file.reject')}</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if panel === 'chat'}
			<Chat {meeting} />
		{:else if panel === 'people'}
			<People
				{meeting}
				onmessage={id => {
					meeting.dm = id;
					panel = 'chat';
				}}
			/>
		{/if}
	</div>
	<nav>
		{#if reacting}
			<div class="reacts" role="group" aria-label={t('tb.react')}>
				{#each REACTIONS as r (r)}
					<button title={t(`react.${r}`)} aria-label={t(`react.${r}`)} onclick={() => meeting.react(r)}>
						<Icon name={r} />
					</button>
				{/each}
			</div>
		{/if}
		{#if warning}
			<p class="warning" role="alert"><Icon name="triangle-alert" />{warning}</p>
		{/if}
		<button
			class:off={present && !meeting.mic}
			aria-disabled={!!noPresent}
			title={noPresent ? t(noPresent) : t(meeting.mic ? 'tb.micOff' : 'tb.micOn')}
			onclick={() => run(noPresent, () => meeting.toggleMic())}
		>
			<Icon name={meeting.mic ? 'mic' : 'mic-off'} />
			{#if meeting.mic}<span class="level"><Meter read={() => meeting.level()} /></span>{/if}
		</button>
		<button
			class:off={present && !meeting.cam}
			aria-disabled={!!noPresent}
			title={noPresent ? t(noPresent) : t(meeting.cam ? 'tb.camOff' : 'tb.camOn')}
			onclick={() => run(noPresent, () => meeting.toggleCam())}
		>
			<Icon name={meeting.cam ? 'video' : 'video-off'} />
		</button>
		<div class="extra" class:open={more}>
			<button
				aria-pressed={meeting.screen}
				aria-disabled={!!noShare}
				title={noShare ? t(noShare) : t('tb.share')}
				onclick={() => run(noShare, () => meeting.toggleScreen())}
			>
				<Icon name="monitor-up" />
			</button>
			<button
				class:recording={meeting.recording}
				aria-disabled={!!noRecord}
				title={noRecord ? t(noRecord) : t(meeting.recording ? 'tb.recStop' : 'tb.recStart')}
				onclick={() => run(noRecord, () => meeting.record())}
			>
				<Icon name="circle-dot" />
			</button>
			<button
				title={t(layout === 'grid' ? 'tb.speaker' : 'tb.grid')}
				onclick={() => run(null, () => (layout = layout === 'grid' ? 'speaker' : 'grid'))}
			>
				<Icon name={layout === 'grid' ? 'user-square' : 'layout-grid'} />
			</button>
			<button aria-pressed={reacting} title={t('tb.react')} onclick={() => run(null, () => (reacting = !reacting))}>
				<Icon name="smile-plus" />
			</button>
			<button
				aria-pressed={meeting.hand}
				title={t(meeting.hand ? 'tb.handDown' : 'tb.handUp')}
				onclick={() => run(null, () => meeting.raiseHand())}
			>
				<Icon name="hand" />
			</button>
			<button
				aria-pressed={meeting.playing}
				aria-disabled={!!noPresent}
				title={noPresent ? t(noPresent) : t(meeting.playing ? 'tb.stopFile' : 'tb.presentFile')}
				onclick={() => run(noPresent, presentFile)}
			>
				<Icon name="film" />
			</button>
			<button title={t('tb.copyLink')} onclick={() => run(null, copyLink)}>
				<Icon name="link" />
			</button>
			<button bind:this={settingsButton} title={t('tb.settings')} onclick={() => run(null, () => (settings = true))}>
				<Icon name="settings" />
			</button>
		</div>
		<button bind:this={moreButton} class="more" aria-pressed={more} title={t('tb.more')} onclick={() => (more = !more)}>
			<Icon name="ellipsis" />
		</button>
		<button aria-pressed={panel === 'people'} title={t('tb.people')} onclick={() => toggle('people')}>
			<Icon name="users" />
			{#if hands > 0}<span class="badge hands">{hands}</span>{/if}
		</button>
		<button aria-pressed={panel === 'chat'} title={t('tb.chat')} onclick={() => toggle('chat')}>
			<Icon name="message-square" />
			{#if unread > 0}<span class="badge">{unread}</span>{/if}
		</button>
		<button class="danger" title={t('tb.leave')} onclick={() => meeting.leave()}>
			<Icon name="phone-off" />
		</button>
	</nav>
</div>

<style>
	.room {
		color-scheme: dark;
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		background: var(--stage);
		color: #fff;
	}
	.stage {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
	}
	nav {
		position: relative;
		display: flex;
		justify-content: center;
		gap: .5rem;
		padding: .5rem .5rem max(.5rem, env(safe-area-inset-bottom));
	}
	.extra {
		display: contents;
	}
	.more {
		display: none !important;
	}
	nav button {
		position: relative;
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: #2d313b;
	}
	nav button:hover {
		background: #3a3f4b;
	}
	nav button[aria-pressed='true'] {
		background: #8fb9ff;
		color: #111318;
	}
	nav .off {
		background: var(--danger);
	}
	nav .recording {
		color: var(--danger);
	}
	nav .danger {
		width: 4rem;
		border-radius: 1.5rem;
		background: var(--danger);
	}
	@media (max-width: 40rem) {
		nav {
			gap: .375rem;
		}
		nav button {
			width: 2.75rem;
			height: 2.75rem;
		}
		nav .danger {
			width: 3.5rem;
		}
		.more {
			display: grid !important;
		}
		.extra {
			display: none;
			position: absolute;
			bottom: 100%;
			left: 50%;
			transform: translateX(-50%);
			z-index: 3;
			gap: .375rem;
			padding: .5rem;
			border-radius: 1.75rem;
			background: #1f2229;
			box-shadow: 0 .5rem 1.5rem rgb(0 0 0 / .4);
		}
		.extra.open {
			display: flex;
		}
	}
	.warning {
		position: absolute;
		bottom: calc(100% + 4.25rem);
		left: 50%;
		transform: translateX(-50%);
		z-index: 4;
		width: max-content;
		max-width: calc(100vw - 2rem);
		margin: 0;
		display: flex;
		align-items: center;
		gap: .5rem;
		padding: .625rem 1rem;
		border: 1px solid #fbbc04;
		border-radius: .75rem;
		background: #2e2610;
		color: #ffe08a;
		font-size: .875rem;
		box-shadow: 0 .5rem 1.5rem rgb(0 0 0 / .4);
	}
	.reacts {
		position: absolute;
		bottom: 100%;
		left: 50%;
		transform: translateX(-50%);
		z-index: 3;
		display: flex;
		gap: .25rem;
		padding: .375rem;
		border-radius: 1.75rem;
		background: #1f2229;
		box-shadow: 0 .5rem 1.5rem rgb(0 0 0 / .4);
	}
	.transfers {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		z-index: 3;
		width: min(22rem, calc(100% - 2rem));
		margin: 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: .5rem;
	}
	.side .transfers {
		right: 21rem;
	}
	@media (max-width: 40rem) {
		.side .transfers {
			right: 1rem;
			top: 3.5rem;
			bottom: auto;
		}
	}
	.transfers li {
		display: flex;
		align-items: center;
		gap: .5rem;
		padding: .625rem .75rem;
		border-radius: .75rem;
		background: #1f2229;
		box-shadow: 0 .5rem 1.5rem rgb(0 0 0 / .4);
	}
	.transfers div {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.transfers b {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: .875rem;
	}
	.transfers small {
		color: #9aa0ad;
		font-size: .75rem;
	}
	.transfers .ip {
		color: #ffe08a;
	}
	.transfers button {
		height: 2rem;
		padding: 0 .625rem;
		border-color: #3a3f4b;
		font-size: .8125rem;
	}
	.level {
		position: absolute;
		left: 25%;
		right: 25%;
		bottom: .4rem;
	}
	.badge {
		position: absolute;
		top: -.125rem;
		right: -.125rem;
		min-width: 1.25rem;
		padding: 0 .25rem;
		border-radius: 1rem;
		background: var(--danger);
		color: #fff;
		font-size: .75rem;
		line-height: 1.25rem;
	}
	.hands {
		background: #fbbc04;
		color: #111318;
	}
	.unmute {
		position: absolute;
		top: 1rem;
		left: 50%;
		translate: -50% 0;
		z-index: 2;
	}
	.notice {
		position: absolute;
		top: 1rem;
		z-index: 1;
		margin: 0;
		padding: .375rem .75rem;
		border-radius: .5rem;
		background: #2d313b;
	}
	.notice {
		left: 50%;
		transform: translateX(-50%);
	}
	.status {
		position: absolute;
		top: 1rem;
		left: 1rem;
		z-index: 1;
		display: flex;
		gap: .375rem;
		pointer-events: none;
	}
	.status span {
		display: flex;
		gap: .375rem;
		align-items: center;
		padding: .25rem .625rem;
		border-radius: .5rem;
		background: rgb(45 49 59 / .85);
		font-size: .8125rem;
		font-variant-numeric: tabular-nums;
	}
	.status .rec {
		color: #ff8a80;
	}
	.status .ptt {
		color: #34c759;
	}
	.status :global(svg) {
		width: 1rem;
		height: 1rem;
	}
</style>
