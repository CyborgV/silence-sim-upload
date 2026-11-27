/* 周期律耦合模型自检 (硬测试 T1–T5; T6 是科学预测, 见 cycle_report.js)
 * 运行: node tests_cycle.js            全部
 *       node tests_cycle.js T2 T3      只跑指定小节
 */
'use strict';
const path = __dirname + '/';
const fs = require('fs');
const Fisher = require(path + 'fisher.js');

const only = process.argv.slice(2).map(s => s.toUpperCase());
const want = (id) => !only.length || only.includes(id);
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}${detail ? `  [${detail}]` : ''}`); }
  else { fail++; console.log(`  ✗ ${name}  ${detail || ''}`); }
}
const near = (a, b, tol) => Math.abs(a - b) <= tol;

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

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
