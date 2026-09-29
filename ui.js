/* 道路以目 · 沉默相变模拟器 —— UI 控制器
 * 依赖 model.js (window.SilenceSim)
 */
'use strict';
const { Sim, theory } = window.SilenceSim;
const $ = (id) => document.getElementById(id);

/* ================= 场景预设 ================= */
const SCENARIOS = {
  playground: {
    name: '① 操场算例:二十与二十一人',
    desc: '论文 p15–16 算例:千人,承受上限均匀,P=1,k=0.02。临界种子 x₋≈20.4 人。<b>投 20 人→熄灭;投 21 人→三轮内冲到 980 人。</b>这是“同样的沉默,不同的分界”。',
    opts: { N: 1000, tolType: 'uniform', netType: 'full', P: 1, Pbar: 0.5, K0: 20, M: 60, alpha: 0, beta: 0, delta: 0, gamma: 0, memDecay: 0.2, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0, targetMode: 'uniform', releaseProb: 0, seed: 7, d0: 0, psiScale: 1, noRemoval: true },
  },
  liwang: {
    name: '② 厉王弭谤:高压与沉默债务',
    desc: '处罚强(P=1.15)、承受上限整体压低(τ≤0.45)、针对组织者、宣传压缩。每轮 10 人例行小动作都会被压平——但记忆 b 在<b>看不见的地方累积</b>(性质二:镇压债务,看右下分布图整条带右漂)。债务够厚后投 80 人:成本线被压进分布带,点火。',
    opts: { N: 2000, tolType: 'low', netType: 'random', netDeg: 8, P: 1.15, Pbar: 0.6, K0: 40, M: 80, alpha: 0.2, beta: 0.4, delta: 0.3, gamma: 12, memDecay: 0.04, vis: 0.7, omega: 1, globalScale: 0.5, noise: 0, hardCore: 0.002, targetMode: 'organizer', netDamage: 0.6, releaseProb: 0.05, seed: 21, d0: 0, psiScale: 1 },
  },
  nowarn: {
    name: '③ 道路以目:沉默不发出预警',
    desc: '论文性质一(p6):执行者缓慢自我侵蚀(α=0, β=0.9, δ(P−P̄)₊=0.1),k_t=k₀·0.9ᵗ 几何收缩。公开参与<b>始终为 0</b>,低位扰动仍一轮恢复——但橙色虚线(临界种子)一路下滑。等它足够小,一次很小的行动就能点火。',
    opts: { N: 1000, tolType: 'uniform', netType: 'full', P: 1, Pbar: 0.5, K0: 20, M: 2000, alpha: 0, beta: 0.9, delta: 0.2, gamma: 0, memDecay: 0.2, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0, targetMode: 'uniform', releaseProb: 0, seed: 11, d0: 0, psiScale: 1, continuousK: true },
  },
  leipzig: {
    name: '④ 莱比锡周一示威 1989',
    desc: '完全混合口径下每周一轮 15 人例行集会,临界种子 x₋≈23 人——小行动连续 8 周被吸回(性质六)。第 9 周<b>“录像外泄”</b>:共同证据越出熟人圈,画面带来下周的出席潮(外生输入,模型不自己产生最初事件)——越过 x₋ 即点火。也可以不开录像,直接在第 9 周手动投 40 人以上。',
    opts: { N: 2000, tolType: 'uniform', netType: 'full', P: 1, Pbar: 0.55, K0: 24, M: 120, alpha: 0.12, beta: 0.55, delta: 0.12, gamma: 1.6, memDecay: 0.25, vis: 1, omega: 1, globalScale: 0.4, noise: 0, hardCore: 0.003, targetMode: 'uniform', releaseProb: 0.1, seed: 1989, d0: 0.02, psiScale: 1.2 },
    recur: { count: 15, every: 6 },
    plan: [{ at: 48, event: 'tvseed', count: 45 }],
  },
  petrograd: {
    name: '⑤ 彼得格勒 1917:两层反馈失稳',
    desc: '论文性质四(p9–10):群众与执行者两层。α 较大(人群规模冲击军心)、β 较大(同僚连锁)。投 40 人行动,观察 x 与 d 互相追逐放大——两层各自看似稳定,联结后整体失稳。兵变改变的不是新闻,是此后每一轮面对的 k。',
    opts: { N: 1500, tolType: 'bell', netType: 'full', P: 1, Pbar: 0.5, K0: 25, M: 150, alpha: 0.35, beta: 0.5, delta: 0.2, gamma: 1.5, memDecay: 0.3, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0.002, targetMode: 'uniform', releaseProb: 0.15, seed: 1917, d0: 0.05, psiScale: 1.3 },
  },
  bloody: {
    name: '⑥ 血腥星期日 1905:事件的双重作用',
    desc: '高压平静(P=1.1,双峰社会:激进派 0.78 / 温和派 0.28)。先开“例行小动作”跑十几轮——全部熄灭。然后按<b>“流血事件”</b>:处决越界,记忆陡增。结果取决于 μ=γw(P−P̄)₊·m(q)(性质三):债务把激进派推过门槛后连锁开始;把 γ 调小再重置,同样的流血只沉淀、无回响——“有人被激怒”不证明参与必然增加。',
    opts: { N: 2000, tolType: 'bimodal', netType: 'full', P: 1.1, Pbar: 0.5, K0: 22, M: 100, alpha: 0.25, beta: 0.45, delta: 0.2, gamma: 6, memDecay: 0.2, vis: 0.5, omega: 1, globalScale: 0.6, noise: 0, hardCore: 0.001, targetMode: 'uniform', releaseProb: 0.1, seed: 1905, d0: 0, psiScale: 1 },
  },
  martial: {
    name: '⑦ 波兰戒严 1981:斩首与断联',
    desc: 'K₀=45、执行者冻结(k 恒定)。执法方式=预防性拘捕:按 τ+b 排名不待参与即抓,每轮 45 人——它移除的是<b>分布的顶端</b>(p5:必须知道被移除者在分布的什么位置)。30 轮后看状态栏的临界种子 x₋:从约 46 人涨到 90 人。此时投 55 人——直接死掉;把执法方式改成均匀抽取、重建世界,同样的 55 人却点火。警力规模 k 是一阶杠杆,抓谁是二阶的构成效应。',
    opts: { N: 2000, tolType: 'uniform', netType: 'random', netDeg: 8, P: 1, Pbar: 0.5, K0: 45, M: 150, alpha: 0, beta: 0, delta: 0, gamma: 1.8, memDecay: 0.2, vis: 0.7, omega: 1, globalScale: 1, noise: 0, hardCore: 0.002, targetMode: 'preventive', netDamage: 0.3, releaseProb: 0.03, seed: 1981, d0: 0, psiScale: 1.1 },
  },
  granovetter: {
    name: '⑧ 格兰诺维特阶梯:差一人,断一条链',
    desc: '门槛 0..1 排成阶梯,只有 1 个永久参与者(K₀=5)。先投 4 人:不足 k=5,全员被抓,沉默。重置,投 8 人:x 越过 k,成本降到 0.625,高段门槛者加入,链逐级爬满直至 x₊≈0.995(性质八:阻挡扩散的常是中间没人接得上的空隙)。断链变体:把警力 K₀ 调到 12 再投 8 人。',
    opts: { N: 1000, tolType: 'ladder', netType: 'full', P: 1, Pbar: 2, K0: 5, M: 60, alpha: 0, beta: 0, delta: 0, gamma: 0, memDecay: 0.2, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0.001, targetMode: 'uniform', releaseProb: 0, seed: 1978, d0: 0, psiScale: 1 },
  },
  chehlom: {
    name: '⑨ 四十日纪念:延迟核',
    desc: '论文 p8 伊朗 1978:指数衰减解释不了“恰好四十日后再集会”。双峰社会,P̄=P(日常处罚全部合法→日常零记忆),ρ=0.5(快遗忘)。t=3 一次屠杀(流血事件,持续 2 轮——注意:种子在决策段才出现,处罚先于决定,事件必须覆盖两轮才能留下记忆)。之后一切归于沉寂,<b>直到约第 13 轮</b>:纪念峰把上尾人群整群推过门槛,无人组织也自燃。换成指数核重建:永远沉寂。这是“记忆核结构本身造成定时复发”的最纯演示。',
    opts: { N: 1500, tolType: 'bimodal', netType: 'random', netDeg: 8, P: 0.9, Pbar: 0.9, K0: 30, M: 80, alpha: 0.1, beta: 0.4, delta: 0.15, gamma: 1.2, memDecay: 0.5, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0.002, targetMode: 'uniform', releaseProb: 0.15, seed: 1978, d0: 0, psiScale: 1, kernel: 'memorial', memPeak: 10, memPeakAmp: 3.5 },
    plan: [{ at: 3, event: 'spikese', count: 40 }],
  },
  hysteresis: {
    name: '⑩ 双稳态与迟滞:k=0.2',
    desc: '论文性质十四(p19–20):k=0.2 时,降压到低态消失 P_↓=0.8 才跳升;升压到高态消失 P_↑=1.25 才跌落。用左侧 P 滑杆缓缓降(每次 −0.02,中间跑 25 轮),再缓缓升——同一条 P=0.9,系统可以停在 x=0.1 或 x≈0.765。<b>历史本身成为解释现状必需的信息。</b>',
    opts: { N: 1000, tolType: 'uniform', netType: 'full', P: 1.4, Pbar: 0.5, K0: 200, M: 60, alpha: 0, beta: 0, delta: 0, gamma: 0, memDecay: 0.2, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0, targetMode: 'uniform', releaseProb: 0, seed: 89, d0: 0, psiScale: 1, noRemoval: true },
    hint: '冻结切面(不实际移除被拘押者): 用 P 滑杆以 0.02 步长移动,每档跑 25 轮以上。',
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
  $('scenDesc').innerHTML = sc.desc + (sc.hint ? `<br><span style="color:var(--org)">玩法:${sc.hint}</span>` : '');
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
let game = null;   // 对局模式状态(非空时接管 sim)

function tick() {
  if (!running) return;
  const spd = +$('spd').value;
  for (let s = 0; s < spd; s++) {
    if (game) {
      game.step();
      if (game.over) { endGame(); break; }
      continue;
    }
    let seedCount = 0, seedMode = 'random';
    // 计划事件与种子
    for (const p of seedPlan) {
      if (p.at === sim.t) {
        if (p.event) fireEvent(p.event);
        if (p.count) { seedCount += p.count; seedMode = p.mode || 'random'; }
        p.done = true;
      }
    }    seedPlan = seedPlan.filter(p => !p.done);
    if (recur && sim.t > 0 && sim.t % recur.every === 0) seedCount += recur.count;
    if (pendingSeeds.length) { for (const ps of pendingSeeds) { seedCount += ps.count; seedMode = ps.mode; } pendingSeeds = []; }
    sim.step(seedCount, seedMode);
  }
  drawAll();
  if (game) drawGame();
  requestAnimationFrame(tick);
}

/* ================= 对局模式 ================= */
function startGame() {
  game = new window.SilenceGame.Game($('g_side').value, $('g_diff').value);
  sim = game.sim;                       // 接管主视图
  seedPlan = []; recur = null; pendingSeeds = [];
  bifCache.key = null; anaCache.data = null;
  $('g_status').style.display = 'block';
  $('g_hand').style.display = 'grid';
  $('g_news').style.display = 'block';
  $('g_goal').textContent = game.side === 'court' ? '🏛 压住局面' : '📣 点火成功';
  $('scenDesc').innerHTML = '<b>对局进行中。</b>出牌在左下角,AI 对手会自动行动。';
  renderHand(); drawGame(true);
  if (!running) { running = true; $('btnRun').textContent = '⏸ 暂停'; requestAnimationFrame(tick); }
}
function endGame() {
  running = false; $('btnRun').textContent = '▶ 运行';
  const o = game.over;
  const ov = $('g_overlay');
  ov.className = o.win ? 'win' : 'lose'; ov.style.display = 'flex';
  $('go_title').textContent = o.title;
  $('go_detail').textContent = o.detail;
  $('go_stats').textContent = o.stats || '';
}
function quitGame() {
  game = null;
  $('g_overlay').style.display = 'none';
  $('g_status').style.display = 'none';
  $('g_hand').style.display = 'none';
  $('g_news').style.display = 'none';
  applyScenario(curKey);
}
function renderHand() {
  const hand = game.hand();
  $('g_hand').innerHTML = '';
  for (const c of hand) {
    const b = document.createElement('button');
    const cd = game.cool[c.id] > 0 ? ` ⏳${game.cool[c.id]}` : '';
    b.innerHTML = `${c.name} <small>${c.desc} · ${c.cost}🎴${cd}</small>`;
    b.disabled = !game.canPlay(c);
    b.onclick = () => { if (game.play(c.id)) { renderHand(); drawGame(true); } };
    $('g_hand').appendChild(b);
  }
}
function drawGame(force) {
  $('g_ap').textContent = `🎴 行动点 ${game.ap}/${game.apCap}`;
  $('g_round').textContent = game.sim.t;
  $('g_news').innerHTML = game.news.join('<br>');
  if (force || frameNo % 10 === 0) renderHand();
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
  $('s_mu').textContent = mu.mu.toFixed(2) + (mu.mu > 1 ? ' >1 越压越反' : '');
  $('s_mu_item').classList.toggle('alert', mu.mu > 1);
  if (heavy) {
    const pts = getAnalysis(true).roots;
    const xc = pts.find(q => !q.boundary && !q.stable);
    $('s_xc').textContent = xc ? xc.x.toFixed(4) + ` (${Math.round(xc.x * sim.o.N)}人)` : '—(无高态)';
    // 低位恢复: F'(0+) 的线性化
    const F0 = sim.frozenF(1e-6, sim.eff().P, last(h.k));
    $('s_rec').textContent = F0 < 1e-9 ? '1 轮(F′=0)' : '~' + Math.max(1, Math.round(1 / (1 - Math.min(0.99, F0)))) + ' 轮';
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
  axes(ctx, w, h, pad, 1, 1, '轮');
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
  ctx.fillText(`轮 ${start}–${Math.max(start, n - 1)}`, pad.l + 4, pad.t + 10);
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
  ctx.fillText(`P=${P.toFixed(2)}  k=${k.toFixed(3)}  不动点:${pts.filter(q => !q.boundary).length}个`, pad.l + 4, pad.t + 10);
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
  ctx.fillText('蓝=稳定分支  橙=不稳定分支(临界种子)  白点=当前状态', pad.l + 4, pad.t + 10);
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
    ctx.fillText(`代价 c=${c.toFixed(3)}   μ=${mu.mu.toFixed(2)}${mu.mu > 1 ? ' → 事件将带来净增参与者' : ''}`, pad.l + 4, pad.t + 10);
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
  check('p16 算例: 21人起飞 48→580→966→980', near(seq[1] * 1000, 48, 2) && near(seq[2] * 1000, 580, 3) && near(seq[seq.length - 1], 0.97958, 0.001));
  check('p16 算例: 20人熄灭', theory.iterateUniform(0.02, 1, 0.02, 50) === 0);
  check('不动点解析值 x₋/x₊', near(theory.xMinus(1, 0.02), 0.02041685, 1e-6) && near(theory.xPlus(1, 0.02), 0.97958315, 1e-6));
  const eq = (xx, P, k) => theory.iterateUniform(xx, P, k, 400);
  let xx = 0.05, jd = null;
  for (let P = 1.6; P >= 0.6; P -= 0.01) { xx = eq(xx, P, 0.2); if (xx > 0.5 && !jd) jd = P; }
  check('迟滞: 降压在 P_↓≈0.8 跳升', jd && near(jd, 0.8, 0.03), `jd=${jd && jd.toFixed(2)}`);
  let u = eq(0.9, 0.6, 0.2), ju = null;
  for (let P = 0.6; P <= 1.35; P += 0.005) { u = eq(u, P, 0.2); if (u < 0.1 && !ju) ju = P; }
  check('迟滞: 升压在 P_↑≈1.25 跌落', ju && near(ju, 1.25, 0.02), `ju=${ju && ju.toFixed(2)}`);
  check('Catalan 级数', Math.abs(theory.xMinus(1, 0.001) - (0.001 + 1e-6 + 2e-9 + 5e-12 + 14e-15)) < 1e-15);
  const s5 = new Sim({ N: 10000, M: 600, K0: 200, tolType: 'uniform', P: 1, Pbar: 0.5, gamma: 2, memDecay: 0, alpha: 1, beta: 1, delta: 0, d0: 0.5, seed: 9 });
  const idx = Array.from({ length: 10000 }, (_, i) => i).sort((a, b) => s5.tau[b] - s5.tau[a]);
  for (let i = 0; i < 1000; i++) s5.a[idx[i]] = 1;
  const s5r = s5.step(0);
  check('p5 单轮算例: x′≈0.90, d′≈0.6, b̄≈0.01', near(s5r.x, 0.9, 0.005) && near(s5r.d, 0.6, 0.03) && near(s5r.bAvg, 0.01, 0.001));
  const se = new Sim({ N: 1000, K0: 20, M: 2000, tolType: 'uniform', P: 1, Pbar: 0.5, alpha: 0, beta: 0.9, delta: 0.2, d0: 0, continuousK: true, seed: 11 });
  let ok = true;
  for (let t = 1; t <= 10; t++) { const s = se.step(0); if (!near(s.k, 0.02 * Math.pow(0.9, t), 1e-3)) ok = false; }
  check('性质一: k_t 几何衰减且公开沉默', ok && se.meanU8(se.a) === 0);
  out.unshift(`结果: ${pass} 通过, ${fail} 失败`);
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
    $('btnRun').textContent = running ? '⏸ 暂停' : '▶ 运行';
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
    $('btnRecur').textContent = '例行小动作: ' + (recurOn ? `开(每轮${recur.count}人)` : '关');
  };
  $('btnTV').onclick = () => { fireEvent('tv'); };
  $('btnAmnesty').onclick = () => { fireEvent('amnesty'); };
  $('btnSpike').onclick = () => { fireEvent('spike'); };
  $('btnCrack').onclick = () => { fireEvent('crack'); };
  $('btnLink').onclick = () => {
    if (!sim.net) { $('scenDesc').insertAdjacentHTML('beforeend', '<br><span style="color:var(--red)">完全混合网络下没有可织的网(先换网络类型并重建)。</span>'); return; }
    const N = sim.o.N, n = Math.round(N * 0.4);
    for (let t = 0; t < n; t++) {
      const a = (sim.rng() * N) | 0, b = (sim.rng() * N) | 0;
      if (a !== b) { sim.net[a].push(b); sim.net[b].push(a); }
    }
  };
  $('btnTest').onclick = runInPageTests;

  $('btnGameStart').onclick = () => { quitGame(); startGame(); };
  $('btnGameEnd').onclick = () => { if (game) quitGame(); };
  $('go_again').onclick = () => { $('g_overlay').style.display = 'none'; startGame(); };
  $('go_back').onclick = () => quitGame();

  window.addEventListener('resize', drawAll);
  applyScenario('playground');
});
