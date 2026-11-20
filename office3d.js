// جولة ثلاثية الأبعاد في مكتب الموظفين: ندخل من الباب، ونمشي بين الأقسام، ونرى كل موظف على مكتبه بحالته
// تُحمَّل عند الطلب فقط من admin.html، ولا تقرأ ولا تكتب أي بيانات بنفسها: تستقبل الحالة وتعيد الضغطات
import * as THREE from './vendor/three.module.min.js';

const SEATS = { // [x, z] موضع الكرسي، والموظف يتجه نحو المدخل (+z)
  support: [-10.2, 0.4], sales: [-7.8, 0.4], accountant: [-1.2, 0.4], legal: [1.2, 0.4],
  ideas: [7.8, 0.4], marketing: [10.2, 0.4], coder: [7.8, -2.4], ops: [10.2, -2.4], coo: [0.5, -8.6], ceo: [9.5, -8.6] };
const SPARE = [[-10.2, -2.4], [-7.8, -2.4], [-1.2, -2.4], [1.2, -2.4]];
const MEET = [[-10.8, -8.9, 0], [-9.6, -8.9, 0], [-8.4, -8.9, 0], [-7.2, -8.9, 0], [-10.8, -6.6, Math.PI], [-9.6, -6.6, Math.PI], [-8.4, -6.6, Math.PI], [-7.2, -6.6, Math.PI], [-12.4, -7.75, Math.PI / 2]];
export const SPOTS = [
  ['outside', 'خارج المكتب', [0, 1.6, 16], [0, 1.7, 0]], ['entrance', 'المدخل', [0, 1.6, 9], [0, 1.3, 0]],
  ['support', 'خدمة العملاء', [-9, 1.6, 4.3], [-9, 1.05, 0.2]], ['finance', 'المالية والأنظمة', [0, 1.6, 4.3], [0, 1.05, 0.2]],
  ['growth', 'النمو والمنتج', [9, 1.7, 4.4], [9, 0.95, -1.2]], ['meeting', 'غرفة الاجتماعات', [-13.7, 1.85, -5.1], [-8.2, 0.7, -8.4]],
  ['coo', 'مكتب مدير العمليات', [-0.6, 1.65, -4.9], [1.2, 1.0, -8.8]], ['ceo', 'مكتب المدير التنفيذي', [8.2, 1.65, -4.9], [10, 1.0, -8.8]]];
const FONT = '"Alexandria","IBM Plex Sans Arabic",Tahoma,sans-serif';
const SKIN = 0xD9A47E;

let R = null; // الحالة الوحيدة للمشهد (يبقى حياً بين إعادات رسم الصفحة)

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? 0.8, metalness: o.m ?? 0, ...o.x });
function box(w, h, d, m, x, y, z, p) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; (p || R.scene).add(o); return o; }
function cyl(rt, rb, h, m, x, y, z, p, seg = 20) { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); o.castShadow = true; (p || R.scene).add(o); return o; }
function sph(r, m, x, y, z, p, sx = 1, sy = 1, sz = 1) { const o = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; (p || R.scene).add(o); return o; }

// لوحة نص عربي على قماش (canvas)
function label(lines, { w = 2, h = 0.5, bg = '#0E3B30', fg = '#FFFFFF', sub = '#E6D3A6', px = 256 } = {}) {
  const c = document.createElement('canvas'); c.width = Math.round(px * w / h); c.height = px; const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; const r = px * 0.12; g.beginPath(); g.roundRect(0, 0, c.width, c.height, r); g.fill(); }
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const [a, b] = [].concat(lines);
  g.fillStyle = fg; g.font = `700 ${Math.round(px * (b ? 0.36 : 0.46))}px ${FONT}`; g.fillText(a, c.width / 2, b ? px * 0.38 : px * 0.52, c.width * 0.92);
  if (b) { g.fillStyle = sub; g.font = `500 ${Math.round(px * 0.24)}px ${FONT}`; g.fillText(b, c.width / 2, px * 0.75, c.width * 0.92); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
}
function shemaghTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#FBFAF7'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#C0182D'; g.lineWidth = 3;
  for (let i = 0; i <= 64; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace; return t; }

