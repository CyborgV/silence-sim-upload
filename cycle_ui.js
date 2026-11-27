/* 道路以目 · 周期律实验室 —— cycle.html 的界面部分
 * 依赖 model.js (window.SilenceSim), fisher.js (window.Fisher), cycle.js (window.CycleModel)
 */
'use strict';
const { CycleSim, SCENARIOS, DEFAULTS, REGIMES, CYCLE_FAST, theory } = window.CycleModel;
const { Sim } = window.SilenceSim;
const FAST_DEFAULTS = window.SilenceSim.DEFAULTS;
const $ = (id) => document.getElementById(id);
const RPY = 20;                         // 每年快轮数 (页面里固定)

/* ================= 旋钮定义 =================
 * [键, 标签, 最小, 最大, 步长, 'S'(改动后重跑)]; { sel } 下拉框; { sw } 耦合开关 */
const GROUPS = [
  { title: '🌍 环境', tag: '慢层的外力', open: false, rows: [
    { sel: 'env.type', label: '环境剧本', S: 1, options: [['static', '静止 (v=0)'], ['constant', '匀速移动'], ['script', '平静 → 冲击 → 平静'], ['shocks', '随机冲击序列']] },
    ['env.v', '匀速: 速度 /年', 0, 0.1, 0.002, 'S'],
    ['env.vCalm', '平静期速度 /年', 0, 0.02, 0.001, 'S'],
    ['env.vShock', '冲击期速度 /年', 0, 0.2, 0.005, 'S'],
    ['env.shockStart', '冲击开始年份', 5, 250, 5, 'S'],
    ['env.shockLen', '冲击持续 (年)', 5, 100, 5, 'S'],
    ['env.meanGap', '随机冲击: 平均间隔', 20, 400, 10, 'S'],
    ['env.durMin', '随机冲击: 最短 (年)', 5, 60, 5, 'S'],
    ['env.durMax', '随机冲击: 最长 (年)', 5, 100, 5, 'S'],
    ['env.sigmaTheta', '环境噪声 σ_θ', 0, 0.05, 0.002, 'S'],
    ['seedSlow', '慢层随机种子', 1, 9999, 1, 'S'],
    { note: '环境要求的最优点 θ 在 n 维制度空间里移动. 每一段的方向随机. 同一个慢层种子下, 不同政权面对的环境完全相同.' },
  ] },
  { title: '🐢 慢层', tag: 'Lande + 变异库', open: false, rows: [
    ['n', '制度维数 n', 1, 20, 1, 'S'],
    ['h', '地形曲率 h', 0.2, 5, 0.1, 'S'],
    ['U0', '变异产生率 U /年', 0.002, 0.1, 0.002, 'S'],
    ['muE', '表达转移率 μ_e /年', 0.1, 10, 0.1],
    ['deltaH', '隐藏想法消亡率 δ_h', 0, 2, 0.05, 'S'],
    { sel: 'poolMode', label: '变异库', S: 1, options: [['split', '显隐两库'], ['direct', '单库 (经典)']] },
    { note: 's 追赶 θ 的速度 = V_显 × 梯度 (Lande). V_显 被选择磨掉, 靠 V_隐 里的想法"说出来"补充. <b>δ_h=0 时压制表达降不了长期的 V_显</b>.' },
  ] },
  { title: '🔗 耦合 C1–C7', tag: '每条可单独关', open: true, rows: [
    { sw: 'C1', label: 'C1 滞后生怨 (慢→快)', keys: ['kappa'] },
    ['kappa', 'κ', 0, 1, 0.01],
    { sw: 'C2', label: 'C2 表达压制: 政权自己调 P', bool: 'evolveP' },
    ['fast.P', '手动 P (C2 关闭时)', 0.2, 3, 0.01],
    { sw: 'C3', label: 'C3 绩效决定合法性', keys: ['lambdaW'] },
    ['lambdaW', 'λ_W', 0, 2, 0.05],
    ['fast.Pbar', '合法性阈值基线 P̄₀', 0, 1.5, 0.01],
    { sw: 'C4', label: 'C4 财政与军心', keys: ['chi', 'deltaL'] },
    ['chi', 'χ (警力随 ℓ 缩水)', 0, 2, 0.05],
    ['deltaL', 'δ_ℓ (执行者门槛下移)', 0, 2, 0.05],
    { sw: 'C5', label: 'C5 表达供给改革 (快→慢, 必开)', fixed: true },
    ['lambdaS', 'λ_s 说话代价/上街代价', 0.02, 1, 0.01],
    ['lambdaB', 'λ_b 积怨让人敢说', 0, 2, 0.05],
    { sw: 'C6', label: 'C6 报喜不报忧', keys: ['betaFog'] },
    ['betaFog', 'β_fog', 0, 1, 0.05],
    { sw: 'C7', label: 'C7 改朝换代', bool: 'revolution' },
    { note: '全部关掉 (并把背景种子设为 0) 时, 快层与原版 Sim <b>逐位相同</b>; 见场景 ⑦.' },
  ] },
  { title: '🏛 政权', tag: '预测式爬山', open: true, rows: [
    { sel: 'regime', label: '政权类型', S: 1, options: [['myopic', '短视 (看不见 b)'], ['zhaogong', '召公 (P ≤ P̄_eff − margin)'], ['farsighted', '远见 (看得见 b, 无雾)']] },
    ['hP', '预测期 h_P (年)', 1, 60, 1],
    ['cE', '执法成本 c_E', 0, 0.06, 0.0005],
    ['cX', '街头成本 c_x', 0, 20, 0.5],
    ['etaP', '学习率 η_P', 0.01, 3, 0.01],
    ['dPmax', '每年最大步长', 0.005, 0.2, 0.005],
    ['Pmin', 'P 下界', 0.1, 1, 0.01],
    ['Pmax', 'P 上界', 1, 4, 0.05],
    ['margin', '召公的余量 margin', 0, 0.3, 0.01],
    { note: '每年一次: 在自己的感知模型里往前看 h_P 年, 朝让 J 更好的方向挪一小步. <b>c_E ≳ 0.008 时短视政权也不再加压</b> (压制的收益只是暂态).' },
  ] },
  { title: '⚔ 改朝换代', tag: '判据与重置', open: false, rows: [
    ['xRev', '参与判据 x_rev', 0.2, 1, 0.05],
    ['dRev', '倒戈判据 d_rev', 0.2, 1, 0.05],
    ['mRev', '连续轮数 m_rev', 1, 20, 1],
    ['rRel', '隐藏变异释放 r_rel', 0, 1, 0.05],
    ['zetaJump', '乱世跳动 ζ_jump', 0, 5, 0.1],
    ['phiCath', '积怨宣泄 φ_cath', 0, 1, 0.05],
    ['Pnew', '新政权的 P', 0.2, 2, 0.01],
    ['K0newFrac', '新政权警力 (占原编制)', 0.1, 1, 0.05],
    ['tauK', '警力恢复时间 (年)', 1, 50, 1],
    ['nChaos', '空位期 (轮)', 0, 200, 10],
  ] },
  { title: '⚡ 快层', tag: '原模型的参数', open: false, rows: [
    ['fast.N', '人口 N', 200, 4000, 100, 'S'],
    ['fast.tolMul', '承受上限上界 τ_max', 0.1, 1, 0.05, 'S'],
    ['fast.K0', '警力编制 K₀ (人/轮)', 0, 100, 1],
    ['fast.M', '执行者人数 M', 10, 500, 10, 'S'],
    ['fast.memDecay', '记忆消退 ρ /轮', 0, 0.3, 0.001],
    ['fast.releaseProb', '每轮释放概率', 0, 0.2, 0.002],
    ['fast.gamma', '经历→意愿 γ', 0, 12, 0.1],
    ['fast.alpha', '人群压力 α', 0, 1.5, 0.05],
    ['fast.beta', '同僚影响 β', 0, 1.5, 0.05],
    ['fast.delta', '抗命系数 δ', 0, 1.5, 0.05],
    ['u0', '背景小动作 (人/轮)', 0, 10, 0.1],
    ['fast.seed', '快层随机种子', 1, 999, 1, 'S'],
    { note: '周期律场景用的快层基线与原默认值有三处不同: τ ~ U[0, 0.3], ρ = 0.005 (积怨记忆约 10 年), 释放概率 0.01 (刑期约 5 年). 理由见文档.' },
  ] },
];
const ROWS = {};                       // key → 行定义
for (const g of GROUPS) for (const r of g.rows) { if (Array.isArray(r)) ROWS[r[0]] = r; else if (r.sel) ROWS[r.sel] = r; }

