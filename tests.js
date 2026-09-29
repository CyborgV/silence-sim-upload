/* 模型自检: 用论文中的精确数值验证 model.js 的实现
 * 运行: node tests.js
 */
'use strict';
const { Sim, theory } = require('./model.js');

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}  ${detail || ''}`); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

console.log('【1】论文 p16 算例: τ~U[0,1], P=1, k=0.02, 千人规模');
{
  const F = (x) => theory.reactionUniform(x, 1, 0.02);
  check('F(0.020)=0 (二十人起点熄灭)', F(0.02) === 0, `F=${F(0.02)}`);
  check('F(0.021)≈0.0476 (≈48人)', near(F(0.021), 0.0476, 0.001), `F=${F(0.021)}`);
  let x = 0.021;
  const seq = [x];
  for (let i = 0; i < 40; i++) { const nx = F(x); seq.push(nx); if (Math.abs(nx - x) < 1e-12) break; x = nx; }
  check('第2轮≈580人', near(seq[2] * 1000, 580, 3), `${(seq[2] * 1000).toFixed(1)}`);
  check('第3轮≈966人', near(seq[3] * 1000, 966, 3), `${(seq[3] * 1000).toFixed(1)}`);
  check('终态≈980人 (x₊)', near(seq[seq.length - 1], 0.97958, 0.001), `${(seq[seq.length - 1] * 1000).toFixed(1)}`);
  let y = 0.02;
  for (let i = 0; i < 5; i++) y = F(y);
  check('二十人起点终态=0', y === 0, `y=${y}`);
}

console.log('【2】不动点解析值: x₋≈0.02041685, x₊≈0.97958315, 稳定性分类');
{
  check('x₋ 解析值', near(theory.xMinus(1, 0.02), 0.02041685, 1e-6));
  check('x₊ 解析值', near(theory.xPlus(1, 0.02), 0.97958315, 1e-6));
  const sim = new Sim({ N: 4000, tolType: 'uniform', P: 1, K0: 80, seed: 3 }); // k=80/4000=0.02
  const pts = sim.fixedPoints(1, 0.02).filter(q => !q.boundary);
  check('扫描出两个不动点', pts.length === 2, `n=${pts.length} ${JSON.stringify(pts)}`);
  if (pts.length === 2) {
    check('x₋ 不稳定(斜率>1)', !pts[0].stable && pts[0].slope > 1, `slope=${pts[0].slope}`);
    check('x₊ 稳定(斜率<1)', pts[1].stable && pts[1].slope < 1, `slope=${pts[1].slope}`);
    check('x₋ 数值吻合', near(pts[0].x, 0.02041685, 0.002), `x=${pts[0].x}`);
    check('x₊ 数值吻合', near(pts[1].x, 0.97958315, 0.002), `x=${pts[1].x}`);
  }
  check('临界种子≈x₋', near(sim.criticalSeed(1, 0.02), 0.02041685, 0.002), `${sim.criticalSeed(1, 0.02)}`);
}

console.log('【3】性质七: 冻结单变量规则单调收敛, 无自发振荡');
{
  const sim = new Sim({ N: 4000, tolType: 'bell', P: 1, K0: 80, seed: 5 });
  let prev = 0.03, up = null, mono = true;
  for (let t = 0; t < 200; t++) {
    const nx = sim.frozenF(prev, 1, 0.02);
    if (up === null) up = nx > prev;
    if (up && nx < prev - 1e-12) mono = false;
    if (!up && nx > prev + 1e-12) mono = false;
    prev = nx;
  }
  check('轨迹单调(无上冲/回摆)', mono);
  let hi = 1.0, mono2 = true;
  for (let t = 0; t < 200; t++) { const nx = sim.frozenF(hi, 1, 0.02); if (nx > hi + 1e-12) mono2 = false; hi = nx; }
  check('高位出发单调不增', mono2);
}

console.log('【4】性质十四: 迟滞回线 k=0.2 (P_↓=0.8, P_↑=1.25)');
{
  check('P_↓=0.8', near(theory.Pdown(0.2), 0.8, 1e-9));
  check('P_↑=1.25', near(theory.Pup(0.2), 1.25, 1e-9));
  const eq = (x, P, k) => theory.iterateUniform(x, P, k, 500);
  let x = 0.05; const downPath = [];
  for (let P = 1.6; P >= 0.6; P -= 0.01) { x = eq(x, P, 0.2); downPath.push([P, x]); }
  const jumpDown = downPath.find(([P, v]) => v > 0.5);
  check('降压过程在 P_↓≈0.8 处跳升', jumpDown && near(jumpDown[0], 0.8, 0.03), jumpDown && `P=${jumpDown[0].toFixed(2)}`);
  check('P=0.9 时高态 x_H≈0.7646', near(eq(0.9, 0.9, 0.2), 0.7646, 0.001), `${eq(0.9, 0.9, 0.2)}`);
  // 回程: 从低压高位出发, 缓慢升压, 高态应维持到 P_↑≈1.25
  let up = eq(0.9, 0.6, 0.2);
  const upPath = [];
  for (let P = 0.6; P <= 1.35; P += 0.005) { up = eq(up, P, 0.2); upPath.push([P, up]); }
  const hold = upPath.filter(([P, v]) => P > 1.2 && P < 1.24 && v > 0.5);
  check('升压过 P=1.2 仍维持高位(迟滞)', hold.length > 0);
  const jumpUp = upPath.find(([P, v]) => P > 1.0 && v < 0.1);
  check('升压在 P_↑≈1.25 处跌落', jumpUp && near(jumpUp[0], 1.25, 0.02), jumpUp && `P=${jumpUp[0].toFixed(3)}`);
}

console.log('【5】性质一: 执行者自我侵蚀 → k_t=k₀βᵗ(1−d₀), 公开记录保持沉默');
{
  const N = 1000, K0 = 20, beta = 0.9;
  const sim = new Sim({
    N, K0, M: 2000, tolType: 'uniform', P: 1, Pbar: 0.5,
    alpha: 0, beta, delta: 0.2, d0: 0, continuousK: true, seed: 11,
  });
  // δ(P−P̄)+ = 0.2×0.5 = 0.1 = 1−β ✓ (论文 p6 构造)
  let ok = true, silent = true;
  for (let t = 1; t <= 12; t++) {
    const s = sim.step(0);
    const kExpect = (K0 / N) * Math.pow(beta, t);
    if (!near(s.k, kExpect, 1e-3)) ok = false;
    if (s.x !== 0) silent = false;
  }
  check('k_t 几何衰减吻合', ok);
  check('参与始终为 0 (道路以目)', silent);
  const xc1 = theory.xMinus(1, 0.02), xc2 = theory.xMinus(1, 0.02 * Math.pow(0.9, 15));
  check('临界种子持续缩小(无预警)', xc2 < xc1 * 0.35, `x₋: ${xc1.toFixed(4)}→${xc2.toFixed(4)}`);
}

console.log('【6】论文 p5 单轮算例: N=10000, x=0.1, d=0.5, k₀=0.02, P=1, P̄=0.5, γ=2');
{
  const N = 10000;
  const sim = new Sim({
    N, M: 600, K0: 200, tolType: 'uniform', P: 1, Pbar: 0.5,
    gamma: 2, memDecay: 0, alpha: 1, beta: 1, delta: 0, d0: 0.5, seed: 9,
  });
  // 初始参与者 = 承受上限最高的 10%
  const idx = Array.from({ length: N }, (_, i) => i).sort((a, b) => sim.tau[b] - sim.tau[a]);
  for (let i = 0; i < N / 10; i++) sim.a[idx[i]] = 1;
  const s = sim.step(0);
  check('x_{t+1}≈0.90', near(s.x, 0.90, 0.005), `x=${s.x.toFixed(4)}`);
  check('d_{t+1}≈0.6', near(s.d, 0.6, 0.03), `d=${s.d.toFixed(3)}`);
  check('记忆 b̄≈0.01', near(s.bAvg, 0.01, 0.001), `b=${s.bAvg.toFixed(4)}`);
}

console.log('【7】性质十一: 临界种子 = Σ Catalan_n·k^{n+1} = k+k²+2k³+5k⁴+14k⁵');
{
  const k = 0.001;
  const series = k + k ** 2 + 2 * k ** 3 + 5 * k ** 4 + 14 * k ** 5;
  check('x₋(0.001) 与 Catalan 级数吻合到 1e-12', Math.abs(theory.xMinus(1, k) - series) < 1e-12,
    `diff=${Math.abs(theory.xMinus(1, k) - series).toExponential(2)}`);
}

console.log('【8】性质六: 小行动被吸回低位(冻结切面, 只剩愿担完整处罚的人)');
{
  const N = 4000;
  const sim = new Sim({ N, tolType: 'uniform', P: 1, K0: 80, seed: 13 });
  // 构造: 1% 的人 τ=1.5 (愿担完整处罚且有余量), 其余 τ<0.9
  for (let i = 0; i < N; i++) sim.tau[i] = (i < 40) ? 1.5 : 0.9 * sim.tau[i];
  sim.refreshTau();
  for (const x0 of [0.003, 0.0075, 0.015]) {       // 12人 / 30人 / 60人, 均在 k=0.02 以下
    let x = x0;
    for (let t = 0; t < 100; t++) x = sim.frozenF(x, 1, 0.02);
    check(`起点 ${Math.round(x0 * N)}人 → 收敛到 1%  hard-core`, near(x, 0.01, 0.003), `x=${x.toFixed(4)}`);
  }
}

console.log('【9】完整系统起飞 + 封闭模型人口上限 (论文 p5: 正参与稳态要求 k=0)');
{
  const mk = (releaseProb) => new Sim({
    N: 1000, M: 60, K0: 20, tolType: 'uniform', P: 1, Pbar: 2,
    alpha: 0, beta: 0, delta: 0, releaseProb, seed: 17,
  });
  // 9a: 起飞阶段单调, 随后因持续拘押 drain (封闭模型无正稳态)
  const sim = mk(0);
  sim.step(30);
  let prev = sim.snapshot().x, mono = true, peak = 0;
  const xs = [];
  for (let t = 0; t < 60; t++) { const s = sim.step(0); xs.push(s.x); if (s.x < prev - 1e-12) mono = false; prev = s.x; peak = Math.max(peak, s.x); }
  check('起飞段单调爬升(前三次更新)', xs[0] <= xs[1] && xs[1] <= xs[2], xs.slice(0, 4).map(v => v.toFixed(3)).join('→'));
  check('冲过 0.9 后回落(拘押 drain)', peak > 0.9 && xs[xs.length - 1] < peak - 0.15, `peak=${peak.toFixed(3)} end=${xs[xs.length - 1].toFixed(3)}`);
  // 9b: 释放机制 = 论文所说的"回流"补充 → 高态可持续
  const sim2 = mk(1.0);
  sim2.step(30);
  for (let t = 0; t < 60; t++) sim2.step(0);
  const xf = sim2.snapshot().x;
  check('完全释放时收敛到高态带 [0.93, 0.97]', xf > 0.93 && xf < 0.97, `x=${xf.toFixed(3)}`);
}

console.log('【10】性质二: 相同公开记录, 不同记忆累积 (镇压债务)');
{
  function runGamma(gamma) {
    const sim = new Sim({
      N: 4000, M: 60, K0: 160, tolType: 'low', P: 1, Pbar: 0.5,
      gamma, memDecay: 0, alpha: 0, beta: 0, delta: 0, seed: 21,
    });  // k=160/4000=0.04, 每轮 4 人小种子
    let rec;
    for (let t = 0; t < 12; t++) rec = [sim.step(4, 'random').x, sim.hist.p[sim.hist.p.length - 1]];
    return { rec, b: sim.b.reduce((s, v) => s + v, 0) / 4000 };
  }
  const A = runGamma(2), B = runGamma(20);
  check('公开参与与拘押记录相同', near(A.rec[0], B.rec[0], 1e-9) && near(A.rec[1], B.rec[1], 1e-9));
  check('内部记忆累积不同(债务)', B.b > A.b * 3, `bA=${A.b.toFixed(4)} bB=${B.b.toFixed(4)}`);
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