// ---------- المبنى ----------
function buildOffice() {
  const S = R.scene; const wall = mat(0xF4F1EA), glass = new THREE.MeshPhysicalMaterial({ color: 0xD8ECF2, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, side: THREE.DoubleSide });
  const frame = mat(0x2B3A35, { r: 0.5, m: 0.4 }), wood = mat(0xC9A97A, { r: 0.7 }), dark = mat(0x26302D, { r: 0.6 }), emerald = mat(0x0E5A44, { r: 0.7 }), gold = mat(0xC9A24F, { r: 0.35, m: 0.6 });
  R.m = { wall, glass, frame, wood, dark, emerald, gold, chair: mat(0x3A4440, { r: 0.6 }), screen: mat(0x1B2430, { r: 0.3 }), plant: mat(0x3E8E5A), pot: mat(0xE8E1D4), white: mat(0xF6F5F0), skin: mat(SKIN, { r: 0.6 }) };
  // الأرضية والسقف
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), mat(0xD9C7A6, { r: 0.9 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; S.add(fl); R.floor = fl;
  const out = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), mat(0xB9BDB8, { r: 1 })); out.rotation.x = -Math.PI / 2; out.position.set(0, -0.01, 15); out.receiveShadow = true; S.add(out);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(7, 3.6), mat(0x8E6E52, { r: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(-8.8, 0.01, 8.2); rug.receiveShadow = true; S.add(rug);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), mat(0xF7F6F2, { r: 1 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = 3.3; S.add(ceil);
  const lp = new THREE.MeshBasicMaterial({ color: 0xFFFDF5 }); for (const x of [-9, 0, 9]) for (const z of [-7.5, -1, 5]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), lp); l.rotation.x = Math.PI / 2; l.position.set(x, 3.29, z); S.add(l); }
  // الجدران الخارجية، والواجهة بباب زجاجي
  for (const a of [[30, 3.3, 0.2, 0, -11], [0.2, 3.3, 22, -15, 0], [0.2, 3.3, 22, 15, 0], [13.5, 3.3, 0.2, -8.25, 11], [13.5, 3.3, 0.2, 8.25, 11]]) box(a[0], a[1], a[2], wall, a[3], 1.65, a[4]).castShadow = false;
  box(3, 0.9, 0.2, wall, 0, 2.85, 11).castShadow = false;
  for (const s of [-1, 1]) box(7, 3.6, 0.15, emerald, s * 5.05, 1.8, 11.18); box(3.1, 1.18, 0.15, emerald, 0, 3.01, 11.18); // الواجهة حول الباب
  for (const s of [-1, 1]) box(0.08, 2.42, 0.1, frame, s * 1.53, 1.21, 11.2); box(3.14, 0.08, 0.1, frame, 0, 2.42, 11.2);
  R.doors = [box(1.48, 2.36, 0.05, glass, -0.75, 1.18, 11.22), box(1.48, 2.36, 0.05, glass, 0.75, 1.18, 11.22)];
  const sign = label(['مسار', 'مكتب الموظفين'], { w: 3.2, h: 0.9, bg: null, fg: '#E6D3A6', sub: '#FFFFFF' }); sign.position.set(0, 2.95, 11.27); S.add(sign);
  for (const x of [-3.2, 3.2]) { plant(x, 12); }
  // غرف الإدارة والاجتماعات خلف زجاج (z = -4.5)
  for (const [a, b] of [[-15, -10.2], [-7.8, -3], [-3, -0.6], [1.6, 4], [4, 8.3], [10.7, 15]]) { const w = b - a; box(w, 3.3, 0.06, glass, (a + b) / 2, 1.65, -4.5).castShadow = false; box(w, 0.08, 0.1, frame, (a + b) / 2, 3.26, -4.5); box(w, 0.06, 0.1, frame, (a + b) / 2, 0.03, -4.5); }
  for (const x of [-3, 4]) box(0.12, 3.3, 6.5, wall, x, 1.65, -7.75);
  for (const [t, x] of [['غرفة الاجتماعات', -9], ['مكتب مدير العمليات', 0.5], ['مكتب المدير التنفيذي', 9.5]]) { const s = label(t, { w: 2.4, h: 0.38 }); s.position.set(x, 2.85, -4.44); S.add(s); }
  // غرفة الاجتماعات: طاولة طويلة وكراسي وشاشة
  box(5.2, 0.06, 1.6, wood, -9, 0.76, -7.75).userData.meet = 1; for (const [x, z] of [[-11.3, -7.2], [-6.7, -7.2], [-11.3, -8.3], [-6.7, -8.3]]) box(0.08, 0.74, 0.08, dark, x, 0.37, z);
  for (const [x, z, r] of MEET) chair(x, z, r);
  box(3, 1.6, 0.06, mat(0x111418, { r: 0.2 }), -9, 1.7, -10.85); R.meetScreen = box(2.8, 1.45, 0.02, new THREE.MeshBasicMaterial({ color: 0x0E3B30 }), -9, 1.7, -10.8);
  R.meetNote = box(0.32, 0.01, 0.42, mat(0xFFFFFF), -9, 0.8, -7.75); R.meetNote.userData.meet = 1; R.meetNote.visible = false;
  // مكتبا الإدارة: رف كتب وكنبة ونبتة
  for (const x of [5, 14.2]) { box(0.4, 2, 1.6, wood, x, 1, -10.3); }
  box(0.4, 2, 1.6, wood, -2.75, 1, -9.6); box(1.8, 0.45, 0.8, emerald, 2.6, 0.3, -6.2); box(1.8, 0.5, 0.2, emerald, 2.6, 0.6, -5.9); plant(3.5, -10.3);
  for (const [x, c] of [[0.5, 0x8C6A3F], [9.5, 0x3F6C8C], [-12.2, 0x6C8C3F]]) { box(1.6, 1, 0.04, gold, x, 2, -10.88); box(1.46, 0.86, 0.02, mat(c, { r: 0.9 }), x, 2, -10.86); } // لوحات فنية
  const clk = cyl(0.28, 0.28, 0.04, R.m.white, 0, 2.6, 10.88); clk.rotation.x = Math.PI / 2; // ساعة فوق الباب من الداخل
  box(2.2, 0.45, 0.8, emerald, 12.6, 0.3, -6.2); box(2.2, 0.5, 0.2, emerald, 12.6, 0.6, -5.9); plant(14.3, -5.2); plant(-2.4, -10.3); plant(-14.3, -5.2);
  // الاستقبال: كاونتر وجدار الشعار، وركن جلوس
  box(3.4, 1.05, 0.7, wood, 6.5, 0.53, 7.8); box(3.6, 0.06, 0.85, mat(0xEDE6D8), 6.5, 1.08, 7.8);
  const wl = box(4.4, 2.6, 0.12, emerald, 6.5, 1.5, 5.6); wl.material = emerald; const lg = label(['مسار', 'منصة إدارة الأساطيل'], { w: 3.4, h: 0.9, bg: null }); lg.position.set(6.5, 1.75, 5.67); S.add(lg); // يقرأ من جهة المدخل
  box(3.2, 0.42, 0.9, mat(0x5C6E68), -9.5, 0.28, 9.4); box(3.2, 0.5, 0.2, mat(0x5C6E68), -9.5, 0.6, 9.9); box(1.3, 0.38, 0.7, wood, -9.5, 0.2, 7.9); plant(-13.8, 9.8); plant(-5.2, 9.8); plant(13.8, 9.8); plant(13.8, 1.5); plant(-13.8, 1.5);
  // لوحات الأقسام المعلّقة
  for (const [t, x] of [['خدمة العملاء', -9], ['المالية والأنظمة', 0], ['النمو والمنتج', 9]]) { const s = label(t, { w: 2.6, h: 0.5 }); s.position.set(x, 2.75, 2.2); S.add(s); for (const dx of [-1.1, 1.1]) box(0.015, 0.5, 0.015, dark, x + dx, 3.05, 2.2); }
}
function plant(x, z) { cyl(0.22, 0.17, 0.45, R.m.pot, x, 0.23, z); sph(0.38, R.m.plant, x, 0.78, z, null, 1, 1.25, 1); sph(0.26, R.m.plant, x + 0.15, 1.15, z - 0.05); }
function chair(x, z, rot = 0, p) { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; (p || R.scene).add(g);
  box(0.5, 0.08, 0.48, R.m.chair, 0, 0.48, 0, g); box(0.5, 0.55, 0.07, R.m.chair, 0, 0.82, -0.24, g); cyl(0.03, 0.03, 0.42, R.m.dark, 0, 0.24, 0, g); cyl(0.26, 0.26, 0.03, R.m.dark, 0, 0.03, 0, g); return g; }
