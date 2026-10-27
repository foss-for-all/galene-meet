<script lang="ts">
	import { t } from '../lib/i18n.svelte';
	import { SOUNDS, setSound, sounds } from '../lib/sounds.svelte';
	import type { Meeting } from '../lib/meeting.svelte';
	import Advanced from './Advanced.svelte';
	import Backgrounds from './Backgrounds.svelte';
	import Devices from './Devices.svelte';
	import Lang from './Lang.svelte';
	import Meter from './Meter.svelte';

	let { meeting, onclose }: { meeting: Meeting; onclose: () => void } = $props();

</script>

<dialog
	{@attach el => {
		el.showModal();
	}}
	onclose={onclose}
>
	<h2>{t('settings.title')}</h2>
	<label>
		{t('settings.name')}
		<input
			value={meeting.myName}
			maxlength="64"
			autocomplete="nickname"
			onchange={e => {
				meeting.rename(e.currentTarget.value);
				localStorage.setItem('meet-name', e.currentTarget.value.trim());
			}}
		/>
	</label>
	<Devices camId={meeting.camId} micId={meeting.micId} onchange={o => meeting.configure(o)} />
	{#if meeting.mic}
		<Meter read={() => meeting.level()} />
	{/if}
	<Backgrounds value={meeting.background} selected={meeting.bgId} onchange={o => meeting.configure(o)} />
	<label class="check">
		<input type="checkbox" checked={meeting.hideSelf} onchange={e => meeting.setHideSelf(e.currentTarget.checked)} />
		{t('settings.hideSelf')}
	</label>
	<fieldset>
		<legend>{t('settings.sounds')}</legend>
		<div class="sounds">
			{#each SOUNDS as s (s)}
				<label class="check">
					<input type="checkbox" checked={sounds[s]} onchange={e => setSound(s, e.currentTarget.checked)} />
					{t(`sound.${s}`)}
				</label>
			{/each}
		</div>
	</fieldset>
	<Advanced {meeting} />
	<details>
		<summary>{t('settings.shortcuts')}</summary>
		<dl>
			<dt>M</dt><dd>{t('tb.micOn')} / {t('tb.micOff')}</dd>
			<dt>V</dt><dd>{t('tb.camOn')} / {t('tb.camOff')}</dd>
			<dt>H</dt><dd>{t('tb.handUp')}</dd>
			<dt>C</dt><dd>{t('tb.chat')}</dd>
			<dt>P</dt><dd>{t('tb.people')}</dd>
			<dt>Space</dt><dd>{t('keys.ptt')}</dd>
		</dl>
	</details>
	<label>
		{t('settings.lang')}
		<Lang />
	</label>
	<form method="dialog">
		<button class="primary">{t('settings.close')}</button>
	</form>
</dialog>

<style>
	dialog {
		color-scheme: dark;
		--bg: #181a20;
		--fg: #fff;
		--line: #3a3f4b;
		--accent: #8fb9ff;
		--warn: #fbbc04;
		--warn-bg: #2e2610;
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
	input {
		font-size: 1rem;
		height: 2.5rem;
		border-color: var(--line);
		background: var(--bg);
		font-weight: 400;
	}
	.check {
		display: flex;
		align-items: center;
		gap: .5rem;
		font-weight: 400;
	}
	.check input {
		width: 1.125rem;
		height: 1.125rem;
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
	.sounds {
		display: flex;
		flex-wrap: wrap;
		gap: .5rem 1rem;
	}
	summary {
		cursor: pointer;
		font-size: .875rem;
		font-weight: 600;
	}
	dl {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: .375rem .75rem;
		margin: .75rem 0 0;
		font-size: .875rem;
	}
	dt {
		font-family: 'IBM Plex Mono', ui-monospace, monospace;
		font-weight: 600;
	}
	dd {
		margin: 0;
	}
	form {
		display: flex;
		justify-content: flex-end;
	}
</style>
