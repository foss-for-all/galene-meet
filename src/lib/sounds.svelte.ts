import { context } from './audio';

export const SOUNDS = ['join', 'leave', 'chat', 'hand', 'reaction'] as const;
export type Sound = (typeof SOUNDS)[number];

const DEFAULT: Record<Sound, boolean> = { join: true, leave: true, chat: true, hand: true, reaction: false };

// [frequency Hz, start s, length s]
const TONES: Record<Sound, [number, number, number][]> = {
	join: [[660, 0, 0.12], [880, 0.12, 0.2]],
	leave: [[880, 0, 0.12], [587, 0.12, 0.22]],
	chat: [[1046, 0, 0.09]],
	hand: [[784, 0, 0.14], [1046, 0.14, 0.26]],
	reaction: [[1318, 0, 0.07]],
};

function load(): Record<Sound, boolean> {
	try {
		return { ...DEFAULT, ...JSON.parse(localStorage.getItem('meet-sounds') ?? '{}') };
	} catch {
		return { ...DEFAULT };
	}
}

export const sounds = $state(load());

export function setSound(s: Sound, on: boolean) {
	sounds[s] = on;
	localStorage.setItem('meet-sounds', JSON.stringify(sounds));
}

export function play(s: Sound) {
	if (!sounds[s]) return;
	const c = context();
	const now = c.currentTime;
	for (const [f, at, len] of TONES[s]) {
		const o = c.createOscillator();
		const g = c.createGain();
		o.frequency.value = f;
		g.gain.setValueAtTime(0, now + at);
		g.gain.linearRampToValueAtTime(0.12, now + at + 0.01);
		g.gain.exponentialRampToValueAtTime(0.001, now + at + len);
		o.connect(g).connect(c.destination);
		o.start(now + at);
		o.stop(now + at + len + 0.02);
	}
}
