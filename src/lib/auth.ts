import { CLIENT, SSO } from './config';
import { t } from './i18n.svelte';

const PENDING = 'meet-login';
const TOKENS = 'meet-tokens';

type Tokens = { access: string; refresh?: string };

function b64url(buf: ArrayBuffer | Uint8Array): string {
	let s = '';
	for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const random = (n: number) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const redirect = () => location.origin + '/';

function take<T>(storage: Storage, key: string, remove = false): T | null {
	try {
		const v = JSON.parse(storage.getItem(key) ?? 'null');
		if (remove) storage.removeItem(key);
		return v;
	} catch {
		return null;
	}
}

export async function login(room: string) {
	const verifier = random(32);
	const state = random(16);
	const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
	sessionStorage.setItem(PENDING, JSON.stringify({ state, verifier, room }));
	location.assign(`${SSO}/auth?` + new URLSearchParams({
		client_id: CLIENT,
		response_type: 'code',
		scope: 'openid',
		redirect_uri: redirect(),
		state,
		code_challenge: challenge,
		code_challenge_method: 'S256',
	}));
}

async function grant(body: Record<string, string>): Promise<string> {
	let res: Response;
	try {
		res = await fetch(`${SSO}/token`, { method: 'POST', body: new URLSearchParams({ client_id: CLIENT, ...body }) });
	} catch {
		throw new Error(t('auth.unreachable'));
	}
	const json = await res.json().catch(() => ({}));
	if (!res.ok || !json.access_token)
		throw new Error(json.error_description || json.error || `HTTP ${res.status}`);
	sessionStorage.setItem(TOKENS, JSON.stringify({ access: json.access_token, refresh: json.refresh_token }));
	return json.access_token;
}

export async function callback(params: URLSearchParams): Promise<string> {
	const saved = take<{ state: string; verifier: string; room: string }>(sessionStorage, PENDING, true);
	// State first: otherwise any link could put its own error_description on the page.
	if (!saved || saved.state !== params.get('state'))
		throw new Error(t('auth.mismatch'));
	if (params.has('error'))
		throw new Error(params.get('error_description') || params.get('error')!);
	await grant({
		grant_type: 'authorization_code',
		code: params.get('code') ?? '',
		redirect_uri: redirect(),
		code_verifier: saved.verifier,
	});
	return saved.room;
}

function expired(jwt: string): boolean {
	try {
		const { exp } = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
		return exp * 1000 < Date.now() + 30_000;
	} catch {
		return true;
	}
}

export function loggedIn(): boolean {
	return take<Tokens>(sessionStorage, TOKENS) !== null;
}

export async function token(): Promise<string | null> {
	const t = take<Tokens>(sessionStorage, TOKENS);
	if (!t) return null;
	if (!expired(t.access)) return t.access;
	if (t.refresh) {
		try {
			return await grant({ grant_type: 'refresh_token', refresh_token: t.refresh });
		} catch {}
	}
	logout();
	return null;
}

export function logout() {
	sessionStorage.removeItem(TOKENS);
}
