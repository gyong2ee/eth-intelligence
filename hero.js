// Start-page hero: the Ethereum mark as a glossy silver 3D solid (an octahedron on top, a
// chevron-topped pyramid below), spinning on an axis tilted 20 degrees, plus the
// upcoming-events carousel (data/events.json). Loaded as a module by index.html; three.js
// comes from the import map there.
import * as THREE from 'three';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPIN = 1.2;                        // radians per second (~5.2 s per full turn)
const TILT = THREE.MathUtils.degToRad(20); // spin axis leans 20 degrees from vertical

/* ---------------- the ETH solid ---------------- */
// A square cross-section, like the logo seen from any side:
//  upper piece = octahedron: apex, square equator, short bottom tip
//  lower piece = inverted pyramid whose top dips into a V, nesting under the upper tip
function solid(top, eq, bottom) {
  const v = [];
  const dip = top[1] < eq[0][1];     // top point below the rim = a V-shaped top (lower piece)
  for (let i = 0; i < 4; i++) {
    const a = eq[i], b = eq[(i + 1) % 4];
    if (dip) v.push(...top, ...a, ...b); else v.push(...top, ...b, ...a);   // upper faces, outward
    v.push(...bottom, ...a, ...b);   // lower faces
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}
const square = (y, r) => [[r, y, 0], [0, y, r], [-r, y, 0], [0, y, -r]];
function ethPieces() {
  return [
    solid([0, 1.6, 0], square(0, 1), [0, -0.62, 0]),         // octahedron
    solid([0, -0.88, 0], square(-0.38, 1), [0, -1.66, 0]),   // lower chevron pyramid
  ];
}

/* ---------------- reflections: a contrasty studio so the facets read as polished silver ---------------- */
function studio() {
  const env = new THREE.Scene();
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.35, '#c7d6f2'); grad.addColorStop(0.5, '#3a5a96');
  grad.addColorStop(0.62, '#22396a'); grad.addColorStop(1, '#0e1a33');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide })));
  // bright softbox panels give the sharp highlights that sweep across faces as it turns
  const panel = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(6, 14, 12, 4, 6); panel(4, 12, -12, 2, -5); panel(16, 3, 0, 14, 0);
  return env;
}

/* ---------------- scene ---------------- */
function initToken(host) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return; }                       // no WebGL: the SVG fallback stays
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.querySelector('.hero-fallback')?.remove();
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(studio(), 0.01).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 7.8);

  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(3, 4, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6aa4ff, 3.2); rim.position.set(-5, 2, -4); scene.add(rim);
  const under = new THREE.DirectionalLight(0x9fc0ff, 1.0); under.position.set(0, -5, 3); scene.add(under);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x0b1630, 0.5));

  // upper piece: frosted satin silver (opaque, no costly glass pass); lower piece: dark gunmetal chrome
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xdfe3ea, metalness: 0.55, roughness: 0.34, clearcoat: 0.8, clearcoatRoughness: 0.18,
    envMapIntensity: 1.25, flatShading: true,
  });
  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0x9aa1ad, metalness: 1, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.06,
    envMapIntensity: 1.0, flatShading: true,
  });
  const edges = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });

  // axis = tilted group; spinner = rotates about the axis
  const axis = new THREE.Group(); axis.rotation.z = -TILT;
  const spinner = new THREE.Group(); axis.add(spinner);
  const [upper, lower] = ethPieces();
  spinner.add(new THREE.Mesh(upper, glass));
  spinner.add(new THREE.Mesh(lower, chrome));
  spinner.add(new THREE.LineSegments(new THREE.EdgesGeometry(upper), edges));
  spinner.add(new THREE.LineSegments(new THREE.EdgesGeometry(lower), edges));
  // dashed wireframe inside the glass: a smaller octahedron seen through the frosted faces
  const inner = new THREE.LineSegments(new THREE.EdgesGeometry(solid([0, 1.0, 0], square(0.05, 0.55), [0, -0.32, 0])),
    new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.06, gapSize: 0.05, transparent: true, opacity: 0.9, depthTest: false }));
  inner.computeLineDistances(); inner.renderOrder = 10; spinner.add(inner);   // drawn over the glass so it shows through
  spinner.position.y = 0.03;           // centre the whole mark on the axis
  scene.add(axis);

  function size() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(host); size();

  // pointer tilt (small, on top of the fixed 20-degree axis)
  let tx = 0, ty = 0, cx = 0, cy = 0;
  host.addEventListener('pointermove', e => {
    const r = host.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 0.4; ty = ((e.clientY - r.top) / r.height - 0.5) * 0.3;
  });
  host.addEventListener('pointerleave', () => { tx = ty = 0; });

  const clock = new THREE.Clock();
  const t0 = performance.now();
  function frame() {
    // the angle comes straight from the wall clock, so a slow or busy machine only drops
    // frames; it never turns the logo slower
    const dt = Math.min(clock.getDelta(), 0.5), t = (performance.now() - t0) / 1000;
    const ease = 1 - Math.pow(0.001, dt);         // frame-rate independent smoothing for the tilt
    cx += (tx - cx) * ease; cy += (ty - cy) * ease;
    spinner.rotation.y = 0.4 + t * SPIN;
    axis.rotation.set(cy, 0, -TILT - cx * 0.3);
    axis.position.y = Math.sin(t * 1.1) * 0.06;
    renderer.render(scene, camera);
  }
  if (reduce) { frame(); return; }
  // run only while the hero is on screen; setAnimationLoop follows the display refresh rate
  new IntersectionObserver(es => {
    if (es[0].isIntersecting) { clock.getDelta(); renderer.setAnimationLoop(frame); }
    else renderer.setAnimationLoop(null);
  }).observe(host);
}

