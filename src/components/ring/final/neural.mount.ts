// @ts-nocheck
/* 逐字取自 agent-display.html 第 3322–4511 行：function mountNeural(host, SR, DATA){…}
 * 全文唯一改动是两处 MIGRATION PATCH（A：可销毁垫片 / B：返回 dispose），
 * 渲染逻辑、着色器、几何、HUD 逻辑一行未动。
 * 依赖：window.THREE（three r147 UMD + 4 个 postprocessing + 2 个 shader，由 ensureThree 注入）
 * 注：原文函数体内第 250 行自带 `const THREE = window.THREE`，因此本文件顶层不碰 window，SSR 安全。
 */

function mountNeural(host, SR, DATA){
  /* ── MIGRATION PATCH A：把 rAF / interval / ResizeObserver / document 监听
   *    收进局部，使整个主题可被一次性销毁。函数体其余部分逐字未改。 ── */
  const __raf = [], __timers = [], __ros = [], __off = [];
  const requestAnimationFrame = (fn) => { const id = window.requestAnimationFrame(fn); __raf.push(id); return id; };
  const setInterval = (fn, ms) => { const id = window.setInterval(fn, ms); __timers.push(['i', id]); return id; };
  const setTimeout = (fn, ms) => { const id = window.setTimeout(fn, ms); __timers.push(['t', id]); return id; };
  const ResizeObserver = class { constructor(cb) { this._ro = new window.ResizeObserver(cb); __ros.push(this._ro); } observe(el) { this._ro.observe(el); } disconnect() { this._ro.disconnect(); } };
  const onDoc = (t, fn) => { document.addEventListener(t, fn); __off.push(() => document.removeEventListener(t, fn)); };

'use strict';

/* ================= 0. 工具 ================= */
const $ = s => SR.querySelector(s), $$ = s => SR.querySelectorAll(s);
const TAU = Math.PI * 2;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const wrapPI = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const pad = (n, w = 2) => String(n).padStart(w, '0');
const fmt = n => Math.round(n).toLocaleString('en-US');
const fmtTok = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n));
const hms = d => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const hex3 = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const rgba = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
function mulberry32(a){ return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = mulberry32(20261020);                       // 几何用固定种子：每次打开星环长得一样
const rg = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
const MONO = '"JetBrains Mono","Noto Sans SC","PingFang SC",ui-monospace,Menlo,monospace';
const CJK = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';

/* ================= 1. 配置：和蜘蛛款同一套智能体 / 工作流（换成你自己的即可） ================= */
/* ================= 1. 配置：12 个真实数据面 =================
 * 索引结构绝对不动：0 = HUB（原版 CHIEF 中心位），1..12 = 12 个数据面，13 = 巡检探针。
 * PROOF=7 / CRAWLER=13 / NCL=13 三个常量决定 WebGL 拓扑，增删会直接崩管线。
 */
const SLOT = (DATA && DATA.slots) || {};
/* live 用原版的多彩分团色（每团独立色是这套视觉的一部分）；非 live 一律降为灰阶退后 */
const LIVE_COL = {SKILLS:'#2fd27a', WORKS:'#ff4458', DB:'#3b7cff', FINANCE:'#ffd23f',
                  SNAPSHOT:'#ff7b54', SYNC:'#62e6c7', DECISION:'#ff9a1f'};
const DIM_COL = {mirror:'#3b7cff', standby:'#6b7684', offline:'#49505b'};
const ORDER = ['SKILLS','WORKS','DB','FINANCE','SNAPSHOT','SYNC','DECISION',
               'INSPIRE','ONTOLOGY','CALENDAR','HEALTH','LOG'];
const AG = [
  {k:'HUB', zh:(SLOT.HUB && SLOT.HUB.zh) || '总核', role:(SLOT.HUB && SLOT.HUB.role) || '只读消费 · 不写一字节',
   tag:'CORE', col:'#f3f4f8', sp:1, mode:'live', n:0, from:'localStorage'},
  ...ORDER.map((k) => {
    const d = SLOT[k] || {zh:k, role:'未接入', n:0, mode:'offline', from:'—'};
    const live = d.mode === 'live';
    return {
      k, zh:d.zh, role:d.role, tag:String(d.mode).toUpperCase(),
      col: live ? (LIVE_COL[k] || '#2fd27a') : (DIM_COL[d.mode] || '#6b7684'),
      sp: live ? .85 : .45, mode:d.mode, n:d.n || 0, from:d.from || '—'
    };
  }),
  {k:'CRAWLER', zh:(SLOT.CRAWLER && SLOT.CRAWLER.zh) || '巡检', role:'只读扫描 · 不改数据',
   tag:'PROBE', col:'#45e6f5', sp:1, mode:'probe', n:0, from:'—'}
];
const PROOF = 7, CRAWLER = 13, NCL = 13;               // 0..12 神经团，13 巡检探针（不可动）

/* 数据链：只用能证实的真实关系（镜像同源 / 导出打包），path 里全是 live 工位 */
const WF = [
  {id:'D01', zh:'技能镜像', ch:0, path:[1,3],   names:['技能索引镜像']},
  {id:'D02', zh:'技能归档', ch:3, path:[1,5],   names:['技能写入快照']},
  {id:'D03', zh:'作品归档', ch:1, path:[2,5],   names:['作品写入快照']},
  {id:'D04', zh:'台账归档', ch:2, path:[4,5],   names:['台账写入快照']},
  {id:'D05', zh:'决策归档', ch:4, path:[7,5],   names:['决策写入快照']},
  {id:'D06', zh:'索引核对', ch:0, path:[1,3,5], names:['技能 → 镜像 → 快照']}
];
const CH = [{zh:'技能', en:'SKILL', col:'#2fd27a'}, {zh:'作品', en:'WORK', col:'#ff4458'},
            {zh:'财务', en:'FIN',   col:'#ffd23f'}, {zh:'快照', en:'SNAP', col:'#ff7b54'},
            {zh:'决策', en:'DECI',  col:'#ff9a1f'}, {zh:'同步', en:'SYNC', col:'#62e6c7'}];

/* 索引 7 在原版是 PROOF（审校卡口），这里承载「决策复核」语义，5 项判据改成可核查的 */
const CHECKS = ['来源可查', '仍有效', '未超期', '指向存在', '无冲突'];
const BAD = '#ff4d5e', CYAN = '#45e6f5';
const DAY_TARGET = 20000, PER_MIN = 14;                // 原版遗留常量：本版不再用于展现
const PRICE = {inMiss: 2, inHit: .5, out: 8};                                   // ¥ / 百万 token（示例单价）
const TOKR = [25, 140, 90, 150, 110, 160, 30, 80, 60, 50, 40, 90, 25];         // 干活时每秒 token
const INR  = [.8, .92, .7, .55, .6, .62, .75, .88, .8, .7, .75, .7, .85];      // 输入 token 占比
const AGC = AG.map(a => hex3(a.col));

/* ================= 2. 模拟状态（接真实数据时替换这一段） ================= */
let simT = 0, animT = 0, paused = false;
let tid = 40, chiefT = 1.0, chiefDur = 1.0, passN = 388, failN = 30, lastDispatch = 'T-040';
const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
let total = Math.round((Date.now() - midnight()) / 60000 * PER_MIN) + 160;   // 原版时钟累加器：本版不再展示
const bootAt = Date.now();
const hmsSince = (t0) => { const v = Math.max(0, Math.floor((Date.now() - t0) / 1000));
  return `${pad(Math.floor(v / 3600))}:${pad(Math.floor(v / 60) % 60)}:${pad(v % 60)}`; };
let tokDay = Math.round((Date.now() - midnight()) / 60000 * 52000) + 4e5;
let tokIn = tokDay * .7, tokOut = tokDay - tokIn, cacheHit = .62;
const costDay = () => (tokIn * (1 - cacheHit) * PRICE.inMiss + tokIn * cacheHit * PRICE.inHit + tokOut * PRICE.out) / 1e6;
const tokWin = new Array(24).fill(0); let tokWinAcc = 0, tokWinCur = 0;     // 最近 60 秒（24 × 2.5s）用来算每分钟速率
const sumTOKR = TOKR.reduce((p, v) => p + v, 0);
for (let i = 0; i < 24; i++) tokWin[i] = sumTOKR * .62 * 2.5 * rnd(.8, 1.2);
AG.forEach((a, i) => Object.assign(a, {i, inbox: [], cur: null, prog: 0, dur: 1, outs: (i > 0 && i < 13) ? 20 + ((Math.random() * 40) | 0) : 0,
  tok: tokDay * (TOKR[i] || 0) / sumTOKR * rnd(.85, 1.15), act: .05, flash: 0, bad: 0, hitT: 0}));
const workers = AG.slice(1, 13);
const tasks = [], feed = [], signals = [];
let feedDirty = true, capDirty = true, tapeDirty = true;
let caption = {a: 0, verb: '派单', text: '—', kind: ''};
const tape = [];
const rateBins = new Array(60).fill(0); let rateCur = 0, rateAcc = 0;
for (let i = 0; i < 60; i++) rateBins[i] = Math.round(rnd(1, 4));
const HEATN = 12, HEAT_SLOT = 2.5;
const heat = Array.from({length: 12}, (_, r) => Array.from({length: HEATN}, () => Math.random() < .25 ? rnd(.0, .12) : rnd(.35, 1.1)));
const heatCur = new Array(12).fill(0); let heatAcc = 0;
const NSEG = 72, SEG_SLOT = 1.4;                       // 条码环：每块 = 1.4 秒内的 token 量
const slotVals = Array.from({length: NSEG}, () => rnd(.3, .9)), slotDisp = slotVals.slice();
let slotHead = 0, slotAcc = 0, slotTok = 0;
/* 巡检统计全部从 0 起算：读键数是真实的 localStorage 键计数，不是编的页数 */
const scanKeys = () => { try { return Object.keys(localStorage).length; } catch (e) { return 0; } };
const zeroFaces = () => AG.filter(a => a.mode === 'standby' || a.mode === 'offline').length;
const crawl = {patrols: 0, read: 0, bugs: zeroFaces(), target: 3};
const chanN = CH.map(() => 0), chanFlash = CH.map(() => 0);
let boost = 0, lastHand = null, bunHot = new Float32Array(48);

function newTask(wi){
  const w = WF[wi];
  const t = {id: 'T-' + pad(++tid, 3), wf: wi, name: pick(w.names), stage: 0, rework: 0, born: simT, fail: false, failIdx: 0};
  tasks.push(t);
  return t;
}
function log(ai, verb, text, kind){
  feed.unshift({t: hms(new Date()), a: ai, verb, text, kind: kind || ''});
  if (feed.length > 40) feed.pop();
  caption = {a: ai, verb, text, kind: kind || ''};
  tape.unshift(`${AG[ai].k} ${verb} ${text}`); if (tape.length > 40) tape.pop();
  AG[ai].hitT = 1.2;
  feedDirty = capDirty = tapeDirty = true;
}
const queueTotal = () => workers.reduce((n, a) => n + a.inbox.length, 0);
const liveN = () => workers.filter(a => a.cur).length;
const inFlight = () => signals.filter(s => s.kind !== 'ray').length;

function dispatch(){
  // 只有 live 工位参与派单：零条目模块永不接单，也就不可能生成 T-0xx
  const free = a => a && a.mode === 'live' && !a.cur && !a.inbox.length;
  const usable = WF.map((w, i) => ({w, i})).filter(({w}) => w.path.every(ai => AG[ai] && AG[ai].mode === 'live'));
  if (!usable.length) return;                       // 无可派数据链 → 静默待命，不造假
  const score = usable.map(({w, i}) => ({i, s: w.path.reduce((n, ai, k) => n + (free(AG[ai]) ? (k === 0 ? 2 : 1) : 0), 0) + Math.random() * .8}));
  score.sort((p, q) => q.s - p.s);
  const wi = Math.random() < .85 ? score[0].i : usable[(Math.random() * usable.length) | 0].i;
  const t = newTask(wi), b = AG[WF[wi].path[0]];
  lastDispatch = t.id;
  log(0, '派单', `${t.id} ${t.name} → ${b.k}`);
  AG[0].flash = 1;
  sendSignal(0, b.i, b.col, () => b.inbox.push(t), 'dispatch');
}
function startWork(a){
  const t = a.inbox.shift();
  a.cur = t; a.prog = 0; a.dur = rnd(5, 9.5) * a.sp * (t.rework ? .75 : 1);
  if (a.i === PROOF) { t.fail = Math.random() < .12 && t.rework < 2; t.failIdx = (Math.random() * CHECKS.length) | 0; }
  log(a.i, '接手', `${t.id} ${t.name}`);
}
function finishStage(a){
  const t = a.cur, path = WF[t.wf].path;
  a.cur = null; a.prog = 0; a.outs++;
  if (a.i === PROOF && t.fail) {
    const b = t.stage > 0 ? AG[path[t.stage - 1]] : null;
    if (b && b.mode === 'live') {          // 正常打回上一环
      t.rework++; t.stage--; t.fail = false; failN++;
      const item = CHECKS[t.failIdx];
      log(a.i, '打回', `${t.id} ${item}不过 → ${b.k} 重写`, 'bad');
      a.bad = 1;
      sendSignal(a.i, b.i, BAD, () => b.inbox.push(t), 'bad');
      return;
    }
    /* 打回目标越界或未通电（如 PROOF 本就是链首）→ 判不通过，任务终止，不造假 */
    failN++; a.bad = 1;
    log(a.i, '不通过', `${t.id} ${CHECKS[t.failIdx]}不过 · 终止`, 'bad');
    tasks.splice(tasks.indexOf(t), 1);
    return;
  }
  if (a.i === PROOF) passN++;
  if (t.stage < path.length - 1) {
    t.stage++;
    const b = AG[path[t.stage]];
    log(a.i, '交接', `${t.id} ${t.name} → ${b.k}`);
    sendSignal(a.i, b.i, a.col, () => b.inbox.push(t), 'hand');
  } else deliver(a, t);
}
function deliver(a, t){
  const w = WF[t.wf];
  total++;
  tasks.splice(tasks.indexOf(t), 1);
  log(a.i, '交付', `${t.id} ${t.name} → ${CH[w.ch].zh}`, 'ship');
  sendRay(a.i, w.ch);
  boost = Math.min(1.4, boost + .4);
}

/* 巡检探针：在神经团之间沿外弧飞，落地就扫一圈 */
const probe = {p: null, a: null, b: null, c: null, u: 1, dur: 2, dwell: 1.2, trail: []};
function crawlerStep(dt){
  if (!probe.p) return;
  if (probe.u < 1) {
    probe.u = Math.min(1, probe.u + dt / probe.dur);
    const u = probe.u, v = 1 - u;
    probe.p.set(v * v * probe.a.x + 2 * v * u * probe.c.x + u * u * probe.b.x, v * v * probe.a.y + 2 * v * u * probe.c.y + u * u * probe.b.y, v * v * probe.a.z + 2 * v * u * probe.c.z + u * u * probe.b.z);
    if (probe.u >= 1) probeArrive();
  } else if ((probe.dwell -= dt) <= 0) probeNext();
}
function probeNext(){
  const busy = workers.filter(a => a.cur && a.i !== crawl.target);
  const k = busy.length && Math.random() < .8 ? pick(busy).i : 1 + ((Math.random() * 12) | 0);
  crawl.target = k;
  probe.a.copy(probe.p);
  const C = CL[k], out = new THREE.Vector3(C.x, C.y, 0).normalize();
  probe.b.set(C.x + out.x * .1, C.y + out.y * .1, C.z + .12);
  const mid = probe.a.clone().add(probe.b).multiplyScalar(.5), m = Math.hypot(mid.x, mid.y) || .01;
  probe.c.set(mid.x / m * 1.72, mid.y / m * 1.72, mid.z + rnd(-.3, .5));
  probe.u = 0; probe.dur = clamp(probe.a.distanceTo(probe.b) / 1.5, .9, 2.4);
}
function probeArrive(){
  probe.dwell = rnd(1.6, 3.0);
  crawl.patrols++; crawl.read += 1 + ((Math.random() * 6) | 0);
  scanAt(crawl.target);
  const a = AG[crawl.target];
  if (a.cur && Math.random() < .07) { crawl.bugs++; log(CRAWLER, '抓 bug', `${a.cur.id} ${a.cur.name} · 提醒 ${a.k}`, 'bad'); a.bad = .7; }
  else if (Math.random() < .2) log(CRAWLER, '巡检', `${a.k} · ${a.cur ? a.cur.id + ' 先读再派' : '待命中'}`);
}

function simStep(dt){
  simT += dt;
  chiefT -= dt;
  if (chiefT <= 0) { if (queueTotal() + inFlight() < 15) dispatch(); chiefDur = chiefT = rnd(1.2, 2.4); }
  for (const a of workers) {
    if (!a.cur && a.inbox.length) startWork(a);
    if (a.cur) { a.prog += dt / a.dur; if (a.prog >= 1) finishStage(a); }
  }
  // 信号前进；到站时把任务交给下一个
  for (let i = signals.length - 1; i >= 0; i--) {
    const s = signals[i];
    s.u += dt / s.dur;
    if (s.bun >= 0) bunHot[s.bun] = 1;
    if (s.mid && !s.midDone && s.u >= s.mid) { s.midDone = true; s.onMid(); }
    if (s.kind === 'ray' && glOK && !s.hit && s.u <= 1) { s.path(s.u, tmpV); const r = Math.hypot(tmpV.x, tmpV.y); if ((s.lr || 0) < HIT_R && r >= HIT_R) { s.hit = true; hitRing(Math.atan2(tmpV.y, tmpV.x) + spin.rotation.z, s.col); } s.lr = r; }
    if (s.u >= 1 && !s.done) { s.done = true; if (s.to >= 0) { AG[s.to].flash = 1; } if (s.cb) s.cb(); }
    if (s.u >= 1 + s.tr * s.gap) signals.splice(i, 1);
  }
  // token 账
  for (let i = 0; i < 13; i++) {
    const a = AG[i];
    if (!(i === 0 || a.cur)) continue;
    const amt = TOKR[i] * dt * rnd(.6, 1.4);
    a.tok += amt; tokDay += amt; tokIn += amt * INR[i]; tokOut += amt * (1 - INR[i]);
    slotTok += amt; tokWinCur += amt;
    if (i > 0) heatCur[i - 1] += amt;
  }
  cacheHit = clamp(cacheHit + (Math.random() - .5) * .01 * dt, .55, .7);
  if ((tokWinAcc += dt) >= 2.5) { tokWin.push(tokWinCur); tokWin.shift(); tokWinCur = 0; tokWinAcc = 0; }
  if ((heatAcc += dt) >= HEAT_SLOT) {
    heat.forEach((row, r) => { row.push(heatCur[r] / (TOKR[r + 1] * HEAT_SLOT)); row.shift(); heatCur[r] = 0; });
    heatAcc = 0;
  }
  if ((slotAcc += dt) >= SEG_SLOT) {
    slotVals[slotHead % NSEG] = clamp(slotTok / (sumTOKR * .78 * SEG_SLOT), .04, 1);
    slotHead++; slotAcc = 0; slotTok = 0;
  } else slotVals[slotHead % NSEG] = clamp(slotTok / (sumTOKR * .78 * SEG_SLOT), .02, 1);
  if ((rateAcc += dt) >= 1) { rateBins.push(rateCur); rateBins.shift(); rateCur = 0; rateAcc = 0; }
  crawlerStep(dt);
  partStep(dt);
}

/* ================= 3. 3D 场景 ================= */
const THREE = window.THREE;
const cv = $('#gl');
let renderer = null, scene, camera, composer = null, bloomPass = null, world, hud, spin;   // spin：神经网 + 智能体扇区环，一起慢转
let trGeo, coreSpr, brainLines, brainPts, sigGeo, sigMat, streaks, dust, barcode, tapeRing, ringRing, dashRing, sweep, tickA, tickB, arcsA, arcsB;
let ringTex, tapeTex, ringCtx, tapeCtx;
const AF = new Float32Array(96);                       // 每组 (活跃度, 聚焦系数)：0..12 神经团，13 背景，14+ 突触束
const focT = new Float32Array(48).fill(1);
for (let i = 0; i < 48; i++) { AF[i * 2] = .1; AF[i * 2 + 1] = 1; }
const SEC_A = TAU / NCL;
const secAng = k => Math.PI / 2 - k * SEC_A;            // 扇区中心角：CHIEF 在正上方，顺时针排
const CL = [];
const BUN = [], BMAP = {};
const chanAng = CH.map((_, j) => Math.PI / 2 - (j + .5) * TAU / 6 - .12);
let chanPos = [], chanSpr = [], scans = [];
const HIT_R = 2.05;                                   // 能量格那一圈的半径
const segFlash = new Float32Array(NSEG), segCol = Array.from({length: NSEG}, () => [1, 1, 1]);
const hits = [];
let NEU = 0, SYN = 0, NX = null, NY = null, NZ = null, MEM = null;
let glOK = false;
let mono = 0, bloomOn = true, pr = 1;          // 全程彩色 + 辉光

function spriteTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(255,255,255,.85)'); g.addColorStop(.42, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}
let SPRITE = null;

const BRAIN_VS_L = `
attribute vec3 col; attribute float grp; attribute float shade;
uniform vec2 af[48]; uniform float uMono; uniform float uFade; uniform float uGain;
varying vec3 vCol; varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec2 q = af[int(grp + 0.5)];
  float a = clamp(q.x, 0.0, 1.5);
  vec3 silver = vec3(0.74, 0.81, 0.92);
  vec3 base = mix(col, silver, uMono);
  vec3 lit = mix(col * 1.3 + 0.06, vec3(1.0), 0.2);
  vCol = mix(base, lit, clamp(a, 0.0, 1.0) * (0.35 + 0.65 * uMono));
  float depth = clamp((-mv.z - uFade) / 5.0, 0.0, 1.0);
  vA = shade * (0.55 + a * 1.3) * (1.0 - depth * 0.5) * q.y * uGain;
  gl_Position = projectionMatrix * mv;
}`;
const BRAIN_FS_L = `
varying vec3 vCol; varying float vA;
void main(){ gl_FragColor = vec4(vCol, vA); }`;
const BRAIN_VS_P = `
attribute vec3 col; attribute float grp; attribute float sz; attribute float ph;
uniform vec2 af[48]; uniform float uMono; uniform float uTime; uniform float uPx; uniform float uFade; uniform float uGain;
varying vec3 vCol; varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec2 q = af[int(grp + 0.5)];
  float a = clamp(q.x, 0.0, 1.5);
  float tw = 0.62 + 0.38 * sin(uTime * (0.9 + ph * 2.2) + ph * 40.0);
  vec3 silver = vec3(0.86, 0.9, 0.98);
  vCol = mix(mix(col, silver, uMono), col * 1.25 + 0.22, clamp(a, 0.0, 1.0) * (0.3 + 0.7 * uMono));
  float depth = clamp((-mv.z - uFade) / 5.0, 0.0, 1.0);
  vA = (0.42 + a * 1.1) * tw * (1.0 - depth * 0.55) * q.y * (0.4 + 0.6 * uGain);
  gl_PointSize = max(1.0, sz * uPx * (1.0 + a * 0.55) / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const PT_FS = `
uniform sampler2D map; varying vec3 vCol; varying float vA;
void main(){ vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vCol, t.a * vA); }`;
const SIG_VS = `
attribute vec3 col; attribute float sz; attribute float al;
uniform float uPx;
varying vec3 vCol; varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vCol = col; vA = al;
  gl_PointSize = sz <= 0.0 ? 0.0 : max(1.5, sz * uPx / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const STREAK_VS = `
attribute vec3 dir; attribute float r0; attribute float len; attribute float spd; attribute float endp;
uniform float uTime; uniform float uBoost;
varying float vA;
void main(){
  float span = 15.0;
  float r = 3.1 + mod(r0 + uTime * spd * (1.0 + uBoost * 2.5), span);
  float rr = r + endp * len * (1.0 + uBoost * 1.6);
  vA = smoothstep(3.1, 4.6, r) * (1.0 - smoothstep(11.0, 18.1, r)) * (0.25 + 0.75 * endp);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(dir * rr, 1.0);
}`;
const STREAK_FS = `
varying float vA;
void main(){ gl_FragColor = vec4(0.72, 0.84, 1.0, vA * 0.42); }`;

function randUnit(){ let x, y, z, d; do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; d = x * x + y * y + z * z; } while (d > 1 || d < .01); d = Math.sqrt(d); return new THREE.Vector3(x / d, y / d, z / d); }