function desk(x, z) { const g = new THREE.Group(); g.position.set(x, 0, z); R.scene.add(g);
  box(1.5, 0.05, 0.75, R.m.wood, 0, 0.75, 0.55, g); for (const dx of [-0.7, 0.7]) box(0.05, 0.73, 0.68, R.m.dark, dx, 0.37, 0.55, g); box(1.4, 0.45, 0.03, R.m.dark, 0, 0.5, 0.9, g);
  // الشاشة على جانب المكتب ومائلة نحو الموظف، حتى يظهر وجهه لمن يقف أمامه
  const mo = new THREE.Group(); mo.position.set(0.42, 0, 0.72); mo.rotation.y = 0.45; g.add(mo);
  box(0.56, 0.34, 0.04, R.m.screen, 0, 1.02, 0, mo); box(0.06, 0.2, 0.06, R.m.dark, 0, 0.84, 0.03, mo); const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.51, 0.29), new THREE.MeshBasicMaterial({ color: 0x223040 })); scr.position.set(0, 1.02, -0.022); scr.rotation.y = Math.PI; mo.add(scr);
  box(0.45, 0.02, 0.15, R.m.white, 0, 0.785, 0.42, g); box(0.25, 0.008, 0.33, mat(0xF8F8F8), -0.45, 0.78, 0.5, g); return { g, scr }; }