/* ---------------- events carousel ---------------- */
const KST = { timeZone: 'Asia/Seoul' };
function fmtDate(d) {
  const p = new Intl.DateTimeFormat('ko-KR', { ...KST, month: 'long', day: 'numeric', weekday: 'short' }).format(d);
  const h = new Intl.DateTimeFormat('ko-KR', { ...KST, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${p} · ${h} KST`;
}
function dday(d) {
  const day = s => new Date(new Intl.DateTimeFormat('en-CA', KST).format(s) + 'T00:00:00Z');
  const n = Math.round((day(d) - day(new Date())) / 864e5);
  return n === 0 ? 'D-DAY' : `D-${n}`;
}
async function initEvents(box) {
  const card = box.querySelector('.ev-card'), count = box.querySelector('.ev-count');
  let list = [];
  try {
    const r = await fetch('/data/events.json', { cache: 'no-store' });
    const j = await r.json();
    const now = Date.now();
    list = (j.events || []).map(e => ({ ...e, d: new Date(e.at) })).filter(e => e.d.getTime() > now - 3 * 3600e3).sort((a, b) => a.d - b.d);
  } catch (e) { /* shown as empty below */ }
  if (!list.length) { card.innerHTML = '<p class="ev-empty">예정된 일정이 없습니다.</p>'; box.querySelector('.ev-nav').hidden = true; return; }
  let i = 0;
  function show() {
    const e = list[i];
    card.innerHTML = '';
    const top = document.createElement('div'); top.className = 'ev-top';
    const tag = document.createElement('span'); tag.className = 'ev-tag'; tag.textContent = i === 0 ? `UPCOMING · ${e.tag}` : e.tag;
    const dd = document.createElement('span'); dd.className = 'ev-dday'; dd.textContent = dday(e.d);
    top.append(tag, dd);
    const title = document.createElement('div'); title.className = 'ev-title'; title.textContent = e.title;
    const when = document.createElement('div'); when.className = 'ev-when'; when.textContent = fmtDate(e.d) + (e.note ? ` — ${e.note}` : '');
    card.append(top, title, when);
    if (e.url) {
      const a = document.createElement('a'); a.className = 'ev-link'; a.href = e.url; a.target = '_blank'; a.rel = 'noopener';
      a.setAttribute('aria-label', '출처 열기');
      a.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17 17 7M9 7h8v8"/></svg>';
      card.append(a);
    }
    count.textContent = `${i + 1} / ${list.length}`;
    box.querySelector('.ev-progress i').style.width = `${((i + 1) / list.length) * 100}%`;
  }
  box.querySelector('.ev-prev').addEventListener('click', () => { i = (i - 1 + list.length) % list.length; show(); });
  box.querySelector('.ev-next').addEventListener('click', () => { i = (i + 1) % list.length; show(); });
  show();
}

/* ---------------- background: flowing "+" contour tubes ---------------- */
// Every pixel is shaded like a shader would: a smooth rounded-"+" distance field around the logo,
// bent by a large diagonal warp so the lines flow, is cut into evenly spaced contour bands.
// Each band is lit as a round tube (light from the upper left) with soft edges and fine grain.
// Computed once into an image (static) and redrawn only when the hero changes size.
function initWaves(canvas) {
  const g = canvas.getContext('2d');
  let timer = 0;
  function box(x, y, hx, hy, r) {
    const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r;
    const ox = qx > 0 ? qx : 0, oy = qy > 0 ? qy : 0;
    return Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(qx, qy), 0) - r;
  }
  function draw() {
    const scale = Math.min(devicePixelRatio, 1.5);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const W = Math.round(w * scale), H = Math.round(h * scale);
    canvas.width = W; canvas.height = H;
    const token = document.getElementById('heroToken');
    const tr = token.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
    const cx = (tr.left - cr.left + tr.width / 2) * scale, cy = (tr.top - cr.top + tr.height / 2) * scale;
    const S = Math.max(300, tr.height) * scale;
    const L = S * 0.34, T = S * 0.16, R = S * 0.07, K = S * 0.2;     // plus shape
    const step = S * 0.1, half = 0.26;                                   // contour spacing, tube half-width (of step)
    const fadeIn = S * 0.35, fadeOut = S * 1.05, edgeBand = S * 0.4;     // radial fade from the logo outward, edge fade
    // Base outline: an upright rounded "+" (two rounded bars, smooth inner corners).
    const plus0 = (x, y) => {
      const a = box(x, y, L, T, R), b = box(x, y, T, L, R);
      const k = Math.max(K - Math.abs(a - b), 0) / K;
      return Math.min(a, b) - k * k * K * 0.25;
    };
    // Its radius in every direction (table of N angles), found by marching out and bisecting.
    const N = 2048, rTab = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
      let lo = 0, hi = 0, t = 0;
      while (plus0(t * ux, t * uy) < 0) { lo = t; t += T * 0.2; }
      hi = t;
      for (let j = 0; j < 20; j++) { const m = (lo + hi) / 2; if (plus0(m * ux, m * uy) < 0) lo = m; else hi = m; }
      rTab[i] = hi;
    }
    let rAvg = 0; for (let i = 0; i < N; i++) rAvg += rTab[i]; rAvg /= N;
    const rAt = a => { let u = (a / (Math.PI * 2)) * N; if (u < 0) u += N; const i = Math.floor(u), f = u - i; return rTab[i] * (1 - f) + rTab[Math.min(i + 1, N)] * f; };
    // field = how many "base sizes" out a point is, in pixels at the average radius. Every
    // contour of it is the same "+" scaled up, so the shape never relaxes into a circle.
    const field = (x, y) => Math.hypot(x, y) * rAvg / rAt(Math.atan2(y, x)) - rAvg;
    const img = g.createImageData(W, H), d = img.data;
    const lx = -0.45, ly = -0.75, lz = 0.5;                              // light: upper left, toward viewer
    const e = 1.5;
    for (let py = 0; py < H; py++) {
      const y = py - cy;
      for (let px = 0; px < W; px++) {
        const x = px - cx;
        const f = field(x, y);
        if (f < -step * 0.5) continue;                                   // keep the centre clear for the logo
        const v = f / step, fr = v - Math.floor(v) - 0.5;                // -0.5..0.5 across one spacing
        const t = fr / half;                                             // -1..1 across the tube
        if (t <= -1 || t >= 1) continue;
        // outward direction of the contour (gradient of the field)
        let gx = field(x + e, y) - f, gy = field(x, y + e) - f;
        const gl = Math.hypot(gx, gy) || 1; gx /= gl; gy /= gl;
        // tube surface normal: tilts along the gradient by the position across the tube
        const nz = Math.sqrt(1 - t * t), nx = gx * t, ny = gy * t;
        const diff = Math.max(0, nx * lx + ny * ly + nz * lz);
        const rim = Math.pow(1 - nz, 3);                                 // thin bright edge
        const grain = (Math.random() - 0.5) * 14;
        let r = 30 + diff * 62 + rim * 40 + grain, gg = 44 + diff * 78 + rim * 48 + grain, bb = 72 + diff * 108 + rim * 60 + grain;
        const edge = Math.min(1, (1 - Math.abs(t)) * 6);                 // soft anti-aliased edge
        // radial fade: full strength around the logo, melting into the page background outward
        const q = Math.min(1, Math.max(0, (Math.hypot(x, y) - fadeIn) / (fadeOut - fadeIn)));
        // ...and toward every edge of the canvas, so nothing ends in a straight cut
        const eg = Math.min(1, Math.min(px, W - px, py, H - py) / edgeBand);
        const fade = (1 - q * q * (3 - 2 * q)) * eg * eg * (3 - 2 * eg);  // smoothsteps
        if (fade <= 0.003) continue;
        const i = (py * W + px) * 4;
        d[i] = r; d[i + 1] = gg; d[i + 2] = bb; d[i + 3] = 235 * edge * fade;
      }
    }
    g.putImageData(img, 0, 0);
  }
  new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(draw, 120); }).observe(canvas);
  draw();
}

const waves = document.querySelector('.hero-waves');
if (waves) initWaves(waves);
const tokenHost = document.getElementById('heroToken');
if (tokenHost) initToken(tokenHost);
const ev = document.getElementById('heroEvents');
if (ev) initEvents(ev);
