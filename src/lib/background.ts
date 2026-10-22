import { glRenderer } from './compose-gl';

export type Effect = { kind: 'blur' } | { kind: 'image'; image: ImageBitmap };

type Pending = { resolve: (v: any) => void; reject: (e: Error) => void };

let worker: Promise<Worker> | null = null;
const pending = new Map<number, Pending>();
let seq = 0;

function call(w: Worker, msg: object, transfer: Transferable[] = []): Promise<any> {
	return new Promise((resolve, reject) => {
		const id = ++seq;
		pending.set(id, { resolve, reject });
		w.postMessage({ ...msg, id }, transfer);
	});
}

function fail(e: Error) {
	for (const p of pending.values()) p.reject(e);
	pending.clear();
}

function segmenter(): Promise<Worker> {
	worker ??= (async () => {
		const w = new Worker('/segment-worker.js');
		w.onmessage = e => {
			const p = pending.get(e.data.id);
			pending.delete(e.data.id);
			if (e.data.error) p?.reject(new Error(e.data.error));
			else p?.resolve(e.data);
		};
		w.onerror = e => {
			e.preventDefault();
			fail(new Error(e.message || 'segmentation worker failed'));
		};
		try {
			await call(w, {});
		} catch (e) {
			w.terminate();
			throw e;
		}
		return w;
	})().catch(e => {
		worker = null;
		throw e;
	});
	return worker;
}

function cover(ctx: CanvasRenderingContext2D, img: ImageBitmap, w: number, h: number) {
	const s = Math.max(w / img.width, h / img.height);
	ctx.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
}

const MASK = 256;
const BLUR = 16;

// The mask is opaque on the background: paint the effect there, then the camera frame behind it.
function draw(ctx: CanvasRenderingContext2D, small: CanvasRenderingContext2D, video: HTMLVideoElement, mask: ImageBitmap, effect: Effect) {
	const w = video.videoWidth;
	const h = video.videoHeight;
	if (ctx.canvas.width !== w || ctx.canvas.height !== h) {
		ctx.canvas.width = w;
		ctx.canvas.height = h;
		small.canvas.width = Math.ceil(w / BLUR);
		small.canvas.height = Math.ceil(h / BLUR);
	}
	ctx.globalCompositeOperation = 'copy';
	ctx.drawImage(mask, 0, 0, w, h);
	ctx.globalCompositeOperation = 'source-in';
	if (effect.kind === 'blur') {
		small.drawImage(video, 0, 0, small.canvas.width, small.canvas.height);
		ctx.drawImage(small.canvas, 0, 0, w, h);
	} else {
		cover(ctx, effect.image, w, h);
	}
	ctx.globalCompositeOperation = 'destination-over';
	ctx.drawImage(video, 0, 0, w, h);
	ctx.globalCompositeOperation = 'source-over';
}

export async function applyEffect(
	input: MediaStream,
	effect: Effect,
): Promise<{ stream: MediaStream; ready: Promise<unknown>; stop: () => void }> {
	const w = segmenter();
	let failed = false;
	w.catch(() => (failed = true));
	const video = document.createElement('video');
	video.muted = true;
	video.playsInline = true;
	video.srcObject = new MediaStream(input.getVideoTracks());
	await video.play();

	let canvas = document.createElement('canvas');
	let gl = glRenderer(canvas, effect);
	if (gl && video.videoWidth) {
		const blank = await createImageBitmap(new ImageData(MASK, Math.round((MASK * video.videoHeight) / video.videoWidth)));
		if (gl.bench(video, blank) > 25) gl = null;
		blank.close();
	}
	let render: (m: ImageBitmap) => void;
	if (gl) {
		const r = gl;
		render = m => r.draw(video, m);
	} else {
		canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d')!;
		const small = document.createElement('canvas').getContext('2d')!;
		if ('filter' in small) small.filter = 'blur(1px)';
		render = m => draw(ctx, small, video, m, effect);
	}
	const track = canvas.captureStream().getVideoTracks()[0];
	let stopped = false;
	// Until the first mask arrives everything counts as background, so the room never shows.
	const opaque = new ImageData(MASK, Math.round((MASK * video.videoHeight) / video.videoWidth));
	opaque.data.fill(255);
	let mask: ImageBitmap | null = await createImageBitmap(opaque);
	let busy = false;

	// Segmentation runs beside rendering: every camera frame is drawn with the latest mask.
	const segment = async () => {
		if (failed) return;
		busy = true;
		try {
			const f = await createImageBitmap(video, {
				resizeWidth: MASK,
				resizeHeight: Math.round((MASK * video.videoHeight) / video.videoWidth),
				resizeQuality: 'low',
			});
			const r = await call(await w, { frame: f, time: performance.now() }, [f]);
			if (stopped) return r.mask.close();
			mask?.close();
			mask = r.mask;
		} catch (e) {
			console.error(e);
		} finally {
			busy = false;
		}
	};

	const frame = () => {
		if (!busy) segment();
		if (mask) render(mask);
	};
	const loop = () => {
		if (stopped) return;
		frame();
		video.requestVideoFrameCallback(loop);
	};
	video.requestVideoFrameCallback(loop);
	// Hidden tabs get no video frame callbacks; worker timers keep running.
	const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 33)'])));
	ticker.onmessage = () => {
		if (document.hidden && !stopped) frame();
	};

	return {
		stream: new MediaStream([track, ...input.getAudioTracks()]),
		ready: w,
		stop() {
			stopped = true;
			ticker.terminate();
			mask?.close();
			track.stop();
			video.srcObject = null;
		},
	};
}

export async function loadImage(file: Blob): Promise<string> {
	const img = await createImageBitmap(file);
	const s = Math.min(1, 1280 / Math.max(img.width, img.height));
	const c = new OffscreenCanvas(Math.round(img.width * s), Math.round(img.height * s));
	c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
	img.close();
	const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
	return new Promise(resolve => {
		const r = new FileReader();
		r.onload = () => resolve(r.result as string);
		r.readAsDataURL(blob);
	});
}
