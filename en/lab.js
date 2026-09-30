/* 道路以目 · 模型实验室 —— 沙盒场景与全部参数(原"沉默相变模拟器"界面)
 * 依赖 model.js (window.SilenceSim)
 */
'use strict';
const { Sim, theory } = window.SilenceSim;
const $ = (id) => document.getElementById(id);

/* ================= 场景预设 ================= */
const SCENARIOS = {
  playground: {
    name: "① Playground: twenty vs. twenty-one",
    desc: "Worked example from the paper (pp. 15–16): 1,000 people, uniform tolerance limits, P=1, k=0.02. Critical seed x₋≈20.4 people. <b>Seed 20 → it dies out; seed 21 → it surges to 980 within three rounds.</b> This is “the same silence, a different divide”.",
    opts: { N: 1000, tolType: 'uniform', netType: 'full', P: 1, Pbar: 0.5, K0: 20, M: 60, alpha: 0, beta: 0, delta: 0, gamma: 0, memDecay: 0.2, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0, targetMode: 'uniform', releaseProb: 0, seed: 7, d0: 0, psiScale: 1, noRemoval: true },
  },
  liwang: {
    name: "② King Li stops the talk: repression and silence debt",
    desc: "Harsh punishment (P=1.15), tolerance limits pushed down across the board (τ≤0.45), targeting organizers, compressed propaganda. The routine 10-person actions each round are all flattened — but memory b <b>builds up out of sight</b> (Property 2: repression debt; watch the whole band in the bottom-right distribution chart drift right). Once the debt is deep enough, seed 80 people: the cost line has been pushed into the distribution band, and it ignites.",
    opts: { N: 2000, tolType: 'low', netType: 'random', netDeg: 8, P: 1.15, Pbar: 0.6, K0: 40, M: 80, alpha: 0.2, beta: 0.4, delta: 0.3, gamma: 12, memDecay: 0.04, vis: 0.7, omega: 1, globalScale: 0.5, noise: 0, hardCore: 0.002, targetMode: 'organizer', netDamage: 0.6, releaseProb: 0.05, seed: 21, d0: 0, psiScale: 1 },
  },
  nowarn: {
    name: "③ Glances on the Road: silence gives no warning",
    desc: "Property 1 of the paper (p. 6): the enforcers slowly erode on their own (α=0, β=0.9, δ(P−P̄)₊=0.1), and k_t=k₀·0.9ᵗ shrinks geometrically. Public participation <b>stays at 0 throughout</b>, and small disturbances still recover within a round — but the orange dashed line (the critical seed) keeps sliding down. Once it is small enough, a very small action can ignite it all.",
    opts: { N: 1000, tolType: 'uniform', netType: 'full', P: 1, Pbar: 0.5, K0: 20, M: 2000, alpha: 0, beta: 0.9, delta: 0.2, gamma: 0, memDecay: 0.2, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0, targetMode: 'uniform', releaseProb: 0, seed: 11, d0: 0, psiScale: 1, continuousK: true },
  },
  leipzig: {
    name: "④ Leipzig Monday demonstrations, 1989",
    desc: "Fully mixed, one round per week, with a routine 15-person rally each round; critical seed x₋≈23 people — small actions are pulled back for 8 weeks in a row (Property 6). In week 9, <b>“Footage leak”</b>: shared evidence escapes the circle of acquaintances, and the images bring a surge of turnout the following week (an exogenous input; the model does not generate the first event itself) — crossing x₋ ignites it. You can also skip the footage and manually seed 40+ people in week 9.",
    opts: { N: 2000, tolType: 'uniform', netType: 'full', P: 1, Pbar: 0.55, K0: 24, M: 120, alpha: 0.12, beta: 0.55, delta: 0.12, gamma: 1.6, memDecay: 0.25, vis: 1, omega: 1, globalScale: 0.4, noise: 0, hardCore: 0.003, targetMode: 'uniform', releaseProb: 0.1, seed: 1989, d0: 0.02, psiScale: 1.2 },
    recur: { count: 15, every: 6 },
    plan: [{ at: 48, event: 'tvseed', count: 45 }],
  },
  petrograd: {
    name: "⑤ Petrograd 1917: two-layer feedback instability",
    desc: "Property 4 of the paper (pp. 9–10): two layers, crowd and enforcers. Large α (crowd size shakes the troops), large β (peer cascades). Seed a 40-person action and watch x and d chase and amplify each other — each layer looks stable on its own, but coupled, the whole system destabilizes. What a mutiny changes is not the news but the k faced in every round after.",
    opts: { N: 1500, tolType: 'bell', netType: 'full', P: 1, Pbar: 0.5, K0: 25, M: 150, alpha: 0.35, beta: 0.5, delta: 0.2, gamma: 1.5, memDecay: 0.3, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0.002, targetMode: 'uniform', releaseProb: 0.15, seed: 1917, d0: 0.05, psiScale: 1.3 },
  },
  bloody: {
    name: "⑥ Bloody Sunday 1905: the double role of events",
    desc: "High-pressure calm (P=1.1, bimodal society: radicals 0.78 / moderates 0.28). First switch on “Routine actions” and run a dozen or so rounds — all die out. Then press <b>“Bloodshed”</b>: the killings go over the line and memory jumps. The outcome depends on μ=γw(P−P̄)₊·m(q) (Property 3): once the debt pushes the radicals over their threshold, the cascade begins; lower γ and reset, and the same bloodshed only settles, with no echo — “some people were enraged” does not prove that participation must rise.",
    opts: { N: 2000, tolType: 'bimodal', netType: 'full', P: 1.1, Pbar: 0.5, K0: 22, M: 100, alpha: 0.25, beta: 0.45, delta: 0.2, gamma: 6, memDecay: 0.2, vis: 0.5, omega: 1, globalScale: 0.6, noise: 0, hardCore: 0.001, targetMode: 'uniform', releaseProb: 0.1, seed: 1905, d0: 0, psiScale: 1 },
  },
  martial: {
    name: "⑦ Polish martial law 1981: decapitation and severed ties",
    desc: "K₀=45, enforcers frozen (k constant). Enforcement mode = preventive detention: people are ranked by τ+b and arrested without waiting for them to take part, 45 per round — it removes <b>the top of the distribution</b> (p. 5: you must know where in the distribution those removed sit). After 30 rounds, check the critical seed x₋ in the status bar: it has risen from about 46 people to 90. Now seed 55 people — it dies outright; switch enforcement mode to uniform sampling, rebuild the world, and the same 55 ignite. Police size k is the first-order lever; whom you arrest is a second-order composition effect.",
    opts: { N: 2000, tolType: 'uniform', netType: 'random', netDeg: 8, P: 1, Pbar: 0.5, K0: 45, M: 150, alpha: 0, beta: 0, delta: 0, gamma: 1.8, memDecay: 0.2, vis: 0.7, omega: 1, globalScale: 1, noise: 0, hardCore: 0.002, targetMode: 'preventive', netDamage: 0.3, releaseProb: 0.03, seed: 1981, d0: 0, psiScale: 1.1 },
  },
  granovetter: {
    name: "⑧ Granovetter’s ladder: one person short, one chain broken",
    desc: "Thresholds from 0 to 1 laid out as a ladder, with just 1 permanent participant (K₀=5). First seed 4 people: fewer than k=5, all are arrested, silence. Reset and seed 8: x passes k, the cost drops to 0.625, people with higher thresholds join, and the chain climbs rung by rung until x₊≈0.995 (Property 8: what blocks diffusion is often a gap in the middle that no one can bridge). Broken-chain variant: set police K₀ to 12, then seed 8.",
    opts: { N: 1000, tolType: 'ladder', netType: 'full', P: 1, Pbar: 2, K0: 5, M: 60, alpha: 0, beta: 0, delta: 0, gamma: 0, memDecay: 0.2, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0.001, targetMode: 'uniform', releaseProb: 0, seed: 1978, d0: 0, psiScale: 1 },
  },
  chehlom: {
    name: "⑨ Fortieth-day memorials: a delayed kernel",
    desc: "Paper p. 8, Iran 1978: exponential decay cannot explain “gathering again exactly forty days later”. Bimodal society, P̄=P (everyday punishment fully legitimate → zero everyday memory), ρ=0.5 (fast forgetting). At t=3, a massacre (a bloodshed event lasting 2 rounds — note: seeds appear only in the decision phase and punishment comes before the decision, so the event must span two rounds to leave any memory). Then everything falls silent, <b>until about round 13</b>: the memorial peak pushes the whole upper tail over its threshold at once, and it ignites with no one organizing. Rebuild with the exponential kernel: silent forever. This is the purest demonstration of “the structure of the memory kernel itself producing timed recurrence”.",
    opts: { N: 1500, tolType: 'bimodal', netType: 'random', netDeg: 8, P: 0.9, Pbar: 0.9, K0: 30, M: 80, alpha: 0.1, beta: 0.4, delta: 0.15, gamma: 1.2, memDecay: 0.5, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0.002, targetMode: 'uniform', releaseProb: 0.15, seed: 1978, d0: 0, psiScale: 1, kernel: 'memorial', memPeak: 10, memPeakAmp: 3.5 },
    plan: [{ at: 3, event: 'spikese', count: 40 }],
  },
  hysteresis: {
    name: "⑩ Bistability and hysteresis: k=0.2",
    desc: "Property 14 of the paper (pp. 19–20): at k=0.2, lowering pressure jumps up only once the low state vanishes at P_↓=0.8; raising pressure drops back only once the high state vanishes at P_↑=1.25. Lower the P slider on the left slowly (−0.02 at a time, running 25 rounds in between), then raise it slowly — at the same P=0.9, the system can sit at x=0.1 or x≈0.765. <b>History itself becomes information you need to explain the present.</b>",
    opts: { N: 1000, tolType: 'uniform', netType: 'full', P: 1.4, Pbar: 0.5, K0: 200, M: 60, alpha: 0, beta: 0, delta: 0, gamma: 0, memDecay: 0.2, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0, targetMode: 'uniform', releaseProb: 0, seed: 89, d0: 0, psiScale: 1, noRemoval: true },
    hint: "Frozen slice (detainees are not actually removed): move the P slider in steps of 0.02, running 25+ rounds at each step.",
  },
};

