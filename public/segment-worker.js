'use strict';

const BASE = '/third-party/tasks-vision/';

let segmenter;

async function load() {
	const vision = await import(/* @vite-ignore */ BASE + 'vision_bundle.mjs');
	const files = await vision.FilesetResolver.forVisionTasks(BASE + 'wasm');
	segmenter = await vision.ImageSegmenter.createFromOptions(files, {
		baseOptions: { modelAssetPath: BASE + 'models/selfie_segmenter.tflite' },
		runningMode: 'VIDEO',
		outputCategoryMask: true,
		outputConfidenceMasks: false,
	});
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
		postMessage({ mask: m }, { transfer: [m] });
	} catch (err) {
		postMessage({ error: String(err) });
	} finally {
		e.data.frame?.close();
	}
};
