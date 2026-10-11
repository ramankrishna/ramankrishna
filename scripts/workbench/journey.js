// The journey: six workbenches, walked in order. At each one the builder
// sets down a seed cube and the thing he made unfolds from it and runs.
// Every frame is a pure function of time, so the film renders frame by
// frame and each bench keeps looping once it is built.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const q = new URLSearchParams(location.search);
const THEME = q.get('theme') === 'dark' ? 'dark' : 'light';
const C = THEME === 'dark'
  ? { bg: '#0d1117', fg: '#f0f6fc', muted: '#9198a1', rule: '#3d444d', slab: '#1c232d', cube: '#34404e',
      track: '#3a4654', accent: '#2ddbc0', ask: '#f2b84b', bad: '#ff7b72', skin: '#e6cfb6', cap: '#5d6b7c',
      eye: '#0d1117', paper: '#c9d3df', shadow: 0.5, hemiSky: '#aebbd0', hemiGround: '#0d1117', hemi: 0.75, sun: 2.3 }
  : { bg: '#ffffff', fg: '#1f2328', muted: '#59636e', rule: '#d1d9e0', slab: '#e9edf1', cube: '#ffffff',
      track: '#c3ccd5', accent: '#0b8a76', ask: '#e8a020', bad: '#cf222e', skin: '#e9d3bb', cap: '#1f2328',
      eye: '#1f2328', paper: '#ffffff', shadow: 0.16, hemiSky: '#ffffff', hemiGround: '#c9d2db', hemi: 1.15, sun: 2.1 };

export const DURATION = 66;
const END = 65.2;                        // everything pops away from here so the loop restarts clean
const U = 0.55, GAP = 0.03, STEP = U + GAP;
const PX = 17, RZ = 8.5;               // spacing between benches

// ---------------------------------------------------------------- helpers
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const outCubic = p => 1 - Math.pow(1 - p, 3);
const inOut = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const outBack = p => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const inBack = p => { const c = 1.9; return (c + 1) * p * p * p - c * p * p; };
const bump = (t, at, len) => { const p = seg(t, at, at + len); return p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p); };
const mix = (a, b, p) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(p));
const REST = mix(C.cube, C.accent, 0.22).getStyle();
const loop = (u, from, period) => u < from ? -1 : (u - from) % period;   // local time inside a repeating demo

// ---------------------------------------------------------------- stage
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(C.bg);
document.body.appendChild(renderer.domElement);
document.body.style.background = C.bg;

const scene = new THREE.Scene();
const aspect = innerWidth / innerHeight;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
scene.add(new THREE.HemisphereLight(C.hemiSky, C.hemiGround, C.hemi));
const sun = new THREE.DirectionalLight('#ffffff', C.sun);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: C.shadow }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.5; floor.receiveShadow = true; scene.add(floor);

const mat = color => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 });
const mesh = (geo, material, cast = true) => { const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = true; return m; };
const cubeGeo = new RoundedBoxGeometry(U, U, U, 3, 0.05);
const slabGeo = new RoundedBoxGeometry(12.4, 0.5, 7.4, 4, 0.12);
const ballGeo = new THREE.SphereGeometry(0.17, 24, 18);
const chipGeo = new RoundedBoxGeometry(0.3, 0.1, 0.3, 2, 0.03);
const eyeGeo = new THREE.SphereGeometry(0.03, 10, 8), eyeMat = new THREE.MeshBasicMaterial({ color: C.eye });

await document.fonts.load('500 96px Bricolage'); await document.fonts.load('700 96px Bricolage');

// ---------------------------------------------------------------- benches
// Each bench owns a list of items that drop in at their own time; custom motion is layered on after.
function Bench(col, row, start) {
  const g = new THREE.Group(); g.position.set(col * PX, 0, row * RZ); scene.add(g);
  const slab = mesh(slabGeo, mat(C.slab)); slab.position.y = -0.25; g.add(slab);
  return { g, ox: col * PX, oz: row * RZ, start, items: [], at: (x, z) => [col * PX + x, row * RZ + z] };
}
function item(b, m, pos, at, scale = [1, 1, 1], drop = 1.1) {
  b.g.add(m); const it = { m, pos, at, scale, drop, kind: 'solid' }; b.items.push(it); return it;
}
const cube = (b, pos, at, color = REST, sy = 1) => item(b, mesh(cubeGeo, mat(color)), pos, at, [1, sy, 1]);
const box = (b, size, pos, at, color = C.track, r = 0.04) => item(b, mesh(new RoundedBoxGeometry(...size, 3, r), mat(color)), pos, at);
function stack(b, center, nx, nz, count, at, each, partialTop = 1) {
  return Array.from({ length: count }, (_, i) => {
    const layer = Math.floor(i / (nx * nz)), r = i % (nx * nz), ix = r % nx, iz = Math.floor(r / nx);
    const h = i === count - 1 ? partialTop : 1;
    const it = cube(b, [center[0] + (ix - (nx - 1) / 2) * STEP, layer * STEP + U * h / 2, center[1] + (iz - (nz - 1) / 2) * STEP], at + i * each, C.cube, h);
    it.layer = layer; return it;
  });
}
function track(b, a, c, at) {
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const m = mesh(new THREE.BoxGeometry(1, 0.03, 0.13), trackMat, false);
  m.rotation.y = -Math.atan2(c[1] - a[1], c[0] - a[0]);
  b.g.add(m); const it = { m, a, c, len, at, kind: 'track' }; b.items.push(it); return it;
}
const trackMat = mat(C.track);
const path = (b, pts, at, each = 0.07) => pts.slice(1).map((p, i) => track(b, pts[i], p, at + i * each));
function sprite(lines) {
  // lines: [[text, color, weight, px], ...] stacked, centred
  const cv = document.createElement('canvas'), g = cv.getContext('2d');
  const widths = lines.map(([text, , weight, px]) => { g.font = `${weight} ${px}px Bricolage`; return g.measureText(text).width; });
  cv.width = Math.ceil(Math.max(...widths)) + 24; cv.height = lines.reduce((h, l) => h + l[3] * 1.25, 0) + 16;
  let y = 8;
  lines.forEach(([text, color, weight, px], i) => {
    g.font = `${weight} ${px}px Bricolage`; g.fillStyle = color; g.textBaseline = 'middle';
    g.fillText(text, (cv.width - widths[i]) / 2, y + px * 0.62); y += px * 1.25;
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.renderOrder = 10; s.userData.size = [cv.width / 300, cv.height / 300]; return s;
}
function label(b, text, pos, at, { color = C.fg, weight = 500, px = 74 } = {}) {
  const s = sprite([[text, color, weight, px]]); b.g.add(s);
  const it = { m: s, pos, at, kind: 'label' }; b.items.push(it); return it;
}
function metric(b, big, small, pos, at) {
  const s = sprite([[big, C.accent, 700, 150], [small, C.muted, 500, 62]]); b.g.add(s);
  const it = { m: s, pos, at, kind: 'label' }; b.items.push(it); return it;
}
function bot(b, pos, at, size = 0.62) {
  const g = new THREE.Group(); const body = mesh(new RoundedBoxGeometry(size, size, size, 3, 0.07), mat(REST));
  const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(s * size * 0.2, size * 0.08, size / 2 + 0.005); return e; });
  g.add(body, ...eyes); const it = item(b, g, [pos[0], size / 2, pos[1]], at); it.body = body; it.size = size; return it;
}
const ball = (b, color = C.ask) => { const m = mesh(ballGeo, mat(color)); m.visible = false; b.g.add(m); return m; };
const chip = (b, color = C.ask) => { const m = mesh(chipGeo, mat(color)); m.visible = false; b.g.add(m); return m; };
function place(s, pos, k) { s.position.set(...pos); s.scale.set(s.userData.size[0] * k, s.userData.size[1] * k, 1); s.visible = k > 0.01; }

