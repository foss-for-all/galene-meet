import en from './locales/en';
import ko from './locales/ko';

const dicts = { ko, en };

export type Lang = keyof typeof dicts;
export type Key = keyof typeof ko;

export const langs: Record<Lang, string> = { ko: '한국어', en: 'English' };

function detect(): Lang {
	const saved = localStorage.getItem('meet-lang');
	if (saved && saved in dicts) return saved as Lang;
	for (const l of navigator.languages) {
		const base = l.split('-')[0];
		if (base in dicts) return base as Lang;
	}
	return 'en';
}

export const i18n = $state({ lang: detect() });
document.documentElement.lang = i18n.lang;

export function setLang(lang: Lang) {
	i18n.lang = lang;
	localStorage.setItem('meet-lang', lang);
	document.documentElement.lang = lang;
}

export function t(key: Key, vars: Record<string, string | number> = {}): string {
	return dicts[i18n.lang][key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
