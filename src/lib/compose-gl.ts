import type { Effect } from './background';

const VS = `#version 300 es
in vec2 pos;
out vec2 uv;
void main() {
	uv = vec2(pos.x * .5 + .5, .5 - pos.y * .5);
	gl_Position = vec4(pos, 0., 1.);
}`;

// The mask is opaque on the background. Its edge is refined against the camera frame
// (joint bilateral filter), and the blur averages background pixels only, so the person
// does not bleed into it.
const FS = `#version 300 es
precision mediump float;
in vec2 uv;
out vec4 color;
uniform sampler2D frame;
uniform sampler2D mask;
uniform sampler2D image;
uniform vec2 texel;
uniform int mode;
uniform vec4 cover;
uniform float lod;

float bg(vec2 p) { return texture(mask, p).a; }

void main() {
	vec3 c0 = textureLod(frame, uv, 1.).rgb;
	float sum = 0., wsum = 0.;
	for (int y = -2; y <= 2; y++)
	for (int x = -2; x <= 2; x++) {
		vec2 p = uv + vec2(x, y) * texel;
		vec3 d = textureLod(frame, p, 1.).rgb - c0;
		float w = exp(-dot(d, d) * 40. - float(x * x + y * y) * .2);
		sum += bg(p) * w;
		wsum += w;
	}
	float a = smoothstep(.3, .7, sum / wsum);
	vec3 back;
	if (mode == 0) {
		vec3 acc = vec3(0.);
		float n = 0.;
		for (int y = -1; y <= 1; y++)
		for (int x = -1; x <= 1; x++) {
			vec2 p = uv + vec2(x, y) * texel * 3.;
			float w = bg(p) + .02;
			acc += textureLod(frame, p, lod).rgb * w;
			n += w;
		}
		back = acc / n;
	} else {
		back = texture(image, uv * cover.xy + cover.zw).rgb;
	}
	color = vec4(mix(texture(frame, uv).rgb, back, a), 1.);
}`;

export type Renderer = {
	draw: (video: HTMLVideoElement, mask: ImageBitmap) => void;
	// Milliseconds per frame, waiting for the GPU to finish.
	bench: (video: HTMLVideoElement, mask: ImageBitmap) => number;
	dispose: () => void;
};

export function glRenderer(canvas: HTMLCanvasElement, effect: Effect): Renderer | null {
	const ctx = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false });
	if (!ctx) return null;
	const gl: WebGL2RenderingContext = ctx;
	const info = gl.getExtension('WEBGL_debug_renderer_info');
	const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
	if (/swiftshader|llvmpipe|softpipe|software/i.test(name)) return null;

	let prog: WebGLProgram;
	let ready = false;
	let size = '';
	const u = (n: string) => gl.getUniformLocation(prog, n);

	const shader = (type: number, src: string) => {
		const sh = gl.createShader(type)!;
		gl.shaderSource(sh, src);
		gl.compileShader(sh);
		return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
	};

	const texture = (unit: number, n: string, mip: boolean) => {
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.uniform1i(u(n), unit);
	};

	// Also runs after a lost context comes back: every GL object is gone by then.
	function setup(): boolean {
		const vs = shader(gl.VERTEX_SHADER, VS);
		const fs = shader(gl.FRAGMENT_SHADER, FS);
		if (!vs || !fs) return false;
		prog = gl.createProgram()!;
		gl.attachShader(prog, vs);
		gl.attachShader(prog, fs);
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
		gl.useProgram(prog);

		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const pos = gl.getAttribLocation(prog, 'pos');
		gl.enableVertexAttribArray(pos);
		gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

		texture(0, 'frame', true);
		texture(1, 'mask', false);
		texture(2, 'image', false);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		gl.uniform1i(u('mode'), effect.kind === 'blur' ? 0 : 1);
		if (effect.kind === 'image') {
			gl.activeTexture(gl.TEXTURE2);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, effect.image);
		}
		size = '';
		return gl.getError() === gl.NO_ERROR;
	}

	if (!setup()) return null;
	ready = true;
	const lost = (e: Event) => {
		e.preventDefault();
		ready = false;
	};
	const restored = () => {
		ready = setup();
	};
	canvas.addEventListener('webglcontextlost', lost);
	canvas.addEventListener('webglcontextrestored', restored);

	const self: Renderer = {
		bench(video, mask) {
			const px = new Uint8Array(4);
			const t0 = performance.now();
			for (let i = 0; i < 3; i++) {
				self.draw(video, mask);
				gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
			}
			return (performance.now() - t0) / 3;
		},
		draw(video, mask) {
			const w = video.videoWidth;
			const h = video.videoHeight;
			if (!ready || !w || !h) return;
			if (size !== `${w}x${h}`) {
				size = `${w}x${h}`;
				canvas.width = w;
				canvas.height = h;
				gl.viewport(0, 0, w, h);
				gl.uniform1f(u('lod'), Math.max(1, Math.log2(w / 40)));
				if (effect.kind === 'image') {
					const { width: iw, height: ih } = effect.image;
					const sc = Math.max(w / iw, h / ih);
					const sx = w / (iw * sc);
					const sy = h / (ih * sc);
					gl.uniform4f(u('cover'), sx, sy, (1 - sx) / 2, (1 - sy) / 2);
				}
			}
			gl.activeTexture(gl.TEXTURE0);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
			gl.generateMipmap(gl.TEXTURE_2D);
			gl.activeTexture(gl.TEXTURE1);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
			gl.uniform2f(u('texel'), 1 / mask.width, 1 / mask.height);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		},
		dispose() {
			canvas.removeEventListener('webglcontextlost', lost);
			canvas.removeEventListener('webglcontextrestored', restored);
			gl.getExtension('WEBGL_lose_context')?.loseContext();
		},
	};
	return self;
}
