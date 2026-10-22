<script lang="ts">
	import { autoplay, resume } from '../lib/autoplay.svelte';
	import { t, type Key } from '../lib/i18n.svelte';
	import type { Meeting } from '../lib/meeting.svelte';
	import { support } from '../lib/support';
	import Chat from './Chat.svelte';
	import Icon from './Icon.svelte';
	import Meter from './Meter.svelte';
	import People from './People.svelte';
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

	$effect(() => {
		if (!warning) return;
		const id = setTimeout(() => (warning = ''), 4000);
		return () => clearTimeout(id);
	});
</script>

{#if settings}
	<Settings {meeting} onclose={closeSettings} />
{/if}

<div class="room">
	{#if meeting.recording}
		<p class="rec" role="status"><Icon name="circle-dot" />{t('room.recording')}</p>
	{/if}
	{#if autoplay.blocked}
		<button class="unmute primary" onclick={resume}>{t('room.unmute')}</button>
	{/if}
	{#if meeting.notice}
		<p class="notice" role="status">{meeting.notice}</p>
	{/if}
	<div class="stage">
		<Stage {meeting} {layout} />
		{#if panel === 'chat'}
			<Chat {meeting} />
		{:else if panel === 'people'}
			<People {meeting} />
		{/if}
	</div>
	<nav>
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
			<button
				aria-pressed={meeting.hand}
				title={t(meeting.hand ? 'tb.handDown' : 'tb.handUp')}
				onclick={() => run(null, () => meeting.raiseHand())}
			>
				<Icon name="hand" />
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
		transform: translateX(-50%);
		z-index: 2;
	}
	.notice,
	.rec {
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
	.rec {
		left: 1rem;
		display: flex;
		gap: .375rem;
		align-items: center;
		color: #ff8a80;
		font-size: .875rem;
	}
</style>
