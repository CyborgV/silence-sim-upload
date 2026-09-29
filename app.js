/* 道路以目 · 界面控制器
 * 标题 → 关卡 → 简报 → 对局(城市 + 态势 + 政策/对策) → 事件弹窗 → 结算复盘
 * 对局中不显示任何模型参数; 真实数值只在复盘里揭晓。
 */
(function () {
  'use strict';
  const { Game, POLICIES, POLICY_KEYS, CARDS, STAGES, BUBBLES, fmtCount } = window.SilenceGame;
  const { LEVELS, SOCIETIES, makeSkirmish } = window.SilenceLevels;
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ================= 存档 ================= */
  const SAVE_KEY = 'silence.save.v2';
  let SAVE = { stars: {}, done: {}, coach: {}, diff: 'normal' };
  try { Object.assign(SAVE, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) { /* 无痕模式等 */ }
  const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { /* 忽略 */ } };

  /* ================= 屏幕 ================= */
  let current = 'title';
  function show(id) {
    current = id;
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + id));
    if (id === 'title') Title.start(); else Title.stop();
    if (id !== 'game') { running = false; Coach.end(); }
    if (id === 'levels') renderLevels();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));

  const sideLabel = (s) => (s === 'regime' ? '🏛 扮演当局' : '📣 扮演民间');
  const starsHtml = (n, max) => { let h = ''; for (let i = 0; i < max; i++) h += `<span class="${i < n ? 'on' : ''}">★</span>`; return h; };

  /* ================= 标题动画: 沉默的城市, 偶尔有人亮起 ================= */
  const Title = (() => {
    const cv = $('titleCanvas'), ctx = cv.getContext('2d');
    let pts = [], raf = 0, last = 0;
    function init() {
      const w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(w * h / 900);
      pts = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, l: 0, vx: (Math.random() - 0.5) * 0.04 }));
    }
    function frame(ts) {
      const dt = Math.min(60, ts - (last || ts)); last = ts;
      const w = cv.clientWidth, h = cv.clientHeight;
      ctx.clearRect(0, 0, w, h);
      if (Math.random() < 0.05) { const c = pts[(Math.random() * pts.length) | 0]; c.l = 1; }
      for (const p of pts) {
        p.x += p.vx * dt; if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.l > 0) p.l = Math.max(0, p.l - dt / 2600);
        ctx.fillStyle = p.l > 0 ? `rgba(255,200,110,${0.25 + 0.75 * p.l})` : 'rgba(140,155,175,0.16)';
        const s = p.l > 0 ? 2.6 : 1.6;
        ctx.fillRect(p.x, p.y, s, s);
      }
      raf = requestAnimationFrame(frame);
    }
    return {
      start() { cancelAnimationFrame(raf); init(); last = 0; raf = requestAnimationFrame(frame); },
      stop() { cancelAnimationFrame(raf); },
    };
  })();
  window.addEventListener('resize', () => { if (current === 'title') Title.start(); });

  /* ================= 关卡选择 ================= */
  function renderLevels() {
    const grid = $('levelGrid');
    grid.innerHTML = LEVELS.map((L) => `
      <button class="lv ${L.id === 'tutorial' ? 'tutorial' : ''} ${SAVE.done[L.id] ? 'done' : ''}" data-id="${L.id}">
        <div class="ico">${L.icon}</div>
        <div class="ch">${L.chapter} · ${L.era}</div>
        <div class="tt">${L.title}</div>
        <div class="era">${L.place}</div>
        <div class="bl">${L.blurb}</div>
        <div class="foot"><span class="side ${L.side}">${sideLabel(L.side)}</span>
          <span class="stars">${L.id === 'tutorial' ? '' : starsHtml(SAVE.stars[L.id] || 0, 3)}</span></div>
      </button>`).join('');
    grid.querySelectorAll('.lv').forEach((b) => b.addEventListener('click', () => openBrief(LEVELS.find((L) => L.id === b.dataset.id))));
    const tot = LEVELS.reduce((s, L) => s + (SAVE.stars[L.id] || 0), 0);
    $('lv-total').innerHTML = `★ ${tot} / ${(LEVELS.length - 1) * 3}`;
  }

  /* ================= 简报 ================= */
  function openBrief(L, skOpts) {
    const diff = SAVE.diff || 'normal';
    const starItems = [L.starText ? L.starText[0] : '达成目标'].concat((L.stars || []).map((s) => s.text));
    $('briefBody').innerHTML = `
      <div class="head"><div class="ico">${L.icon}</div><div>
        <div class="ch">${L.chapter} · ${L.era}</div><h2>${L.title}</h2><div class="era">${L.place}</div></div></div>
      <div class="role"><span class="side ${L.side}">${sideLabel(L.side)}</span> <span class="era">你是:${L.role}</span></div>
      ${(L.intro || []).map((p) => `<p>${p}</p>`).join('')}
      ${L.quote ? `<div class="quote">${L.quote}</div>` : ''}
      <div class="goalbox"><h4>目标</h4><div class="goal">${L.goalText}</div>
        ${L.id !== 'tutorial' ? `<h4 style="margin-top:12px">星级</h4><ul>${starItems.map((t) => `<li>★ ${t}</li>`).join('')}</ul>` : ''}</div>
      ${L.tips && L.tips.length ? `<div class="goalbox"><h4>提示</h4><ul>${L.tips.map((t) => `<li>${t}</li>`).join('')}</ul></div>` : ''}
      <div class="actions">
        <button class="btn primary" id="brief-start">开始 ▶</button>
        ${L.id === 'tutorial' ? '<button class="btn" id="brief-guide">💡 带引导开始</button>' : ''}
        ${L.id !== 'tutorial' ? `<span class="era">难度</span><div class="seg-sm" id="brief-diff">
          <button data-v="easy" class="${diff === 'easy' ? 'on' : ''}">简单</button>
          <button data-v="normal" class="${diff === 'normal' ? 'on' : ''}">标准</button>
          <button data-v="hard" class="${diff === 'hard' ? 'on' : ''}">困难</button></div>` : ''}
      </div>`;
    const seg = $('brief-diff');
    if (seg) seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      SAVE.diff = b.dataset.v; persist();
    }));
    $('brief-start').addEventListener('click', () => startLevel(L, Object.assign({ diff: SAVE.diff || 'normal' }, skOpts || {})));
    if ($('brief-guide')) $('brief-guide').addEventListener('click', () => startLevel(L, { diff: SAVE.diff || 'normal', guide: true }));
    show('brief');
  }

  /* ================= 自由对局设置 ================= */
  const SK = { side: 'movement', soc: 'ordinary', diff: 'normal' };
  function initSkirmish() {
    const socSeg = $('sk-soc');
    socSeg.innerHTML = Object.entries(SOCIETIES).map(([k, s]) => `<button data-v="${k}" class="${k === SK.soc ? 'on' : ''}">${s.name}</button>`).join('');
    const bind = (id, key, after) => $(id).querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      $(id).querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); SK[key] = b.dataset.v; if (after) after();
    }));
    const desc = () => { $('sk-soc-desc').textContent = SOCIETIES[SK.soc].desc; };
    bind('sk-side', 'side'); bind('sk-soc', 'soc', desc); bind('sk-diff', 'diff'); desc();
    $('sk-start').addEventListener('click', () => startLevel(makeSkirmish(SK.side, SK.soc), { diff: SK.diff }));
  }

  /* ================= 对局 ================= */
  let G = null, city = null, running = false, speed = 0, lastSpeed = 1, acc = 0, lastTs = 0, curLevel = null, curOpts = {};
  let lastAutoPause = -99, endShown = false, prevWords = {};
  const ROUND_MS = [Infinity, 1500, 750, 300];

  function startLevel(L, opts) {
    curLevel = L; curOpts = opts || {};
    G = new Game(L, { diff: curOpts.diff || 'normal' });
    endShown = false; prevWords = {}; lastAutoPause = -99;
    show('game');
    $('g-chapter').textContent = L.chapter + ' · ';
    $('g-title').textContent = L.title;
    $('cards-title').innerHTML = G.side === 'regime' ? '行动 <span class="tag">一次性 · 有冷却</span>' : '对策 <span class="tag">一次性 · 有冷却</span>';
    $('meters').classList.toggle('solo', !!L.noAI);
    Bub.clear(); $('headline').innerHTML = ''; $('banner').innerHTML = ''; $('ov-tree').classList.remove('show');
    if (!city) city = new window.SilenceCity($('city'));
    requestAnimationFrame(() => { city.setGame(G); city.resize(); });
    setSpeed(0);
    renderAll(true);
    running = true; lastTs = 0; acc = 0;
    requestAnimationFrame(loop);
    renderGuideBtn();
    // 开场: 引导只在玩家点了「引导」按钮时才出现; 否则直接进入开场事件
    setTimeout(() => {
      if (curOpts.guide) startGuide();
      if (G.popup && !Coach.active) showEvent();
    }, 350);
  }

  /* 新手引导: 点「💡 引导」才弹出 */
  function renderGuideBtn() {
    const b = $('g-guide'); if (!G) return;
    b.classList.toggle('fresh', !SAVE.coach['lv_' + G.L.id]);
    b.title = G.L.id === 'tutorial' ? '召公一步步带你玩(已经开始的话,会从头重来)' : '新手引导:召公讲解这一关的界面和要点';
  }
  function startGuide() {
    if (!G || G.over) return;
    if (Coach.active) { Coach.end(); return; }
    const L = G.L;
    SAVE.coach['lv_' + L.id] = 1;
    if (L.id === 'tutorial') {
      // 教程的每一步都假定从第一分钟开始; 已经玩过几步就从头来
      if (G.round > 0 || G.actions.length || Object.keys(G.bought || {}).length) { persist(); startLevel(curLevel, Object.assign({}, curOpts, { guide: true })); return; }
      persist(); renderGuideBtn();
      Coach.start(TUTORIAL, { lock: true });
      return;
    }
    const visible = (st) => { const el = st.target && document.querySelector(st.target); return !st.target || (el && el.getClientRects().length > 0); };
    const sys = (SYS[G.side] || []).filter(visible), lv = (COACH[L.id] || []).filter(visible);
    // 通用界面讲解只在第一次放在前面; 之后先讲本关要点
    const steps = SAVE.coach['sys_' + G.side] ? lv.concat(sys) : sys.concat(lv);
    SAVE.coach['sys_' + G.side] = 1;
    persist(); renderGuideBtn();
    if (steps.length) Coach.start(steps, { lock: false, after: () => { if (G && G.popup) showEvent(); } });
  }

  function setSpeed(s) {
    if (s > 0) lastSpeed = s;
    speed = s;
    document.querySelectorAll('.speed [data-sp]').forEach((b) => b.classList.toggle('on', +b.dataset.sp === s));
    $('pausetag').classList.toggle('hidden', s > 0 || !G || !!G.over);
    acc = 0;
  }
  document.querySelectorAll('.speed [data-sp]').forEach((b) => b.addEventListener('click', () => { setSpeed(+b.dataset.sp); Coach.notify('speed'); }));
  $('btn-step').addEventListener('click', () => { if (G && !G.popup && !G.over) { setSpeed(0); doStep(); } });

  function loop(ts) {
    if (!running) return;
    const dt = Math.min(80, ts - (lastTs || ts)); lastTs = ts;
    const live = G && speed > 0 && !G.popup && !G.over && !Coach.blocking() && !anyOverlay();
    if (live) {
      acc += dt;
      if (acc >= ROUND_MS[speed]) { acc = 0; doStep(); }
    }
    Bub.tick(dt, live);
    if (city && G) city.frame(dt);
    requestAnimationFrame(loop);
  }
  const anyOverlay = () => document.querySelector('.overlay.show') !== null;

  function doStep() {
    if (!G || G.over || G.popup) return;
    const x0 = G.x;
    G.step();
    const hadHeadline = G.fx.some((f) => f.type === 'headline');
    processFx();
    if (!hadHeadline) {
      const imp = G.news.find((n) => n.round === G.round && ['crowd', 'army', 'opp', 'arrest', 'event'].includes(n.kind));
      if (imp) headline(imp.text, imp.kind, true);
    }
    // 街头突然聚集大量人群 → 自动暂停, 给玩家反应时间
    if (G.side === 'regime' && G.x - x0 > 0.04 && G.round - lastAutoPause > 3 && speed > 0) autoPause('⚠ 街头突然聚集了大量人群!');
    renderAll();
    Coach.notify('round');
    if (G.popup) showEvent();
    if (G.over) setTimeout(showEnd, 1100);
  }
  function autoPause(msg) { lastAutoPause = G.round; setSpeed(0); toast(msg + '(已暂停)', 'crowd'); }

  /* ---------- 特效与新闻 ---------- */
  function processFx() {
    if (!G) return;
    const fx = G.fx.splice(0);
    const slogans = (G.L.slogans || []).filter(Boolean);
    for (const f of fx) {
      if (f.type === 'crackdown') { city.flash('#ff2a1a', 900); city.shake(); $('stage').classList.remove('shake'); void $('stage').offsetWidth; $('stage').classList.add('shake'); if (G.side === 'movement' && G.round - lastAutoPause > 2 && speed > 0) autoPause('💥 当局动手了'); }
      else if (f.type === 'raid') { city.flash('#ff4030', 500); }
      else if (f.type === 'defect') { city.flash('#57c28a', 500); }
      else if (f.type === 'reveal') { city.flash('#b392f0', 600); }
      else if (f.type === 'card' && f.side !== G.side) {
        const nm = G.card(f.id).name;
        toast(`${G.side === 'movement' ? '当局' : '对方'}:${CARDS[f.id].icon} ${nm}`, 'opp');
      }
      else if (f.type === 'news' && ['crowd', 'army'].includes(f.kind)) toast(f.text, f.kind === 'army' ? 'good' : 'crowd');
      else if (f.type === 'headline') headline(f.text, f.kind);
      else if (f.type === 'bubble') Bub.add(f.b);
      else if (f.type === 'seeds') city.say(`+约 ${fmtCount(f.n * G.scale)} 人`, '#9fe0b5');
      else if (f.type === 'ignite') { banner('连锁反应!', '越来越多的人加入了', 'ignite'); city.flash('#ffb347', 700); }
      else if (f.type === 'nearmiss') banner('差一点', '人群散去了——再多一些人,也许就不一样了', 'miss');
      else if (f.type === 'stage') {
        if (f.up) { banner(`当局:${STAGES[f.stage].name}`, STAGES[f.stage].tip, 'stage'); city.flash('#ff3b2f', 500); if (speed > 0 && G.round - lastAutoPause > 2) autoPause('当局升级了'); }
        else toast(`当局的戒备降到「${STAGES[f.stage].name}」`, 'good');
      }
      else if (f.type === 'push') { banner('反对派发动了!', '一次大规模行动——压不压得住,取决于你看不见的临界点', 'stage'); if (G.side === 'regime' && speed > 0) autoPause('反对派发动了大规模行动'); }
      else if (f.type === 'buy') toast(`建成:${f.name}`, 'crowd');
    }
    if (G.x > 0.004 && slogans.length && Math.random() < Math.min(0.9, 0.25 + G.x * 2)) city.say(slogans[(Math.random() * slogans.length) | 0]);
  }
  let hlT = 0, bnT = 0;
  function headline(text, kind, soft) {
    const el = $('headline');
    el.innerHTML = `<div class="hl ${kind || ''}"${soft ? ' style="opacity:.85"' : ''}><span class="d">${G.dateLabel()}</span>${text}</div>`;
    clearTimeout(hlT); hlT = setTimeout(() => { el.innerHTML = ''; }, 8000);
  }
  function banner(text, sub, cls) {
    $('banner').innerHTML = `<div class="bn ${cls || ''}">${text}${sub ? `<small>${sub}</small>` : ''}</div>`;
    clearTimeout(bnT); bnT = setTimeout(() => { $('banner').innerHTML = ''; }, 2700);
  }

  /* ---------- 气泡 ---------- */
  const Bub = (() => {
    const layer = $('bubbles'); let items = [];
    function add(b) {
      const p = city && city.spot ? city.spot(b.where) : { x: 0.5, y: 0.5 };
      const el = document.createElement('button');
      el.className = 'bubble ' + b.kind;
      el.style.left = (p.x * 100).toFixed(1) + '%'; el.style.top = (p.y * 100).toFixed(1) + '%';
      el.innerHTML = `${b.icon}<b>+${b.amt}</b>`;
      el.dataset.tip = `<b>${b.name}</b> · 点击收集 +${b.amt}<div class="tt-tags">${BUBBLES[b.kind].tip}</div>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); take(b.id, 1); });
      layer.appendChild(el);
      items.push({ id: b.id, el, life: 9000, auto: SAVE.autoCollect ? 1500 : null });
      if (Coach.active) Coach.remark();
    }
    function take(id, frac) {
      const it = items.find((q) => q.id === id); if (!it || !G) return;
      const v = G.collect(id, frac);
      const pl = document.createElement('div'); pl.className = 'plus'; pl.style.left = it.el.style.left; pl.style.top = it.el.style.top; pl.textContent = '+' + v;
      layer.appendChild(pl); setTimeout(() => pl.remove(), 1000);
      it.el.remove(); items = items.filter((q) => q !== it);
      renderRes(); renderTreeBtn(); renderCards(); renderMeters();
      Coach.notify('collect');
    }
    function tick(dt, live) {
      if (!live) return;
      for (const it of items.slice()) {
        if (it.auto != null) { it.auto -= dt; if (it.auto <= 0) { take(it.id, 0.5); continue; } }
        it.life -= dt;
        if (it.life < 2500) it.el.classList.add('dying');
        if (it.life <= 0) { if (G) G.expire(it.id); it.el.remove(); items = items.filter((q) => q !== it); }
      }
    }
    function clear() { items = []; layer.innerHTML = ''; }
    return { add, take, tick, clear };
  })();

  function toast(text, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = text;
    const box = $('toasts');
    box.prepend(el);
    while (box.children.length > 3) box.lastChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 600); }, 3200);
  }

  /* ---------- 渲染 ---------- */
  function renderAll(first) {
    if (!G) return;
    $('g-date').textContent = G.dateLabel();
    $('g-timefill').style.width = (100 * G.round / G.maxRound).toFixed(1) + '%';
    renderGoal(); renderMeters(); renderBuild(); renderReadouts(); renderEffects(); renderRes(); renderTreeBtn(); renderPolicies(); renderCards(); renderNews();
    $('pausetag').classList.toggle('hidden', speed > 0 || !!G.over);
  }

  function renderGoal() {
    const L = G.L, g = L.goal || {};
    let prog = 0, sub = '';
    const left = G.maxRound - G.round;
    if (G.side === 'regime') {
      prog = G.round / G.maxRound;
      sub = `还要撑 ${left} 轮`;
      if (G.streak.x > 0 || G.streak.d > 0) sub = `<span style="color:var(--red2)">⚠ 局面正在失控(${Math.max(G.streak.x, G.streak.d)}/${g.hold || 3})</span> · ` + sub;
    } else if (L.id === 'pyongyang') {
      const r = G.readout();
      prog = r.tip.kind === 'none' ? 0.03 : clamp((1 - r.tip.shownFrac) / (1 - 0.2), 0, 1);
      sub = `据估计 · 剩余 ${left} 个月`;
      if (G.streak.tip > 0) sub = `<span style="color:var(--green)">裂缝已经出现(${G.streak.tip}/3)</span> · ` + sub;
    } else {
      const px = g.x != null ? G.x / g.x : 0;
      const dShown = G.d + (G.side === 'movement' ? G.intelNoise.army : 0);
      const pd = g.d != null ? clamp(dShown, 0, 1) / g.d : 0;
      prog = clamp(Math.max(px, pd), 0, 1);
      sub = `剩余 ${left} 轮`;
      const st = Math.max(G.streak.x, G.streak.d);
      if (st > 0) sub = `<span style="color:var(--green)">已经坚持 ${st}/${g.hold || 3} 轮!</span> · ` + sub;
    }
    $('goal-text').innerHTML = '🎯 ' + L.goalText;
    $('goal-bar').style.width = (prog * 100).toFixed(1) + '%';
    $('goal-sub').innerHTML = sub;
  }

  const cur = () => (G.side === 'regime' ? '🏛' : '✊');
  function renderMeters() {
    const r = G.readout(), L = G.L, lab = L.labels || {};
    const pct = (v) => (clamp(v, 0, 1) * 100).toFixed(1) + '%';
    const cnt = (f) => fmtCount(Math.max(0, f * G.N * G.scale));
    let main = '', opp = '';
    if (G.side === 'movement') {
      const x = G.x, cap = Math.max(0, G.pushCapacity() - G.seedNext / G.N) + G.seedNext / G.N;
      const t = r.tip, sp = L.tipSpread != null ? L.tipSpread : 0.3;
      let lo = null, hi = null, tipTxt;
      if (t.kind === 'none') tipTxt = '看不到转机';
      else if (t.kind === 'tinder') { lo = hi = 0; tipTxt = '一点就着'; }
      else { lo = t.est * (1 - sp); hi = t.est * (1 + sp); tipTxt = `约 ${cnt(lo)}～${cnt(hi)} 人`; }
      let max = Math.max(0.04, (hi || 0) * 1.3, (x + cap) * 1.15, x * 1.1);
      if (lo == null) max = Math.max(max, 0.12);
      max = Math.min(1, max);
      const P = (v) => pct(v / max);
      const ready = lo != null && cap > 0 && L.id !== 'pyongyang' && x + cap >= lo;
      const band = lo != null ? `<div class="band" style="left:${P(lo)};width:${pct(Math.max(0.008, (hi - lo) / max))}"></div>` : '<div class="band" style="left:calc(100% - 10px);width:10px"></div>';
      const crowdTxt = x * G.N * G.scale < 1 ? '无人' : '约 ' + cnt(x) + ' 人';
      const armyGoal = L.goal && L.goal.d != null && L.goal.x == null;
      if (armyGoal) {
        const dS = clamp(G.d + G.intelNoise.army, 0, 1), gd = L.goal.d;
        main = `<div class="mh" data-tip="${esc('这一关要赢,靠的是执行者倒戈。街上的人越多、越和士兵说话,他们越动摇;当局换防会把军心重置。')}"><b>🪖 ${lab.army || '军警'}倒戈</b><span class="mv">${r.army.words}(传闻)· ${lab.crowd || '街上'} ${crowdTxt}</span></div>
          <div class="mbar"><div class="fill" style="width:${pct(dS / (gd * 1.25))}"></div><div class="band" style="left:${pct(gd / (gd * 1.25))};width:1%"></div></div>
          <div class="ms">${G.streak.d > 0 ? `<span class="go">已经坚持 ${G.streak.d}/${L.goal.dHold || L.goal.hold || 2} 轮!</span>` : `紫线是目标:成建制倒戈 · 街上的人越多,士兵越动摇`}</div>`;
      } else if (L.id === 'pyongyang') {
        main = `<div class="mh" data-tip="${esc('需要多少人同时站出来,局面才会改变。你的目标是让它从「看不到转机」降到约两成人。')}"><b>🔥 让临界点出现</b><span class="mv">需要 ${tipTxt} · 目标:降到约 ${cnt(0.2)} 以下</span></div>
          <div class="mbar"><div class="fill" style="width:${lo == null ? '2%' : pct(clamp((1 - t.est) / 0.8, 0, 1))}"></div></div>
          <div class="ms">${G.streak.tip > 0 ? `<span class="go">裂缝已经出现(${G.streak.tip}/3)</span>` : '别上街:在这里,公开行动只是送死'}</div>`;
      } else {
        main = `<div class="mh" data-tip="${esc('黄色:此刻站出来的人。斜纹:你手里的组织力一次还能带出的人。紫框:临界点——大约要这么多人同时站出来,风险才被摊薄、连锁才会开始(估计值)。')}"><b>🔥 离临界点</b><span class="mv">${lab.crowd || '街上'} ${crowdTxt} · 需要 ${tipTxt}</span></div>
          <div class="mbar"><div class="fill" style="width:${P(x)}"></div><div class="ghost" style="left:${P(x)};width:${P(cap)}"></div>${band}</div>
          <div class="ms">${ready ? '<span class="go">够了!现在全力行动,可能点燃连锁反应</span>' : cap > 0 ? `你的组织力一次还能带出约 ${cnt(cap)} 人` : '组织力不够发起行动——收集气泡,或等一等'}</div>`;
      }
      if (L.id === 'pyongyang') {
        const e = G.exposure;
        opp = `<div class="mh"><b>🕵️ 暴露风险</b><span class="mv">${e < 25 ? '低' : e < 50 ? '中' : e < 75 ? '高' : '危险'}</span></div>
          <div class="mbar danger"><div class="fill" style="width:${pct(e / 100)}"></div></div>
          <div class="ms">${e >= 60 ? '<span class="warn">109 常务组随时会上门</span>' : '到顶全盘皆输 ·「销毁痕迹」可以降低'}</div>`;
      } else if (!L.noAI) {
        const a = G.alert, s = G.stage(), nx = s < 3 ? STAGES[s + 1] : null;
        opp = `<div class="mh" data-tip="${esc('当局的警觉。街上的人、人数的突增、你的每个动作和建设都会推高它;安静时慢慢回落。到 25 / 50 / 75 当局会依次升级。')}"><b>🚨 当局警觉</b><span class="stage-pill st${s}">${STAGES[s].name}</span></div>
          <div class="mbar danger"><div class="fill" style="width:${pct(a / 100)}"></div><div class="tick" style="left:25%"></div><div class="tick" style="left:50%"></div><div class="tick" style="left:75%"></div></div>
          <div class="ms">${nx ? `到 ${(s + 1) * 25}:${nx.name}(${nx.tip})` : '<span class="warn">已是全面镇压</span>'}</div>`;
      }
    } else {
      const left = G.maxRound - G.round;
      main = `<div class="mh"><b>🏛 ${L.id === 'liwang' ? '王位' : '撑下去'}</b><span class="mv">还要 ${left} 轮 · 局面(据报):${r.tip.words}</span></div>
        <div class="mbar time"><div class="fill" style="width:${pct(G.round / G.maxRound)}"></div></div>
        <div class="ms">${G.streak.x > 0 || G.streak.d > 0 ? `<span class="warn">⚠ 局面正在失控(${Math.max(G.streak.x, G.streak.d)}/${(L.goal || {}).hold || 3})</span>` : '撑到最后就是胜利——星级看积怨与抓了多少人'}</div>`;
      const o = G.orgShown();
      opp = `<div class="mh" data-tip="${esc('反对派在暗中组织。积怨越深、街上越热闹,涨得越快;满了就会发动一次大规模行动。抓串联者、对话让步能压下去。注意:你越凶,这个数字报得越低。')}"><b>✊ 反对派组织度</b><span class="mv">据报 · ${o >= 75 ? '即将发动' : o >= 45 ? '正在串联' : '零散'}</span></div>
        <div class="mbar org"><div class="fill" style="width:${pct(o / 100)}"></div></div>
        <div class="ms">${o >= 75 ? '<span class="warn">随时可能发动大规模行动!</span>' : '满了就会发动一次大规模行动'}</div>`;
    }
    $('m-main').innerHTML = main; $('m-opp').innerHTML = opp;
  }
  function renderBuild() {
    const lv = G.buildLevels(), keys = Object.keys(lv);
    if (!keys.length) { $('build').innerHTML = ''; return; }
    $('build').innerHTML = `<div class="sec-t">${G.side === 'regime' ? '你的机器' : '你的组织'} <span class="tag">永久建设</span></div><div class="build ${G.side}">` + keys.map((k) => {
      const b = lv[k]; let pips = ''; for (let i = 0; i < b.max; i++) pips += `<i class="${i < b.n ? 'on' : ''}"></i>`;
      return `<div class="brow ${G.side}"><span>${b.icon}</span><span class="bn">${b.name}</span><span class="pipsx">${pips}</span></div>`;
    }).join('') + '</div>';
  }
  function renderTreeBtn() {
    const btn = $('tree-btn');
    if (!G.tree().length) { btn.classList.add('hidden'); return; }
    btn.classList.remove('hidden');
    const n = G.affordableNodes();
    btn.className = 'btn tree-btn ' + G.side + (n ? ' pulse' : '');
    btn.innerHTML = `<span>${G.side === 'regime' ? '🏛 政权建设' : '🧬 组织建设'} <small>(B)</small></span>${n ? `<span class="cnt">${n} 项可建</span>` : '<span class="era">点数不够</span>'}`;
  }

  /* ---------- 建设树 ---------- */
  let treeSel = null;
  function openTree() {
    if (!G || G.over || !G.tree().length) return;
    const firstOk = G.tree().flatMap((b) => b.nodes).find((n) => G.nodeState(n).ok);
    treeSel = treeSel || (firstOk && firstOk.id);
    $('ov-tree').classList.add('show');
    renderTree();
    Coach.notify('tree-open');
    if (Coach.active) setTimeout(() => Coach.remark(), 40);
  }
  function closeTree() { $('ov-tree').classList.remove('show'); }
  function renderTree() {
    const T = G.tree(), box = $('tree-box');
    box.className = 'modal treebox ' + (G.side === 'regime' ? 'regimeT' : '');
    let sel = null;
    let h = `<div class="th"><h3>${G.side === 'regime' ? '🏛 政权建设' : '🧬 组织建设'}</h3><span class="pts">${cur()} <b>${Math.floor(G.me.ap)}</b></span><button class="btn" id="tree-close">关闭</button></div>
      <div class="era" style="margin-top:4px">建成后永久生效。${G.side === 'movement' ? '每一项都会让当局更警觉——先闷声发展,还是先打出声势?' : ''}</div><div class="tcols">`;
    for (const b of T) {
      h += `<div class="tcol"><h4>${b.icon} ${b.name}</h4><div class="td">${b.desc}</div>`;
      for (const n of b.nodes) {
        const st = G.nodeState(n);
        if (treeSel === n.id) sel = { n, st };
        const cls = st.have ? 'have' : st.ok ? 'ok' : !st.reqOk ? 'locked' : '';
        h += `<button class="tnode ${cls} ${treeSel === n.id ? 'sel' : ''}" data-node="${n.id}"><div class="tn"><span>${n.name}</span><span class="tc">${st.have ? '✓ 已建成' : cur() + ' ' + n.cost}</span></div><div class="tt">${n.tags.join(' · ')}</div></button>`;
      }
      h += '</div>';
    }
    h += '</div>';
    if (sel) {
      const { n, st } = sel;
      const reqNames = (n.req || []).map((id) => { for (const b of T) for (const q of b.nodes) if (q.id === id) return q.name; return null; }).filter(Boolean);
      h += `<div class="tdetail"><div class="tx"><b>${n.name}</b><br>${n.text}<div class="tags">${n.tags.join(' · ')}</div>
        ${G.side === 'movement' && n.alert ? `<div class="warn">当局警觉 +${n.alert}</div>` : ''}
        ${!st.reqOk && reqNames.length ? `<div class="warn">需要先建成:${reqNames.join(n.reqAny ? ' 或 ' : ' 和 ')}</div>` : ''}</div>
        <button class="btn primary" id="tree-buy" ${st.ok ? '' : 'disabled'}>${st.have ? '已建成' : `建设 · ${cur()} ${n.cost}`}</button></div>`;
    }
    box.innerHTML = h;
    $('tree-close').addEventListener('click', closeTree);
    box.querySelectorAll('[data-node]').forEach((b) => b.addEventListener('click', () => {
      treeSel = b.dataset.node;
      const n = G.tree().flatMap((q) => q.nodes).find((q) => q.id === treeSel);
      if (n && G.nodeState(n).ok && (b.classList.contains('sel') || Coach.active)) return buyNode(treeSel);
      renderTree();
    }));
    const bb = $('tree-buy'); if (bb) bb.addEventListener('click', () => buyNode(treeSel));
  }
  function buyNode(id) {
    if (!G.buy(id)) return;
    processFx(); renderAll(); renderTree();
    Coach.notify('tree:' + id);
    if (G.L.id === 'tutorial') setTimeout(closeTree, 500);
  }
  $('tree-btn').addEventListener('click', openTree);
  $('ov-tree').addEventListener('click', (e) => { if (e.target === $('ov-tree')) closeTree(); });

  function dots(lv, max) { let h = ''; for (let i = 0; i < max; i++) h += `<i style="${i < lv ? `background:${sevColor(lv, max)}` : ''}"></i>`; return h; }
  function sevColor(lv, max) { const t = lv / max; return t < 0.34 ? '#7fa7d6' : t < 0.6 ? '#e8c46a' : t < 0.85 ? '#f0964c' : '#ef6a5e'; }

  function renderReadouts() {
    const r = G.readout(), L = G.L, lab = L.labels || {};
    const rows = [];
    rows.push({ id: 'risk', i: '⚠️', l: '此刻站出来', v: r.risk.words, s: '被抓的后果:' + r.pen.words, lv: r.risk.level, max: 4 });
    rows.push({ id: 'legit', i: '⚖️', l: '执法在人们眼中', v: r.legit.words, s: r.legit.level ? '越界的处罚会被记住' : '', lv: r.legit.level, max: 3 });
    rows.push({ id: 'army', i: '🪖', l: lab.army || '军警', tag: r.army.rumor ? '传闻' : '', v: r.army.words, lv: r.army.level, max: 4 });
    rows.push({ id: 'mood', i: '💢', l: '民间情绪', tag: G.side === 'regime' ? '可信度:' + r.mood.conf.split(':')[0] : '传闻', v: r.mood.words,
      s: G.side === 'regime' && r.mood.bias >= 0.15 ? r.mood.conf.split(':')[1] || '' : '', lv: r.mood.level, max: 4 });
    $('readouts').innerHTML = rows.map((o) => {
      const changed = prevWords[o.id] != null && prevWords[o.id] !== o.v;
      return `<div class="ro ${changed ? 'flash' : ''}" id="ro-${o.id}" data-tip="${esc(RO_TIPS[o.id] || '')}">
        <div class="i">${o.i}</div><div class="l"><span>${o.l}</span>${o.tag ? `<span class="tag">${o.tag}</span>` : ''}</div>
        <div class="v ${o.lv != null ? 'lv' + Math.min(5, Math.round((o.lv / (o.max || 4)) * 4)) : ''}">${o.v}</div>
        ${o.s ? `<div class="s">${o.s}</div>` : ''}
        ${o.lv != null ? `<div class="dots">${dots(o.lv, o.max)}</div>` : ''}</div>`;
    }).join('');
    for (const o of rows) prevWords[o.id] = o.v;
    $('intel-tag').textContent = G.side === 'regime' ? '来自下面的报告' : '你的所见所闻';
    // 对手态势
    if (G.side === 'movement' && !L.noAI) {
      const nm = (k) => polName(k, G.pol[k]);
      $('opp-stance').innerHTML = `<div class="opp-stance">当局态势:<br>执法 <b>${nm('enforce')}</b> · 警力 <b>${nm('police')}</b><br>抓捕 <b>${nm('target')}</b> · 舆论 <b>${nm('info')}</b></div>`;
    } else $('opp-stance').innerHTML = '';
  }
  const RO_TIPS = {
    crowd: '此刻公开站出来的人。每个亮点是一群人。',
    risk: '如果你现在站出来,被抓的可能性。当局每一轮能抓的人数有限:人越多,每个人被抓的机会就越小。',
    legit: '当前的处罚在人们眼中是否正当。一旦越过人们认可的界线,每一次处罚都会被旁观者记在心里(积怨),也会让执行者不安。',
    army: '执行命令的人是否还愿意执行。他们也在看:街上有多少人、同僚在做什么、命令是否过火。',
    mood: '人们心里积了多少怨气。它不会表现为上街,却在悄悄降低临界点。当局越凶,情报越报喜不报忧。',
    tip: '需要多少人同时站出来,才会引发连锁反应。这是估计,不是精确值。',
    exposure: '你的网络被发现的风险。每次行动都会增加,「销毁痕迹」能降低。到顶则全盘皆输。',
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  function renderEffects() {
    $('effects').innerHTML = G.effects.map((e) => `<span class="chip ${e.side === G.side ? 'mine' : 'opp'}">${e.icon} ${e.name} · ${e.rounds}</span>`).join('');
  }

  function renderRes() {
    const st = G.me, cap = G.apCap;
    const inc = G.income(G.side);
    const raw = G.side === 'regime' ? G.regimeRawIncome() : inc;
    const nm = G.side === 'regime' ? '政治资本' : '组织力';
    const incText = G.side === 'regime' && raw < 0 ? '<span style="color:var(--red2)">入不敷出!代价正转嫁给百姓</span>' : `每轮 +${inc.toFixed(1)} · 另有气泡可收集`;
    const frac = clamp(st.ap - Math.floor(st.ap), 0, 1);
    $('res').className = 'res ' + G.side;
    $('res').innerHTML = `<div><div class="nm">${nm}</div><div class="inc">${incText}</div></div><div class="big">${cur()} ${Math.floor(st.ap)}<span class="frac"><i style="width:${(frac * 100).toFixed(0)}%"></i></span></div>`;
    $('res').dataset.tip = G.side === 'regime' ? '政治资本:出牌、切换强硬政策、建设都要花。强硬政策每轮都有维持开销;人群越大、军心越乱,收入越少。点击城市里的「安定」「情报」气泡收集。' : '组织力:出牌、建设都要花。每轮恢复一点;街上的人越多恢复越快。点击城市里冒出的气泡收集。';
  }

  const polName = (k, id) => {
    const o = POLICIES[k].options.find((x) => x.id === id);
    const ov = G.L.policyNames && G.L.policyNames[k] && G.L.policyNames[k].options && G.L.policyNames[k].options[id];
    return ov || (o ? o.name : id);
  };
  const polTitle = (k) => (G.L.policyNames && G.L.policyNames[k] && G.L.policyNames[k].name) || POLICIES[k].name;
  const upWords = (u) => (u >= 0.5 ? '很高' : u >= 0.25 ? '高' : u >= 0.1 ? '中' : u > 0 ? '低' : u < 0 ? '省钱' : '无');

  function renderPolicies() {
    const box = $('policies');
    if (G.side !== 'regime') { box.innerHTML = ''; return; }
    let h = '<div class="sec-t">政策 <span class="tag">常设 · 越强硬越贵</span></div>';
    for (const k of POLICY_KEYS) {
      const P = POLICIES[k];
      const lock = G.locks[k] && G.locks[k].until > G.round ? G.locks[k] : null;
      const cd = G.polCd[k] || 0;
      h += `<div class="policy" id="pol-${k}"><div class="ph"><span data-tip="${esc(P.desc)}">${P.icon} ${polTitle(k)}</span><span class="lock">${lock ? '🔒 ' + (lock.reason || '') : cd > 0 ? '⏳ ' + cd : ''}</span></div><div class="seg">`;
      for (const o of P.options) {
        const ps = G.policyState(k, o.id);
        const na = !ps.allowed || ps.needNet;
        const tip = `<b>${polName(k, o.id)}</b>${o.short ? ' · ' + o.short : ''}<div class="tt-tags">维持开销:${upWords(o.upkeep || 0)}${o.cost ? ` · 切换需 ${o.cost} 点` : ''}</div>${na ? '<div class="tt-warn">本关不可用</div>' : ''}`;
        h += `<button class="${ps.cur ? 'on' : ''} ${na ? 'na' : ''}" data-pol="${k}" data-opt="${o.id}" ${ps.ok ? '' : 'disabled'} data-tip="${esc(tip)}">${polName(k, o.id)}${o.cost && !ps.cur ? '<span class="c">●</span>' : ''}</button>`;
      }
      h += '</div></div>';
    }
    h += '<div class="hint-line">越强硬:上街越可怕,但维持越贵;一旦越过人们认可的界线,积怨与军心不稳也随之而来。</div>';
    box.innerHTML = h;
    box.querySelectorAll('[data-pol]').forEach((b) => b.addEventListener('click', () => {
      if (G.setPolicy(b.dataset.pol, b.dataset.opt)) { renderAll(); Coach.notify('policy:' + b.dataset.pol); }
    }));
  }

  function renderCards() {
    const hand = G.hand();
    $('cards').innerHTML = hand.map((c, idx) => {
      const cs = G.cardState(c);
      const free = cs.cost === 0 && c.cost > 0;
      let cost = '';
      if (free) cost = '<span class="free">免费</span>'; else cost = `<span class="num">${cur()} ${cs.cost}</span>`;
      const warn = !cs.cond ? (c.whenText || '条件未满足') : cs.cd > 0 ? `冷却中:还要 ${cs.cd} 轮` : G.me.ap < cs.cost ? '资源不足' : '';
      const tip = `<b>${c.icon} ${c.name}</b><br>${c.text}<div class="tt-tags">${(c.tags || []).join(' · ')}${c.cd ? ` · 冷却 ${c.cd} 轮` : ''}${c.once ? ' · 只能用一次' : ''}</div>${warn ? `<div class="tt-warn">${warn}</div>` : ''}`;
      return `<button class="card ${G.side} ${c.special ? 'special' : ''} ${free && cs.ok ? 'freebie' : ''}" data-card="${c.id}" ${cs.ok ? '' : 'disabled'} data-tip="${esc(tip)}">
        <div class="top"><span class="ic">${c.icon}</span><span class="cost">${cost}</span></div>
        <div class="nm">${c.name}</div><div class="tg">${(c.tags || []).slice(0, 2).join(' · ')}</div>
        ${cs.cd > 0 ? `<div class="cd">⏳ ${cs.cd}</div>` : ''}${idx < 9 ? `<span class="key">${idx + 1}</span>` : ''}</button>`;
    }).join('');
    $('cards').querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => playCard(b.dataset.card)));
  }
  function playCard(id) {
    if (!G || !G.play(id)) return;
    processFx();
    renderAll();
    const el = document.querySelector(`[data-card="${id}"]`);
    if (el) { el.classList.add('played'); }
    const c = G.card(id);
    toast(`${c.icon} ${c.name}`, 'crowd');
    Coach.notify('play:' + id);
  }

  function renderNews() {
    $('news').innerHTML = G.news.slice(0, 40).map((n) => `<div class="n ${n.kind}"><span class="d">${n.date}</span><span>${n.text}</span></div>`).join('');
  }

  /* ---------- 事件弹窗 ---------- */
  function showEvent() {
    if (!G || !G.popup) return;
    if (Coach.active) return;   // 引导结束后再弹
    const p = G.popup;
    $('ev-box').innerHTML = `<div class="ev-art">${p.art}</div><div class="ev-date">${p.date}</div><h3>${p.title}</h3>
      ${p.quote ? `<div class="quote">${p.quote}</div>` : ''}<div class="body">${p.text || ''}</div>
      <div class="choices">${p.choices.map((c, i) => `<button class="choice" data-i="${i}">${c.label}${c.hint ? `<span class="h">${c.hint}</span>` : ''}</button>`).join('')}</div>`;
    $('ov-event').classList.add('show');
    $('ev-box').querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => {
      $('ov-event').classList.remove('show');
      G.choose(+b.dataset.i);
      processFx();
      renderAll();
      if (G.popup) showEvent();
      else if (G.over) setTimeout(showEnd, 600);
      Coach.notify('choice');
    }));
  }

  /* ---------- 结算与复盘 ---------- */
  function showEnd() {
    if (!G || !G.over || endShown) return;
    endShown = true;
    setSpeed(0);
    const o = G.over, L = G.L;
    if (L.id !== 'skirmish') {
      SAVE.done[L.id] = true;
      if (o.win) SAVE.stars[L.id] = Math.max(SAVE.stars[L.id] || 0, o.starCount);
      persist();
    }
    const idx = LEVELS.findIndex((x) => x.id === L.id);
    const next = idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
    const st = o.stats;
    const lab = L.labels || {};
    $('end-box').className = 'modal end ' + (o.win ? 'win' : 'lose');
    $('end-box').innerHTML = `
      <div class="kick">${L.chapter} · ${L.title} · ${o.win ? '胜利' : '失败'}</div>
      <h3 class="res-t">${o.title}</h3>
      ${o.win && L.id !== 'tutorial' ? `<div class="big-stars">${starsHtml(o.starCount, 3)}</div>` : ''}
      ${o.win && o.stars.length > 1 ? `<ul class="star-list">${o.stars.map((s) => `<li class="${s.ok ? 'ok' : ''}">${s.ok ? '★' : '☆'} ${s.text}</li>`).join('')}</ul>` : ''}
      <div class="tabpane" style="text-align:center">${o.text}</div>
      <div class="stat-row">
        <div class="stat"><div class="k">最多时${lab.crowd || '街头'}</div><div class="v">${st.peakCrowd} 人</div></div>
        <div class="stat"><div class="k">累计被带走</div><div class="v">${st.detained} 人</div></div>
        <div class="stat"><div class="k">${lab.army || '军警'}最乱时</div><div class="v">${st.peakArmy}</div></div>
        <div class="stat"><div class="k">结束时的积怨</div><div class="v">${st.moodEnd}</div></div>
      </div>
      <div class="tabs"><button class="on" data-tab="replay">复盘 · 真相揭晓</button>${L.history ? '<button data-tab="hist">历史</button>' : ''}${L.lesson ? '<button data-tab="lesson">模型</button>' : ''}</div>
      <div class="tabpane" id="tab-replay">
        <canvas id="debrief"></canvas>
        <div class="legend">
          <span><i style="background:#ffcf70"></i>街头的人</span>
          <span><i style="background:#57c28a"></i>执行者抗命</span>
          <span><i style="background:#ef6a5e"></i>真实积怨</span>
          <span style="color:#ef6a5e"><i class="dash" style="color:#ef6a5e"></i>你看到的积怨</span>
          <span><i style="background:#b392f0"></i>真实临界点</span>
          <span style="color:#b392f0"><i class="dash" style="color:#b392f0"></i>你估计的临界点</span>
        </div>
        <div class="reveal-note">${insight()}</div>
      </div>
      ${L.history ? `<div class="tabpane hidden" id="tab-hist"><h4>历史上</h4>${L.history}</div>` : ''}
      ${L.lesson ? `<div class="tabpane hidden" id="tab-lesson"><h4>${L.lesson.title}</h4>${L.lesson.text}<p style="color:var(--dim);font-size:13px;margin-top:12px">想亲手调每一个参数?去<a href="lab.html">模型实验室</a>。</p></div>` : ''}
      <div class="actions">
        <button class="btn" id="end-retry">再来一次</button>
        ${next && L.id !== 'skirmish' ? `<button class="btn primary" id="end-next">下一关:${next.title} →</button>` : ''}
        <button class="btn ghost" id="end-levels">${L.id === 'skirmish' ? '返回标题' : '返回关卡'}</button>
      </div>`;
    $('ov-end').classList.add('show');
    $('end-box').querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
      $('end-box').querySelectorAll('[data-tab]').forEach((x) => x.classList.toggle('on', x === b));
      ['replay', 'hist', 'lesson'].forEach((t) => { const el = $('tab-' + t); if (el) el.classList.toggle('hidden', t !== b.dataset.tab); });
      if (b.dataset.tab === 'replay') drawDebrief();
    }));
    $('end-retry').addEventListener('click', () => { $('ov-end').classList.remove('show'); startLevel(curLevel, curOpts); });
    if ($('end-next')) $('end-next').addEventListener('click', () => { $('ov-end').classList.remove('show'); openBrief(next); });
    $('end-levels').addEventListener('click', () => { $('ov-end').classList.remove('show'); show(L.id === 'skirmish' ? 'title' : 'levels'); });
    requestAnimationFrame(drawDebrief);
  }

  function insight() {
    const h = G.hist, n = h.x.length;
    const W = (v) => (v < 0.1 ? '平静' : v < 0.3 ? '隐忍' : v < 0.55 ? '积怨' : v < 0.8 ? '怨声载道' : '一触即发');
    const lines = [];
    let gap = 0, gi = 0;
    for (let i = 0; i < n; i++) if (h.mood[i] - h.moodSeen[i] > gap) { gap = h.mood[i] - h.moodSeen[i]; gi = i; }
    if (G.side === 'regime' && gap > 0.2) lines.push(`在${G.dateLabel(gi)}前后,下面报上来的民间情绪是"${W(h.moodSeen[gi])}",而实际上已经是"${W(h.mood[gi])}"。执法越凶,下面的人越不敢说真话。`);
    const quiet = h.x.slice(0, Math.max(1, n - 1)).every((v) => v < 0.03);
    const t0 = h.tip[0], tMin = Math.min(...h.tip);
    if (quiet && t0 - tMin > 0.08) lines.push('整局下来街上几乎一直很安静,可临界点一直在下降——<b>沉默没有发出任何预警</b>。');
    const peakMood = Math.max(...h.mood);
    if (peakMood > 0.55 && G.side === 'movement') lines.push('积怨一度高到"' + W(peakMood) + '"。它不表现为上街,却在把临界点往下压。');
    if (!lines.length) lines.push('实线是真实发生的,虚线是你当时看到(或估计)的。两者之间的距离,就是这一关的"迷雾"。');
    return lines.join('<br>');
  }

  function drawDebrief() {
    const cv = $('debrief'); if (!cv || !G) return;
    const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, hgt = cv.clientHeight;
    if (!w) return;
    cv.width = w * dpr; cv.height = hgt * dpr;
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const h = G.hist, n = h.x.length, pad = { l: 36, r: 10, t: 12, b: 22 };
    const X = (i) => pad.l + (w - pad.l - pad.r) * (n <= 1 ? 0 : i / (n - 1));
    const Y = (v) => pad.t + (hgt - pad.t - pad.b) * (1 - clamp(v, 0, 1));
    ctx.fillStyle = '#10151d'; ctx.fillRect(0, 0, w, hgt);
    ctx.strokeStyle = '#222b36'; ctx.fillStyle = '#6d7885'; ctx.font = '10px sans-serif';
    for (let q = 0; q <= 4; q++) { const y = Y(q / 4); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke(); ctx.fillText((q * 25) + '%', 4, y + 3); }
    ctx.fillText(G.dateLabel(0), pad.l, hgt - 6);
    ctx.textAlign = 'right'; ctx.fillText(G.dateLabel(n - 1), w - pad.r, hgt - 6); ctx.textAlign = 'left';
    // 行动标记
    for (const a of G.actions) {
      const i = Math.min(n - 1, a.round);
      ctx.fillStyle = a.side === G.side ? 'rgba(240,180,76,.7)' : 'rgba(229,83,75,.7)';
      ctx.fillRect(X(i) - 1, hgt - pad.b - 5, 2, 5);
    }
    const line = (arr, col, dash, scale) => {
      ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.setLineDash(dash ? [5, 4] : []);
      ctx.beginPath();
      for (let i = 0; i < n; i++) { const v = arr[i] * (scale || 1); i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)); }
      ctx.stroke(); ctx.setLineDash([]);
    };
    const moodScale = 0.8;   // "一触即发"画在 80% 高度
    line(h.tip, '#b392f0', false); line(h.tipSeen, '#b392f0', true);
    line(h.mood.map((v) => Math.min(1.25, v)), '#ef6a5e', false, moodScale); line(h.moodSeen.map((v) => Math.min(1.25, v)), '#ef6a5e', true, moodScale);
    line(h.d, '#57c28a', false);
    line(h.x, '#ffcf70', false);
  }

  /* ---------- 菜单与帮助 ---------- */
  $('g-menu').addEventListener('click', () => { setSpeed(0); $('ov-menu').classList.add('show'); });
  $('mm-resume').addEventListener('click', () => $('ov-menu').classList.remove('show'));
  $('mm-restart').addEventListener('click', () => { $('ov-menu').classList.remove('show'); startLevel(curLevel, curOpts); });
  $('mm-help').addEventListener('click', () => { $('ov-menu').classList.remove('show'); $('ov-help').classList.add('show'); });
  const autoLabel = () => { $('mm-auto').textContent = '自动收集气泡(只得一半):' + (SAVE.autoCollect ? '开' : '关'); };
  autoLabel();
  $('mm-auto').addEventListener('click', () => { SAVE.autoCollect = !SAVE.autoCollect; persist(); autoLabel(); });
  $('mm-levels').addEventListener('click', () => { $('ov-menu').classList.remove('show'); show('levels'); });
  $('mm-title').addEventListener('click', () => { $('ov-menu').classList.remove('show'); show('title'); });
  $('g-help').addEventListener('click', () => { setSpeed(0); $('ov-help').classList.add('show'); });
  $('g-guide').addEventListener('click', startGuide);
  $('mm-guide').addEventListener('click', () => { $('ov-menu').classList.remove('show'); startGuide(); });
  $('help-close').addEventListener('click', () => $('ov-help').classList.remove('show'));
  $('m-help').addEventListener('click', () => $('ov-help').classList.add('show'));
  $('m-campaign').addEventListener('click', () => show('levels'));
  $('m-tutorial').addEventListener('click', () => openBrief(LEVELS[0]));
  $('m-skirmish').addEventListener('click', () => show('skirmish'));

  /* ---------- 键盘 ---------- */
  document.addEventListener('keydown', (e) => {
    if (current !== 'game' || !G) return;
    if (anyOverlay()) { if (e.key === 'Escape' || (e.key === 'b' && $('ov-tree').classList.contains('show'))) { $('ov-menu').classList.remove('show'); $('ov-help').classList.remove('show'); closeTree(); } return; }
    if (Coach.active && e.key === 'Escape') { Coach.end(); return; }
    if (Coach.locked()) return;
    if (e.key === ' ') { e.preventDefault(); setSpeed(speed > 0 ? 0 : lastSpeed || 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); $('btn-step').click(); }
    else if (e.key === 'Escape') { $('g-menu').click(); }
    else if (/^[1-9]$/.test(e.key)) { const c = G.hand()[+e.key - 1]; if (c) playCard(c.id); }
    else if (e.key === 'b' || e.key === 'B') openTree();
  });

  /* ---------- 提示框 ---------- */
  const tipEl = $('tooltip');
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t || !t.dataset.tip) { tipEl.style.display = 'none'; return; }
    tipEl.innerHTML = t.dataset.tip; tipEl.style.display = 'block';
    const r = t.getBoundingClientRect(), tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 8;
    if (y < 8) y = r.bottom + 8;
    x = clamp(x, 8, innerWidth - tw - 8);
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  });
  document.addEventListener('mouseout', (e) => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('[data-tip]')) tipEl.style.display = 'none'; });
  window.addEventListener('resize', () => { if (city && current === 'game') city.resize(); Coach.reposition(); });
  window.addEventListener('scroll', () => Coach.reposition(true), { passive: true });

  /* ================= 新手引导 ================= */
  // wait: 'click'(按继续) | 'play:ID' | 'round' | 'ap:N' | 'speed' | 'policy:KEY'
  const TUTORIAL = [
    { target: '#stage', text: '周一的升旗仪式。一千名学生<b>按班级站在操场上</b>,每个小点是一个学生。<br>站出来提异议的人会<b>走出队列,站到主席台前</b>;被点名的会被带去左上角的<b>教导处</b>(变红)。台上和过道里的蓝色方块是老师。' },
    { target: '#ro-risk', text: '看"此刻站出来"。教导主任一分钟<b>最多只能处理二十个人</b>。现在没人站出来——谁第一个出头,谁就一定被点名。' },
    { target: '#m-main', text: '最上面这根条是关键。<b>黄色</b>是站出来的人,<b>紫色框</b>是"临界点":大约要这么多人同时站出来,风险才会被摊薄,连锁反应才会开始。' },
    { target: '#res', text: '这是你的<b>组织力</b>。出牌、建设都要花它,每分钟恢复一点。' },
    { target: '[data-card="t_small"]', text: '先试试看:打出<b>「几个人先站出来」</b>——你和同班九个最要好的同学。', wait: 'play:t_small', allow: ['t_small'] },
    { target: '#btn-step', text: '点<b>「下一轮」</b>,看看会发生什么。', wait: 'round', allowSel: ['#btn-step'] },
    { target: '.bubble', text: '你们十个人走到了台前,操场上冒出一个<b>「士气」气泡</b>。点它,收集组织力。<br>(局势变化时就会冒气泡,别让它们消失。)', wait: 'collect', allowSel: ['.bubble'] },
    { target: '#btn-step', text: '再点一次<b>「下一轮」</b>。', wait: 'round', allowSel: ['#btn-step'] },
    { target: '#stage', text: '十个人<b>全被点名带走了</b>。其他同学看在眼里——更不敢动了。<br>人太少的时候,每个站出来的人都会被抓。<b>这就是沉默的原因</b>:不是没人不满,而是没人愿意当那少数几个。' },
    { target: '#tree-btn', text: '右边的<b>「组织建设」</b>是永久的升级,像给你的组织加技能。打开它。', wait: 'tree-open', allowSel: ['#tree-btn'] },
    { target: '[data-node="m_net"]', text: '建成<b>「联络网」</b>:之后每次行动,带出的人多 25%。点它。', wait: 'tree:m_net', allow: ['tree:m_net'] },
    { target: '#btn-step', text: '「全年级串联」要 3 点组织力。<b>点「下一轮」</b>,攒够它。', wait: 'ap:3', allowSel: ['#btn-step'] },
    { target: '[data-card="t_big"]', text: '看最上面的条:斜纹已经越过了紫框——够了。打出<b>「全年级串联」</b>。', wait: 'play:t_big', allow: ['t_big'] },
    { target: '.speed', text: '这次按 <b>▶</b>,让时间走起来,看着吧。', wait: 'speed', allowSel: ['.speed'] },
  ];
  const SYS = {
    movement: [
      { target: '#m-main', text: '最上面左边这根条最重要:<b>黄色</b>是站出来的人,<b>斜纹</b>是你手里的组织力一次还能带出的人,<b>紫框</b>是临界点。<br><b>黄色加斜纹越过紫框,就是全力出手的时候。</b>' },
      { target: '#m-opp', text: '右边是<b>当局警觉</b>。街上的每一次聚集、你的每个动作都会推高它;到 25 / 50 / 75,当局会依次升级为警戒、严打、全面镇压。安静时它会慢慢回落。' },
      { target: '#tree-btn', text: '<b>组织建设</b>:传播、记忆、韧性三条路线的永久升级。它们同样会推高当局警觉——先闷声发展,还是先打出声势?(快捷键 B)' },
      { target: '#stage', text: '局势变化时,城市里会冒出<b>气泡</b>:愤怒、士气、同情、消息。<b>点击收集</b>——它们是组织力最重要的来源。每隔几轮,还会有<b>突发事件</b>逼你做选择。' },
    ],
    regime: [
      { target: '#m-main', text: '左边是你还要撑多久。撑到最后就算胜利——但星级要看积怨深不深、抓了多少人。' },
      { target: '#m-opp', text: '右边是<b>反对派组织度</b>(据报)。它满了,对方就会发动一次大规模行动。积怨越深涨得越快;抓串联者、对话让步能压下去。<b>注意:你越凶,这个数字报得越低。</b>' },
      { target: '#tree-btn', text: '<b>政权建设</b>:铁拳、天网、民心三条路线的永久升级。(快捷键 B)' },
      { target: '#stage', text: '平静的日子会冒出<b>「安定」</b>气泡,抓人会冒出<b>「情报」</b>气泡。点击收集政治资本。' },
    ],
  };
  const COACH = {
    liwang: [
      { target: '#policies', text: '这一关你是君主。右边是你的<b>常设政策</b>:执法多重、卫士多少、抓谁、言路开闭、囹圄松紧。<b>越强硬,上街越可怕——但每轮都要花钱维持。</b>' },
      { target: '#ro-mood', text: '这是下面报上来的"民间情绪"。注意<b>可信度</b>:你越凶,下面的人越不敢说真话,报上来的就越平静。' },
      { target: '#cards', text: '「卫巫监谤」能让你<b>暂时听到真话</b>,还能看见每家每户心里的怨气(红色)。' },
    ],
    petrograd: [{ target: '#ro-army', text: '注意<b>驻军</b>。街上的人越多,士兵越动摇;士兵一动摇,能抓人的就少了,街上又会更安全——两层反馈会互相放大。「劝说士兵」要在人多的时候打。' }],
    iran: [{ target: '#cards', text: '每一次镇压之后,大约<b>六周</b>会迎来一次"四十日"悼念。记忆在那时最强——那也是你出手的最好时机。' }],
    poland: [{ target: '#res', text: '戒严的所有手段都开着:军队进城、按名单拘押、封锁新闻……<b>它们非常贵</b>。入不敷出时,代价会转嫁给百姓,变成积怨。你得决定先放松哪一样。' }],
    beijing: [{ target: '#ro-army', text: '这一关,<b>人再多也不够</b>。百万人上街并没有改变结局——决定结局的,是那些开进城的士兵会不会开枪。' }],
    leipzig: [{ target: '#cards', text: '每周一的<b>「和平祈祷」免费</b>。教会圈里的人彼此信任,一个人出来能带出另一个。' }],
    baizhi: [{ target: '#cards', text: '你手里有一张只能用一次的牌:<b>「桥上的横幅」</b>。它不会让很多人上街,却会让很多人<b>记住</b>。' }],
    pyongyang: [
      { target: '#m-opp', text: '在这里,<b>别上街</b>。你的每一次行动都会增加暴露风险;到顶,你的网络会被一网打尽。' },
      { target: '#m-main', text: '你的目标是这根条:让"临界点"从"看不到转机"变成一个<b>真实存在、而且不太高</b>的数字。' },
    ],
  };

  const Coach = (() => {
    const layer = $('coach-layer'), hole = $('coach-hole'), box = $('coach'), blocker = $('coach-blocker');
    let steps = [], i = 0, opts = {}, active = false;
    function start(s, o) { steps = s; opts = o || {}; i = 0; active = true; layer.classList.add('show'); setSpeed(0); showStep(); }
    function end() {
      active = false; layer.classList.remove('show');
      document.body.classList.remove('coach-lock');
      document.querySelectorAll('.coach-allow').forEach((e) => e.classList.remove('coach-allow'));
      if (G) { G.allowCards = null; if (current === 'game') { renderCards(); renderTreeBtn(); } }   // 中途关闭引导: 解锁并重画
      if (opts.after) { const f = opts.after; opts.after = null; f(); }
    }
    function showStep() {
      const st = steps[i];
      if (!st) { end(); return; }
      $('coach-txt').innerHTML = st.text;
      $('coach-prog').textContent = `${i + 1} / ${steps.length}`;
      const waiting = !!st.wait;
      $('coach-next').classList.toggle('hidden', waiting);
      $('coach-wait').textContent = waiting ? '👉 请照做' : '';
      // 交互: 等待型步骤只放开目标控件
      if (G) G.allowCards = opts.lock ? (st.allow || []) : null;
      document.querySelectorAll('.coach-allow').forEach((e) => e.classList.remove('coach-allow'));
      blocker.style.display = waiting ? 'none' : 'block';
      if (waiting) {
        document.body.classList.add('coach-lock');
        (st.allowSel || []).concat(st.allow ? st.allow.map((id) => `[data-card="${id}"]`) : []).forEach((sel) => document.querySelectorAll(sel).forEach((e) => e.classList.add('coach-allow')));
      } else document.body.classList.remove('coach-lock');
      if (G) { renderCards(); renderTreeBtn(); }
      reposition();
      if (waiting) setTimeout(remark, 30);
      if (st.wait && st.wait.startsWith('ap:') && G && G.me.ap >= +st.wait.slice(3)) setTimeout(next, 200);
      if (st.wait === 'collect' && G && !G.bubbles.length) { G.spawnBubble('morale', 1, 'plaza'); processFx(); }
    }
    function remark() {   // 重绘之后重新标记可点的控件, 并重新定位
      const st = steps[i]; if (!active || !st) return;
      (st.allowSel || []).forEach((sel) => document.querySelectorAll(sel).forEach((e) => e.classList.add('coach-allow')));
      (st.allow || []).forEach((id) => document.querySelectorAll(`[data-card="${id}"]`).forEach((e) => e.classList.add('coach-allow')));
      reposition();
    }
    function reposition(noScroll) {
      if (!active) return;
      const st = steps[i]; if (!st) return;
      const el = st.target ? document.querySelector(st.target) : null;
      if (el && el.getClientRects().length) {
        if (window.innerWidth <= 980 && !opts._scrolled && !noScroll) {
          // 窄屏: 先把目标滚到视野中间, 滚完再定位高亮框
          opts._scrolled = true;
          el.scrollIntoView({ block: 'center' });
          setTimeout(() => { reposition(true); opts._scrolled = false; }, 120);
        }
        const r = el.getBoundingClientRect(), p = 6;
        Object.assign(hole.style, { display: 'block', left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + 2 * p + 'px', height: r.height + 2 * p + 'px' });
        const bw = box.offsetWidth, bh = box.offsetHeight;
        let x, y;
        if (r.right + bw + 24 < innerWidth) { x = r.right + 16; y = r.top; }
        else if (r.left - bw - 24 > 0) { x = r.left - bw - 16; y = r.top; }
        else { x = r.left + r.width / 2 - bw / 2; y = r.bottom + 16 + bh > innerHeight ? r.top - bh - 16 : r.bottom + 16; }
        if (r.height > innerHeight * 0.5) { y = r.top + 20; }
        box.style.left = clamp(x, 12, innerWidth - bw - 12) + 'px';
        box.style.top = clamp(y, 12, innerHeight - bh - 12) + 'px';
      } else {
        hole.style.display = 'none';
        box.style.left = (innerWidth - box.offsetWidth) / 2 + 'px'; box.style.top = innerHeight * 0.3 + 'px';
      }
    }
    function next() { i++; showStep(); }
    function notify(ev) {
      if (!active) return;
      const st = steps[i]; if (!st || !st.wait) return;
      if (st.wait === ev) next();
      else if (st.wait.startsWith('ap:') && G && G.me.ap >= +st.wait.slice(3)) next();
      else if (st.wait === 'speed' && ev === 'speed' && speed > 0) next();
    }
    $('coach-next').addEventListener('click', next);
    $('coach-close').addEventListener('click', () => end());
    return {
      start, end, notify, reposition, remark,
      get active() { return active; },
      blocking: () => active && !(steps[i] && steps[i].wait === 'speed'),
      locked: () => active && document.body.classList.contains('coach-lock'),
    };
  })();

  // 引导锁定时只允许目标控件
  const lockStyle = document.createElement('style');
  lockStyle.textContent = `body.coach-lock #scr-game button:not(.coach-allow):not(.coach-allow *), body.coach-lock #scr-game .card:not(.coach-allow) { pointer-events: none; }
    body.coach-lock .speed.coach-allow button { pointer-events: auto; }`;
  document.head.appendChild(lockStyle);

  /* ================= 启动 ================= */
  initSkirmish();
  show('title');
  window.__game = () => G;   // 调试用
})();