function settle(b, u, G) {
  for (const it of b.items) {
    if (it.kind === 'track') {
      const g = outCubic(seg(u, it.at, it.at + 0.45)) * G, dx = (it.c[0] - it.a[0]) / it.len, dz = (it.c[1] - it.a[1]) / it.len;
      it.m.visible = g > 0.01; it.m.scale.set(it.len * g, 1, 1);
      it.m.position.set(it.a[0] + dx * it.len * g / 2, 0.015, it.a[1] + dz * it.len * g / 2);
    } else if (it.kind === 'label') {
      place(it.m, it.pos, outBack(seg(u, it.at, it.at + 0.25)) * G);
    } else {
      const p = seg(u, it.at, it.at + 0.3), s = outBack(p) * G;
      it.m.visible = s > 0.01; it.m.scale.set(it.scale[0] * s, it.scale[1] * s, it.scale[2] * s);
      it.m.position.set(it.pos[0], it.pos[1] + (1 - outCubic(p)) * it.drop, it.pos[2]);
    }
  }
}
// Squash an item downward from its base and tint it.
function pulse(it, k, color = C.accent, depth = 0.14, base = REST) {
  const m = it.body || it.m;
  it.m.scale.y *= 1 - depth * k; it.m.position.y -= it.pos[1] * depth * k;
  m.material.color.copy(mix(base, color, k * 0.95));
}
// Position along timed waypoints [t, x, z, visible].
function along(pts, t) {
  if (t < pts[0][0]) return null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ta, xa, za, va] = pts[i], [tb, xb, zb] = pts[i + 1];
    if (t <= tb) { const p = seg(t, ta, tb); return { x: lerp(xa, xb, p), z: lerp(za, zb, p), visible: va === 1 }; }
  }
  return null;
}
function roll(m, pts, t, G, y = 0.17) {
  const p = t < 0 ? null : along(pts, t);
  m.visible = !!p && p.visible && G > 0.05;
  if (p) { m.position.set(p.x, y, p.z); m.scale.setScalar(G); }
  return p;
}

// ================================================================ 1. Day job
const A = Bench(-1, -1, 0);
path(A, [[-5.9, 0.5], [5.9, 0.5]], 1.7);
const svc = x => [0, 1, 2, 3].map(i => cube(A, [x, (i >> 1) * STEP + U / 2, 0.5 + (i % 2 ? 1 : -1) * STEP / 2], 0));
const svc1 = svc(-1.6), svc2 = svc(2.2);
svc1.forEach((it, i) => it.at = 1.65 + i * 0.06); svc2.forEach((it, i) => it.at = 2.0 + i * 0.06);
const events = Array.from({ length: 14 }, () => { const m = mesh(new RoundedBoxGeometry(0.2, 0.2, 0.2, 2, 0.03), mat(C.ask)); A.g.add(m); return m; });
label(A, 'Java services', [0.3, 1.75, 0.5], 2.4);
metric(A, '1M+', 'events a day', [4.6, 1.5, 0.5], 3.6);
A.update = (u, G) => {
  settle(A, u, G);
  events.forEach((m, i) => {
    const r = 2.5 + i * 0.33, d = u < r ? -1 : ((u - r) * 2.6) % 11.8, x = -5.9 + d;
    const inside = Math.abs(x + 1.6) < 0.36 || Math.abs(x - 2.2) < 0.36;
    m.visible = d >= 0 && !inside && G > 0.05;
    m.position.set(x, 0.13, 0.5); m.scale.setScalar(G);
    m.material.color.copy(mix(C.ask, C.accent, x < -1.6 ? 0 : x < 2.2 ? 0.5 : 1));
  });
  if (u > 2.5) [svc1, svc2].forEach((s, k) => s.forEach(it => pulse(it, 0.35 + 0.35 * Math.sin(u * 7.6 + k * 2), C.accent, 0.03)));
};

// ================================================================ 2. Models
const TB = 6.2;
const B = Bench(0, -1, TB);
const ZH = -1.7, ZE = 1.95;
const P = { enter: [-5.8, 0], fast: [-3.6, 0], fork: [-2.3, 0], easyA: [-2.3, ZE], easyB: [4.7, ZE],
  hardA: [-2.3, ZH], fin: [0.3, ZH], prm: [2.9, ZH], hardB: [4.7, ZH], tray: [4.7, 0] };
