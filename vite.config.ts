import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { SSO } from './src/lib/config';

const galene = process.env.GALENE ?? 'http://127.0.0.1:8443';

const protocol = {
	name: 'galene-protocol',
	transform(code: string, id: string) {
		if (id.endsWith('/vendor/galene/protocol.js'))
			return code + '\nexport { ServerConnection, Stream };\n';
	},
};

// Only in the build: the dev server injects inline scripts.
const csp = {
	name: 'csp',
	apply: 'build' as const,
	transformIndexHtml(html: string) {
		const policy = [
			"default-src 'self'",
			"script-src 'self'",
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob:",
			"media-src 'self' blob:",
			`connect-src 'self' data: ${new URL(SSO).origin}`,
			"worker-src 'self' blob:",
			"object-src 'none'",
			"base-uri 'none'",
			"form-action 'self'",
		].join('; ');
		return html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${policy}">`);
	},
};

export default defineConfig({
	plugins: [svelte(), protocol, csp],
	preview: {
		proxy: {
			'/ws': { target: galene, ws: true },
			'/group': galene,
			'/third-party': galene,
		},
	},
	server: {
		proxy: {
			'/ws': { target: galene, ws: true },
			'/group': galene,
			'/third-party': galene,
		},
	},
});
