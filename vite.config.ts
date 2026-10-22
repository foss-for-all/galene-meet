import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

const galene = process.env.GALENE ?? 'http://127.0.0.1:8443';

export default defineConfig({
	plugins: [svelte()],
	server: {
		proxy: {
			'/ws': { target: galene, ws: true },
			'/group': galene,
		},
	},
});