function buildBrain(){
  SPRITE = spriteTexture();
  const V = THREE.Vector3;
  CL.push(new V(0, 0, 0));
  for (let i = 1; i <= 12; i++) { const a = secAng(i), r = 1.1 + (R() - .5) * .12; CL.push(new V(Math.cos(a) * r, Math.sin(a) * r, (i % 2 ? 1 : -1) * (.14 + R() * .26))); }
  const px = [], py = [], pz = [], ng = [], nc = [], ns = [], members = Array.from({length: NCL}, () => []);
  function addN(x, y, z, g, c, s){
    const r = Math.hypot(x, y, z), lim = 1.8;
    if (r > lim) { const k = (lim - R() * .12) / r; x *= k; y *= k; z *= k; }
    const i = px.length; px.push(x); py.push(y); pz.push(z); ng.push(g); nc.push(c); ns.push(s);
    if (g < NCL) members[g].push(i);
    return i;
  }
  for (let c = 0; c < NCL; c++) {
    const C = CL[c], chief = c === 0;
    const n = chief ? 620 : 380, sig = chief ? .2 : .14;
    for (let k = 0; k < (chief ? 5 : 3); k++) addN(C.x + rg() * .025, C.y + rg() * .025, C.z + rg() * .025, c, c, chief ? .09 : .068);
    const core = Math.round(n * .4);
    for (let k = 0; k < core; k++) addN(C.x + rg() * sig, C.y + rg() * sig, C.z + rg() * sig * .9, c, c, .016 + R() * .016);
    const nd = chief ? 18 : 11, per = Math.round((n - core) / nd);
    for (let d = 0; d < nd; d++) {
      const dir = randUnit(), len = chief ? .68 + R() * .6 : .32 + R() * .42;
      const perp = randUnit().cross(dir).normalize(), bend = (R() - .5) * .3;
      for (let k = 0; k < per; k++) {
        const u = Math.pow(R(), .8), off = Math.sin(u * Math.PI) * bend, j = .018 + .035 * u;
        addN(C.x + dir.x * len * u + perp.x * off + rg() * j, C.y + dir.y * len * u + perp.y * off + rg() * j, C.z + dir.z * len * u + perp.z * off + rg() * j, c, c, .012 + R() * .012);
      }
    }
  }
  // 背景灰质：中心更密，铺满整个球，让星云连成一片
  for (let k = 0; k < 4200; k++) {
    let x, y, z; do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; } while (x * x + y * y + z * z > 1);
    const dd = Math.hypot(x, y, z) || 1, rr = Math.pow(dd, 1.35) / dd;
    x *= 1.78 * rr; y *= 1.78 * rr; z *= 1.45 * rr;
    let best = 0, bd = 1e9;
    for (let c = 0; c < NCL; c++) { const d = (x - CL[c].x) ** 2 + (y - CL[c].y) ** 2 + (z - CL[c].z) ** 2; if (d < bd) { bd = d; best = c; } }
    addN(x, y, z, 13, best, .009 + R() * .011);
  }
  const N = px.length; NEU = N;
  NX = Float32Array.from(px); NY = Float32Array.from(py); NZ = Float32Array.from(pz); MEM = members;
  const ncol = i => { const c = AGC[nc[i]], k = ng[i] === 13 ? .72 : 1; return [c[0] * k, c[1] * k, c[2] * k]; };

  // 局部连接：空间网格找最近邻
  const CELL = .16, grid = new Map(), key = (a, b, c) => a + ',' + b + ',' + c;
  for (let i = 0; i < N; i++) { const k = key(Math.floor(px[i] / CELL), Math.floor(py[i] / CELL), Math.floor(pz[i] / CELL)); let arr = grid.get(k); if (!arr) grid.set(k, arr = []); arr.push(i); }
  const seen = new Set(), LP = [], LC = [], LG = [], LS = [];
  function seg(x1, y1, z1, x2, y2, z2, c1, c2, g, s){ LP.push(x1, y1, z1, x2, y2, z2); LC.push(c1[0], c1[1], c1[2], c2[0], c2[1], c2[2]); LG.push(g, g); LS.push(s, s); }
  let syn = 0;
  for (let i = 0; i < N; i++) {
    const gx = Math.floor(px[i] / CELL), gy = Math.floor(py[i] / CELL), gz = Math.floor(pz[i] / CELL);
    const K = 3, maxD = ng[i] === 13 ? .28 : .22, cand = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const arr = grid.get(key(gx + a, gy + b, gz + c)); if (!arr) continue;
      for (const j of arr) { if (j === i) continue; const d = (px[i] - px[j]) ** 2 + (py[i] - py[j]) ** 2 + (pz[i] - pz[j]) ** 2; if (d < maxD * maxD) cand.push([d, j]); }
    }
    cand.sort((p, q) => p[0] - q[0]);
    for (let n = 0; n < Math.min(K, cand.length); n++) {
      const j = cand[n][1], lo = Math.min(i, j), hi = Math.max(i, j), id = lo * N + hi;
      if (seen.has(id)) continue; seen.add(id);
      const same = ng[i] === ng[j] && ng[i] < NCL;
      seg(px[i], py[i], pz[i], px[j], py[j], pz[j], ncol(i), ncol(j), same ? ng[i] : 13, same ? .55 : .32);
      syn++;
    }
  }
  // 远程细丝：让网更密、更乱一点
  for (let k = 0; k < 12000; k++) {
    const i = (R() * N) | 0, j = (R() * N) | 0;
    const d = Math.hypot(px[i] - px[j], py[i] - py[j], pz[i] - pz[j]);
    if (d < .22 || d > .6) continue;
    seg(px[i], py[i], pz[i], px[j], py[j], pz[j], ncol(i), ncol(j), 13, .15); syn++;
  }
  // 突触束：工作流里相邻的两个智能体之间、CHIEF 到每条流程的第一棒
  const pairs = new Map(), addPair = (a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b), k = lo + '-' + hi; if (!pairs.has(k)) pairs.set(k, {a: lo, b: hi}); };
  WF.forEach(w => { addPair(0, w.path[0]); for (let k = 0; k < w.path.length - 1; k++) addPair(w.path[k], w.path[k + 1]); });
  [...pairs.values()].forEach((p, bi) => {
    const g = 14 + bi; if (g >= 48) return;
    const strands = [], ns2 = p.a === 0 ? 10 : 14;
    for (let s = 0; s < ns2; s++) {
      const i0 = members[p.a][(R() * members[p.a].length) | 0], i1 = members[p.b][(R() * members[p.b].length) | 0];
      const p0 = new V(px[i0], py[i0], pz[i0]), p1 = new V(px[i1], py[i1], pz[i1]);
      const mid = p0.clone().add(p1).multiplyScalar(.5);
      let c;
      if (p.a === 0) c = mid.clone().add(randUnit().multiplyScalar(.14));
      else { const m = Math.hypot(mid.x, mid.y) || .01, push = .17 + R() * .24 + (1 - Math.min(1, m / 1.2)) * .26; c = new V(mid.x + mid.x / m * push, mid.y + mid.y / m * push, mid.z + (R() - .5) * .5); }
      strands.push({p0, c, p1, len: p0.distanceTo(c) + c.distanceTo(p1)});
      const ca = AGC[p.a], cb = AGC[p.b], SEG = 12;
      let lx = p0.x, ly = p0.y, lz = p0.z;
      for (let k = 1; k <= SEG; k++) {
        const u = k / SEG, v = 1 - u;
        const x = v * v * p0.x + 2 * v * u * c.x + u * u * p1.x, y = v * v * p0.y + 2 * v * u * c.y + u * u * p1.y, z = v * v * p0.z + 2 * v * u * c.z + u * u * p1.z;
        const u0 = (k - 1) / SEG;
        seg(lx, ly, lz, x, y, z, [ca[0] + (cb[0] - ca[0]) * u0, ca[1] + (cb[1] - ca[1]) * u0, ca[2] + (cb[2] - ca[2]) * u0], [ca[0] + (cb[0] - ca[0]) * u, ca[1] + (cb[1] - ca[1]) * u, ca[2] + (cb[2] - ca[2]) * u], g, .16);
        lx = x; ly = y; lz = z;
      }
      syn++;
    }
    const b = {a: p.a, b: p.b, g, strands}; BUN.push(b); BMAP[p.a + '-' + p.b] = b;
  });
  SYN = syn;

  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(LP, 3));
  lg.setAttribute('col', new THREE.Float32BufferAttribute(LC, 3));
  lg.setAttribute('grp', new THREE.Float32BufferAttribute(LG, 1));
  lg.setAttribute('shade', new THREE.Float32BufferAttribute(LS, 1));
  const uni = {af: {value: AF}, uMono: {value: 0}, uFade: {value: 8}, uTime: {value: 0}, uPx: {value: 800}, uGain: {value: 1}, map: {value: SPRITE}};
  brainLines = new THREE.LineSegments(lg, new THREE.ShaderMaterial({uniforms: uni, vertexShader: BRAIN_VS_L, fragmentShader: BRAIN_FS_L, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
  spin.add(brainLines);

  const pg = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), col = new Float32Array(N * 3), grp = new Float32Array(N), sz = new Float32Array(N), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = px[i]; pos[i * 3 + 1] = py[i]; pos[i * 3 + 2] = pz[i]; const c = ncol(i); col.set(c, i * 3); grp[i] = ng[i]; sz[i] = ns[i]; ph[i] = R(); }
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('col', new THREE.BufferAttribute(col, 3));
  pg.setAttribute('grp', new THREE.BufferAttribute(grp, 1)); pg.setAttribute('sz', new THREE.BufferAttribute(sz, 1)); pg.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  brainPts = new THREE.Points(pg, new THREE.ShaderMaterial({uniforms: uni, vertexShader: BRAIN_VS_P, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
  spin.add(brainPts);

  // 信号脉冲：一个点缓冲，头亮尾暗
  const SIGN = 4000;
  sigGeo = new THREE.BufferGeometry();
  sigGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SIGN * 3), 3).setUsage(THREE.DynamicDrawUsage));
  sigGeo.setAttribute('col', new THREE.BufferAttribute(new Float32Array(SIGN * 3), 3).setUsage(THREE.DynamicDrawUsage));
  sigGeo.setAttribute('sz', new THREE.BufferAttribute(new Float32Array(SIGN), 1).setUsage(THREE.DynamicDrawUsage));
  sigGeo.setAttribute('al', new THREE.BufferAttribute(new Float32Array(SIGN), 1).setUsage(THREE.DynamicDrawUsage));
  sigMat = new THREE.ShaderMaterial({uniforms: {map: {value: SPRITE}, uPx: uni.uPx}, vertexShader: SIG_VS, fragmentShader: PT_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending});
  const sp = new THREE.Points(sigGeo, sigMat); sp.frustumCulled = false; spin.add(sp);
  trGeo = new THREE.BufferGeometry();
  trGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6000 * 6), 3).setUsage(THREE.DynamicDrawUsage));
  trGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(6000 * 6), 3).setUsage(THREE.DynamicDrawUsage));
  trGeo.setDrawRange(0, 0);
  const tl = new THREE.LineSegments(trGeo, new THREE.LineBasicMaterial({vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false}));
  tl.frustumCulled = false; spin.add(tl);

  probe.p = new V(CL[3].x, CL[3].y, CL[3].z + .12); probe.a = probe.p.clone(); probe.b = probe.p.clone(); probe.c = probe.p.clone();
}