/* ================= 状态 ================= */
let curKey = 'cycle', sc = null;
const S = {};                          // 当前旋钮值
const saved = {};                      // 开关关掉时记住原来的系数
let cs = null, cs2 = null, ref = null; // 主模型 / 对照 (场景 ⑥) / 原版 Sim (场景 ⑦)
let refState = { ok: true, rounds: 0, badAt: -1 };
let running = false, untilEnd = false, doneEvents = new Set();
const hidden = new Set();

function envToUI(env) {
  const e = env || DEFAULTS.env, d = DEFAULTS.env;
  const u = { type: e.type, v: e.v != null ? e.v : 0.01, vCalm: e.vCalm != null ? e.vCalm : d.vCalm, vShock: e.vShock != null ? e.vShock : d.vShock,
    meanGap: e.meanGap || d.meanGap, durMin: e.durMin || d.durMin, durMax: e.durMax || d.durMax, sigmaTheta: e.sigmaTheta || 0, shockStart: 60, shockLen: 30 };
  if (e.type === 'script' && e.phases) { u.shockStart = e.phases[0].years; u.vCalm = e.phases[0].v; u.shockLen = e.phases[1].years; u.vShock = e.phases[1].v; }
  return u;
}
function uiToEnv() {
  const g = (k) => S['env.' + k], t = g('type');
  if (t === 'static') return { type: 'static' };
  if (t === 'constant') return { type: 'constant', v: g('v'), sigmaTheta: g('sigmaTheta') };
  if (t === 'script') return { type: 'script', sigmaTheta: g('sigmaTheta'), phases: [{ years: g('shockStart'), v: g('vCalm') }, { years: g('shockLen'), v: g('vShock'), shock: true }, { v: g('vCalm') }] };
  return { type: 'shocks', vCalm: g('vCalm'), vShock: g('vShock'), durMin: Math.min(g('durMin'), g('durMax')), durMax: Math.max(g('durMin'), g('durMax')), meanGap: g('meanGap'), sigmaTheta: g('sigmaTheta') };
}
function loadScenario(key) {
  curKey = key; sc = SCENARIOS[key];
  const top = Object.assign({}, DEFAULTS, sc.opts);
  if (sc.opts.standalone && sc.opts.poolMode === undefined) top.poolMode = 'direct';
  if (sc.opts.hP == null) top.hP = (REGIMES[top.regime] || REGIMES.myopic).hP;
  const fast = Object.assign({}, FAST_DEFAULTS, sc.opts.fast || CYCLE_FAST), env = envToUI(sc.opts.env);
  for (const k of Object.keys(ROWS)) {
    if (k.startsWith('fast.')) S[k] = fast[k.slice(5)];
    else if (k.startsWith('env.')) S[k] = env[k.slice(4)];
    else S[k] = top[k];
  }
  for (const b of ['evolveP', 'revolution']) S[b] = top[b];
  for (const k of Object.keys(saved)) delete saved[k];
  $('scenDesc').innerHTML = sc.desc;
  syncKnobs();
  rebuild();
}
function buildOpts(extra) {
  const o = Object.assign({}, sc.opts);
  for (const k of Object.keys(S)) if (!k.startsWith('fast.') && !k.startsWith('env.')) o[k] = S[k];
  o.env = uiToEnv();
  if (!sc.opts.standalone) {
    const f = Object.assign({}, sc.opts.fast || CYCLE_FAST);
    for (const k of Object.keys(S)) if (k.startsWith('fast.')) f[k.slice(5)] = S[k];
    o.fast = f;
  }
  o.recordEvery = 1; o.critEvery = sc.opts.standalone ? 0 : RPY;
  return Object.assign(o, extra || {});
}
function rebuild() {
  running = false; untilEnd = false; $('btnRun').textContent = '▶ 运行';
  cs = new CycleSim(buildOpts());
  cs2 = sc.compare ? new CycleSim(buildOpts(sc.compare)) : null;
  ref = sc.checkAgainstSim ? new Sim(Object.assign({}, cs.sim.o)) : null;
  refState = { ok: true, rounds: 0, badAt: -1 };
  doneEvents = new Set();
  lastDynCount = -1;
  drawAll();
}

