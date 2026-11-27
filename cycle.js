/* ============================================================
 * 周期律耦合模型 —— 在"道路以目·沉默相变模型"(model.js, 快层)外面加一个慢层
 *
 * 快层 (原模型, 一个字节不改): 沉默如何在一瞬间相变为行动.
 * 慢层 (本文件): 制度 s 追赶环境最优点 θ, 变异被选择磨掉, 被压住的想法存进隐藏库.
 *
 *   慢层方程 (对角近似, 每维独立; 每快轮用 RK4 推进 dt = 1/Δ 年):
 *     θ'    = v(T) + σ_θ·ξ                            环境剧本 (漂移在 RK4 内精确处理, 噪声用 Euler–Maruyama)
 *     s'    = V_显·H·(θ̂ − s)                          Lande 方程
 *     V_隐' = U − (μ_e·e + δ_h)·V_隐                   想法产生, 被说出来, 或者消亡
 *     V_显' = μ_e·e·V_隐 − V_显·H·V_显                 说出来的才进入选择, 并被磨掉
 *   poolMode:'direct' 时不区分显隐: V' = U − V·H·V (经典变异-选择平衡).
 *
 *   耦合通道 (每条都能单独关闭, 关闭 = 完全不写入快层):
 *     C1 滞后生怨   sim.addGrievance(i, κ·ℓ·ξ_i·dt)              关闭值 κ = 0
 *     C2 表达压制   政权的 P → sim.o.P                            关闭值 evolveP:false
 *     C3 绩效合法性 P̄_eff = max(0, P̄_0 + λ_W·(W − W_ref)) → sim.o.Pbar   关闭值 λ_W = 0
 *     C4 财政与军心 K0_eff = K0·max(0, 1−χ·ℓ) → sim.o.K0;  ψ_j = ψ_j^0 − δ_ℓ·ℓ → sim.psi   关闭值 χ = 0, δ_ℓ = 0
 *     C5 表达供给改革 上面方程里的 μ_e·e (e 从快层读出, 不回写)     合并模式必开
 *     C6 报喜不报忧 θ̂ = s + (1 − β_fog·min(1, (P−P̄_eff)_+))·(θ − s)     关闭值 β_fog = 0
 *     C7 改朝换代   检测 → 记录 → 重置                            关闭值 revolution:false
 *
 * 红线: 不改 Sim.prototype, 不给 step() 打补丁, 不调用 sim.rng.
 *       慢层的随机数全部来自 mulberry32(seedSlow) 派生的几条独立子流.
 * 零依赖; node 和浏览器通用, 导出方式同 model.js.
 * ============================================================ */