/* ================= 全局状态 ================= */
let sim = null, curKey = 'playground';
let seedPlan = [];           // [{at,count,mode,event}]
let recur = null;            // {count, every}
let running = false;
let pendingSeeds = [];       // 用户手动投入
let simClock = 0;

function applyScenario(key) {
  curKey = key;
  const sc = SCENARIOS[key];
  sim = new Sim(sc.opts);
  seedPlan = (sc.plan || []).map(p => Object.assign({}, p));
  recur = sc.recur ? Object.assign({}, sc.recur) : null;
  pendingSeeds = [];
  $('scenDesc').innerHTML = sc.desc + (sc.hint ? `<br><span style="color:var(--org)">How to play: ${sc.hint}</span>` : '');
  syncControlsFromSim();
  bifCache.key = null;      // 强制重算分岔图
  drawAll();
}

/* ================= 控件绑定 ================= */
const LIVE_KEYS = ['P', 'Pbar', 'K0', 'M', 'psiScale', 'alpha', 'beta', 'delta', 'd0',
  'omega', 'globalScale', 'noise', 'memDecay', 'gamma', 'vis', 'kernel', 'memPeak', 'memPeakAmp',
  'targetMode', 'netDamage', 'releaseProb'];
const STRUCT_KEYS = ['N', 'tolType', 'netType', 'netDeg', 'netGroups', 'hardCore', 'seed'];
const RANGES = { P: [0.2, 2, 0.01], K0: [0, 200, 1], Pbar: [0, 1.5, 0.01], M: [10, 2000, 10], psiScale: [0.2, 3, 0.05], alpha: [0, 1.5, 0.05], beta: [0, 1.5, 0.05], delta: [0, 1.5, 0.05], d0: [0, 1, 0.05], omega: [0, 1, 0.05], globalScale: [0, 1, 0.05], noise: [0, 0.3, 0.01], memDecay: [0, 1, 0.05], gamma: [0, 6, 0.1], vis: [0, 1, 0.05], memPeak: [2, 30, 1], memPeakAmp: [0, 4, 0.1], netDamage: [0, 1, 0.05], releaseProb: [0, 1, 0.05], N: [200, 8000, 100], netDeg: [2, 30, 1], netGroups: [4, 100, 1], hardCore: [0, 0.05, 0.001], seed: [1, 999, 1] };

