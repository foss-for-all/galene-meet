<script lang="ts">
	import type { Meeting } from '../lib/meeting.svelte';

	let { meeting, onclose }: { meeting: Meeting; onclose: () => void } = $props();

	let devices = $state<MediaDeviceInfo[]>([]);
	const cams = $derived(devices.filter(d => d.kind === 'videoinput'));
	const mics = $derived(devices.filter(d => d.kind === 'audioinput'));

	$effect(() => {
		navigator.mediaDevices.enumerateDevices().then(d => (devices = d));
	});

	async function upload(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const { loadImage } = await import('../lib/background');
		meeting.configure({ background: 'image', bgImage: await loadImage(file) });
	}
</script>

<dialog
	{@attach el => {
		el.showModal();
	}}
	onclose={onclose}
>
	<h2>설정</h2>
	<label>
		카메라
		<select value={meeting.camId} onchange={e => meeting.configure({ camId: e.currentTarget.value })}>
			<option value="">기본</option>
			{#each cams as d (d.deviceId)}
				<option value={d.deviceId}>{d.label || d.deviceId.slice(0, 8)}</option>
			{/each}
		</select>
	</label>
	<label>
		마이크
		<select value={meeting.micId} onchange={e => meeting.configure({ micId: e.currentTarget.value })}>
			<option value="">기본</option>
			{#each mics as d (d.deviceId)}
				<option value={d.deviceId}>{d.label || d.deviceId.slice(0, 8)}</option>
			{/each}
		</select>
	</label>
	<fieldset>
		<legend>배경</legend>
		<div class="bg">
			<button aria-pressed={meeting.background === 'none'} onclick={() => meeting.configure({ background: 'none' })}>없음</button>
			<button aria-pressed={meeting.background === 'blur'} onclick={() => meeting.configure({ background: 'blur' })}>흐리게</button>
			{#if meeting.bgImage}
				<button
					class="thumb"
					aria-pressed={meeting.background === 'image'}
					style:background-image="url({meeting.bgImage})"
					title="이미지"
					aria-label="이미지"
					onclick={() => meeting.configure({ background: 'image' })}
				></button>
			{/if}
			<label class="upload">
				이미지 선택
				<input type="file" accept="image/*" onchange={upload} />
			</label>
		</div>
	</fieldset>
	<form method="dialog">
		<button class="primary">닫기</button>
	</form>
</dialog>

<style>
	dialog {
		width: min(26rem, 100% - 2rem);
		border: none;
		border-radius: .75rem;
		padding: 1.25rem;
		background: #1f2229;
		color: #fff;
		display: grid;
		gap: 1rem;
	}
	dialog::backdrop {
		background: rgb(0 0 0 / .5);
	}
	h2 {
		margin: 0;
		font-size: 1.125rem;
	}
	label {
		display: grid;
		gap: .25rem;
		font-size: .875rem;
		font-weight: 600;
	}
	select {
		font: inherit;
		font-weight: 400;
		height: 2.5rem;
		border-radius: .5rem;
		border: 1px solid #3a3f4b;
		padding: 0 .5rem;
		background: #181a20;
		color: inherit;
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: none;
	}
	legend {
		margin-bottom: .25rem;
		font-size: .875rem;
		font-weight: 600;
	}
	.bg {
		display: flex;
		flex-wrap: wrap;
		gap: .5rem;
	}
	.bg button,
	.upload {
		height: 3.5rem;
		min-width: 5rem;
		border: 2px solid #3a3f4b;
		border-radius: .5rem;
		display: grid;
		place-items: center;
		font-weight: 400;
		cursor: pointer;
	}
	.bg button[aria-pressed='true'] {
		border-color: #8fb9ff;
	}
	.thumb {
		background-size: cover;
		background-position: center;
	}
	.upload input {
		display: none;
	}
	form {
		display: flex;
		justify-content: flex-end;
	}
</style>