const finHalf = (4 * U + 3 * GAP) / 2, prmHalf = (2 * U + GAP) / 2, fastHalf = U / 2;
const plain = s => { s.forEach(it => it.m.material.color.set(C.cube)); return s; };
const fast = plain(stack(B, P.fast, 1, 1, 2, 1.75, 0.2, 0.7));     // one cube is a billion parameters
const fin = plain(stack(B, P.fin, 4, 2, 32, 3.62, 0.04));
const prm = plain(stack(B, P.prm, 2, 2, 7, 5.92, 0.085));
[[P.enter, [P.fast[0] - fastHalf, 0]], [[P.fast[0] + fastHalf, 0], P.fork],
 [P.fork, P.easyA], [P.easyA, P.easyB], [P.easyB, [P.tray[0], 0.62]],
 [P.fork, P.hardA], [P.hardA, [P.fin[0] - finHalf, ZH]], [[P.fin[0] + finHalf, ZH], [P.prm[0] - prmHalf, ZH]],
 [[P.prm[0] + prmHalf, ZH], P.hardB], [P.hardB, [P.tray[0], -0.62]]].forEach(([a, c], i) => track(B, a, c, 6.7 + i * 0.07));
box(B, [1.25, 0.1, 1.25], [P.tray[0], 0.05, 0], 7.2).drop = 0;
label(B, 'NPC Fast 1.7B', [P.fast[0], 1.42, 0], 2.0);
label(B, 'NPC Fin 32B', [P.fin[0], 2.82, ZH], 4.85);
label(B, 'Fin-PRM 7B', [P.prm[0], 1.72, ZH], 6.45);
label(B, 'Answer', [P.tray[0], 0.72, 0], 7.35);
metric(B, '98.3%', 'routed right, out of distribution', [-4.3, 0.6, 2.75], 10.95);
metric(B, '93.6%', 'CryptoQA', [P.fin[0], 3.75, ZH], 12.75);
metric(B, '0.92', 'Spearman', [P.prm[0] + 0.9, 2.6, ZH], 13.6);
const tagEasy = sprite([['easy', C.accent, 700, 90]]), tagHard = sprite([['hard', C.accent, 700, 90]]); B.g.add(tagEasy, tagHard);
const EASY = { land: 10.72, pts: [[7.65, P.enter[0], 0, 1], [8.3, P.fast[0] - fastHalf, 0, 1], [8.31, P.fast[0], 0, 0],
  [8.74, P.fast[0], 0, 0], [8.75, P.fast[0] + fastHalf, 0, 1], [8.98, ...P.fork, 1], [9.32, ...P.easyA, 1],
  [10.28, ...P.easyB, 1], [10.6, P.tray[0], 0.62, 1], [10.72, P.tray[0] - 0.2, 0.22, 1], [15.05, P.tray[0] - 0.2, 0.22, 1]] };
const HARD = { land: 14.62, pts: [[10.5, P.enter[0], 0, 1], [11.15, P.fast[0] - fastHalf, 0, 1], [11.16, P.fast[0], 0, 0],
  [11.59, P.fast[0], 0, 0], [11.6, P.fast[0] + fastHalf, 0, 1], [11.83, ...P.fork, 1], [12.15, ...P.hardA, 1],
  [12.48, P.fin[0] - finHalf, ZH, 1], [12.49, P.fin[0], ZH, 0], [13.84, P.prm[0], ZH, 0], [13.85, P.prm[0] + prmHalf, ZH, 1],
  [14.12, ...P.hardB, 1], [14.5, P.tray[0], -0.62, 1], [14.62, P.tray[0] + 0.2, -0.22, 1], [15.05, P.tray[0] + 0.2, -0.22, 1]] };
const reqB = [EASY, HARD].map(r => { const m = ball(B); m.userData = r; return m; });
const stepsB = [12.92, 13.17, 13.42].map(at => { const m = chip(B); m.userData.at = at; return m; });
B.update = (v, G) => {
  settle(B, v, G);
  const w = v < 15.05 ? v : 7.65 + (v - 7.65) % 7.4;      // the two requests repeat once the bench is built
  const think = Math.max(bump(w, 8.3, 0.45), bump(w, 11.15, 0.45));
  let stamp = 0; for (const s of stepsB) stamp = Math.max(stamp, bump(w, s.userData.at + 0.24, 0.26));
  const trained = (it, done) => Math.max(0.2 * seg(v, done, done + 0.3), 0.8 * bump(v, done - 0.1 + it.layer * 0.06, 0.4));
  fast.forEach(it => { it.m.material.color.copy(mix(C.cube, C.accent, trained(it, 2.2))); if (think) pulse(it, think, C.accent, 0.16, C.cube); });
  fin.forEach(it => {
    const k = w > 12.48 && w < 13.9 ? Math.max(bump(w, 12.48 + it.layer * 0.1, 0.45), bump(w, 12.98 + it.layer * 0.1, 0.45)) : 0;
    it.m.material.color.copy(mix(C.cube, C.accent, Math.max(trained(it, 5.0), k * 0.95)));
  });
  prm.forEach(it => { it.m.material.color.copy(mix(C.cube, C.accent, trained(it, 6.6))); if (stamp) pulse(it, stamp, C.accent, 0.14, C.cube); });
  for (const m of reqB) {
    const r = m.userData, p = roll(m, r.pts, w, G);
    if (!p) continue;
    const bounce = w > r.land ? Math.abs(Math.sin((w - r.land) * 14)) * 0.22 * Math.exp(-(w - r.land) * 6) : 0;
    m.position.y = 0.17 + lerp(0.03, 0.1, seg(w, r.land - 0.12, r.land)) + bounce;
    m.material.color.copy(mix(C.ask, C.accent, seg(w, r.land - 0.05, r.land + 0.25)));
  }
  for (const s of stepsB) {
    const p = seg(w, s.userData.at, s.userData.at + 0.32);
    s.visible = p > 0 && p < 1 && G > 0.05;
    s.position.set(lerp(P.fin[0] + finHalf + 0.05, P.prm[0] - prmHalf - 0.05, inOut(p)), 0.09 + Math.sin(Math.PI * p) * 0.18, ZH);
    s.material.color.copy(mix(C.ask, C.accent, seg(p, 0.75, 1)));
  }
  place(tagEasy, [P.fast[0], 1.86, 0], outBack(seg(w, 8.42, 8.67)) * (1 - seg(w, 10.72, 11.0)) * G);
  place(tagHard, [P.fast[0], 1.86, 0], outBack(seg(w, 11.27, 11.52)) * (1 - seg(w, 14.62, 14.9)) * G);
};