function fmtVal(k, v) {
  if (k === 'hardCore') return (+v).toFixed(3);
  if (['P', 'Pbar', 'psiScale', 'alpha', 'beta', 'delta', 'omega', 'globalScale', 'noise', 'memDecay', 'gamma', 'vis', 'netDamage', 'releaseProb', 'memPeakAmp'].includes(k)) return (+v).toFixed(2);
  return '' + v;
}
function syncControlsFromSim() {
  for (const k of LIVE_KEYS.concat(STRUCT_KEYS)) {
    const el = $('o_' + k);
    if (!el) continue;
    el.value = sim.o[k];
    const vl = $('v_' + k);
    if (vl) vl.textContent = fmtVal(k, sim.o[k]);
  }
}
function bindControls() {
  for (const k of LIVE_KEYS) {
    const el = $('o_' + k);
    el.addEventListener('input', () => {
      const v = el.type === 'range' ? +el.value : el.value;
      sim.o[k] = (typeof DEFAULTS_T[k] === 'number') ? +v : v;
      const vl = $('v_' + k);
      if (vl) vl.textContent = fmtVal(k, v);
      if (k === 'P' || k === 'gamma' || k === 'Pbar') bifCache.key = null;
      drawAll();
    });
  }
  for (const k of STRUCT_KEYS) {
    const el = $('o_' + k);
    el.addEventListener('change', () => { rebuildWorld(); });
  }
}
const DEFAULTS_T = window.SilenceSim.DEFAULTS;

