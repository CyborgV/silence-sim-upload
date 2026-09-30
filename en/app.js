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

  const sideLabel = (s) => (s === 'regime' ? "🏛 Play the regime" : "📣 Play the movement");
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
    const starItems = [L.starText ? L.starText[0] : "Goal reached"].concat((L.stars || []).map((s) => s.text));
    $('briefBody').innerHTML = `
      <div class="head"><div class="ico">${L.icon}</div><div>
        <div class="ch">${L.chapter} · ${L.era}</div><h2>${L.title}</h2><div class="era">${L.place}</div></div></div>
      <div class="role"><span class="side ${L.side}">${sideLabel(L.side)}</span> <span class="era">You are: ${L.role}</span></div>
      ${(L.intro || []).map((p) => `<p>${p}</p>`).join('')}
      ${L.quote ? `<div class="quote">${L.quote}</div>` : ''}
      <div class="goalbox"><h4>Goal</h4><div class="goal">${L.goalText}</div>
        ${L.id !== 'tutorial' ? `<h4 style="margin-top:12px">Stars</h4><ul>${starItems.map((t) => `<li>★ ${t}</li>`).join('')}</ul>` : ''}</div>
      ${L.tips && L.tips.length ? `<div class="goalbox"><h4>Tips</h4><ul>${L.tips.map((t) => `<li>${t}</li>`).join('')}</ul></div>` : ''}
      <div class="actions">
        <button class="btn primary" id="brief-start">Start ▶</button>
        ${L.id === 'tutorial' ? '<button class="btn" id="brief-guide">💡 Start with guide</button>' : ''}
        ${L.id !== 'tutorial' ? `<span class="era">Difficulty</span><div class="seg-sm" id="brief-diff">
          <button data-v="easy" class="${diff === 'easy' ? 'on' : ''}">Easy</button>
          <button data-v="normal" class="${diff === 'normal' ? 'on' : ''}">Normal</button>
          <button data-v="hard" class="${diff === 'hard' ? 'on' : ''}">Hard</button></div>` : ''}
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
  let endShown = false, prevWords = {}, resumeIn = 0;
  // 每一轮的真实时长(毫秒)。时间默认一直在走; 只有弹窗/面板/引导打开时停下, 关掉后稍等片刻再继续
  const ROUND_MS = [Infinity, 3400, 1800, 850], RESUME_MS = 450;

  function startLevel(L, opts) {
    curLevel = L; curOpts = opts || {};
    G = new Game(L, { diff: curOpts.diff || 'normal' });
    endShown = false; prevWords = {}; resumeIn = 900;
    show('game');
    $('g-chapter').textContent = L.chapter + ' · ';
    $('g-title').textContent = L.title;
    $('cards-title').innerHTML = G.side === 'regime' ? "Actions <span class=\"tag\">one-off · cooldowns</span>" : "Tactics <span class=\"tag\">one-off · cooldowns</span>";
    $('meters').classList.toggle('solo', !!L.noAI);
    Bub.clear(); $('headline').innerHTML = ''; $('banner').innerHTML = ''; $('ov-tree').classList.remove('show');
    if (!city) city = new window.SilenceCity($('city'));
    requestAnimationFrame(() => { city.setGame(G); city.resize(); });
    setSpeed(lastSpeed || 1);
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
    b.title = G.L.id === 'tutorial' ? "The Duke of Shao walks you through it step by step (if the level is already underway, it restarts)" : "Tutorial guide: the Duke of Shao explains this level’s screen and key points";
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
    const held = !G || !!G.popup || !!G.over || Coach.blocking() || anyOverlay();
    if (held) resumeIn = Math.max(resumeIn, RESUME_MS);
    else if (resumeIn > 0) resumeIn -= dt;
    const live = !held && resumeIn <= 0 && speed > 0;
    if (live) {
      acc += dt;
      if (acc >= ROUND_MS[speed]) { acc = 0; doStep(); }
    }
    Bub.tick(dt, live);
    if (G) $('g-timefill').style.width = (100 * Math.min(1, (G.round + (speed > 0 ? acc / ROUND_MS[speed] : 0)) / G.maxRound)).toFixed(2) + '%';
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
    if (G.side === 'regime' && G.x - x0 > 0.04) toast("⚠ A large crowd has suddenly gathered in the streets!", 'crowd');
    renderAll();
    Coach.notify('round');
    if (G.popup) showEvent();
    if (G.over) setTimeout(showEnd, 1100);
  }

  /* ---------- 特效与新闻 ---------- */
  function processFx() {
    if (!G) return;
    const fx = G.fx.splice(0);
    const slogans = (G.L.slogans || []).filter(Boolean);
    for (const f of fx) {
      if (f.type === 'crackdown') { city.flash('#ff2a1a', 900); city.shake(); $('stage').classList.remove('shake'); void $('stage').offsetWidth; $('stage').classList.add('shake'); if (G.side === 'movement') toast("💥 The regime strikes", 'opp'); }
      else if (f.type === 'raid') { city.flash('#ff4030', 500); }
      else if (f.type === 'defect') { city.flash('#57c28a', 500); }
      else if (f.type === 'reveal') { city.flash('#b392f0', 600); }
      else if (f.type === 'card' && f.side !== G.side) {
        const nm = G.card(f.id).name;
        toast(`${G.side === 'movement' ? 'Regime' : 'Opposition'}: ${CARDS[f.id].icon} ${nm}`, 'opp');
      }
      else if (f.type === 'news' && ['crowd', 'army'].includes(f.kind)) toast(f.text, f.kind === 'army' ? 'good' : 'crowd');
      else if (f.type === 'headline') headline(f.text, f.kind);
      else if (f.type === 'bubble') Bub.add(f.b);
      else if (f.type === 'seeds') city.say(`+~${fmtCount(f.n * G.scale)} people`, '#9fe0b5');
      else if (f.type === 'ignite') { banner("Chain reaction!", "More and more people are joining", 'ignite'); city.flash('#ffb347', 700); }
      else if (f.type === 'nearmiss') banner("So close", "The crowd melted away — a few more people, and it might have been different", 'miss');
      else if (f.type === 'stage') {
        if (f.up) { banner(`Regime: ${STAGES[f.stage].name}`, STAGES[f.stage].tip, 'stage'); city.flash('#ff3b2f', 500); }
        else toast(`The regime stands down to “${STAGES[f.stage].name}”`, 'good');
      }
      else if (f.type === 'push') { banner("The opposition moves!", "A mass action — whether you can hold it down depends on a tipping point you cannot see", 'stage'); }
      else if (f.type === 'buy') toast(`Built: ${f.name}`, 'crowd');
      else if (f.type === 'report') toast('📋 ' + (f.text.length > 64 ? f.text.slice(0, 62) + '…' : f.text), 'report');
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
      el.dataset.tip = `<b>${b.name}</b> · click to collect +${b.amt}<div class="tt-tags">${BUBBLES[b.kind].tip}</div>`;
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
    renderGoal(); renderMeters(); renderBuild(); renderReadouts(); renderEffects(); renderRes(); renderTreeBtn(); renderPolicies(); renderCards(); renderNews();
    renderAdvice(); drawTrend($('trend'), false); renderLayerBtn();
    if ($('ov-analysis').classList.contains('show')) renderAnalysis();
    $('pausetag').classList.toggle('hidden', speed > 0 || !!G.over);
  }

  /* ================= 看清自己的策略: 趋势、走势图、参谋、暗流 ================= */
  // 最近 lag 轮的变化; goodIfUp: 上升对玩家有利(true) / 不利(false) / 说不上(null)
  const delta = (arr, lag) => { lag = lag || 2; const n = arr.length; return n > lag ? arr[n - 1] - arr[n - 1 - lag] : 0; };
  // words: true = "上升/下降"; 也可以传 [上升时的词, 下降时的词]
  function arrow(dv, eps, goodIfUp, words) {
    if (Math.abs(dv) < eps) return words ? "<span class=\"trend flat\">→ steady</span>" : '';
    const up = dv > 0, good = goodIfUp == null ? null : up === goodIfUp;
    const w = !words ? '' : Array.isArray(words) ? ' ' + words[up ? 0 : 1] : (up ? " rising" : " falling");
    return `<span class="trend ${good == null ? '' : good ? 'good' : 'bad'}">${up ? '↑' : '↓'}${w}</span>`;
  }
  const MOV = () => G.side === 'movement';

  function renderAdvice() {
    const d = G.diagnose();
    const lv = (v) => (v >= 0.8 ? "Huge" : v >= 0.55 ? "High" : v >= 0.3 ? "Mid" : v > 0.05 ? "Low" : '—');
    const hand = G.hand().map((c) => c.id);
    const sugg = (d.top && d.top.v > 0.05 ? d.top.cards : []).filter((id) => hand.includes(id)).map((id) => G.card(id));
    $('advice').innerHTML = `<div class="advice ${d.side}">
      <div class="ah"><span>🧭 Advisor · ${d.title}</span><button class="lnk" id="adv-more">Details ›</button></div>
      ${d.head ? `<div class="ahd ${d.head.kind}">${d.head.text}</div>` : ''}
      ${d.factors.slice(0, 3).map((f) => `<div class="af"><span class="an">${f.name}</span><span class="abar"><i style="width:${Math.max(3, f.v * 100).toFixed(0)}%"></i></span><span class="alv">${lv(f.v)}</span></div>`).join('')}
      ${d.top && d.top.v > 0.05 ? `<div class="at">${d.top.advice}</div>` : ''}
      ${sugg.length ? `<div class="ac"><span>Suggested:</span>${sugg.map((c) => `<button class="chip" data-play="${c.id}" data-tip="${esc('<b>' + c.icon + ' ' + c.name + '</b><br>' + c.text)}">${c.icon} ${c.name}</button>`).join('')}</div>` : ''}
    </div>`;
    $('advice').querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => playCard(b.dataset.play)));
    $('adv-more').addEventListener('click', openAnalysis);
  }

  /* 走势图: 上半 = 街上的人 vs 估计的临界点(人口比例, 平方根刻度); 下半(大图) = 积怨、军心、警觉、暗流。全部是你的所见所闻。 */
  const moodW = (v) => (v < 0.1 ? "Calm" : v < 0.3 ? "Holding it in" : v < 0.55 ? "Aggrieved" : v < 0.8 ? "Seething" : "Explosive");
  const armyW = (v) => (v < 0.05 ? "Obedient" : v < 0.15 ? "Grumbling in private" : v < 0.35 ? "Restless" : v < 0.6 ? "Openly defiant" : "Defecting en masse");
  function drawTrend(cv, big, hoverI) {
    if (!cv || !G) return;
    const dpr = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth, H = cv.clientHeight;
    if (!w || !H) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const h = G.hist, n = h.x.length, total = big ? Math.max(G.maxRound + 1, n) : Math.max(n + 3, 14);   // 小图只看走过的路
    const L = G.L, sp = L.tipSpread != null ? L.tipSpread : 0.3, mov = MOV();
    const pl = big ? 46 : 4, pr = big ? 14 : 4;
    const X = (i) => pl + (w - pl - pr) * (total <= 1 ? 0 : i / (total - 1));
    ctx.clearRect(0, 0, w, H);
    ctx.fillStyle = '#0e131a'; ctx.fillRect(0, 0, w, H);
    const P1 = big ? { y0: 10, y1: H * 0.56 } : { y0: 4, y1: H - 9 };
    const Ys = (v) => P1.y1 - (P1.y1 - P1.y0) * Math.sqrt(clamp(v, 0, 1));
    ctx.font = '10px sans-serif';
    // 网格
    for (const g of [0.01, 0.1, 0.25, 0.5]) {
      const y = Ys(g); ctx.strokeStyle = '#1d2530'; ctx.beginPath(); ctx.moveTo(pl, y); ctx.lineTo(w - pr, y); ctx.stroke();
      if (big) { ctx.fillStyle = '#6d7885'; ctx.fillText(g * 100 + '%', 6, y + 3); }
    }
    // 现在
    if (n > 0) { ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(X(n - 1), P1.y0, w - pr - X(n - 1), (big ? H - 22 : P1.y1) - P1.y0); }
    // 目标线
    if (mov && L.goal && L.goal.x != null) { ctx.strokeStyle = 'rgba(240,180,76,.35)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pl, Ys(L.goal.x)); ctx.lineTo(w - pr, Ys(L.goal.x)); ctx.stroke(); ctx.setLineDash([]); }
    // 临界点(估计)
    if (mov) {
      ctx.fillStyle = 'rgba(179,146,240,.22)';
      for (let i = 0; i < n; i++) {
        const t = h.tipSeen[i]; if (t >= 1) { ctx.fillStyle = 'rgba(179,146,240,.08)'; ctx.fillRect(X(i) - 1, P1.y0, Math.max(2, X(1) - X(0)), 6); ctx.fillStyle = 'rgba(179,146,240,.22)'; continue; }
        const x0 = X(Math.max(0, i - 0.5)), x1 = X(Math.min(total - 1, i + 0.5));
        ctx.fillRect(x0, Ys(t * (1 + sp)), x1 - x0, Ys(t * (1 - sp)) - Ys(t * (1 + sp)));
      }
    }
    ctx.lineWidth = 1.6; ctx.strokeStyle = '#b392f0'; ctx.setLineDash(mov ? [] : [4, 3]); ctx.beginPath();
    let on = false;
    for (let i = 0; i < n; i++) { const t = h.tipSeen[i]; if (t >= 1) { on = false; continue; } on ? ctx.lineTo(X(i), Ys(t)) : ctx.moveTo(X(i), Ys(t)); on = true; }
    ctx.stroke(); ctx.setLineDash([]);
    // 街上的人
    ctx.beginPath(); ctx.moveTo(X(0), P1.y1);
    for (let i = 0; i < n; i++) ctx.lineTo(X(i), Ys(h.x[i]));
    ctx.lineTo(X(Math.max(0, n - 1)), P1.y1); ctx.closePath();
    ctx.fillStyle = 'rgba(255,207,112,.28)'; ctx.fill();
    ctx.strokeStyle = '#ffcf70'; ctx.lineWidth = 1.8; ctx.beginPath();
    for (let i = 0; i < n; i++) i ? ctx.lineTo(X(i), Ys(h.x[i])) : ctx.moveTo(X(i), Ys(h.x[i]));
    ctx.stroke();
    // 出手标记: 你(琥珀, 下) / 对手(红, 上)
    for (const a of G.actions) {
      const x = X(Math.min(total - 1, a.round + 0.5)), mine = a.side === G.side;
      ctx.fillStyle = mine ? '#f0b44c' : '#e5534b';
      ctx.beginPath();
      if (mine) { ctx.moveTo(x, P1.y1 - 7); ctx.lineTo(x - 3.5, P1.y1); ctx.lineTo(x + 3.5, P1.y1); }
      else { ctx.moveTo(x, P1.y0 + 6); ctx.lineTo(x - 3, P1.y0); ctx.lineTo(x + 3, P1.y0); }
      ctx.fill();
    }
    if (big) {
      const P2 = { y0: H * 0.64, y1: H - 22 };
      const Y2 = (v) => P2.y1 - (P2.y1 - P2.y0) * clamp(v, 0, 1);
      for (const g of [0, 0.5, 1]) { ctx.strokeStyle = '#1d2530'; ctx.beginPath(); ctx.moveTo(pl, Y2(g)); ctx.lineTo(w - pr, Y2(g)); ctx.stroke(); }
      ctx.fillStyle = '#6d7885'; ctx.fillText("High", 6, Y2(1) + 4); ctx.fillText("Low", 6, Y2(0));
      const line = (arr, col, dash, f) => {
        ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.setLineDash(dash || []); ctx.beginPath();
        for (let i = 0; i < n; i++) { const v = f(arr[i]); i ? ctx.lineTo(X(i), Y2(v)) : ctx.moveTo(X(i), Y2(v)); }
        ctx.stroke(); ctx.setLineDash([]);
      };
      line(h.moodSeen, '#ef6a5e', [5, 3], (v) => v / 1.1);
      line(h.dSeen, '#57c28a', [5, 3], (v) => v / 0.7);
      line(h.uc, '#ff8a65', [], (v) => v / 0.5);
      if (mov && h.vigor) line(h.vigor, '#f0b44c', [2, 3], (v) => v);
      if (mov) { if (!L.noAI) line(h.alert, '#8f99a6', [], (v) => v / 100); }
      else line(h.orgSeen, '#8f99a6', [], (v) => v / 100);
      ctx.fillStyle = '#6d7885'; ctx.fillText(G.dateLabel(0), pl, H - 6);
      ctx.textAlign = 'right'; ctx.fillText(G.dateLabel(total - 1), w - pr, H - 6); ctx.textAlign = 'left';
    }
    if (hoverI != null && hoverI < n) { ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(hoverI), 4); ctx.lineTo(X(hoverI), H - (big ? 20 : 4)); ctx.stroke(); }
    cv._X = X; cv._total = total;
    if (!big) $('trend-legend').innerHTML = `<span><i style="background:#ffcf70"></i>${(L.labels && L.labels.crowd) || 'On the streets'}</span><span><i style="background:#b392f0"></i>${mov ? 'Tipping point (est.)' : 'Situation (reported)'}</span><span class="tri a">▲</span>You <span class="tri o">▼</span>Opponent`;
  }

  function openAnalysis() { if (!G) return; $('ov-analysis').classList.add('show'); renderAnalysis(); }
  function closeAnalysis() { $('ov-analysis').classList.remove('show'); }
  $('ov-analysis').addEventListener('click', (e) => { if (e.target === $('ov-analysis')) closeAnalysis(); });
  $('trendbox').addEventListener('click', openAnalysis);
  function renderAnalysis() {
    const d = G.diagnose(), mov = MOV(), lab = G.L.labels || {};
    const lv = (v) => (v >= 0.8 ? "Huge" : v >= 0.55 ? "High" : v >= 0.3 ? "Mid" : v > 0.05 ? "Low" : '—');
    const reps = G.news.filter((q) => q.kind === 'report').slice(0, 6);
    $('an-box').innerHTML = `<div class="an-head"><h3>Situation analysis <small>${G.dateLabel()}</small></h3><button class="icon-btn" id="an-close" title="Close (Esc)">✕</button></div>
      <div class="an-chart"><canvas id="an-cv"></canvas><div class="an-tip" id="an-tip"></div></div>
      <div class="legend">
        <span><i style="background:#ffcf70"></i>${lab.crowd || 'On the streets'}</span>
        <span><i style="background:#b392f0"></i>${mov ? 'Tipping point (est. range)' : 'Your tipping-point estimate (reported)'}</span>
        <span style="color:#f0b44c">▲ Your moves</span><span style="color:#e5534b">▼ Opponent moves</span>
        <span style="color:#ef6a5e"><i class="dash"></i>Grievance (${mov ? 'rumor' : 'reported'})</span>
        <span style="color:#57c28a"><i class="dash"></i>${lab.army || 'Security forces'} shaken (${mov ? 'rumor' : 'actual'})</span>
        <span><i style="background:#ff8a65"></i>Undercurrent</span>${mov ? '<span style="color:#f0b44c"><i class="dash"></i>Organizational strength</span>' : ''}
        <span><i style="background:#8f99a6"></i>${mov ? 'Regime alert' : 'Opposition organization (reported)'}</span>
      </div>
      <div class="an-note">Top: share of the population (square-root scale: 1% · 10% · 25% · 50%). Bottom: read only the direction, not the height. <b>Hover over the chart</b> to see what happened that round.</div>
      <div class="an-cols">
        <div class="an-diag"><h4>🧭 Advisor · ${d.title}</h4>
          ${d.head ? `<div class="ahd ${d.head.kind}">${d.head.text}</div>` : ''}
          ${d.factors.map((f) => `<div class="af"><span class="an">${f.name}</span><span class="abar"><i style="width:${Math.max(3, f.v * 100).toFixed(0)}%"></i></span><span class="alv">${lv(f.v)}</span></div>`).join('')}
          ${d.factors.slice(0, 2).filter((f) => f.v > 0.05).map((f) => `<p class="at"><b>${f.name}:</b> ${f.advice}</p>`).join('')}
          <p class="an-fine">${mov ? 'The advisor’s judgments come from a simple thought experiment: of equal “one-step” changes — arrest capacity down 30%, penalties a quarter lighter, grievance one notch higher, news spreading a quarter further — which one lowers the tipping point the most? It only ranks them; it gives no numbers.' : 'Like your intelligence, these judgments rest on reports from below: the harsher the enforcement, the more they report only good news.'}</p>
        </div>
        <div class="an-reps"><h4>📋 Recent reports</h4>${reps.length ? reps.map((q) => `<div class="rp"><span class="d">${q.date}</span>${q.text}</div>`).join('') : '<div class="rp dim">Two rounds after you play a card or change a policy, this will tell you what happened.</div>'}</div>
      </div>`;
    $('an-close').addEventListener('click', closeAnalysis);
    const cv = $('an-cv');
    requestAnimationFrame(() => drawTrend(cv, true));
    cv.addEventListener('mousemove', (e) => {
      const r = cv.getBoundingClientRect(), X = cv._X; if (!X) return;
      const n = G.hist.x.length, total = cv._total;
      const i = clamp(Math.round(((e.clientX - r.left) - X(0)) / ((X(total - 1) - X(0)) / (total - 1))), 0, n - 1);
      drawTrend(cv, true, i);
      const h = G.hist, cnt = (v) => fmtCount(Math.max(0, v) * G.N * G.scale);
      const sp = G.L.tipSpread != null ? G.L.tipSpread : 0.3;
      const acts = G.actions.filter((a) => a.round === i).map((a) => `<span class="${a.side === G.side ? 'me' : 'op'}">${a.id.includes(':') ? polLabel(a.id) : (CARDS[a.id] ? CARDS[a.id].icon + ' ' + G.card(a.id).name : a.id)}</span>`);
      const news = G.news.filter((q) => q.round === i && !['mine', 'report'].includes(q.kind)).slice(0, 3).map((q) => q.text);
      const tip = h.tipSeen[i];
      $('an-tip').innerHTML = `<b>${G.dateLabel(i)}</b><br>${lab.crowd || 'On the streets'}: ~${cnt(h.x[i])} people · ${mov ? (tip >= 1 ? 'no turning point in sight' : `tipping point ~${cnt(tip * (1 - sp))}–${cnt(tip * (1 + sp))} people`) : ''}
        <br>Grievance (${mov ? 'rumor' : 'reported'}): ${moodW(h.moodSeen[i])} · ${lab.army || 'Security forces'}: ${armyW(h.dSeen[i])}
        ${acts.length ? `<div class="acts">${acts.join(' ')}</div>` : ''}${news.length ? `<div class="nws">${news.join('<br>')}</div>` : ''}`;
      const tx = clamp(e.clientX - r.left + 14, 0, r.width - 260);
      $('an-tip').style.left = tx + 'px'; $('an-tip').classList.add('show');
    });
    cv.addEventListener('mouseleave', () => { $('an-tip').classList.remove('show'); drawTrend(cv, true); });
  }
  const polLabel = (aid) => { const [k, v] = aid.split(':'); return POLICIES[k] ? `${POLICIES[k].icon} ${polTitle(k)}→${polName(k, v)}` : aid; };

  /* 暗流图层开关 */
  if (SAVE.layer == null) SAVE.layer = true;
  function renderLayerBtn() {
    const b = $('layer-btn'); if (!G) return;
    const on = !!SAVE.layer;
    const dv = delta(G.hist.uc, 2);
    b.classList.toggle('on', on);
    b.innerHTML = on ? `<b>🌊 Undercurrent</b><span class="lg"><i class="c1"></i>wavering <i class="c2"></i>ready</span>${arrow(dv, 0.006, MOV(), ['growing', 'shrinking'])}` : "<b>🌊 Undercurrent</b> <span class=\"lg\">off</span>";
    if (city) city.layerOn = on;
  }
  $('layer-btn').addEventListener('click', () => { SAVE.layer = !SAVE.layer; persist(); renderLayerBtn(); });

  function renderGoal() {
    const L = G.L, g = L.goal || {};
    let prog = 0, sub = '';
    const left = G.maxRound - G.round;
    if (G.side === 'regime') {
      prog = G.round / G.maxRound;
      sub = `Rounds to hold out: ${left}`;
      if (G.streak.x > 0 || G.streak.d > 0) sub = `<span style="color:var(--red2)">⚠ Losing control (${Math.max(G.streak.x, G.streak.d)}/${g.hold || 3})</span> · ` + sub;
    } else if (L.id === 'pyongyang') {
      const r = G.readout();
      prog = r.tip.kind === 'none' ? 0.03 : clamp((1 - r.tip.shownFrac) / (1 - 0.2), 0, 1);
      sub = `Estimated · months left: ${left}`;
      if (G.streak.tip > 0) sub = `<span style="color:var(--green)">Cracks are showing (${G.streak.tip}/3)</span> · ` + sub;
    } else {
      const px = g.x != null ? G.x / g.x : 0;
      const dShown = G.d + (G.side === 'movement' ? G.intelNoise.army : 0);
      const pd = g.d != null ? clamp(dShown, 0, 1) / g.d : 0;
      prog = clamp(Math.max(px, pd), 0, 1);
      sub = `Rounds left: ${left}`;
      const st = Math.max(G.streak.x, G.streak.d);
      if (st > 0) sub = `<span style="color:var(--green)">Held ${st}/${g.hold || 3} rounds!</span> · ` + sub;
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
      if (t.kind === 'none') tipTxt = "No opening in sight";
      else if (t.kind === 'tinder') { lo = hi = 0; tipTxt = "Tinderbox"; }
      else { lo = t.est * (1 - sp); hi = t.est * (1 + sp); tipTxt = `~${cnt(lo)}–${cnt(hi)} people`; }
      let max = Math.max(0.04, (hi || 0) * 1.3, (x + cap) * 1.15, x * 1.1);
      if (lo == null) max = Math.max(max, 0.12);
      max = Math.min(1, max);
      const P = (v) => pct(v / max);
      const ready = lo != null && cap > 0 && L.id !== 'pyongyang' && x + cap >= lo;
      const band = lo != null ? `<div class="band" style="left:${P(lo)};width:${pct(Math.max(0.008, (hi - lo) / max))}"></div>` : '<div class="band" style="left:calc(100% - 10px);width:10px"></div>';
      const crowdTxt = x * G.N * G.scale < 1 ? "nobody" : "~" + cnt(x) + " people";
      const armyGoal = L.goal && L.goal.d != null && L.goal.x == null;
      if (armyGoal) {
        const dS = clamp(G.d + G.intelNoise.army, 0, 1), gd = L.goal.d;
        main = `<div class="mh" data-tip="${esc('To win this level, the enforcers must defect. The more people on the streets, and the more they talk to the soldiers, the more the soldiers waver; when the regime rotates units, their morale resets.')}"><b>🪖 ${lab.army || 'Security forces'} defecting</b><span class="mv">${r.army.words} (rumor) · ${lab.crowd || 'On the streets'}: ${crowdTxt}</span></div>
          <div class="mbar"><div class="fill" style="width:${pct(dS / (gd * 1.25))}"></div><div class="band" style="left:${pct(gd / (gd * 1.25))};width:1%"></div></div>
          <div class="ms">${G.streak.d > 0 ? `<span class="go">Held ${G.streak.d}/${L.goal.dHold || L.goal.hold || 2} rounds!</span>` : `Purple line = goal: defection en masse · the bigger the crowd, the more soldiers waver`}</div>`;
      } else if (L.id === 'pyongyang') {
        main = `<div class="mh" data-tip="${esc('How many people must stand up at once for things to change. Your goal: bring it down from “no turning point in sight” to about one person in five.')}"><b>🔥 Create a tipping point</b><span class="mv">Needed: ${tipTxt} · goal: under ~${cnt(0.2)}</span></div>
          <div class="mbar"><div class="fill" style="width:${lo == null ? '2%' : pct(clamp((1 - t.est) / 0.8, 0, 1))}"></div></div>
          <div class="ms">${G.streak.tip > 0 ? `<span class="go">Cracks are showing (${G.streak.tip}/3)</span>` : 'Stay off the streets: here, open action is suicide'}</div>`;
      } else {
        main = `<div class="mh" data-tip="${esc('Yellow: people standing up right now. Hatched: how many more your organizing power can bring out in one push. Purple box: the tipping point — roughly how many must stand up at once before the risk is spread thin and a cascade can start (an estimate).')}"><b>🔥 Tipping point</b><span class="mv">${lab.crowd || 'On the streets'}: ${crowdTxt} · needed: ${tipTxt}${t.kind === 'est' ? ' ' + arrow(delta(G.hist.tipSeen), 0.004, false, ['going up', 'going down']) : ''}</span></div>
          <div class="mbar"><div class="fill" style="width:${P(x)}"></div><div class="ghost" style="left:${P(x)};width:${P(cap)}"></div>${band}</div>
          <div class="ms">${ready ? '<span class="go">Enough! Go all out now — it may set off a chain reaction</span>' : cap > 0 ? `Your organizing power can bring out ~${cnt(cap)} people in one push` : 'Not enough organizing power to act — collect bubbles, or wait'}</div>`;
      }
      if (L.id === 'pyongyang') {
        const e = G.exposure;
        opp = `<div class="mh"><b>🕵️ Exposure risk</b><span class="mv">${e < 25 ? 'Low' : e < 50 ? 'Medium' : e < 75 ? 'High' : 'Critical'}</span></div>
          <div class="mbar danger"><div class="fill" style="width:${pct(e / 100)}"></div></div>
          <div class="ms">${e >= 60 ? '<span class="warn">Group 109 could come knocking any day</span>' : 'Max it out and all is lost · “Cover tracks” lowers it'}</div>`;
      } else if (!L.noAI) {
        const a = G.alert, s = G.stage(), nx = s < 3 ? STAGES[s + 1] : null;
        opp = `<div class="mh" data-tip="${esc('How alert the regime is. People on the streets, sudden jumps in numbers, and every move and build of yours push it up; it slowly falls back when things are quiet. At 25 / 50 / 75 the regime escalates, one stage at a time.')}"><b>🚨 Regime alert</b><span class="stage-pill st${s}">${STAGES[s].name}</span></div>
          <div class="mbar danger"><div class="fill" style="width:${pct(a / 100)}"></div><div class="tick" style="left:25%"></div><div class="tick" style="left:50%"></div><div class="tick" style="left:75%"></div></div>
          <div class="ms">${nx ? `At ${(s + 1) * 25}: ${nx.name} (${nx.tip})` : '<span class="warn">Total repression reached</span>'}</div>`;
      }
    } else {
      const left = G.maxRound - G.round;
      main = `<div class="mh"><b>🏛 ${L.id === 'liwang' ? 'The throne' : 'Hold out'}</b><span class="mv">${left} rounds left · Situation (reported): ${r.tip.words}</span></div>
        <div class="mbar time"><div class="fill" style="width:${pct(G.round / G.maxRound)}"></div></div>
        <div class="ms">${G.streak.x > 0 || G.streak.d > 0 ? `<span class="warn">⚠ Losing control (${Math.max(G.streak.x, G.streak.d)}/${(L.goal || {}).hold || 3})</span>` : 'Hold out to the end to win — stars depend on grievance and how many you arrest'}</div>`;
      const o = G.orgShown();
      opp = `<div class="mh" data-tip="${esc('The opposition is organizing in secret. The deeper the grievance and the busier the streets, the faster it rises; when it fills up, they launch a major action. Arresting organizers or conceding in talks keeps it down. Note: the harsher you are, the lower this number is reported.')}"><b>✊ Opposition organization</b><span class="mv">Reported · ${o >= 75 ? 'Imminent' : o >= 45 ? 'Networking' : 'Scattered'}</span></div>
        <div class="mbar org"><div class="fill" style="width:${pct(o / 100)}"></div></div>
        <div class="ms">${o >= 75 ? '<span class="warn">A major action could come at any moment!</span>' : 'When it fills up, they launch a major action'}</div>`;
    }
    $('m-main').innerHTML = main; $('m-opp').innerHTML = opp;
  }
  function renderBuild() {
    const lv = G.buildLevels(), keys = Object.keys(lv);
    if (!keys.length) { $('build').innerHTML = ''; return; }
    $('build').innerHTML = `<div class="sec-t">${G.side === 'regime' ? 'Your machine' : 'Your organization'} <span class="tag">permanent builds</span></div><div class="build ${G.side}">` + keys.map((k) => {
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
    btn.innerHTML = `<span>${G.side === 'regime' ? '🏛 Regime building' : '🧬 Movement building'} <small>(B)</small></span>${n ? `<span class="cnt">${n} available</span>` : '<span class="era">Not enough points</span>'}`;
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
    let h = `<div class="th"><h3>${G.side === 'regime' ? '🏛 Regime building' : '🧬 Movement building'}</h3><span class="pts">${cur()} <b>${Math.floor(G.me.ap)}</b></span><button class="btn" id="tree-close">Close</button></div>
      <div class="era" style="margin-top:4px">Builds are permanent. ${G.side === 'movement' ? 'Each one makes the regime more alert — grow quietly first, or make some noise first?' : ''}</div><div class="tcols">`;
    for (const b of T) {
      h += `<div class="tcol"><h4>${b.icon} ${b.name}</h4><div class="td">${b.desc}</div>`;
      for (const n of b.nodes) {
        const st = G.nodeState(n);
        if (treeSel === n.id) sel = { n, st };
        const cls = st.have ? 'have' : st.ok ? 'ok' : !st.reqOk ? 'locked' : '';
        h += `<button class="tnode ${cls} ${treeSel === n.id ? 'sel' : ''}" data-node="${n.id}"><div class="tn"><span>${n.name}</span><span class="tc">${st.have ? '✓ Built' : cur() + ' ' + n.cost}</span></div><div class="tt">${n.tags.join(' · ')}</div></button>`;
      }
      h += '</div>';
    }
    h += '</div>';
    if (sel) {
      const { n, st } = sel;
      const reqNames = (n.req || []).map((id) => { for (const b of T) for (const q of b.nodes) if (q.id === id) return q.name; return null; }).filter(Boolean);
      h += `<div class="tdetail"><div class="tx"><b>${n.name}</b><br>${n.text}<div class="tags">${n.tags.join(' · ')}</div>
        ${G.side === 'movement' && n.alert ? `<div class="warn">Regime alert +${n.alert}</div>` : ''}
        ${!st.reqOk && reqNames.length ? `<div class="warn">Requires: ${reqNames.join(n.reqAny ? ' or ' : ' and ')}</div>` : ''}</div>
        <button class="btn primary" id="tree-buy" ${st.ok ? '' : 'disabled'}>${st.have ? 'Built' : `Build · ${cur()} ${n.cost}`}</button></div>`;
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
    const h = G.hist, mv = MOV();
    rows.push({ id: 'risk', i: '⚠️', l: "Standing up now", v: r.risk.words, s: "If caught: " + r.pen.words, lv: r.risk.level, max: 4, tr: arrow(delta(h.risk), 0.04, !mv) });
    rows.push({ id: 'legit', i: '⚖️', l: "Enforcement seen as", v: r.legit.words, s: r.legit.level ? "Punishment over the line is remembered" : '', lv: r.legit.level, max: 3, tr: arrow(delta(h.over), 0.05, mv ? null : false) });
    rows.push({ id: 'army', i: '🪖', l: lab.army || "Security forces", tag: r.army.rumor ? "rumor" : '', v: r.army.words, lv: r.army.level, max: 4, tr: arrow(delta(h.dSeen), 0.02, mv) });
    rows.push({ id: 'mood', i: '💢', l: "Public mood", tag: G.side === 'regime' ? "Credibility: " + r.mood.conf.split(':')[0] : "rumor", v: r.mood.words,
      s: G.side === 'regime' && r.mood.bias >= 0.15 ? r.mood.conf.split(':')[1] || '' : '', lv: r.mood.level, max: 4, tr: arrow(delta(h.moodSeen), 0.03, mv) });
    $('readouts').innerHTML = rows.map((o) => {
      const changed = prevWords[o.id] != null && prevWords[o.id] !== o.v;
      return `<div class="ro ${changed ? 'flash' : ''}" id="ro-${o.id}" data-tip="${esc(RO_TIPS[o.id] || '')}">
        <div class="i">${o.i}</div><div class="l"><span>${o.l}</span>${o.tag ? `<span class="tag">${o.tag}</span>` : ''}</div>
        <div class="v ${o.lv != null ? 'lv' + Math.min(5, Math.round((o.lv / (o.max || 4)) * 4)) : ''}">${o.v}${o.tr ? ' ' + o.tr : ''}</div>
        ${o.s ? `<div class="s">${o.s}</div>` : ''}
        ${o.lv != null ? `<div class="dots">${dots(o.lv, o.max)}</div>` : ''}</div>`;
    }).join('');
    for (const o of rows) prevWords[o.id] = o.v;
    $('intel-tag').textContent = G.side === 'regime' ? "Reports from below" : "What you see and hear";
    // 对手态势
    if (G.side === 'movement' && !L.noAI) {
      const nm = (k) => polName(k, G.pol[k]);
      $('opp-stance').innerHTML = `<div class="opp-stance">Regime stance:<br>Enforcement <b>${nm('enforce')}</b> · Police <b>${nm('police')}</b><br>Targets <b>${nm('target')}</b> · Media <b>${nm('info')}</b></div>`;
    } else $('opp-stance').innerHTML = '';
  }
  const RO_TIPS = {
    crowd: "People openly standing up right now. Each bright dot is a group of people.",
    risk: "How likely you are to be arrested if you stand up now. The regime can only arrest so many people each round: the more people there are, the smaller each one’s chance of being caught.",
    legit: "Whether people see the current punishments as legitimate. Once they go over the line people accept, every punishment is remembered by those watching (grievance) and unsettles the enforcers.",
    army: "Whether those carrying out orders are still willing to. They are watching too: how many people are on the streets, what their comrades are doing, whether the orders go too far.",
    mood: "How much resentment people are holding in. It does not show on the streets, but it quietly lowers the tipping point. The harsher the regime, the more its intelligence reports only good news.",
    tip: "How many people must stand up at once to set off a chain reaction. This is an estimate, not an exact value.",
    exposure: "The risk that your network is discovered. Every action raises it; “Cover tracks” lowers it. If it maxes out, all is lost.",
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  function renderEffects() {
    $('effects').innerHTML = G.effects.map((e) => `<span class="chip ${e.side === G.side ? 'mine' : 'opp'}">${e.icon} ${e.name} · ${e.rounds}</span>`).join('');
  }

  function renderRes() {
    const st = G.me, cap = G.apCap;
    const inc = G.income(G.side);
    const raw = G.side === 'regime' ? G.regimeRawIncome() : inc;
    const nm = G.side === 'regime' ? "Political capital" : "Organizing power";
    let incText = G.side === 'regime' && raw < 0 ? "<span style=\"color:var(--red2)\">In the red! The cost is falling on the people</span>" : `+${inc.toFixed(1)} per round · plus bubbles to collect`;
    if (G.side === 'movement' && G.L.id !== 'tutorial') {
      const v = G.vigor, dv = delta(G.hist.vigor || [], 2);
      incText += `<div class="vig ${v < 0.6 ? 'bad' : v < 0.85 ? 'mid' : ''}" data-tip="${esc('Organizational strength: when the crowd fails to cross the tipping point and the people you brought out are arrested, most of those taken are your core members — every later action brings out fewer people. It slowly recovers when things go quiet.')}">Organizational strength ${Math.round(v * 100)}% ${arrow(dv, 0.01, true)}</div>`;
    }
    const frac = clamp(st.ap - Math.floor(st.ap), 0, 1);
    $('res').className = 'res ' + G.side;
    $('res').innerHTML = `<div><div class="nm">${nm}</div><div class="inc">${incText}</div></div><div class="big">${cur()} ${Math.floor(st.ap)}<span class="frac"><i style="width:${(frac * 100).toFixed(0)}%"></i></span></div>`;
    $('res').dataset.tip = G.side === 'regime' ? "Political capital: spent on playing cards, switching to harsher policies, and building. Harsh policies cost upkeep every round; the bigger the crowds and the shakier the troops, the lower your income. Collect it by clicking “Stability” and “Intelligence” bubbles in the city." : "Organizing power: spent on playing cards and building. It recovers a little each round, faster the more people are on the streets. Collect it by clicking the bubbles that pop up in the city.";
  }

  const polName = (k, id) => {
    const o = POLICIES[k].options.find((x) => x.id === id);
    const ov = G.L.policyNames && G.L.policyNames[k] && G.L.policyNames[k].options && G.L.policyNames[k].options[id];
    return ov || (o ? o.name : id);
  };
  const polTitle = (k) => (G.L.policyNames && G.L.policyNames[k] && G.L.policyNames[k].name) || POLICIES[k].name;
  const upWords = (u) => (u >= 0.5 ? "Very high" : u >= 0.25 ? "High" : u >= 0.1 ? "Medium" : u > 0 ? "Low" : u < 0 ? "Saves money" : "None");

  function renderPolicies() {
    const box = $('policies');
    if (G.side !== 'regime') { box.innerHTML = ''; return; }
    let h = "<div class=\"sec-t\">Policies <span class=\"tag\">standing · harsher costs more</span></div>";
    for (const k of POLICY_KEYS) {
      const P = POLICIES[k];
      const lock = G.locks[k] && G.locks[k].until > G.round ? G.locks[k] : null;
      const cd = G.polCd[k] || 0;
      h += `<div class="policy" id="pol-${k}"><div class="ph"><span data-tip="${esc(P.desc)}">${P.icon} ${polTitle(k)}</span><span class="lock">${lock ? '🔒 ' + (lock.reason || '') : cd > 0 ? '⏳ ' + cd : ''}</span></div><div class="seg">`;
      for (const o of P.options) {
        const ps = G.policyState(k, o.id);
        const na = !ps.allowed || ps.needNet;
        const tip = `<b>${polName(k, o.id)}</b>${o.short ? ' · ' + o.short : ''}<div class="tt-tags">Upkeep: ${upWords(o.upkeep || 0)}${o.cost ? ` · switching costs ${o.cost}` : ''}</div>${na ? '<div class="tt-warn">Not available in this level</div>' : ''}`;
        h += `<button class="${ps.cur ? 'on' : ''} ${na ? 'na' : ''}" data-pol="${k}" data-opt="${o.id}" ${ps.ok ? '' : 'disabled'} data-tip="${esc(tip)}">${polName(k, o.id)}${o.cost && !ps.cur ? '<span class="c">●</span>' : ''}</button>`;
      }
      h += '</div></div>';
    }
    h += "<div class=\"hint-line\">The harsher the policy, the scarier the streets, but the more it costs to keep up; once you go over the line people accept, grievance and unrest in the ranks follow.</div>";
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
      if (free) cost = "<span class=\"free\">Free</span>"; else cost = `<span class="num">${cur()} ${cs.cost}</span>`;
      const warn = !cs.cond ? (c.whenText || "Conditions not met") : cs.cd > 0 ? `Cooldown: ${cs.cd} rounds left` : G.me.ap < cs.cost ? "Not enough resources" : '';
      const tip = `<b>${c.icon} ${c.name}</b><br>${c.text}<div class="tt-tags">${(c.tags || []).join(' · ')}${c.cd ? ` · cooldown ${c.cd} rounds` : ''}${c.once ? ' · one use only' : ''}</div>${warn ? `<div class="tt-warn">${warn}</div>` : ''}`;
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
    const K = { opp: G.side === 'movement' ? "Regime" : "Opponent", crowd: "On the streets", mine: "You", army: (G.L.labels && G.L.labels.army && G.L.labels.army.length <= 3) ? G.L.labels.army : "Security forces", event: "Event", intel: "Intelligence", arrest: "Arrests", calm: "Calm", report: "Report", info: "Word" };
    $('news').innerHTML = G.news.slice(0, 50).map((n) => `<div class="n ${n.kind} ${n.round >= G.round ? 'now' : ''}"><span class="d">${n.date}</span><span class="k">${K[n.kind] || 'News'}</span><span class="t">${n.text}</span></div>`).join('');
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
      <div class="kick">${L.chapter} · ${L.title} · ${o.win ? 'Victory' : 'Defeat'}</div>
      <h3 class="res-t">${o.title}</h3>
      ${o.win && L.id !== 'tutorial' ? `<div class="big-stars">${starsHtml(o.starCount, 3)}</div>` : ''}
      ${o.win && o.stars.length > 1 ? `<ul class="star-list">${o.stars.map((s) => `<li class="${s.ok ? 'ok' : ''}">${s.ok ? '★' : '☆'} ${s.text}</li>`).join('')}</ul>` : ''}
      <div class="tabpane" style="text-align:center">${o.text}</div>
      <div class="stat-row">
        <div class="stat"><div class="k">${lab.crowd || 'On the streets'} at peak</div><div class="v">${st.peakCrowd} people</div></div>
        <div class="stat"><div class="k">Taken away in total</div><div class="v">${st.detained} people</div></div>
        <div class="stat"><div class="k">${lab.army || 'Security forces'} at their shakiest</div><div class="v">${st.peakArmy}</div></div>
        <div class="stat"><div class="k">Grievance at the end</div><div class="v">${st.moodEnd}</div></div>
      </div>
      <div class="tabs"><button class="on" data-tab="replay">Debrief · The truth revealed</button>${L.history ? '<button data-tab="hist">History</button>' : ''}${L.lesson ? '<button data-tab="lesson">The model</button>' : ''}</div>
      <div class="tabpane" id="tab-replay">
        <canvas id="debrief"></canvas>
        <div class="legend">
          <span><i style="background:#ffcf70"></i>People on the streets</span>
          <span><i style="background:#57c28a"></i>Enforcers refusing orders</span>
          <span><i style="background:#ef6a5e"></i>True grievance</span>
          <span style="color:#ef6a5e"><i class="dash" style="color:#ef6a5e"></i>Grievance as you saw it</span>
          <span><i style="background:#b392f0"></i>True tipping point</span>
          <span style="color:#b392f0"><i class="dash" style="color:#b392f0"></i>Your estimated tipping point</span>
        </div>
        <div class="reveal-note">${insight()}</div>
      </div>
      ${L.history ? `<div class="tabpane hidden" id="tab-hist"><h4>What happened in history</h4>${L.history}</div>` : ''}
      ${L.lesson ? `<div class="tabpane hidden" id="tab-lesson"><h4>${L.lesson.title}</h4>${L.lesson.text}<p style="color:var(--dim);font-size:13px;margin-top:12px">Want to tune every parameter yourself? Go to the <a href="lab.html">Model Lab</a>.</p></div>` : ''}
      <div class="actions">
        <button class="btn" id="end-retry">Try again</button>
        ${next && L.id !== 'skirmish' ? `<button class="btn primary" id="end-next">Next level: ${next.title} →</button>` : ''}
        <button class="btn ghost" id="end-levels">${L.id === 'skirmish' ? 'Back to title' : 'Back to levels'}</button>
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
    const W = (v) => (v < 0.1 ? "Calm" : v < 0.3 ? "Holding it in" : v < 0.55 ? "Aggrieved" : v < 0.8 ? "Seething" : "Explosive");
    const lines = [];
    let gap = 0, gi = 0;
    for (let i = 0; i < n; i++) if (h.mood[i] - h.moodSeen[i] > gap) { gap = h.mood[i] - h.moodSeen[i]; gi = i; }
    if (G.side === 'regime' && gap > 0.2) lines.push(`Around ${G.dateLabel(gi)}, the public mood reported from below was “${W(h.moodSeen[gi])}”, but in fact it was already “${W(h.mood[gi])}”. The harsher the enforcement, the less the people below dare to tell the truth.`);
    const quiet = h.x.slice(0, Math.max(1, n - 1)).every((v) => v < 0.03);
    const t0 = h.tip[0], tMin = Math.min(...h.tip);
    if (quiet && t0 - tMin > 0.08) lines.push("All game long the streets stayed almost completely quiet, yet the tipping point kept falling — <b>the silence gave no warning at all</b>.");
    const peakMood = Math.max(...h.mood);
    if (peakMood > 0.55 && G.side === 'movement') lines.push("At one point grievance ran as high as “" + W(peakMood) + "”. It does not show on the streets, but it keeps pushing the tipping point down.");
    if (!lines.length) lines.push("Solid lines are what really happened; dashed lines are what you saw (or estimated) at the time. The gap between them is this level’s “fog”.");
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
  $('g-menu').addEventListener('click', () => $('ov-menu').classList.add('show'));
  $('mm-resume').addEventListener('click', () => $('ov-menu').classList.remove('show'));
  $('mm-restart').addEventListener('click', () => { $('ov-menu').classList.remove('show'); startLevel(curLevel, curOpts); });
  $('mm-help').addEventListener('click', () => { $('ov-menu').classList.remove('show'); $('ov-help').classList.add('show'); });
  const autoLabel = () => { $('mm-auto').textContent = "Auto-collect bubbles (half value): " + (SAVE.autoCollect ? "On" : "Off"); };
  autoLabel();
  $('mm-auto').addEventListener('click', () => { SAVE.autoCollect = !SAVE.autoCollect; persist(); autoLabel(); });
  $('mm-levels').addEventListener('click', () => { $('ov-menu').classList.remove('show'); show('levels'); });
  $('mm-title').addEventListener('click', () => { $('ov-menu').classList.remove('show'); show('title'); });
  $('g-help').addEventListener('click', () => $('ov-help').classList.add('show'));
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
    if (anyOverlay()) { if (e.key === 'Escape' || (e.key === 'b' && $('ov-tree').classList.contains('show')) || ((e.key === 'a' || e.key === 'A') && $('ov-analysis').classList.contains('show'))) { $('ov-menu').classList.remove('show'); $('ov-help').classList.remove('show'); closeTree(); closeAnalysis(); } return; }
    if (Coach.active && e.key === 'Escape') { Coach.end(); return; }
    if (Coach.locked()) return;
    if (e.key === ' ') { e.preventDefault(); setSpeed(speed > 0 ? 0 : lastSpeed || 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); $('btn-step').click(); }
    else if (e.key === 'Escape') { $('g-menu').click(); }
    else if (/^[1-9]$/.test(e.key)) { const c = G.hand()[+e.key - 1]; if (c) playCard(c.id); }
    else if (e.key === 'b' || e.key === 'B') openTree();
    else if (e.key === 'a' || e.key === 'A') openAnalysis();
    else if (e.key === 'l' || e.key === 'L') $('layer-btn').click();
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
  window.addEventListener('resize', () => { if (city && current === 'game') { city.resize(); drawTrend($('trend'), false); } Coach.reposition(); });
  window.addEventListener('scroll', () => Coach.reposition(true), { passive: true });

  /* ================= 新手引导 ================= */
  // wait: 'click'(按继续) | 'play:ID' | 'round' | 'ap:N' | 'speed' | 'policy:KEY'
  const TUTORIAL = [
    { target: '#stage', text: "Monday’s flag-raising ceremony. A thousand students <b>stand on the sports ground by class</b>; each small dot is one student.<br>Anyone who stands up to object <b>steps out of line and walks to the front of the podium</b>; anyone whose name is called is taken to the <b>dean’s office</b> at top left (turns red). The blue squares on the stage and in the aisles are teachers." },
    { target: '#ro-risk', text: "Look at “Standing up now”. The dean can <b>deal with at most twenty people</b> a minute. Right now no one is standing up — whoever goes first is sure to be called out." },
    { target: '#m-main', text: "The bar at the very top is the key. <b>Yellow</b> is the people standing up; the <b>purple frame</b> is the “tipping point”: roughly how many must stand up at once before the risk is spread thin and a chain reaction begins." },
    { target: '#res', text: "This is your <b>organizing power</b>. Playing cards and building both cost it; it recovers a little every minute." },
    { target: '[data-card="t_small"]', text: "Try it first: play <b>“Ten step out”</b> — you and the nine classmates you are closest to.", wait: 'play:t_small', allow: ['t_small'] },
    { target: '#btn-step', text: "Click <b>“Next round”</b> and see what happens.", wait: 'round', allowSel: ['#btn-step'] },
    { target: '.bubble', text: "The ten of you walked to the front, and a <b>“Morale” bubble</b> popped up on the sports ground. Click it to collect organizing power.<br>(Bubbles pop up whenever the situation changes. Don’t let them vanish.)", wait: 'collect', allowSel: ['.bubble'] },
    { target: '#btn-step', text: "Click <b>“Next round”</b> again.", wait: 'round', allowSel: ['#btn-step'] },
    { target: '#stage', text: "All ten <b>were called out and taken away</b>. The other students saw it — and now they dare even less.<br>When too few stand up, every one of them gets caught. <b>That is why there is silence</b>: not because no one is unhappy, but because no one wants to be one of the few." },
    { target: '#tree-btn', text: "<b>“Movement building”</b> on the right gives permanent upgrades, like adding skills to your organization. Open it.", wait: 'tree-open', allowSel: ['#tree-btn'] },
    { target: '[data-node="m_net"]', text: "Build <b>“Contact network”</b>: from then on, every action brings out 25% more people. Click it.", wait: 'tree:m_net', allow: ['tree:m_net'] },
    { target: '#btn-step', text: "“Rally the grade” costs 3 organizing power. <b>Click “Next round”</b> to save up for it.", wait: 'ap:3', allowSel: ['#btn-step'] },
    { target: '[data-card="t_big"]', text: "Look at the top bar: the hatching has passed the purple frame — that’s enough. Play <b>“Rally the grade”</b>.", wait: 'play:t_big', allow: ['t_big'] },
    { target: '.speed', text: "This time press <b>▶</b> to let time run, and watch.", wait: 'speed', allowSel: ['.speed'] },
  ];
  const SYS = {
    movement: [
      { target: '#m-main', text: "The bar at top left matters most: <b>yellow</b> is the people standing up, the <b>hatching</b> is how many more your organizing power can bring out in one go, and the <b>purple frame</b> is the tipping point.<br><b>When yellow plus hatching passes the purple frame, it’s time to go all in.</b>" },
      { target: '#m-opp', text: "On the right is <b>Regime alert</b>. Every gathering on the streets and every move you make pushes it up; at 25 / 50 / 75 the regime escalates to Alert, Crackdown, then Total repression. It slowly falls back when things are quiet." },
      { target: '#tree-btn', text: "<b>Movement building</b>: permanent upgrades along three paths — Spread, Memory, Resilience. They too raise Regime alert — grow quietly first, or make some noise first? (Hotkey B)" },
      { target: '#stage', text: "When the situation changes, <b>bubbles</b> pop up in the city: anger, morale, sympathy, word. <b>Click to collect</b> — they are your main source of organizing power. Every few rounds, a <b>sudden event</b> will force you to choose." },
    ],
    regime: [
      { target: '#m-main', text: "On the left is how long you still have to hold out. Last to the end and you win — but your stars depend on how deep the grievance runs and how many people you arrest." },
      { target: '#m-opp', text: "On the right is <b>Opposition organization</b> (reported). When it fills up, the other side launches a major action. The deeper the grievance, the faster it rises; arresting organizers or conceding in talks keeps it down. <b>Note: the harsher you are, the lower this number is reported.</b>" },
      { target: '#tree-btn', text: "<b>Regime building</b>: permanent upgrades along three paths — Iron fist, Dragnet, Hearts and minds. (Hotkey B)" },
      { target: '#stage', text: "Quiet days produce <b>“Stability”</b> bubbles; arrests produce <b>“Intelligence”</b> bubbles. Click them to collect political capital." },
    ],
  };
  const COACH = {
    liwang: [
      { target: '#policies', text: "In this level you are the king. On the right are your <b>standing policies</b>: how heavy the punishment, how many guards, whom to seize, whether the paths of speech are open or shut, how tight the prisons. <b>The harsher they are, the scarier the streets — but they cost money to keep up every round.</b>" },
      { target: '#ro-mood', text: "This is the “public mood” as reported from below. Watch its <b>credibility</b>: the harsher you are, the less people below dare to tell the truth, and the calmer the reports sound." },
      { target: '#cards', text: "“Shaman of Wei” lets you <b>hear the truth for a while</b>, and see the resentment in every household (red)." },
    ],
    petrograd: [{ target: '#ro-army', text: "Watch the <b>garrison</b>. The more people on the streets, the more the soldiers waver; once they waver, fewer are left to make arrests, and the streets get safer still — the two feedback loops amplify each other. Play “Win over troops” when the crowds are big." }],
    qingming: [
      { target: '#layer-btn', text: "The grief suppressed in January is hidden in people’s hearts. Open the <b>“Undercurrent”</b> at top right: orange are those “wavering”, red are those “ready to move”. On Qingming (April 4), it will break the surface." },
      { target: '#cards', text: "“Slogans on trains” can bring the suppressed grief to the surface early — but it alerts the regime early too. When to strike is up to you." },
    ],
    seoul: [
      { target: '#g-date', text: "Before June each round is a week; from June on, each round is a day. <b>Save your organizing power for June.</b>" },
      { target: '#cards', text: "Park Jong-chul’s death is being covered up. “Expose the truth” can bring the grief and anger to the surface; historically, priests made the truth public on May 18. “Myeongdong sit-in” and “Necktie brigade” appear only once history reaches that point." },
    ],
    bucharest: [
      { target: '#ro-mood', text: "Your intelligence is almost worthless: the harsher the Securitate, the less people below dare to tell the truth. <b>“Intelligence distorted”</b> in the “Advisor” panel on the left is warning you about exactly this." },
      { target: '#policies', text: "Every hard-line policy is switched on, and belts are being tightened to pay off the foreign debt — the cost of running in the red turns into invisible grievance. Every choice in the pop-ups ahead matters." },
    ],
    iran: [{ target: '#cards', text: "After every crackdown, about <b>six weeks</b> later comes a “fortieth-day” mourning. Memory is strongest then — and that is your best moment to act." }],
    poland: [{ target: '#res', text: "Every tool of martial law is switched on: troops in the cities, detention by list, a news blackout… <b>They are very expensive</b>. When you run in the red, the cost falls on the people and turns into grievance. You must decide which to ease first." }],
    beijing: [{ target: '#ro-army', text: "In this level, <b>no crowd is ever big enough</b>. A million people on the streets did not change the outcome — what decided it was whether the soldiers entering the city would open fire." }],
    leipzig: [{ target: '#cards', text: "Every Monday the <b>“Peace prayers” are free</b>. People in church circles trust each other; one who comes out brings out another." }],
    baizhi: [{ target: '#cards', text: "You hold a card you can play only once: <b>“Bridge banner”</b>. It won’t bring many people onto the streets, but it will make many people <b>remember</b>." }],
    pyongyang: [
      { target: '#m-opp', text: "Here, <b>stay off the streets</b>. Every action you take raises your exposure risk; if it maxes out, your whole network is rolled up." },
      { target: '#m-main', text: "Your goal is this bar: turn the “tipping point” from “no turning point in sight” into a number that is <b>real, and not too high</b>." },
    ],
  };

  const Coach = (() => {
    const layer = $('coach-layer'), hole = $('coach-hole'), box = $('coach'), blocker = $('coach-blocker');
    let steps = [], i = 0, opts = {}, active = false;
    function start(s, o) { steps = s; opts = o || {}; i = 0; active = true; layer.classList.add('show'); showStep(); }   // 引导打开期间时间自动停住(见 blocking)
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
      $('coach-wait').textContent = waiting ? "👉 Your turn" : '';
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
      if (st.wait === 'speed' && speed > 0) setTimeout(next, 1200);   // 时间本来就在走
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
