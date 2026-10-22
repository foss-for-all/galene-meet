const media = navigator.mediaDevices;

export const support = {
	webrtc: typeof RTCPeerConnection !== 'undefined' && !!media?.getUserMedia,
	share: !!media?.getDisplayMedia,
	effects:
		typeof OffscreenCanvas !== 'undefined' &&
		'requestVideoFrameCallback' in HTMLVideoElement.prototype &&
		'captureStream' in HTMLCanvasElement.prototype,
};