function collectOptsFromUI() {
  const o = Object.assign({}, sim.o);
  for (const k of LIVE_KEYS.concat(STRUCT_KEYS)) {
    const el = $('o_' + k);
    if (!el) continue;
    o[k] = (typeof DEFAULTS_T[k] === 'number') ? +el.value : el.value;
  }
  return o;
}
function rebuildWorld() {
  const sc = SCENARIOS[curKey];
  const o = collectOptsFromUI();
  // 场景特有字段(不在面板上的)保留
  for (const k of Object.keys(sc.opts)) if (!(k in o) || o[k] === undefined) o[k] = sc.opts[k];
  o.continuousK = sc.opts.continuousK || false;
  sim = new Sim(o);
  seedPlan = (sc.plan || []).map(p => Object.assign({}, p));
  recur = sc.recur ? Object.assign({}, sc.recur) : null;
  pendingSeeds = [];
  bifCache.key = null;
  drawAll();
}

/* ================= 运行循环 ================= */
function tick() {
  if (!running) return;
  const spd = +$('spd').value;
  for (let s = 0; s < spd; s++) {
    let seedCount = 0, seedMode = 'random';
    // 计划事件与种子
    for (const p of seedPlan) {
      if (p.at === sim.t) {
        if (p.event) fireEvent(p.event);
        if (p.count) { seedCount += p.count; seedMode = p.mode || 'random'; }
        p.done = true;
      }
    }
    seedPlan = seedPlan.filter(p => !p.done);
    if (recur && sim.t > 0 && sim.t % recur.every === 0) seedCount += recur.count;
    if (pendingSeeds.length) { for (const ps of pendingSeeds) { seedCount += ps.count; seedMode = ps.mode; } pendingSeeds = []; }
    sim.step(seedCount, seedMode);
  }
  drawAll();
  requestAnimationFrame(tick);
}

function fireEvent(ev) {
  if (ev === 'tv') sim.pushEvent({ rounds: 1, vis: 1, globalScale: 1, omega: Math.max(sim.o.omega, 0.6) });
  else if (ev === 'tvseed') sim.pushEvent({ rounds: 1, vis: 1, globalScale: 1, omega: Math.max(sim.o.omega, 0.6) });
  else if (ev === 'amnesty') sim.pushEvent({ rounds: 1, amnesty: true });
  else if (ev === 'spike') sim.pushEvent({ rounds: 2, P: sim.o.P * 3, vis: 1 });
  else if (ev === 'spikese') sim.pushEvent({ rounds: 2, P: sim.o.P * 3, vis: 1 });
  else if (ev === 'crack') sim.pushEvent({ rounds: 3, P: sim.o.P * 1.3 });
  else if (ev === 'stopK') sim.o.K0 = Math.min(sim.o.K0, 30);
  else if (ev === 'stopK20') sim.o.K0 = Math.min(sim.o.K0, 20);
  else if (ev === 'crackK60') sim.o.K0 = Math.max(sim.o.K0, 60);
}