/* ================= 旋钮界面 ================= */
const decimals = (step) => { const s = String(step); return s.includes('.') ? s.split('.')[1].length : 0; };
function buildKnobs() {
  const root = $('knobs');
  for (const g of GROUPS) {
    const det = document.createElement('details'); det.open = !!g.open;
    det.innerHTML = `<summary>${g.title} <span class="tag">${g.tag}</span></summary>`;
    const body = document.createElement('div'); body.className = 'body';
    for (const r of g.rows) {
      const row = document.createElement('div');
      if (r.note) { row.className = 'note'; row.innerHTML = r.note; }
      else if (r.sw) {
        row.className = 'row sw';
        row.innerHTML = `<label for="sw_${r.sw}">${r.label}</label><input type="checkbox" id="sw_${r.sw}" ${r.fixed ? 'checked disabled' : ''}>`;
        if (!r.fixed) row.querySelector('input').addEventListener('change', (ev) => toggleSwitch(r, ev.target.checked));
      } else if (r.sel) {
        row.className = 'row'; row.id = 'row_' + r.sel;
        row.innerHTML = `<label>${r.label}${r.S ? ' ↻' : ''}</label><select id="k_${r.sel}">${r.options.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`;
        row.querySelector('select').addEventListener('change', (ev) => setKnob(r.sel, ev.target.value, true));
      } else {
        const [key, label, min, max, step, flag] = r;
        row.className = 'row'; row.id = 'row_' + key;
        row.innerHTML = `<label>${label}${flag ? ' ↻' : ''}</label><input id="k_${key}" type="range" min="${min}" max="${max}" step="${step}"><span class="val" id="v_${key}"></span>`;
        const inp = row.querySelector('input');
        inp.addEventListener('input', () => { $('v_' + key).textContent = (+inp.value).toFixed(decimals(step)); if (!flag) setKnob(key, +inp.value, false); });
        if (flag) inp.addEventListener('change', () => setKnob(key, +inp.value, true));
      }
      body.appendChild(row);
    }
    det.appendChild(body); root.appendChild(det);
  }
}
function syncKnobs() {
  for (const [key, r] of Object.entries(ROWS)) {
    const el = $('k_' + key); if (!el) continue;
    el.value = S[key];
    if (Array.isArray(r)) $('v_' + key).textContent = (+S[key]).toFixed(decimals(r[4]));
  }
  for (const g of GROUPS) for (const r of g.rows) if (r.sw && !r.fixed) {
    const on = r.bool ? !!S[r.bool] : r.keys.some(k => S[k] !== 0);
    $('sw_' + r.sw).checked = on;
    if (r.keys) for (const k of r.keys) $('row_' + k).classList.toggle('off', !on);
  }
  const t = S['env.type'];
  const show = { 'env.v': t === 'constant', 'env.vCalm': t === 'script' || t === 'shocks', 'env.vShock': t === 'script' || t === 'shocks', 'env.shockStart': t === 'script', 'env.shockLen': t === 'script',
    'env.meanGap': t === 'shocks', 'env.durMin': t === 'shocks', 'env.durMax': t === 'shocks', 'env.sigmaTheta': t !== 'static' };
  for (const [k, v] of Object.entries(show)) $('row_' + k).style.display = v ? '' : 'none';
  $('row_fast.P').classList.toggle('off', !!S.evolveP);
}
function toggleSwitch(r, on) {
  if (r.bool) { S[r.bool] = on; applyLive(r.bool, on); }
  else for (const k of r.keys) {
    if (!on) { saved[k] = S[k]; S[k] = 0; } else S[k] = saved[k] || DEFAULTS[k] || ROWS[k][4] * 4;
    applyLive(k, S[k]);
  }
  syncKnobs(); drawAll();
}
function setKnob(key, v, structural) {
  S[key] = v;
  if (key === 'regime') S.hP = REGIMES[v].hP;
  if (structural) { syncKnobs(); rebuild(); return; }
  applyLive(key, v);
  syncKnobs(); drawAll();
}
/** 不用重跑的参数: 直接写进正在跑的模型 */
function applyLive(key, v) {
  for (const c of [cs, cs2]) {
    if (!c) continue;
    if (key.startsWith('fast.')) {
      if (!c.sim) continue;
      const k = key.slice(5); c.sim.o[k] = v;
      if (k === 'P') c.P = v;
      if (k === 'Pbar') c.Pbar0 = v;
      if (k === 'K0') { c.K0base = v; c.K0cur = v; }
    } else { c.o[key] = v; if (key === 'muE') c.par.muE = v; }
  }
  if (ref && key.startsWith('fast.')) ref.o[key.slice(5)] = v;
}

