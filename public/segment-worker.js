'use strict';

const BASE = '/third-party/tasks-vision/';

let segmenter;

async function load() {
	const vision = await import(BASE + 'vision_bundle.mjs');
	const files = await vision.FilesetResolver.forVisionTasks(BASE + 'wasm');
	const options = delegate => ({
		baseOptions: { modelAssetPath: BASE + 'models/selfie_segmenter.tflite', delegate },
		canvas: delegate === 'GPU' ? new OffscreenCanvas(1, 1) : undefined,
		runningMode: 'VIDEO',
		outputCategoryMask: true,
		outputConfidenceMasks: false,
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
				const m = result.categoryMask.getAsUint8Array();
				const img = new ImageData(frame.width, frame.height);
				for (let i = 0; i < m.length; i++) img.data[4 * i + 3] = m[i];
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
			postMessage({ ready: true });
			return;
		}
		const m = await mask(e.data.frame, e.data.time);
		postMessage({ mask: m }, [m]);
	} catch (err) {
		postMessage({ error: String(err) });
	} finally {
		e.data.frame?.close();
	}
};
