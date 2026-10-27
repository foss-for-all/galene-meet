export const SSO: string = import.meta.env.VITE_SSO;
export const CLIENT = 'galene';
export const GROUP = 'meet/';
// Becomes a Galene group path and a recordings folder: no '.', '/' or escaping.
export const ROOM = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
// Paths the web server sends elsewhere (galene-compose/meet.caddy).
export const RESERVED = new Set(['ws', 'group', 'third-party', 'assets', 'portal', 'recordings', 'galene-api']);
