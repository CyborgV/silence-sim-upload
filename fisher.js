/* ============================================================
 * Fisher 几何模型工具 (周期律耦合模型的慢层配件)
 *
 * 设定: n 维适应度地形, 当前状态离最优点的距离为 dist (文档里写作 ‖s−θ‖;
 *       原模型已占用 z, 这里不再用 z 表示距离), 朝一个均匀随机方向走一步, 步长 r.
 * 这一步"有利"(离最优点更近)的概率:
 *     P_ben(r, dist, n) = ½ · I_{1−a²}((n−1)/2, ½),   a = r / (2·dist)
 *   n = 1 时: a < 1 取 ½, 否则 0.   a ≥ 1 时恒为 0 (步子太大, 必然迈过头).
 * 推导: 设步子方向与"指向最优点"方向的夹角为 φ, 新距离² = dist² + r² − 2·r·dist·cosφ,
 *       有利 ⇔ cosφ > a.  均匀方向下 cos²φ ~ Beta(½, (n−1)/2), 且 cosφ 关于 0 对称,
 *       所以 P(cosφ > a) = ½·P(cos²φ > a²) = ½·(1 − I_{a²}(½, (n−1)/2)) = ½·I_{1−a²}((n−1)/2, ½).
 * 大 n 近似: √n·cosφ → N(0,1), 所以 P_ben ≈ Φ(−a·√n) = Φ(−r·√n / (2·dist)).
 *
 * 零依赖; node 和浏览器通用, 导出方式同 model.js.
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 随机数 (与 model.js 的 mulberry32 相同, 这里自带一份以保持零依赖) ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** 标准正态 (Box–Muller, 每次消耗两个均匀数, 不缓存, 便于复现) */
  function gauss(rng) {
    let u = rng(); if (u < 1e-300) u = 1e-300;
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }

  /* ---------- 特殊函数 ---------- */
  /** ln Γ(x), Lanczos 近似 (g=7, 9 项), x > 0 */
  function lgamma(x) {
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
      -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1;
    let a = c[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += c[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  /** 不完全 Beta 的连分式 (修正 Lentz 法) */
  function betacf(x, a, b) {
    const TINY = 1e-300, EPS = 1e-15;
    const qab = a + b, qap = a + 1, qam = a - 1;
    let c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < TINY) d = TINY;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 500; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
      c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < TINY) d = TINY;
      c = 1 + aa / c; if (Math.abs(c) < TINY) c = TINY;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  /** 正则化不完全 Beta 函数 I_x(a, b), 0 ≤ x ≤ 1, a, b > 0 */
  function betainc(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const lnFront = lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x);
    if (x < (a + 1) / (a + b + 2)) return Math.exp(lnFront) * betacf(x, a, b) / a;
    return 1 - Math.exp(lnFront) * betacf(1 - x, b, a) / b;
  }
  /** 余误差函数 erfc(x) (Numerical Recipes erfccheb 型有理近似, 相对误差 < 1.2e-7 足够画图; 核对用 normalCdf 走 betainc 无关路径) */
  function erfc(x) {
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
      t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function normalCdf(x) { return 0.5 * erfc(-x / Math.SQRT2); }

  /* ---------- Fisher 几何模型 ---------- */
  /** 精确有利概率. r: 步长, dist: 到最优点的距离, n: 维数 */
  function pBen(r, dist, n) {
    if (!(dist > 0)) return 0;                // 已在顶点: 任何一步都不利
    if (r <= 0) return 0.5;                   // 无穷小的一步: 一半方向有利
    const a = r / (2 * dist);
    if (a >= 1) return 0;
    if (n === 1) return 0.5;
    return 0.5 * betainc(1 - a * a, (n - 1) / 2, 0.5);
  }
  /** 大 n 正态近似 Φ(−r√n / (2·dist)) */
  function pBenNormal(r, dist, n) {
    if (!(dist > 0)) return 0;
    return normalCdf(-r * Math.sqrt(n) / (2 * dist));
  }
  /** 蒙特卡洛核对: 从 (dist, 0, ..., 0) 出发, 朝均匀随机方向走 r, 统计离原点更近的比例 */
  function pBenMC(r, dist, n, samples, rng) {
    rng = rng || mulberry32(1);
    const u = new Float64Array(n);
    let hit = 0;
    for (let s = 0; s < samples; s++) {
      let norm2 = 0;
      for (let i = 0; i < n; i++) { u[i] = gauss(rng); norm2 += u[i] * u[i]; }
      const inv = r / Math.sqrt(norm2);
      let d2 = 0;
      for (let i = 0; i < n; i++) { const c = (i === 0 ? dist : 0) + u[i] * inv; d2 += c * c; }
      if (d2 < dist * dist) hit++;
    }
    return hit / samples;
  }
  /** 一步的期望适应度改进 (二次地形 f = −½·dist², 只在有利时接受): 供页面画"改革步长"曲线用 */
  function expectedGainMC(r, dist, n, samples, rng) {
    rng = rng || mulberry32(1);
    const u = new Float64Array(n);
    let gain = 0;
    for (let s = 0; s < samples; s++) {
      let norm2 = 0;
      for (let i = 0; i < n; i++) { u[i] = gauss(rng); norm2 += u[i] * u[i]; }
      const inv = r / Math.sqrt(norm2);
      let d2 = 0;
      for (let i = 0; i < n; i++) { const c = (i === 0 ? dist : 0) + u[i] * inv; d2 += c * c; }
      if (d2 < dist * dist) gain += 0.5 * (dist * dist - d2);
    }
    return gain / samples;
  }

  const api = { pBen, pBenNormal, pBenMC, expectedGainMC, betainc, lgamma, erfc, normalCdf, mulberry32, gauss };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Fisher = api;
})(typeof window !== 'undefined' ? window : globalThis);