/* ================= 运行 ================= */
function stepAll() {
  const t = cs.t;
  for (const ev of (sc.events || [])) {
    if (ev.year * RPY === t && !doneEvents.has(ev)) {
      doneEvents.add(ev);
      if (ev.setP != null) { S['fast.P'] = ev.setP; applyLive('fast.P', ev.setP); syncKnobs(); }
    }
  }
  let count = 0;
  if (sc.seedEvery && t % sc.seedEvery.every === 0) count = sc.seedEvery.count;
  cs.step(count, 'random');
  if (cs2) cs2.step(count, 'random');
  if (ref) {                              // 场景 ⑦: 原版 Sim 吃同一串种子, 逐轮比较
    ref.step(cs.lastSeedCount, cs.lastSeedMode);
    const a = ref.hist, b = cs.sim.hist, i = a.t.length - 1;
    let same = Object.is(a.x[i], b.x[i]) && Object.is(a.d[i], b.d[i]) && Object.is(a.b[i], b.b[i]) && Object.is(a.p[i], b.p[i]) && Object.is(a.k[i], b.k[i]);
    if (same && cs.t % 50 === 0) for (let q = 0; q < ref.o.N && same; q++) if (ref.a[q] !== cs.sim.a[q] || !Object.is(ref.b[q], cs.sim.b[q]) || ref.r[q] !== cs.sim.r[q]) same = false;
    if (!same && refState.ok) { refState.ok = false; refState.badAt = cs.t; }
    refState.rounds = cs.t;
  }
}
/* 分块计算: 每块只算几十毫秒就把控制权还给浏览器, 界面不会卡住.
 * "▶ 运行" 跟着屏幕刷新走 (速度滑杆 = 每帧用于计算的毫秒数);
 * "跑到结束" 用 setTimeout 连续跑, 每 ~80ms 重画一次, 标签页在后台时也不会停. */
let lastDraw = 0;
function tick() {
  if (!running) return;
  const t0 = performance.now(), budget = untilEnd ? 30 : +$('spd').value, endT = sc.years;
  let guard = 0;
  while (performance.now() - t0 < budget || guard < 1) {
    stepAll(); guard++;
    if (untilEnd && cs.T >= endT) { running = false; untilEnd = false; break; }
  }
  if (!running) $('btnRun').textContent = '▶ 运行';
  const now = performance.now();
  if (!running || !untilEnd || now - lastDraw > 80) { drawAll(); lastDraw = performance.now(); }
  if (running) untilEnd ? setTimeout(tick, 0) : requestAnimationFrame(tick);
}

/* ================= 画图 ================= */
const COL = { P: '#d2a032', Pbar: '#c09aff', e: '#7ec699', lag: '#ef6a5e', perc: '#b0645e', Vx: '#58a6ff', Vh: '#5fd0d0', W: '#d6dde5', U: '#8b97a5',
  x: '#58a6ff', d: '#d2a032', b: '#7ec699', xcTau: '#c09aff', xcMem: '#ef6a5e', grid: '#222a34', fg: '#8b97a5' };