/* ================= 状态栏 ================= */
const anaCache = { time: 0, data: null };
function getAnalysis(force) {
  const now = performance.now();
  if (force || !anaCache.data || now - anaCache.time > 700) {
    anaCache.data = sim.analysis();
    anaCache.time = now;
  }
  return anaCache.data;
}
let frameNo = 0;
function updateStatus(heavy) {
  const h = sim.hist, n = h.t.length;
  if (!n) { $('s_t').textContent = sim.t; return; }
  const last = (a) => a[a.length - 1];
  $('s_t').textContent = sim.t;
  $('s_x').textContent = last(h.x).toFixed(4);
  $('s_d').textContent = last(h.d).toFixed(3);
  $('s_k').textContent = last(h.k).toFixed(4);
  $('s_p').textContent = last(h.p).toFixed(4);
  $('s_R').textContent = last(h.R).toFixed(3);
  $('s_b').textContent = last(h.b).toFixed(4);
  const mu = sim.backfireMu();
  $('s_mu').textContent = mu.mu.toFixed(2) + (mu.mu > 1 ? " >1 repression backfires" : '');
  $('s_mu_item').classList.toggle('alert', mu.mu > 1);
  if (heavy) {
    const pts = getAnalysis(true).roots;
    const xc = pts.find(q => !q.boundary && !q.stable);
    $('s_xc').textContent = xc ? xc.x.toFixed(4) + ` (${Math.round(xc.x * sim.o.N)} people)` : "— (no high state)";
    // 低位恢复: F'(0+) 的线性化
    const F0 = sim.frozenF(1e-6, sim.eff().P, last(h.k));
    $('s_rec').textContent = F0 < 1e-9 ? "1 round (F′=0)" : '~' + Math.max(1, Math.round(1 / (1 - Math.min(0.99, F0)))) + " rounds";
  }
}

/* ================= 图表 ================= */
const COL = { x: '#58a6ff', d: '#d2a032', p: '#ef6a5e', b: '#7ec699', grid: '#222a34', fg: '#8b97a5' };

function setupCanvas(cv) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.height;
  if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return [ctx, w, h];
}
function axes(ctx, w, h, pad, xmax, ymax, xlabel) {
  ctx.strokeStyle = COL.grid; ctx.fillStyle = COL.fg; ctx.lineWidth = 1;
  ctx.font = '10px sans-serif';
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h - pad.t - pad.b) * i / 4;
    ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y);
    ctx.fillText((ymax * (1 - i / 4)).toFixed(1), 4, y + 3);
  }
  ctx.stroke();
  ctx.fillText(xlabel, w - pad.r - 30, h - 6);
}

function drawTime() {
  const cv = $('chTime'); const [ctx, w, h] = setupCanvas(cv);
  const pad = { l: 34, r: 12, t: 10, b: 18 };
  axes(ctx, w, h, pad, 1, 1, "round");
  const hst = sim.hist, n = hst.t.length;
  const W = 300, start = Math.max(0, n - W);
  const X = (i) => pad.l + (w - pad.l - pad.r) * (n - start <= 1 ? 0 : (i - start) / (W - 1));
  const Y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v);
  const series = [[hst.x, COL.x, 1.6], [hst.d, COL.d, 1.4], [hst.p, COL.p, 1.2], [hst.b, COL.b, 1.2]];
  ctx.setLineDash([]);
  for (const [arr, col, lw] of series) {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
    for (let i = start; i < n; i++) { const x = X(i), y = Y(arr[i]); i === start ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.fillStyle = COL.fg; ctx.font = '10px sans-serif';
  ctx.fillText(`Rounds ${start}–${Math.max(start, n - 1)}`, pad.l + 4, pad.t + 10);
  // 临界种子参考线(来自缓存的不动点分析)
  const xc = getAnalysis().xCrit;
  if (xc != null) {
    ctx.strokeStyle = '#c09aff'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, Y(xc)); ctx.lineTo(w - pad.r, Y(xc)); ctx.stroke();
    ctx.setLineDash([]); ctx.fillStyle = '#c09aff';
    ctx.fillText(`x₋=${xc.toFixed(3)}`, w - pad.r - 76, Y(xc) - 4);
  }
}

