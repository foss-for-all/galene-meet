<script lang="ts">
	import { t } from '../lib/i18n.svelte';

	let {
		camId,
		micId,
		onchange,
	}: { camId: string; micId: string; onchange: (o: { camId?: string; micId?: string }) => void } = $props();

	let devices = $state<MediaDeviceInfo[]>([]);
	const cams = $derived(devices.filter(d => d.kind === 'videoinput' && d.deviceId));
	const mics = $derived(devices.filter(d => d.kind === 'audioinput' && d.deviceId));

	$effect(() => {
		const md = navigator.mediaDevices;
		const load = () => md.enumerateDevices().then(d => (devices = d));
		load();
		md.addEventListener('devicechange', load);
		return () => md.removeEventListener('devicechange', load);
	});
</script>

<label>
	{t('settings.camera')}
	<select value={camId} onchange={e => onchange({ camId: e.currentTarget.value })}>
		<option value="">{t('settings.default')}</option>
		{#each cams as d (d.deviceId)}
			<option value={d.deviceId}>{d.label || d.deviceId.slice(0, 8)}</option>
		{/each}
	</select>
</label>
<label>
	{t('settings.mic')}
	<select value={micId} onchange={e => onchange({ micId: e.currentTarget.value })}>
		<option value="">{t('settings.default')}</option>
		{#each mics as d (d.deviceId)}
			<option value={d.deviceId}>{d.label || d.deviceId.slice(0, 8)}</option>
		{/each}
	</select>
</label>

<style>
	label {
		display: grid;
		gap: .25rem;
		font-size: .875rem;
		font-weight: 600;
	}
	select {
		font: inherit;
		font-size: 1rem;
		font-weight: 400;
		height: 2.5rem;
		border-radius: .5rem;
		border: 1px solid var(--line);
		padding: 0 .5rem;
		background: var(--bg);
		color: var(--fg);
	}
</style>
