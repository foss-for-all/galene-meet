let ctx: AudioContext | null = null;

function context() {
	ctx ??= new AudioContext();
	if (ctx.state === 'suspended') ctx.resume().catch(() => {});
	return ctx;
}

export type Level = { read: () => number; stop: () => void };

export function analyse(track: MediaStreamTrack): Level {
	const c = context();
	const a = c.createAnalyser();
	a.fftSize = 512;
	const src = c.createMediaStreamSource(new MediaStream([track]));
	src.connect(a);
	const buf = new Float32Array(a.fftSize);
	return {
		read() {
			a.getFloatTimeDomainData(buf);
			let sum = 0;
			for (const x of buf) sum += x * x;
			return Math.sqrt(sum / buf.length);
		},
		stop() {
			src.disconnect();
		},
	};
}

// Returns how long the sound plays, in milliseconds.
export function chime(sinkId = ''): number {
	const c = context();
	const out = c.createMediaStreamDestination();
	const el = new Audio();
	el.srcObject = out.stream;
	if (sinkId && 'setSinkId' in el) (el as any).setSinkId(sinkId).catch(() => {});
	el.play().catch(() => {});
	const now = c.currentTime;
	[523.25, 659.25, 783.99].forEach((f, i) => {
		const o = c.createOscillator();
		const g = c.createGain();
		o.frequency.value = f;
		g.gain.setValueAtTime(0, now + i * 0.18);
		g.gain.linearRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
		g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.5);
		o.connect(g).connect(out);
		o.start(now + i * 0.18);
		o.stop(now + i * 0.18 + 0.55);
	});
	setTimeout(() => (el.srcObject = null), 1500);
	return 1100;
}
