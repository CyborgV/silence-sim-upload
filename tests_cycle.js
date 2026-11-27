/* 周期律耦合模型自检 (硬测试 T1–T5; T6 是科学预测, 见 cycle_report.js)
 * 运行: node tests_cycle.js            全部
 *       node tests_cycle.js T2 T3      只跑指定小节
 */
'use strict';
const path = __dirname + '/';
const fs = require('fs');
const Fisher = require(path + 'fisher.js');
const { Sim } = require(path + 'model.js');
const { CycleSim, theory: th, OFF, CYCLE_FAST } = require(path + 'cycle.js');

const only = process.argv.slice(2).map(s => s.toUpperCase());
const want = (id) => !only.length || only.includes(id);
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}${detail ? `  [${detail}]` : ''}`); }
  else { fail++; console.log(`  ✗ ${name}  ${detail || ''}`); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* ================= T1 快层无损 (L1) ================= */
const sameArr = (A, B) => { if (A.length !== B.length) return false; for (let i = 0; i < A.length; i++) if (!Object.is(A[i], B[i])) return false; return true; };
/** 两个 Sim 的全部动态状态是否逐位相同; 返回第一处不同的名字, 全同返回 null */
function simDiff(A, B) {
  for (const key of ['t', 'x', 'd', 'p', 'k', 'b', 'R']) if (!sameArr(A.hist[key], B.hist[key])) return 'hist.' + key;
  for (const key of ['a', 'b', 'r', 'z', 'latent', 'flagged', 'psi', 'tau']) if (!sameArr(A[key], B[key])) return key;
  if (A.Ehist.length !== B.Ehist.length) return 'Ehist.length';
  for (let h = 0; h < A.Ehist.length; h++) if (!sameArr(A.Ehist[h], B.Ehist[h])) return 'Ehist[' + h + ']';
  for (const key of ['P', 'Pbar', 'K0']) if (!Object.is(A.o[key], B.o[key])) return 'o.' + key;
  if (!Object.is(A.R, B.R) || A.t !== B.t) return 'R/t';
  if (A.rng() !== B.rng()) return 'rng 流的位置';        // 两边各取一个数: 流的位置也必须一致
  return null;
}
if (want('T1')) {
  console.log('【T1】快层无损 (L1): 全部耦合取关闭值时, CycleSim 与原版 Sim 逐位相同');
  const { mulberry32 } = require(path + 'model.js');
  const src = fs.readFileSync(path + 'lab.js', 'utf8');
  const SCENARIOS = eval('(' + src.match(/const SCENARIOS = \{[\s\S]*?\n\};/)[0].replace('const SCENARIOS = ', '').replace(/;$/, '') + ')');
  const ROUNDS = 500;
  /** 同时驱动参照 Sim 与 CycleSim: 场景自带的例行种子/计划 + 随机种子注入 + 外生事件 (大赦, P 覆盖, 直接改 o.P) */
  function runPair(opts, cyc, sc, driveSeed, feedBack) {
    const ref = new Sim(opts), cs = new CycleSim(Object.assign({}, OFF, cyc, { fast: Object.assign({}, opts) }));
    const rnd = mulberry32(driveSeed);
    let slowMoved = false;
    for (let t = 0; t < ROUNDS; t++) {
      let count = 0, mode = 'random';
      if (sc.recur && t > 0 && t % sc.recur.every === 0) count += sc.recur.count;
      for (const p of (sc.plan || [])) if (p.at === t && p.count) count += p.count;
      if (rnd() < 0.08) { count += 1 + ((rnd() * 60) | 0); mode = rnd() < 0.3 ? 'near' : 'random'; }
      const u = rnd();
      for (const s of [ref, cs.sim]) {
        if (u < 0.01) s.pushEvent({ rounds: 1, amnesty: true });
        else if (u < 0.03) s.pushEvent({ rounds: 1 + ((u * 1000) | 0) % 3, P: s.o.P * (0.5 + 50 * u), vis: 1 });
        else if (u < 0.04) s.o.P = opts.P * (0.7 + 20 * (u - 0.03));        // 像 tune.js 的迟滞实验那样从外部直接改 P
      }
      cs.step(count, mode);
      if (feedBack) ref.step(cs.lastSeedCount, cs.lastSeedMode);           // 背景种子打开时: 把同一串种子数喂给参照
      else ref.step(count, mode);
      if (cs.lag > 0) slowMoved = true;
    }
    return { diff: simDiff(ref, cs.sim), slowMoved, cs };
  }
  const envA = { type: 'shocks', vCalm: 0.01, vShock: 0.2, durMin: 2, durMax: 5, meanGap: 6, sigmaTheta: 0.02 };
  let runs = 0, bad = [], moved = 0;
  for (const [key, sc] of Object.entries(SCENARIOS)) {
    let ok = true;
    for (let j = 0; j < 5; j++) {
      const opts = Object.assign({}, sc.opts, { seed: sc.opts.seed + 101 * j });
      const variants = [
        [opts, { seedSlow: 900 + j, env: envA, critEvery: 5 }, false],                                       // 慢层照常演化, 并频繁调用只读的分析工具
        [opts, { seedSlow: 900 + j, env: envA, poolMode: 'direct', deltaH: 0.3, u0: 1.5 }, true],            // 背景种子打开 (喂回参照)
      ];
      if (j < 2 && opts.kernel !== 'memorial') variants.push([Object.assign({}, opts, { kernel: 'memorial', memPeak: 8, memPeakAmp: 2 }), { seedSlow: 900 + j, env: envA }, false]);
      for (const [o2, cyc, fb] of variants) {
        const r = runPair(o2, cyc, sc, 7000 + 13 * j, fb);
        runs++; if (r.slowMoved) moved++;
        if (r.diff) { ok = false; bad.push(`${key}#${j}: ${r.diff}`); }
      }
    }
    check(`${sc.name.replace(/:.*/, '')}: 5 个 seed × ${ROUNDS} 轮逐位相同`, ok, ok ? '' : bad.join('; '));
  }
  check(`合计 ${runs} 对运行 (含 memorial 核, 随机种子注入, 大赦, P 覆盖, 外部改 o.P, 背景种子)`, bad.length === 0, bad.slice(0, 3).join('; '));
  check('期间慢层确实在演化 (不是因为什么都没发生才相同)', moved === runs, `${moved}/${runs} 次运行里滞后 > 0`);
  {
    // 反例对照: 任何一条慢→快通道打开, 逐位相同就应当被打破 (证明上面的比较有分辨力)
    const sc = SCENARIOS.liwang, opts = Object.assign({}, sc.opts);
    const broke = [];
    for (const [name, cyc] of [['C1', { kappa: 0.5 }], ['C2', { evolveP: true, Pmin: 0.5, cE: 0.5 }], ['C3', { lambdaW: 0.5 }], ['C4 财政', { chi: 0.5 }], ['C4 军心', { deltaL: 0.5 }]]) {
      const r = runPair(opts, Object.assign({ seedSlow: 3, env: envA }, cyc), sc, 7000, false);
      if (r.diff) broke.push(name);
    }
    check('反例对照: 单独打开 C1/C2/C3/C4 任何一条, 快层轨迹都会改变', broke.length === 5, `被打破的: ${broke.join(', ')}`);
    const r6 = runPair(opts, { seedSlow: 3, env: envA, betaFog: 0.9 }, sc, 7000, false);
    check('C6 只影响慢层: 单独打开它, 快层仍逐位相同', r6.diff === null);
  }
  /* 红线 1: 现有文件与基线逐字节一致 */
  try {
    const cp = require('child_process'), crypto = require('crypto');
    const git = (args) => cp.execFileSync('git', args, { cwd: __dirname, encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'] });
    let base = '6d9c2e1ea4fa32c1d6676a67ea17e4c434515e75';      // 开工时的提交 (远端没有 main 分支)
    try { base = git(['rev-parse', '--verify', '-q', 'main']).toString().trim() || base; } catch (e) { /* 没有 main, 用上面的提交 */ }
    const files = git(['-c', 'core.quotepath=false', 'ls-tree', '-r', '--name-only', '-z', base]).toString('utf8').split('\0').filter(Boolean);
    const changed = [];
    for (const f of files) {
      if (!fs.existsSync(path + f)) { changed.push(f + ' (被删除)'); continue; }
      const want2 = git(['rev-parse', `${base}:${f}`]).toString().trim();
      const have = git(['hash-object', '--', f]).toString().trim();
      if (want2 !== have) changed.push(f);
    }
    check(`红线 1: 基线 ${base.slice(0, 7)} 的全部 ${files.length} 个文件内容未变 (git blob 逐一比对)`, changed.length === 0, changed.slice(0, 5).join(', '));
    const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
    const lf = (buf) => Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');       // 检出时的换行符转换不算改动
    const named = ['model.js', 'engine.js', 'levels.js', 'app.js', 'city.js', 'lab.js', 'timelines.js'];
    const mism = named.filter(f => sha(git(['cat-file', 'blob', `${base}:${f}`])) !== sha(lf(fs.readFileSync(path + f))));
    check('红线 1: model/engine/levels/app/city/lab/timelines 的 sha256 与基线一致', mism.length === 0, mism.join(', ') || `model.js sha256=${sha(lf(fs.readFileSync(path + 'model.js'))).slice(0, 16)}…`);
  } catch (e) {
    console.log(`  - 红线 1 的文件比对跳过 (这里没有可用的 git 仓库: ${String(e.message).split('\n')[0]})`);
  }
}

/* ================= T4 Fisher 几何模型 ================= */
if (want('T4')) {
  console.log('【T4】Fisher 几何模型: 精确公式 vs 蒙特卡洛 (10^5 次, 固定 seed)');
  let worst = 0, worstAt = '';
  for (const n of [1, 2, 5, 25, 100]) {
    let nMax = 0;
    // 步长取在"有利概率从 ½ 掉到 0"的整个区间上: r/(2·dist) = a, 大 n 时有意义的尺度是 a ~ 1/√n
    for (const x of [0.1, 0.5, 1, 1.5, 2.5]) {
      const a = Math.min(0.98, x / Math.sqrt(n)), dist = 1.7, r = 2 * dist * a;
      const exact = Fisher.pBen(r, dist, n);
      const mc = Fisher.pBenMC(r, dist, n, 1e5, Fisher.mulberry32(1000 * n + Math.round(x * 10)));
      const err = Math.abs(exact - mc);
      if (err > nMax) nMax = err;
      if (err > worst) { worst = err; worstAt = `n=${n} a=${a.toFixed(3)}`; }
    }
    check(`n=${n}: 最大误差 < 0.005`, nMax < 0.005, `max|Δ|=${nMax.toFixed(4)}`);
  }
  console.log(`   全部组合里最差的一点: ${worstAt}, |Δ|=${worst.toFixed(4)}`);
  check('n=1: a<1 取 ½, a≥1 取 0', Fisher.pBen(0.5, 1, 1) === 0.5 && Fisher.pBen(2, 1, 1) === 0 && Fisher.pBen(3, 1, 1) === 0);
  check('任意 n: 步长 ≥ 2·dist 时必然不利', [2, 5, 25].every(n => Fisher.pBen(2, 1, n) === 0 && Fisher.pBen(2.5, 1, n) === 0));
  check('n=2 闭式: P = arccos(a)/π', [0.1, 0.4, 0.8].every(a => near(Fisher.pBen(2 * a, 1, 2), Math.acos(a) / Math.PI, 1e-10)));
  check('n=3 闭式: P = (1−a)/2', [0.1, 0.4, 0.8].every(a => near(Fisher.pBen(2 * a, 1, 3), (1 - a) / 2, 1e-10)));
  check('离顶点越近, 同样的步长越难有利 (n=5, r=0.3)', Fisher.pBen(0.3, 2, 5) > Fisher.pBen(0.3, 1, 5) && Fisher.pBen(0.3, 1, 5) > Fisher.pBen(0.3, 0.3, 5) && Fisher.pBen(0.3, 0.3, 5) > Fisher.pBen(0.3, 0.16, 5));
  check('维数越高, 同样的步长越难有利 (r=0.5, dist=1)', [2, 5, 25, 100].every((n, i, arr) => i === 0 || Fisher.pBen(0.5, 1, n) < Fisher.pBen(0.5, 1, arr[i - 1])));
  // 大 n 正态近似: 固定 x = r√n/(2·dist), 误差随 n 增大而收敛到 0
  const errs = [];
  for (const n of [10, 100, 1000, 10000]) {
    let m = 0;
    for (const x of [0.5, 1, 2]) {
      const r = 2 * x / Math.sqrt(n);
      m = Math.max(m, Math.abs(Fisher.pBen(r, 1, n) - Fisher.pBenNormal(r, 1, n)));
    }
    errs.push(m);
  }
  check('正态近似误差随 n 单调下降', errs.every((e, i) => i === 0 || e < errs[i - 1]), errs.map(e => e.toExponential(1)).join(' → '));
  check('n=10^4 时正态近似误差 < 1e-4', errs[3] < 1e-4, `${errs[3].toExponential(2)}`);
}

/* ================= T2 慢层无损 (L2): standalone 与闭式解 ================= */
const SA = (over) => new CycleSim(Object.assign({ standalone: true, n: 1, h: 1, U0: 0.02, env: { type: 'static' }, revolution: false, Lmax: 1e9 }, over || {}));
if (want('T2')) {
  console.log('【T2】慢层 standalone = 经典 Lande + 变异-选择平衡, 与闭式解核对');
  const U = 0.02, h = 1, Vs = th.Vstar(U, h);
  {
    const c = SA({ V0: 3 * Vs });
    let worst = 0;
    for (let y = 1; y <= 60; y++) { c.run(20); worst = Math.max(worst, Math.abs(c.st.Vx[0] - th.Vt(3 * Vs, U, h, y))); }
    check('V(t) 的暂态与 Riccati 精确解一致 (60 年, 逐年)', worst < 1e-9, `max|Δ|=${worst.toExponential(2)}`);
    c.run(20 * 400);
    check('稳态变异 V* = √(U/h)', near(c.st.Vx[0], Vs, 1e-12), `V=${c.st.Vx[0].toFixed(8)} V*=${Vs.toFixed(8)}`);
  }
  {
    const v = 0.01, c = SA({ env: { type: 'constant', v } });
    let worst = 0;
    for (let y = 1; y <= 80; y++) { c.run(20); worst = Math.max(worst, Math.abs((c.st.theta[0] - c.st.s[0]) - th.lagT(v, Vs, h, y))); }
    check('匀速环境: 滞后的暂态 g(t) = g*(1−exp(−Vht))', worst < 1e-9, `max|Δ|=${worst.toExponential(2)}`);
    c.run(20 * 500);
    check('稳态滞后 (θ−s)* = v/(Vh)', near(c.st.theta[0] - c.st.s[0], th.lagStar(v, Vs, h), 1e-10), `${(c.st.theta[0] - c.st.s[0]).toFixed(8)} vs ${th.lagStar(v, Vs, h).toFixed(8)}`);
    check('稳态滞后负荷 v²/(2hV²)', near(c.ell, th.lagLoadStar(v, Vs, h), 1e-10), `${c.ell.toExponential(6)} vs ${th.lagLoadStar(v, Vs, h).toExponential(6)}`);
  }
  {
    const Lmax = 0.2, vc = th.vCrit(Vs, h, Lmax);
    const lo = SA({ env: { type: 'constant', v: 0.9 * vc }, Lmax }).run(1e4);
    const hi = SA({ env: { type: 'constant', v: 1.1 * vc }, Lmax }).run(1e4);
    check(`临界环境速度 v_c=${vc.toFixed(5)}: v=0.9v_c 时 10^4 轮不崩`, lo.firstCollapse === null, `最终负荷=${(lo.ell + lo.vload).toFixed(4)} < L_max=${Lmax}`);
    check('v=1.1v_c 时崩溃', hi.firstCollapse !== null, `首次满足判据于第 ${hi.firstCollapse} 轮`);
    const edge1 = SA({ env: { type: 'constant', v: 0.995 * vc }, Lmax }).run(4e4), edge2 = SA({ env: { type: 'constant', v: 1.005 * vc }, Lmax }).run(4e4);
    check('贴近临界值两侧 (±0.5%) 仍然分得开', edge1.firstCollapse === null && edge2.firstCollapse !== null);
  }
  {
    const hs = [0.5, 1, 2, 4], Us = [0.01, 0.02, 0.03, 0.04], vv = [0.01, -0.02, 0.005, 0];
    const c = SA({ n: 4, h: hs, U0: Us, env: { type: 'constant', vVec: vv } }).run(20 * 1500);
    let eV = 0, eG = 0, tot = 0;
    for (let k = 0; k < 4; k++) {
      const V = Math.sqrt(Us[k] / hs[k]);
      eV = Math.max(eV, Math.abs(c.st.Vx[k] - V));
      eG = Math.max(eG, Math.abs((c.st.theta[k] - c.st.s[k]) - vv[k] / (V * hs[k])));
      tot += th.totalLoad(vv[k], V, hs[k]);
    }
    check('n 维 (对角): 每一维的 V* 与稳态滞后都对上', eV < 1e-10 && eG < 1e-9, `max|ΔV|=${eV.toExponential(1)} max|Δg|=${eG.toExponential(1)}`);
    check('n 维: 总负荷 = Σ_k [h_kV_k/2 + v_k²/(2h_kV_k²)]', near(c.ell + c.vload, tot, 1e-9), `${(c.ell + c.vload).toFixed(8)} vs ${tot.toFixed(8)}`);
    const a = SA({ n: 4, h: hs, U0: Us, env: { type: 'constant', vVec: vv }, Lmax: tot * 1.02 }).run(1e4);
    const b = SA({ n: 4, h: hs, U0: Us, env: { type: 'constant', vVec: vv }, Lmax: tot * 0.98 }).run(1e4);
    check('n 维: L_max 高于稳态总负荷 2% 不崩, 低 2% 崩溃', a.firstCollapse === null && b.firstCollapse !== null);
  }
  {
    const v = 0.02, Vopt = th.Vopt(v, h);
    let best = null, worst = 0;
    const grid = [];
    for (let V = 0.04; V <= 0.2501; V += 0.004) grid.push(V);
    for (const V of grid) {
      const c = SA({ env: { type: 'constant', v }, fixV: true, V0: V, recordEvery: 20 }).run(20 * 700);
      const hh = c.hist; let m = 0, cnt = 0;
      for (let i = hh.t.length - 100; i < hh.t.length; i++) { m += hh.ell[i] + hh.vload[i]; cnt++; }
      m /= cnt;
      worst = Math.max(worst, Math.abs(m - th.totalLoad(v, V, h)));
      if (!best || m < best.m) best = { V, m };
    }
    check('扫描 V: 平均总负荷与 hV/2 + v²/(2hV²) 一致', worst < 1e-8, `max|Δ|=${worst.toExponential(1)}`);
    check('总负荷的最小值点 V_opt = (2v²/h²)^(1/3)', Math.abs(best.V - Vopt) <= 0.004, `扫描最小值在 V=${best.V.toFixed(3)}, 闭式 ${Vopt.toFixed(4)}`);
  }
  {
    const c = SA({ n: 3, evolveU: true, hP: 2 });
    const us = [c.UMean];
    for (let y = 0; y < 3000; y++) { c.run(20); us.push(c.UMean); }
    let mono = true, strict = 0;
    for (let i = 1; i < us.length; i++) { if (us[i] > us[i - 1] + 1e-15) mono = false; if (us[i] < us[i - 1]) strict++; }
    const hit = us.findIndex(u => u <= c.o.Umin * (1 + 1e-9));
    check('约减原理: v=0 时二阶选择让 U 单调不增', mono, `严格下降 ${strict} 年`);
    check('...并一直推到下界 U_min', hit > 0, `第 ${hit} 年到达 U_min=${c.o.Umin}`);
    // 对照: 环境在动, 而且政权看得够远时, U 不会被推到下界, 而是停在让总负荷最小的 U_opt = h·V_opt² 附近
    const v = 0.02, c2 = SA({ n: 1, evolveU: true, hP: 60, etaU: 0.02, env: { type: 'constant', v }, Umax: 0.5 });
    c2.run(20 * 6000);
    const Uopt = h * th.Vopt(v, h) ** 2;
    check('对照: v>0 且看得远 (h_P=60) 时 U 停在 U_opt = h·V_opt² 附近 (±15%)', Math.abs(c2.UMean / Uopt - 1) < 0.15, `U=${c2.UMean.toFixed(5)} U_opt=${Uopt.toFixed(5)}`);
  }
}

/* ================= T3 显隐两个变异库 ================= */
if (want('T3')) {
  console.log('【T3】显隐库: 稳态公式, δ_h=0 时与 e 无关, direct 模式退化');
  const U = 0.02, h = 1, muE = 2;
  // 故意从远离稳态的初值出发 (V_显 偏大一倍多, V_隐 偏到 0.05), 跑 3000 年
  const steady = (e, deltaH) => SA({ poolMode: 'split', eFixed: e, deltaH, muE, V0: 0.3, Vh0: 0.05 }).run(20 * 3000);
  {
    let worst = 0;
    for (const dh of [0, 0.2, 1]) for (const e of [0.1, 0.4, 1]) {
      const c = steady(e, dh);
      worst = Math.max(worst, Math.abs(c.st.Vh[0] - th.VhidStar(U, muE, e, dh)), Math.abs(c.st.Vx[0] - th.VexpStar(U, h, muE, e, dh)));
    }
    check('稳态: V_隐* = U/(μ_e·e+δ_h), V_显* = √(μ_e·e·U/((μ_e·e+δ_h)·h))', worst < 1e-10, `9 组参数, max|Δ|=${worst.toExponential(1)}`);
  }
  {
    const es = [0.05, 0.1, 0.3, 0.6, 1];
    const v0 = es.map(e => steady(e, 0).st.Vx[0]);
    const spread = Math.max(...v0) - Math.min(...v0);
    check('δ_h = 0: V_显* 与 e 无关, 恒为 √(U/h)', spread < 1e-10 && near(v0[0], Math.sqrt(U / h), 1e-10), `e 从 0.05 到 1, V_显* 的极差=${spread.toExponential(1)}`);
    const hid = es.map(e => steady(e, 0).st.Vh[0]);
    check('δ_h = 0: 压制只是把变异存进隐藏库 (V_隐* ∝ 1/e)', hid.every((v, i) => near(v * es[i], U / muE, 1e-10)), `V_隐*: ${hid.map(v => v.toFixed(3)).join(', ')}`);
    const v2 = es.map(e => steady(e, 0.2).st.Vx[0]);
    check('δ_h > 0: V_显* 随 e 严格单调递增', v2.every((v, i) => i === 0 || v > v2[i - 1]), v2.map(v => v.toFixed(4)).join(' < '));
  }
  {
    // 独立写的参照积分器: 第 4 节的方程, 向量形式的教科书 RK4
    const v = 0.013, V0 = 0.3, dt = 1 / 20;
    const f = (t, y) => [y[1] * h * (v * t - y[0]), U - h * y[1] * y[1]];      // y = [s, V], θ(t) = v·t
    let y = [0, V0], t = 0, worst = 0;
    const c = SA({ env: { type: 'constant', v }, V0, poolMode: 'direct' });
    for (let i = 0; i < 4000; i++) {
      const k1 = f(t, y), k2 = f(t + dt / 2, y.map((q, j) => q + dt / 2 * k1[j])), k3 = f(t + dt / 2, y.map((q, j) => q + dt / 2 * k2[j])), k4 = f(t + dt, y.map((q, j) => q + dt * k3[j]));
      y = y.map((q, j) => q + dt / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])); t += dt;
      c.step();
      worst = Math.max(worst, Math.abs(c.st.s[0] - y[0]), Math.abs(c.st.Vx[0] - y[1]));
    }
    check("mode:'direct' 与第 4 节方程的独立参照积分器逐步一致 (4000 步)", worst < 1e-12, `max|Δ|=${worst.toExponential(1)}`);
  }
  {
    // 带着快层跑 direct 模式 (C6 关): 慢层轨迹必须与 standalone 逐位相同, 即快层的存在不扰动慢层
    const env = { type: 'shocks', vCalm: 0.002, vShock: 0.05, durMin: 20, durMax: 40, meanGap: 60, sigmaTheta: 0.01 };
    const a = new CycleSim({ standalone: true, env, revolution: false, Lmax: 1e9, seedSlow: 5 });
    const b = new CycleSim(Object.assign({}, OFF, { poolMode: 'direct', env, seedSlow: 5, fast: Object.assign({}, CYCLE_FAST, { P: 1.3 }) }));
    let same = true;
    for (let i = 0; i < 6000 && same; i++) {
      a.step(); b.step(i % 7 === 0 ? 5 : 0);
      for (let k = 0; k < 5; k++) if (a.st.s[k] !== b.st.s[k] || a.st.Vx[k] !== b.st.Vx[k] || a.st.theta[k] !== b.st.theta[k]) same = false;
    }
    check('direct 模式下, 有无快层的慢层轨迹逐位相同 (6000 轮, 含环境噪声与冲击)', same);
  }
  {
    // split → direct 的极限: e ≡ 1, δ_h = 0, μ_e 越大越接近.
    // 隐藏库从空的开始 (Vh0 = 0), 它要花 ~1/μ_e 年填满, 这段时间里的供给缺口就是两种模式的差
    const errs = [], exact = [];
    for (const mu of [2, 8, 32, 128]) {
      const opt = { env: { type: 'constant', v: 0.01 }, V0: 0.3, roundsPerYear: 400 };
      const a = SA(Object.assign({}, opt, { poolMode: 'direct' })), b = SA(Object.assign({}, opt, { poolMode: 'split', muE: mu, Vh0: 0 }));
      const c = SA(Object.assign({}, opt, { poolMode: 'split', muE: mu, Vh0: U / mu }));
      let w = 0, w2 = 0;
      for (let i = 0; i < 400 * 80; i++) {
        a.step(); b.step(); c.step();
        w = Math.max(w, Math.abs(a.st.Vx[0] - b.st.Vx[0]), Math.abs(a.st.s[0] - b.st.s[0]));
        w2 = Math.max(w2, Math.abs(a.st.Vx[0] - c.st.Vx[0]), Math.abs(a.st.s[0] - c.st.s[0]));
      }
      errs.push(w); exact.push(w2);
    }
    check('e≡1, δ_h=0, μ_e→∞ 时显隐库收敛到 direct (误差随 μ_e 单调下降, 约 ∝ 1/μ_e)', errs.every((e, i) => i === 0 || e < errs[i - 1]) && errs[3] < errs[0] / 20, errs.map(e => e.toExponential(1)).join(' → '));
    check('隐藏库起步就在稳态 (V_隐 = U/μ_e) 时, 任意 μ_e 下显隐库与 direct 的差都在舍入误差内', exact.every(e => e < 1e-12), exact.map(e => e.toExponential(1)).join(', '));
  }
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
