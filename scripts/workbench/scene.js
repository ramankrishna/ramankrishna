// Workbench: a tiny builder assembles three models as stacks of cubes
// (one cube = one billion parameters), wires them up, then sends two
// requests through. Every frame is a pure function of time, so the film
// can be rendered frame by frame and loops cleanly.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const q = new URLSearchParams(location.search);
const THEME = q.get('theme') === 'dark' ? 'dark' : 'light';
const C = THEME === 'dark'
  ? { bg: '#0d1117', fg: '#f0f6fc', muted: '#9198a1', rule: '#3d444d', slab: '#1c232d', cube: '#34404e',
      track: '#3a4654', accent: '#2ddbc0', ask: '#f2b84b', skin: '#e6cfb6', cap: '#5d6b7c', eye: '#0d1117',
      shadow: 0.5, hemiSky: '#aebbd0', hemiGround: '#0d1117', hemi: 0.75, sun: 2.3 }
  : { bg: '#ffffff', fg: '#1f2328', muted: '#59636e', rule: '#d1d9e0', slab: '#e9edf1', cube: '#ffffff',
      track: '#c3ccd5', accent: '#0b8a76', ask: '#e8a020', skin: '#e9d3bb', cap: '#1f2328', eye: '#1f2328',
      shadow: 0.16, hemiSky: '#ffffff', hemiGround: '#c9d2db', hemi: 1.15, sun: 2.1 };

export const DURATION = 16;
const U = 0.55, GAP = 0.03;              // cube size and spacing

// ---------------------------------------------------------------- helpers
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, p) => a + (b - a) * p;
const outCubic = p => 1 - Math.pow(1 - p, 3);
const inOut = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
const outBack = p => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const inBack = p => { const c = 1.9; return (c + 1) * p * p * p - c * p * p; };
const bump = (t, at, len) => { const p = seg(t, at, at + len); return p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p); };
const col = (a, b, p) => new THREE.Color(a).lerp(new THREE.Color(b), clamp(p));

// ---------------------------------------------------------------- stage
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(C.bg);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const aspect = innerWidth / innerHeight;
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

scene.add(new THREE.HemisphereLight(C.hemiSky, C.hemiGround, C.hemi));
const sun = new THREE.DirectionalLight('#ffffff', C.sun);
sun.position.set(-7, 13, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const mat = color => new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 });
const mesh = (geo, material, cast = true) => {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = true; return m;
};

// Slab and the soft shadow under it.
const slab = mesh(new RoundedBoxGeometry(12.4, 0.5, 7.4, 4, 0.12), mat(C.slab));
slab.position.y = -0.25; scene.add(slab);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: C.shadow }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.5; floor.receiveShadow = true; scene.add(floor);

// ---------------------------------------------------------------- places
// Tall things sit at the back so nothing hides the routes.
const ZH = -1.7, ZE = 1.95;   // the hard route runs along the back, the easy one along the front
const P = {
  enter: [-5.8, 0], fast: [-3.6, 0], fork: [-2.3, 0],
  easyA: [-2.3, ZE], easyB: [4.7, ZE],
  hardA: [-2.3, ZH], fin: [0.3, ZH], prm: [2.9, ZH], hardB: [4.7, ZH],
  tray: [4.7, 0],
};
const K = 1.3;                // the builder's size
const finHalf = (4 * U + 3 * GAP) / 2, prmHalf = (2 * U + GAP) / 2, fastHalf = U / 2;

// ---------------------------------------------------------------- stacks
const cubeGeo = new RoundedBoxGeometry(U, U, U, 3, 0.05);
function stack(center, nx, nz, count, start, each, partialTop = 1) {
  const cubes = [];
  for (let i = 0; i < count; i++) {
    const layer = Math.floor(i / (nx * nz)), r = i % (nx * nz), ix = r % nx, iz = Math.floor(r / nx);
    const m = mesh(cubeGeo, mat(C.cube));
    const h = (i === count - 1) ? partialTop : 1;
    m.userData = {
      x: center[0] + (ix - (nx - 1) / 2) * (U + GAP), z: center[1] + (iz - (nz - 1) / 2) * (U + GAP),
      y: layer * (U + GAP) + (U * h) / 2, h, layer, at: start + i * each,
    };
    scene.add(m); cubes.push(m);
  }
  return cubes;
}
// One cube is a billion parameters: 1.7, 32 and 7.
const fast = stack(P.fast, 1, 1, 2, 1.5, 0.42, 0.7);
const fin = stack(P.fin, 4, 2, 32, 3.62, 0.04);
const prm = stack(P.prm, 2, 2, 7, 5.92, 0.085);