/* ---------- HUD 星环 ---------- */
function lineMat(op, col){ return new THREE.LineBasicMaterial({color: col || 0xd4e8ff, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false}); }
function circle(r, z, op, seg = 320){ const a = new Float32Array(seg * 3); for (let i = 0; i < seg; i++) { const t = i / seg * TAU; a[i * 3] = Math.cos(t) * r; a[i * 3 + 1] = Math.sin(t) * r; a[i * 3 + 2] = z; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); return new THREE.LineLoop(g, lineMat(op)); }
function ticks(r, n, len, every, long, op){ const a = []; for (let i = 0; i < n; i++) { const t = i / n * TAU, l = i % every === 0 ? long : len; a.push(Math.cos(t) * r, Math.sin(t) * r, 0, Math.cos(t) * (r + l), Math.sin(t) * (r + l), 0); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); return new THREE.LineSegments(g, lineMat(op)); }
function arcs(r, list, op){ const a = []; list.forEach(([t0, t1]) => { const n = Math.max(4, Math.round((t1 - t0) / .02)); for (let i = 0; i < n; i++) { const u0 = t0 + (t1 - t0) * i / n, u1 = t0 + (t1 - t0) * (i + 1) / n; a.push(Math.cos(u0) * r, Math.sin(u0) * r, 0, Math.cos(u1) * r, Math.sin(u1) * r, 0); } }); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); return new THREE.LineSegments(g, lineMat(op)); }
function polarRing(r0, r1, seg, tex, op){
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) { const t = i / seg * TAU, u = 1 - i / seg; pos.push(Math.cos(t) * r0, Math.sin(t) * r0, 0, Math.cos(t) * r1, Math.sin(t) * r1, 0); uv.push(u, 0, u, 1); }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({map: tex, transparent: true, opacity: op == null ? 1 : op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
}
const RW = 4096, RH = 112, TW = 4096, TH = 32;
const uOf = th => { let u = 1 - th / TAU; return ((u % 1) + 1) % 1; };

function buildHud(){
  hud = new THREE.Group(); world.add(hud);
  hud.add(circle(1.9, 0, .55)); hud.add(circle(1.885, 0, .2));
  tickA = ticks(1.915, 240, .016, 10, .034, .55); hud.add(tickA);
  // 写入头：条码环正上方的小三角
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.962, .01, -.022, 1.94, .01, .022, 1.94, .01], 3));
    hud.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({color: 0xa6f1ff, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}))); }
  // 条码块环：72 块 × 6 道，每块是 1.4 秒的 token 量；新数据从正上方写入，顺时针流走
  {
    const NST = 6, SEG_A = TAU / NSEG, w = SEG_A * .58, pos = [], col = [], idx = [];
    for (let s = 0; s < NSEG; s++) for (let k = 0; k < NST; k++) {
      const a0 = Math.PI / 2 + s * SEG_A - w / 2, a1 = a0 + w, r0 = 1.965 + k * .033, r1 = r0 + .02, b = pos.length / 3;
      pos.push(Math.cos(a0) * r0, Math.sin(a0) * r0, 0, Math.cos(a1) * r0, Math.sin(a1) * r0, 0, Math.cos(a0) * r1, Math.sin(a0) * r1, 0, Math.cos(a1) * r1, Math.sin(a1) * r1, 0);
      for (let q = 0; q < 4; q++) col.push(.1, .1, .1);
      idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage)); g.setIndex(idx);
    barcode = new THREE.Mesh(g, new THREE.MeshBasicMaterial({vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide}));
    hud.add(barcode);
  }
  // 圆柱框：让环有厚度
  hud.add(circle(2.165, .12, .3)); hud.add(circle(2.165, -.12, .3));
  { const a = []; for (let i = 0; i < 90; i++) { const t = i / 90 * TAU; a.push(Math.cos(t) * 2.165, Math.sin(t) * 2.165, .12, Math.cos(t) * 2.165, Math.sin(t) * 2.165, -.12); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); hud.add(new THREE.LineSegments(g, lineMat(.14))); }
  // 雷达扫描弧
  { const n = 60, a = [], c = []; for (let i = 0; i < n; i++) { const t0 = i / n * .75, t1 = (i + 1) / n * .75; a.push(Math.cos(t0) * 1.87, Math.sin(t0) * 1.87, .005, Math.cos(t1) * 1.87, Math.sin(t1) * 1.87, .005); const k = Math.pow(i / n, 2.2); c.push(.65 * k, .95 * k, 1 * k, .65 * k, .95 * k, 1 * k); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    sweep = new THREE.LineSegments(g, new THREE.LineBasicMaterial({vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false})); hud.add(sweep); }
  // 文字带：滚动执行记录
  const tc = document.createElement('canvas'); tc.width = TW; tc.height = TH; tapeCtx = tc.getContext('2d');
  tapeTex = new THREE.CanvasTexture(tc); tapeTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tapeRing = polarRing(2.18, 2.28, 360, tapeTex, .85); tapeRing.position.z = .03; hud.add(tapeRing);
  // 扇区 + 通道环（静止）
  const rc = document.createElement('canvas'); rc.width = RW; rc.height = RH; ringCtx = rc.getContext('2d');
  ringTex = new THREE.CanvasTexture(rc); ringTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  ringRing = polarRing(2.31, 2.69, 512, ringTex, 1); ringRing.position.z = -.04; spin.add(ringRing);
  // 虚线轨
  { const dc = document.createElement('canvas'); dc.width = 2048; dc.height = 8; const x = dc.getContext('2d'); x.fillStyle = '#fff';
    for (let px = 0; px < 2048;) { const w = 4 + R() * 40, gap = 3 + R() * 22; if (R() < .82) { x.globalAlpha = .3 + R() * .6; x.fillRect(px, 1, w, 6); } px += w + gap; }
    const dt = new THREE.CanvasTexture(dc); dashRing = polarRing(2.71, 2.73, 360, dt, .55); dashRing.position.z = -.07; hud.add(dashRing); }
  tickB = ticks(2.765, 360, .015, 10, .035, .42); tickB.position.z = -.1; hud.add(tickB);
  hud.add(circle(2.76, -.1, .25));
  arcsA = arcs(2.85, [[.1, .9], [1.3, 1.5], [2.2, 3.4], [3.9, 4.2], [4.6, 5.8]], .45); arcsA.position.z = -.14; hud.add(arcsA);
  arcsB = arcs(2.91, [[.5, .62], [1.0, 2.1], [2.7, 2.8], [3.2, 4.4], [5.1, 5.3], [5.6, 6.1]], .3); arcsB.position.z = -.18; hud.add(arcsB);
  // 通道落点：交付光束打到这里会闪
  CH.forEach((ch, j) => {
    const p = new THREE.Vector3(Math.cos(chanAng[j]) * 2.614, Math.sin(chanAng[j]) * 2.614, -.04);
    chanPos.push(p);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({map: SPRITE, color: new THREE.Color(ch.col), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false}));
    s.position.copy(p); s.scale.setScalar(.1); spin.add(s); chanSpr.push(s);
  });
  // 中心核：CHIEF 越忙越亮
  coreSpr = new THREE.Sprite(new THREE.SpriteMaterial({map: SPRITE, color: 0xcfe0ff, transparent: true, opacity: .16, blending: THREE.AdditiveBlending, depthWrite: false}));
  coreSpr.scale.setScalar(2.5); world.add(coreSpr);
  // 流星命中点的闪光
  for (let k = 0; k < 16; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: SPRITE, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false})); sp.visible = false; hud.add(sp); hits.push({s: sp, t: 9}); }
  // 巡检扫描圈
  for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.RingGeometry(.93, 1, 64), new THREE.MeshBasicMaterial({color: 0x45e6f5, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide})); m.visible = false; spin.add(m); scans.push({m, t: 9}); }
}