// ================================================================ 3. Serving: npc-mom-router and polyrt
const TC = 22.8;
const Cb = Bench(1, -1, TC);
const crate = box(Cb, [0.95, 0.8, 0.95], [-3.6, 0.4, 0], 0.5, REST, 0.08);
const small = stack(Cb, [-0.9, -1.7], 1, 1, 1, 0.9, 0);
const big = stack(Cb, [-0.9, 1.7], 2, 2, 8, 1.0, 0.04);
path(Cb, [[-5.9, 0], [-4.1, 0]], 1.2); path(Cb, [[-3.1, 0], [-2.3, 0]], 1.25);
path(Cb, [[-2.3, 0], [-2.3, -1.7], [-1.2, -1.7]], 1.3); path(Cb, [[-2.3, 0], [-2.3, 1.7], [-1.5, 1.7]], 1.3);
label(Cb, 'npc-mom-router', [-3.6, 1.5, 0], 1.0);
label(Cb, 'small model', [-0.9, 1.2, -1.7], 1.5, { color: C.muted, px: 58 });
label(Cb, 'specialist', [-0.9, 0.3, 2.8], 1.6, { color: C.muted, px: 58 });
const momReq = [0, 1].map(() => ball(Cb));
const MOM = [
  [[0, -5.9, 0, 1], [0.55, -4.1, 0, 1], [0.56, -3.6, 0, 0], [0.85, -3.6, 0, 0], [0.86, -3.1, 0, 1], [1.05, -2.3, 0, 1], [1.35, -2.3, -1.7, 1], [1.6, -1.2, -1.7, 1]],
  [[1.3, -5.9, 0, 1], [1.85, -4.1, 0, 1], [1.86, -3.6, 0, 0], [2.15, -3.6, 0, 0], [2.16, -3.1, 0, 1], [2.35, -2.3, 0, 1], [2.65, -2.3, 1.7, 1], [2.85, -1.5, 1.7, 1]],
];
const adapter = box(Cb, [1.5, 0.5, 0.9], [1.3, 0.25, 0], 5.9, REST, 0.08);
const backs = [stack(Cb, [4.5, -2.2], 1, 1, 3, 6.05, 0.05), stack(Cb, [4.5, 0], 2, 1, 3, 6.2, 0.05), stack(Cb, [4.5, 2.2], 1, 1, 1, 6.35, 0)];
path(Cb, [[2.05, 0], [3.1, 0]], 6.4);
path(Cb, [[3.1, 0], [3.1, -2.2], [4.2, -2.2]], 6.45); path(Cb, [[3.1, 0], [3.9, 0]], 6.45); path(Cb, [[3.1, 0], [3.1, 2.2], [4.2, 2.2]], 6.45);
label(Cb, 'polyrt', [1.3, 1.15, 0], 6.1);
label(Cb, 'Claude', [4.5, 2.4, -2.2], 6.5, { color: C.muted, px: 58 });
label(Cb, 'GPT', [4.5, 1.85, 0], 6.6, { color: C.muted, px: 58 });
label(Cb, 'local MLX', [4.5, 0.3, 3.05], 6.7, { color: C.muted, px: 58 });
const polyReq = [0, 1, 2].map(() => ball(Cb));
const polyOut = [0, 1, 2].map(i => { const m = mesh(new RoundedBoxGeometry(0.34, 0.34, 0.34, 2, 0.04), mat(C.accent)); m.visible = false; Cb.g.add(m); return m; });
const POLY = [-2.2, 0, 2.2].map((z, i) => z === 0
  ? [[i * 0.7, 2.05, 0, 1], [i * 0.7 + 0.55, 3.9, 0, 1]]
  : [[i * 0.7, 2.05, 0, 1], [i * 0.7 + 0.2, 3.1, 0, 1], [i * 0.7 + 0.45, 3.1, z, 1], [i * 0.7 + 0.65, 4.2, z, 1]]);
Cb.update = (u, G) => {
  settle(Cb, u, G);
  const w = loop(u, 1.9, 3.3);
  momReq.forEach((m, i) => roll(m, MOM[i], w, G));
  pulse(crate, Math.max(bump(w, 0.56, 0.3), bump(w, 1.86, 0.3)), C.accent, 0.1);
  small.forEach(it => pulse(it, bump(w, 1.6, 0.5), C.accent, 0.12));
  big.forEach(it => pulse(it, bump(w, 2.85 - 0.0, 0.45), C.accent, 0.05));
  const x = loop(u, 6.9, 3.4);
  polyReq.forEach((m, i) => roll(m, POLY[i], x, G));
  pulse(adapter, Math.max(...[0, 1, 2].map(i => bump(x, i * 0.7 - 0.05, 0.25))), C.accent, 0.1);
  backs.forEach((s, i) => s.forEach(it => pulse(it, bump(x, i * 0.7 + 0.6, 0.45), C.accent, 0.06)));
  polyOut.forEach((m, i) => {
    const k = x < 0 ? 0 : outBack(seg(x, i * 0.7 + 0.95, i * 0.7 + 1.2)) * (1 - seg(x, 3.15, 3.35)) * G;
    m.visible = k > 0.01; m.scale.setScalar(k); m.position.set(0.75 + i * 0.55, 0.17, 1.25);
  });
};