// ---------------------------------------------------------------- tracks
const trackMat = mat(C.track);
const tracks = [
  [P.enter, [P.fast[0] - fastHalf, 0]], [[P.fast[0] + fastHalf, 0], P.fork],
  [P.fork, P.easyA], [P.easyA, P.easyB], [P.easyB, [P.tray[0], 0.62]],
  [P.fork, P.hardA], [P.hardA, [P.fin[0] - finHalf, ZH]],
  [[P.fin[0] + finHalf, ZH], [P.prm[0] - prmHalf, ZH]],
  [[P.prm[0] + prmHalf, ZH], P.hardB], [P.hardB, [P.tray[0], -0.62]],
].map(([a, b], i) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const m = mesh(new THREE.BoxGeometry(1, 0.03, 0.13), trackMat, false);
  m.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  m.userData = { a, b, len, at: 6.7 + i * 0.07 };
  scene.add(m); return m;
});

const tray = mesh(new RoundedBoxGeometry(1.25, 0.1, 1.25, 3, 0.04), mat(C.track));
tray.position.set(P.tray[0], 0.05, P.tray[1]); scene.add(tray);

// ---------------------------------------------------------------- labels
function label(text, { color = C.fg, weight = 500, size = 0.25 } = {}) {
  const cv = document.createElement('canvas'); const g = cv.getContext('2d');
  const px = 96; g.font = `${weight} ${px}px Bricolage`;
  cv.width = Math.ceil(g.measureText(text).width) + 24; cv.height = px * 1.4;
  g.font = `${weight} ${px}px Bricolage`; g.fillStyle = color; g.textBaseline = 'middle';
  g.fillText(text, 12, cv.height / 2);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.userData.size = [size * 1.4 * cv.width / cv.height, size * 1.4]; s.renderOrder = 10;
  scene.add(s); return s;
}

// ---------------------------------------------------------------- builder
function builder() {
  const g = new THREE.Group();
  const hoodie = mat(C.accent), skin = mat(C.skin);
  const body = mesh(new THREE.CapsuleGeometry(0.2, 0.2, 6, 16), hoodie); body.position.y = 0.32;
  const head = mesh(new THREE.SphereGeometry(0.2, 24, 18), skin); head.position.y = 0.8;
  const cap = mesh(new THREE.SphereGeometry(0.212, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), mat(C.cap));
  cap.position.y = 0.81; cap.rotation.x = -0.22;
  const eyeGeo = new THREE.SphereGeometry(0.027, 10, 8), eyeMat = new THREE.MeshBasicMaterial({ color: C.eye });
  const eyes = [-1, 1].map(s => { const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(s * 0.075, 0.8, 0.186); return e; });
  const hands = [-1, 1].map(s => { const h = mesh(new THREE.SphereGeometry(0.07, 12, 10), skin); h.userData.s = s; return h; });
  g.add(body, head, cap, ...eyes, ...hands);
  g.userData.hands = hands; scene.add(g); return g;
}
const ram = builder();

// Where he walks: [start, end, from, to, hops]
const WALK = [
  [0.5, 1.45, [-5.1, 1.1], [-3.6, 1.0], 3],
  [2.3, 3.35, [-3.6, 1.0], [0.3, -0.25], 5],
  [5.05, 5.75, [0.3, -0.25], [2.9, -0.3], 3],
  [6.7, 7.55, [2.9, -0.3], [1.1, 0.85], 3],
];
const JUMPS = [[3.35, 3.75], [5.75, 6.1], [14.75, 15.1], [15.08, 15.43]];
const CARRY_END = 1.45, PLACE_END = 1.85;

