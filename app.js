/* 道路以目 · 界面控制器
 * 标题 → 关卡 → 简报 → 对局(城市 + 态势 + 政策/对策) → 事件弹窗 → 结算复盘
 * 对局中不显示任何模型参数; 真实数值只在复盘里揭晓。
 */
(function () {
  'use strict';
  const { Game, POLICIES, POLICY_KEYS, CARDS, fmtCount } = window.SilenceGame;
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
    if (!city) city = new window.SilenceCity($('city'));
    requestAnimationFrame(() => { city.setGame(G); city.resize(); });
    setSpeed(0);
    renderAll(true);
    running = true; lastTs = 0; acc = 0;
    requestAnimationFrame(loop);
    // 开场: 教程 / 首次进入某关的引导 / 事件
    setTimeout(() => {
      if (L.id === 'tutorial') Coach.start(TUTORIAL, { lock: true });
      else if (COACH[L.id] && !SAVE.coach[L.id]) { SAVE.coach[L.id] = 1; persist(); Coach.start(COACH[L.id], { lock: false, after: () => { if (G && G.popup) showEvent(); } }); }
      if (G.popup && !Coach.active) showEvent();
    }, 350);
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
    if (G && speed > 0 && !G.popup && !G.over && !Coach.blocking() && !anyOverlay()) {
      acc += dt;
      if (acc >= ROUND_MS[speed]) { acc = 0; doStep(); }
    }
    if (city && G) city.frame(dt);
    requestAnimationFrame(loop);
  }
  const anyOverlay = () => document.querySelector('.overlay.show') !== null;

  function doStep() {
    if (!G || G.over || G.popup) return;
    const x0 = G.x;
    G.step();
    processFx();
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
      else if (f.type === 'news' && ['crowd', 'army', 'event'].includes(f.kind)) toast(f.text, f.kind === 'army' ? 'good' : 'crowd');
    }
    if (G.x > 0.004 && slogans.length && Math.random() < Math.min(0.9, 0.25 + G.x * 2)) city.say(slogans[(Math.random() * slogans.length) | 0]);
  }
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
    renderGoal(); renderReadouts(); renderEffects(); renderRes(); renderPolicies(); renderCards(); renderNews();
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
      prog = r.tip.kind === 'none' ? 0.03 : clamp((1 - r.tip.shownFrac) / (1 - 0.22), 0, 1);
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

  function dots(lv, max) { let h = ''; for (let i = 0; i < max; i++) h += `<i style="${i < lv ? `background:${sevColor(lv, max)}` : ''}"></i>`; return h; }
  function sevColor(lv, max) { const t = lv / max; return t < 0.34 ? '#7fa7d6' : t < 0.6 ? '#e8c46a' : t < 0.85 ? '#f0964c' : '#ef6a5e'; }

  function renderReadouts() {
    const r = G.readout(), L = G.L, lab = L.labels || {};
    const rows = [];
    rows.push({ id: 'crowd', i: '👥', l: lab.crowd || '街头', v: r.crowd.count < 1 ? '空无一人' : r.crowd.text, s: r.crowd.words, lv: r.crowd.level, max: 5 });
    rows.push({ id: 'risk', i: '⚠️', l: '此刻站出来', v: r.risk.words, s: '被抓的后果:' + r.pen.words, lv: r.risk.level, max: 4 });
    rows.push({ id: 'legit', i: '⚖️', l: '执法在人们眼中', v: r.legit.words, s: r.legit.level ? '越界的处罚会被记住' : '', lv: r.legit.level, max: 3 });
    rows.push({ id: 'army', i: '🪖', l: lab.army || '军警', tag: r.army.rumor ? '传闻' : '', v: r.army.words, lv: r.army.level, max: 4 });
    rows.push({ id: 'mood', i: '💢', l: '民间情绪', tag: G.side === 'regime' ? '可信度:' + r.mood.conf.split(':')[0] : '传闻', v: r.mood.words,
      s: G.side === 'regime' && r.mood.bias >= 0.15 ? r.mood.conf.split(':')[1] || '' : '', lv: r.mood.level, max: 4 });
    if (G.side === 'movement') rows.push({ id: 'tip', i: '🔥', l: '临界点', tag: '估计', v: r.tip.text, s: r.tip.sub, lv: null });
    else rows.push({ id: 'tip', i: '🏛', l: '局面', tag: '据报', v: r.tip.words, s: '越接近"岌岌可危",一件小事就越可能失控', lv: 4 - r.tip.level, max: 4 });
    if (L.id === 'pyongyang') {
      const e = G.exposure; const ew = e < 25 ? '低' : e < 50 ? '中' : e < 75 ? '高' : '危险';
      rows.push({ id: 'exposure', i: '🕵️', l: '暴露风险', v: ew, s: '到顶就会被一网打尽', lv: Math.min(4, Math.floor(e / 20)), max: 4 });
    }
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
    let pips = '';
    for (let i = 0; i < cap; i++) { const f = clamp(st.ap - i, 0, 1); pips += `<span class="pip"><i style="height:${(f * 100).toFixed(0)}%"></i></span>`; }
    const nm = G.side === 'regime' ? '政治资本' : '组织力';
    const incText = G.side === 'regime' && raw < 0 ? '<span style="color:var(--red2)">入不敷出!代价正转嫁给百姓</span>' : `每轮恢复 ${inc >= 1.5 ? '较快' : inc >= 0.8 ? '约一点' : inc >= 0.4 ? '较慢' : '很慢'}`;
    $('res').className = 'res ' + G.side;
    $('res').innerHTML = `<div><div class="nm">${nm}</div><div class="inc">${incText}</div></div><div class="pips">${pips}</div>`;
    $('res').dataset.tip = G.side === 'regime' ? '政治资本:出牌、切换强硬政策都要花。强硬政策每轮都有维持开销;人群越大、军心越乱,收入越少。' : '组织力:出牌要花。每轮恢复,街上的人越多恢复越快。';
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
      if (free) cost = '<span class="free">免费</span>'; else for (let i = 0; i < cs.cost; i++) cost += '<i></i>';
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
  $('mm-levels').addEventListener('click', () => { $('ov-menu').classList.remove('show'); show('levels'); });
  $('mm-title').addEventListener('click', () => { $('ov-menu').classList.remove('show'); show('title'); });
  $('g-help').addEventListener('click', () => { setSpeed(0); $('ov-help').classList.add('show'); });
  $('help-close').addEventListener('click', () => $('ov-help').classList.remove('show'));
  $('m-help').addEventListener('click', () => $('ov-help').classList.add('show'));
  $('m-campaign').addEventListener('click', () => show('levels'));
  $('m-tutorial').addEventListener('click', () => openBrief(LEVELS[0]));
  $('m-skirmish').addEventListener('click', () => show('skirmish'));

  /* ---------- 键盘 ---------- */
  document.addEventListener('keydown', (e) => {
    if (current !== 'game' || !G) return;
    if (anyOverlay()) { if (e.key === 'Escape') { $('ov-menu').classList.remove('show'); $('ov-help').classList.remove('show'); } return; }
    if (Coach.locked()) return;
    if (e.key === ' ') { e.preventDefault(); setSpeed(speed > 0 ? 0 : lastSpeed || 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); $('btn-step').click(); }
    else if (e.key === 'Escape') { $('g-menu').click(); }
    else if (/^[1-9]$/.test(e.key)) { const c = G.hand()[+e.key - 1]; if (c) playCard(c.id); }
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
    { target: '#stage', text: '这是一所一千人的学校。<b>每个小点是一个学生</b>:灰色的在教室里沉默,亮起来的站到了操场上,被带去教导处的会变成红色。<br>左上角蓝色的小方块,是老师们。' },
    { target: '#ro-risk', text: '看左边的"此刻站出来"。教导主任一节课间<b>最多只能处理二十个人</b>。现在没人站出来——谁第一个出头,谁就一定被抓。' },
    { target: '#res', text: '右边是你能做的事。每张牌要花<b>组织力</b>(这些圆点),每一轮恢复一点。' },
    { target: '[data-card="t_small"]', text: '先试试看:打出<b>「几个人先站出来」</b>——你和九个最要好的同学。', wait: 'play:t_small', allow: ['t_small'] },
    { target: '#btn-step', text: '点<b>「下一轮」</b>,看看会发生什么。', wait: 'round', allowSel: ['#btn-step'] },
    { target: '#btn-step', text: '你们十个人站到了操场上。再点一次<b>「下一轮」</b>。', wait: 'round', allowSel: ['#btn-step'] },
    { target: '#stage', text: '十个人<b>全被带走了</b>。其他同学看在眼里——更不敢动了。<br>人太少的时候,每个站出来的人都会被抓。<b>这就是沉默的原因</b>:不是没人不满,而是没人愿意当那少数几个。' },
    { target: '#ro-tip', text: '看"临界点":大约需要<b>二十多个人同时</b>站出来。低于它,行动会被吸回沉默;超过它,教导主任抓不过来,每个人被抓的机会变小,更多人会加入——<b>连锁反应</b>。' },
    { target: '#btn-step', text: '「全年级串联」能带出二十五个人,但要三点组织力。<b>点「下一轮」</b>,把组织力攒满。', wait: 'ap:3', allowSel: ['#btn-step'] },
    { target: '[data-card="t_big"]', text: '组织力够了。打出<b>「全年级串联」</b>。', wait: 'play:t_big', allow: ['t_big'] },
    { target: '.speed', text: '这次按 <b>▶</b>,让时间走起来,看着吧。', wait: 'speed', allowSel: ['.speed'] },
  ];
  const COACH = {
    liwang: [
      { target: '#policies', text: '这一关你是君主。右上是你的<b>常设政策</b>:执法多重、卫士多少、抓谁、言路开闭、囹圄松紧。<b>越强硬,上街越可怕——但每轮都要花钱维持。</b>' },
      { target: '#ro-mood', text: '这是下面报上来的"民间情绪"。注意<b>可信度</b>:你越凶,下面的人越不敢说真话,报上来的就越平静。' },
      { target: '#cards', text: '这些是你能做的事。「卫巫监谤」能让你<b>暂时听到真话</b>,还能看见每家每户心里的怨气(红色)。' },
      { target: '#stage', text: '国人一聚集,你就可以增派卫士、加重刑罚——可每一次越界的处罚,都会被人记住。<b>按 ▶ 开始。</b>' },
    ],
    petrograd: [{ target: '#ro-army', text: '注意<b>驻军</b>。街上的人越多,士兵越动摇;士兵一动摇,能抓人的就少了,街上又会更安全——两层反馈会互相放大。「劝说士兵」要在人多的时候打。' }],
    iran: [{ target: '#cards', text: '每一次镇压之后,大约<b>六周</b>会迎来一次"四十日"悼念。记忆在那时最强——那也是你出手的最好时机。' }],
    poland: [{ target: '#res', text: '戒严的所有手段都开着:军队进城、按名单拘押、封锁新闻……<b>它们非常贵</b>。入不敷出时,代价会转嫁给百姓,变成积怨。你得决定先放松哪一样。' }],
    beijing: [{ target: '#ro-army', text: '这一关,<b>人再多也不够</b>。百万人上街并没有改变结局——决定结局的,是那些开进城的士兵会不会开枪。' }],
    leipzig: [{ target: '#cards', text: '每周一的<b>「和平祈祷」免费</b>。教会圈里的人彼此信任,一个人出来能带出另一个。' }],
    baizhi: [{ target: '#cards', text: '你手里有一张只能用一次的牌:<b>「桥上的横幅」</b>。它不会让很多人上街,却会让很多人<b>记住</b>。' }],
    pyongyang: [
      { target: '#ro-exposure', text: '在这里,<b>别上街</b>。你的每一次行动都会增加暴露风险;到顶,你的网络会被一网打尽。' },
      { target: '#ro-tip', text: '你的目标是这一行:让"临界点"从"看不到转机"变成一个<b>真实存在、而且不太高</b>的数字。' },
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
      if (G) G.allowCards = null;
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
      if (G) renderCards();
      reposition();
      if (waiting) setTimeout(() => {   // 卡牌重绘后重新标记
        (st.allow || []).forEach((id) => document.querySelectorAll(`[data-card="${id}"]`).forEach((e) => e.classList.add('coach-allow')));
        reposition();
      }, 30);
      if (st.wait && st.wait.startsWith('ap:') && G && G.me.ap >= +st.wait.slice(3)) setTimeout(next, 200);
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
    return {
      start, end, notify, reposition,
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
