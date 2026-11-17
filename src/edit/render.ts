import { makeCanvas } from '../core/canvas';
import type { Edit } from '../core/types';
import type { Lut } from './cube';

const VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_img;
uniform sampler3D u_lut;
uniform float u_bright, u_contrast, u_strength, u_size;
uniform bool u_hasLut;
uniform vec3 u_dmin, u_dmax;

vec3 sCurve(vec3 x) { return x * x * (3.0 - 2.0 * x); }
vec3 invSCurve(vec3 x) { return 0.5 - sin(asin(1.0 - 2.0 * x) / 3.0); }

void main() {
  vec3 c = texture(u_img, v_uv).rgb;
  c = clamp(c * exp2(u_bright * 1.5), 0.0, 1.0);
  if (u_contrast >= 0.0) c = mix(c, sCurve(c), u_contrast);
  else c = mix(c, invSCurve(c), -u_contrast);
  if (u_hasLut) {
    vec3 uvw = clamp((c - u_dmin) / (u_dmax - u_dmin), 0.0, 1.0);
    vec3 coord = uvw * ((u_size - 1.0) / u_size) + 0.5 / u_size;
    c = mix(c, texture(u_lut, coord).rgb, u_strength);
  }
  outColor = vec4(c, 1.0);
}`;

interface Ctx {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  img: WebGLTexture;
  lutTex: WebGLTexture;
  lutLoaded: Lut | null;
  u: Record<string, WebGLUniformLocation | null>;
}

let ctx: Ctx | null = null;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error');
  return s;
}

function setup(): Ctx {
  const canvas = makeCanvas(1, 1);
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
  if (!gl) throw new Error('This device can’t do photo edits (no WebGL2).');
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link error');
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = (target: number) => {
    const t = gl.createTexture()!;
    gl.bindTexture(target, t);
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (target === gl.TEXTURE_3D) gl.texParameteri(target, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    return t;
  };
  gl.activeTexture(gl.TEXTURE1);
  const lutTex = tex(gl.TEXTURE_3D);
  gl.activeTexture(gl.TEXTURE0);
  const img = tex(gl.TEXTURE_2D);

  const u: Ctx['u'] = {};
  for (const n of ['u_img', 'u_lut', 'u_bright', 'u_contrast', 'u_strength', 'u_size', 'u_hasLut', 'u_dmin', 'u_dmax'])
    u[n] = gl.getUniformLocation(prog, n);
  gl.uniform1i(u.u_img, 0);
  gl.uniform1i(u.u_lut, 1);
  return { canvas, gl, prog, img, lutTex, lutLoaded: null, u };
}

/**
 * Render src with the edit at outW×outH. Returns a shared canvas, valid until the next render() call —
 * draw or export it straight away. Preview and export both use this, so they match.
 */
export function render(src: ImageBitmap | HTMLCanvasElement, edit: Edit, lut: Lut | null, outW: number, outH: number): HTMLCanvasElement {
  // iOS drops GPU contexts of backgrounded apps (e.g. while you're in Slack). Start a fresh one.
  if (ctx?.gl.isContextLost()) ctx = null;
  ctx ??= setup();
  if (ctx.gl.isContextLost()) throw new Error('Photo edits are not available right now. Try again.');
  const { gl, canvas, u } = ctx;

  // Scale on the 2D canvas first: keeps the GPU texture small (memory on phones) and within MAX_TEXTURE_SIZE.
  let input: ImageBitmap | HTMLCanvasElement = src;
  let scaled: HTMLCanvasElement | null = null;
  if (src.width !== outW || src.height !== outH) {
    scaled = makeCanvas(outW, outH);
    const c2 = scaled.getContext('2d')!;
    c2.imageSmoothingQuality = 'high';
    c2.drawImage(src, 0, 0, outW, outH);
    input = scaled;
  }

  canvas.width = outW;
  canvas.height = outH;
  gl.viewport(0, 0, outW, outH);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, ctx.img);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, input);
  if (scaled) { scaled.width = 0; scaled.height = 0; } // free it now (iOS canvas memory cap)

  const useLut = !!lut && edit.lutStrength > 0;
  if (useLut && ctx.lutLoaded !== lut) {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, ctx.lutTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB16F, lut!.size, lut!.size, lut!.size, 0, gl.RGB, gl.FLOAT, lut!.data);
    gl.activeTexture(gl.TEXTURE0);
    ctx.lutLoaded = lut;
  }

  gl.uniform1f(u.u_bright, edit.brightness);
  gl.uniform1f(u.u_contrast, edit.contrast);
  gl.uniform1f(u.u_strength, useLut ? edit.lutStrength : 0);
  gl.uniform1i(u.u_hasLut, useLut ? 1 : 0);
  if (lut) {
    gl.uniform1f(u.u_size, lut.size);
    gl.uniform3fv(u.u_dmin, lut.domainMin);
    gl.uniform3fv(u.u_dmax, lut.domainMax);
  }
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return canvas;
}