// ---------------------------------------------------------------- requests
const ballGeo = new THREE.SphereGeometry(0.17, 24, 18);
// A request: [time, x, z, visible]. Hidden while a model is working on it.
const EASY = { land: 10.72, path: [
  [7.65, P.enter[0], 0, 1], [8.3, P.fast[0] - fastHalf, 0, 1], [8.31, P.fast[0], 0, 0],
  [8.74, P.fast[0], 0, 0], [8.75, P.fast[0] + fastHalf, 0, 1], [8.98, ...P.fork, 1],
  [9.32, ...P.easyA, 1], [10.28, ...P.easyB, 1], [10.6, P.tray[0], 0.62, 1], [10.72, P.tray[0] - 0.2, 0.22, 1],
] };
const HARD = { land: 14.62, path: [
  [10.5, P.enter[0], 0, 1], [11.15, P.fast[0] - fastHalf, 0, 1], [11.16, P.fast[0], 0, 0],
  [11.59, P.fast[0], 0, 0], [11.6, P.fast[0] + fastHalf, 0, 1], [11.83, ...P.fork, 1],
  [12.15, ...P.hardA, 1], [12.48, P.fin[0] - finHalf, ZH, 1], [12.49, P.fin[0], ZH, 0],
  [13.84, P.prm[0], ZH, 0], [13.85, P.prm[0] + prmHalf, ZH, 1], [14.12, ...P.hardB, 1],
  [14.5, P.tray[0], -0.62, 1], [14.62, P.tray[0] + 0.2, -0.22, 1],
] };
const balls = [EASY, HARD].map(r => { const m = mesh(ballGeo, mat(C.ask)); m.userData = r; scene.add(m); return m; });
const STEPS = [12.92, 13.17, 13.42].map(at => {
  const m = mesh(new RoundedBoxGeometry(0.24, 0.12, 0.24, 2, 0.03), mat(C.ask)); m.userData.at = at; scene.add(m); return m;
});
const THINK = [[8.3, 8.75, 'easy'], [11.15, 11.6, 'hard']];
const FIN_WORK = [12.48, 13.5];

const L = {
  fast: label('NPC Fast 1.7B'), fin: label('NPC Fin 32B'), prm: label('Fin-PRM 7B'), answer: label('Answer'),
  easy: label('easy', { color: C.accent, weight: 700, size: 0.3 }),
  hard: label('hard', { color: C.accent, weight: 700, size: 0.3 }),
};

// ---------------------------------------------------------------- checklist
const ITEMS = [
  ['Train a small router', 2.2], ['Train a specialist', 5.0], ['Add a judge', 6.6],
  ['Easy request: the router answers', EASY.land], ['Hard request: worked in steps, each one scored', HARD.land],
];
const list = document.getElementById('list');
list.innerHTML = ITEMS.map(([text], i) => `<div><i></i><b>0${i + 1}</b><span>${text}</span></div>`).join('');
const rows = [...list.children];

// ---------------------------------------------------------------- frame
const END = 15.45;   // everything pops away from here so the loop restarts clean
const out = (t, delay = 0) => 1 - inBack(seg(t, END + delay, END + delay + 0.3));