// ================================================================ 4. Memory: engram and reasoning-bank
const TD = 32.8;
const D = Bench(1, 1, TD);
const NODES = [[1.6, -1.6, 0.7], [2.9, -2.0, 1.2], [4.4, -1.5, 0.8], [5.0, 0.0, 1.3], [3.4, -0.4, 0.9], [2.0, 0.3, 1.4], [3.2, 1.2, 0.7], [4.6, 1.3, 1.0]];
const EDGES = [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [4, 3], [4, 6], [6, 7], [3, 7], [0, 5]];
const nodeGeo = new THREE.SphereGeometry(0.16, 20, 16);
const nodes = NODES.map(([x, z, h], i) => {
  const post = mesh(new THREE.CylinderGeometry(0.025, 0.025, h, 8), trackMat); item(D, post, [x, h / 2, z], 1.3 + i * 0.08).drop = 0;
  return item(D, mesh(nodeGeo, mat(REST)), [x, h, z], 1.35 + i * 0.08);
});
const edges = EDGES.map(([a, c], j) => {
  const pa = new THREE.Vector3(NODES[a][0], NODES[a][2], NODES[a][1]), pc = new THREE.Vector3(NODES[c][0], NODES[c][2], NODES[c][1]);
  const m = mesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 6), mat(C.track), false);
  m.position.copy(pa).add(pc).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pc.clone().sub(pa).normalize());
  D.g.add(m); return { m, len: pa.distanceTo(pc), at: 2.0 + j * 0.06, a, c };
});
label(D, 'engram', [3.3, 2.15, -0.4], 2.3);
const WALKED = [5, 4, 3, 7];                                    // the links a recall follows
const bankTray = box(D, [2.5, 0.08, 1.35], [-3.4, 0.04, -1.0], 5.95); bankTray.drop = 0;
const SLOT = k => [-4.3 + (k % 4) * 0.6, 0.13, -1.3 + Math.floor(k / 4) * 0.6];
const lessons = [0, 1, 2, 3, 4].map(k => { const it = item(D, mesh(chipGeo, mat(C.accent)), SLOT(k), 6.1 + k * 0.06); return it; });
const rbBot = bot(D, [-3.4, 1.15], 6.2);
path(D, [[-5.9, 1.15], [-3.75, 1.15]], 6.3); path(D, [[-3.05, 1.15], [-0.7, 1.15]], 6.35);
label(D, 'reasoning-bank', [-3.4, 1.25, -1.0], 6.4);
metric(D, 'no lift', 'SWE-bench-lite, n=45. Published anyway.', [-3.2, 2.25, -1.0], 8.1);
const rbReq = [0, 1].map(() => ball(D)), filed = chip(D, C.accent), pulled = chip(D, C.accent);
const RB = s => [[s, -5.9, 1.15, 1], [s + 0.6, -3.75, 1.15, 1], [s + 0.61, -3.4, 1.15, 0], [s + 1.0, -3.4, 1.15, 0], [s + 1.01, -3.05, 1.15, 1], [s + 1.6, -0.7, 1.15, 1]];
D.update = (u, G) => {
  settle(D, u, G);
  const w = loop(u, 2.7, 3.0);
  nodes.forEach((it, i) => {
    const k = WALKED.indexOf(i), on = k < 0 || w < 0 ? 0 : Math.max(bump(w, k * 0.38, 0.6), k === 3 ? bump(w, 1.3, 0.9) : 0);
    it.m.material.color.copy(mix(REST, C.accent, on)); if (on) it.m.scale.multiplyScalar(1 + 0.3 * on);
  });
  edges.forEach(e => {
    const g = outCubic(seg(u, e.at, e.at + 0.4)) * G; e.m.visible = g > 0.01; e.m.scale.set(1, e.len * g, 1);
    const ka = WALKED.indexOf(e.a), kc = WALKED.indexOf(e.c), lit = ka >= 0 && kc >= 0 && Math.abs(ka - kc) === 1 && w >= 0 ? bump(w, Math.min(ka, kc) * 0.38 + 0.15, 0.6) : 0;
    e.m.material.color.copy(mix(C.track, C.accent, lit));
  });
  const x = loop(u, 6.9, 4.0);
  rbReq.forEach((m, i) => roll(m, RB(i * 1.9), x, G));
  pulse(rbBot, Math.max(bump(x, 0.61, 0.4), bump(x, 2.51, 0.4)), C.accent, 0.12);
  // First task files a lesson; the second pulls one back out.
  const arc = (m, from, to, p) => { m.visible = p > 0 && p < 1 && G > 0.05; m.position.set(lerp(from[0], to[0], p), lerp(from[1], to[1], p) + Math.sin(Math.PI * p) * 0.9, lerp(from[2], to[2], p)); };
  arc(filed, [-3.4, 0.7, 1.15], SLOT(5), x < 0 ? 0 : inOut(seg(x, 1.0, 1.45)));
  arc(pulled, SLOT(2), [-3.4, 0.7, 1.15], x < 0 ? 0 : inOut(seg(x, 2.0, 2.45)));
  lessons[2].m.visible = lessons[2].m.visible && !(x >= 2.0 && x < 3.8);
  const kept = x >= 1.45 && x < 3.8; filed.visible = filed.visible || (kept && G > 0.05);
  if (kept) filed.position.set(...SLOT(5));
};

// ================================================================ 5. Agents: forge, cogito, bottensor-fleet
const TE = 43.6;
const E = Bench(0, 1, TE);
const forgeBot = bot(E, [3.9, -0.4], 0.5, 0.8);
const cards = [0, 1, 2].map(i => { const m = mesh(new RoundedBoxGeometry(0.5, 0.035, 0.66, 2, 0.015), mat(C.paper)); return item(E, m, [5.25, 0.03 + i * 0.045, 1.0], 0.8 + i * 0.07); });
label(E, 'forge', [3.9, 1.3, -0.4], 0.9);
label(E, 'skills.md', [5.25, 0.55, 1.0], 1.2, { color: C.muted, px: 54 });
const PADS = [[-0.95, -1.3, 'think'], [0.95, -1.3, 'act'], [0, 0.35, 'observe']];
const pads = PADS.map(([x, z, name], i) => {
  const it = item(E, mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 28), mat(REST)), [x, 0.04, z], 3.95 + i * 0.1); it.drop = 0;
  label(E, name, [x, 0.3, z + 0.75], 4.2 + i * 0.1, { color: C.muted, px: 54 }); return it;
});
PADS.forEach((p, i) => { const n = PADS[(i + 1) % 3]; track(E, [p[0], p[1]], [n[0], n[1]], 4.1 + i * 0.07); });
label(E, 'cogito', [0, 1.35, -1.3], 4.3);
const thought = ball(E);
const FLEET = [[-5.0, -1.0], [-3.6, 0.6], [-2.3, -1.2]];
const fleet = FLEET.map((p, i) => bot(E, p, 6.55 + i * 0.12, 0.56));
track(E, FLEET[0], FLEET[1], 6.8); track(E, FLEET[1], FLEET[2], 6.87); track(E, FLEET[0], FLEET[2], 6.94);
label(E, 'bottensor-fleet', [-3.6, 1.45, -0.6], 6.9);
const baton = ball(E);
E.update = (u, G) => {
  settle(E, u, G);
  const w = loop(u, 1.5, 2.6);
  cards.forEach((it, i) => {
    const p = w < 0 ? 0 : inOut(seg(w, i * 0.6, i * 0.6 + 0.45));
    if (p > 0 && p < 1) it.m.position.set(lerp(it.pos[0], 3.9, p), lerp(it.pos[1], 0.85, p) + Math.sin(Math.PI * p) * 0.7, lerp(it.pos[2], -0.4, p));
    if (p >= 1 && w < 2.35) it.m.visible = false;
  });
  pulse(forgeBot, w < 0 ? 0 : Math.max(...[0, 1, 2].map(i => bump(w, i * 0.6 + 0.4, 0.3))), C.accent, 0.12);
  const x = loop(u, 4.6, 2.4);
  if (x >= 0) {
    const k = Math.floor(x / 0.8) % 3, p = inOut(seg(x % 0.8, 0.25, 0.8)), a = PADS[k], n = PADS[(k + 1) % 3];
    thought.visible = G > 0.05; thought.scale.setScalar(G);
    thought.position.set(lerp(a[0], n[0], p), 0.25 + Math.sin(Math.PI * p) * 0.3, lerp(a[1], n[1], p));
    pads.forEach((it, i) => it.m.material.color.copy(mix(REST, C.accent, i === k ? 1 - p : i === (k + 1) % 3 ? p : 0)));
  } else thought.visible = false;
  const y = loop(u, 7.3, 2.4);
  if (y >= 0) {
    const k = Math.min(1, Math.floor(y / 0.9)), p = inOut(seg(y - k * 0.9, 0.3, 0.9)), a = FLEET[k], n = FLEET[k + 1];
    baton.visible = G > 0.05 && y < 2.15; baton.scale.setScalar(G);
    baton.position.set(lerp(a[0], n[0], p), 0.75 + Math.sin(Math.PI * p) * 0.35, lerp(a[1], n[1], p));
    fleet.forEach((it, i) => {
      const hop = bump(y, i * 0.9 - 0.1, 0.4); it.m.position.y += hop * 0.22;
      it.body.material.color.copy(mix(REST, C.accent, bump(y, i * 0.9 - 0.15, 0.7)));
    });
  } else baton.visible = false;
};

