/* 周期律耦合模型 · T6 涌现预测的批量报告
 * 运行: node cycle_report.js [seed 数=30] [每次运行的年数=1000] [--json 输出文件]
 *
 * T6 是科学预测, 不是验收条件: 这里只如实报告比例/效应量和 95% bootstrap 区间, 不判定通过与否.
 * 校准 (cE, etaP) 是在 seedSlow 5000–5002 / 快层 seed 100–102 上做的;
 * 本报告用的是 seedSlow 9000+ / 快层 seed 2000+, 校准时没有用过.
 * 每一项都给两套参数的结果: "初值" (cycle.js 的 DEFAULTS) 和 "校准" (DEFAULTS + CALIB).
 */
'use strict';
const path = __dirname + '/';
const fs = require('fs');
const { CycleSim, CYCLE_FAST, CALIB, SCENARIOS } = require(path + 'cycle.js');
const { mulberry32 } = require(path + 'model.js');

const args = process.argv.slice(2);
const jsonAt = args.indexOf('--json');
const jsonFile = jsonAt >= 0 ? args[jsonAt + 1] : null;
const nums = args.filter((a, i) => !(jsonAt >= 0 && (i === jsonAt || i === jsonAt + 1)));
const NSEED = +(nums[0] || 30), YEARS = +(nums[1] || 1000), RPY = 20;
const SHOCKS = SCENARIOS.cycle.opts.env;
const SETS = { '初值': {}, '校准': CALIB };
const OUT = { nSeeds: NSEED, years: YEARS, calib: CALIB, items: {} };

/* ---------- 统计工具 ---------- */
const mean = (a) => a.length ? a.reduce((p, q) => p + q, 0) / a.length : NaN;
const median = (a) => { if (!a.length) return NaN; const s = a.slice().sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const bootRng = mulberry32(424242);
/** 对"每个 seed 一个值"的统计量做 bootstrap, 返回 [点估计, 下界, 上界]. stat 默认是均值 */
function boot(vals, stat) {
  stat = stat || mean;
  const v = vals.filter(x => x !== null && !Number.isNaN(x));
  if (!v.length) return [NaN, NaN, NaN];
  const B = 2000, reps = new Float64Array(B);
  for (let b = 0; b < B; b++) { const s = []; for (let i = 0; i < v.length; i++) s.push(v[(bootRng() * v.length) | 0]); reps[b] = stat(s); }
  const sorted = Array.from(reps).sort((p, q) => p - q);
  return [stat(v), sorted[Math.floor(0.025 * B)], sorted[Math.floor(0.975 * B)]];
}
/** 聚类 bootstrap: groups 是"每个 seed 一组观测", 按 seed 重抽, 再对汇总后的观测求统计量 */
function bootCluster(groups, stat) {
  stat = stat || mean;
  const g = groups.filter(x => x && x.length);
  const all = [].concat(...g);
  if (!all.length) return [NaN, NaN, NaN];
  const B = 2000, reps = [];
  for (let b = 0; b < B; b++) { let s = []; for (let i = 0; i < g.length; i++) s = s.concat(g[(bootRng() * g.length) | 0]); reps.push(stat(s)); }
  reps.sort((p, q) => p - q);
  return [stat(all), reps[Math.floor(0.025 * B)], reps[Math.floor(0.975 * B)]];
}
function spearman(a, b) {
  const rank = (v) => { const idx = v.map((x, i) => i).sort((p, q) => v[p] - v[q]), r = new Float64Array(v.length); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && v[idx[j + 1]] === v[idx[i]]) j++; const rr = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]] = rr; i = j + 1; } return r; };
  const ra = rank(a), rb = rank(b), n = a.length;
  let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += ra[i]; mb += rb[i]; } ma /= n; mb /= n;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (ra[i] - ma) * (rb[i] - mb); saa += (ra[i] - ma) ** 2; sbb += (rb[i] - mb) ** 2; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
}
const f = (x, d) => (x === null || Number.isNaN(x)) ? '  —  ' : x.toFixed(d === undefined ? 2 : d);
const ci = (t, d) => `${f(t[0], d)} [${f(t[1], d)}, ${f(t[2], d)}]`;
const pct = (t) => `${f(100 * t[0], 0)}% [${f(100 * t[1], 0)}%, ${f(100 * t[2], 0)}%]`;
const head = (s) => console.log('\n' + '='.repeat(8) + ' ' + s + ' ' + '='.repeat(8));