function drawReact() {
  const cv = $('chReact'); const [ctx, w, h] = setupCanvas(cv);
  const pad = { l: 34, r: 12, t: 10, b: 18 };
  const P = sim.eff().P, k = sim.hist.k.length ? sim.hist.k[sim.hist.k.length - 1] : sim.o.K0 / sim.o.N;
  axes(ctx, w, h, pad, 1, 1, 'x');
  const X = (v) => pad.l + (w - pad.l - pad.r) * v;
  const Y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v);
  const pts = getAnalysis().roots;
  const xc = pts.find(q => !q.boundary && !q.stable);
  if (xc) {                                   // 被吸回区
    ctx.fillStyle = 'rgba(88,166,255,0.07)';
    ctx.fillRect(X(0), Y(1), X(xc.x) - X(0), h - pad.t - pad.b);
  }
  ctx.strokeStyle = '#3a4450'; ctx.setLineDash([3, 3]);   // 对角线
  ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = COL.x; ctx.lineWidth = 1.8; ctx.beginPath();   // F(x)
  const M = 300;
  for (let i = 0; i <= M; i++) {
    const x = i / M, y = sim.frozenF(x, P, k);
    i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y));
  }
  ctx.stroke();
  for (const q of pts) {                      // 不动点
    if (q.boundary) continue;
    ctx.beginPath(); ctx.arc(X(q.x), Y(q.x), 5, 0, 7);
    ctx.fillStyle = q.stable ? COL.grn || '#7ec699' : COL.p; ctx.fill();
    ctx.strokeStyle = '#0f1318'; ctx.stroke();
  }
  const xNow = sim.meanU8(sim.a);             // 当前状态
  ctx.beginPath(); ctx.arc(X(xNow), Y(sim.frozenF(xNow, P, k)), 4.5, 0, 7);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.fillStyle = COL.fg; ctx.font = '10px sans-serif';
  ctx.fillText(`P=${P.toFixed(2)}  k=${k.toFixed(3)}  fixed points: ${pts.filter(q => !q.boundary).length}`, pad.l + 4, pad.t + 10);
}

/* ---- 分岔图(带缓存与去抖) ---- */
const bifCache = { key: null, busy: false, rows: [] };
function bifKey() { return [sim.o.N, sim.o.tolType, sim.eff().P.toFixed(3), Math.round(sim.R * 50)].join('|'); }
function computeBif() {
  const P = sim.eff().P, N = sim.o.N;
  const rows = [];
  const kmax = Math.min(0.6, 0.3 / Math.max(P, 0.05));
  for (let i = 1; i <= 46; i++) {
    const k = kmax * i / 46;
    const pts = sim.fixedPoints(P, k).filter(q => !q.boundary);
    rows.push({ k, pts });
  }
  bifCache.rows = rows; bifCache.key = bifKey();
}
function drawBif() {
  const cv = $('chBif'); const [ctx, w, h] = setupCanvas(cv);
  const pad = { l: 34, r: 12, t: 10, b: 18 };
  axes(ctx, w, h, pad, 1, 1, 'k');
  const X = (v) => pad.l + (w - pad.l - pad.r) * v / 0.6;
  const Y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v);
  if (bifCache.key !== bifKey() && !bifCache.busy) {
    bifCache.busy = true;
    setTimeout(() => { computeBif(); bifCache.busy = false; drawBif(); }, 30);
  }
  for (const { k, pts } of bifCache.rows) {
    for (const q of pts) {
      ctx.fillStyle = q.stable ? COL.x : COL.d;
      ctx.fillRect(X(k) - 1.2, Y(q.x) - 1.2, 2.4, 2.4);
    }
  }
  const kNow = Math.min(0.6, sim.hist.k.length ? sim.hist.k[sim.hist.k.length - 1] : 0);
  const xNow = sim.meanU8(sim.a);
  ctx.beginPath(); ctx.arc(X(kNow), Y(xNow), 5, 0, 7);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.strokeStyle = '#0f1318'; ctx.stroke();
  ctx.fillStyle = COL.fg; ctx.font = '10px sans-serif';
  ctx.fillText("blue = stable  orange = unstable (critical seed)  white dot = now", pad.l + 4, pad.t + 10);
}