function buildSky(){
  // 速度线：从环外往远处飞，交付时加速
  const n = 300, dir = [], r0 = [], len = [], spd = [], endp = [], pos = [];
  for (let i = 0; i < n; i++) {
    let d; if (R() < .78) { const t = R() * TAU, e = (R() - .5) * .9; d = [Math.cos(t) * Math.cos(e), Math.sin(t) * Math.cos(e), Math.sin(e)]; } else { const u = randUnit(); d = [u.x, u.y, u.z]; }
    const r = R() * 15, l = .2 + R() * .9, s = .25 + R() * .7;
    for (let e = 0; e < 2; e++) { dir.push(...d); r0.push(r); len.push(l); spd.push(s); endp.push(e); pos.push(0, 0, 0); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('dir', new THREE.Float32BufferAttribute(dir, 3));
  g.setAttribute('r0', new THREE.Float32BufferAttribute(r0, 1)); g.setAttribute('len', new THREE.Float32BufferAttribute(len, 1));
  g.setAttribute('spd', new THREE.Float32BufferAttribute(spd, 1)); g.setAttribute('endp', new THREE.Float32BufferAttribute(endp, 1));
  streaks = new THREE.LineSegments(g, new THREE.ShaderMaterial({uniforms: {uTime: {value: 0}, uBoost: {value: 0}}, vertexShader: STREAK_VS, fragmentShader: STREAK_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
  streaks.frustumCulled = false; scene.add(streaks);
  const dn = 1400, dp = new Float32Array(dn * 3);
  for (let i = 0; i < dn; i++) { const u = randUnit(), r = 7 + R() * 26; dp[i * 3] = u.x * r; dp[i * 3 + 1] = u.y * r; dp[i * 3 + 2] = u.z * r; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  dust = new THREE.Points(dg, new THREE.PointsMaterial({size: .06, map: SPRITE, color: 0x7f93b0, transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true}));
  scene.add(dust);
}

/* ---------- 建场景（WebGL 不可用时只跑面板） ---------- */
try {
  if (!THREE) throw new Error('three.js 没加载');
  renderer = new THREE.WebGLRenderer({canvas: cv, antialias: true, powerPreference: 'high-performance'});
  renderer.setClearColor(0x03050a, 1);
  pr = Math.min(window.devicePixelRatio || 1, 1.75);
  /* 大屏起步降档（2026-10-24）：CSS 面积超 300 万像素（如 2560×1440
   * 及上）时起步 pr 不超 1——否则满载缓冲 + 辉光开局即卡，降档链
   * 要 9 秒以上才追得上。1920×1080 及下不受影响。 */
  try {
    if (host.clientWidth * host.clientHeight > 3000000) pr = Math.min(pr, 1);
  } catch (e) {}
  renderer.setPixelRatio(pr);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 16 / 9, .05, 200);
  camera.position.set(0, 0, 10);
  world = new THREE.Group(); scene.add(world);
  spin = new THREE.Group(); world.add(spin);
  buildBrain();
  buildHud();
  buildSky();
  if (THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass) {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(512, 512), .62, .42, .3);
    composer.addPass(bloomPass);
  } else bloomOn = false;
  glOK = true;
} catch (e) {
  console.error(e);
  $('#glFail').hidden = false;
}

/* ---------- 信号 ---------- */
const tmpV = glOK ? new THREE.Vector3() : null, tmpW = glOK ? new THREE.Vector3() : null;
function sendSignal(a, b, colHex, cb, kind){
  rateCur++;
  lastHand = {a, b, col: colHex, t: 3};
  if (!glOK) { setTimeout(cb, 1100); return; }
  const bun = BMAP[Math.min(a, b) + '-' + Math.max(a, b)];
  const col = hex3(colHex);
  if (!bun) {
    const A = CL[a].clone(), B = CL[b].clone();
    signals.push({kind, path: (u, o) => o.lerpVectors(A, B, u), u: 0, dur: 1.2, col, cb, tr: 9, gap: .022, head: .085, bun: -1, to: b});
    return;
  }
  const s = bun.strands[(Math.random() * bun.strands.length) | 0], fwd = bun.a === a;
  const path = (u, o) => { const t = fwd ? u : 1 - u, v = 1 - t; o.set(v * v * s.p0.x + 2 * v * t * s.c.x + t * t * s.p1.x, v * v * s.p0.y + 2 * v * t * s.c.y + t * t * s.p1.y, v * v * s.p0.z + 2 * v * t * s.c.z + t * t * s.p1.z); };
  signals.push({kind, path, u: 0, dur: clamp(s.len / 1.5, .8, 1.8), col, cb, tr: 10, gap: .024, head: kind === 'bad' ? .1 : .085, bun: bun.g, to: b});
}
function sendRay(ai, ch){
  rateCur++;
  chanN[ch]++;
  if (!glOK) return;
  const A = CL[ai].clone(), M = chanPos[ch].clone(), F = M.clone().multiplyScalar(2.3);
  signals.push({kind: 'ray', path: (u, o) => { if (u < .5) o.lerpVectors(A, M, u / .5); else o.lerpVectors(M, F, (u - .5) / .5); },
    u: 0, dur: 1.9, col: hex3(CH[ch].col), cb: null, tr: 14, gap: .018, head: .1, bun: -1, to: -1, mid: .5, onMid: () => { chanFlash[ch] = 1; }});
  meteorBurst(ai, ch);
}
function scanAt(k){
  if (!glOK) return;
  const s = scans.find(q => q.t > 1.2) || scans[0];
  s.t = 0; s.m.visible = true; s.m.position.copy(CL[k]);
}

/* ---------- 算力粒子：忙碌的智能体之间来回跑的小光点 + 冲出星环的流星 ---------- */
// m=0 团内火花（直线）、m=1 突触束上的算力流（沿束弯曲）、m=2 流星（从神经团冲出星环外）
const PMAX = 1800;
// 背景粒子密度：0 = 第一版的样子（只有任务脉冲）。想更热闹就把数字调大，比如 {chatter: 20, spark: 10, meteor: 1.2, burst: 2}
const AMBIENT = {chatter: 0, spark: 0, meteor: 0, burst: 0};
const parts = Array.from({length: PMAX}, () => ({on: false, m: 0, ax: 0, ay: 0, az: 0, cx: 0, cy: 0, cz: 0, bx: 0, by: 0, bz: 0, u: 0, dur: 1, col: [1, 1, 1], sz: .03, al: 1, tr: 4, gap: .03}));
let pFree = 0, partAlive = 0, partScale = 1, chatAcc = 0, sparkAcc = 0, metAcc = 0;
const busy = i => i === 0 || !!AG[i].cur;
const whiten = (c, k) => [c[0] + (1 - c[0]) * k, c[1] + (1 - c[1]) * k, c[2] + (1 - c[2]) * k];
function pGet(){ for (let n = 0; n < PMAX; n++) { const i = (pFree + n) % PMAX; if (!parts[i].on) { pFree = (i + 1) % PMAX; parts[i].on = true; parts[i].u = 0; return parts[i]; } } return null; }
function busyList(){ const l = []; for (let i = 0; i < NCL; i++) if (busy(i)) l.push(i); return l; }
function spawnChatter(){
  // 挑一条两端至少有一个在忙的突触束，从忙的那头往外送
  let b = null;
  for (let t = 0; t < 6; t++) { const q = BUN[(Math.random() * BUN.length) | 0]; if (busy(q.a) || busy(q.b)) { b = q; break; } }
  if (!b) b = BUN[(Math.random() * BUN.length) | 0];
  const s = b.strands[(Math.random() * b.strands.length) | 0], fwd = busy(b.a) && (!busy(b.b) || Math.random() < .5);
  const p = pGet(); if (!p) return;
  const A = fwd ? s.p0 : s.p1, B = fwd ? s.p1 : s.p0;
  p.m = 1; p.ax = A.x; p.ay = A.y; p.az = A.z; p.cx = s.c.x; p.cy = s.c.y; p.cz = s.c.z; p.bx = B.x; p.by = B.y; p.bz = B.z;
  p.dur = clamp(s.len / rnd(1.9, 3.4), .35, 1.2); p.col = whiten(AGC[fwd ? b.a : b.b], .22); p.sz = rnd(.05, .075); p.al = rnd(.7, 1); p.tr = 6; p.gap = .04;
}
function spawnSpark(l){
  const c = l.length ? l[(Math.random() * l.length) | 0] : 0, mem = MEM[c];
  const i0 = mem[(Math.random() * mem.length) | 0], i1 = mem[(Math.random() * mem.length) | 0];
  const p = pGet(); if (!p) return;
  p.m = 0; p.ax = NX[i0]; p.ay = NY[i0]; p.az = NZ[i0]; p.bx = NX[i1]; p.by = NY[i1]; p.bz = NZ[i1];
  p.dur = rnd(.25, .6); p.col = whiten(AGC[c], .35); p.sz = rnd(.04, .06); p.al = rnd(.6, 1); p.tr = 3; p.gap = .06;
}
function spawnMeteor(c, ang){
  const p = pGet(); if (!p) return;
  const C = CL[c], th = ang != null ? ang + rnd(-.28, .28) : (c === 0 ? Math.random() * TAU : Math.atan2(C.y, C.x) + rnd(-.6, .6));
  const ox = C.x + rnd(-.18, .18), oy = C.y + rnd(-.18, .18), oz = C.z + rnd(-.15, .15);
  const ez = rnd(-.35, .35), L = rnd(4.6, 7.2), dx = Math.cos(th) * Math.cos(ez), dy = Math.sin(th) * Math.cos(ez), dz = Math.sin(ez), bend = rnd(-.5, .5);
  p.m = 2; p.ax = ox; p.ay = oy; p.az = oz; p.bx = ox + dx * L; p.by = oy + dy * L; p.bz = oz + dz * L;
  p.cx = ox + dx * L * .5 - dy * bend; p.cy = oy + dy * L * .5 + dx * bend; p.cz = oz + dz * L * .5;
  p.dur = rnd(1.3, 2.3); p.col = whiten(AGC[c], .12); p.sz = rnd(.08, .11); p.al = 1; p.tr = 12; p.gap = .018; p.lr = 0; p.hit = false;
}
function hitRing(th, col){
  // 世界角度换成能量格自己的格子编号（能量格本身在转）
  const local = th - barcode.rotation.z - Math.PI / 2, SA = TAU / NSEG;
  const s0 = ((Math.round(local / SA) % NSEG) + NSEG) % NSEG;
  [[0, 1], [-1, .45], [1, .45]].forEach(([d, k]) => { const s = (s0 + d + NSEG) % NSEG; if (k >= segFlash[s]) { segFlash[s] = k; segCol[s] = col; } });
  const h = hits.find(q => q.t >= .55) || hits[0];
  if (!h) return;
  h.t = 0; h.s.visible = true; h.s.material.color.setRGB(col[0], col[1], col[2]);
  h.s.position.set(Math.cos(th) * HIT_R, Math.sin(th) * HIT_R, .02);
}
function meteorBurst(c, ch){ if (!glOK) return; for (let k = 0; k < AMBIENT.burst; k++) spawnMeteor(c, chanAng[ch]); }
function partStep(dt){
  if (!glOK) return;
  const live = liveN(), l = busyList();
  chatAcc += dt * AMBIENT.chatter * (1 + .2 * live) * partScale;
  sparkAcc += dt * AMBIENT.spark * (1 + .2 * live) * partScale;
  metAcc += dt * AMBIENT.meteor * (1 + .2 * live) * partScale;
  for (; chatAcc >= 1; chatAcc--) spawnChatter();
  for (; sparkAcc >= 1; sparkAcc--) spawnSpark(l);
  for (; metAcc >= 1; metAcc--) spawnMeteor(l.length ? l[(Math.random() * l.length) | 0] : 0);
  let n = 0;
  for (const p of parts) {
    if (!p.on) continue;
    p.u += dt / p.dur;
    if (p.m === 2 && !p.hit && p.u <= 1) {
      pEval(p, p.u, tmpV);
      const r = Math.hypot(tmpV.x, tmpV.y);
      if (p.lr < HIT_R && r >= HIT_R) { p.hit = true; hitRing(Math.atan2(tmpV.y, tmpV.x) + spin.rotation.z, p.col); }
      p.lr = r;
    }
    if (p.u >= 1 + p.tr * p.gap) p.on = false; else n++;
  }
  partAlive = n;
}
function pEval(p, u, o){
  if (p.m === 0) { o.set(p.ax + (p.bx - p.ax) * u, p.ay + (p.by - p.ay) * u, p.az + (p.bz - p.az) * u); return; }
  const v = 1 - u;
  o.set(v * v * p.ax + 2 * v * u * p.cx + u * u * p.bx, v * v * p.ay + 2 * v * u * p.cy + u * u * p.by, v * v * p.az + 2 * v * u * p.cz + u * u * p.bz);
}

/* ---------- 镜头 ---------- */
const MODES = [{id: 'orbit', zh: '环绕'}, {id: 'front', zh: '正视'}, {id: 'tilt', zh: '斜看'}, {id: 'close', zh: '贴近'}];
let modeI = 0;
const cam = glOK ? {pos: new THREE.Vector3(0, .4, 14), tgt: new THREE.Vector3(), want: new THREE.Vector3(), wantT: new THREE.Vector3(), yaw: 0, pitch: 0, zoom: 1, userT: 0} : null;
let fitD = 10, W = 1, H = 1, narrow = false, bs = .5, sizeGain = 1;
function camWant(t){
  const D = fitD * cam.zoom;
  let az = 0, el = 0, r = D, tx = 0, ty = 0;
  switch (MODES[modeI].id) {
    case 'orbit': az = .42 * Math.sin(t * .07); el = .2 + .12 * Math.sin(t * .051); break;
    case 'front': az = .03 * Math.sin(t * .13); el = .025 * Math.cos(t * .11); break;
    case 'tilt':  az = .8 + .06 * Math.sin(t * .09); el = .28 + .05 * Math.sin(t * .07); r = D; tx = -.15; ty = .14; break;
    case 'close': az = 1.02 + .12 * Math.sin(t * .05); el = -.16 + .07 * Math.sin(t * .07); r = D * .45; tx = 1.1; ty = .35; break;
  }
  az += cam.yaw; el = clamp(el + cam.pitch, -1.25, 1.25);
  cam.want.set(r * Math.sin(az) * Math.cos(el) + tx, r * Math.sin(el) + ty, r * Math.cos(az) * Math.cos(el));
  cam.wantT.set(tx, ty, 0);
}

/* ================= 4. DOM 面板 ================= */
const nr = $('#nr'), board = $('#board'), fitIn = $('#fitIn');
const clsEl = $('#cls'), feedEl = $('#feed'), tip = $('#tip');
const rows = AG.map((a, i) => {
  const el = document.createElement('div');
  el.className = 'cl idle'; el.style.setProperty('--c', a.col);
  el.innerHTML = `<span class="sw"></span><b class="k">${a.k}</b><span class="z">${a.zh} · ${a.role}</span><span class="pc">—</span><span class="bar"><i></i></span><span class="st">—</span>`;
  clsEl.appendChild(el);
  return {el, pc: el.querySelector('.pc'), bar: el.querySelector('.bar i'), st: el.querySelector('.st')};
});
let rowY = AG.map((_, i) => 31 + i * 48 + 22);                  // 每行中心的 y，布局变了会重新量
$('#ltMeta').textContent = `${NCL} 团 + 1 探针 · ${fmt(NEU)} 神经元`;

function renderList(){
  AG.forEach((a, i) => {
    const r = rows[i];
    let cls = 'cl', pc = '—', w = 0, st = '';
    if (i === 0) {
      cls += ' work'; pc = 'Q' + queueTotal(); w = 1 - clamp(chiefT / chiefDur, 0, 1);
      st = `派单 ${lastDispatch} · 在途 ${inFlight()} · 下一单 ${Math.max(0, chiefT).toFixed(1)}s`;
    } else if (i === CRAWLER) {
      cls += ' work'; pc = String(crawl.patrols); w = probe.u < 1 ? probe.u : 1 - clamp(probe.dwell / 3, 0, 1);
      st = `${probe.u < 1 ? '飞往' : '扫描'} ${AG[crawl.target].k} · 已读 ${fmt(crawl.read)} 页`;
    } else if (a.mode === 'offline') {
      cls += ' idle off'; pc = '0'; st = 'OFFLINE · 未通电';
    } else if (a.mode === 'standby') {
      cls += ' idle'; pc = '0'; st = 'STANDBY · 零条目待填装';
    } else if (a.mode === 'mirror' && !a.cur && !a.inbox.length) {
      cls += ' idle'; pc = 'M' + a.n; st = `镜像 ${a.n} 行 · 不计入实体`;
    } else if (a.cur) {
      cls += ' work'; pc = Math.round(a.prog * 100) + '%'; w = a.prog;
      st = `${a.cur.id} ${a.cur.name}${a.cur.rework ? ' · 返工 ' + a.cur.rework : ''}${a.inbox.length ? ' · 排队 ' + a.inbox.length : ''}`;
    } else if (a.inbox.length) { cls += ' idle'; pc = 'Q' + a.inbox.length; st = `排队 ${a.inbox.length} · 下一个 ${a.inbox[0].id}`; }
    else { cls += ' idle'; pc = String(a.n); st = `${a.n} 条 · 待调度`; }
    if (a.hitT > 0) cls += ' hit';
    if (focus === i) cls += ' foc';
    if (r.el.className !== cls) r.el.className = cls;
    r.pc.textContent = pc; r.bar.style.width = (w * 100).toFixed(1) + '%'; r.st.textContent = st;
  });
  const p = $('#connP');
  if (lastHand && lastHand.t > 0) {
    const y1 = rowY[lastHand.a], y2 = rowY[lastHand.b], bulge = 18 + Math.abs(y2 - y1) * .09;
    p.setAttribute('d', `M2 ${y1} C ${2 + bulge} ${y1}, ${2 + bulge} ${y2}, 2 ${y2}`);
    p.setAttribute('stroke', lastHand.col); p.setAttribute('opacity', String(clamp(lastHand.t, 0, 1)));
  } else p.setAttribute('opacity', '0');
}
function renderFeed(){
  feedDirty = false;
  const n = Math.max(6, Math.floor(feedEl.clientHeight / 15));
  feedEl.innerHTML = feed.slice(0, n).map(e => `<li class="${e.kind}"><time>${e.t}</time><b style="color:${AG[e.a].col}">${AG[e.a].k}</b><em>${e.verb}</em><span>${e.text}</span></li>`).join('');
}
function renderCap(){
  capDirty = false;
  const c = caption, a = AG[c.a];
  $('#cap').className = 'cap ' + c.kind;
  $('#capK').textContent = a.k; $('#capK').style.color = a.col;
  $('#capV').textContent = c.verb; $('#capT').textContent = c.text;
  $('#mCap').innerHTML = `<b style="color:${a.col}">${a.k}</b>${c.verb} · ${c.text}`;
}
const heatCv = $('#heat'), heatX = heatCv.getContext('2d');
const sparkCv = $('#spark'), sparkX = sparkCv.getContext('2d');
// 画板被整体缩放过，按「缩放后的实际像素」出图才清楚
function sizeCv(cv, x){ const w = cv.clientWidth || 1, h = cv.clientHeight || 1, k = clamp((window.devicePixelRatio || 1) * bs, 1, 3); cv.width = Math.round(w * k); cv.height = Math.round(h * k); x.setTransform(k, 0, 0, k, 0, 0); return [w, h]; }
let heatWH = [1, 1], sparkWH = [1, 1];
function heatCol(v){
  // 暗 → 冰蓝 → 琥珀：越烧 token 越热
  if (v < .04) return 'rgba(186,212,240,.05)';
  if (v < 1) { const k = v; return `rgba(${Math.round(30 + 136 * k)},${Math.round(70 + 171 * k)},${Math.round(100 + 155 * k)},${(.25 + .65 * k).toFixed(2)})`; }
  const k = clamp(v - 1, 0, .5) * 2; return `rgb(${Math.round(166 + 89 * k)},${Math.round(241 - 60 * k)},${Math.round(255 - 184 * k)})`;
}
function renderHeat(){
  const [w, h] = heatWH, x = heatX, lw = 62, cols = HEATN + 1, cw = (w - lw - 6) / cols, rh = (h - 22) / 12;
  x.clearRect(0, 0, w, h);
  x.font = `700 9.5px ${MONO}`; x.textBaseline = 'middle';
  for (let r = 0; r < 12; r++) {
    const a = AG[r + 1], y = r * rh;
    x.fillStyle = a.cur ? a.col : '#6b7685'; x.fillText(a.k, 0, y + rh / 2);
    for (let c = 0; c < cols; c++) {
      const v = c < HEATN ? heat[r][c] : (heatCur[r] / (TOKR[r + 1] * Math.max(.3, heatAcc)));
      x.fillStyle = heatCol(v);
      x.fillRect(lw + c * cw + 1, y + 1.5, cw - 2.5, rh - 3);
    }
  }
  x.strokeStyle = 'rgba(166,241,255,.8)'; x.lineWidth = 1;
  x.strokeRect(lw + HEATN * cw + .5, .5, cw - 1.5, 12 * rh - 1);
  x.font = `500 8.5px ${MONO}`; x.fillStyle = '#6b7685'; x.textAlign = 'left';
  x.fillText('-30s', lw, h - 8); x.textAlign = 'right'; x.fillStyle = '#a6f1ff'; x.fillText('NOW', w - 6, h - 8); x.textAlign = 'left';
  x.fillStyle = '#6b7685'; x.fillText('token / 满速', lw + cw * 4, h - 8);
}
function renderSpark(){
  const [w, h] = sparkWH, x = sparkX, n = rateBins.length, mx = Math.max(6, ...rateBins);
  x.clearRect(0, 0, w, h);
  x.strokeStyle = 'rgba(186,212,240,.12)'; x.lineWidth = 1;
  for (let k = 1; k < 3; k++) { x.beginPath(); x.moveTo(0, h * k / 3 + .5); x.lineTo(w, h * k / 3 + .5); x.stroke(); }
  const pt = i => [i / (n - 1) * (w - 4), h - 3 - rateBins[i] / mx * (h - 8)];
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(166,241,255,.28)'); g.addColorStop(1, 'rgba(166,241,255,0)');
  x.beginPath(); x.moveTo(0, h); for (let i = 0; i < n; i++) x.lineTo(...pt(i)); x.lineTo(w - 4, h); x.closePath(); x.fillStyle = g; x.fill();
  x.beginPath(); for (let i = 0; i < n; i++) { const [px, py] = pt(i); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.strokeStyle = '#a6f1ff'; x.lineWidth = 1.2; x.stroke();
  const [ex, ey] = pt(n - 1); x.fillStyle = '#fff'; x.beginPath(); x.arc(ex, ey, 2.4, 0, TAU); x.fill();
}
let fps = 60, fpsN = 0, fpsT = 0, lowT = 0, autoNote = '';
function renderBottom(){
  $('#bTopo').innerHTML = `${fmt(SYN)}<small>突触</small>`;
  $('#bTopoS').innerHTML = `<b>${fmt(NEU)}</b> 神经元 · <b>${NCL}</b> 团 · <b>${BUN.length}</b> 束 · 场景几何`;
  $('#bRate').innerHTML = `${rateBins[rateBins.length - 1]}<small>次/秒</small>`;
  /* 槽 3 · ENTRIES：真实条目数 / 行数，镜像已去重（不再走时钟累加器） */
  const E = (DATA && DATA.mainEntities) || 0, R = (DATA && DATA.mainRows) || 0;
  $('#bOut').textContent = fmt(E);
  $('#bOutS').innerHTML = `实体 · <b>${R}</b> 行 · 同第一主题口径`;
  $('#bOutBar').style.width = (R > 0 ? Math.min(1, E / R) * 100 : 0).toFixed(1) + '%';
  /* 槽 4 · ONLINE：12 个数据面里几个真有数据 */
  const L = (DATA && DATA.liveN) || 0, SB = (DATA && DATA.standbyN) || 0, OF = (DATA && DATA.offlineN) || 0;
  $('#bPass').textContent = `${L}/12`;
  $('#bPassS').innerHTML = `在线 <b>${L}</b> · 待命 <b>${SB}</b> · 未通电 <b>${OF}</b>`;
  /* 槽 5 · SESSION：挂载起算的真实时长，不再冒充 token 吞吐 */
  $('#bTok').textContent = hmsSince(bootAt);
  $('#bTokS').innerHTML = `挂载起算 · 只读消费 · 未接模型`;
  $('#bFps').innerHTML = glOK ? `${fps}<small>fps</small>` : '—';
  $('#bFpsS').innerHTML = glOK ? `${MODES[modeI].zh} · DPR <b>${pr.toFixed(2)}</b>${autoNote}` : 'WebGL 不可用';
  $('#bRateS').innerHTML = `派单 · 交接 · 打回 · 交付 · 在飞 <b>${inFlight()}</b>`;
  $('#cwP').textContent = fmt(crawl.patrols); $('#cwR').textContent = fmt(crawl.read); $('#cwB').textContent = zeroFaces(); $('#cwF').textContent = fmt(crawl.patrols ? Math.round(crawl.read / crawl.patrols) : 0);
  const ta = AG[crawl.target];
  $('#cwNow').innerHTML = `<b>${probe.u < 1 ? '飞往' : '正在看'}</b>${ta.k} ${ta.zh}${ta.cur ? ' · ' + ta.cur.id + ' ' + ta.cur.name : ' · 待命'}`;
  $('#feedMeta').textContent = `${inFlight()} in flight · ${tasks.length} open`;
  $('#mOut').textContent = fmt(E); $('#mLive').textContent = `${L} / 12`; $('#mTok').textContent = hmsSince(bootAt);
}
function clockTick(){
  $('#clock').textContent = hms(new Date());
  /* 页头副标跟随真实数据面状态，不再硬编码 */
  const L = (DATA && DATA.liveN) || 0, SB = (DATA && DATA.standbyN) || 0;
  const el = $('#subLive');
  if (el) el.textContent = `HUB 广播 · 12 个数据面 · ${L} 在线 / ${SB} 待命`;
}

/* ---------- HUD 画布：扇区 + 通道环、文字带 ---------- */
function drawAt(c, x, y, flip, fn){ for (const xx of [x, x - RW, x + RW]) { if (xx < -420 || xx > RW + 420) continue; c.save(); c.translate(xx, y); if (flip) c.rotate(Math.PI); fn(c); c.restore(); } }
const spinA = () => spin ? spin.rotation.z : 0;
function drawRing(){
  if (!glOK) return;
  const c = ringCtx; c.clearRect(0, 0, RW, RH);
  // 外圈刻度
  c.fillStyle = 'rgba(200,225,255,.22)';
  for (let x = 0; x < RW; x += 16) c.fillRect(x, 2, 1.5, x % 128 === 0 ? 9 : 4);
  c.fillRect(0, 44, RW, 1);
  // 通道
  CH.forEach((ch, j) => {
    const th = chanAng[j], f = chanFlash[j];
    drawAt(c, uOf(th) * RW, 25, Math.sin(th + spinA()) < 0, q => {
      q.strokeStyle = rgba(ch.col, .5 + .5 * f); q.lineWidth = 2;
      q.beginPath(); q.moveTo(-150, -9); q.lineTo(-150, -13); q.lineTo(150, -13); q.lineTo(150, -9); q.moveTo(-150, 9); q.lineTo(-150, 13); q.lineTo(150, 13); q.lineTo(150, 9); q.stroke();
      if (f > .02) { q.fillStyle = rgba(ch.col, .32 * f); q.fillRect(-150, -13, 300, 26); }
      q.font = `700 17px ${MONO}`; q.textAlign = 'center'; q.textBaseline = 'middle';
      q.fillStyle = f > .3 ? '#ffffff' : 'rgba(225,236,250,.82)';
      q.fillText(`${ch.en} ${ch.zh} · ${fmt(chanN[j])}`, 0, 1);
    });
  });
  // 智能体扇区
  const sw = RW / NCL;
  for (let k = 0; k < NCL; k++) {
    const a = AG[k], th = secAng(k), on = k === 0 || !!a.cur, flip = Math.sin(th + spinA()) < -1e-4;
    const prog = k === 0 ? 1 - clamp(chiefT / chiefDur, 0, 1) : a.cur ? a.prog : 0, hit = clamp(a.hitT, 0, 1);
    drawAt(c, uOf(th) * RW, 78, flip, q => {
      const w = sw * .93, y0 = 26;
      if (hit > 0) { q.fillStyle = rgba(a.col, .12 * hit); q.fillRect(-w / 2, -30, w, 60); }
      q.fillStyle = 'rgba(200,225,255,.14)'; q.fillRect(-w / 2, y0, w, 4);
      q.fillStyle = a.bad > .05 ? rgba('#ff4d5e', .6 + .4 * a.bad) : rgba(a.col, on ? .95 : .4);
      q.fillRect(-w / 2, y0, w * (on ? prog : 0), 4);
      q.fillStyle = rgba(a.col, .9); q.fillRect(-w / 2, -24, 3, 46);
      q.textBaseline = 'middle'; q.textAlign = 'left';
      q.font = `800 24px ${MONO}`; q.fillStyle = on ? '#ffffff' : 'rgba(225,236,250,.5)';
      q.fillText(a.k, -w / 2 + 14, -10);
      const kw = q.measureText(a.k).width;
      q.font = `500 19px ${CJK}`; q.fillStyle = on ? 'rgba(225,236,250,.8)' : 'rgba(225,236,250,.4)';
      q.fillText(a.zh, -w / 2 + 24 + kw, -9);
      q.font = `500 15px ${MONO}`; q.fillStyle = 'rgba(200,220,240,.62)';
      const st = k === 0 ? `DISPATCH ${lastDispatch}` : a.cur ? `${a.cur.id} · ${Math.round(a.prog * 100)}%` : a.inbox.length ? `QUEUE ${a.inbox.length}` : 'IDLE';
      q.fillText(st, -w / 2 + 14, 13);
      q.textAlign = 'right';
      for (let p = 0; p < Math.min(6, a.inbox.length); p++) { q.fillStyle = rgba(a.col, .85); q.fillRect(w / 2 - 12 - p * 11, 8, 7, 7); }
    });
  }
  ringTex.needsUpdate = true;
}
function drawTape(){
  if (!glOK) return;
  tapeDirty = false;
  const c = tapeCtx; c.clearRect(0, 0, TW, TH);
  c.font = `500 18px ${MONO}`; c.textBaseline = 'middle';
  const items = tape.length ? tape : ['HUB 待命 · 等待数据流事件'];
  let x = 6, k = 0;
  while (x < TW) {
    const s = items[k % items.length]; k++;
    c.fillStyle = 'rgba(166,241,255,.85)'; c.fillRect(x, 9, 2, 14);
    c.fillStyle = 'rgba(225,236,250,.78)'; c.fillText(s, x + 10, 16.5);
    x += c.measureText(s).width + 40;
    c.fillStyle = 'rgba(200,225,255,.3)'; for (let t = 0; t < 4; t++) c.fillRect(x - 26 + t * 5, 14, 2, 5);
    if (k > 200) break;
  }
  tapeTex.needsUpdate = true;
}

/* ================= 5. 主循环 ================= */
let focus = -1, hover = -1, needsT = 1, uiAcc = 0, tapeAcc = 0, lastNow = performance.now();
const SIGBUF = 4000;
const TRMAX = 6000;
function writeSignals(){
  const P = sigGeo.attributes.position.array, C = sigGeo.attributes.col.array, S = sigGeo.attributes.sz.array, A = sigGeo.attributes.al.array;
  const LP = trGeo.attributes.position.array, LC = trGeo.attributes.color.array;
  let n = 0, m = 0;
  const put = (p, col, sz, al) => { if (n >= SIGBUF) return; P[n * 3] = p.x; P[n * 3 + 1] = p.y; P[n * 3 + 2] = p.z; C[n * 3] = col[0]; C[n * 3 + 1] = col[1]; C[n * 3 + 2] = col[2]; S[n] = sz; A[n] = al; n++; };
  // 拖尾光线：两端亮度不同，叠加混合下就是一条渐隐的彗尾
  const line = (p, q, col, a0, a1) => { if (m >= TRMAX) return; const o = m * 6; LP[o] = p.x; LP[o + 1] = p.y; LP[o + 2] = p.z; LP[o + 3] = q.x; LP[o + 4] = q.y; LP[o + 5] = q.z;
    LC[o] = col[0] * a0; LC[o + 1] = col[1] * a0; LC[o + 2] = col[2] * a0; LC[o + 3] = col[0] * a1; LC[o + 4] = col[1] * a1; LC[o + 5] = col[2] * a1; m++; };
  const cy = hex3(CYAN), pt = probe.trail, pl = pt.length;
  pt.forEach((q, k) => { const f = 1 - k / pl; put(q, cy, k === 0 ? .14 : .06 * f, k === 0 ? 1.6 : .6 * f); if (k) line(pt[k - 1], q, cy, 1.2 * (f + 1 / pl), 1.2 * f); });
  // 任务脉冲：最大最亮，一眼能和背景粒子分开
  for (const s of signals) {
    const col = s.col;
    for (let k = 0; k < s.tr; k++) {
      const u = s.u - k * s.gap; if (u < 0) break;
      s.path(Math.min(1, u), tmpV);
      const f = 1 - k / s.tr;
      put(tmpV, col, k === 0 ? s.head : s.head * .45 * f, k === 0 ? 1.9 : .9 * f);
      if (k) line(tmpW, tmpV, col, 1.3 * (f + 1 / s.tr), 1.3 * f);
      tmpW.copy(tmpV);
    }
  }
  // 算力粒子
  for (const q of parts) {
    if (!q.on) continue;
    for (let k = 0; k < q.tr; k++) {
      const u = q.u - k * q.gap; if (u < 0) break;
      const uu = Math.min(1, u); pEval(q, uu, tmpV);
      const f = 1 - k / q.tr, fade = q.m === 2 ? Math.min(1, uu * 5) * (uu > .72 ? (1 - uu) / .28 : 1) : 1;
      if (k === 0) put(tmpV, q.col, q.sz, 1.6 * q.al * fade);
      else if (q.m === 0) put(tmpV, q.col, q.sz * .55 * f, .8 * f * q.al);
      else line(tmpW, tmpV, q.col, (f + 1 / q.tr) * q.al * fade, f * q.al * fade);
      tmpW.copy(tmpV);
    }
  }
  for (let i = n; i < sigLast; i++) S[i] = 0;
  sigLast = n;
  for (const k of ['position', 'col', 'sz', 'al']) sigGeo.attributes[k].needsUpdate = true;
  trGeo.setDrawRange(0, m * 2);
  trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true;
}
let sigLast = 0;

function updateScene(dt){
  // 神经团活跃度：干活时按节律放电，刚收到信号时闪一下
  for (let i = 0; i < NCL; i++) {
    const a = AG[i];
    let t = i === 0 ? .45 + .1 * Math.sin(animT * 2.2) : a.cur ? .48 + .26 * Math.sin(animT * 7 + i * 1.7) : a.inbox.length ? .14 : .05;
    t += a.flash * 1.4 + a.bad * .7;
    AF[i * 2] += (t - AF[i * 2]) * (1 - Math.exp(-dt * 6));
  }
  AF[26] = .16 + boost * .12;
  for (const b of BUN) { const g = b.g, cur = AF[g * 2] * Math.exp(-dt * 1.6); AF[g * 2] = Math.max(cur, bunHot[g] * .85); bunHot[g] = 0; }
  // 聚焦：其他神经团和突触束压暗
  for (let g = 0; g < 48; g++) {
    let tgt = 1;
    if (focus >= 0) {
      if (g < NCL) tgt = g === focus ? 1 : .2;
      else if (g === 13) tgt = .35;
      else { const b = BUN[g - 14]; tgt = b && (b.a === focus || b.b === focus) ? 1.4 : .1; }
    }
    AF[g * 2 + 1] += (tgt - AF[g * 2 + 1]) * (1 - Math.exp(-dt * 4));
  }
  const u = brainLines.material.uniforms;
  u.uMono.value = mono; u.uTime.value = animT; u.uFade.value = camera.position.length() - 1.7;
  u.uGain.value += ((bloomOn && composer ? .62 : 1) * sizeGain - u.uGain.value) * (1 - Math.exp(-dt * 4));   // 开辉光时线条收一点，避免中心糊成一团
  // 探针拖尾
  probe.trail.unshift(probe.p.clone()); if (probe.trail.length > 16) probe.trail.pop();
  writeSignals();
  // HUD 转动
  spin.rotation.z = animT * .035;                     // 约 3 分钟转一圈
  tickA.rotation.z = animT * .02; tickB.rotation.z = -animT * .008;
  tapeRing.rotation.z = -animT * .028; dashRing.rotation.z = animT * .05;
  arcsA.rotation.z = animT * .09; arcsB.rotation.z = -animT * .06;
  sweep.rotation.z = -animT * .85;
  barcode.rotation.z = -(slotHead + slotAcc / SEG_SLOT) * (TAU / NSEG);
  const bc = barcode.geometry.attributes.color.array, cur = slotHead % NSEG;
  const SA = TAU / NSEG, rot = barcode.rotation.z;
  for (let s = 0; s < NSEG; s++) {
    slotDisp[s] += (slotVals[s] - slotDisp[s]) * (1 - Math.exp(-dt * 5));
    const v = slotDisp[s], live = s === cur;
    // 这一格此刻转到了哪个智能体的扇区下面
    const th = Math.PI / 2 + s * SA + rot;
    const ag = ((Math.round((Math.PI / 2 + spin.rotation.z - th) / SEC_A) % NCL) + NCL) % NCL, A = AG[ag], ac = AGC[ag];
    const load = ag === 0 ? .5 : A.cur ? .55 + .45 * A.prog : A.inbox.length ? .22 : .06;
    // 均衡器式跳动：扇区里的智能体越忙，跳得越高越快
    const jit = load * (.55 + .45 * Math.sin(animT * (1.1 + ((s * 7) % 6) * .22) + s * 2.3)) * 1.8;
    // 两道充能波沿环反向扫过
    const w = Math.exp(-(wrapPI(th - animT * .42) ** 2) / .045) + Math.exp(-(wrapPI(th + animT * .27 + 2.1) ** 2) / .03);
    const lit = Math.min(6, v * 4.8 + jit + w * 2.2);
    const tint = (A.cur || ag === 0) ? .35 * load : 0;
    for (let k = 0; k < 6; k++) {
      // 外圈那道常亮当底座，往圆心方向充能（k=0 是最里面那道）
      const on = clamp(lit - (5 - k), 0, 1);
      let r, g, b;
      if (v > .86 && k === 0) { r = 1; g = .66; b = .26; }
      else { r = .78 + (ac[0] - .78) * tint; g = .9 + (ac[1] - .9) * tint; b = 1 + (ac[2] - 1) * tint; }
      let br = .07 + on * (live ? .75 + .25 * Math.sin(animT * 6) : .85) * (1 + w * .6);
      const fl = segFlash[s];
      if (fl > .01) { const fc = segCol[s], mk = fl * .7; r += (fc[0] - r) * mk; g += (fc[1] - g) * mk; b += (fc[2] - b) * mk; br = Math.max(br, fl * 1.5); }
      for (let q = 0; q < 4; q++) { const o = ((s * 6 + k) * 4 + q) * 3; bc[o] = r * br; bc[o + 1] = g * br; bc[o + 2] = b * br; }
    }
  }
  barcode.geometry.attributes.color.needsUpdate = true;
  for (let s = 0; s < NSEG; s++) segFlash[s] *= Math.exp(-dt * 3.2);
  hits.forEach(h => { if (!h.s.visible) return; h.t += dt; const k = h.t / .55; if (k >= 1) { h.s.visible = false; return; } h.s.scale.setScalar(.1 + .32 * k); h.s.material.opacity = 1 - k; });
  coreSpr.material.opacity = .1 + AF[0] * .14 + boost * .05;
  chanSpr.forEach((s, j) => { const f = chanFlash[j]; s.material.opacity = f; s.scale.setScalar(.12 + .55 * f); });
  scans.forEach(s => { if (!s.m.visible) return; s.t += dt; const k = s.t / 1.2; if (k >= 1) { s.m.visible = false; return; } s.m.scale.setScalar(.07 + .38 * k); s.m.material.opacity = (1 - k) * .9; s.m.lookAt(camera.position); });
  streaks.material.uniforms.uTime.value = animT; streaks.material.uniforms.uBoost.value = boost;
  dust.rotation.y = animT * .004; dust.rotation.x = animT * .002;
}
function decay(dt){
  AG.forEach(a => { a.flash *= Math.exp(-dt * 2.4); a.bad *= Math.exp(-dt * 1.6); a.hitT = Math.max(0, a.hitT - dt); });
  for (let j = 0; j < chanFlash.length; j++) chanFlash[j] *= Math.exp(-dt * 1.8);
  boost *= Math.exp(-dt * .9);
  if (lastHand) lastHand.t -= dt;
}
function frame(now){
  requestAnimationFrame(frame);
  if (host.hidden || document.hidden) { lastNow = now; return; }
  const real = (now - lastNow) / 1000, dt = Math.min(.1, real); lastNow = now;
  if (!paused) { simStep(dt); decay(dt); animT += dt; }
  uiAcc += dt; tapeAcc += dt;
  if (uiAcc >= .25) {
    uiAcc = 0;
    renderList(); renderBottom(); renderHeat(); renderSpark(); drawRing();
    if (feedDirty) renderFeed();
    if (capDirty) renderCap();
    if (tapeDirty && tapeAcc > 1) { tapeAcc = 0; drawTape(); }
  }
  if (!glOK) return;
  if (cam.userT > 0) cam.userT -= dt; else { cam.yaw *= Math.exp(-dt * .7); cam.pitch *= Math.exp(-dt * .7); }
  camWant(animT);
  const k = 1 - Math.exp(-dt * 1.5);
  cam.pos.lerp(cam.want, k); cam.tgt.lerp(cam.wantT, k);
  const moving = cam.pos.distanceToSquared(cam.want) > 1e-5 || cam.userT > 0;
  if (paused && !moving && needsT <= 0) return;
  needsT -= dt;
  camera.position.copy(cam.pos); camera.lookAt(cam.tgt);
  updateScene(dt);
  if (bloomOn && composer) composer.render(); else renderer.render(scene, camera);
  // 帧率 + 自动降档
  fpsN++; fpsT += Math.min(real, 2);
  if (fpsT >= 1) {
    fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0;
    if (!paused && fps < 30) lowT++; else lowT = 0;
    /* 降档链补 rung（2026-10-24）：旧链在 pr .75 + 粒子生成率减半处
     * 到底——partScale 只影响生成率、辉光（UnrealBloomPass，全屏多
     * pass，最大头成本）从未被 shed，弱 GPU / 大屏上会永久卡在
     * 个位数帧率。故在 pr 到底后先关辉光（frame 已有 bloomOn 分支
     * 切 renderer.render，无需其它改动），再降 pr 至 .5，最后减粒子。 */
    if (lowT >= 3) { lowT = 0; if (pr > 1) { pr = 1; autoNote = ' · 已自动降清晰度'; layout(); } else if (pr > .75) { pr = .75; autoNote = ' · 已自动降清晰度'; layout(); } else if (bloomOn) { bloomOn = false; autoNote = ' · 已关闭辉光'; } else if (pr > .5) { pr = .5; autoNote = ' · 已自动降清晰度'; layout(); } else if (partScale > .5) { partScale = .5; autoNote = ' · 已自动减少粒子'; } }
  }
  if (hover >= 0 && !tip.hidden) showTip(hover);
}

/* ---------- 尺寸 ---------- */
function layout(){
  if (host.hidden || host.clientWidth < 2) return;   // 主题被隐藏时不重排
  const r = host.getBoundingClientRect();
  W = Math.max(1, r.width); H = Math.max(1, r.height);
  narrow = W < 760 || W / H < 1.05;
  nr.classList.toggle('narrow', narrow);
  const fr = fitIn.getBoundingClientRect();
  bs = Math.min(fr.width / 1920, fr.height / 1080);
  // 画板不锁 16:9：宽度或高度多出来的部分直接让画板变大，四周的面板贴着屏幕边
  const BW = fr.width / bs, BH = fr.height / bs;
  board.style.width = BW + 'px'; board.style.height = BH + 'px';
  board.style.setProperty('--s', bs);
  rowY = rows.map(r => r.el.offsetTop + r.el.offsetHeight / 2);
  heatWH = sizeCv(heatCv, heatX); sparkWH = sizeCv(sparkCv, sparkX);
  if (feed.length) renderFeed();
  if (!glOK) return;
  renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
  if (composer) { composer.setPixelRatio(pr); composer.setSize(W, H); }
  camera.aspect = W / H;
  const t = Math.tan(camera.fov * Math.PI / 360), Rr = 2.95;
  if (narrow) { fitD = Math.max(Rr * H / (.94 * W * t), Rr / (.6 * t)); camera.setViewOffset(W, H, 0, H * .02, W, H); }
  else { const ringPx = Math.min(BH * .9, BW - 900) * bs; fitD = Rr * H / (ringPx * t); camera.setViewOffset(W, H, 0, 30 * bs, W, H); }
  camera.updateProjectionMatrix();
  brainLines.material.uniforms.uPx.value = H * pr / (2 * t);
  // 星环在屏幕上越小，线条叠得越密，按尺寸减淡，免得小屏糊成一团白
  sizeGain = clamp(Rr * H / (fitD * t) / 900, .32, 1);
  needsT = .6;
}

/* ---------- 交互 ---------- */
const v3 = glOK ? new THREE.Vector3() : null;
function screenOf(p){ v3.copy(p).applyMatrix4(spin.matrixWorld).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; }
function pickAt(x, y){
  if (!glOK) return -1;
  let best = -1, bd = 44 * 44;
  const test = (i, p) => { const [sx, sy] = screenOf(p); const d = (sx - x) ** 2 + (sy - y) ** 2; if (d < bd) { bd = d; best = i; } };
  for (let i = 0; i < NCL; i++) test(i, CL[i]);
  test(CRAWLER, probe.p);
  return best;
}
function showTip(i){
  const a = AG[i];
  let now;
  if (i === 0) now = `刚派 ${lastDispatch} · 全局排队 ${queueTotal()} · 在途 ${inFlight()}`;
  else if (i === CRAWLER) now = `${probe.u < 1 ? '飞往' : '扫描'} ${AG[crawl.target].k} · 零条目 ${crawl.bugs}`;
  else now = a.cur ? `${a.cur.id} ${a.cur.name} · ${Math.round(a.prog * 100)}%` : a.inbox.length ? `排队 ${a.inbox.length}` : '待命';
  const links = i > 0 && i < NCL ? BUN.filter(b => b.a === i || b.b === i).map(b => AG[b.a === i ? b.b : b.a].k).join(' · ') : '';
  tip.style.setProperty('--c', a.col);
  tip.innerHTML = `<span><b>${a.k}</b><strong>${a.zh}</strong> · ${a.tag}</span><span>${a.role}</span><span>当前：${now}</span>` +
    (i < 13 ? `<span>${a.n} 条 · ${a.mode === 'live' ? '在线' : a.mode === 'mirror' ? '镜像' : a.mode === 'standby' ? '待命' : '未通电'} · ${a.from}</span>` : '') + (links ? `<span class="h">连着：${links}</span>` : '') +
    `<span class="h">${focus === i ? '再点一次取消聚焦' : '点击聚焦这团神经元'}</span>`;
  tip.hidden = false;
  const [sx, sy] = screenOf(i === CRAWLER ? probe.p : CL[i]);
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = sx + 18, y = sy - th / 2;
  if (x + tw > W - 12) x = sx - tw - 18;
  tip.style.left = clamp(x, 8, W - tw - 8) + 'px'; tip.style.top = clamp(y, 8, H - th - 8) + 'px';
}
let drag = null;
cv.addEventListener('pointerdown', e => { drag = {x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false}; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
cv.addEventListener('pointermove', e => {
  const r = host.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 5) { drag.moved = true; cv.classList.add('drag'); }
    if (drag.moved && glOK) { cam.yaw -= dx * .005; cam.pitch += dy * .004; cam.userT = 6; needsT = .5; tip.hidden = true; hover = -1; }
    return;
  }
  const i = pickAt(x, y);
  hover = i; cv.classList.toggle('hov', i >= 0);
  if (i >= 0) showTip(i); else tip.hidden = true;
});
cv.addEventListener('pointerup', e => {
  const wasDrag = drag && drag.moved; drag = null; cv.classList.remove('drag');
  if (wasDrag) return;
  const r = host.getBoundingClientRect(), i = pickAt(e.clientX - r.left, e.clientY - r.top);
  focus = (i >= 0 && i < NCL && focus !== i) ? i : -1;
  needsT = 1.5;
  if (i >= 0) showTip(i);
});
cv.addEventListener('pointerleave', () => { if (!drag) { tip.hidden = true; hover = -1; } });
cv.addEventListener('wheel', e => { if (!glOK) return; e.preventDefault(); cam.zoom = clamp(cam.zoom * Math.exp(e.deltaY * .0012), .55, 1.6); needsT = .8; }, {passive: false});

function syncButtons(){
  $$('[data-f="mode"]').forEach(b => b.textContent = MODES[modeI].zh);
}
function act(name){
  if (name === 'mode') { modeI = (modeI + 1) % MODES.length; cam && (cam.yaw = cam.pitch = 0); needsT = 3; }
  else if (name === 'full') {
    try {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { const b = $('[data-f="full"]'); b.textContent = '不支持'; setTimeout(() => b.textContent = '全屏', 1500); });
    } catch (e) { /* 部分窗口不允许全屏 */ }
  }
  syncButtons();
}
$$('[data-act]').forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
onDoc('fullscreenchange', () => { const b = $('[data-f="full"]'); if (b) b.textContent = document.fullscreenElement ? '退出全屏' : '全屏'; });
onDoc('keydown', e => {
  if (host.hidden) return;
  const tag = (e.target && e.target.tagName) || '';
  if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'v' || e.key === 'V') act('mode');
  else if (e.key === 'Escape' && focus >= 0) { focus = -1; needsT = 1.5; }
});

/* ---------- 开场 ---------- */
// 先让「live 数据链」的头部工位处在干活中途，画面一打开就是在跑的状态；
// 只用真实存在的 WF 索引，且路径上出现非 live 工位就整条跳过（不造假任务）
WF.forEach((w, wi) => {
  if (!w.path.every(ai => AG[ai] && AG[ai].mode === 'live')) return;
  const head = AG[w.path[0]];
  if (!head.cur) {
    const t = newTask(wi); t.stage = 0;
    head.cur = t; head.prog = rnd(.1, .8); head.dur = rnd(5, 9) * head.sp;
  }
  if (head.inbox.length < 2) head.inbox.push(newTask(wi));
});
AG.forEach(a => a.hitT = 0);
new ResizeObserver(() => layout()).observe(host);
layout();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawRing(); drawTape(); layout(); });
drawRing(); drawTape(); renderList(); renderFeed(); renderCap(); renderBottom(); renderHeat(); renderSpark();
clockTick(); setInterval(clockTick, 1000);
syncButtons();
// 调试用：快进模拟若干秒（控制台里 document.getElementById('host-neural').__nr.ff(20)）
host.__nr = {ff(sec){ for (let t = 0; t < sec; t += .05) { simStep(.05); decay(.05); animT += .05; } needsT = 1; }};
requestAnimationFrame(frame);
  /* ── MIGRATION PATCH B：返回销毁函数（rAF / 定时器 / RO / 监听 / WebGL 上下文） ── */
  return function disposeNeural(){
    __raf.forEach((id) => window.cancelAnimationFrame(id));
    __timers.forEach(([k, id]) => (k === 't' ? window.clearTimeout(id) : window.clearInterval(id)));
    __ros.forEach((ro) => { try { ro.disconnect(); } catch (e) {} });
    __off.forEach((f) => { try { f(); } catch (e) {} });
    __raf.length = __timers.length = __ros.length = __off.length = 0;
    try { host.__nr = null; } catch (e) {}
    const cvs = SR.querySelectorAll('canvas');
    cvs.forEach((cv) => {
      const gl = cv.getContext('webgl2') || cv.getContext('webgl');
      const lose = gl && gl.getExtension('WEBGL_lose_context');
      if (lose) { try { lose.loseContext(); } catch (e) {} }
      cv.width = cv.height = 0;
    });
    try { SR.innerHTML = ''; } catch (e) {}
  };
}

export { mountNeural };