// ================================================================ 6. attest-ledger
const TF = 53.9;
const F = Bench(-1, 1, TF);
path(F, [[5.9, 0], [-5.9, 0]], 1.15);
const gate = [[0.6, U / 2, -0.62], [0.6, U / 2 + STEP, -0.62], [0.6, U / 2, 0.62], [0.6, U / 2 + STEP, 0.62],
  [0.6, U / 2 + 2 * STEP, -0.62], [0.6, U / 2 + 2 * STEP, 0], [0.6, U / 2 + 2 * STEP, 0.62]].map((p, i) => cube(F, p, 1.05 + i * 0.06));
label(F, 'attest-ledger', [0.6, 2.25, 0], 1.5);
const VERDICTS = [['backed', C.accent], ['stale', C.ask], ['unbacked', C.bad]];
const claims = VERDICTS.map(([name, color]) => {
  const m = mesh(new RoundedBoxGeometry(0.44, 0.1, 0.44, 2, 0.03), mat(C.paper)); m.visible = false; F.g.add(m);
  const said = sprite([['"tests pass"', C.muted, 500, 54]]), verdict = sprite([[name, color, 700, 84]]); F.g.add(said, verdict);
  return { m, said, verdict, color };
});
// What actually ran: a pass, a pass followed by a change, and nothing at all.
const runs = [0, 1, 2].map(i => box(F, [0.36, 0.36, 0.36], [3.4 - i * 0.6, 0.18, -1.9], 1.6 + i * 0.1, REST, 0.05));
label(F, 'what actually ran', [2.8, 0.85, -1.9], 1.9, { color: C.muted, px: 54 });
F.update = (u, G) => {
  settle(F, u, G);
  const w = loop(u, 2.0, 4.7);
  claims.forEach((c, i) => {
    const t = w - i * 1.35, show = w >= 0 && t > 0 && t < 2.6 && G > 0.05;
    const inP = inOut(seg(t, 0, 0.75)), outP = inOut(seg(t, 1.15, 2.1));
    let x = lerp(5.9, 0.6, inP), z = 0, y = 0.07;
    if (i < 2) x = lerp(x, -5.9, outP); else { x = lerp(x, 1.9, outP); z = lerp(0, 1.5, outP); y += Math.sin(Math.PI * outP) * 0.5; }
    c.m.visible = show;
    c.m.position.set(x, y, z); c.m.scale.setScalar(G);
    c.m.material.color.copy(mix(C.paper, c.color, seg(t, 0.8, 1.05)));
    place(c.said, [x, 0.55, z], show ? seg(t, 0.05, 0.25) * (1 - seg(t, 0.7, 0.85)) * G : 0);
    place(c.verdict, [0.6, 2.85, 0], w >= 0 ? outBack(seg(t, 0.8, 1.05)) * (1 - seg(t, 1.45, 1.6)) * G : 0);
  });
  const judging = w < 0 ? 0 : Math.max(...[0, 1, 2].map(i => bump(w - i * 1.35, 0.75, 0.4)));
  const now = VERDICTS[clamp(Math.floor(Math.max(w, 0) / 1.35), 0, 2)][1];
  gate.forEach(it => pulse(it, judging, now, 0.05));
  runs.forEach((it, i) => {
    const t = w - i * 1.35, k = w < 0 ? 0 : seg(t, 0.3, 0.6) * (1 - seg(t, 2.2, 2.5));
    const color = i === 0 ? C.accent : i === 1 ? mix(C.accent, C.ask, seg(t, 0.75, 0.95)) : REST;
    it.m.material.color.copy(mix(REST, color, i === 2 ? 0 : k));
    if (i === 2) it.m.scale.multiplyScalar(1 - 0.75 * k);          // no run happened, so there is nothing to show
  });
};

const BENCHES = [A, B, Cb, D, E, F];

// ---------------------------------------------------------------- builder
function builder() {
  const g = new THREE.Group(), hoodie = mat(C.accent), skin = mat(C.skin);
  const body = mesh(new THREE.CapsuleGeometry(0.2, 0.2, 6, 16), hoodie); body.position.y = 0.32;
  const head = mesh(new THREE.SphereGeometry(0.2, 24, 18), skin); head.position.y = 0.8;
  const cap = mesh(new THREE.SphereGeometry(0.212, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), mat(C.cap));
  cap.position.y = 0.81; cap.rotation.x = -0.22;
  const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(s * 0.075, 0.8, 0.186); return e; });
  const hands = [-1, 1].map(s => { const h = mesh(new THREE.SphereGeometry(0.07, 12, 10), skin); h.userData.s = s; return h; });
  g.add(body, head, cap, ...eyes, ...hands); g.userData.hands = hands; scene.add(g); return g;
}
const ram = builder(), K = 1.3;
const seedCube = mesh(cubeGeo, mat(C.cube)); scene.add(seedCube);