function drawDist() {
  const cv = $('chDist'); const [ctx, w, h] = setupCanvas(cv);
  const pad = { l: 34, r: 12, t: 10, b: 18 };
  const P = sim.eff().P, k = sim.hist.k.length ? sim.hist.k[sim.hist.k.length - 1] : 0;
  const xNow = sim.meanU8(sim.a);
  const c = sim.cost(k, xNow, P);
  axes(ctx, w, h, pad, 1, 1, 'τ+b');
  const X = (v) => pad.l + (w - pad.l - pad.r) * v;
  const Y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v);
  const B = 64, bins = new Array(B).fill(0), maxv = 2.2;
  let free = 0;
  for (let i = 0; i < sim.o.N; i++) {
    if (sim.r[i]) continue;
    free++;
    const q = sim.tau[i] + sim.b[i];
    const bi = Math.min(B - 1, Math.max(0, Math.floor(q / maxv * B)));
    bins[bi]++;
  }
  const mx = Math.max(1, ...bins);
  ctx.fillStyle = 'rgba(88,166,255,0.65)';
  for (let i = 0; i < B; i++) {
    const bw = (w - pad.l - pad.r) / B;
    ctx.fillRect(X(i / B * maxv), Y(bins[i] / mx), bw, Y(0) - Y(bins[i] / mx));
  }
  if (c > 0 && c <= maxv) {                   // 当前代价线 + 门槛带
    ctx.fillStyle = 'rgba(210,160,50,0.18)';
    ctx.fillRect(X(Math.max(0, c - 0.01)), Y(1), X(Math.min(maxv, c + 0.01)) - X(Math.max(0, c - 0.01)), h - pad.t - pad.b);
    ctx.strokeStyle = COL.d; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(X(c), Y(1)); ctx.lineTo(X(c), Y(0)); ctx.stroke();
    ctx.fillStyle = COL.d; ctx.font = '10px sans-serif';
    const mu = sim.backfireMu();
    ctx.fillText(`cost c=${c.toFixed(3)}   μ=${mu.mu.toFixed(2)}${mu.mu > 1 ? ' → events will add participants on net' : ''}`, pad.l + 4, pad.t + 10);
  }
}

function drawAll() {
  frameNo++;
  updateStatus(frameNo % 20 === 0);
  drawTime(); drawReact(); drawBif(); drawDist();
}

/* ================= 页内自检 ================= */
function runInPageTests() {
  const out = [];
  let pass = 0, fail = 0;
  const check = (name, cond, detail) => {
    if (cond) { pass++; out.push(`  ✓ ${name}`); }
    else { fail++; out.push(`  ✗ ${name} ${detail || ''}`); }
  };
  const near = (a, b, t) => Math.abs(a - b) <= t;
  const F = (x) => theory.reactionUniform(x, 1, 0.02);
  let x = 0.021; const seq = [x];
  for (let i = 0; i < 40; i++) { const nx = F(x); seq.push(nx); if (Math.abs(nx - x) < 1e-12) break; x = nx; }
  check("p16 example: 21 people take off 48→580→966→980", near(seq[1] * 1000, 48, 2) && near(seq[2] * 1000, 580, 3) && near(seq[seq.length - 1], 0.97958, 0.001));
  check("p16 example: 20 people die out", theory.iterateUniform(0.02, 1, 0.02, 50) === 0);
  check("Fixed points, analytic x₋/x₊", near(theory.xMinus(1, 0.02), 0.02041685, 1e-6) && near(theory.xPlus(1, 0.02), 0.97958315, 1e-6));
  const eq = (xx, P, k) => theory.iterateUniform(xx, P, k, 400);
  let xx = 0.05, jd = null;
  for (let P = 1.6; P >= 0.6; P -= 0.01) { xx = eq(xx, P, 0.2); if (xx > 0.5 && !jd) jd = P; }
  check("Hysteresis: lowering pressure jumps up at P_↓≈0.8", jd && near(jd, 0.8, 0.03), `jd=${jd && jd.toFixed(2)}`);
  let u = eq(0.9, 0.6, 0.2), ju = null;
  for (let P = 0.6; P <= 1.35; P += 0.005) { u = eq(u, P, 0.2); if (u < 0.1 && !ju) ju = P; }
  check("Hysteresis: raising pressure drops back at P_↑≈1.25", ju && near(ju, 1.25, 0.02), `ju=${ju && ju.toFixed(2)}`);
  check("Catalan series", Math.abs(theory.xMinus(1, 0.001) - (0.001 + 1e-6 + 2e-9 + 5e-12 + 14e-15)) < 1e-15);
  const s5 = new Sim({ N: 10000, M: 600, K0: 200, tolType: 'uniform', P: 1, Pbar: 0.5, gamma: 2, memDecay: 0, alpha: 1, beta: 1, delta: 0, d0: 0.5, seed: 9 });
  const idx = Array.from({ length: 10000 }, (_, i) => i).sort((a, b) => s5.tau[b] - s5.tau[a]);
  for (let i = 0; i < 1000; i++) s5.a[idx[i]] = 1;
  const s5r = s5.step(0);
  check("p5 single-round example: x′≈0.90, d′≈0.6, b̄≈0.01", near(s5r.x, 0.9, 0.005) && near(s5r.d, 0.6, 0.03) && near(s5r.bAvg, 0.01, 0.001));
  const se = new Sim({ N: 1000, K0: 20, M: 2000, tolType: 'uniform', P: 1, Pbar: 0.5, alpha: 0, beta: 0.9, delta: 0.2, d0: 0, continuousK: true, seed: 11 });
  let ok = true;
  for (let t = 1; t <= 10; t++) { const s = se.step(0); if (!near(s.k, 0.02 * Math.pow(0.9, t), 1e-3)) ok = false; }
  check("Property 1: k_t decays geometrically while the public stays silent", ok && se.meanU8(se.a) === 0);
  out.unshift(`Results: ${pass} passed, ${fail} failed`);
  $('tests').textContent = out.join('\n');
}