// ---------- الموظفون ----------
function person(k, look) { const [t, c1, c2] = look || ['hair', '#4B5563']; const g = new THREE.Group(); const thobe = t === 'shm' || t === 'gh';
  const top = mat(thobe ? 0xF4F2EC : t === 'hj' ? (c2 || '#1E1E24') : c1, { r: 0.85 }); const trouser = mat(thobe ? 0xF4F2EC : t === 'hj' ? (c2 || '#1E1E24') : 0x2E3138);
  // الجسم جالساً
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.32, 6, 16), top); torso.position.set(0, 0.95, 0); torso.scale.set(1, 1, 0.75); torso.castShadow = true; g.add(torso);
  for (const s of [-1, 1]) { box(0.15, 0.13, 0.5, trouser, s * 0.11, 0.55, 0.2, g); box(0.13, 0.48, 0.13, trouser, s * 0.11, 0.27, 0.43, g); box(0.13, 0.06, 0.24, mat(0x222222), s * 0.11, 0.03, 0.5, g); }
  const arms = [], hands = []; for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * 0.24, 1.12, 0); g.add(a); const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.26, 4, 10), top); up.position.set(0, -0.15, 0.04); up.rotation.x = 0.3; up.castShadow = true; a.add(up);
    const fo = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.24, 4, 10), top); fo.position.set(-s * 0.05, -0.3, 0.2); fo.rotation.x = Math.PI / 2 - 0.15; fo.castShadow = true; a.add(fo); const h = sph(0.055, R.m.skin, -s * 0.07, -0.31, 0.37, a); arms.push(a); hands.push(h); }
  // الرأس والوجه
  const head = new THREE.Group(); head.position.set(0, 1.42, 0.02); g.add(head); sph(0.06, R.m.skin, 0, -0.12, 0, head); sph(0.115, R.m.skin, 0, 0, 0, head, 0.92, 1.05, 0.98);
  for (const s of [-1, 1]) { sph(0.014, mat(0x1E1A17), s * 0.04, 0.015, 0.105, head); box(0.035, 0.008, 0.01, mat(0x3A2A20), s * 0.04, 0.045, 0.105, head); }
  sph(0.016, R.m.skin, 0, -0.015, 0.115, head);
  // غطاء الرأس: قبعة كاملة فوق الجبهة، وجوانب وخلف بفتحة للوجه، ثم طرف يتدلى على الكتفين
  const cover = (m, r, g = 0.62) => { const top = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.36), m); top.position.set(0, 0.012, -0.008); top.castShadow = true; head.add(top);
    const sd = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 14, Math.PI / 2 + g, Math.PI * 2 - 2 * g, Math.PI * 0.36, Math.PI * 0.5), m); sd.position.copy(top.position); sd.castShadow = true; head.add(sd); };
  const drape = (m, rt, rb, h, y, gap) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 24, 1, !!gap, gap ? gap / 2 : 0, Math.PI * 2 - (gap || 0)), m); d.position.set(0, y, -0.015); d.castShadow = true; head.add(d); return d; };
  if (thobe) { const cm = t === 'shm' ? new THREE.MeshStandardMaterial({ map: R.shm, roughness: 0.9, side: THREE.DoubleSide }) : mat(0xFBFBF8, { r: 0.9, x: { side: THREE.DoubleSide } });
    cover(cm, 0.128); drape(cm, 0.125, 0.25, 0.36, -0.2, Math.PI * 0.75);
    const ag = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.017, 8, 28), mat(0x121212, { r: 0.5 })); ag.rotation.x = Math.PI / 2 - 0.12; ag.position.set(0, 0.1, -0.012); head.add(ag);
    sph(0.05, mat(0x2A1E18), 0, -0.08, 0.075, head, 1.25, 0.75, 0.6); box(0.06, 0.012, 0.012, mat(0x2A1E18), 0, -0.04, 0.112, head); } // لحية وشارب خفيفان
  else if (t === 'hj') { const hm = mat(c1, { r: 0.9, x: { side: THREE.DoubleSide } }); cover(hm, 0.13, 0.7); drape(hm, 0.1, 0.24, 0.3, -0.21); }
  else { sph(0.12, mat(0x2B1D14, { r: 0.95 }), 0, 0.04, -0.015, head, 1, 0.8, 1.02); for (const s of [-1, 1]) sph(0.025, R.m.skin, s * 0.108, -0.005, 0, head); }
  g.traverse(o => { if (o.isMesh) o.userData.k = k; }); return { g, head, hands, arms }; }

