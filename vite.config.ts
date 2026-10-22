import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const galene = process.env.GALENE ?? 'http://127.0.0.1:8443';

const protocol = {
	name: 'galene-protocol',
	transform(code: string, id: string) {
		if (id.endsWith('/vendor/galene/protocol.js'))
			return code + '\nexport { ServerConnection, Stream };\n';
	},
};

export default defineConfig({
	plugins: [svelte(), protocol],
	server: {
		proxy: {
			'/ws': { target: galene, ws: true },
			'/group': galene,
			'/third-party': galene,
		},
	},
});