(function (global) {
  'use strict';
  const SS = (typeof module !== 'undefined' && module.exports) ? require('./model.js') : global.SilenceSim;
  const { Sim, mulberry32 } = SS;

  /* ---------- 随机数工具 (只用于慢层自己的流) ---------- */
  function gauss(rng) {
    let u = rng(); if (u < 1e-300) u = 1e-300;
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }
  function poisson(rng, lam) {
    if (!(lam > 0)) return 0;
    const L = Math.exp(-lam);
    let k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L);
    return k - 1;
  }
  function unitVector(rng, n) {
    const u = new Float64Array(n);
    let s = 0;
    for (let i = 0; i < n; i++) { u[i] = gauss(rng); s += u[i] * u[i]; }
    s = Math.sqrt(s) || 1;
    for (let i = 0; i < n; i++) u[i] /= s;
    return u;
  }
  const toArr = (v, n) => {
    const a = new Float64Array(n);
    if (typeof v === 'number') a.fill(v); else for (let i = 0; i < n; i++) a[i] = v[i % v.length];
    return a;
  };

  /* ============================================================
   * 环境剧本: 分段常速度. 每一段有自己的速度向量 (模长 v, 方向默认随机).
   *   type 'static'   : v ≡ 0
   *   type 'constant' : 恒定速度. vVec 给出每维速度, 或 v + dir
   *   type 'script'   : phases = [{ years, v, dir?, shock? }, ...], 最后一段无限延续
   *   type 'shocks'   : 平静 (v = vCalm, 时长 ~ Exp(meanGap)) 与冲击 (v = vShock, 时长 ~ U(durMin, durMax)) 交替
   * ============================================================ */
  class Environment {
    constructor(n, opts, rng) {
      this.n = n; this.o = opts || { type: 'static' }; this.rng = rng;
      this.phases = [];            // { T0, T1, vel, shock }
      this.idx = 0;
      this._scriptPos = 0;
      this._nextIsShock = false;
    }
    _vel(v, dir) {
      const n = this.n;
      if (!(v !== 0)) { return new Float64Array(n); }
      const d = dir ? new Float64Array(n) : unitVector(this.rng, n);
      if (dir) {
        for (let i = 0; i < n && i < dir.length; i++) d[i] = dir[i];   // 不足 n 维的方向补零
        let s = 0; for (let i = 0; i < n; i++) s += d[i] * d[i]; s = Math.sqrt(s) || 1; for (let i = 0; i < n; i++) d[i] /= s;
      }
      for (let i = 0; i < n; i++) d[i] *= v;
      return d;
    }
    _gen() {
      const o = this.o, n = this.n;
      const T0 = this.phases.length ? this.phases[this.phases.length - 1].T1 : 0;
      let ph;
      if (o.type === 'constant') {
        ph = { T0, T1: Infinity, vel: o.vVec ? toArr(o.vVec, n) : this._vel(o.v || 0, o.dir || [1]), shock: false };
      } else if (o.type === 'script') {
        const list = o.phases || [];
        const p = list[Math.min(this._scriptPos, list.length - 1)] || { v: 0 };
        const last = this._scriptPos >= list.length - 1;
        this._scriptPos++;
        ph = { T0, T1: last ? Infinity : T0 + p.years, vel: p.vVec ? toArr(p.vVec, n) : this._vel(p.v || 0, p.dir), shock: !!p.shock };
      } else if (o.type === 'shocks') {
        if (this._nextIsShock) {
          const dur = o.durMin + (o.durMax - o.durMin) * this.rng();
          ph = { T0, T1: T0 + dur, vel: this._vel(o.vShock, null), shock: true };
        } else {
          let u = this.rng(); if (u < 1e-300) u = 1e-300;
          const gap = -Math.log(u) * o.meanGap;
          ph = { T0, T1: T0 + gap, vel: this._vel(o.vCalm, null), shock: false };
        }
        this._nextIsShock = !this._nextIsShock;
      } else {
        ph = { T0, T1: Infinity, vel: new Float64Array(n), shock: false };
      }
      this.phases.push(ph);
    }
    /** T 时刻所在的那一段 */
    at(T) {
      if (!this.phases.length) this._gen();
      while (T >= this.phases[this.idx].T1) { this.idx++; if (this.idx >= this.phases.length) this._gen(); }
      return this.phases[this.idx];
    }
  }

  /* ============================================================
   * 慢层状态推进: 对角, 每维独立, 经典四阶 Runge–Kutta.
   *   st  : { s, Vx, Vh, theta }  (Float64Array, 原地更新)
   *   par : { n, h, U, muE, deltaH, direct, fixV }
   *   e   : 表达比例 (步内冻结)     phi : 感知折扣 (C6, 步内冻结)
   *   vel : θ 的速度向量 (步内冻结, 可为 null)
   * θ(t) = θ_0 + vel·t 在 RK4 的各级里按精确时间取值.
   * ============================================================ */
  function advanceSlow(st, par, e, phi, vel, dt) {
    const n = par.n, direct = par.direct, fixV = par.fixV;
    const a = par.muE * e, out = a + par.deltaH;
    for (let k = 0; k < n; k++) {
      const h = par.h[k], U = par.U[k], th0 = st.theta[k], v = vel ? vel[k] : 0;
      const s0 = st.s[k], X0 = st.Vx[k], H0 = st.Vh[k];
      let dS, dX, dH;
      const f = (t, s, X, Hd) => {
        if (fixV) { dX = 0; dH = 0; }
        else if (direct) { dX = U - h * X * X; dH = 0; }
        else { dH = U - out * Hd; dX = a * Hd - h * X * X; }
        dS = X * h * phi * (th0 + v * t - s);
      };
      f(0, s0, X0, H0);
      const s1 = dS, x1 = dX, h1 = dH;
      f(dt / 2, s0 + dt / 2 * s1, X0 + dt / 2 * x1, H0 + dt / 2 * h1);
      const s2 = dS, x2 = dX, h2 = dH;
      f(dt / 2, s0 + dt / 2 * s2, X0 + dt / 2 * x2, H0 + dt / 2 * h2);
      const s3 = dS, x3 = dX, h3 = dH;
      f(dt, s0 + dt * s3, X0 + dt * x3, H0 + dt * h3);
      st.s[k] = s0 + dt / 6 * (s1 + 2 * s2 + 2 * s3 + dS);
      st.Vx[k] = X0 + dt / 6 * (x1 + 2 * x2 + 2 * x3 + dX);
      st.Vh[k] = H0 + dt / 6 * (h1 + 2 * h2 + 2 * h3 + dH);
      st.theta[k] = th0 + v * dt;
    }
  }
  /** 滞后负荷 ℓ = ½(s−θ)ᵀH(s−θ) */
  function lagLoad(st, par) { let l = 0; for (let k = 0; k < par.n; k++) { const g = st.s[k] - st.theta[k]; l += 0.5 * par.h[k] * g * g; } return l; }
  /** 变异负荷 ½tr(H·V_显) */
  function varLoad(st, par) { let l = 0; for (let k = 0; k < par.n; k++) l += 0.5 * par.h[k] * st.Vx[k]; return l; }

  /* ---------- 政权类型 (第 6 节) ---------- */
  const REGIMES = {
    myopic:     { hP: 2,  useMem: false, fogImmune: false, legalCap: false },   // 短视: 看不见 b, 只看到被 C6 打折的差距
    farsighted: { hP: 30, useMem: true,  fogImmune: true,  legalCap: false },   // 远见: 看得见 b, 不受 C6 影响
    zhaogong:   { hP: 2,  useMem: false, fogImmune: false, legalCap: true },    // 召公: 硬约束 P ≤ P̄_eff − margin, 其余同短视
  };

  /* ---------- 快层基线 (周期律场景用; 理由见 docs/周期律耦合模型.md 的"校准"一节) ----------
   * tolMul 0.3   : τ ~ U[0, 0.3]. 原默认 τ ~ U[0,1] 下 P < 0.98 时低态不存在, 宽松的新政权会立刻"被推翻".
   * memDecay     : 0.005/轮 ≈ 积怨记忆 10 年 (原默认 0.2/轮 ≈ 2 个月, b 攒不起来).
   * releaseProb  : 0.01/轮 ≈ 刑期 5 年 (原默认 0 是永久拘押, 百年后自由人口被抽干).            */
  const CYCLE_FAST = { N: 1000, tolType: 'uniform', tolMul: 0.3, P: 0.4, Pbar: 0.5, K0: 20, M: 60, memDecay: 0.005, releaseProb: 0.01, seed: 7 };

  const DEFAULTS = {
    standalone: false,       // true: 不建快层, e ≡ 1 (L2)
    eFixed: 1,               // standalone 下的常数表达比例 (默认 1; 只在核对显隐库稳态时改)
    seedSlow: 20260607,      // 慢层随机数种子 (与快层的 seed 无关)
    roundsPerYear: 20,       // Δ: 每年快轮数; dt = 1/Δ
    /* ---- 慢层 ---- */
    n: 5,                    // 制度维数
    h: 1,                    // 曲率 (数或数组)
    U0: 0.02,                // 变异产生率 /年 (数或数组)
    Umin: 0.002, Umax: 0.2,  // 二阶选择调整 U 时的上下界
    poolMode: 'split',       // 'split' 显隐两库 | 'direct' 经典单库 (standalone 默认 direct)
    muE: 2,                  // μ_e 表达转移率 /年
    deltaH: 0,               // δ_h 隐藏想法消亡率 /年
    fixV: false,             // 冻结 V (只在 T2 扫描 V_opt 时用)
    V0: null, Vh0: null,     // 初值; null = 取稳态
    env: { type: 'shocks', vCalm: 0.002, vShock: 0.05, durMin: 20, durMax: 40, meanGap: 150, sigmaTheta: 0 },
    /* ---- 表达比例 (5.2) ---- */
    lambdaS: 0.1,            // λ_s 说话代价 / 上街代价. (原提示词 0.3 是配 τ~U[0,1] 的; τ~U[0,0.3] 下等比例重标为 0.1)
    lambdaB: 0,              // λ_b 积怨让人更敢说的程度 (默认 0: 说话不泄露 b)
    /* ---- 耦合 ---- */
    kappa: 0.1, xiSigma: 0,  // C1 滞后生怨; ξ_i 的对数正态离散度 (0 = 全为 1)
    evolveP: true,           // C2
    lambdaW: 0.5, Wref: 'auto',   // C3; 'auto' = 平静稳态的 W, 即 −½·Σ√(U_k·h_k)
    chi: 0.3, deltaL: 0.2,   // C4
    betaFog: 0.5,            // C6
    revolution: true,        // C7
    /* ---- 政权 (第 6 节) ---- */
    regime: 'myopic',        // 'myopic' | 'farsighted' | 'zhaogong'
    hP: null, useMem: null, fogImmune: null, legalCap: null,   // null = 按 regime 预设
    etaP: 0.05, deltaP: 0.02, cE: 0.05, cX: 5,
    Pmin: 0.3, Pmax: 2.0, margin: 0.05,
    dPmax: 0.02,             // 每次更新 P 的最大步长, 默认等于探测半径 δ (信赖域): 政权不迈到它没评估过的地方.
                             // 不设这个上限, 看得远的政权 (J 按 h_P 年累加, 梯度大 15 倍) 会一步迈过它刚刚看见的悬崖
    DeltaP: null,            // 政权更新间隔 (轮); null = Δ, 即一年
    vWindow: 10,             // 估计环境速度 v̂ 的窗口 (年)
    forecastDt: 0.25,        // 政权预测时慢层 ODE 的步长 (年)
    evolveU: false, etaU: 0.05, deltaU: 0.05, dlnUmax: 0.1,     // 二阶选择调整 U (对 ln U 爬山)
    /* ---- 改朝换代 (第 7 节) ---- */
    xRev: 0.6, dRev: 0.7, mRev: 3,
    rRel: 0.8, zetaJump: 0.5, phiCath: 0.7, Pnew: 0.4,
    K0newFrac: 0.5, tauK: 10,       // 新政权的警力是旧编制的几成, 以及恢复的时间常数 (年)
    nChaos: 0, Wchaos: 0.5, sigmaChaos: 0.05,   // 可选的空位期 (轮), 期间 W 的扣减, s 的随机游走强度 (/√年)
    Lmax: 1,                 // standalone 的崩溃判据: ℓ + ½tr(HV) > L_max 持续 mRev 轮
    /* ---- 背景种子 ---- */
    u0: 0.5, seedMode: 'random',    // 每轮 Poisson(u0) 个"例行小动作", 用慢层 RNG 抽取
    /* ---- 记录 ---- */
    recordEvery: 1,          // 每几轮记一次 hist
    critEvery: 0,            // 每几轮算一次两条临界种子 (0 = 不算; 较贵)
    fast: null,              // 传给 new Sim() 的参数; null = CYCLE_FAST. 传入时原样使用
  };
  /** 全部耦合的关闭值 (L1 用) */
  const OFF = { kappa: 0, evolveP: false, lambdaW: 0, chi: 0, deltaL: 0, betaFog: 0, revolution: false, u0: 0 };

  class CycleSim {
    constructor(opts) {
      opts = opts || {};
      const o = this.o = Object.assign({}, DEFAULTS, opts);
      o.env = Object.assign({}, opts.env || DEFAULTS.env);
      if (o.standalone && opts.poolMode === undefined) o.poolMode = 'direct';
      const R = REGIMES[o.regime] || REGIMES.myopic;
      for (const key of ['hP', 'useMem', 'fogImmune', 'legalCap']) if (o[key] === null || o[key] === undefined) o[key] = R[key];
      if (!o.DeltaP) o.DeltaP = o.roundsPerYear;
      const n = o.n;
      this.dt = 1 / o.roundsPerYear;
      /* 慢层的独立随机数子流: 环境剧本 / 环境噪声 / 乱世跳动 / 背景种子 / 个体暴露度.
         分开是为了让"同一 seedSlow, 不同政权"面对完全相同的环境. */
      const base = o.seedSlow >>> 0;
      this.rngEnv = mulberry32(base);
      this.rngNoise = mulberry32((base ^ 0x9E3779B9) >>> 0);
      this.rngJump = mulberry32((base + 0x85EBCA6B) >>> 0);
      this.rngSeed = mulberry32((base ^ 0xC2B2AE35) >>> 0);
      this.rngXi = mulberry32((base + 0x27D4EB2F) >>> 0);
      /* 快层 */
      this.sim = o.standalone ? null : new Sim(o.fast ? o.fast : CYCLE_FAST);
      const sim = this.sim;
      /* 慢层参数与状态 */
      this.par = { n, h: toArr(o.h, n), U: toArr(o.U0, n), muE: o.muE, deltaH: o.deltaH, direct: o.poolMode === 'direct', fixV: !!o.fixV };
      this.U0 = Float64Array.from(this.par.U);
      this.env = new Environment(n, o.env, this.rngEnv);
      this.t = 0;              // 已完成的快轮数
      this.lastX = sim ? sim.meanU8(sim.a) : 0;
      this.lastK = sim ? sim.capacity(sim.meanU8(sim.z)).k : 0;
      this.e = sim ? this.exprAt(sim.eff().P) : o.eFixed;
      const st = this.st = { s: new Float64Array(n), theta: new Float64Array(n), Vx: new Float64Array(n), Vh: new Float64Array(n) };
      for (let k = 0; k < n; k++) {
        const h = this.par.h[k], U = this.par.U[k];
        if (this.par.direct) { st.Vx[k] = Math.sqrt(U / h); st.Vh[k] = 0; }
        else {
          const a = o.muE * Math.max(this.e, 1e-6);
          st.Vh[k] = U / (a + o.deltaH);
          st.Vx[k] = Math.sqrt(a * st.Vh[k] / h);
        }
      }
      if (o.V0 != null) st.Vx.set(toArr(o.V0, n));
      if (o.Vh0 != null) st.Vh.set(toArr(o.Vh0, n));
      if (o.s0 != null) st.s.set(toArr(o.s0, n));
      if (o.theta0 != null) st.theta.set(toArr(o.theta0, n));
      /* C3 的参照绩效 */
      let wAuto = 0; for (let k = 0; k < n; k++) wAuto -= 0.5 * Math.sqrt(this.par.U[k] * this.par.h[k]);
      this.Wref = o.Wref === 'auto' ? wAuto : +o.Wref;
      /* 快层基线量 (耦合在它们之上做修正) */
      if (sim) {
        this.P = sim.o.P;
        this.Pbar0 = sim.o.Pbar;
        this.K0base = sim.o.K0; this.K0cur = sim.o.K0; this.k0Active = false;
        this.psi0 = Float64Array.from(sim.psi);
        this.xi = new Float64Array(sim.o.N).fill(1);
        if (o.xiSigma > 0) {               // 对数正态, 均值 1
          const sg = o.xiSigma;
          for (let i = 0; i < sim.o.N; i++) this.xi[i] = Math.exp(sg * gauss(this.rngXi) - 0.5 * sg * sg);
        }
      } else { this.P = 0; this.Pbar0 = 0; }
      this.PbarEff = this.Pbar0;
      this.phi = 1;                         // 当前的感知折扣 (C6)
      this.chaosLeft = 0;
      this.xRun = 0; this.dRun = 0; this.loadRun = 0;
      this.firstCollapse = null;
      this.lastSeedCount = 0;
      this.thetaHatLog = [];                // 政权每次更新时记下的 θ̂ (估计 v̂ 用)
      this.dynasties = [];
      this._newDynasty();
      this.hist = { t: [], T: [], lag: [], percLag: [], ell: [], vload: [], W: [], Vx: [], Vh: [], U: [], e: [], P: [], PbarEff: [],
        x: [], d: [], b: [], k: [], adapt: [], shock: [], dyn: [], xcTau: [], xcMem: [] };
      this._xcTau = NaN; this._xcMem = NaN;
      this._refreshDerived();
    }

    /* ---------- 派生量 ---------- */
    _refreshDerived() {
      const st = this.st, par = this.par;
      this.ell = lagLoad(st, par);
      this.vload = varLoad(st, par);
      this.W = -this.ell - this.vload - (this.chaosLeft > 0 ? this.o.Wchaos : 0);
      let g2 = 0, sp2 = 0, vx = 0, vh = 0, u = 0;
      for (let k = 0; k < par.n; k++) {
        const g = st.theta[k] - st.s[k]; g2 += g * g;
        const sp = st.Vx[k] * par.h[k] * this.phi * g; sp2 += sp * sp;
        vx += st.Vx[k]; vh += st.Vh[k]; u += par.U[k];
      }
      this.lag = Math.sqrt(g2);             // ‖s − θ‖
      this.adapt = Math.sqrt(sp2);          // ‖ds/dT‖, 适应速度
      this.VxMean = vx / par.n; this.VhMean = vh / par.n; this.UMean = u / par.n;
    }
    get T() { return this.t * this.dt; }

    /** 表达比例 e (5.2): 候选处罚强度 P 下, 自由人口里"敢说话"的比例. 只读, 不消耗随机数 */
    exprAt(P) {
      const sim = this.sim; if (!sim) return 1;
      const o = this.o, c = o.lambdaS * sim.cost(this.lastK, this.lastX, P), lb = o.lambdaB;
      let free = 0, talk = 0;
      for (let i = 0; i < sim.o.N; i++) {
        if (sim.r[i]) continue;
        free++;
        if (sim.tau[i] + lb * sim.b[i] >= c) talk++;
      }
      return free ? talk / free : 0;
    }
    /** 快层冻结切面在 P 下, 从当前 x 出发迭代反应函数到达的吸引子 x̂ (只读) */
    attractorAt(P, useMem) {
      const sim = this.sim; if (!sim) return 0;
      let x = sim.meanU8(sim.a);
      for (let it = 0; it < 300; it++) {
        const nx = sim.frozenF(x, P, this.lastK, useMem);
        if (Math.abs(nx - x) < 1e-9) { x = nx; break; }
        x = nx;
      }
      return x;
    }
    /** 政权眼里的环境位置 θ̂ (C6) */
    perceivedTheta() {
      const st = this.st, n = this.par.n, out = new Float64Array(n);
      for (let k = 0; k < n; k++) out[k] = st.s[k] + this.phi * (st.theta[k] - st.s[k]);
      return out;
    }
    _vHat() {
      const log = this.thetaHatLog, n = this.par.n, v = new Float64Array(n);
      if (log.length < 2) return v;
      const yearsPer = this.o.DeltaP * this.dt;
      const back = Math.min(log.length - 1, Math.max(1, Math.round(this.o.vWindow / yearsPer)));
      const a = log[log.length - 1 - back], b = log[log.length - 1];
      for (let k = 0; k < n; k++) v[k] = (b[k] - a[k]) / (back * yearsPer);
      return v;
    }
    /** 政权的预测: 在自己的感知模型里把慢层往前推 hP 年, 返回 ∫(−ℓ̂ − ½tr(H·V̂_显)) dT.
     *  e: 候选表达比例; uScale: 候选的 U 缩放 */
    forecastSlow(e, uScale) {
      const o = this.o, par = this.par, n = par.n;
      const st = { s: Float64Array.from(this.st.s), theta: this.perceivedTheta(), Vx: Float64Array.from(this.st.Vx), Vh: Float64Array.from(this.st.Vh) };
      const p2 = uScale === 1 ? par : Object.assign({}, par, { U: par.U.map(u => u * uScale) });
      const vel = this._vHat();
      const steps = Math.max(1, Math.round(o.hP / o.forecastDt)), dtf = o.hP / steps;
      let acc = 0;
      for (let i = 0; i < steps; i++) {
        advanceSlow(st, p2, e, 1, vel, dtf);
        acc += (-lagLoad(st, p2) - varLoad(st, p2)) * dtf;
      }
      return acc;
    }
    /** 政权的目标 J(P') (第 6 节) */
    objectiveP(Pc) {
      const o = this.o;
      return this.forecastSlow(this.exprAt(Pc), 1) - o.cE * Pc * o.hP - o.cX * this.attractorAt(Pc, o.useMem) * o.hP;
    }
    _legalCap() { return Math.max(this.o.Pmin, this.PbarEff - this.o.margin); }

    _updateRegime() {
      const o = this.o;
      this.thetaHatLog.push(this.perceivedTheta());
      if (this.thetaHatLog.length > 4096) this.thetaHatLog.splice(0, 2048);
      if (this.sim && o.evolveP) {
        /* 中心差分; 但候选值不越出允许范围 (贴着边界时退化为单侧差分): 政权不去评估它本来就不能选的政策 */
        const d = o.deltaP;
        const hi = o.legalCap ? Math.min(o.Pmax, this._legalCap()) : o.Pmax;
        const Pp = Math.min(hi, this.P + d), Pm = Math.max(o.Pmin, this.P - d);
        const grad = Pp > Pm ? (this.objectiveP(Pp) - this.objectiveP(Pm)) / (Pp - Pm) : 0;
        let step = o.etaP * grad;
        if (step > o.dPmax) step = o.dPmax; else if (step < -o.dPmax) step = -o.dPmax;
        let P = this.P + step;
        if (P > hi) P = hi;
        if (P < o.Pmin) P = o.Pmin;
        this.lastGradP = grad;
        this.P = P;
      }
      if (o.evolveU && !this.par.fixV) {
        const d = o.deltaU, e = this.e;
        const grad = (this.forecastSlow(e, Math.exp(d)) - this.forecastSlow(e, Math.exp(-d))) / (2 * d);
        let step = o.etaU * grad;
        if (step > o.dlnUmax) step = o.dlnUmax; else if (step < -o.dlnUmax) step = -o.dlnUmax;
        const f = Math.exp(step);
        for (let k = 0; k < this.par.n; k++) {
          const u = this.par.U[k] * f;
          this.par.U[k] = u < o.Umin ? o.Umin : u > o.Umax ? o.Umax : u;
        }
        this.lastGradU = grad;
      }
    }

    /* ---------- 朝代记录 ---------- */
    _newDynasty() {
      this.dyn = { index: this.dynasties.length, startRound: this.t, Wpeak: -Infinity, WpeakRound: this.t, VxAtWpeak: NaN, PAtWpeak: NaN,
        VxMin: Infinity, VxMinRound: this.t, xMaxPre: 0, xBuf: [] };
    }
    _trackDynasty(x) {
      const D = this.dyn;
      if (this.W > D.Wpeak) { D.Wpeak = this.W; D.WpeakRound = this.t; D.VxAtWpeak = this.VxMean; D.PAtWpeak = this.P; }
      if (this.VxMean < D.VxMin) { D.VxMin = this.VxMean; D.VxMinRound = this.t; }
      D.xBuf.push(x);                       // 延迟一年再并入 xMaxPre: 最后一年的起飞不算"崩溃前"
      if (D.xBuf.length > this.o.roundsPerYear) { const v = D.xBuf.shift(); if (v > D.xMaxPre) D.xMaxPre = v; }
    }
    _closeDynasty(cause) {
      const D = this.dyn, sim = this.sim, dt = this.dt;
      let bAvg = 0;
      if (sim) { for (let i = 0; i < sim.o.N; i++) bAvg += sim.b[i]; bAvg /= sim.o.N; }
      const rec = {
        index: D.index, startRound: D.startRound, endRound: this.t, years: (this.t - D.startRound) * dt,
        Wpeak: D.Wpeak, WpeakYear: (D.WpeakRound - D.startRound) * dt, VxAtWpeak: D.VxAtWpeak, PAtWpeak: D.PAtWpeak,
        VxMin: D.VxMin, VxMinYear: (D.VxMinRound - D.startRound) * dt,
        xMaxPre: D.xMaxPre, bAtFall: bAvg, VhAtFall: this.VhMean, VxAtFall: this.VxMean, PAtFall: this.P, eAtFall: this.e,
        lagAtFall: this.lag, cause,
      };
      this.dynasties.push(rec);
      return rec;
    }

    /* ---------- 改朝换代的重置 (第 7 节) ---------- */
    _revolution(cause) {
      const o = this.o, st = this.st, par = this.par, n = par.n, sim = this.sim;
      this._closeDynasty(cause);
      if (this.firstCollapse === null) this.firstCollapse = this.t;
      /* 慢层 */
      for (let k = 0; k < n; k++) {
        const hid = par.direct ? st.Vx[k] : st.Vh[k];          // direct 模式没有隐藏库, 跳动幅度按 V 计
        if (!sim) st.s[k] = st.theta[k];                       // standalone: 负荷判据下不重置滞后就会连环崩溃, 所以新政权从当前最优点出发
        if (!par.direct) { st.Vx[k] += o.rRel * st.Vh[k]; st.Vh[k] *= (1 - o.rRel); }   // 隐藏变异释放
        st.s[k] += Math.sqrt(o.zetaJump * hid) * gauss(this.rngJump);                  // 乱世的随机跳动
        par.U[k] = this.U0[k];
      }
      if (!sim) {
        this.loadRun = 0;
      } else {
        /* 快层: 只经由已有入口与直接重置状态数组 */
        this.P = o.Pnew; sim.o.P = o.Pnew;
        this.K0cur = this.K0base * o.K0newFrac; this.k0Active = true;
        sim.pushEvent({ amnesty: true });
        const keep = 1 - o.phiCath;
        for (let i = 0; i < sim.o.N; i++) { sim.b[i] *= keep; sim.latent[i] *= keep; }
        for (const E of sim.Ehist) for (let i = 0; i < E.length; i++) E[i] *= keep;
        sim.z.fill(0);
        sim.flagged.fill(0);
        sim.a = new Uint8Array(sim.o.N);                       // 人们回家了
        sim.tauDirty = true;                                   // 提醒分析工具重建缓存 (step 开头本来也会置位)
        this.xRun = 0; this.dRun = 0;
        this.lastX = 0;
      }
      this.chaosLeft = o.nChaos;
      this._newDynasty();
    }

    /**
     * 推进一个快轮 (第 8 节的顺序).
     * @param extraSeeds 外部额外投入的种子人数 (在背景种子之外)  @param seedMode 'random' | 'near'
     */
    step(extraSeeds, seedMode) {
      const o = this.o, sim = this.sim, st = this.st, par = this.par, dt = this.dt;
      let x = 0, d = 0, snap = null;
      if (sim) {
        /* -- 1. 慢 → 快: 只写已有的外生入口; 关闭的通道完全不写 -- */
        if (o.lambdaW !== 0) { this.PbarEff = Math.max(0, this.Pbar0 + o.lambdaW * (this.W - this.Wref)); sim.o.Pbar = this.PbarEff; }   // C3
        else this.PbarEff = sim.o.Pbar;
        if (o.evolveP) {                                                                                                                  // C2
          if (o.legalCap) { const cap = this._legalCap(); if (this.P > cap) this.P = cap; }
          sim.o.P = this.P;
        } else this.P = sim.o.P;
        if (o.chi !== 0 || this.k0Active) {                                                                                               // C4 (财政)
          if (this.k0Active) { this.K0cur += (this.K0base - this.K0cur) * Math.min(1, dt / o.tauK); }
          sim.o.K0 = this.K0cur * Math.max(0, 1 - o.chi * this.ell);
        }
        if (o.deltaL !== 0) { const sh = o.deltaL * this.ell; for (let j = 0; j < sim.psi.length; j++) sim.psi[j] = this.psi0[j] - sh; }    // C4 (军心)
        /* -- 2. 快层走一步 (原模型完全不变) -- */
        let seeds = extraSeeds || 0, mode = seeds > 0 ? (seedMode || 'random') : o.seedMode;
        if (o.u0 > 0) seeds += poisson(this.rngSeed, o.u0);
        this.lastSeedCount = seeds; this.lastSeedMode = mode;
        const Pt = sim.eff().P;                               // 本轮实际生效的 P (含一次性事件的覆盖)
        snap = sim.step(seeds, mode);
        /* -- 3. 读快层 → 表达比例 e (5.2); 不回写 -- */
        const hx = sim.hist.x, hk = sim.hist.k, hd = sim.hist.d;
        x = hx[hx.length - 1]; d = hd[hd.length - 1];
        this.lastX = x; this.lastK = hk[hk.length - 1];
        this.e = this.exprAt(Pt);
        /* -- 4. C1 滞后生怨 -- */
        if (o.kappa !== 0) {
          const base = o.kappa * this.ell * dt;
          if (base > 0) for (let i = 0; i < sim.o.N; i++) if (!sim.r[i]) sim.addGrievance(i, base * this.xi[i]);
        }
        /* C6 感知折扣 (只影响慢层) */
        this.phi = (o.betaFog !== 0 && !o.fogImmune) ? 1 - o.betaFog * Math.min(1, Math.max(0, Pt - this.PbarEff)) : 1;
      }
      /* -- 5. 慢层 ODE 推进 dt -- */
      const ph = this.env.at(this.t * dt);
      this.shock = ph.shock;
      advanceSlow(st, par, this.e, this.phi, ph.vel, dt);
      const sg = o.env.sigmaTheta || 0;
      if (sg > 0) { const sc = sg * Math.sqrt(dt); for (let k = 0; k < par.n; k++) st.theta[k] += sc * gauss(this.rngNoise); }
      if (this.chaosLeft > 0) {                               // 空位期: s 随机游走
        const sc = o.sigmaChaos * Math.sqrt(dt);
        for (let k = 0; k < par.n; k++) st.s[k] += sc * gauss(this.rngJump);
      }
      this.t++;
      this._refreshDerived();
      if (this.chaosLeft > 0) this.chaosLeft--;
      /* -- 6. 政权更新 P (以及 U) -- */
      if (this.t % o.DeltaP === 0) this._updateRegime();
      /* -- 7. 改朝换代 -- */
      this._trackDynasty(x);
      let fell = null;
      if (sim) {
        this.xRun = x >= o.xRev ? this.xRun + 1 : 0;
        this.dRun = d >= o.dRev ? this.dRun + 1 : 0;
        if (this.xRun >= o.mRev) fell = 'x'; else if (this.dRun >= o.mRev) fell = 'd';
      } else {
        this.loadRun = (this.ell + this.vload > o.Lmax) ? this.loadRun + 1 : 0;
        if (this.loadRun >= o.mRev) fell = 'load';
      }
      if (fell) {
        if (o.revolution) this._revolution(fell);
        else if (this.firstCollapse === null) this.firstCollapse = this.t;   // 只记下判据首次满足的时刻
        if (o.revolution) this._refreshDerived();
      }
      /* -- 8. 记录 -- */
      if (o.critEvery > 0 && sim && this.t % o.critEvery === 0) {
        const a1 = sim.analysis({ useMem: false }).xCrit, a2 = sim.analysis({ useMem: true }).xCrit;
        this._xcTau = a1 == null ? NaN : a1; this._xcMem = a2 == null ? NaN : a2;
      }
      if (this.t % o.recordEvery === 0) {
        const h = this.hist;
        h.t.push(this.t); h.T.push(this.t * dt); h.lag.push(this.lag); h.percLag.push(this.lag * this.phi); h.ell.push(this.ell); h.vload.push(this.vload);
        h.W.push(this.W); h.Vx.push(this.VxMean); h.Vh.push(this.VhMean); h.U.push(this.UMean); h.e.push(this.e);
        h.P.push(this.P); h.PbarEff.push(this.PbarEff);
        h.x.push(x); h.d.push(d); h.b.push(snap ? snap.bAvg : 0); h.k.push(sim ? this.lastK : 0);
        h.adapt.push(this.adapt); h.shock.push(this.shock ? 1 : 0); h.dyn.push(fell && o.revolution ? this.dynasties.length - 1 : this.dynasties.length);
        h.xcTau.push(this._xcTau); h.xcMem.push(this._xcMem);
      }
      return fell;
    }

    run(rounds, seedFn) {
      for (let s = 0; s < rounds; s++) {
        const sc = seedFn ? (seedFn(this.t) || 0) : 0;
        this.step(sc.count !== undefined ? sc.count : sc, sc.mode || 'random');
      }
      return this;
    }
  }

  /* ---------- 闭式解 (L2 核对与页面叠加用) ---------- */
  const theory = {
    Vstar: (U, h) => Math.sqrt(U / h),
    /** Riccati 方程 V' = U − hV² 的精确解 */
    Vt: (V0, U, h, t) => { const Vs = Math.sqrt(U / h), th = Math.tanh(Math.sqrt(U * h) * t); return Vs * (V0 + Vs * th) / (Vs + V0 * th); },
    lagStar: (v, V, h) => v / (V * h),
    lagLoadStar: (v, V, h) => v * v / (2 * h * V * V),
    /** V 固定, 从 0 滞后出发的滞后轨迹 g(t) = g*·(1 − e^{−Vht}) */
    lagT: (v, V, h, t) => v / (V * h) * (1 - Math.exp(-V * h * t)),
    /** V 按 Riccati 解演化 (V(0)=V0), 从 0 滞后出发的滞后轨迹. 积分因子 M(t) = cosh(ωt) + (V0/V*)·sinh(ωt), ω = √(Uh):
     *  g(t) = (v/ω)·(tanh ωt + r·(1 − sech ωt)) / (1 + r·tanh ωt),  r = V0/V*.  t→∞ 时趋于 v/(V*·h) */
    lagRiccati: (v, V0, U, h, t) => { const w = Math.sqrt(U * h), r = V0 / Math.sqrt(U / h), th = Math.tanh(w * t), sech = 1 / Math.cosh(w * t); return v / w * (th + r * (1 - sech)) / (1 + r * th); },
    vCrit: (V, h, Lmax) => V * Math.sqrt(Math.max(0, 2 * h * (Lmax - h * V / 2))),
    totalLoad: (v, V, h) => h * V / 2 + v * v / (2 * h * V * V),
    Vopt: (v, h) => Math.cbrt(2 * v * v / (h * h)),
    VhidStar: (U, muE, e, deltaH) => U / (muE * e + deltaH),
    VexpStar: (U, h, muE, e, deltaH) => Math.sqrt(muE * e * U / ((muE * e + deltaH) * h)),
  };

  /* ---------- 校准值与预设场景 ----------
   * DEFAULTS 是提示词的初值 (经确认的修正见文档). 用初值跑, 所有政权都把 P 降到 P_min, 1000 年里没有一次改朝换代.
   * CALIB 是让周期出现所需的最小改动, 只动两个数 (在校准用的 seed 上定的, T6 在另外的 seed 上报告):
   *   cE   0.05 → 0.002 : 压制表达的收益是暂态的, 每单位 P 约 0.017 (h_P=2), 执法成本 c_E·h_P 必须低于它, 棘轮才存在.
   *   etaP 0.05 → 1     : J 的梯度量级约 0.01, 要让 P 在百年尺度上变化 O(1), 学习率得是 O(1).               */
  const CALIB = { cE: 0.002, etaP: 1 };
  const SHOCKS = { type: 'shocks', vCalm: 0.002, vShock: 0.05, durMin: 20, durMax: 40, meanGap: 150, sigmaTheta: 0 };
  const LIWANG = { N: 2000, tolType: 'low', netType: 'random', netDeg: 8, P: 1.15, Pbar: 0.6, K0: 40, M: 80, alpha: 0.2, beta: 0.4, delta: 0.3, gamma: 12, memDecay: 0.04, vis: 0.7, omega: 1, globalScale: 0.5, noise: 0, hardCore: 0.002, targetMode: 'organizer', netDamage: 0.6, releaseProb: 0.05, seed: 21, d0: 0, psiScale: 1 };
  const SCENARIOS = {
    static: {
      name: '① 静止环境: 只有棘轮', years: 300,
      desc: '环境不动 (v=0). 短视政权每年往前看 2 年: 压一压, 说话的人少了, 眼前的"杂音"(变异负荷) 就小一点. 于是 <b>P 一年年往上推, e 往下走</b>. 没有任何冲击, 也没有人上街, 最后是执行者自己不干了. 把"执法成本 c_E"调回 0.05 再跑: 棘轮消失, P 降到 P_min.',
      opts: Object.assign({}, CALIB, { regime: 'myopic', env: { type: 'static' } }),
    },
    iceage: {
      name: '② 小冰期: 平静之后来一次冲击', years: 300,
      desc: '先平静 60 年, 然后环境连续移动 30 年 (v=0.05/年), 再恢复平静. 冲击到来时制度跟不上, 滞后负荷 ℓ 上升: 积怨增加 (C1), 合法性界线下移 (C3), 财政与军心受损 (C4). <b>同样的冲击, 落在王朝早期还是晚期, 结果不同</b>: 拖动"冲击开始年份"试试.',
      opts: Object.assign({}, CALIB, { regime: 'myopic', env: { type: 'script', phases: [{ years: 60, v: 0.002 }, { years: 30, v: 0.05, shock: true }, { v: 0.002 }] } }),
    },
    cycle: {
      name: '③ 周期律: 随机冲击下的多轮兴衰', years: 1000,
      desc: '冲击随机到来 (平均间隔 150 年, 每次 20–40 年). 短视政权. 看慢层图上 P 的锯齿, 和每个朝代末尾 d 的陡升. 下方的朝代表列出每一次倒台的原因: <b>x</b> 是人群越过临界点, <b>d</b> 是执行者倒戈.',
      opts: Object.assign({}, CALIB, { regime: 'myopic', env: SHOCKS }),
    },
    zhaogong: {
      name: '④ 召公: 宣之使言', years: 1000,
      desc: '环境与 ③ 完全相同 (同一个慢层种子), 但政权守住 P ≤ P̄_eff − margin: 处罚不越过人们认可的界线. 绩效一差, 界线下移, 它就跟着放宽.',
      opts: Object.assign({}, CALIB, { regime: 'zhaogong', env: SHOCKS }),
    },
    farsighted: {
      name: '⑤ 远见: 看得见积怨, 看 30 年', years: 1000,
      desc: '环境与 ③ 相同. 政权看得见 b (用 τ+b 算临界点), 往前看 30 年, 情报不失真. 它知道压制的收益是暂时的, 所以平时把 P 放得很低, 只在临界点逼近时才收紧.',
      opts: Object.assign({}, CALIB, { regime: 'farsighted', env: SHOCKS }),
    },
    mibang: {
      name: '⑥ 弭谤有效吗: δ_h=0 对比 δ_h>0', years: 250,
      desc: '政权不调 P. 第 50 年把 P 从 0.4 一次提到 1.5 (厉王弭谤). 实线: 被压住的想法不会消亡 (δ_h=0); 虚线: 会消亡 (δ_h=0.2/年). <b>δ_h=0 时 V_显 只是暂时下降, 几年后回到原值</b>, 变异只是存进了 V_隐; 只有 δ_h>0, 压制才有长期效果.',
      opts: { regime: 'myopic', evolveP: false, revolution: false, kappa: 0, lambdaW: 0, chi: 0, deltaL: 0, betaFog: 0, u0: 0, env: { type: 'static' }, fast: Object.assign({}, CYCLE_FAST, { alpha: 0, beta: 0, delta: 0 }) },
      compare: { deltaH: 0.2 },
      events: [{ year: 50, setP: 1.5 }],
    },
    degenA: {
      name: '⑦ 退化检查 A: 耦合全关 = 原模型', years: 15,
      desc: '快层用 lab.html 的"② 厉王弭谤"参数, 每轮 10 人例行小动作; 全部耦合取关闭值. 页面同时跑一个原版 Sim, 逐轮比较: <b>x, d, b̄ 必须逐位相同</b> (状态栏显示比较结果). 慢层照常演化, 但碰不到快层.',
      opts: Object.assign({}, OFF, { env: SHOCKS, fast: LIWANG }),
      seedEvery: { count: 10, every: 1 }, checkAgainstSim: true,
    },
    degenB: {
      name: '⑧ 退化检查 B: standalone = Lande 闭式解', years: 120,
      desc: '不建快层, e≡1, 不区分显隐. 一维, 环境匀速 (v=0.01/年), V 从 3 倍稳态值出发. 虚线是闭式解: V(t) 是 Riccati 方程的精确解, 稳态滞后 v/(Vh). <b>仿真与虚线重合</b>.',
      opts: { standalone: true, n: 1, h: 1, U0: 0.02, V0: 3 * Math.sqrt(0.02), env: { type: 'constant', v: 0.01 }, revolution: false, Lmax: 1e9 },
      closedForm: true,
    },
  };

  const api = { CycleSim, Environment, advanceSlow, lagLoad, varLoad, theory, DEFAULTS, OFF, REGIMES, CYCLE_FAST, CALIB, SCENARIOS, gauss, poisson };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.CycleModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