/* ================= CSV ================= */
function exportCsv() {
  const h = sim.hist;
  let csv = 't,x,d,k,p,b,R\n';
  for (let i = 0; i < h.t.length; i++) csv += `${h.t[i]},${h.x[i]},${h.d[i]},${h.k[i]},${h.p[i]},${h.b[i]},${h.R[i]}\n`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `silence_sim_${curKey}_${sim.t}rounds.csv`;
  a.click();
}

/* ================= 装配 ================= */
window.addEventListener('DOMContentLoaded', () => {
  const sel = $('scenario');
  for (const [k, sc] of Object.entries(SCENARIOS)) {
    const op = document.createElement('option');
    op.value = k; op.textContent = sc.name;
    sel.appendChild(op);
  }
  sel.addEventListener('change', () => applyScenario(sel.value));
  bindControls();

  $('btnStep').onclick = () => { sim.step(0); drawAll(); };
  $('btnRun').onclick = () => {
    running = !running;
    $('btnRun').textContent = running ? "⏸ Pause" : "▶ Run";
    if (running) requestAnimationFrame(tick);
  };
  $('btnReset').onclick = () => applyScenario(curKey);
  $('btnRebuild').onclick = () => rebuildWorld();
  $('spd').oninput = () => $('spdVal').textContent = $('spd').value;
  $('btnCsv').onclick = exportCsv;

  $('seedCount').oninput = () => $('v_seedCount').textContent = $('seedCount').value;
  $('btnSeed').onclick = () => {
    pendingSeeds.push({ count: +$('seedCount').value, mode: $('seedMode').value });
    if (!running) { sim.step(pendingSeeds[0].count, pendingSeeds[0].mode); pendingSeeds = []; drawAll(); }
  };
  let recurOn = false;
  $('btnRecur').onclick = () => {
    recurOn = !recurOn;
    recur = recurOn ? { count: Math.max(2, Math.round(+ $('seedCount').value / 3)), every: 1 } : null;
    $('btnRecur').textContent = "Routine actions: " + (recurOn ? `On (${recur.count} people/round)` : "Off");
  };
  $('btnTV').onclick = () => { fireEvent('tv'); };
  $('btnAmnesty').onclick = () => { fireEvent('amnesty'); };
  $('btnSpike').onclick = () => { fireEvent('spike'); };
  $('btnCrack').onclick = () => { fireEvent('crack'); };
  $('btnLink').onclick = () => {
    if (!sim.net) { $('scenDesc').insertAdjacentHTML('beforeend', "<br><span style=\"color:var(--red)\">A fully mixed network has no ties to weave (switch the network type and rebuild first).</span>"); return; }
    const N = sim.o.N, n = Math.round(N * 0.4);
    for (let t = 0; t < n; t++) {
      const a = (sim.rng() * N) | 0, b = (sim.rng() * N) | 0;
      if (a !== b) { sim.net[a].push(b); sim.net[b].push(a); }
    }
  };
  $('btnTest').onclick = runInPageTests;


  window.addEventListener('resize', drawAll);
  applyScenario('playground');
});
