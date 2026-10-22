<script lang="ts">
	import { i18n, langs, setLang, t, type Lang } from '../lib/i18n.svelte';
</script>

<select aria-label={t('settings.lang')} value={i18n.lang} onchange={e => setLang(e.currentTarget.value as Lang)}>
	{#each Object.entries(langs) as [code, name] (code)}
		<option value={code}>{name}</option>
	{/each}
</select>

<style>
	select {
		font: inherit;
		font-size: .875rem;
		height: 2.25rem;
		border-radius: .5rem;
		border: 1px solid var(--line);
		padding: 0 .5rem;
		background: transparent;
		color: inherit;
	}
</style>
