<script lang="ts">
	import { analyse, chime, type Level } from '../lib/audio';
	import { t } from '../lib/i18n.svelte';
	import { support } from '../lib/support';
	import Backgrounds from './Backgrounds.svelte';
	import Devices from './Devices.svelte';
	import Icon from './Icon.svelte';
	import Meter from './Meter.svelte';

	let {
		cam = $bindable(),
		mic = $bindable(),
		active,
	}: { cam: boolean; mic: boolean; active: boolean } = $props();

	let camId = $state(localStorage.getItem('meet-cam') ?? '');
	let micId = $state(localStorage.getItem('meet-mic') ?? '');
	let bg = $state(localStorage.getItem('meet-bg') ?? 'none');
	let bgImage = $state(localStorage.getItem('meet-bg-image') ?? '');
	let stream = $state<MediaStream | null>(null);
	let level = $state<Level | null>(null);
	let error = $state('');

	$effect(() => {
		const want = { audio: active && mic, video: active && cam };
		const ids = { camId, micId };
		const image = bg === 'image' && bgImage;
		const fx = want.video && support.effects && (bg === 'blur' || image) ? { image } : null;
		if (!want.audio && !want.video) return;
		let gone = false;
		let got: MediaStream | null = null;
		let lv: Level | null = null;
		let stopFx: (() => void) | null = null;
		navigator.mediaDevices
			.getUserMedia({
				audio: want.audio && (ids.micId ? { deviceId: ids.micId } : true),
				video: want.video && { deviceId: ids.camId || undefined, width: { ideal: 1280 }, height: { ideal: 720 } },
			})
			.then(async s => {
				got = s;
				if (gone) return s.getTracks().forEach(tr => tr.stop());
				let shown = s;
				if (fx) {
					try {
						const { applyEffect } = await import('../lib/background');
						const out = await applyEffect(
							s,
							fx.image ? { kind: 'image', image: await createImageBitmap(await (await fetch(fx.image)).blob()) } : { kind: 'blur' },
						);
						if (gone) return out.stop();
						stopFx = out.stop;
						shown = out.stream;
					} catch (e) {
						console.error(e);
					}
				}
				error = '';
				stream = shown;
				const a = s.getAudioTracks()[0];
				lv = a ? analyse(a) : null;
				level = lv;
			})
			.catch(e => {
				if (!gone) error = e.name === 'NotAllowedError' ? t('err.denied') : e.name === 'NotFoundError' ? t('err.noDevice') : t('err.busy');
			});
		return () => {
			gone = true;
			lv?.stop();
			stopFx?.();
			got?.getTracks().forEach(tr => tr.stop());
			stream = null;
			level = null;
		};
	});

	function background(o: { background?: string; bgImage?: string }) {
		if (o.background !== undefined) localStorage.setItem('meet-bg', (bg = o.background));
		if (o.bgImage !== undefined) {
			bgImage = o.bgImage;
			try {
				localStorage.setItem('meet-bg-image', bgImage);
			} catch {
				error = t('notice.bgTooBig');
			}
		}
	}

	function pick(o: { camId?: string; micId?: string }) {
		if (o.camId !== undefined) localStorage.setItem('meet-cam', (camId = o.camId));
		if (o.micId !== undefined) localStorage.setItem('meet-mic', (micId = o.micId));
	}

	const video = $derived(!!stream?.getVideoTracks().length);
</script>

<section>
	<div class="view">
		<video
			autoplay
			playsinline
			muted
			hidden={!video}
			{@attach el => {
				if (el.srcObject !== stream) el.srcObject = stream;
			}}
		></video>
		{#if !video}
			<p>{error || t('preview.off')}</p>
		{/if}
		<div class="controls">
			<button type="button" class:off={!mic} title={t(mic ? 'tb.micOff' : 'tb.micOn')} onclick={() => (mic = !mic)}>
				<Icon name={mic ? 'mic' : 'mic-off'} />
			</button>
			<button type="button" class:off={!cam} title={t(cam ? 'tb.camOff' : 'tb.camOn')} onclick={() => (cam = !cam)}>
				<Icon name={cam ? 'video' : 'video-off'} />
			</button>
		</div>
	</div>
	{#if level}
		<Meter read={level.read} />
	{/if}
	<Backgrounds value={bg} image={bgImage} onchange={background} />
	<details>
		<summary>{t('preview.devices')}</summary>
		<div class="devices">
			<Devices {camId} {micId} onchange={pick} />
			<button type="button" onclick={() => chime()}>{t('preview.speaker')}</button>
		</div>
	</details>
</section>

<style>
	section {
		width: 100%;
		display: grid;
		gap: .5rem;
	}
	.view {
		position: relative;
		aspect-ratio: 16 / 9;
		border-radius: .75rem;
		overflow: hidden;
		background: #23262e;
		display: grid;
		place-items: center;
	}
	video {
		width: 100%;
		height: 100%;
		object-fit: cover;
		transform: scaleX(-1);
	}
	p {
		margin: 0;
		padding: 0 1rem;
		color: #c9ced8;
		font-size: .875rem;
		text-align: center;
	}
	.controls {
		position: absolute;
		bottom: .5rem;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: .5rem;
	}
	.controls button {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: rgb(45 49 59 / .85);
		color: #fff;
	}
	.controls .off {
		background: var(--danger);
	}
	summary {
		cursor: pointer;
		font-size: .875rem;
	}
	.devices {
		display: grid;
		gap: .5rem;
		margin-top: .5rem;
	}
</style>