function walkState(t) {
  let pos = WALK[0][2], yaw = 1.2, y = 0, squash = 1;
  for (const [a, b, from, to, hops] of WALK) {
    if (t < a) break;
    const p = inOut(seg(t, a, b));
    pos = [lerp(from[0], to[0], p), lerp(from[1], to[1], p)];
    yaw = Math.atan2(to[0] - from[0], to[1] - from[1]);
    if (t < b) {
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
  return { pos, yaw, y, squash };
}

function along(path, t) {
  if (t < path[0][0]) return null;
  for (let i = 0; i < path.length - 1; i++) {
    const [ta, xa, za, va] = path[i], [tb, xb, zb] = path[i + 1];
    if (t <= tb) { const p = seg(t, ta, tb); return { x: lerp(xa, xb, p), z: lerp(za, zb, p), visible: va === 1 }; }
  }
  const last = path[path.length - 1]; return { x: last[1], z: last[2], visible: true };
}

function place(sprite, x, y, z, scale) {
  sprite.position.set(x, y, z);
  sprite.scale.set(sprite.userData.size[0] * scale, sprite.userData.size[1] * scale, 1);
  sprite.visible = scale > 0.01;
}

function frame(t) {
  t = ((t % DURATION) + DURATION) % DURATION;

  // Camera: a slow drift around the bench, easing in a little while requests run.
  const az = THREE.MathUtils.degToRad(24 + 5 * Math.sin((t / DURATION) * Math.PI * 2 - 1.2));
  const el = THREE.MathUtils.degToRad(33);
  const zoom = 1 - 0.04 * inOut(seg(t, 7.2, 9)) + 0.04 * inOut(seg(t, 14.6, 15.6));
  const S = 9.5 * zoom;
  camera.left = -S * aspect / 2; camera.right = S * aspect / 2; camera.top = S / 2; camera.bottom = -S / 2;
  camera.updateProjectionMatrix();
  camera.position.set(30 * Math.cos(el) * Math.sin(az), 30 * Math.sin(el), 30 * Math.cos(el) * Math.cos(az));
  camera.lookAt(-0.45, 0.85, 0);

  // Builder.
  const w = walkState(t);
  const pop = outBack(seg(t, 0.05, 0.45)) * out(t, 0.12);
  ram.visible = pop > 0.01;
  ram.position.set(w.pos[0], w.y, w.pos[1]);
  const watching = t > 7.55 && t < 14.7;
  let yaw = w.yaw;
  if (t > 1.45 && t < 2.3) yaw = Math.atan2(P.fast[0] - w.pos[0], P.fast[1] - w.pos[1]);
  if (t > 3.35 && t < 5.05) yaw = Math.atan2(P.fin[0] - w.pos[0], P.fin[1] - w.pos[1]);
  if (t > 5.75 && t < 6.7) yaw = Math.atan2(P.prm[0] - w.pos[0], P.prm[1] - w.pos[1]);
  if (t >= 14.7) yaw = 0.42;
  const side = 1 / Math.sqrt(w.squash);
  ram.scale.set(K * pop * side, K * pop * w.squash, K * pop * side);
  const armsUp = Math.max(1 - seg(t, PLACE_END, PLACE_END + 0.25), ...JUMPS.map(([a, b]) => bump(t, a, b - a)));
  for (const h of ram.userData.hands) {
    h.position.set(h.userData.s * lerp(0.27, 0.2, armsUp), lerp(0.36, 1.0, armsUp), lerp(0.02, 0.06, armsUp));
  }

  // Stacks: cubes drop in, then light up when the model is working.
  const lit = { fast: Math.max(...THINK.map(([a, b]) => bump(t, a, b - a))), prm: 0 };
  for (const s of STEPS) lit.prm = Math.max(lit.prm, bump(t, s.userData.at + 0.24, 0.26));
  const dress = (cubes, key, done) => cubes.forEach((m, i) => {
    const d = m.userData, p = seg(t, d.at, d.at + 0.3);
    let glow = lit[key] ?? 0, sy = d.h, y = d.y + (1 - outCubic(p)) * 1.1;
    if (key === 'fin') {
      const [a, b] = FIN_WORK, wave = Math.max(bump(t, a + d.layer * 0.1, 0.45), bump(t, a + 0.5 + d.layer * 0.1, 0.45));
      glow = t > a && t < b + 0.4 ? wave : 0;
    }
    if (key === 'fast') { sy *= 1 - 0.16 * glow; y = d.y * (1 - 0.16 * glow) + (1 - outCubic(p)) * 1.1; }
    if (key === 'prm') { sy *= 1 - 0.14 * glow; y = d.y * (1 - 0.14 * glow) + (1 - outCubic(p)) * 1.1; }
    const s = outBack(p) * out(t, 0.004 * i);
    m.visible = s > 0.01;
    m.scale.set(s, s * sy, s);
    m.position.set(d.x, y, d.z);
    const trained = Math.max(0.2 * seg(t, done, done + 0.3), 0.8 * bump(t, done - 0.1 + d.layer * 0.06, 0.4));
    m.material.color.copy(col(C.cube, C.accent, Math.max(trained, glow * 0.95)));
  });
  dress(fast, 'fast', 2.2); dress(fin, 'fin', 5.0); dress(prm, 'prm', 6.6);

  // The first cube arrives in his hands.
  if (t < PLACE_END) {
    const m = fast[0], d = m.userData, p = inOut(seg(t, CARRY_END, PLACE_END));
    const hx = w.pos[0], hy = w.y + 1.3 * K * w.squash, hz = w.pos[1];
    m.visible = pop > 0.01; m.scale.setScalar(pop);
    m.position.set(lerp(hx, d.x, p), lerp(hy, d.y, p) + Math.sin(Math.PI * p) * 0.35, lerp(hz, d.z, p));
  }

  // Tracks and tray.
  for (const m of tracks) {
    const d = m.userData, g = outCubic(seg(t, d.at, d.at + 0.45)) * out(t);
    const dx = (d.b[0] - d.a[0]) / d.len, dz = (d.b[1] - d.a[1]) / d.len;
    m.visible = g > 0.01; m.scale.set(d.len * g, 1, 1);
    m.position.set(d.a[0] + dx * d.len * g / 2, 0.015, d.a[1] + dz * d.len * g / 2);
  }
  const trayS = outBack(seg(t, 7.2, 7.5)) * out(t, 0.1);
  tray.visible = trayS > 0.01; tray.scale.setScalar(trayS);

  // Requests.
  let watch = null;
  for (const m of balls) {
    const r = m.userData, p = along(r.path, t);
    m.visible = !!p && p.visible && t < END + 0.05;
    if (!p) continue;
    const landed = seg(t, r.land - 0.12, r.land);
    const bounce = t > r.land ? Math.abs(Math.sin((t - r.land) * 14)) * 0.22 * Math.exp(-(t - r.land) * 6) : 0;
    m.position.set(p.x, 0.17 + lerp(0.03, 0.1, landed) + bounce, p.z);
    m.material.color.copy(col(C.ask, C.accent, seg(t, r.land - 0.05, r.land + 0.25)));
    m.scale.setScalar(out(t, 0.05));
    if (t < r.land + 0.5) watch = p;
  }
  for (const s of STEPS) {
    const p = seg(t, s.userData.at, s.userData.at + 0.32);
    s.visible = p > 0 && p < 1;
    s.position.set(lerp(P.fin[0] + finHalf + 0.05, P.prm[0] - prmHalf - 0.05, inOut(p)), 0.09 + Math.sin(Math.PI * p) * 0.18, ZH);
    s.material.color.copy(col(C.ask, C.accent, seg(p, 0.75, 1)));
  }
  if (watching && watch) yaw = Math.atan2(watch.x - w.pos[0], watch.z - w.pos[1]);
  ram.rotation.y = yaw;

  // Labels.
  place(L.fast, P.fast[0], 1.42, P.fast[1], outBack(seg(t, 2.0, 2.25)) * out(t));
  place(L.fin, P.fin[0], 2.82, P.fin[1], outBack(seg(t, 4.85, 5.1)) * out(t));
  place(L.prm, P.prm[0], 1.72, P.prm[1], outBack(seg(t, 6.45, 6.7)) * out(t));
  place(L.answer, P.tray[0], 0.72, P.tray[1], outBack(seg(t, 7.35, 7.6)) * out(t));
  for (const [a, b, key] of THINK) {
    const until = key === 'easy' ? EASY.land : HARD.land;
    place(L[key], P.fast[0], 1.86, P.fast[1], outBack(seg(t, a + 0.12, a + 0.37)) * (1 - seg(t, until, until + 0.3)));
  }

  // Checklist.
  const fade = seg(t, 0.1, 0.5) * (1 - seg(t, END, END + 0.35));
  list.style.opacity = fade;
  rows.forEach((row, i) => {
    const done = seg(t, ITEMS[i][1], ITEMS[i][1] + 0.2);
    row.style.color = done > 0.5 ? C.fg : C.muted;
    row.firstChild.style.borderColor = done > 0.5 ? C.accent : C.rule;
    row.firstChild.style.background = done > 0.5 ? C.accent : 'transparent';
    row.firstChild.style.transform = `scale(${1 + 0.5 * bump(t, ITEMS[i][1], 0.3)})`;
  });

  renderer.render(scene, camera);
}

await document.fonts.load('500 96px Bricolage'); await document.fonts.load('700 96px Bricolage');
for (const k in L) { scene.remove(L[k]); }
Object.assign(L, {
  fast: label('NPC Fast 1.7B'), fin: label('NPC Fin 32B'), prm: label('Fin-PRM 7B'), answer: label('Answer'),
  easy: label('easy', { color: C.accent, weight: 700, size: 0.3 }),
  hard: label('hard', { color: C.accent, weight: 700, size: 0.3 }),
});
document.body.style.background = C.bg;
window.renderAt = frame;
window.DURATION = DURATION;
if (q.has('play')) { const t0 = performance.now(); const loop = () => { frame((performance.now() - t0) / 1000); requestAnimationFrame(loop); }; loop(); }
else frame(parseFloat(q.get('t') || '0'));
window.ready = true;
