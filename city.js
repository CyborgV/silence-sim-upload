/* 道路以目 · 城市视图
 * 每个点是一群人。灰点 = 待在家里沉默; 亮点 = 走上广场; 红点 = 被带走。
 * 方块是执行者: 蓝 = 仍在执行命令, 绿 = 拒绝执行。
 */
(function (global) {
  'use strict';
  const { mulberry32 } = global.SilenceSim;

  const THEMES = {
    default: { bg: '#0b0f15', block: 'rgba(120,140,165,0.045)', street: 'rgba(255,255,255,0.025)', plaza: 'rgba(240,180,76,0.05)', plazaLine: 'rgba(240,180,76,0.28)',
      home: 'rgba(150,165,185,0.34)', crowd: '#ffcf70', crowdGlow: 'rgba(255,190,80,0.16)', jail: '#e5534b', loyal: '#6f9cf5', defect: '#57c28a', label: 'rgba(200,210,225,0.45)' },
    assembly: { bg: '#10140e', block: 'rgba(170,200,150,0.035)', street: 'rgba(255,255,255,0.02)', plaza: 'rgba(240,180,76,0.05)', plazaLine: 'rgba(240,180,76,0.25)',
      home: 'rgba(185,200,215,0.55)', crowd: '#ffcf70', crowdGlow: 'rgba(255,190,80,0.18)', jail: '#e5534b', loyal: '#6f9cf5', defect: '#57c28a', label: 'rgba(210,220,200,0.5)' },
    night: { bg: '#040507', block: 'rgba(90,100,120,0.03)', street: 'rgba(255,255,255,0.012)', plaza: 'rgba(200,60,60,0.03)', plazaLine: 'rgba(200,80,80,0.18)',
      home: 'rgba(90,100,120,0.10)', crowd: '#ffcf70', crowdGlow: 'rgba(255,190,80,0.16)', jail: '#c0413a', loyal: '#50609a', defect: '#57c28a', label: 'rgba(160,170,190,0.30)' },
  };

  class City {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.g = null;
      this.fx = [];      // 闪光、文字气泡
      this.shakeT = 0;
      this.t = 0;
    }

    setGame(g) {
      this.g = g;
      this.layout = g.L.layout || 'city';
      this.theme = THEMES[g.L.theme] || (this.layout === 'assembly' ? THEMES.assembly : THEMES.default);
      this.labels = Object.assign({ plaza: '广场', prison: '看守所', barracks: '兵营', avenue: '大街' }, g.L.labels || {});
      this.fx = [];
      this.font = getComputedStyle(document.body).fontFamily;
      this._init();
      this.resize();
    }

    /* 区域 (归一化坐标 0..1) */
    _regions() {
      if (this.layout === 'assembly') return {
        barracks: { x0: 0.34, y0: 0.03, x1: 0.66, y1: 0.12 },     // 主席台
        plaza: { x0: 0.2, y0: 0.16, x1: 0.8, y1: 0.27 },          // 主席台前
        prison: { x0: 0.015, y0: 0.03, x1: 0.16, y1: 0.19 },      // 教导处
        avenue: { y0: 0.285, y1: 0.3 },
        field: { x0: 0.05, y0: 0.33, x1: 0.95, y1: 0.97 },
      };
      return {
        plaza: { x0: 0.36, y0: 0.33, x1: 0.64, y1: 0.63 },
        avenue: { y0: 0.455, y1: 0.505 },
        prison: { x0: 0.80, y0: 0.76, x1: 0.97, y1: 0.95 },
        barracks: { x0: 0.03, y0: 0.05, x1: 0.19, y1: 0.22 },
      };
    }

    _init() {
      if (this.layout === 'assembly') return this._initAssembly();
      const g = this.g, N = g.N, rng = mulberry32((g.sim.o.seed || 1) * 7 + 3);
      const R = this.R = this._regions();
      // 街区网格
      const COLS = 14, ROWS = 10, blocks = [];
      const overlap = (bx0, by0, bx1, by1, r) => !(bx1 < r.x0 || bx0 > r.x1 || by1 < r.y0 || by0 > r.y1);
      for (let cx = 0; cx < COLS; cx++) for (let cy = 0; cy < ROWS; cy++) {
        const x0 = 0.02 + cx * (0.96 / COLS), y0 = 0.03 + cy * (0.94 / ROWS);
        const x1 = x0 + 0.96 / COLS - 0.012, y1 = y0 + 0.94 / ROWS - 0.018;
        const pl = { x0: R.plaza.x0 - 0.03, y0: R.plaza.y0 - 0.04, x1: R.plaza.x1 + 0.03, y1: R.plaza.y1 + 0.04 };
        if (overlap(x0, y0, x1, y1, pl) || overlap(x0, y0, x1, y1, R.prison) || overlap(x0, y0, x1, y1, R.barracks)) continue;
        if (!(y1 < R.avenue.y0 - 0.005 || y0 > R.avenue.y1 + 0.005)) continue;
        blocks.push({ x0, y0, x1, y1 });
      }
      this.blocks = blocks;
      const hx = this.hx = new Float32Array(N), hy = this.hy = new Float32Array(N);
      const qx = this.qx = new Float32Array(N), qy = this.qy = new Float32Array(N);   // 广场位置
      const jx = this.jx = new Float32Array(N), jy = this.jy = new Float32Array(N);   // 看守所位置
      for (let i = 0; i < N; i++) {
        const b = blocks[(rng() * blocks.length) | 0];
        hx[i] = b.x0 + 0.004 + rng() * (b.x1 - b.x0 - 0.008);
        hy[i] = b.y0 + 0.004 + rng() * (b.y1 - b.y0 - 0.008);
        if (rng() < 0.78) {
          // 广场里越靠中心越密
          const u = rng(), v = rng(), w = (rng() + rng()) / 2;
          qx[i] = R.plaza.x0 + 0.01 + (u * 0.5 + w * 0.5) * (R.plaza.x1 - R.plaza.x0 - 0.02);
          qy[i] = R.plaza.y0 + 0.012 + v * (R.plaza.y1 - R.plaza.y0 - 0.024);
        } else {
          const side = rng() < 0.5;
          qx[i] = side ? 0.03 + rng() * (R.plaza.x0 - 0.05) : R.plaza.x1 + 0.02 + rng() * (0.97 - R.plaza.x1 - 0.02);
          qy[i] = R.avenue.y0 + rng() * (R.avenue.y1 - R.avenue.y0);
        }
        jx[i] = R.prison.x0 + 0.008 + rng() * (R.prison.x1 - R.prison.x0 - 0.016);
        jy[i] = R.prison.y0 + 0.02 + rng() * (R.prison.y1 - R.prison.y0 - 0.03);
      }
      this.px = Float32Array.from(hx); this.py = Float32Array.from(hy);
      // 执行者
      const M = Math.min(g.sim.o.M, 140);
      this.M = M;
      this.ex = new Float32Array(M); this.ey = new Float32Array(M);
      this.bx = new Float32Array(M); this.by = new Float32Array(M);   // 兵营
      this.cx = new Float32Array(M); this.cy = new Float32Array(M);   // 警戒线
      this.dx = new Float32Array(M); this.dy = new Float32Array(M);   // 倒戈后
      const P = R.plaza, per = 2 * ((P.x1 - P.x0) + (P.y1 - P.y0));
      for (let j = 0; j < M; j++) {
        this.bx[j] = R.barracks.x0 + 0.01 + rng() * (R.barracks.x1 - R.barracks.x0 - 0.02);
        this.by[j] = R.barracks.y0 + 0.03 + rng() * (R.barracks.y1 - R.barracks.y0 - 0.04);
        let s = (j / M) * per, x, y; const pad = 0.018;
        if (s < P.x1 - P.x0) { x = P.x0 + s; y = P.y0 - pad; }
        else if ((s -= P.x1 - P.x0) < P.y1 - P.y0) { x = P.x1 + pad; y = P.y0 + s; }
        else if ((s -= P.y1 - P.y0) < P.x1 - P.x0) { x = P.x1 - s; y = P.y1 + pad; }
        else { s -= P.x1 - P.x0; x = P.x0 - pad; y = P.y1 - s; }
        this.cx[j] = x; this.cy[j] = y;
        this.dx[j] = P.x0 + 0.02 + rng() * (P.x1 - P.x0 - 0.04);
        this.dy[j] = P.y0 + 0.02 + rng() * (P.y1 - P.y0 - 0.04);
        this.ex[j] = this.bx[j]; this.ey[j] = this.by[j];
      }
      this.jailAge = new Float32Array(N);
    }

    /* 升旗仪式: 二十个班按队列站好; 站出来 = 走出队列到主席台前; 被抓 = 点名去教导处 */
    _initAssembly() {
      const g = this.g, N = g.N, rng = mulberry32((g.sim.o.seed || 1) * 7 + 3);
      const R = this.R = this._regions();
      const CLASSES = 20, COLS = 10, per = Math.ceil(N / CLASSES), cw = 5, ch = Math.ceil(per / cw);
      const F = R.field, bw = (F.x1 - F.x0) / COLS, bh = (F.y1 - F.y0) / 2;
      this.blocks = [];
      const hx = this.hx = new Float32Array(N), hy = this.hy = new Float32Array(N);
      const qx = this.qx = new Float32Array(N), qy = this.qy = new Float32Array(N);
      const jx = this.jx = new Float32Array(N), jy = this.jy = new Float32Array(N);
      for (let c = 0; c < CLASSES; c++) {
        const col = c % COLS, row = Math.floor(c / COLS);
        this.blocks.push({ x0: F.x0 + col * bw + bw * 0.12, y0: F.y0 + row * bh + bh * 0.04, x1: F.x0 + (col + 1) * bw - bw * 0.12, y1: F.y0 + (row + 1) * bh - bh * 0.06, name: `${row ? '初二' : '初一'}(${col + 1})` });
      }
      for (let i = 0; i < N; i++) {
        const c = Math.min(CLASSES - 1, Math.floor(i / per)), k = i - c * per, b = this.blocks[c];
        hx[i] = b.x0 + ((k % cw) + 0.5) * (b.x1 - b.x0) / cw;
        hy[i] = b.y0 + (Math.floor(k / cw) + 0.5) * (b.y1 - b.y0) / ch;
        // 站出来: 走到主席台前, 大致对着自己班的位置
        const P = R.plaza;
        qx[i] = Math.min(P.x1 - 0.005, Math.max(P.x0 + 0.005, P.x0 + (hx[i] - F.x0) / (F.x1 - F.x0) * (P.x1 - P.x0) + (rng() - 0.5) * 0.03));
        qy[i] = P.y0 + 0.01 + rng() * (P.y1 - P.y0 - 0.02);
        jx[i] = R.prison.x0 + 0.01 + rng() * (R.prison.x1 - R.prison.x0 - 0.02);
        jy[i] = R.prison.y0 + 0.035 + rng() * (R.prison.y1 - R.prison.y0 - 0.045);
      }
      this.px = Float32Array.from(hx); this.py = Float32Array.from(hy);
      // 老师: 一半在台上, 一半在班级之间的过道里来回
      const M = Math.min(g.sim.o.M, 40);
      this.M = M;
      this.ex = new Float32Array(M); this.ey = new Float32Array(M);
      this.bx = new Float32Array(M); this.by = new Float32Array(M);
      this.cx = new Float32Array(M); this.cy = new Float32Array(M);
      this.dx = new Float32Array(M); this.dy = new Float32Array(M);
      for (let j = 0; j < M; j++) {
        const B = R.barracks;
        this.bx[j] = B.x0 + 0.02 + (j / M) * (B.x1 - B.x0 - 0.04); this.by[j] = B.y0 + 0.055;
        if (j % 2) { this.cx[j] = this.bx[j]; this.cy[j] = this.by[j]; }
        else { const aisle = 1 + ((j / 2) % (COLS - 1)); this.cx[j] = F.x0 + aisle * bw; this.cy[j] = F.y0 + 0.05 + rng() * (F.y1 - F.y0 - 0.1); }
        this.dx[j] = this.qx[(j * 37) % N]; this.dy[j] = this.qy[(j * 37) % N] + 0.02;
        this.ex[j] = this.cx[j]; this.ey[j] = this.cy[j];
      }
      this.jailAge = new Float32Array(N);
    }

    /** 某个区域里的一个随机点(归一化坐标), 用于摆放气泡 */
    spot(where) {
      const R = this.R, rng = Math.random;
      const box = where === 'prison' ? R.prison : where === 'barracks' ? R.barracks : where === 'home' ? (this.blocks[(rng() * this.blocks.length) | 0]) : R.plaza;
      return { x: box.x0 + (0.2 + 0.6 * rng()) * (box.x1 - box.x0), y: box.y0 + (0.2 + 0.6 * rng()) * (box.y1 - box.y0) };
    }

    resize() {
      const dpr = Math.min(2, global.devicePixelRatio || 1);
      const w = this.cv.clientWidth || 600, h = this.cv.clientHeight || 400;
      this.W = w; this.H = h; this.dpr = dpr;
      this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.dot = Math.max(1.6, Math.min(3.2, Math.sqrt((w * h) / (this.g ? this.g.N : 1500)) * 0.2));
    }

    _drawAssembly(ctx, X, Y, W, H, T) {
      const R = this.R;
      // 跑道
      ctx.strokeStyle = 'rgba(200,120,90,0.10)'; ctx.lineWidth = Math.max(6, W / 90);
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(X(0.025), Y(0.31), X(0.95), Y(0.675), Math.min(W, H) * 0.12) : ctx.rect(X(0.025), Y(0.31), X(0.95), Y(0.675)); ctx.stroke();
      // 班级队列
      ctx.fillStyle = T.block; ctx.font = `${Math.max(9, Math.min(11, W / 90))}px ${this.font}`; ctx.textAlign = 'center';
      for (const b of this.blocks) {
        ctx.fillStyle = T.block; ctx.fillRect(X(b.x0) - 3, Y(b.y0) - 3, X(b.x1 - b.x0) + 6, Y(b.y1 - b.y0) + 6);
        ctx.fillStyle = 'rgba(210,220,200,0.28)'; ctx.fillText(b.name, X((b.x0 + b.x1) / 2), Y(b.y1) + 12);
      }
      // 主席台前
      ctx.fillStyle = T.plaza; ctx.fillRect(X(R.plaza.x0), Y(R.plaza.y0), X(R.plaza.x1 - R.plaza.x0), Y(R.plaza.y1 - R.plaza.y0));
      ctx.strokeStyle = T.plazaLine; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.strokeRect(X(R.plaza.x0) + 0.5, Y(R.plaza.y0) + 0.5, X(R.plaza.x1 - R.plaza.x0), Y(R.plaza.y1 - R.plaza.y0)); ctx.setLineDash([]);
      // 主席台 + 旗杆
      const B = R.barracks;
      ctx.fillStyle = 'rgba(160,110,80,0.28)'; ctx.fillRect(X(B.x0), Y(B.y0), X(B.x1 - B.x0), Y(B.y1 - B.y0));
      ctx.strokeStyle = 'rgba(220,170,120,0.4)'; ctx.strokeRect(X(B.x0) + 0.5, Y(B.y0) + 0.5, X(B.x1 - B.x0), Y(B.y1 - B.y0));
      const fx = X(B.x1) + 18, fy0 = Y(0.005) + 2, fy1 = Y(B.y1);
      ctx.strokeStyle = 'rgba(220,220,220,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(fx, fy1); ctx.lineTo(fx, fy0); ctx.stroke();
      const wave = Math.sin(this.t / 400) * 2;
      ctx.fillStyle = '#d33a2c'; ctx.beginPath(); ctx.moveTo(fx, fy0); ctx.lineTo(fx + 20, fy0 + 3 + wave); ctx.lineTo(fx + 20, fy0 + 14 + wave); ctx.lineTo(fx, fy0 + 12); ctx.closePath(); ctx.fill();
      // 教导处
      ctx.fillStyle = 'rgba(229,83,75,0.06)'; ctx.strokeStyle = 'rgba(229,83,75,0.3)';
      ctx.fillRect(X(R.prison.x0), Y(R.prison.y0), X(R.prison.x1 - R.prison.x0), Y(R.prison.y1 - R.prison.y0));
      ctx.strokeRect(X(R.prison.x0) + 0.5, Y(R.prison.y0) + 0.5, X(R.prison.x1 - R.prison.x0), Y(R.prison.y1 - R.prison.y0));
      ctx.fillStyle = T.label; ctx.font = `${Math.max(11, Math.min(14, W / 60))}px ${this.font}`;
      ctx.fillText(this.labels.barracks, X((B.x0 + B.x1) / 2), Y(B.y0) + 16);
      ctx.fillText(this.labels.plaza, X((R.plaza.x0 + R.plaza.x1) / 2), Y(R.plaza.y1) - 6);
      ctx.fillText(this.labels.prison, X((R.prison.x0 + R.prison.x1) / 2), Y(R.prison.y0) + 15);
      ctx.textAlign = 'left';
    }

    flash(color, ms) { this.fx.push({ type: 'flash', color, life: ms || 700, t: 0 }); }
    shake() { this.shakeT = 450; }
    say(text, color) {
      if (!text) return;
      if (this.fx.filter((f) => f.type === 'say').length >= 3) return;   // 同时最多三条口号
      const R = this.R, rng = Math.random;
      this.fx.push({ type: 'say', text, color: color || '#ffe2a8', x: R.plaza.x0 + 0.03 + rng() * (R.plaza.x1 - R.plaza.x0 - 0.06), y: R.plaza.y0 + 0.05 + rng() * (R.plaza.y1 - R.plaza.y0 - 0.1), life: 2600, t: 0 });
    }

    frame(dtMs) {
      const g = this.g; if (!g) return;
      this.t += dtMs;
      const ctx = this.ctx, W = this.W, H = this.H, T = this.theme, s = g.sim, N = g.N;
      const k = 1 - Math.exp(-dtMs / 260);
      const X = (v) => v * W, Y = (v) => v * H;
      // 背景
      ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
      ctx.save();
      if (this.shakeT > 0) { this.shakeT -= dtMs; const a = this.shakeT / 450 * 5; ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a); }
      const R = this.R;
      const x = g.x;
      if (this.layout === 'assembly') this._drawAssembly(ctx, X, Y, W, H, T);
      else {
      // 街区
      ctx.fillStyle = T.block;
      for (const b of this.blocks) ctx.fillRect(X(b.x0), Y(b.y0), X(b.x1 - b.x0), Y(b.y1 - b.y0));
      // 大道
      ctx.fillStyle = T.street; ctx.fillRect(0, Y(R.avenue.y0), W, Y(R.avenue.y1 - R.avenue.y0));
      // 广场
      ctx.fillStyle = T.plaza; ctx.strokeStyle = T.plazaLine; ctx.lineWidth = 1;
      ctx.fillRect(X(R.plaza.x0), Y(R.plaza.y0), X(R.plaza.x1 - R.plaza.x0), Y(R.plaza.y1 - R.plaza.y0));
      ctx.setLineDash([4, 4]); ctx.strokeRect(X(R.plaza.x0) + 0.5, Y(R.plaza.y0) + 0.5, X(R.plaza.x1 - R.plaza.x0), Y(R.plaza.y1 - R.plaza.y0)); ctx.setLineDash([]);
      if (x > 0.02) {   // 人多时广场发暖光
        const gr = ctx.createRadialGradient(X(0.5), Y(0.48), 10, X(0.5), Y(0.48), Math.max(W, H) * 0.35);
        gr.addColorStop(0, `rgba(255,180,70,${Math.min(0.22, x * 0.4)})`); gr.addColorStop(1, 'rgba(255,180,70,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      }
      // 看守所 / 兵营
      ctx.fillStyle = 'rgba(229,83,75,0.05)'; ctx.strokeStyle = 'rgba(229,83,75,0.25)';
      ctx.fillRect(X(R.prison.x0), Y(R.prison.y0), X(R.prison.x1 - R.prison.x0), Y(R.prison.y1 - R.prison.y0));
      ctx.strokeRect(X(R.prison.x0) + 0.5, Y(R.prison.y0) + 0.5, X(R.prison.x1 - R.prison.x0), Y(R.prison.y1 - R.prison.y0));
      ctx.fillStyle = 'rgba(111,156,245,0.05)'; ctx.strokeStyle = 'rgba(111,156,245,0.22)';
      ctx.fillRect(X(R.barracks.x0), Y(R.barracks.y0), X(R.barracks.x1 - R.barracks.x0), Y(R.barracks.y1 - R.barracks.y0));
      ctx.strokeRect(X(R.barracks.x0) + 0.5, Y(R.barracks.y0) + 0.5, X(R.barracks.x1 - R.barracks.x0), Y(R.barracks.y1 - R.barracks.y0));
      // 标签
      ctx.fillStyle = T.label; ctx.font = `${Math.max(11, Math.min(14, W / 60))}px ${this.font}`;
      ctx.textAlign = 'center';
      ctx.fillText(this.labels.plaza, X((R.plaza.x0 + R.plaza.x1) / 2), Y(R.plaza.y0) - 8);
      ctx.fillText(this.labels.prison, X((R.prison.x0 + R.prison.x1) / 2), Y(R.prison.y0) + 14);
      ctx.fillText(this.labels.barracks, X((R.barracks.x0 + R.barracks.x1) / 2), Y(R.barracks.y0) + 14);
      ctx.textAlign = 'left';
      ctx.fillText(this.labels.avenue, 8, Y(R.avenue.y0) - 4);
      }

      // 揭示层: 线人/串联让你暂时看见"心里的东西"
      const reveal = g.revealUntil >= g.round;
      const d = this.dot;
      // 民众
      const a = s.a, r = s.r, px = this.px, py = this.py;
      const glow = g.glow;
      const night = g.L.theme === 'night';
      for (let i = 0; i < N; i++) {
        let tx, ty;
        if (r[i]) { tx = this.jx[i]; ty = this.jy[i]; this.jailAge[i] += dtMs; }
        else { this.jailAge[i] = 0; if (a[i]) { tx = this.qx[i]; ty = this.qy[i]; } else { tx = this.hx[i]; ty = this.hy[i]; } }
        px[i] += (tx - px[i]) * k; py[i] += (ty - py[i]) * k;
      }
      // 家里的人; 暗流图层打开时, "在观望"(橙)与"蠢蠢欲动"(红)的人家被标出来——点的疏密就是离爆发还有多远
      const uc = this.layerOn && g.undercurrent ? g.undercurrent().tier : null;
      ctx.fillStyle = T.home;
      for (let i = 0; i < N; i++) if (!a[i] && !r[i] && !(uc && uc[i])) ctx.fillRect(X(px[i]) - d / 2, Y(py[i]) - d / 2, d, d);
      if (uc) {
        ctx.fillStyle = night ? 'rgba(240,170,70,0.5)' : 'rgba(240,180,76,0.62)';
        for (let i = 0; i < N; i++) if (uc[i] === 1 && !a[i] && !r[i]) ctx.fillRect(X(px[i]) - d / 2, Y(py[i]) - d / 2, d, d);
        ctx.fillStyle = night ? 'rgba(255,100,70,0.8)' : 'rgba(255,96,70,0.95)';
        const d2 = d * 1.35;
        for (let i = 0; i < N; i++) if (uc[i] === 2 && !a[i] && !r[i]) ctx.fillRect(X(px[i]) - d2 / 2, Y(py[i]) - d2 / 2, d2, d2);
      }
      if (night) {        // 夜里: 看过外面世界的人家亮着一盏小灯
        ctx.fillStyle = 'rgba(255,214,140,0.55)';
        for (let i = 0; i < N; i++) if (glow[i] && !r[i]) ctx.fillRect(X(px[i]) - d / 2, Y(py[i]) - d / 2, d, d);
      }
      if (reveal) {
        const ms = g.moodScale;
        for (let i = 0; i < N; i++) {
          if (a[i] || r[i]) continue;
          const v = Math.min(1, s.b[i] / (ms * 2.2));
          if (v < 0.08) continue;
          ctx.fillStyle = `rgba(255,${Math.round(120 - 80 * v)},${Math.round(90 - 60 * v)},${0.25 + 0.6 * v})`;
          ctx.fillRect(X(px[i]) - d, Y(py[i]) - d, d * 2, d * 2);
        }
      }
      // 广场上的人(带光晕)
      ctx.fillStyle = T.crowdGlow;
      const few = x < 0.02;
      for (let i = 0; i < N; i++) if (a[i]) { const gsz = few ? d * 5 : d * 2.4; ctx.fillRect(X(px[i]) - gsz / 2, Y(py[i]) - gsz / 2, gsz, gsz); }
      ctx.fillStyle = T.crowd;
      for (let i = 0; i < N; i++) if (a[i]) ctx.fillRect(X(px[i]) - d * 0.6, Y(py[i]) - d * 0.6, d * 1.2, d * 1.2);
      // 被带走的人
      for (let i = 0; i < N; i++) if (r[i]) {
        const fresh = this.jailAge[i] < 1200;
        ctx.fillStyle = fresh ? '#ff7b72' : T.jail;
        ctx.fillRect(X(px[i]) - d / 2, Y(py[i]) - d / 2, d, d);
      }
      // 执行者
      const M = this.M, z = s.z, Mt = s.z.length;
      const deployed = this.layout === 'assembly' || x > 0.003 || g.pol.police === 'martial' || g.pol.police === 'surge';
      for (let j = 0; j < M; j++) {
        const jj = Math.floor(j * Mt / M);
        let tx, ty;
        if (z[jj]) { tx = this.dx[j]; ty = this.dy[j]; }
        else if (deployed) { tx = this.cx[j]; ty = this.cy[j]; }
        else { tx = this.bx[j]; ty = this.by[j]; }
        this.ex[j] += (tx - this.ex[j]) * k * 0.8; this.ey[j] += (ty - this.ey[j]) * k * 0.8;
        ctx.fillStyle = z[jj] ? T.defect : T.loyal;
        const sz = d * 1.5;
        ctx.fillRect(X(this.ex[j]) - sz / 2, Y(this.ey[j]) - sz / 2, sz, sz);
      }
      // 特效
      for (let q = this.fx.length - 1; q >= 0; q--) {
        const f = this.fx[q]; f.t += dtMs;
        const life = f.t / f.life;
        if (life >= 1) { this.fx.splice(q, 1); continue; }
        if (f.type === 'say') {
          ctx.globalAlpha = life < 0.15 ? life / 0.15 : life > 0.75 ? (1 - life) / 0.25 : 1;
          ctx.font = `600 ${Math.max(12, Math.min(16, W / 50))}px ${this.font}`;
          ctx.textAlign = 'center';
          const tx = X(f.x), ty = Y(f.y) - life * 18;
          const w = ctx.measureText(f.text).width + 14;
          ctx.fillStyle = 'rgba(10,12,16,0.75)'; ctx.fillRect(tx - w / 2, ty - 15, w, 21);
          ctx.fillStyle = f.color; ctx.fillText(f.text, tx, ty);
          ctx.globalAlpha = 1; ctx.textAlign = 'left';
        }
      }
      ctx.restore();
      for (const f of this.fx) if (f.type === 'flash') {
        const life = f.t / f.life;
        ctx.globalAlpha = Math.max(0, 0.35 * (1 - life));
        ctx.fillStyle = f.color; ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    }
  }

  global.SilenceCity = City;
})(window);
