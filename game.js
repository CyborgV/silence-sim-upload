/* 对局模式: 选边 · 卡牌 · AI 对手 · 新闻条 · 胜负判定
 * 朝廷: 60 轮内不让 x≥0.6 或 d≥0.7 持续 3 轮 → 胜
 * 行动方: 60 轮内使 x≥0.6 或 d≥0.7 持续 3 轮 → 胜
 */
'use strict';
(function (global) {
  const { Sim } = global.SilenceSim;

  const CARDS = {
    court: [
      { id: 'police', name: '增派警力', cost: 2, cd: 6, desc: 'K₀×1.25', run: (s) => { s.o.K0 = Math.min(400, Math.ceil(s.o.K0 * 1.25)); } },
      { id: 'severity', name: '加重处罚', cost: 1, cd: 5, desc: 'P×1.12', run: (s) => { s.o.P = Math.min(2.2, s.o.P * 1.12); } },
      { id: 'preventive', name: '预防性拘捕', cost: 3, cd: 10, desc: '按名单抓 3 轮', run: (s, g) => { g.flags.preventive = 3; } },
      { id: 'blackout', name: '断网封锁', cost: 2, cd: 8, desc: '宣传压缩 −0.2(4轮)', run: (s, g) => { g.flags.blackout = 4; } },
      { id: 'amnesty', name: '大赦天下', cost: 2, cd: 12, desc: '全部释放,记忆保留', run: (s) => { s.pushEvent({ rounds: 1, amnesty: true }); } },
      { id: 'loyalty', name: '加薪稳军心', cost: 2, cd: 8, desc: 'ψ 尺度+0.25, d 立降', run: (s) => { s.o.psiScale += 0.25; for (let j = 0; j < s.z.length; j++) if (s.z[j] && s.rng() < 0.5) s.z[j] = 0; } },
      { id: 'legit', name: '法外开恩', cost: 1, cd: 6, desc: 'P̄+0.1(日常不再积怨)', run: (s) => { s.o.Pbar = Math.min(s.o.P, s.o.Pbar + 0.1); } },
    ],
    movement: [
      { id: 'march', name: '街头行动', cost: 1, cd: 3, desc: '随机种子 35 人', run: (s, g) => { g.seedNext += 35; } },
      { id: 'mobilize', name: '门槛动员', cost: 2, cd: 5, desc: '瞄准门槛边 50 人', run: (s, g) => { g.seedNext += 50; g.seedMode = 'near'; } },
      { id: 'network', name: '串联织网', cost: 2, cd: 6, desc: '随机加 400 条边', run: (s) => { if (!s.net) return; const N = s.o.N; for (let t = 0; t < 400; t++) { const a = (s.rng() * N) | 0, b = (s.rng() * N) | 0; if (a !== b) { s.net[a].push(b); s.net[b].push(a); } } } },
      { id: 'tv', name: '录像外泄', cost: 2, cd: 8, desc: '共同证据 1 轮', run: (s) => { s.pushEvent({ rounds: 1, vis: 1, globalScale: 1, omega: Math.max(s.o.omega, 0.7) }); } },
      { id: 'memorial', name: '悼念仪式', cost: 2, cd: 8, desc: '记忆可见度×2(5轮)', run: (s, g) => { g.flags.memorial = 5; } },
      { id: 'strike', name: '总罢工', cost: 3, cd: 12, desc: '随机种子 120 人', run: (s, g) => { g.seedNext += 120; } },
      { id: 'heal', name: '法律援助', cost: 1, cd: 6, desc: '释放概率 +0.1', run: (s) => { s.o.releaseProb = Math.min(0.6, s.o.releaseProb + 0.1); } },
    ],
  };

  const DIFF = {
    easy: { name: '简单', aiEvery: 9, aiSize: 12, aiSmart: 0.3, boost: 0.85 },
    normal: { name: '标准', aiEvery: 6, aiSize: 18, aiSmart: 0.6, boost: 1.0 },
    hard: { name: '困难', aiEvery: 4, aiSize: 25, aiSmart: 0.9, boost: 1.15 },
  };

  const BASE = {
    N: 2000, tolType: 'low', netType: 'random', netDeg: 8,
    P: 1.15, Pbar: 0.5, K0: 25, M: 120, alpha: 0.25, beta: 0.5, delta: 0.2,
    gamma: 2, memDecay: 0.25, vis: 0.7, omega: 0.9, globalScale: 0.5, noise: 0.01,
    hardCore: 0.002, targetMode: 'uniform', releaseProb: 0.08, seed: 42, d0: 0, psiScale: 1,
  };

  class Game {
    constructor(side, diffKey) {
      this.side = side;                 // 'court' | 'movement'
      this.diff = DIFF[diffKey] || DIFF.normal;
      this.sim = new Sim(Object.assign({}, BASE, {
        P: BASE.P * (side === 'movement' ? this.diff.boost : 1),
        K0: Math.round(BASE.K0 * (side === 'movement' ? this.diff.boost : 1)),
        seed: (Math.random() * 999 | 0) + 1,
      }));
      this.maxRound = 60;
      this.ap = 2; this.apCap = 4;
      this.cool = {};                    // cardId -> rounds left
      this.flags = { preventive: 0, blackout: 0, memorial: 0 };
      this.seedNext = 0; this.seedMode = 'random';
      this.aiClock = 0;
      this.streak = { x: 0, d: 0 };
      this.over = null;                  // {win, title, detail}
      this.news = [];
      this.prev = { x: 0, d: 0, R: 0, xc: null };
      this._log('对局开始:你扮演' + (side === 'court' ? '🏛 朝廷' : '📣 行动方') + ',难度' + this.diff.name + '。' + (side === 'court' ? '维持沉默 60 轮,别让参与或兵变持续爆表。' : '60 轮内让参与 x≥0.6 或兵变 d≥0.7 持续 3 轮。'));
    }

    _log(msg) { this.news.unshift(`【第${this.sim.t}轮】${msg}`); if (this.news.length > 40) this.news.pop(); }

    hand() { return CARDS[this.side]; }

    canPlay(card) { return !this.over && this.ap >= card.cost && !(this.cool[card.id] > 0); }

    play(cardId) {
      const card = this.hand().find(c => c.id === cardId);
      if (!card || !this.canPlay(card)) return false;
      this.ap -= card.cost;
      this.cool[card.id] = card.cd;
      card.run(this.sim, this);
      this._log(`你打出「${card.name}」(${card.desc})。`);
      return true;
    }

    aiAct() {
      const s = this.sim, D = this.diff;
      if (this.side === 'movement') {
        // AI 朝廷: 对 x 与 d 反应
        if (s.meanU8(s.a) > 0.1 && Math.random() < D.aiSmart) { s.o.P = Math.min(2.2, s.o.P * 1.03); }
        if (s.meanU8(s.a) > 0.28 && Math.random() < D.aiSmart) { s.o.K0 = Math.min(400, Math.ceil(s.o.K0 * 1.06)); }
        if (s.meanU8(s.a) > 0.42 && this.flags.preventive <= 0 && Math.random() < D.aiSmart) {
          this.flags.preventive = 3; this._log('朝廷开始按名单预防性拘捕!');
        }
        if (s.meanU8(s.z) > 0.3 && Math.random() < D.aiSmart * 0.5) { s.o.psiScale += 0.1; }
      } else {
        // AI 行动方: 周期性小动作 + 偶尔串联
        this.aiClock++;
        if (this.aiClock % D.aiEvery === 0) {
          this.seedNext += D.aiSize + (Math.random() * D.aiSize | 0);
          this._log('城中出现了小规模的异动。');
        }
        if (this.aiClock % 17 === 0 && s.net) {
          const N = s.o.N; for (let t = 0; t < 200; t++) { const a = (s.rng() * N) | 0, b = (s.rng() * N) | 0; if (a !== b) { s.net[a].push(b); s.net[b].push(a); } }
          this._log('有人在暗中串联织网……');
        }
      }
    }

    step() {
      if (this.over) return this.over;
      const s = this.sim;
      // 持续效果结算
      s.o.targetMode = this.flags.preventive > 0 ? 'preventive' : 'uniform';
      if (this.flags.blackout > 0) { s.pushEvent({ rounds: 1, globalScale: 0.2 }); this.flags.blackout--; }
      if (this.flags.memorial > 0) { s.pushEvent({ rounds: 1, vis: Math.min(1, s.o.vis * 2) }); this.flags.memorial--; }
      if (this.flags.preventive > 0) this.flags.preventive--;
      this.aiAct();
      const seeds = this.seedNext, mode = this.seedMode;
      this.seedNext = 0; this.seedMode = 'random';
      s.step(seeds, mode);
      // 回费与冷却
      this.ap = Math.min(this.apCap, this.ap + 1);
      for (const k in this.cool) if (this.cool[k] > 0) this.cool[k]--;
      this._news();
      this._check();
      return this.over;
    }

    _news() {
      const s = this.sim, h = s.hist, last = a => a[a.length - 1];
      const x = last(h.x), d = last(h.d), p = last(h.p), R = last(h.R);
      if (p > 0 && this.prev.R === 0) this._log('首次有人被拘押。道路开始以目。');
      const ana = s.analysis();
      const xc = ana.xCrit;
      if (xc != null && this.prev.xc != null && xc < this.prev.xc * 0.85) this._log(`临界种子缩小到 ${Math.round(xc * s.o.N)} 人——同样的小动作,离大事更近。`);
      this.prev.xc = xc;
      if (x > 0.3 && this.prev.x <= 0.3) this._log('参与突破 30%:火势起来了。');
      if (x > 0.6 && this.prev.x <= 0.6) this._log('参与突破 60%:局面已定。');
      if (d > 0.3 && this.prev.d <= 0.3) this._log('执行系统出现裂痕:有人拒绝服从。');
      if (d > 0.6 && this.prev.d <= 0.6) this._log('近半执行者倒戈!');
      const mu = s.backfireMu().mu;
      if (mu > 1 && Math.random() < 0.4) this._log('镇压正在制造新的参与者(μ>1)。');
      if (x < 0.005 && d < 0.05 && Math.random() < 0.15) this._log('街上很安静。有人满意,有人疲惫,有人在等别人。');
      this.prev.x = x; this.prev.d = d; this.prev.R = R;
    }

    _check() {
      const s = this.sim, h = s.hist, last = a => a[a.length - 1];
      const x = last(h.x), d = last(h.d);
      this.streak.x = x >= 0.6 ? this.streak.x + 1 : 0;
      this.streak.d = d >= 0.7 ? this.streak.d + 1 : 0;
      const collapse = this.streak.x >= 3 || this.streak.d >= 3;
      if (collapse) {
        this.over = this.side === 'movement'
          ? { win: true, title: '大局已定', detail: this.streak.x >= 3 ? '大规模参与持续 3 轮——道路不再以目。' : '执行系统崩溃——没有人再执行命令。' }
          : { win: false, title: '三年,乃流王于彘', detail: this.streak.x >= 3 ? '公开参与持续爆表:沉默再也压不住。' : '执行系统持续倒戈:利器不再属于你。' };
      } else if (s.t >= this.maxRound) {
        this.over = this.side === 'court'
          ? { win: true, title: '在位六十年', detail: '60 轮内没有让局面失控。你看见的是你想看见的:一条安静的道路。' }
          : { win: false, title: '一代人过去了', detail: '60 轮没能掀起持续的大浪。同样的沉默,可以由完全不同的门槛与债务构成。' };
      }
      if (this.over) {
        const peakX = Math.max(...h.x), peakD = Math.max(...h.d);
        this.over.stats = `峰值参与 ${(peakX * 100).toFixed(0)}% · 峰值拒执行 ${(peakD * 100).toFixed(0)}% · 累计拘押 ${(last(h.R) * 100).toFixed(0)}%`;
        this._log(this.over.win ? '🏆 ' + this.over.title : '💥 ' + this.over.title);
      }
    }
  }

  global.SilenceGame = { Game, CARDS, DIFF, BASE };
})(typeof window !== 'undefined' ? window : globalThis);
