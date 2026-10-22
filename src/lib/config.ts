export const SSO = 'https://sso.fossforall.org/realms/fossforall/protocol/openid-connect';
export const CLIENT = 'galene';
export const GROUP = 'meet/';
// Becomes a Galene group path and a recordings folder: no '.', '/' or escaping.
export const ROOM = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
