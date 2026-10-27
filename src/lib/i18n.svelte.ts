import de from './locales/de';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import it from './locales/it';
import ja from './locales/ja';
import ko from './locales/ko';
import pt from './locales/pt';
import zhCN from './locales/zh-cn';
import zhTW from './locales/zh-tw';

const dicts = { ko, en, de, fr, es, it, pt, ja, 'zh-TW': zhTW, 'zh-CN': zhCN };

export type Lang = keyof typeof dicts;
export type Key = keyof typeof ko;

export const langs: Record<Lang, string> = {
	ko: '한국어',
	en: 'English',
	de: 'Deutsch',
	fr: 'Français',
	es: 'Español',
	it: 'Italiano',
	pt: 'Português',
	ja: '日本語',
	'zh-TW': '繁體中文',
	'zh-CN': '简体中文',
};

// zh-Hant, zh-TW, zh-HK, zh-MO read traditional characters; other Chinese tags read simplified.
function match(tag: string): Lang | null {
	const t = tag.toLowerCase();
	if (t.startsWith('zh')) return /hant|tw|hk|mo/.test(t) ? 'zh-TW' : 'zh-CN';
	const base = t.split('-')[0];
	return base in dicts ? (base as Lang) : null;
}

export type Choice = Lang | 'auto';

export function browser(): Lang {
	for (const l of navigator.languages) {
		const m = match(l);
		if (m) return m;
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
