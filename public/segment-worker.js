'use strict';

const BASE = '/third-party/tasks-vision/';

let segmenter;
let prev = null;

// New frames weigh this much against the running mask; lower is steadier but lags motion.
const FRESH = 0.6;

async function load() {
	const vision = await import(BASE + 'vision_bundle.mjs');
	const files = await vision.FilesetResolver.forVisionTasks(BASE + 'wasm');
	const options = delegate => ({
		baseOptions: { modelAssetPath: BASE + 'models/selfie_segmenter.tflite', delegate },
		canvas: delegate === 'GPU' ? new OffscreenCanvas(1, 1) : undefined,
		runningMode: 'VIDEO',
		outputCategoryMask: false,
		outputConfidenceMasks: true,
	});
	try {
		segmenter = await vision.ImageSegmenter.createFromOptions(files, options('GPU'));
	} catch {
		segmenter = await vision.ImageSegmenter.createFromOptions(files, options('CPU'));
	}
}

function mask(frame, time) {
	return new Promise((resolve, reject) => {
		segmenter.segmentForVideo(frame, time, result => {
			try {
				// The selfie model has one mask: the chance that a pixel is the person.
				const p = result.confidenceMasks[0].getAsFloat32Array();
				if (!prev || prev.length !== p.length) prev = Float32Array.from(p);
				const img = new ImageData(frame.width, frame.height);
				for (let i = 0; i < p.length; i++) {
					const m = (prev[i] += (p[i] - prev[i]) * FRESH);
					img.data[4 * i + 3] = 255 - Math.round(m * 255);
				}
				result.close();
				resolve(createImageBitmap(img));
			} catch (e) {
				reject(e);
			}
		});
	});
}

onmessage = async e => {
	try {
		if (!e.data.frame) {
			await load();
			postMessage({ id: e.data.id });
			return;
		}
		const m = await mask(e.data.frame, e.data.time);
		postMessage({ id: e.data.id, mask: m }, [m]);
	} catch (err) {
		postMessage({ id: e.data.id, error: String(err) });
	} finally {
		e.data.frame?.close();
	}
};