const SLOW_LEGEND = [['P', 'P 处罚强度'], ['Pbar', 'P̄_eff 合法性界线'], ['e', 'e 表达比例'], ['lag', '‖s−θ‖ 滞后'], ['perc', '政权看到的滞后'], ['Vx', 'V_显'], ['Vh', 'V_隐'], ['W', 'W 绩效 (右轴)']];
const FAST_LEGEND = [['x', 'x 参与'], ['d', 'd 拒绝执行'], ['b', 'b̄ 积怨'], ['xcTau', '临界种子: 政权看到的 (右轴)'], ['xcMem', '临界种子: 真实的 (右轴)']];
function buildLegend(id, items) {
  const el = $(id);
  for (const [key, label] of items) {
    const s = document.createElement('span'); s.className = 'lg'; s.innerHTML = `<i style="background:${COL[key]}"></i>${label}`;
    s.onclick = () => { hidden.has(key) ? hidden.delete(key) : hidden.add(key); s.classList.toggle('hide', hidden.has(key)); drawAll(); };
    el.appendChild(s);
  }
}
function setupCanvas(cv) {
  const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = +cv.getAttribute('height');
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px'; }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
  ctx.font = '10px sans-serif';
  return [ctx, w, h];
}
function niceMax(v) { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
function viewRange(c) {
  const n = c.hist.t.length, Tnow = n / RPY, win = +$('win').value;
  const Tb = win ? Math.max(Tnow, Math.min(win, sc.years)) : Math.max(Tnow, sc.years), Ta = win ? Math.max(0, Tb - win) : 0;
  return { Ta, Tb, i0: Math.max(0, Math.floor(Ta * RPY)), i1: n };
}
/** 把 arr[i0..i1) 压到最多 cols 个点; mode 'max' 保留尖峰 */
function bucket(arr, i0, i1, cols, mode) {
  const n = i1 - i0, pts = [];
  if (n <= 0) return pts;
  const stride = Math.max(1, Math.ceil(n / cols));
  for (let i = i0; i < i1; i += stride) {
    const j = Math.min(i1, i + stride);
    let v = arr[j - 1];
    if (mode === 'max') { v = -Infinity; for (let q = i; q < j; q++) if (arr[q] > v) v = arr[q]; }
    pts.push([(j - 0.5 + (mode === 'max' ? 0 : 0.5)) / RPY, v]);
  }
  return pts;
}
/** 一个面板: 左右两套纵轴, 共用时间轴 */
function panel(ctx, R, V, left, right, o) {
  const X = (T) => R.x + (T - V.Ta) / (V.Tb - V.Ta) * R.w;
  const cols = Math.max(50, Math.floor(R.w));
  const prep = (ax) => {
    if (!ax) return null;
    let mx = ax.max || 0, mn = ax.min != null ? ax.min : 0;
    for (const s of ax.series) {
      s.pts = hidden.has(s.key) ? [] : (s.fn ? s.fn() : bucket(s.arr, V.i0, Math.min(V.i1, s.arr.length), cols, s.mode));
      if (ax.auto) for (const p of s.pts) if (p[1] > mx) mx = p[1];
    }
    if (ax.auto) mx = niceMax(mx * 1.02);
    if (ax.tight) {                        // 紧贴数据范围 (W 恒为负, 变化幅度远小于它离 0 的距离)
      let lo = Infinity, hi = -Infinity;
      for (const s of ax.series) for (const p of s.pts) { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; }
      if (lo > hi) { lo = -1; hi = 0; }
      const m = Math.max((hi - lo) * 0.08, 1e-4); mn = lo - m; mx = hi + m;
    }
    return { mn, mx, Y: (v) => R.y + R.h * (1 - (v - mn) / (mx - mn || 1)) };
  };
  const L = prep(left), Rt = prep(right);
  /* 朝代底带与改朝换代竖线 */
  if (o.bands) {
    const ends = cs.dynasties.map(d => d.endRound / RPY), starts = [0].concat(ends);
    for (let q = 0; q < starts.length; q++) {
      const a = Math.max(V.Ta, starts[q]), b = Math.min(V.Tb, q < ends.length ? ends[q] : V.i1 / RPY);
      if (b > a && q % 2 === 1) { ctx.fillStyle = 'rgba(255,255,255,0.035)'; ctx.fillRect(X(a), R.y, X(b) - X(a), R.h); }
    }
    for (const d of cs.dynasties) {
      const T = d.endRound / RPY; if (T < V.Ta || T > V.Tb) continue;
      ctx.strokeStyle = d.cause === 'x' ? 'rgba(88,166,255,0.8)' : d.cause === 'd' ? 'rgba(210,160,50,0.8)' : 'rgba(239,106,94,0.8)';
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(T), R.y); ctx.lineTo(X(T), R.y + R.h); ctx.stroke();
    }
  }
  if (o.shocks) {                          // 顶部红条: 冲击期
    const sh = cs.hist.shock; ctx.fillStyle = 'rgba(239,106,94,0.75)';
    const stride = Math.max(1, Math.ceil((V.i1 - V.i0) / cols));
    for (let i = V.i0; i < V.i1; i += stride) if (sh[i]) ctx.fillRect(X(i / RPY), R.y, Math.max(1, X((i + stride) / RPY) - X(i / RPY)), 3);
  }
  /* 网格与刻度 */
  ctx.strokeStyle = COL.grid; ctx.fillStyle = COL.fg; ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const y = R.y + R.h * i / 4; ctx.moveTo(R.x, y); ctx.lineTo(R.x + R.w, y);
    if (L) { const v = L.mx - (L.mx - L.mn) * i / 4; ctx.textAlign = 'right'; ctx.fillText(left.tight ? v.toFixed(3) : Math.abs(v) < 10 ? +v.toPrecision(2) : v.toFixed(0), R.x - 4, y + 3); }
    if (Rt) { const v = Rt.mx - (Rt.mx - Rt.mn) * i / 4; ctx.textAlign = 'left'; ctx.fillText(right.tight ? v.toFixed(3) : +v.toPrecision(2), R.x + R.w + 4, y + 3); }
  }
  ctx.stroke();
  if (o.xlabels) {
    ctx.textAlign = 'center';
    for (let i = 0; i <= 6; i++) { const T = V.Ta + (V.Tb - V.Ta) * i / 6; ctx.fillText(T.toFixed(T < 20 ? 1 : 0), X(T), R.y + R.h + 12); }
    ctx.textAlign = 'right'; ctx.fillText('年', R.x + R.w + 16, R.y + R.h + 12);
  }
  ctx.textAlign = 'left';
  /* 曲线 */
  ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y - 1, R.w, R.h + 2); ctx.clip();
  for (const [ax, sc2] of [[left, L], [right, Rt]]) {
    if (!ax) continue;
    for (const s of ax.series) {
      if (!s.pts.length) continue;
      ctx.strokeStyle = s.col; ctx.lineWidth = s.lw || 1.4; ctx.setLineDash(s.dash || []);
      ctx.beginPath(); let pen = false;
      for (const p of s.pts) {
        if (Number.isNaN(p[1]) || p[1] === -Infinity) { pen = false; continue; }
        const x = X(p[0]), y = sc2.Y(p[1]);
        pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y); pen = true;
      }
      ctx.stroke();
    }
  }
  ctx.restore(); ctx.setLineDash([]);
  if (o.title) { ctx.fillStyle = COL.fg; ctx.fillText(o.title, R.x + 6, R.y + 12); }
}
/** 闭式解曲线 (场景 ⑧) */
function closedPts(V, which) {
  const o = cs.o, pts = [], U = o.U0, h = o.h, v = o.env.v || 0, V0 = o.V0 != null ? o.V0 : Math.sqrt(U / h);
  const n = 240;
  for (let i = 0; i <= n; i++) {
    const T = V.Ta + (V.Tb - V.Ta) * i / n;
    pts.push([T, which === 'V' ? theory.Vt(V0, U, h, T) : theory.lagRiccati(v, V0, U, h, T)]);
  }
  return pts;
}
function drawSlow() {
  const [ctx, w, h] = setupCanvas($('chSlow')), V = viewRange(cs), H = cs.hist;
  const pad = { l: 34, r: 40, t: 8, b: 18 }, gap = 14, hA = Math.round((h - pad.t - pad.b - gap) * 0.55), hB = h - pad.t - pad.b - gap - hA;
  const A = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: hA }, B = { x: pad.l, y: pad.t + hA + gap, w: w - pad.l - pad.r, h: hB };
  const sa = cs.sim ? [
    { key: 'P', arr: H.P, col: COL.P, lw: 1.8 }, { key: 'Pbar', arr: H.PbarEff, col: COL.Pbar, dash: [4, 3] }, { key: 'e', arr: H.e, col: COL.e },
    { key: 'lag', arr: H.lag, col: COL.lag }, { key: 'perc', arr: H.percLag, col: COL.perc, dash: [2, 3] }] : [{ key: 'lag', arr: H.lag, col: COL.lag, lw: 1.8 }];
  if (sc.closedForm) sa.push({ key: 'lag', fn: () => closedPts(V, 'lag'), col: '#fff', dash: [5, 4], lw: 1 });
  panel(ctx, A, V, { auto: true, max: cs.sim ? 1 : 0, series: sa }, null, { bands: true, shocks: true, title: cs.sim ? '压制与滞后' : '滞后 ‖s−θ‖ (白色虚线: 闭式解)' });
  if (cs2) {                               // 对照场景: V_显 的变化只有百分之几, 左轴紧贴数据放大; V_隐 放右轴
    panel(ctx, B, V, { tight: true, series: [{ key: 'Vx', arr: H.Vx, col: COL.Vx, lw: 1.8 }, { key: 'Vx', arr: cs2.hist.Vx, col: COL.Vx, dash: [5, 4] }] },
      { auto: true, series: [{ key: 'Vh', arr: H.Vh, col: COL.Vh }, { key: 'Vh', arr: cs2.hist.Vh, col: COL.Vh, dash: [5, 4] }] },
      { bands: true, xlabels: true, title: `V_显 (左轴, 放大) 与 V_隐 (右轴): 实线 δ_h=${cs.o.deltaH}, 虚线 δ_h=${cs2.o.deltaH}` });
    return;
  }
  const sb = [{ key: 'Vx', arr: H.Vx, col: COL.Vx, lw: 1.8 }];
  if (!cs.par.direct) sb.push({ key: 'Vh', arr: H.Vh, col: COL.Vh });
  if (sc.closedForm) sb.push({ key: 'Vx', fn: () => closedPts(V, 'V'), col: '#fff', dash: [5, 4], lw: 1 });
  panel(ctx, B, V, { auto: true, series: sb }, { tight: true, series: [{ key: 'W', arr: H.W, col: COL.W, lw: 1 }] }, { bands: true, xlabels: true, title: '变异库与绩效' });
}
function drawFast() {
  const [ctx, w, h] = setupCanvas($('chFast'));
  if (!cs.sim) { ctx.fillStyle = COL.fg; ctx.font = '13px sans-serif'; ctx.fillText('standalone 模式: 没有快层, 表达比例 e ≡ 1.', 20, 40); return; }
  const V = viewRange(cs), H = cs.hist, R = { x: 34, y: 8, w: w - 34 - 40, h: h - 8 - 18 };
  const left = [{ key: 'x', arr: H.x, col: COL.x, lw: 1.8, mode: 'max' }, { key: 'd', arr: H.d, col: COL.d }, { key: 'b', arr: H.b, col: COL.b }];
  if (ref) left.push({ key: 'x', arr: ref.hist.x, col: '#fff', dash: [3, 4], lw: 1, mode: 'max' });
  panel(ctx, R, V, { auto: true, max: 0.1, series: left },
    { auto: true, series: [{ key: 'xcTau', arr: H.xcTau, col: COL.xcTau, dash: [4, 3] }, { key: 'xcMem', arr: H.xcMem, col: COL.xcMem }] }, { bands: true, xlabels: true, title: ref ? '白色虚线: 原版 Sim 的 x' : '' });
}
function drawPhase() {
  const [ctx, w, h] = setupCanvas($('chPhase')), H = cs.hist, sel = $('phaseSel').value;
  const map = { Pd: ['P', 'd', 'P', 'd'], Vb: ['Vx', 'b', 'V_显', 'b̄'], Wb: ['W', 'b', 'W', 'b̄'], Pe: ['P', 'e', 'P', 'e'] }[sel];
  const xa = H[map[0]], ya = H[map[1]], n = H.t.length, pad = { l: 40, r: 12, t: 10, b: 24 };
  if (n < 2) return;
  let x0 = Infinity, x1 = -Infinity, y0 = 0, y1 = 1e-6;
  for (let i = 0; i < n; i += RPY) { if (xa[i] < x0) x0 = xa[i]; if (xa[i] > x1) x1 = xa[i]; if (ya[i] > y1) y1 = ya[i]; if (ya[i] < y0) y0 = ya[i]; }
  if (x1 - x0 < 1e-9) { x0 -= 0.01; x1 += 0.01; }
  const mx = (x1 - x0) * 0.05; x0 -= mx; x1 += mx; y1 *= 1.08;
  const X = (v) => pad.l + (w - pad.l - pad.r) * (v - x0) / (x1 - x0), Y = (v) => pad.t + (h - pad.t - pad.b) * (1 - (v - y0) / (y1 - y0));
  ctx.strokeStyle = COL.grid; ctx.fillStyle = COL.fg; ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h - pad.t - pad.b) * i / 4, x = pad.l + (w - pad.l - pad.r) * i / 4;
    ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.moveTo(x, pad.t); ctx.lineTo(x, h - pad.b);
    ctx.textAlign = 'right'; ctx.fillText(+(y1 - (y1 - y0) * i / 4).toPrecision(2), pad.l - 4, y + 3);
    ctx.textAlign = 'center'; ctx.fillText(+(x0 + (x1 - x0) * i / 4).toPrecision(3), x, h - pad.b + 12);
  }
  ctx.stroke(); ctx.textAlign = 'left';
  ctx.fillText(map[3], pad.l + 4, pad.t + 10); ctx.textAlign = 'right'; ctx.fillText(map[2], w - pad.r - 2, h - pad.b - 5); ctx.textAlign = 'left';
  let prevDyn = -1; ctx.lineWidth = 1.2;
  for (let i = 0; i < n; i += RPY / 2) {
    const dyn = H.dyn[i];
    if (dyn !== prevDyn) { if (prevDyn >= 0) ctx.stroke(); ctx.beginPath(); ctx.strokeStyle = `hsl(${(210 + dyn * 47) % 360}, 65%, 62%)`; ctx.moveTo(X(xa[i]), Y(ya[i])); prevDyn = dyn; }
    else ctx.lineTo(X(xa[i]), Y(ya[i]));
  }
  ctx.stroke();
  ctx.beginPath(); ctx.arc(X(xa[n - 1]), Y(ya[n - 1]), 4.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
}
function drawFisher() {
  const [ctx, w, h] = setupCanvas($('chFisher')), F = window.Fisher, n = cs.par.n, dist = Math.max(cs.lag, 1e-4), pad = { l: 34, r: 12, t: 10, b: 24 };
  const rMax = 2.1 * dist, X = (r) => pad.l + (w - pad.l - pad.r) * r / rMax, Y = (p) => pad.t + (h - pad.t - pad.b) * (1 - p / 0.5);
  ctx.strokeStyle = COL.grid; ctx.fillStyle = COL.fg; ctx.beginPath();
  for (let i = 0; i <= 5; i++) { const y = pad.t + (h - pad.t - pad.b) * i / 5; ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.textAlign = 'right'; ctx.fillText((0.5 - 0.1 * i).toFixed(1), pad.l - 4, y + 3); }
  ctx.stroke(); ctx.textAlign = 'center';
  for (let i = 0; i <= 4; i++) ctx.fillText((rMax * i / 4).toPrecision(2), X(rMax * i / 4), h - pad.b + 12);
  ctx.textAlign = 'right'; ctx.fillText('步长 r', w - pad.r - 2, h - pad.b - 5); ctx.textAlign = 'left';
  const curve = (fn, col, dash, lw) => { ctx.strokeStyle = col; ctx.setLineDash(dash); ctx.lineWidth = lw; ctx.beginPath(); for (let i = 0; i <= 200; i++) { const r = rMax * i / 200, p = fn(r, dist, n); i ? ctx.lineTo(X(r), Y(p)) : ctx.moveTo(X(r), Y(p)); } ctx.stroke(); ctx.setLineDash([]); };
  curve(F.pBenNormal, COL.fg, [4, 4], 1);
  curve(F.pBen, COL.acc || '#58a6ff', [], 1.8);
  let tr = 0; for (let k = 0; k < n; k++) tr += cs.st.Vx[k];
  const rs = Math.sqrt(tr);                // 表达出来的变异的典型幅度
  if (rs < rMax) { ctx.strokeStyle = COL.P; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X(rs), pad.t); ctx.lineTo(X(rs), h - pad.b); ctx.stroke(); ctx.setLineDash([]); }
  ctx.fillStyle = COL.fg;
  ctx.fillText(`n = ${n},  ‖s−θ‖ = ${cs.lag.toFixed(3)}`, pad.l + 8, pad.t + 12);
  ctx.fillStyle = COL.P;
  ctx.fillText(`典型改革步长 √tr(V_显) = ${rs.toFixed(3)}: 有利概率 ${F.pBen(rs, dist, n).toFixed(3)}` + (rs >= rMax ? ' (步子已大于 2‖s−θ‖, 必然迈过头)' : ''), pad.l + 8, pad.t + 26);
}

