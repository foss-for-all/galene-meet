import en from './locales/en';
import ko from './locales/ko';

const dicts = { ko, en };

export type Lang = keyof typeof dicts;
export type Key = keyof typeof ko;

export const langs: Record<Lang, string> = { ko: '한국어', en: 'English' };

export type Choice = Lang | 'auto';

export function browser(): Lang {
	for (const l of navigator.languages) {
		const base = l.split('-')[0];
		if (base in dicts) return base as Lang;
	}
	return 'en';
}

const saved = localStorage.getItem('meet-lang');
const choice: Choice = saved && saved in dicts ? (saved as Lang) : 'auto';

export const i18n = $state({ choice, lang: choice === 'auto' ? browser() : choice });
document.documentElement.lang = i18n.lang;

export function setLang(c: Choice) {
	i18n.choice = c;
	i18n.lang = c === 'auto' ? browser() : c;
	if (c === 'auto') localStorage.removeItem('meet-lang');
	else localStorage.setItem('meet-lang', c);
	document.documentElement.lang = i18n.lang;
}

export function t(key: Key, vars: Record<string, string | number> = {}): string {
	return dicts[i18n.lang][key].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
