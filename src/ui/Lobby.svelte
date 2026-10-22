<script lang="ts">
	import { ROOM } from '../lib/config';
	import Logo from './Logo.svelte';

	let {
		room = $bindable(),
		member,
		error,
		onjoin,
		onlogin,
		onlogout,
	}: {
		room: string;
		member: boolean;
		error: string;
		onjoin: (name: string) => void;
		onlogin: () => void;
		onlogout: () => void;
	} = $props();

	let name = $state(localStorage.getItem('meet-name') ?? '');
	let msg = $state('');
	const shown = $derived(msg || error);

	function randomRoom() {
		const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
		let s = '';
		crypto.getRandomValues(new Uint8Array(12)).forEach((x, i) => {
			s += (i && i % 4 === 0 ? '-' : '') + abc[x % abc.length];
		});
		room = s;
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		room = room.trim().toLowerCase();
		if (!ROOM.test(room)) {
			msg = '방 이름은 영문 소문자, 숫자, -만 씁니다.';
			return;
		}
		if (e.submitter?.getAttribute('value') === 'login') {
			onlogin();
			return;
		}
		name = name.trim();
		if (!member && !name) {
			msg = '이름을 입력하세요.';
			return;
		}
		msg = '';
		localStorage.setItem('meet-name', name);
		onjoin(name);
	}
</script>

<main>
	<Logo />
	<h1>Galene</h1>
	<form onsubmit={submit} novalidate>
		<label for="room">방 이름</label>
		<div class="row">
			<input id="room" bind:value={room} maxlength="64" autocomplete="off" autocapitalize="none" spellcheck="false" />
			<button type="button" onclick={randomRoom}>무작위</button>
		</div>
		{#if member}
			<button type="submit" class="primary">입장</button>
			<button type="button" class="link" onclick={onlogout}>로그아웃</button>
		{:else}
			<label for="name">이름</label>
			<input id="name" bind:value={name} maxlength="64" autocomplete="nickname" />
			<div class="row">
				<button type="submit" value="login" class="primary">회원 로그인</button>
				<button type="submit" value="guest">손님으로 입장</button>
			</div>
		{/if}
	</form>
	<p role="alert">{shown}</p>
</main>

<style>
	main {
		width: min(22rem, 100% - 2rem);
		margin: auto;
		display: grid;
		gap: 1.25rem;
		justify-items: center;
	}
	h1 {
		margin: -.5rem 0 0;
		font-size: 1.25rem;
		font-weight: 600;
	}
	form {
		width: 100%;
		display: grid;
		gap: .5rem;
	}
	label {
		font-size: .875rem;
		font-weight: 600;
	}
	.row {
		display: flex;
		gap: .5rem;
	}
	.row > :global(*) {
		flex: 1;
	}
	.row > button[type='button'] {
		flex: none;
	}
	#room {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
	}
	.link {
		border: none;
		height: auto;
		font-size: .875rem;
		text-decoration: underline;
	}
	p {
		margin: 0;
		min-height: 1.5em;
		color: var(--err);
		font-size: .875rem;
		text-align: center;
	}
</style>