/* ================= 状态栏与朝代表 ================= */
let lastDynCount = -1;
function updateStatus() {
  const items = [['年份', cs.T.toFixed(1)], ['朝代', '#' + (cs.dynasties.length + 1)]];
  if (cs.sim) items.push(['P', cs.P.toFixed(3)], ['P̄_eff', cs.PbarEff.toFixed(3)], ['e', cs.e.toFixed(3)]);
  items.push(['‖s−θ‖', cs.lag.toFixed(3)], ['ℓ', cs.ell.toFixed(4)], ['W', cs.W.toFixed(4)], ['V_显', cs.VxMean.toFixed(4)]);
  if (!cs.par.direct) items.push(['V_隐', cs.VhMean.toFixed(4)]);
  if (cs.sim) {
    const H = cs.hist, n = H.t.length, last = (a) => n ? a[n - 1] : 0;
    items.push(['x', last(H.x).toFixed(4)], ['d', last(H.d).toFixed(3)], ['b̄', last(H.b).toFixed(4)]);
    const N = cs.sim.o.N, a = cs._xcTau, b = cs._xcMem;
    items.push(['临界种子 (政权看到的 / 真实的)', (Number.isNaN(a) ? '—' : Math.round(a * N) + ' 人') + ' / ' + (Number.isNaN(b) ? '—' : Math.round(b * N) + ' 人')]);
  }
  let html = items.map(([k, v]) => `<span class="item">${k} <b>${v}</b></span>`).join('');
  if (ref) html += `<span class="item ${refState.ok ? 'ok' : 'alert'}">与原版 Sim <b>${refState.ok ? '逐位相同 ✓' : '出现差异 ✗ (第 ' + refState.badAt + ' 轮)'}</b> 已比较 ${refState.rounds} 轮</span>`;
  $('statusbar').innerHTML = html;
  $('progress').firstElementChild.style.width = Math.min(100, 100 * cs.T / sc.years) + '%';
  if (cs.dynasties.length !== lastDynCount) {
    lastDynCount = cs.dynasties.length;
    const causeName = { x: '人群越过临界点 (x)', d: '执行者倒戈 (d)', load: '负荷超限' };
    $('dynTable').querySelector('tbody').innerHTML = cs.dynasties.length ? cs.dynasties.map(d =>
      `<tr><td>${d.index + 1}</td><td>${(d.startRound / RPY).toFixed(0)}–${(d.endRound / RPY).toFixed(0)}</td><td>${d.years.toFixed(1)}</td><td>${d.Wpeak.toFixed(4)}</td><td>第 ${d.WpeakYear.toFixed(0)} 年</td><td>${d.VxAtWpeak.toFixed(4)}</td><td>${d.PAtWpeak.toFixed(2)}</td><td>${d.xMaxPre.toFixed(4)}</td><td>${d.PAtFall.toFixed(2)}</td><td>${d.bAtFall.toFixed(4)}</td><td>${d.VhAtFall.toFixed(4)}</td><td class="cause-${d.cause}">${causeName[d.cause]}</td></tr>`).join('')
      : '<tr><td colspan="12" style="text-align:center;color:var(--dim)">还没有发生改朝换代.</td></tr>';
  }
}
function drawAll() { if (!cs) return; updateStatus(); drawSlow(); drawFast(); drawPhase(); drawFisher(); }