// ---------- التشغيل ----------
// لا نمشي عبر الزجاج ولا الجدران: نعبر خط الغرف (z = -4.5) من الأبواب فقط، ونعبر الواجهة من الباب فقط
const DOORS = [[-10.2, -7.8], [-0.6, 1.6], [8.3, 10.7]];
function blocked(x, z, nx, nz) { const cross = (a, b, l) => (a - l) * (b - l) <= 0;
  if (cross(z, nz, -4.5) && !DOORS.some(([a, b]) => nx > a + 0.25 && nx < b - 0.25)) return true;
  if (cross(z, nz, 11) && Math.abs(nx) > 1.2) return true;
  if (nz < -4.5 && (cross(x, nx, -3) || cross(x, nx, 4))) return true; return false; }
export function mount(host, api) {
  if (R && R.host === host) { R.api = api; return R.ctl; }
  if (R) R.ctl.dispose();
  const wrap = document.createElement('div'); wrap.className = 'o3-wrap'; wrap.tabIndex = 0; wrap.setAttribute('role', 'application'); wrap.setAttribute('aria-label', 'جولة ثلاثية الأبعاد في المكتب. الأسهم للمشي، والسحب للنظر حولك');
  host.appendChild(wrap);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; wrap.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xDCE6EA); scene.fog = new THREE.Fog(0xDCE6EA, 26, 46);
  const cam = new THREE.PerspectiveCamera(62, 1, 0.05, 80);
  R = { host, wrap, renderer, scene, cam, api, people: {}, desks: {}, yaw: Math.PI, pitch: -0.05, pos: new THREE.Vector3(0, 1.6, 16), keys: {}, fly: null, clock: new THREE.Clock(), alive: true, shm: shemaghTex(), state: null, meetGroup: new THREE.Group(), rm: matchMedia('(prefers-reduced-motion: reduce)').matches };
  scene.add(new THREE.HemisphereLight(0xFFFFFF, 0xB9A98C, 1.15)); const sun = new THREE.DirectionalLight(0xFFF4E2, 1.6); sun.position.set(-8, 14, 10); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 14, bottom: -14, near: 1, far: 40 }); sun.shadow.bias = -0.0008; scene.add(sun); scene.add(R.meetGroup);
  for (const [x, z] of [[-9, 1], [0, 1], [9, -1], [-9, -7.7], [0.5, -8], [9.5, -8], [0, 8]]) { const p = new THREE.PointLight(0xFFF1DC, 0.55, 9, 1.6); p.position.set(x, 3, z); scene.add(p); }
  buildOffice();
  // واجهة التحكم فوق المشهد
  const ui = document.createElement('div'); ui.className = 'o3-ui'; ui.innerHTML = `<div class="o3-spots">${SPOTS.map(([id, t]) => `<button type="button" data-o3="${id}">${t}</button>`).join('')}</div>
    <div class="o3-tip" aria-live="polite"></div><div class="o3-pad"><button type="button" data-mv="f" aria-label="إلى الأمام">▲</button><button type="button" data-mv="l" aria-label="التفت يساراً">◀</button><button type="button" data-mv="b" aria-label="إلى الخلف">▼</button><button type="button" data-mv="r" aria-label="التفت يميناً">▶</button></div>
    <button type="button" class="o3-full" aria-label="ملء الشاشة">⛶</button><button type="button" class="o3-enter">ادخل المكتب</button>`; wrap.appendChild(ui);
  const tip = ui.querySelector('.o3-tip');
  ui.addEventListener('click', e => { const b = e.target.closest('[data-o3]'); if (b) go(b.dataset.o3); if (e.target.closest('.o3-enter')) go('entrance');
    if (e.target.closest('.o3-full')) { try { document.fullscreenElement ? document.exitFullscreen() : wrap.requestFullscreen(); } catch (x) {} } });
  const hold = (b, on) => { if (b) R.keys['pad' + b.dataset.mv] = on; };
  ui.addEventListener('pointerdown', e => { const b = e.target.closest('[data-mv]'); if (b) { e.preventDefault(); hold(b, true); } });
  addEventListener('pointerup', R.pu = () => { for (const k of Object.keys(R.keys)) if (k.startsWith('pad')) R.keys[k] = false; });
  wrap.addEventListener('keydown', e => { const k = { ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' }[e.code]; if (k) { e.preventDefault(); R.keys[k] = true; R.fly = null; } });
  wrap.addEventListener('keyup', e => { const k = { ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' }[e.code]; if (k) R.keys[k] = false; });
  // السحب للنظر، والضغط للاختيار أو للمشي إلى نقطة في الأرض
  let drag = null; const cv = renderer.domElement; const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  const pick = e => { const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, cam); return ray.intersectObjects(scene.children, true)[0]; };
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw: R.yaw, pitch: R.pitch, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; R.fly = null; }
      R.yaw = drag.yaw + dx * 0.005; R.pitch = Math.max(-0.9, Math.min(0.6, drag.pitch + dy * 0.004)); return; }
    const h = pick(e); const k = h && h.object.userData.k; cv.style.cursor = k || (h && h.object.userData.meet) ? 'pointer' : 'grab'; tip.textContent = k && R.names[k] ? R.names[k] : ''; tip.hidden = !tip.textContent; });
  cv.addEventListener('pointerup', e => { const d = drag; drag = null; if (!d || d.moved) return; const h = pick(e); if (!h) return; const k = h.object.userData.k;
    if (k) { R.sel = k; R.api.onPick(k); return; } if (h.object.userData.meet) { go('meeting'); R.api.onMeet(); return; }
    if (h.object === R.floor) { const p = h.point; const to = new THREE.Vector3(p.x, 1.6, p.z); flyTo(to, null, 0); } });
  const ro = new ResizeObserver(() => { const w = wrap.clientWidth, h = wrap.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }); ro.observe(wrap);
  document.addEventListener('visibilitychange', R.vis = () => { if (!document.hidden) loop(); });
  function go(id) { const s = SPOTS.find(x => x[0] === id); if (s) { flyTo(new THREE.Vector3(...s[2]), new THREE.Vector3(...s[3])); ui.querySelectorAll('[data-o3]').forEach(b => b.setAttribute('aria-pressed', b.dataset.o3 === id)); ui.querySelector('.o3-enter').hidden = id !== 'outside'; } }
  function flyTo(p, look, dur = 1.8) { const fromP = R.pos.clone(), fy = R.yaw, fp = R.pitch; let ty = fy, tp = fp;
    if (look) { const d = look.clone().sub(p); ty = Math.atan2(-d.x, -d.z); tp = Math.atan2(d.y, Math.hypot(d.x, d.z)); } else { const d = p.clone().sub(fromP); if (d.length() > 0.3) ty = Math.atan2(-d.x, -d.z); }
    while (ty - fy > Math.PI) ty -= 2 * Math.PI; while (ty - fy < -Math.PI) ty += 2 * Math.PI;
    const dist = fromP.distanceTo(p); const T = R.rm ? 0.01 : Math.max(0.6, Math.min(4, dur || dist / 2.4)); R.fly = { fromP, p, fy, ty, fp, tp, t: 0, T }; }
  function loop() { if (!R || !R.alive || R.raf) return; R.raf = requestAnimationFrame(() => { R.raf = 0; if (!R.alive || document.hidden || !wrap.isConnected) return; frame(); loop(); }); }
  function frame() { const dt = Math.min(0.05, R.clock.getDelta()), t = R.clock.elapsedTime;
    if (R.fly) { const f = R.fly; f.t += dt; const u = Math.min(1, f.t / f.T), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; R.pos.lerpVectors(f.fromP, f.p, e); R.yaw = f.fy + (f.ty - f.fy) * e; R.pitch = f.fp + (f.tp - f.fp) * e; if (u >= 1) R.fly = null; }
    const K = R.keys, sp = 2.6 * dt; if (K.l || K.padl) R.yaw += 1.6 * dt; if (K.r || K.padr) R.yaw -= 1.6 * dt;
    const fw = (K.f || K.padf ? 1 : 0) - (K.b || K.padb ? 1 : 0); if (fw) { const nx = R.pos.x - Math.sin(R.yaw) * sp * fw, nz = R.pos.z - Math.cos(R.yaw) * sp * fw; if (!blocked(R.pos.x, R.pos.z, nx, nz)) R.pos.set(nx, R.pos.y, nz); }
    R.pos.x = Math.max(-14.4, Math.min(14.4, R.pos.x)); R.pos.z = Math.max(-10.4, Math.min(17, R.pos.z)); if (R.pos.z > 11.3 && Math.abs(R.pos.x) > 7.5) R.pos.x = Math.sign(R.pos.x) * 7.5;
    cam.position.copy(R.pos); cam.rotation.set(R.pitch, R.yaw, 0, 'YXZ');
    const open = Math.max(0, Math.min(1, (14.5 - R.pos.z) / 2.5)); R.doors[0].position.x = -0.75 - open * 1.4; R.doors[1].position.x = 0.75 + open * 1.4;
    for (const [k, P] of Object.entries(R.people)) { const st = (R.stat[k] || 'idle'); const ph = (k.charCodeAt(0) % 7) * 0.9;
      if (!R.rm) { if (st === 'busy') { P.hands.forEach((h, i) => { h.position.y = -0.31 + Math.max(0, Math.sin(t * 18 + i * 1.7)) * 0.02; }); P.head.rotation.y = Math.sin(t * 0.7 + ph) * 0.05; P.head.rotation.x = 0.12; }
        else { P.hands.forEach(h => { h.position.y = -0.31; }); P.head.rotation.x = 0; const c = (t * 0.25 + ph) % 6; P.head.rotation.y = c < 1 ? Math.sin(c * Math.PI) * 0.5 : c > 3 && c < 3.8 ? -Math.sin((c - 3) / 0.8 * Math.PI) * 0.35 : 0; } }
      const D = R.desks[k]; if (D) D.scr.material.color.setHex(st === 'busy' ? (R.rm ? 0x6FA8F0 : (Math.sin(t * 3 + ph) > 0 ? 0x6FA8F0 : 0x4F8BD8)) : 0x223040);
      if (P.badge) { P.badge.position.y = 1.85 + (R.rm ? 0 : Math.sin(t * 2.4 + ph) * 0.04); P.badge.quaternion.copy(cam.quaternion); } if (P.ring) P.ring.visible = R.sel === k; }
    renderer.render(scene, cam); }
  R.go = go; R.loop = loop; R.names = {}; R.stat = {};
  R.ctl = { update, go, dispose() { if (!R) return; R.alive = false; ro.disconnect(); removeEventListener('pointerup', R.pu); document.removeEventListener('visibilitychange', R.vis); renderer.dispose(); wrap.remove(); R = null; } };
  cam.position.copy(R.pos); go('outside'); R.fly = null; R.yaw = 0; R.pitch = 0.02; loop(); return R.ctl;
}

