import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { migrate } from './lib/images';

// A blocked IndexedDB must not keep the page from starting.
await Promise.race([migrate().catch(() => {}), new Promise(r => setTimeout(r, 1000))]);
mount(App, { target: document.body });
