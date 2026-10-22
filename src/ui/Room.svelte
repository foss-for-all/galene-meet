<script lang="ts">
	import type { Meeting } from '../lib/meeting.svelte';
	import Chat from './Chat.svelte';
	import Icon from './Icon.svelte';
	import People from './People.svelte';
	import Settings from './Settings.svelte';
	import Stage from './Stage.svelte';

	let { meeting }: { meeting: Meeting } = $props();

	const present = $derived(meeting.perms.includes('present'));
	const canRecord = $derived(meeting.perms.includes('record'));

	let settings = $state(false);
	let more = $state(false);
	const canShare = !!navigator.mediaDevices?.getDisplayMedia;

	function run(f: () => void) {
		more = false;
		f();
	}
	let layout = $state<'grid' | 'speaker'>('grid');
	let panel = $state<'chat' | 'people' | null>(null);
	let seen = $state(0);
	const unread = $derived(panel === 'chat' ? 0 : meeting.messages.length - seen);
	const hands = $derived(meeting.people.filter(p => p.hand).length);

	$effect(() => {
		if (panel === 'chat') seen = meeting.messages.length;
	});

	const toggle = (p: 'chat' | 'people') => (panel = panel === p ? null : p);

	$effect(() => {
		if (!meeting.notice) return;
		const t = setTimeout(() => (meeting.notice = ''), 5000);
		return () => clearTimeout(t);
	});
</script>

{#if settings}
	<Settings {meeting} onclose={() => (settings = false)} />
{/if}

<div class="room">
	{#if meeting.recording}
		<p class="rec" role="status"><Icon name="circle-dot" />녹화 중</p>
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
		{#if present}
			<button class:off={!meeting.mic} title={meeting.mic ? '마이크 끄기' : '마이크 켜기'} onclick={() => meeting.toggleMic()}>
				<Icon name={meeting.mic ? 'mic' : 'mic-off'} />
			</button>
			<button class:off={!meeting.cam} title={meeting.cam ? '카메라 끄기' : '카메라 켜기'} onclick={() => meeting.toggleCam()}>
				<Icon name={meeting.cam ? 'video' : 'video-off'} />
			</button>
		{/if}
		<div class="extra" class:open={more}>
			{#if present && canShare}
				<button aria-pressed={meeting.screen} title="화면 공유" onclick={() => run(() => meeting.toggleScreen())}>
					<Icon name="monitor-up" />
				</button>
			{/if}
			{#if canRecord}
				<button class:recording={meeting.recording} title={meeting.recording ? '녹화 중지' : '녹화 시작'} onclick={() => run(() => meeting.record())}>
					<Icon name="circle-dot" />
				</button>
			{/if}
			<button
				title={layout === 'grid' ? '발화자 보기' : '타일 보기'}
				onclick={() => run(() => (layout = layout === 'grid' ? 'speaker' : 'grid'))}
			>
				<Icon name={layout === 'grid' ? 'user-square' : 'layout-grid'} />
			</button>
			<button aria-pressed={meeting.hand} title={meeting.hand ? '손 내리기' : '손 들기'} onclick={() => run(() => meeting.raiseHand())}>
				<Icon name="hand" />
			</button>
			<button title="설정" onclick={() => run(() => (settings = true))}>
				<Icon name="settings" />
			</button>
		</div>
		<button class="more" aria-pressed={more} title="더보기" onclick={() => (more = !more)}>
			<Icon name="ellipsis" />
		</button>
		<button aria-pressed={panel === 'people'} title="참가자" onclick={() => toggle('people')}>
			<Icon name="users" />
			{#if hands > 0}<span class="badge hands">{hands}</span>{/if}
		</button>
		<button aria-pressed={panel === 'chat'} title="채팅" onclick={() => toggle('chat')}>
			<Icon name="message-square" />
			{#if unread > 0}<span class="badge">{unread}</span>{/if}
		</button>
		<button class="danger" title="나가기" onclick={() => meeting.leave()}>
			<Icon name="phone-off" />
		</button>
	</nav>
</div>

<style>
	.room {
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