function exportCsv() {
  const H = cs.hist, keys = ['t', 'T', 'P', 'PbarEff', 'e', 'lag', 'percLag', 'ell', 'vload', 'W', 'Vx', 'Vh', 'U', 'x', 'd', 'b', 'k', 'adapt', 'shock', 'dyn', 'xcTau', 'xcMem'];
  const lines = [keys.join(',')];
  for (let i = 0; i < H.t.length; i++) lines.push(keys.map(k => H[k][i]).join(','));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  a.download = `cycle_${curKey}_${Math.round(cs.T)}y.csv`;
  a.click();
}

/* ================= 装配 ================= */
window.addEventListener('DOMContentLoaded', () => {
  const sel = $('scenario');
  for (const [k, s] of Object.entries(SCENARIOS)) { const op = document.createElement('option'); op.value = k; op.textContent = s.name; sel.appendChild(op); }
  sel.value = curKey;
  sel.addEventListener('change', () => loadScenario(sel.value));
  buildKnobs(); buildLegend('lgSlow', SLOW_LEGEND); buildLegend('lgFast', FAST_LEGEND);
  $('btnRun').onclick = () => { running = !running; untilEnd = false; $('btnRun').textContent = running ? '⏸ 暂停' : '▶ 运行'; if (running) requestAnimationFrame(tick); };
  $('btnYear').onclick = () => { for (let i = 0; i < RPY; i++) stepAll(); drawAll(); };
  $('btnEnd').onclick = () => { if (cs.T >= sc.years) rebuild(); running = true; untilEnd = true; $('btnRun').textContent = '⏸ 暂停'; requestAnimationFrame(tick); };
  $('btnReset').onclick = () => rebuild();
  $('btnCsv').onclick = exportCsv;
  $('win').onchange = drawAll; $('phaseSel').onchange = drawAll;
  window.addEventListener('resize', drawAll);
  loadScenario(curKey);
});
