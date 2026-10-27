<script lang="ts">
	import { t, type Key } from '../lib/i18n.svelte';
	import type { Advanced, Meeting } from '../lib/meeting.svelte';

	let { meeting }: { meeting: Meeting } = $props();

	const selects = [
		{ key: 'send', options: ['lowest', 'low', 'normal', 'unlimited'] },
		{ key: 'simulcast', options: ['auto', 'on', 'off'] },
		{ key: 'receive', options: ['everything', 'low', 'screenshare', 'audio', 'nothing'] },
		{ key: 'filter', options: ['none', 'flip-h', 'flip-v', 'rotate'] },
	] as const;
	const checks = ['hqaudio', 'processing', 'blackboard', 'mirror', 'forceRelay'] as const;

	let relay = $state('');

	async function test() {
		relay = t('cmd.relayRunning');
		const start = Date.now();
		try {
			const rtt = await meeting.relayTest();
			relay = t('cmd.relayOk', { ms: Date.now() - start, rtt });
		} catch (e) {
			relay = t('cmd.relayFail', { error: String(e) });
		}
	}

	const set = (o: Partial<Advanced>) => meeting.advance(o);
</script>

<details>
	<summary>{t('settings.advanced')}</summary>
	<div class="grid">
		{#each selects as s (s.key)}
			<label>
				{t(`adv.${s.key}`)}
				<select value={meeting.adv[s.key]} onchange={e => set({ [s.key]: e.currentTarget.value })}>
					{#each s.options as o (o)}
						<option value={o}>{t(`adv.${s.key}.${o}` as Key)}</option>
					{/each}
				</select>
			</label>
		{/each}
		{#each checks as c (c)}
			<label class="check">
				<input type="checkbox" checked={meeting.adv[c]} onchange={e => set({ [c]: e.currentTarget.checked })} />
				{t(`adv.${c}`)}
			</label>
		{/each}
		<div class="buttons">
			<button type="button" onclick={() => meeting.renegotiate()}>{t('adv.renegotiate')}</button>
			<button type="button" onclick={test}>{t('adv.relayTest')}</button>
		</div>
		{#if relay}<p class="result">{relay}</p>{/if}
	</div>
</details>

<style>
	summary {
		cursor: pointer;
		font-size: .875rem;
		font-weight: 600;
	}
	.grid {
		display: grid;
		gap: .75rem;
		margin-top: .75rem;
	}
	label {
		display: grid;
		gap: .25rem;
		font-size: .875rem;
	}
	.check {
		display: flex;
		align-items: center;
		gap: .5rem;
	}
	.check input {
		width: 1.125rem;
		height: 1.125rem;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: .5rem;
	}
	.buttons button {
		height: 2.25rem;
		padding: 0 .75rem;
		border-color: var(--line);
		font-size: .875rem;
	}
	.result {
		margin: 0;
		font-size: .8125rem;
		color: #9aa0ad;
	}
	select {
		font: inherit;
		font-size: 1rem;
		height: 2.5rem;
		border-radius: .5rem;
		border: 1px solid var(--line);
		padding: 0 .5rem;
		background: var(--bg);
		color: var(--fg);
	}
</style>