// Walks: [start, end, from, to, hops] in world coordinates.
const WALK = [
  [0.5, 1.4, A.at(-5.2, 2.5), A.at(-2.0, 2.4), 3],
  [5.2, TB + 0.5, A.at(-2.0, 2.4), B.at(-5.1, 1.1), 7],
  [TB + 0.5, TB + 1.45, B.at(-5.1, 1.1), B.at(-3.6, 1.0), 3],
  [TB + 2.3, TB + 3.35, B.at(-3.6, 1.0), B.at(0.3, -0.25), 5],
  [TB + 5.05, TB + 5.75, B.at(0.3, -0.25), B.at(2.9, -0.3), 3],
  [TB + 6.7, TB + 7.55, B.at(2.9, -0.3), B.at(1.1, 0.85), 3],
  [21.5, TC, B.at(1.1, 0.85), Cb.at(-5.2, 2.5), 6],
  [TC + 4.6, TC + 5.4, Cb.at(-5.2, 2.5), Cb.at(1.4, 2.7), 5],
  [TC + 8.6, TD, Cb.at(1.4, 2.7), D.at(3.4, -2.3), 7],
  [TD + 0.1, TD + 0.9, D.at(3.4, -2.3), D.at(3.4, 2.6), 3],
  [TD + 4.6, TD + 5.5, D.at(3.4, 2.6), D.at(-1.1, 2.9), 4],
  [TD + 9.6, TE, D.at(-1.1, 2.9), E.at(5.0, 2.7), 6],
  [TE + 3.0, TE + 3.6, E.at(5.0, 2.7), E.at(0.2, 2.8), 3],
  [TE + 5.6, TE + 6.2, E.at(0.2, 2.8), E.at(-3.7, 2.8), 3],
  [TE + 9.0, TF, E.at(-3.7, 2.8), F.at(4.6, 2.7), 6],
  [TF + 0.1, TF + 0.7, F.at(4.6, 2.7), F.at(1.9, 2.7), 2],
];
// Seeds: [picked up, set down from, set down by, bench, where on the bench]
const SEEDS = [
  [0.1, 1.4, 1.75, A, [-1.6, 0.3, 0.5]], [5.2, TB + 1.45, TB + 1.85, B, [-3.6, 0.3, 0]],
  [21.5, TC + 0.1, TC + 0.45, Cb, [-3.6, 0.3, 0]], [TC + 4.5, TC + 5.4, TC + 5.75, Cb, [1.3, 0.3, 0]],
  [TC + 8.6, TD + 0.9, TD + 1.25, D, [3.3, 0.3, -0.2]], [TD + 4.5, TD + 5.5, TD + 5.85, D, [-3.4, 0.3, -1.0]],
  [TD + 9.6, TE + 0.1, TE + 0.45, E, [3.9, 0.3, -0.4]], [TE + 2.9, TE + 3.6, TE + 3.95, E, [0, 0.3, -0.5]],
  [TE + 5.5, TE + 6.2, TE + 6.55, E, [-3.6, 0.3, 0]], [TE + 9.0, TF + 0.7, TF + 1.05, F, [0.6, 0.3, 0]],
];
const JUMPS = [...SEEDS.map(s => [s[2], s[2] + 0.38]), [TB + 3.35, TB + 3.75], [TB + 5.75, TB + 6.1], [TB + 14.75, TB + 15.1],
  [TF + 5.6, TF + 5.95], [61.0, 61.35], [61.35, 61.7]];

function walkState(t) {
  let pos = WALK[0][2], yaw = 1.2, y = 0, squash = 1, moving = false;
  for (const [a, b, from, to, hops] of WALK) {
    if (t < a) break;
    const p = inOut(seg(t, a, b));
    pos = [lerp(from[0], to[0], p), lerp(from[1], to[1], p)];
    yaw = Math.atan2(to[0] - from[0], to[1] - from[1]); moving = t < b;
    if (moving) {
      const f = (seg(t, a, b) * hops) % 1;
      y = 4 * f * (1 - f) * 0.2;
      squash = 1 + 0.1 * Math.sin(Math.PI * f) - 0.13 * Math.exp(-Math.pow(Math.min(f, 1 - f) / 0.13, 2));
    }
  }
  for (const [a, b] of JUMPS) {
    if (t <= a || t >= b) continue;
    const p = seg(t, a, b);
    if (p < 0.3) squash = 1 - 0.2 * Math.sin(Math.PI * p / 0.3);
    else { const r = (p - 0.3) / 0.7; y = 4 * r * (1 - r) * 0.42; squash = 1 + 0.12 * Math.sin(Math.PI * r); }
  }
  return { pos, yaw, y, squash, moving };
}

// ---------------------------------------------------------------- camera
const AZ = THREE.MathUtils.degToRad(24), EL = THREE.MathUtils.degToRad(33), NEAR = 9.5, WIDE = 30;
const SHOTS = [[0, A, NEAR], [5.4, A, NEAR], [6.9, B, NEAR], [21.5, B, NEAR], [22.9, Cb, NEAR], [31.5, Cb, NEAR], [32.9, D, NEAR],
  [42.4, D, NEAR], [43.7, E, NEAR], [52.6, E, NEAR], [54.0, F, NEAR], [60.4, F, NEAR], [62.8, null, WIDE], [DURATION, null, WIDE]];
function shot(t) {
  let i = 0; while (i < SHOTS.length - 2 && t >= SHOTS[i + 1][0]) i++;
  const [ta, a, sa] = SHOTS[i], [tb, b, sb] = SHOTS[i + 1], p = inOut(seg(t, ta, tb));
  const pa = a ? [a.ox - 1.1, a.oz + 0.2] : [1.9, 2.2], pb = b ? [b.ox - 1.1, b.oz + 0.2] : [1.9, 2.2];
  return { x: lerp(pa[0], pb[0], p), z: lerp(pa[1], pb[1], p), S: lerp(sa, sb, p) };
}

// ---------------------------------------------------------------- words
const ITEMS = [['Day job: services at scale', 5.2], ['Small models, trained and measured', 21.4], ['Serving them', 31.8],
  ['Memory for agents', 42.4], ['Agent frameworks', 52.6], ['Checking what the agent claims', 60.2]];
