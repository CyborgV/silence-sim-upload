/* ============================================================
 * 道路以目 —— 沉默相变模型 · 模拟核心
 * 严格按原文方程实现:
 *   基础模型 (p1-2):  c(x) = P·min(1, k/x);  参与条件 τ_i ≥ c(x);
 *                    F(x) = 1 − G(c(x));     x_{t+1} = F(x_t)
 *   信息网络 (p3):    x̂_{i,t} = (1−ω)Σ_j A_ij a_{j,t} + ω·x_t
 *   执行者   (p3):    z_{j,t+1} = 1{ αx_t + βΣB_jℓ z_ℓ + δ(P−P̄)_+ ≥ ψ_j }
 *   记忆     (p4):    b_{i,t+1} = (1−ρ)b_i + γw_t(P−P̄)_+ ζ_{i,t}
 *                    ζ_{i,t} = (1−ω)Σ_j A_ij e_{j,t} + ωp_t
 *   更新顺序 (p4):    读状态 → 按当前能力拘押 → 更新可行动与记忆
 *                    → 民众据本轮观察定 a_{t+1}, 执行者定 z_{t+1}
 *   感知代价 (p4):    ĉ = 0 (k=0); P (k>0, x̂=0); P·min(1, k/x̂)
 *   参与更新 (p4):    a_{i,t+1} = (1−r_{i,t+1})·max{u_{i,t+1}, 1{τ_i+b_{i,t+1} ≥ ĉ_{i,t}}}
 * 扩展(原文指明需另写转移规则): 释放 releaseProb、大赦、 Memorial 延迟核 (p8)
 * 游戏层扩展(不改变上述方程, 默认关闭或为零):
 *   潜藏记忆 latent: 可见度 w<1 时"没被看见"的那部分 γ(1−w)(P−P̄)₊ζ 暂存, 外泄/曝光时 reveal() 兑现
 *   addGrievance(): 外生事件(侮辱性定性、火灾、同情)直接改变 b, 与所选记忆核一致
 *   预防性拘捕名单阈值 listThreshold: 只拘押 τ+b 不低于阈值的人(默认 0 = 原版行为)
 *   不动点分析可选 useMem(用 τ+b 而非 τ)与 kScale(信息压缩造成的有效执行能力放大)
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 随机数 ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 承受上限分布 G ---------- */
  function sampleTolerances(N, type, rng) {
    const arr = new Float64Array(N);
    if (type === 'uniform') {
      for (let i = 0; i < N; i++) arr[i] = rng();
    } else if (type === 'bell') {           // 钟形: 中心 0.5, 三角分布近似
      for (let i = 0; i < N; i++) arr[i] = (rng() + rng() + rng()) / 3;
    } else if (type === 'bimodal') {        // 双峰: 温和派/激进派
      for (let i = 0; i < N; i++) {
        const c = rng() < 0.75 ? 0.28 : 0.78;
        arr[i] = Math.min(1, Math.max(0, c + (rng() + rng() - 1) * 0.14));
      }
    } else if (type === 'ladder') {         // 格兰诺维特阶梯: 门槛 0..1 均匀排开
      for (let i = 0; i < N; i++) arr[i] = (i + 0.5) / N;
    } else if (type === 'low') {            // 高压社会: 承受上限整体压低
      for (let i = 0; i < N; i++) arr[i] = 0.45 * rng();
    }
    return arr;
  }

  /* ---------- 信息网络 A (邻接表, 等权) ---------- */
  function buildNetwork(N, type, rng, deg, groups) {
    if (type === 'full') return null;
    const adj = new Array(N);
    for (let i = 0; i < N; i++) adj[i] = [];
    const addEdge = (a, b) => { if (a !== b) { adj[a].push(b); adj[b].push(a); } };
    if (type === 'random') {                       // Erdős–Rényi, 平均度数 deg
      const m = Math.round(N * deg / 2);
      const seen = new Set();
      let guard = 0;
      while (seen.size < m && guard++ < m * 30) {
        const a = (rng() * N) | 0, b = (rng() * N) | 0;
        if (a === b) continue;
        const key = a < b ? a * N + b : b * N + a;
        if (seen.has(key)) continue;
        seen.add(key); addEdge(a, b);
      }
    } else if (type === 'clusters') {              // 教会圈: 紧密小团体 + 少量远程弱联系
      const gs = Math.max(6, Math.round(N / groups));
      const perm = Array.from({ length: N }, (_, i) => i);
      for (let i = N - 1; i > 0; i--) { const j = (rng() * (i + 1)) | 0; const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
      for (let g = 0; g * gs < N; g++) {
        const mem = perm.slice(g * gs, Math.min(N, (g + 1) * gs));
        const L = mem.length, ring = Math.min(3, (L - 1) >> 1);
        for (let a = 0; a < L; a++)
          for (let d = 1; d <= ring; d++) addEdge(mem[a], mem[(a + d) % L]);
      }
      const longTies = Math.round(N * 0.6);
      for (let t = 0; t < longTies; t++) addEdge((rng() * N) | 0, (rng() * N) | 0);
    } else if (type === 'grid') {                  // 空间广场: ⌈√N⌉² 网格, 8 邻域
      const W = Math.ceil(Math.sqrt(N));
      for (let i = 0; i < N; i++) {
        const x = i % W, y = (i / W) | 0;
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
          if (!dx && !dy) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= W) continue;
          const j = ny * W + nx;
          if (j < N) adj[i].push(j);
        }
      }
    }
    return adj;
  }

  const DEFAULTS = {
    N: 1000, M: 60, seed: 7,
    P: 1.0,        // 处罚强度(完整处罚损失, τ 的单位)
    Pbar: 0.5,     // 合法性阈值 P̄
    K0: 20,        // 全部执行时一轮最多拘押人数
    tolType: 'uniform',
    netType: 'full', netDeg: 8, netGroups: 25,
    omega: 1.0,    // ω 全局信息权重
    globalScale: 1.0,  // 信息政策: 报道出来的总体参与比例 = x·globalScale
    noise: 0.0,        // 谣言/误报: 加到 x̂ 上的均匀噪声幅度
    alpha: 0.3, beta: 0.6, delta: 0.2,  // 执行者规则权重
    psiScale: 1.0,  // 执行者门槛 ψ ~ U(0, psiScale)
    d0: 0.0,        // 初始拒绝执行比例
    memDecay: 0.2,  // ρ 记忆消退率
    gamma: 2.0,     // γ 经历→参与意愿强度
    vis: 1.0,       // w 事件可见度
    kernel: 'exp',  // 'exp' | 'memorial'
    memPeak: 10,    // 纪念峰时距(轮)
    memPeakAmp: 1.5,// 纪念峰相对强度
    releaseProb: 0.0,   // 每轮释放概率(原文封闭模型为 0)
    targetMode: 'uniform', // 'uniform' | 'organizer' | 'zealot'
    netDamage: 0.5,     // 针对组织者拘押时, 其联络被切断的比例
    hardCore: 0.0,      // 永久参与者比例 x0 (愿承担完整处罚)
    continuousK: false, // K_t 取整(有限人口) 或连续近似
    latentDecay: 0.02,  // 潜藏记忆每轮消退率(游戏扩展)
    listThreshold: 0,   // 预防性拘捕名单阈值(游戏扩展, 0=原版)
    listMode: 'all',    // 'all' = 原版(全体自由人口排名); 'flag' = 只抓"在案"的人(曾经参与或被登记)
    tolMul: 1, tolAdd: 0, // 承受上限整体缩放/平移(游戏扩展)
    noRemoval: false,   // 冻结切面(p2): 不实际移除被拘押者, x_{t+1}=F(x_t)
  };

  class Sim {
    constructor(opts) {
      this.o = Object.assign({}, DEFAULTS, opts || {});
      const o = this.o, N = o.N, rng = this.rng = mulberry32(o.seed);
      this.tau = sampleTolerances(N, o.tolType, rng);
      if (o.tolMul !== 1 || o.tolAdd !== 0) for (let i = 0; i < N; i++) this.tau[i] = this.tau[i] * o.tolMul + o.tolAdd;
      this.net = buildNetwork(N, o.netType, rng, o.netDeg, o.netGroups);
      // 永久参与者 = 承受上限最高的一批 (性质六)
      this.hard = new Uint8Array(N);
      const hc = Math.round(o.hardCore * N);
      if (hc > 0) {
        const idx = Array.from({ length: N }, (_, i) => i).sort((a, b) => this.tau[b] - this.tau[a]);
        for (let i = 0; i < hc; i++) this.hard[idx[i]] = 1;
      }
      // 执行者
      this.psi = new Float64Array(o.M);
      for (let j = 0; j < o.M; j++) this.psi[j] = rng() * o.psiScale;
      this.z = new Uint8Array(o.M);
      const z0 = Math.round(o.d0 * o.M);
      for (let j = 0; j < z0; j++) this.z[j] = 1;
      this.refreshTau();
      // 民众状态
      this.a = new Uint8Array(N);
      this.r = new Uint8Array(N);
      this.b = new Float64Array(N);
      this.latent = new Float64Array(N); // 被封锁压住、尚未公开的记忆(游戏扩展)
      this.flagged = new Uint8Array(N);  // 在案名单: 曾公开参与或被登记的人(游戏扩展)
      this.Ehist = [];                 // memorial 核的事件历史
      this.events = [];                // 一次性政策事件
      this.t = 0;
      this.R = 0;                      // 累计拘押比例
      this.hist = { t: [], x: [], d: [], p: [], k: [], b: [], R: [] };
    }

    /* 有效参数(考虑一次性事件覆盖) */
    eff() {
      const o = this.o, e = { P: o.P, vis: o.vis, globalScale: o.globalScale, omega: o.omega };
      for (const ev of this.events) {
        if (ev.P !== undefined) e.P = ev.P;
        if (ev.vis !== undefined) e.vis = ev.vis;
        if (ev.globalScale !== undefined) e.globalScale = ev.globalScale;
        if (ev.omega !== undefined) e.omega = ev.omega;
      }
      return e;
    }

    pushEvent(ev) { this.events.push(Object.assign({ rounds: 1 }, ev)); }

    /* 当前执行能力: K_t = K0(1−d_t) (原文 p3, 有限人口取整) */
    capacity(d) {
      const K = this.o.continuousK ? this.o.K0 * (1 - d) : Math.floor(this.o.K0 * (1 - d));
      return { K, k: K / this.o.N };
    }

    meanU8(arr) { let s = 0; for (let i = 0; i < arr.length; i++) s += arr[i]; return s / arr.length; }

    /* 邻域加权观察 (1−ω)ΣA_ij s_j + ω s_global。
       censor=true 时全局信号经宣传压缩(globalScale)与噪声; 拘押可见度 ζ 不经压缩, 由 w 单独控制 */
    observe(localSum, deg, sGlobal, eff, censor) {
      let g = censor ? sGlobal * eff.globalScale + (this.rng() * 2 - 1) * this.o.noise : sGlobal;
      g = g < 0 ? 0 : g > 1 ? 1 : g;
      let local = deg > 0 ? localSum / deg : g;   // 无熟人者用全局信息
      return (1 - eff.omega) * local + eff.omega * g;
    }

    /* 感知代价 ĉ (原文 p4 分段) */
    cost(k, xHat, P) {
      if (k <= 0) return 0;
      if (xHat <= 0) return P;
      return P * Math.min(1, k / xHat);
    }

    /**
     * 推进一步。
     * @param seedCount 外生种子人数 u_{i,t+1}; @param seedMode 'random'|'near'
     */
    step(seedCount, seedMode) {
      const o = this.o, N = o.N, eff = this.eff();
      this.tauDirty = true;   // 拘押/释放可能改变自由人口构成
      /* -- 0. 事件结算: 大赦 & 常规释放 -- */
      for (const ev of this.events) if (ev.amnesty) { this.r.fill(0); ev.amnesty = false; }
      if (o.releaseProb > 0) {
        for (let i = 0; i < N; i++) if (this.r[i] && this.rng() < o.releaseProb) this.r[i] = 0;
      }
      /* -- 1. 读取当前状态 -- */
      const x = this.meanU8(this.a), d = this.meanU8(this.z);
      const { K, k } = this.capacity(d);
      /* -- 2. 以当前能力拘押 |C| (均匀/针对性/预防性) -- */
      const part = [];
      for (let i = 0; i < N; i++) if (this.a[i] && !this.r[i]) part.push(i);
      let nDet = 0;
      if (!o.noRemoval) {
        if (o.targetMode === 'preventive') {
          let freeN = 0; for (let i = 0; i < N; i++) if (!this.r[i] && (o.listMode !== 'flag' || this.flagged[i])) freeN++;
          nDet = Math.min(freeN, Math.round(K));
        } else {
          nDet = Math.min(part.length, Math.round(K));
        }
      }
      const e = new Uint8Array(N);
      if (nDet > 0) {
        let victims;
        if (o.targetMode === 'preventive') {
          // 预防性拘捕(扩展): 从全体自由人口按 τ+b 排名, 不待参与即抓
          const poolAll = [];
          const th = o.listThreshold || 0;
          const byFlag = o.listMode === 'flag';
          for (let i = 0; i < N; i++) if (!this.r[i] && (!byFlag || this.flagged[i]) && (th <= 0 || this.tau[i] + this.b[i] >= th)) poolAll.push(i);
          const keyP = (i) => this.tau[i] + this.b[i];
          poolAll.sort((a, b2) => keyP(b2) - keyP(a));
          victims = new Set(poolAll.slice(0, Math.min(nDet, poolAll.length)));
          if (o.netDamage > 0 && this.net) {
            for (const v of victims) {                      // 关键联系被切断 (波兰戒严)
              for (const nb of this.net[v]) {
                if (this.rng() < o.netDamage) {
                  const L = this.net[nb];
                  const idx = L.indexOf(v);
                  if (idx >= 0) { L[idx] = L[L.length - 1]; L.pop(); }
                }
              }
              this.net[v].length = 0;
            }
          }
        } else if (o.targetMode === 'uniform' || !this.net) {
          victims = new Set();
          // 部分 Fisher–Yates 抽样
          const pool = part.slice();
          for (let s = 0; s < nDet && pool.length; s++) {
            const j = (this.rng() * pool.length) | 0;
            victims.add(pool[j]); pool[j] = pool[pool.length - 1]; pool.pop();
          }
        } else {
          const key = o.targetMode === 'organizer'
            ? (i) => this.net[i].length                    // 组织者 = 高度数
            : (i) => this.tau[i] + this.b[i];               // 坚定者 = 有效承受上限最高
          part.sort((a, b2) => key(b2) - key(a));
          victims = new Set(part.slice(0, nDet));
          if (o.targetMode === 'organizer' && o.netDamage > 0) {
            for (const v of victims) {                      // 关键联系被切断 (波兰戒严)
              for (const nb of this.net[v]) {
                if (this.rng() < o.netDamage) {
                  const L = this.net[nb];
                  const idx = L.indexOf(v);
                  if (idx >= 0) { L[idx] = L[L.length - 1]; L.pop(); }
                }
              }
              this.net[v].length = 0;
            }
          }
        }
        for (const v of victims) { this.r[v] = 1; e[v] = 1; }
        nDet = victims.size;   // 名单阈值可能使实际拘押少于能力上限
      }
      const p = nDet / N;
      this.R += p;
      /* -- 3. 记忆: ζ 与 b 更新 (p4; memorial 核见 p8) -- */
      const over = Math.max(0, eff.P - o.Pbar);          // (P_t − P̄)_+
      const eta = o.gamma * eff.vis * over;              // η_t = γw(P−P̄)_+
      const etaLatent = o.gamma * Math.max(0, 1 - eff.vis) * over;  // 没被看见的部分(游戏扩展)
      const E = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        let zeta;
        if (this.net) {
          let s = 0; const nb = this.net[i];
          for (let q = 0; q < nb.length; q++) s += e[nb[q]];
          zeta = this.observe(s, nb.length, p, eff, false);
        } else zeta = p;
        E[i] = eta * zeta;
        this.latent[i] = this.latent[i] * (1 - o.latentDecay) + etaLatent * zeta;
      }
      if (o.kernel === 'memorial') {
        this.Ehist.unshift(E);
        const cap = Math.max(80, o.memPeak * 2 + 20);
        if (this.Ehist.length > cap) this.Ehist.pop();
        const wts = this.kernelWeights(this.Ehist.length);
        this.b.fill(0);
        for (let h = 0; h < this.Ehist.length; h++) {
          const Eh = this.Ehist[h], w = wts[h];
          if (w === 0) continue;
          for (let i = 0; i < N; i++) this.b[i] += w * Eh[i];
        }
      } else {
        const keep = 1 - o.memDecay;
        for (let i = 0; i < N; i++) this.b[i] = keep * this.b[i] + E[i];
      }
      /* -- 4. 民众据本轮观察决定 a_{t+1} (p4 方框) -- */
      const xObsBase = x;                                 // 全局信号 = 本轮真实参与
      const newA = new Uint8Array(N);
      const costBound = this.cost(k, xObsBase, eff.P);    // 全局口径的代价(供"near"种子与 μ)
      for (let i = 0; i < N; i++) {
        if (this.r[i]) { newA[i] = 0; continue; }         // (1−r) 因子
        let xHat;
        if (this.net) {
          let s = 0; const nb = this.net[i];
          for (let q = 0; q < nb.length; q++) s += this.a[nb[q]];
          xHat = this.observe(s, nb.length, xObsBase, eff, true);
        } else xHat = xObsBase * eff.globalScale + (this.rng() * 2 - 1) * this.o.noise;
        xHat = xHat < 0 ? 0 : xHat > 1 ? 1 : xHat;
        const c = this.cost(k, xHat, eff.P);
        newA[i] = (this.tau[i] + this.b[i] >= c) || this.hard[i] ? 1 : 0;
      }
      /* 外生种子 u_{i,t+1}: 仍是自由行动者 */
      if (seedCount > 0) {
        const free = [];
        for (let i = 0; i < N; i++) if (!this.r[i]) free.push(i);
        const n = Math.min(seedCount, free.length);
        if (seedMode === 'near' && costBound > 0) {
          free.sort((a, b2) => Math.abs((this.tau[a] + this.b[a]) - costBound) - Math.abs((this.tau[b2] + this.b[b2]) - costBound));
          for (let s = 0; s < n; s++) newA[free[s]] = 1;
        } else {
          for (let s = 0; s < n; s++) {
            const j = (this.rng() * free.length) | 0;
            newA[free[j]] = 1; free[j] = free[free.length - 1]; free.pop();
          }
        }
      }
      this.a = newA;
      for (let i = 0; i < N; i++) if (newA[i]) this.flagged[i] = 1;   // 公开露面就会被记下
      /* -- 5. 执行者据本轮观察决定 z_{t+1} (p3) -- */
      const press = o.alpha * x + o.beta * d + o.delta * over;
      for (let j = 0; j < o.M; j++) this.z[j] = press >= this.psi[j] ? 1 : 0;
      /* -- 6. 事件寿命结算 -- */
      for (let i = this.events.length - 1; i >= 0; i--) {
        if (--this.events[i].rounds <= 0) this.events.splice(i, 1);
      }
      /* -- 记录 -- */
      this.t++;
      const h = this.hist;
      h.t.push(this.t); h.x.push(x); h.d.push(d); h.p.push(p);
      h.k.push(k); h.b.push(this.b.reduce((s, v) => s + v, 0) / N); h.R.push(this.R);
      return this.snapshot();
    }

    kernelWeights(L) {
      const o = this.o, w = new Float64Array(L);
      for (let l = 1; l <= L; l++) {
        let base;
        if (o.memDecay >= 1) base = l === 1 ? 1 : 0;
        else base = Math.pow(1 - o.memDecay, l - 1);
        const bump = o.memPeakAmp * Math.exp(-((l - o.memPeak) ** 2) / 8);
        w[l - 1] = o.gamma * (base + bump);
      }
      return w;
    }

    run(rounds, seedFn) {
      for (let s = 0; s < rounds; s++) {
        const sc = seedFn ? seedFn(this.t) : 0;
        this.step(sc.count || 0, sc.mode || 'random');
      }
      return this.snapshot();
    }

    /* ---------- 冻结单变量切面的分析工具 (原文 p2, p12, p15, p20) ---------- */

    /** 连续经验分布(分段线性 CDF, 对应原文连续人口近似 p5)。
     *  默认用自由(未被拘押)人口的分布, 构成变化(谁被抓走)会移动反应函数(p5 末段)。
     *  外部改动 tau 后须调用 refreshTau() */
    refreshTau() { this.sortedTau = Float64Array.from(this.tau).sort(); this.tauDirty = false; this._tauKey = 't'; }
    _freeTau(useMem) {
      const key = useMem ? 'm' : 't';
      if (this.tauDirty || this._tauKey !== key) {
        const arr = [];
        for (let i = 0; i < this.o.N; i++) if (!this.r[i]) arr.push(useMem ? this.tau[i] + this.b[i] : this.tau[i]);
        this.sortedTau = Float64Array.from(arr).sort();
        this.tauDirty = false;
        this._tauKey = key;
      }
      return this.sortedTau;
    }

    /** 经验反应函数 F(x) = 1 − G(c(x)),G 为(自由人口)分段线性经验分布 */
    frozenF(x, P, k, useMem) {
      const c = this.cost(k, x, P);
      const t = this._freeTau(useMem), N = t.length;
      if (N === 0) return 0;
      if (c <= t[0]) return 1;
      if (c >= t[N - 1]) return 0;
      let lo = 0, hi = N - 1;                       // 二分: t[lo-1] < c <= t[hi]... 维持 t[lo] < c <= t[hi]
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t[mid] < c) lo = mid; else hi = mid; }
      const frac = (c - t[lo]) / (t[hi] - t[lo]);
      return 1 - (lo + 1 + frac) / N;
    }

    /** 不动点扫描: F(x)=x 的解及其稳定性 (F'<1 稳定)
     *  阶梯型经验 F 会使 g 恰好落在 0 上, 故用带死区的符号变化检测 */
    fixedPoints(P, k, useMem) {
      const pts = [];
      const M = 4000, EPS = 1e-9;
      const g = (x) => this.frozenF(x, P, k, useMem) - x;
      const S = (v) => (v > EPS ? 1 : v < -EPS ? -1 : 0);
      const record = (xr) => {
        const eps = 1e-4;
        const slope = (this.frozenF(Math.min(1, xr + eps), P, k, useMem) - this.frozenF(Math.max(0, xr - eps), P, k, useMem)) / (2 * eps);
        if (!pts.some(q => Math.abs(q.x - xr) < 1e-4)) pts.push({ x: xr, stable: slope < 1, slope });
      };
      let xPrev = 0, sPrev = S(g(0));
      if (sPrev === 0) pts.push({ x: 0, stable: true, boundary: true });
      for (let i = 1; i <= M; i++) {
        const x = i / M, s = S(g(x));
        if (s === 0) {
          if (sPrev !== 0) { record(x); sPrev = 0; }   // 触及零点即记根, 并暂停检测防止重复
        } else if (sPrev !== 0 && s !== sPrev) {
          let lo = xPrev, hi = x;                      // S(g(lo)) = sPrev, S(g(hi)) = −sPrev
          for (let it = 0; it < 60; it++) {
            const mid = (lo + hi) / 2;
            if (S(g(mid)) === sPrev) lo = mid; else hi = mid;
          }
          record((lo + hi) / 2);
          xPrev = x; sPrev = s;
        } else {
          xPrev = x; sPrev = s;
        }
      }
      pts.sort((q1, q2) => q1.x - q2.x);
      return pts;
    }

    /** 临界种子 = 最小的不稳定不动点 (分界, 原文 p6/p13) */
    criticalSeed(P, k) {
      const pts = this.fixedPoints(P, k).filter(q => !q.boundary && !q.stable);
      return pts.length ? pts[0].x : null;
    }

    /** 局部反作用系数 μ = η·m(q) (原文 p8, 性质三) */
    backfireMu() {
      const eff = this.eff(), o = this.o;
      const d = this.meanU8(this.z), { k } = this.capacity(d);
      const x = this.meanU8(this.a);
      const c = this.cost(k, x, eff.P);
      const eta = o.gamma * eff.vis * Math.max(0, eff.P - o.Pbar);
      if (eta <= 0 || c <= 0) return { mu: 0, eta, c };
      const band = 0.01;
      let cnt = 0, free = 0;
      for (let i = 0; i < o.N; i++) {
        if (this.r[i]) continue;
        free++;
        const q = this.tau[i] + this.b[i];
        if (Math.abs(q - c) <= band) cnt++;
      }
      const density = free ? cnt / free / (2 * band) : 0;
      return { mu: eta * density, eta, c, density };
    }

    /** 轻量快照(每步调用): 状态量 + μ; 不动点等重分析见 analysis() */
    snapshot() {
      const d = this.meanU8(this.z), { k, K } = this.capacity(d);
      const h = this.hist;
      return {
        t: this.t, x: this.meanU8(this.a), d, k, K, R: this.R,
        bAvg: h.b.length ? h.b[h.b.length - 1] : 0,
        p: h.p.length ? h.p[h.p.length - 1] : 0,
        mu: this.backfireMu(),
      };
    }

    /** 重量分析(按需调用): 不动点与临界种子
     *  opts.useMem: 用有效承受上限 τ+b(含记忆债务); opts.kScale: 有效执行能力放大(宣传压缩使人低估人数) */
    analysis(opts) {
      opts = opts || {};
      const eff = this.eff(), d = this.meanU8(this.z), { k } = this.capacity(d);
      const kk = k * (opts.kScale || 1);
      const roots = this.fixedPoints(eff.P, kk, !!opts.useMem);
      const xc = roots.filter(q => !q.boundary && !q.stable);
      return { roots, xCrit: xc.length ? xc[0].x : null, k: kk };
    }

    /* ---------- 游戏层扩展: 外生改变记忆 ---------- */
    /** 给第 i 人的记忆加 amt(与当前记忆核一致: 指数核直接加; 纪念核记入本轮事件, 之后按核演化) */
    addGrievance(i, amt) {
      if (!(amt > 0)) return;
      this.b[i] += amt;
      this.tauDirty = true;
      if (this.o.kernel === 'memorial') {
        if (!this.Ehist.length) this.Ehist.unshift(new Float64Array(this.o.N));
        const w0 = this.kernelWeights(1)[0];
        if (w0 > 0) this.Ehist[0][i] += amt / w0;
      }
    }
    /** 曝光: 被封锁压住的潜藏记忆按比例 frac 兑现为公开记忆, 返回平均兑现量 */
    reveal(frac) {
      let s = 0;
      for (let i = 0; i < this.o.N; i++) {
        const v = this.latent[i] * frac;
        if (v > 0 && !this.r[i]) { this.latent[i] -= v; this.addGrievance(i, v); s += v; }
      }
      return s / this.o.N;
    }
  }

  /* ---------- 理论对照公式 (均匀分布闭式解, 供自检) ---------- */
  const theory = {
    cost: (x, P, k) => (k <= 0 ? 0 : x <= 0 ? P : P * Math.min(1, k / x)),
    reactionUniform: (x, P, k) => {           // τ~U[0,1], P=1 时 F(x)=[1−P·min(1,k/x)]_0^1
      const u = 1 - P * (k <= 0 ? 0 : Math.min(1, k / Math.max(x, 1e-12)));
      return Math.min(1, Math.max(0, u));
    },
    xMinus: (P, k) => (1 - Math.sqrt(Math.max(0, 1 - 4 * P * k))) / 2,  // 临界种子(较小根)
    xPlus: (P, k) => (1 + Math.sqrt(Math.max(0, 1 - 4 * P * k))) / 2,   // 高参与稳态
    Pdown: (k) => 1 - k,                       // 低态消失阈值 P_↓
    Pup: (k) => 1 / (4 * k),                   // 高态消失阈值 P_↑
    /** 冻结映射迭代至收敛 (单变量切面) */
    iterateUniform(x0, P, k, rounds) {
      let x = x0;
      for (let t = 0; t < rounds; t++) {
        const nx = Math.min(1, Math.max(0, 1 - P * Math.min(1, k / Math.max(x, 1e-12))));
        if (Math.abs(nx - x) < 1e-12) { x = nx; break; }
        x = nx;
        if (x === 0 && k > 0) break;
      }
      return x;
    },
  };

  const api = { Sim, theory, mulberry32, sampleTolerances, buildNetwork, DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.SilenceSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
