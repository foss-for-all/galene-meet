<script lang="ts">
	import { browser, i18n, langs, setLang, t, type Choice } from '../lib/i18n.svelte';
</script>

<select aria-label={t('settings.lang')} value={i18n.choice} onchange={e => setLang(e.currentTarget.value as Choice)}>
	<option value="auto">{t('settings.auto')} ({langs[browser()]})</option>
	{#each Object.entries(langs) as [code, name] (code)}
		<option value={code}>{name}</option>
	{/each}
</select>

<style>
	select {
		font: inherit;
		font-size: 1rem;
		height: 2.25rem;
		border-radius: .5rem;
		border: 1px solid var(--line);
		padding: 0 .5rem;
		background: var(--bg);
		color: var(--fg);
	}
</style>