const CAPTIONS = [
  [0.4, 5.3, 'Day job: Java and Python services, over a million events a day.'],
  [TB + 0.5, TB + 2.25, 'After hours, small models. A router first: NPC Fast, 1.7 billion parameters.'],
  [TB + 2.3, TB + 5.0, 'A specialist: NPC Fin, 32 billion. One cube is a billion parameters.'],
  [TB + 5.05, TB + 6.65, 'And a judge: Fin-PRM, 7 billion.'],
  [TB + 6.7, TB + 10.7, 'An easy request. The router answers it itself.'],
  [TB + 10.75, TB + 15.25, 'A hard one goes to the specialist, and the judge scores each step.'],
  [TC + 0.2, TC + 4.5, 'npc-mom-router: that routing as a package, for any two models.'],
  [TC + 4.6, TC + 8.7, 'polyrt: one call shape, whether Claude, GPT or a local MLX model answers.'],
  [TD + 0.3, TD + 4.5, 'engram: agent memory as a graph. Recall walks the links.'],
  [TD + 4.6, TD + 7.95, 'reasoning-bank: file a lesson after each task, pull one before the next.'],
  [TD + 8.0, TD + 9.6, 'Then I measured it. No lift, and I published that.'],
  [TE + 0.2, TE + 2.9, 'forge: an agent whose skills are markdown files.'],
  [TE + 3.0, TE + 5.5, 'cogito: reasoning as visible steps. Think, act, observe.'],
  [TE + 5.6, TE + 9.0, 'bottensor-fleet: several agents wired together as a graph.'],
  [TF + 0.2, TF + 6.4, 'attest-ledger: the agent says tests pass. Did a real run back that?'],
  [61.4, END, 'All of it is open: github.com/ramankrishna'],
];
const list = document.getElementById('list'), cap = document.getElementById('caption');
list.innerHTML = ITEMS.map(([text], i) => `<div><i></i><b>0${i + 1}</b><span>${text}</span></div>`).join('');
const rows = [...list.children];
cap.style.color = C.fg;
cap.style.background = THEME === 'dark' ? 'rgba(13,17,23,.84)' : 'rgba(255,255,255,.86)';

// ---------------------------------------------------------------- frame
function frame(t) {
  t = ((t % DURATION) + DURATION) % DURATION;
  const G = 1 - inBack(seg(t, END, END + 0.35));

  const s = shot(t);
  camera.left = -s.S * aspect / 2; camera.right = s.S * aspect / 2; camera.top = s.S / 2; camera.bottom = -s.S / 2;
  camera.updateProjectionMatrix();
  camera.position.set(s.x + 80 * Math.cos(EL) * Math.sin(AZ), 0.85 + 80 * Math.sin(EL), s.z + 80 * Math.cos(EL) * Math.cos(AZ));
  camera.lookAt(s.x, 0.85, s.z);
  const half = Math.max(11, s.S * 1.0);
  sun.position.set(s.x - 7 * 2.5, 13 * 2.5, s.z + 6 * 2.5); sun.target.position.set(s.x, 0, s.z);
  Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 90 });
  sun.shadow.camera.updateProjectionMatrix();

  for (const b of BENCHES) b.update(t - b.start, G);

  // Builder.
  const w = walkState(t);
  const pop = outBack(seg(t, 0.05, 0.45)) * G;
  ram.visible = pop > 0.01;
  ram.position.set(w.pos[0], w.y, w.pos[1]);
  let yaw = w.yaw, carrying = 0, lastSeed = null;
  for (const [pick, from, by, bench, at] of SEEDS) {
    if (t < pick) break;
    lastSeed = [bench.ox + at[0], bench.oz + at[2]];
    if (t < by + 0.12) {
      const p = inOut(seg(t, from, by)), k = outBack(seg(t, pick, pick + 0.25)) * (1 - seg(t, by, by + 0.12)) * pop;
      const hx = w.pos[0], hy = w.y + 1.3 * K * w.squash, hz = w.pos[1];
      seedCube.visible = k > 0.01; seedCube.scale.setScalar(k);
      seedCube.position.set(lerp(hx, bench.ox + at[0], p), lerp(hy, at[1], p) + Math.sin(Math.PI * p) * 0.35, lerp(hz, bench.oz + at[2], p));
      carrying = 1 - seg(t, by - 0.1, by + 0.15);
    } else seedCube.visible = false;
  }
  if (!w.moving && lastSeed) yaw = Math.atan2(lastSeed[0] - w.pos[0], lastSeed[1] - w.pos[1]);
  if (t > 60.9) yaw = 0.42;
  ram.rotation.y = yaw;
  const side = 1 / Math.sqrt(w.squash);
  ram.scale.set(K * pop * side, K * pop * w.squash, K * pop * side);
  const armsUp = Math.max(carrying, ...JUMPS.map(([a, b]) => bump(t, a, b - a)));
  for (const h of ram.userData.hands) h.position.set(h.userData.s * lerp(0.27, 0.2, armsUp), lerp(0.36, 1.0, armsUp), lerp(0.02, 0.06, armsUp));

  // Words.
  list.style.opacity = seg(t, 0.1, 0.5) * (1 - seg(t, 60.6, 61.2));
  rows.forEach((row, i) => {
    const done = seg(t, ITEMS[i][1], ITEMS[i][1] + 0.2) > 0.5;
    row.style.color = done ? C.fg : C.muted;
    row.firstChild.style.borderColor = done ? C.accent : C.rule;
    row.firstChild.style.background = done ? C.accent : 'transparent';
    row.firstChild.style.transform = `scale(${1 + 0.5 * bump(t, ITEMS[i][1], 0.3)})`;
  });
  let text = '', alpha = 0;
  for (const [a, b, words] of CAPTIONS) if (t >= a && t < b) { text = words; alpha = seg(t, a, a + 0.2) * (1 - seg(t, b - 0.2, b)); }
  if (cap.textContent !== text) cap.textContent = text;
  cap.style.opacity = alpha;

  renderer.render(scene, camera);
}

window.renderAt = frame;
window.DURATION = DURATION;
window.CHAPTERS = { dayjob: [0, 5.4], models: [TB + 0.5, 21.5], serving: [TC, 31.8], memory: [TD, 42.4], agents: [TE, 52.6], attest: [TF, 60.4] };
if (q.has('play')) { const t0 = performance.now(), from = parseFloat(q.get('t') || '0'); const run = () => { frame(from + (performance.now() - t0) / 1000); requestAnimationFrame(run); }; run(); }
else frame(parseFloat(q.get('t') || '0'));
window.ready = true;