// تحديث الموظفين وحالاتهم دون إعادة بناء المكتب
function update(state) { if (!R) return; R.state = state; R.sel = state.sel; let spare = 0;
  const want = new Set(state.emps.map(e => e.k));
  for (const k of Object.keys(R.people)) if (!want.has(k)) { R.scene.remove(R.people[k].root); delete R.people[k]; }
  for (const e of state.emps) { R.names[e.k] = `${e.name} · ${e.role}`; R.stat[e.k] = e.status;
    const seat = SEATS[e.k] || SPARE[spare++ % SPARE.length]; let P = R.people[e.k];
    if (!P || P.sig !== JSON.stringify(e.look) + e.name + e.role) { if (P) R.scene.remove(P.root); if (R.desks[e.k]) R.scene.remove(R.desks[e.k].g);
      const root = new THREE.Group(); R.scene.add(root); const D = desk(seat[0], seat[1]); R.desks[e.k] = D; chair(seat[0], seat[1] - 0.05, 0, root);
      const pp = person(e.k, e.look); pp.g.position.set(seat[0], 0, seat[1]); root.add(pp.g);
      const plate = label([e.name, e.role], { w: 0.9, h: 0.26, px: 128 }); plate.position.set(seat[0], 0.62, seat[1] + 0.925); root.add(plate);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 40), new THREE.MeshBasicMaterial({ color: 0x1F6B57 })); ring.rotation.x = -Math.PI / 2; ring.position.set(seat[0], 0.015, seat[1] + 0.2); root.add(ring);
      P = R.people[e.k] = { ...pp, root, ring, seat, sig: JSON.stringify(e.look) + e.name + e.role }; }
    // شارة ما ينتظر موافقة المالك
    if (P.badgeN !== e.n) { if (P.badge) P.root.remove(P.badge); P.badge = null; P.badgeN = e.n;
      if (e.n) { const b = label(String(e.n > 9 ? '+9' : e.n), { w: 0.26, h: 0.26, bg: '#C9A24F', fg: '#2A1F08', px: 96 }); b.renderOrder = 5; b.position.set(seat[0], 1.85, seat[1]); P.root.add(b); P.badge = b; } }
    // في الاجتماع: يجلس على كرسي غرفة الاجتماعات
    const inMeet = state.meeting && state.attend.includes(e.k); P.g.visible = !inMeet; }
  R.meetGroup.clear(); if (state.meeting) state.attend.forEach((k, i) => { const e = state.emps.find(x => x.k === k); const m = MEET[k === 'ceo' ? 8 : i] || MEET[0]; if (!e) return; const p = person(k, e.look); p.g.position.set(m[0], 0, m[1]); p.g.rotation.y = m[2]; R.meetGroup.add(p.g); });
  R.meetNote.visible = !!state.meetToday && !state.meeting; R.meetScreen.material.color.setHex(state.meeting ? 0x2B5C9E : 0x0E3B30);
  R.loop(); }