function make(set, over, s) {
  const fast = Object.assign({}, CYCLE_FAST, { seed: 2000 + s }, (over && over.fast) || {});
  return new CycleSim(Object.assign({ env: SHOCKS, seedSlow: 9000 + s }, SETS[set], over || {}, { fast }));
}

/* ---------- 周期律场景: 三种政权 × 两套参数, 同一批 seed (同一 seed 的环境完全相同) ---------- */
const t0 = Date.now();
const RUNS = {};     // RUNS[set][regime][seed] = 提炼后的结果 (不保留整段 hist)
function digest(c) {
  const h = c.hist, D = c.dynasties, n = h.t.length;
  const res = { n: D.length, dyn: D, meanW: mean(h.W), maxW: Math.max(...h.W), meanP: mean(h.P), meanE: mean(h.e), firstFall: D.length ? D[0].years : null, perDyn: [], found: [] };
  for (let q = 0; q < D.length; q++) {
    const d = D[q], i0 = d.startRound, i1 = d.endRound - 1;          // hist 下标 = 轮次 − 1; 朝代覆盖 (i0 .. i1]
    if (d.years < 20) continue;
    /* T6.3: 按年取样 */
    const W = [], Vx = [], nl = [];
    for (let i = i0 + RPY - 1; i <= i1; i += RPY) { W.push(h.W[i]); Vx.push(h.Vx[i]); nl.push(-h.ell[i]); }
    const vmin = Math.min(...Vx), vmax = Math.max(...Vx);
    /* T6.4: 倒台前 30 年 (不含最后 1 年) */
    const a = Math.max(i0, i1 - 30 * RPY), bEnd = i1 - RPY;
    let quiet = 0, cnt = 0; for (let i = a; i <= bEnd; i++) { cnt++; if (h.x[i] <= 0.01) quiet++; }
    res.perDyn.push({ years: d.years, cause: d.cause, rhoWV: spearman(W, Vx), rhoLV: spearman(nl, Vx), posVatWpeak: vmax > vmin ? (d.VxAtWpeak - vmin) / (vmax - vmin) : NaN, vRange: (vmax - vmin) / vmin,
      wPeakPos: d.WpeakYear / d.years, vMinPos: d.VxMinYear / d.years, quiet: cnt ? quiet / cnt : NaN, bUp: h.b[bEnd] > h.b[a] ? 1 : 0, vhUp: h.Vh[bEnd] > h.Vh[a] ? 1 : 0,
      bRise: h.b[bEnd] - h.b[a], vhRatio: h.Vh[bEnd] / h.Vh[a], xcGap: NaN });
    /* T6.6: 倒台前后各 10 年 (要求下一个朝代至少撑 10 年, 而且这段记录在 hist 里) */
    const after1 = i1 + 10 * RPY, nextEnd = q + 1 < D.length ? D[q + 1].endRound - 1 : n - 1;
    if (after1 <= nextEnd && after1 < n) {
      let sb = 0, sa = 0, rb = 0, ra = 0, m = 0;
      for (let k = 1; k <= 10 * RPY; k++) { const ib = i1 - k, ia = i1 + k; sb += h.adapt[ib]; sa += h.adapt[ia]; rb += h.adapt[ib] / Math.max(h.lag[ib], 1e-9); ra += h.adapt[ia] / Math.max(h.lag[ia], 1e-9); m++; }
      res.found.push({ speed: sa / sb, rate: ra / rb });
    }
  }
  return res;
}
head(`周期律场景: ${NSEED} 个 seed × ${YEARS} 年 × 3 种政权 × 2 套参数`);
for (const set of Object.keys(SETS)) {
  RUNS[set] = {};
  for (const regime of ['myopic', 'zhaogong', 'farsighted']) {
    RUNS[set][regime] = [];
    for (let s = 0; s < NSEED; s++) RUNS[set][regime].push(digest(make(set, { regime }, s).run(RPY * YEARS)));
    process.stdout.write(`  ${set}/${regime} 完成 (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
}

/* ---------- T6.1 ---------- */
head('T6.1 周期律场景下, 平均每次运行的改朝换代次数 (预测: ≥ 2)');
OUT.items.t61 = {};
for (const set of Object.keys(SETS)) for (const regime of ['myopic', 'zhaogong', 'farsighted']) {
  const R = RUNS[set][regime];
  const n = boot(R.map(r => r.n)), ge2 = boot(R.map(r => r.n >= 2 ? 1 : 0));
  const all = [].concat(...R.map(r => r.dyn));
  const byX = all.filter(d => d.cause === 'x').length, byD = all.filter(d => d.cause === 'd').length, short = all.filter(d => d.years < 5).length;
  console.log(`  ${set} ${regime.padEnd(10)} 次数=${ci(n, 1)}  至少 2 次的运行占 ${pct(ge2)}  触发: x ${byX} 次, d ${byD} 次  其中不到 5 年的短命朝代 ${short} 个`);
  OUT.items.t61[set + '/' + regime] = { n, ge2, byX, byD, short };
}

/* ---------- T6.2 ---------- */
head('T6.2 棘轮: 平静期 (v=0) 内短视政权的 P 上升, e 下降? (前 60 年的变化量)');
OUT.items.t62 = { main: {}, scan: [] };
for (const set of Object.keys(SETS)) {
  const dP = [], dE = [];
  for (let s = 0; s < NSEED; s++) {
    const c = make(set, { regime: 'myopic', env: { type: 'static' }, revolution: false, recordEvery: RPY }, s);
    const P0 = c.P, e0 = c.e; c.run(RPY * 60);
    dP.push(c.P - P0); dE.push(c.e - e0);
  }
  const a = boot(dP), b = boot(dE), up = boot(dP.map(v => v > 0 ? 1 : 0));
  console.log(`  ${set}: ΔP=${ci(a, 3)}  Δe=${ci(b, 3)}  P 上升的运行占 ${pct(up)}`);
  OUT.items.t62.main[set] = { dP: a, dE: b, up };
}
console.log('  -- 扫描执法成本 c_E (η_P=1, 单个 seed; 这一项几乎是确定性的): 前 60 年 P 的平均年变化 --');
console.log('     c_E      短视 δ_h=0   远见 δ_h=0   短视 δ_h=0.2  远见 δ_h=0.2');
for (const cE of [0, 0.0005, 0.001, 0.002, 0.004, 0.008, 0.016, 0.05]) {
  const row = [];
  for (const dh of [0, 0.2]) for (const regime of ['myopic', 'farsighted']) {
    const c = new CycleSim({ regime, cE, etaP: 1, deltaH: dh, env: { type: 'static' }, revolution: false, seedSlow: 9000, recordEvery: RPY, Pmax: 5, fast: Object.assign({}, CYCLE_FAST, { seed: 2000, alpha: 0, beta: 0, delta: 0, P: 0.6 }) });
    const P0 = c.P; c.run(RPY * 60); row.push((c.P - P0) / 60);
  }
  console.log(`     ${String(cE).padEnd(7)}  ${row.map(v => (v >= 0 ? '+' : '') + v.toFixed(4)).join('      ')}`);
  OUT.items.t62.scan.push({ cE, myopic0: row[0], far0: row[1], myopic02: row[2], far02: row[3] });
}

/* ---------- T6.3 ---------- */
head('T6.3 "f 最高时 G 最小": 每个朝代里 W 峰值附近 V_显 是否接近该朝代的最小值 (只统计 ≥ 20 年的朝代)');
OUT.items.t63 = {};
for (const set of Object.keys(SETS)) {
  const R = RUNS[set].myopic, G = (key) => R.map(r => r.perDyn.map(d => d[key]).filter(v => !Number.isNaN(v)));
  const nd = [].concat(...G('rhoWV')).length;
  if (!nd) { console.log(`  ${set} 短视: 没有 ≥ 20 年且已结束的朝代, 无法统计`); OUT.items.t63[set] = null; continue; }
  const o = { nDyn: nd, rhoWV: bootCluster(G('rhoWV'), median), rhoLV: bootCluster(G('rhoLV'), median), pos: bootCluster(G('posVatWpeak'), median), range: bootCluster(G('vRange'), median), wPeakPos: bootCluster(G('wPeakPos'), median), vMinPos: bootCluster(G('vMinPos'), median) };
  console.log(`  ${set} 短视 (${nd} 个朝代):`);
  console.log(`     Spearman(W, V_显) 中位数 = ${ci(o.rhoWV)}      <- 注意: W 的定义里直接含 −½tr(H·V_显), 这一项有一部分是定义带来的`);
  console.log(`     Spearman(−ℓ, V_显) 中位数 = ${ci(o.rhoLV)}     <- 不含定义性成分的版本`);
  console.log(`     W 峰值时 V_显 在本朝代 [最小, 最大] 区间里的位置 (0 = 正好最小) = ${ci(o.pos)}`);
  console.log(`     一个朝代内 V_显 的相对变化幅度 (最大−最小)/最小 = ${ci(o.range, 3)}`);
  console.log(`     W 峰值出现在朝代的 ${ci(o.wPeakPos)} 处, V_显 最小值出现在 ${ci(o.vMinPos)} 处 (0 = 开国, 1 = 倒台)`);
  OUT.items.t63[set] = o;
}

/* ---------- T6.4 ---------- */
head('T6.4 沉默不发出预警: 倒台前 30 年 (不含最后 1 年) x 是否接近 0, 同时 b̄ 和 V_隐 在上升');
OUT.items.t64 = {};
for (const set of Object.keys(SETS)) {
  const R = RUNS[set].myopic, G = (key) => R.map(r => r.perDyn.map(d => d[key]).filter(v => !Number.isNaN(v)));
  const nd = [].concat(...G('quiet')).length;
  if (!nd) { console.log(`  ${set} 短视: 没有可统计的朝代`); OUT.items.t64[set] = null; continue; }
  const o = { nDyn: nd, quiet: bootCluster(G('quiet')), bUp: bootCluster(G('bUp')), vhUp: bootCluster(G('vhUp')), bRise: bootCluster(G('bRise'), median), vhRatio: bootCluster(G('vhRatio'), median) };
  console.log(`  ${set} 短视 (${nd} 个朝代): x ≤ 0.01 的轮次占 ${pct(o.quiet)};  b̄ 上升的朝代占 ${pct(o.bUp)} (中位数增量 ${ci(o.bRise, 3)});  V_隐 上升的朝代占 ${pct(o.vhUp)} (中位数倍数 ${ci(o.vhRatio)})`);
  OUT.items.t64[set] = o;
}

/* ---------- T6.5 ---------- */
head(`T6.5 三种政权的寿命与绩效 (同一批环境; 没倒台的按 ${YEARS} 年截尾)`);
OUT.items.t65 = {};
for (const set of Object.keys(SETS)) {
  const life = (r) => r.firstFall === null ? YEARS : r.firstFall;
  const M = RUNS[set].myopic;
  for (const regime of ['myopic', 'zhaogong', 'farsighted']) {
    const R = RUNS[set][regime];
    const o = { firstLife: boot(R.map(life)), censored: R.filter(r => r.firstFall === null).length, falls: boot(R.map(r => r.n)), maxW: boot(R.map(r => r.maxW)), meanW: boot(R.map(r => r.meanW)), meanP: boot(R.map(r => r.meanP)), meanE: boot(R.map(r => r.meanE)),
      lifeVsMyopic: boot(R.map((r, i) => life(r) - life(M[i]))), maxWVsMyopic: boot(R.map((r, i) => r.maxW - M[i].maxW)), meanWVsMyopic: boot(R.map((r, i) => r.meanW - M[i].meanW)) };
    console.log(`  ${set} ${regime.padEnd(10)} 第一个朝代的寿命=${ci(o.firstLife, 0)} 年 (${o.censored}/${NSEED} 次没倒台)  峰值 W=${ci(o.maxW, 3)}  平均 W=${ci(o.meanW, 3)}  平均 P=${f(o.meanP[0])}  平均 e=${f(o.meanE[0])}`);
    if (regime !== 'myopic') console.log(`  ${''.padEnd(set.length + 11)} 相对短视 (配对差): 寿命 ${ci(o.lifeVsMyopic, 0)} 年, 峰值 W ${ci(o.maxWVsMyopic, 4)}, 平均 W ${ci(o.meanWVsMyopic, 4)}`);
    OUT.items.t65[set + '/' + regime] = o;
  }
}

/* ---------- T6.6 ---------- */
head('T6.6 开国效应: 改朝换代后最初 10 年的适应速度是否高于倒台前 10 年');
OUT.items.t66 = {};
for (const set of Object.keys(SETS)) {
  const R = RUNS[set].myopic, sp = R.map(r => r.found.map(q => q.speed)), rt = R.map(r => r.found.map(q => q.rate));
  const n = [].concat(...sp).length;
  if (!n) { console.log(`  ${set} 短视: 没有可统计的改朝换代`); OUT.items.t66[set] = null; continue; }
  const o = { n, speed: bootCluster(sp, median), speedUp: bootCluster(sp.map(g => g.map(v => v > 1 ? 1 : 0))), rate: bootCluster(rt, median), rateUp: bootCluster(rt.map(g => g.map(v => v > 1 ? 1 : 0))) };
  console.log(`  ${set} 短视 (${n} 次改朝换代):`);
  console.log(`     适应速度 ‖ds/dT‖ 之比 (后/前) 中位数 = ${ci(o.speed)}, 大于 1 的占 ${pct(o.speedUp)}     <- 含"乱世跳动把滞后拉大"的贡献`);
  console.log(`     单位滞后的适应速率 (≈ V_显·h·感知折扣) 之比 中位数 = ${ci(o.rate)}, 大于 1 的占 ${pct(o.rateUp)}     <- 只剩"隐藏变异释放"和"雾散了"的贡献`);
  OUT.items.t66[set] = o;
}

/* ---------- T6.7 ---------- */
head('T6.7 δ_h=0 对比 δ_h>0: 压制的长期效果 (P 固定, 不调; 把 P 从 0.4 提到 1.5 后的变异负荷变化)');
OUT.items.t67 = {};
for (const dh of [0, 0.2]) {
  const longRun = [], dip = [], hid = [];
  for (let s = 0; s < NSEED; s++) {
    const mk = () => new CycleSim({ evolveP: false, revolution: false, kappa: 0, lambdaW: 0, chi: 0, deltaL: 0, betaFog: 0, u0: 0, deltaH: dh, env: { type: 'static' }, seedSlow: 9000 + s, recordEvery: RPY, fast: Object.assign({}, CYCLE_FAST, { seed: 2000 + s, alpha: 0, beta: 0, delta: 0 }) });
    const c = mk(); c.run(RPY * 50);
    const v0 = c.vload, h0 = c.VhMean; c.sim.o.P = 1.5;
    let minV = v0; for (let y = 0; y < 400; y++) { c.run(RPY); if (c.vload < minV) minV = c.vload; }
    longRun.push((c.vload - v0) / v0); dip.push((minV - v0) / v0); hid.push(c.VhMean / h0);
  }
  const o = { longRun: boot(longRun), dip: boot(dip), hid: boot(hid) };
  console.log(`  δ_h=${dh}: 400 年后变异负荷的相对变化 = ${ci(o.longRun.map(v => 100 * v), 2)}%   期间最深的暂态下探 = ${ci(o.dip.map(v => 100 * v), 2)}%   V_隐 变为原来的 ${ci(o.hid)} 倍`);
  OUT.items.t67['dh' + dh] = o;
}
console.log('  -- 周期律场景里把 δ_h 改成 0.2 (校准参数), 三种政权的改朝换代次数 --');
for (const regime of ['myopic', 'zhaogong', 'farsighted']) {
  const ns = [], ps = [];
  for (let s = 0; s < NSEED; s++) { const c = make('校准', { regime, deltaH: 0.2, recordEvery: RPY }, s).run(RPY * YEARS); ns.push(c.dynasties.length); ps.push(mean(c.hist.P)); }
  const o = { n: boot(ns), meanP: boot(ps) };
  console.log(`     ${regime.padEnd(10)} 次数=${ci(o.n, 1)}  平均 P=${ci(o.meanP)}`);
  OUT.items.t67['cycle02/' + regime] = o;
}

/* ---------- 补充: 两个敏感性检查 (校准参数, 短视政权) ---------- */
head('补充 A: 开国效应里有多少来自"雾散了" (C6), 有多少来自隐藏变异释放? 关掉 C6 重跑');
{
  const R = []; for (let s = 0; s < NSEED; s++) R.push(digest(make('校准', { regime: 'myopic', betaFog: 0 }, s).run(RPY * YEARS)));
  const rt = R.map(r => r.found.map(q => q.rate)), n = [].concat(...rt).length;
  const o = n ? { n, rate: bootCluster(rt, median), rateUp: bootCluster(rt.map(g => g.map(v => v > 1 ? 1 : 0))), falls: boot(R.map(r => r.n)) } : null;
  if (o) console.log(`  β_fog=0 (${n} 次改朝换代, 每次运行 ${ci(o.falls, 1)} 次): 单位滞后的适应速率之比 中位数 = ${ci(o.rate, 3)}, 大于 1 的占 ${pct(o.rateUp)}`);
  else console.log('  β_fog=0: 没有可统计的改朝换代');
  OUT.items.suppFog = o;
}
head('补充 B: 倒台是不是卡在 P_max 上? (执行者倒戈大约需要 P − P̄_eff ≈ 1.4, 而 P_max=2 只比它高一点)');
OUT.items.suppPmax = {};
for (const Pmax of [1.7, 2.0, 3.0]) {
  const ns = [], never = [];
  for (let s = 0; s < NSEED; s++) { const c = make('校准', { regime: 'myopic', Pmax, recordEvery: RPY }, s).run(RPY * YEARS); ns.push(c.dynasties.length); never.push(c.dynasties.length === 0 ? 1 : 0); }
  const o = { n: boot(ns), never: boot(never) };
  console.log(`  P_max=${Pmax}: 改朝换代次数=${ci(o.n, 1)}, ${YEARS} 年里一次都没倒台的运行占 ${pct(o.never)}`);
  OUT.items.suppPmax['Pmax' + Pmax] = o;
}

console.log(`\n总用时 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (jsonFile) { fs.writeFileSync(jsonFile, JSON.stringify(OUT, null, 1)); console.log('已写入 ' + jsonFile); }
