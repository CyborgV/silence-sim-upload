/* ============================================================
 * 道路以目 · 游戏引擎
 * 把 model.js 的方程包装成"政策 / 对策 / 事件 / 战争迷雾"。
 * 玩家看不到 P、K₀、P̄ 这些参数——只看到政策选项、街头人数、
 * 带偏差的情报和传闻。真实数值只在关卡结束后的"复盘"里揭晓。
 * 纯逻辑, 浏览器与 node 通用(node: require('./engine.js'))。
 * ============================================================ */
(function (global) {
  'use strict';
  const SS = global.SilenceSim || (typeof require === 'function' ? require('./model.js') : null);
  const { Sim, mulberry32 } = SS;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ---------- 数字的"人话"表达 ---------- */
  const EN = (typeof window !== 'undefined' ? window : globalThis).SILENCE_LANG === 'en';
  function fmtCount(n) {
    n = Math.max(0, n);
    if (n < 1) return '0';
    if (n < 20) return String(Math.round(n));
    if (EN) {
      const r2 = (v) => (v < 10 ? v.toFixed(1).replace(/\.0$/, '') : String(Math.round(v)));
      if (n < 1e3) { const p = Math.pow(10, Math.floor(Math.log10(n)) - 1); return String(Math.round(n / p) * p); }
      if (n < 1e6) return r2(n / 1e3) + 'k';
      return r2(n / 1e6) + 'M';
    }
    if (n < 1e4) {
      const p = Math.pow(10, Math.floor(Math.log10(n)) - 1);
      return String(Math.round(n / p) * p);
    }
    const w = n / 1e4;
    return (w < 10 ? w.toFixed(1).replace(/\.0$/, '') : String(Math.round(w))) + "×10⁴";
  }
  const band = (v, cuts, words) => { let i = 0; while (i < cuts.length && v >= cuts[i]) i++; return { level: i, words: words[i] }; };

  /* ============================================================
   * 政策: 常设立场(朝廷一方)。每个选项对应模型参数的一个倍率。
   * ============================================================ */
  const POLICIES = {
    enforce: {
      name: "Enforcement", icon: '⚖️',
      desc: "What happens to those you catch. The harsher it is, the more frightening the streets become; but once it goes beyond the line people accept, every punishment is remembered, and the enforcers grow uneasy.",
      options: [
        { id: 'lenient', name: "Lenient", short: "Mostly warnings", P: 0.7, upkeep: 0 },
        { id: 'normal', name: "Routine", short: "Detention by law", P: 1.0, upkeep: 0 },
        { id: 'harsh', name: "Harsh", short: "Heavy sentences, made public", P: 1.3, upkeep: 0.1, cost: 1 },
        { id: 'terror', name: "Draconian", short: "Executions, families punished", P: 1.7, upkeep: 0.2, cost: 1 },
      ],
    },
    police: {
      name: "Police", icon: '🚓',
      desc: "How many people you can arrest each round. With more manpower, scattered protesters can't get away; with limited manpower, the bigger the crowd, the thinner each person's chance of arrest.",
      options: [
        { id: 'lean', name: "Lean", short: "Saves money", K: 0.6, upkeep: -0.15 },
        { id: 'normal', name: "Routine", short: "Everyday policing", K: 1.0, upkeep: 0 },
        { id: 'surge', name: "Reinforce", short: "Police from other regions", K: 1.7, upkeep: 0.3, cost: 1 },
        { id: 'martial', name: "Martial law", short: "Troops enter the city", K: 3.0, upkeep: 0.6, cost: 2 },
      ],
    },
    target: {
      name: "Arrest targets", icon: '🎯',
      desc: "Whom to arrest. Targeting organizers cuts the links between people; preventive detention by list takes those most likely to step forward before they ever reach the streets — but the longer the list, the higher the cost.",
      options: [
        { id: 'uniform', name: "Arrest anyone", short: "Whoever gets caught on the street", mode: 'uniform', upkeep: 0 },
        { id: 'organizer', name: "Target organizers", short: "Cut the links", mode: 'organizer', upkeep: 0.1, needNet: true },
        { id: 'preventive', name: "Preventive detention", short: "Arrest from a list, in advance", mode: 'preventive', upkeep: 0.3, cost: 1 },
      ],
    },
    info: {
      name: "Media", icon: '📺',
      desc: "How much people can see. A blackout makes people underestimate how many others are taking part, and hides the repression — but suppressed memory doesn't vanish; once exposed, it comes due twice over. A blackout also blinds you.",
      options: [
        { id: 'open', name: "Honest reporting", short: "Everyone can see", gs: 1.0, vis: 1.0, upkeep: 0 },
        { id: 'spin', name: "Downplay", short: "Make it look small", gs: 0.72, vis: 0.65, upkeep: 0.05 },
        { id: 'blackout', name: "Total blackout", short: "Internet cut, speech banned", gs: 0.42, vis: 0.35, upkeep: 0.25, cost: 1 },
      ],
    },
    release: {
      name: "Detention", icon: '🔓',
      desc: "How long the arrested are held. Releasing them sends them back to the streets (with their memories); holding them costs money and makes families and neighbors bitter.",
      options: [
        { id: 'long', name: "Hold them long", short: "Long-term custody", rel: 0.02, upkeep: 0.1 },
        { id: 'normal', name: "Release by law", short: "Out when time is served", rel: 0.08, upkeep: 0 },
        { id: 'lenient', name: "Leniency", short: "Lecture and release", rel: 0.25, upkeep: -0.05 },
      ],
    },
  };
  const POLICY_KEYS = ['enforce', 'police', 'target', 'info', 'release'];

  /* ============================================================
   * 卡牌: 一次性行动。tags 只给方向, 不给数字。
   * ============================================================ */
  const addEdges = (g, n) => {
    const s = g.sim; if (!s.net) return;
    const N = s.o.N;
    for (let t = 0; t < n; t++) {
      const a = (s.rng() * N) | 0, b = (s.rng() * N) | 0;
      if (a !== b) { s.net[a].push(b); s.net[b].push(a); }
    }
  };
  const cutEdges = (g, frac) => {
    const s = g.sim; if (!s.net) return;
    for (let i = 0; i < s.net.length; i++) {
      const L = s.net[i];
      for (let q = L.length - 1; q >= 0; q--) if (s.rng() < frac) { L[q] = L[L.length - 1]; L.pop(); }
    }
  };
  const scalePsi = (g, frac, mul) => {
    const s = g.sim;
    for (let j = 0; j < s.psi.length; j++) if (s.rng() < frac) s.psi[j] *= mul;
  };
  const griefAll = (g, amt, frac) => {
    const s = g.sim; frac = frac == null ? 1 : frac;
    for (let i = 0; i < s.o.N; i++) if (!s.r[i] && (frac >= 1 || s.rng() < frac)) s.addGrievance(i, amt);
    s.tauDirty = true;
  };
  const griefScale = (g, mul) => {
    const s = g.sim;
    for (let i = 0; i < s.o.N; i++) s.b[i] *= mul;
    if (s.Ehist) for (const E of s.Ehist) for (let i = 0; i < E.length; i++) E[i] *= mul;
    s.tauDirty = true;
  };

  const CARDS = {
    /* ---------------- 行动方 ---------------- */
    rally: {
      side: 'movement', name: "Small rally", icon: '✊', cost: 1, cd: 2,
      text: "Gather a small group to take a public stand. With so few of them, most will likely be arrested — but they may also be the spark.",
      tags: ["Turnout +small"], run(g) { g.addSeeds(0.015); },
    },
    march: {
      side: 'movement', name: "Mass march", icon: '🚩', cost: 2, cd: 4,
      text: "Agree on a time and place in advance, and take to the streets together. The more people, the smaller each one's chance of arrest.",
      tags: ["Turnout +medium"], run(g) { g.addSeeds(0.04); },
    },
    mobilize: {
      side: 'movement', name: "Mobilize", icon: '📞', cost: 2, cd: 5,
      text: "Seek out, one by one, the people who are “just one step away.” The hesitant are the easiest to move by those around them.",
      tags: ["Turnout +targeted", "Finds the wavering"], run(g) { g.addSeeds(0.03, 'near'); g.revealFor(2); },
    },
    strike: {
      side: 'movement', name: "General strike", icon: '🏭', cost: 3, cd: 10,
      text: "Factories stop, shops close, schools walk out. Lots of people — and it squeezes the other side's purse.",
      tags: ["Turnout +large", "Their resources −"], run(g) { g.addSeeds(0.08); g.hurtOpponent(4); },
    },
    samizdat: {
      side: 'movement', name: "Underground press", icon: '📰', cost: 1, cd: 4,
      text: "Hand-copied texts, leaflets, foreign broadcasts. Let people know: you are not the only one who thinks this way.",
      tags: ["Breaks the blackout", "Official line discredited"],
      run(g) {
        const fw = g._actor === 'opp' && g.flags.firewall ? 0.5 : 1;
        g.addEffect({ id: 'samizdat', name: "Underground press circulating", icon: '📰', side: 'movement', rounds: 4, mod(m) { m.gs = Math.min(1, m.gs + 0.25 * fw); m.noise *= 0.5; } });
        g.base.Pbar = Math.max(0.2, g.base.Pbar - 0.02);
      },
    },
    leak: {
      side: 'movement', name: "Expose the truth", icon: '📼', cost: 2, cd: 8,
      text: "Get the suppressed images out. What a blackout holds down is not memory, only memory made public.",
      tags: ["Suppressed anger → public", "Everyone sees"],
      run(g) {
        g.addEffect({ id: 'leak', name: "Truth exposed", icon: '📼', side: 'movement', rounds: 2, mod(m) { m.vis = Math.max(m.vis, 1); m.gs = 1; m.omega = Math.max(m.omega, 0.7); } });
        const v = g.sim.reveal(g._actor === 'opp' && g.flags.firewall ? 0.35 : 0.7);
        g.fx.push({ type: 'reveal', amt: v });
      },
    },
    memorial: {
      side: 'movement', name: "Memorial", icon: '🕯️', cost: 1, cd: 6,
      text: "Light a candle for the arrested and the dead. Mourning keeps “what happened” alive in people's hearts.",
      tags: ["Memory ↑", "Later punishments sting more"],
      run(g) {
        g.addEffect({ id: 'memorial', name: "Mourning", icon: '🕯️', side: 'movement', rounds: 5, mod(m) { m.vis = Math.min(1.6, m.vis * 1.6 + 0.1); } });
        griefAll(g, Math.min(0.06, 0.3 * g.sim.R + 0.006));
      },
    },
    fraternize: {
      side: 'movement', name: "Win over troops", icon: '🌷', cost: 2, cd: 6,
      text: "Bring the soldiers water and flowers, and talk to them: “You are the people's sons too.”",
      tags: ["Troop morale ↓"],
      run(g) {
        scalePsi(g, 0.3, 0.7);
        g.addEffect({ id: 'fraternize', name: "Soldiers and people talk", icon: '🌷', side: 'movement', rounds: 6, mod(m) { m.alpha += 0.12; } });
      },
    },
    network: {
      side: 'movement', name: "Build networks", icon: '🕸️', cost: 1, cd: 5, needNet: true,
      text: "Build trusted links between schools, factories and churches. Among people who know each other, one who steps forward can bring along another.",
      tags: ["Stronger peer influence"], run(g) { addEdges(g, Math.round(g.N * 0.35)); },
    },
    legal: {
      side: 'movement', name: "Free the detained", icon: '📜', cost: 1, cd: 6,
      text: "Lawyers, families, petitions. Get people back — and they come back with their memories.",
      tags: ["Detainees freed", "Manpower returns"],
      run(g) {
        const s = g.sim;
        for (let i = 0; i < s.o.N; i++) if (s.r[i] && s.rng() < 0.15) s.r[i] = 0;
        s.tauDirty = true;
        g.addEffect({ id: 'legal', name: "Rescue campaign", icon: '📜', side: 'movement', rounds: 6, mod(m) { m.rel += 0.12; } });
      },
    },
    hunger: {
      side: 'movement', name: "Hunger strike", icon: '🥣', cost: 2, cd: 14,
      text: "No eating, no leaving. The posture of the weakest, and the hardest to ignore.",
      tags: ["Sympathy ↑↑", "A few holdouts"],
      run(g) {
        g.addSeeds(0.006);
        const vis = g.sim.o.vis;
        griefAll(g, 0.035 * clamp(vis + 0.3, 0.3, 1.3));
      },
    },
    lowkey: {
      side: 'movement', name: "Disperse", icon: '🌫️', cost: 1, cd: 6,
      text: "Scatter, change places, leave no names. Harder for them to find you — but harder for others to see you, too.",
      tags: ["Arrest risk ↓", "Visibility ↓"],
      run(g) { g.addEffect({ id: 'lowkey', name: "Disperse", icon: '🌫️', side: 'movement', rounds: 3, mod(m) { m.K0 *= 0.78; m.gs *= 0.85; } }); },
    },

    /* ---- 关卡专属(行动方) ---- */
    blockade: {
      side: 'movement', name: "Stop the convoys", icon: '🚚', cost: 1, cd: 3, special: true,
      text: "Residents, old people and students pour into the intersections, surround the army trucks, bring the soldiers food and reason with them.",
      tags: ["Martial-law troops stalled", "Troop morale ↓"],
      when: (g) => g.pol.police === 'martial' || !!g.flags.martialLaw, whenText: "Only under martial law",
      run(g) {
        g.addEffect({ id: 'blockade', name: "Convoys blocked", icon: '🚚', side: 'movement', rounds: 2, mod(m) { m.K0 *= 0.55; m.alpha += 0.1; } });
        scalePsi(g, 0.2, 0.75);
      },
    },
    goddess: {
      side: 'movement', name: "Goddess of Democracy", icon: '🗽', cost: 2, cd: 99, once: true, special: true,
      text: "A foam statue the art-academy students built overnight, set up in the square, facing the gate tower.",
      tags: ["Morale ↑", "The world is watching"],
      run(g) {
        g.addSeeds(0.03);
        g.addEffect({ id: 'goddess', name: "The Goddess", icon: '🗽', side: 'movement', rounds: 3, mod(m) { m.vis = Math.max(m.vis, 1); m.gs = Math.max(m.gs, 0.8); } });
        griefAll(g, 0.015);
      },
    },
    prayer: {
      side: 'movement', name: "Peace prayers", icon: '⛪', cost: 1, cd: 2, special: true,
      text: "The Monday peace prayers at St. Nicholas Church. The church doors stand open, and those who come out walk into the streets. Free on Mondays.",
      tags: ["Turnout +targeted", "Free on Mondays"],
      costFn: (g) => (g.isMonday() ? 0 : 1),
      run(g) { g.addSeeds(g.isMonday() ? 0.022 : 0.01, 'near'); },
    },
    cassette: {
      side: 'movement', name: "Cassette sermons", icon: '📼', cost: 1, cd: 4, special: true,
      text: "The exile's sermons, recorded on cassettes and copied tape by tape between mosques and bazaars.",
      tags: ["Stronger peer influence", "Monarchy discredited"],
      run(g) { addEdges(g, Math.round(g.N * 0.2)); g.base.Pbar = Math.max(0.25, g.base.Pbar - 0.03); },
    },
    banner: {
      side: 'movement', name: "Bridge banner", icon: '🪧', cost: 1, cd: 99, once: true, special: true,
      text: "One man, one bridge, two banners, a plume of smoke. He will be taken away — but the photos will remain.",
      tags: ["One man", "The whole internet saw"],
      run(g) {
        g.addSeeds(1 / g.N);
        griefAll(g, 0.025);
        g.addEffect({ id: 'banner', name: "Banner photos spread", icon: '🪧', side: 'movement', rounds: 3, mod(m) { m.vis = Math.max(m.vis, 1); m.gs = Math.min(1, m.gs + 0.2); } });
      },
    },
    sanctuary: {
      side: 'movement', name: "Myeongdong sit-in", icon: '⛪', cost: 2, cd: 99, once: true, special: true,
      text: "The demonstrators retreat into Myeongdong Cathedral. The priests stand at the door: to take them, you will have to walk over us first.",
      tags: ["Turnout +small", "A stronghold they can't take", "Lasts 6 rounds"],
      run(g) {
        g.addSeeds(0.015);
        g.addEffect({ id: 'sanctuary', name: "Myeongdong sit-in", icon: '⛪', side: 'movement', rounds: 6, mod(m) { m.K0 *= 0.75; m.vis = Math.max(m.vis, 0.9); } });
      },
    },
    necktie: {
      side: 'movement', name: "Necktie brigade", icon: '👔', cost: 2, cd: 5, special: true,
      text: "At lunch hour, office workers in neckties walk out of their buildings, applaud from the sidewalks, throw rolls of toilet paper from the windows — and then join the march.",
      tags: ["Turnout +medium", "Middle class joins", "Enforcement more easily seen as over the line"],
      when: (g) => !!g.flags.necktie, whenText: "Not until June, when people are already on the streets",
      run(g) {
        g.addSeeds(0.03);
        g.base.Pbar = Math.max(0.3, g.base.Pbar - 0.03);
        // 中产的加入: 这不再只是学生的事——一部分人的承受上限整体上移
        const s = g.sim;
        for (let i = 0; i < s.o.N; i++) if (s.rng() < 0.25) s.tau[i] += 0.02;
        s.tauDirty = true;
      },
    },
    blankpaper: {
      side: 'movement', name: "Blank sheets", icon: '📄', cost: 2, cd: 4, special: true,
      text: "Nothing is written on the blank sheet — and everyone knows what it says. Hard to find a charge.",
      tags: ["Turnout +medium", "Arrest penalty ↓"],
      run(g) {
        g.addSeeds(0.035);
        g.addEffect({ id: 'blankpaper', name: "White paper", icon: '📄', side: 'movement', rounds: 2, mod(m) { m.P *= 0.65; } });
      },
    },
    usb: {
      side: 'movement', name: "K-dramas on USB", icon: '💾', cost: 1, cd: 2, special: true,
      text: "USB sticks and SD cards smuggled across the border. People glimpse another kind of everyday life — and slowly learn that the neighbors are secretly watching too.",
      tags: ["Official line discredited", "Others are watching too", "Exposure risk ↑"],
      run(g) {
        g.base.Pbar = Math.max(0.35, g.base.Pbar - 0.07);
        g.base.globalScale = Math.min(0.9, g.base.globalScale + 0.02);
        g.exposure += 9 * g.exposureMul;
        g.glowRandom(0.05);
      },
    },
    bribe: {
      side: 'movement', name: "Grease palms", icon: '💵', cost: 1, cd: 3, special: true,
      text: "A carton of cigarettes, a bag of rice, a few Chinese yuan. Enforcers have families to feed too; the market has put a price on loyalty.",
      tags: ["Enforcers soften", "Exposure risk ↑"],
      run(g) { for (let j = 0; j < g.sim.psi.length; j++) g.sim.psi[j] *= 0.94; g.exposure += 5 * g.exposureMul; },
    },
    market: {
      side: 'movement', name: "Market network", icon: '🧺', cost: 2, cd: 6, special: true,
      text: "Networks of acquaintances in the jangmadang (markets). When the rationing system collapsed, people survived through them — and passed word through them.",
      tags: ["Stronger peer influence", "Organizing power +", "Exposure risk ↑"],
      run(g) { addEdges(g, Math.round(g.N * 0.25)); g.bonusIncome += 0.12; g.exposure += 7 * g.exposureMul; },
    },
    hide: {
      side: 'movement', name: "Cover tracks", icon: '🔥', cost: 1, cd: 3, special: true,
      text: "Burn the lists, change the contacts, hide the USB sticks in cracks in the wall.",
      tags: ["Exposure risk ↓↓"], run(g) { g.exposure = Math.max(0, g.exposure - 28); },
    },

    /* ---- 教程 ---- */
    t_small: {
      side: 'movement', name: "Ten step out", icon: '🙋', cost: 1, cd: 0, special: true,
      text: "You and your nine closest classmates — ten of you — step out of line together and stand before the rostrum.",
      tags: ["Turnout +10"], run(g) { g.addSeeds(10 / g.N); },
    },
    t_big: {
      side: 'movement', name: "Rally the grade", icon: '📣', cost: 3, cd: 0, special: true,
      text: "The night before, you knocked on every dorm door and agreed: the moment you hear “weekend classes,” you all step out of line together. Twenty-five said yes.",
      tags: ["Turnout +25"], run(g) { g.addSeeds(25 / g.N); },
    },

    /* ---------------- 朝廷 ---------------- */
    informants: {
      side: 'regime', name: "Informant ring", icon: '👂', cost: 1, cd: 6,
      text: "Plant people in the crowd to hear what they say in private. For a few days you'll hear the truth — and the boldest talkers get arrested first.",
      tags: ["Accurate intelligence", "See public grievance", "Arrest the most committed first"],
      run(g) {
        g.addEffect({ id: 'informants', name: "Informants listening", icon: '👂', side: 'regime', rounds: 5, intel: true, mod(m) { if (m.targetMode === 'uniform') m.targetMode = 'zealot'; } });
        g.revealFor(5);
      },
    },
    editorial: {
      side: 'regime', name: "Editorial verdict", icon: '🗞️', cost: 1, cd: 8,
      text: "Pass verdict on it on the front page. The fearful will back off — the wrongly accused will remember.",
      tags: ["Protest risk ↑", "Some are enraged"],
      run(g) {
        g.addEffect({ id: 'editorial', name: "Editorial verdict", icon: '🗞️', side: 'regime', rounds: 6, mod(m) { m.P *= 1.2; } });
        griefAll(g, 0.045, 0.25);
      },
    },
    crackdown: {
      side: 'regime', name: "Open fire", icon: '💥', cost: 3, cd: 12,
      text: "Use force; clear the streets at any cost. The streets will empty — and everyone will hear the shots.",
      tags: ["Streets cleared fast", "Grievance ↑↑↑", "Troop morale ↓"],
      run(g) {
        g.addEffect({ id: 'crackdown', name: "Clearance", icon: '💥', side: 'regime', rounds: 2, mod(m) { m.P *= 2.2; m.K0 *= 2; m.vis = Math.max(m.vis, 0.85); } });
        g.flags.lastCrackdown = g.round;
        g.fx.push({ type: 'crackdown' });
      },
    },
    amnesty: {
      side: 'regime', name: "Amnesty", icon: '🕊️', cost: 2, cd: 12,
      text: "Release everyone in custody. Some resentment will fade, but they will return to the streets.",
      tags: ["All released", "Grievance ↓"],
      run(g) { g.sim.r.fill(0); g.sim.tauDirty = true; griefScale(g, 0.88); },
    },
    dialogue: {
      side: 'regime', name: "Dialogue", icon: '🤝', cost: 2, cd: 10,
      text: "“Those who govern the people let them speak.” Sit down and talk; grant some of the demands. Resentment will ease — and your opponents will think you soft.",
      tags: ["Grievance ↓↓", "The line people accept ↑", "Their morale ↑"],
      run(g) { g.base.Pbar += 0.08; griefScale(g, 0.72); g.hurtOpponent(-2); },
    },
    subsidy: {
      side: 'regime', name: "Subsidies", icon: '🍚', cost: 2, cd: 8,
      text: "Cut prices, hand out grain, raise wages. The calm you buy is real — it just doesn't last long.",
      tags: ["Grievance ↓"], run(g) { griefScale(g, 0.85); },
    },
    bonus: {
      side: 'regime', name: "Pay the troops", icon: '💰', cost: 2, cd: 8,
      text: "Bonuses, promotions and promises for the security forces. Make them feel it pays to stand with you.",
      tags: ["Troop morale ↑"],
      run(g) {
        const s = g.sim;
        for (let j = 0; j < s.psi.length; j++) s.psi[j] *= 1.25;
        for (let j = 0; j < s.z.length; j++) if (s.z[j] && s.rng() < 0.5) s.z[j] = 0;
      },
    },
    rotate: {
      side: 'regime', name: "Outside troops", icon: '🪖', cost: 3, cd: 15,
      text: "Swap in troops with no ties to the locals, who answer only to orders. They won't talk to the crowd.",
      tags: ["Troop morale reset", "Crowd influence ↓"],
      run(g) {
        const s = g.sim, sc = (g.base.psiScale || 1) * 1.3;
        for (let j = 0; j < s.psi.length; j++) s.psi[j] = s.rng() * sc;
        s.z.fill(0);
        g.addEffect({ id: 'rotate', name: "Outside troops", icon: '🪖', side: 'regime', rounds: 8, mod(m) { m.alpha *= 0.4; } });
      },
    },
    cutnet: {
      side: 'regime', name: "Cut comms", icon: '📵', cost: 2, cd: 10,
      text: "Cut the phones, the internet, the broadcasts. People hear only what you want them to hear.",
      tags: ["Can't see each other", "Suppressed memory ↑"],
      run(g) {
        g.addEffect({ id: 'cutnet', name: "Comms down", icon: '📵', side: 'regime', rounds: 4, mod(m) { m.omega = 1; m.gs *= 0.6; m.vis *= 0.6; } });
        cutEdges(g, g.flags.cutResist ? 0.1 : 0.25);
      },
    },
  };

  const DIFFS = {
    easy: { name: "Easy", income: 1.25, aggr: 0.75 },
    normal: { name: "Normal", income: 1.0, aggr: 1.0 },
    hard: { name: "Hard", income: 0.85, aggr: 1.2 },
  };

  /* ---------- 经济: [费用(点), 当局警觉+, 反对派组织度±] ---------- */
  const CARD_ECON = {
    rally: [2, 3], march: [4, 6], mobilize: [4, 4], strike: [7, 10], samizdat: [2, 2], leak: [4, 6], memorial: [2, 3],
    fraternize: [4, 5], network: [2, 1], legal: [2, 1], hunger: [4, 5], lowkey: [2, -4],
    blockade: [2, 4], goddess: [4, 6], prayer: [2, 2], cassette: [2, 2], banner: [2, 8], blankpaper: [4, 5],
    usb: [2, 0], bribe: [2, 0], market: [4, 0], hide: [2, 0], t_small: [1, 0], t_big: [3, 0],
    informants: [2, 0, -8], editorial: [2, 0, 6], crackdown: [6, 0, 14], amnesty: [4, 0, -10], dialogue: [4, 0, -22],
    subsidy: [4, 0, -12], bonus: [4, 0, 0], rotate: [6, 0, 0], cutnet: [4, 0, -6],
  };
  for (const [id, v] of Object.entries(CARD_ECON)) { CARDS[id].cost = v[0]; CARDS[id].alert = v[1] || 0; CARDS[id].org = v[2] || 0; }
  /* 能把人带上街的牌: 规模(占人口比例) */
  const SEEDS = { rally: 0.015, march: 0.04, mobilize: 0.03, strike: 0.08, goddess: 0.03, blankpaper: 0.035, hunger: 0.006, sanctuary: 0.015, necktie: 0.03, t_small: 0.01, t_big: 0.025 };
  CARDS.prayer.seedFn = (g) => (g.isMonday() ? 0.022 : 0.01);

  /* ---------- 气泡: 局势变化时冒出来, 点击收集 ---------- */
  const BUBBLES = {
    anger: { icon: '💢', name: "Anger", tip: "Punishment over the line was seen" },
    morale: { icon: '✊', name: "Morale", tip: "More people on the streets" },
    sympathy: { icon: '🌷', name: "Sympathy", tip: "An enforcer has wavered" },
    word: { icon: '📡', name: "Word", tip: "Word spreads through the network" },
    order: { icon: '🏛️', name: "Stability", tip: "Another quiet day" },
    intel: { icon: '👂', name: "Intelligence", tip: "Interrogations yield intelligence" },
    loyalty: { icon: '🎖️', name: "Loyalty", tip: "Troop morale holds" },
  };

  /* ============================================================
   * 建设树: 永久升级(像《瘟疫公司》的进化)。每项都让对方更警觉。
   * ============================================================ */
  const shiftTau = (g, d) => { const s = g.sim; for (let i = 0; i < s.tau.length; i++) s.tau[i] += d; s.tauDirty = true; };
  const TREES = {
    movement: [
      { id: 'spread', name: "Spread", icon: '📡', desc: "How much people can see of each other", nodes: [
        { id: 'm_word', name: "Word of mouth", cost: 4, alert: 1, text: "A grapevine among acquaintances. When one person steps forward, it's easier to bring along those nearby.", tags: ["Peer influence ↑", "Occasional “Word” bubbles"], run(g) { addEdges(g, Math.round(g.N * 0.2)); } },
        { id: 'm_net', name: "Contact network", cost: 9, req: ['m_word'], alert: 2, text: "Fixed contacts and code words. More people show up to planned actions.", tags: ["Turnout per action +25%"], run(g) { g.seedMul *= 1.25; } },
        { id: 'm_press', name: "Underground press", cost: 9, req: ['m_word'], alert: 3, text: "Hand-copied texts, mimeographed leaflets. The official version is no longer the only version.", tags: ["Blackout effect −30%", "Enforcement more easily seen as over the line"], run(g) { g.infoResist = Math.max(g.infoResist, 0.3); g.base.Pbar -= 0.04; } },
        { id: 'm_foreign', name: "Foreign media", cost: 14, req: ['m_press'], alert: 4, text: "Foreign reporters, shortwave radio, VPNs. What has been suppressed will be known in the end.", tags: ["Blackout effect −60%", "Suppressed anger surfaces at once"], run(g) { g.infoResist = Math.max(g.infoResist, 0.6); g.sim.reveal(0.6); } },
        { id: 'm_crypto', name: "Encrypted comms", cost: 18, req: ['m_net'], alert: 3, text: "Arresting one person no longer leads them to the rest.", tags: ["Turnout per action +25%", "Link-cutting halved"], run(g) { g.seedMul *= 1.25; g.sim.o.netDamage = (g.sim.o.netDamage || 0.5) * 0.5; g.flags.cutResist = true; } },
      ] },
      { id: 'memory', name: "Memory", icon: '🕯️', desc: "How much repression stays in people's hearts", nodes: [
        { id: 'm_witness', name: "Oral testimony", cost: 4, alert: 1, text: "Tell others what you saw. Every punishment over the line will be remembered by more people.", tags: ["Memory of punishment +30%"], run(g) { g.base.gamma *= 1.3; } },
        { id: 'm_mourn', name: "Mourning rites", cost: 8, req: ['m_witness'], alert: 2, text: "Wakes for the dead, the seventh-day rites, the fortieth day. Memory no longer fades quickly.", tags: ["Forgetting −40%"], run(g) { g.sim.o.memDecay *= 0.6; } },
        { id: 'm_names', name: "Victims' names", cost: 10, req: ['m_witness'], alert: 3, text: "Write down the names, one by one. A punishment is no longer a number, but someone.", tags: ["Punishment visibility +25%"], run(g) { g.base.vis *= 1.25; } },
        { id: 'm_anniv', name: "Anniversary", cost: 12, req: ['m_mourn'], alert: 3, text: "Every year on that day, people remember.", tags: ["Grievance rises periodically on its own"], run(g) { g.flags.anniv = true; } },
        { id: 'm_courage', name: "No more silence", cost: 21, req: ['m_names', 'm_anniv'], reqAny: true, alert: 6, text: "People begin to believe: silence protects no one.", tags: ["Everyone more willing to step forward"], run(g) { shiftTau(g, g.L.courage != null ? g.L.courage : 0.035); } },
      ] },
      { id: 'resist', name: "Resilience", icon: '🛡️', desc: "Withstand repression, win over the enforcers", nodes: [
        { id: 'm_legal', name: "Legal aid", cost: 4, alert: 1, text: "Lawyers, families, petitions. Those arrested come back sooner.", tags: ["Releases ↑"], run(g) { g.relBonus += 0.07; } },
        { id: 'm_family', name: "Family support", cost: 9, req: ['m_legal'], alert: 1, text: "When someone is arrested, their family is looked after. Stepping forward no longer means ruin for the whole family.", tags: ["Cost of arrest −12%"], run(g) { g.penaltyMul *= 0.88; } },
        { id: 'm_talk', name: "Talk to soldiers", cost: 8, alert: 2, text: "A soldier is someone's son too. Talk to them; bring them water.", tags: ["Crowd influence on enforcers ↑"], run(g) { g.base.alpha += 0.08; } },
        { id: 'm_sympath', name: "Sympathizers in the ranks", cost: 14, req: ['m_talk'], alert: 3, text: "Some officers express sympathy in private.", tags: ["Enforcers waver more easily"], run(g) { scalePsi(g, 1, 0.85); } },
        { id: 'm_barracks', name: "Barracks network", cost: 20, req: ['m_sympath'], alert: 4, text: "When one regiment defects, word reaches the next.", tags: ["Defections cascade"], run(g) { g.sim.o.beta += 0.15; } },
      ] },
    ],
    regime: [
      { id: 'fist', name: "Iron fist", icon: '🪖', desc: "How many you can arrest, and whether the enforcers are reliable", nodes: [
        { id: 'r_police', name: "Expand police", cost: 6, text: "More police, more vehicles.", tags: ["Arrests per round +20%"], run(g) { g.base.K0 *= 1.2; } },
        { id: 'r_riot', name: "Riot police", cost: 10, req: ['r_police'], text: "Specially trained riot units.", tags: ["Arrests per round +15%"], run(g) { g.base.K0 *= 1.15; } },
        { id: 'r_pay', name: "Pay troops first", cost: 9, req: ['r_police'], text: "Make sure the men with guns eat first.", tags: ["More reliable enforcers"], run(g) { scalePsi(g, 1, 1.2); } },
        { id: 'r_outside', name: "Outside garrison", cost: 14, req: ['r_riot'], text: "Rotate in units with no ties to the locals.", tags: ["Crowd influence on enforcers −30%"], run(g) { g.base.alpha *= 0.7; } },
        { id: 'r_loyal', name: "Political commissars", cost: 18, req: ['r_outside', 'r_pay'], reqAny: true, text: "Someone watches every company.", tags: ["Enforcers no longer sway each other"], run(g) { g.sim.o.beta *= 0.5; } },
      ] },
      { id: 'eye', name: "Dragnet", icon: '👁️', desc: "How much you can know, and how much they can see", nodes: [
        { id: 'r_inform', name: "Informants", cost: 6, text: "Plant eyes and ears in every work unit and on every street.", tags: ["Better intelligence", "More “Intelligence” bubbles"], run(g) { g.intelBonus += 0.2; } },
        { id: 'r_grid', name: "Grid management", cost: 10, req: ['r_inform'], text: "Every household has someone assigned to watch it.", tags: ["Watchlist grows", "Opposition organizes more slowly"], run(g) { g.flagTop(0.04); g.orgMul *= 0.8; } },
        { id: 'r_censor', name: "Censorship", cost: 9, req: ['r_inform'], text: "Delete posts, ban accounts, call editors in for a talk.", tags: ["People underestimate each other more"], run(g) { g.base.globalScale *= 0.85; } },
        { id: 'r_propaganda', name: "Propaganda", cost: 12, req: ['r_censor'], text: "Make everyone believe: everyone else is content.", tags: ["People underestimate each other more", "Enforcement less often seen as over the line"], run(g) { g.base.globalScale *= 0.85; g.base.Pbar += 0.05; } },
        { id: 'r_firewall', name: "Firewall", cost: 16, req: ['r_propaganda'], text: "News from outside can't get in.", tags: ["Halves their “Expose the truth” and “Underground press”"], run(g) { g.flags.firewall = true; } },
      ] },
      { id: 'heart', name: "Hearts and minds", icon: '⚖️', desc: "Whether people still see your rule as legitimate", nodes: [
        { id: 'r_relief', name: "Welfare subsidies", cost: 6, text: "Cut prices, hand out grain.", tags: ["Grievance −15%", "Slightly less income each round"], run(g) { griefScale(g, 0.85); g.bonusIncome -= 0.15; } },
        { id: 'r_petition', name: "Petition office", cost: 9, req: ['r_relief'], text: "Give people somewhere to speak.", tags: ["The line people accept ↑", "Opposition organizes more slowly"], run(g) { g.base.Pbar += 0.1; g.orgMul *= 0.85; } },
        { id: 'r_law', name: "Rule by law", cost: 12, req: ['r_petition'], text: "Arrest by procedure, try by procedure.", tags: ["The line people accept ↑", "Enforcers feel safer"], run(g) { g.base.Pbar += 0.1; g.sim.o.delta *= 0.6; } },
        { id: 'r_share', name: "Share the wealth", cost: 14, req: ['r_relief'], text: "People whose lives are bearable have more to lose.", tags: ["Everyone less willing to take risks"], run(g) { shiftTau(g, -(g.L.courage != null ? g.L.courage : 0.035)); } },
        { id: 'r_reform', name: "Political reform", cost: 22, req: ['r_law', 'r_share'], reqAny: true, text: "Write some of the demands into the system.", tags: ["Grievance −40%", "The line moves up sharply"], run(g) { g.base.Pbar += 0.25; griefScale(g, 0.6); g.org = Math.max(0, g.org - 30); } },
      ] },
    ],
  };
  const STAGES = [
    { name: "Normal", tip: "Routine control" },
    { name: "Alert", tip: "More police, harsher punishment, downplayed reporting" },
    { name: "Crackdown", tip: "News blackout, organizers targeted, editorial verdicts" },
    { name: "Total repression", tip: "Draconian punishment, martial law, possibly opening fire" },
  ];

  /* ============================================================
   * 突发事件: 每隔几轮抽一张, 逼你在两难之间选择
   * modern: 只出现在近现代关卡; if: 出现条件
   * ============================================================ */
  const RANDOM_EVENTS = {
    movement: [
      { id: 'death', art: '⚰️', title: "Death in custody", if: (g) => g.sim.R > 0.01,
        text: "One of those taken away has died in the detention center. The official cause: “sudden illness.” His family wants to see the body.",
        choices: [
          { label: "Publish photos of the body, hold a funeral march", hint: "Grievance surges · Regime alert +12 · Free Memorial", run: (g) => { griefAll(g, 0.04); g.addAlert(12); g.giveFree('memorial', 3); } },
          { label: "Bury him quietly, protect his family", hint: "Some grievance · Regime alert −5", run: (g) => { griefAll(g, 0.01); g.addAlert(-5); } },
        ] },
      { id: 'mole', art: '🕵️', title: "Mole", if: (g) => g.round > 4,
        text: "At the last few meetings, the police arrived far too quickly. Some suspect an informer has slipped into the organization.",
        choices: [
          { label: "Root them out", hint: "Costs 3 points · Network shrinks · Regime alert −8", run: (g) => { g.me.ap = Math.max(0, g.me.ap - 3); cutEdges(g, 0.06); g.addAlert(-8); } },
          { label: "Don't turn on each other", hint: "For 4 rounds, their arrest rate +40%", run: (g) => g.addEffect({ id: 'mole', name: "Mole", icon: '🕵️', side: 'regime', rounds: 4, mod(m) { m.K0 *= 1.4; } }) },
        ] },
      { id: 'press', art: '📷', title: "Reporters arrive", modern: true,
        text: "A team of foreign reporters has come to the city. They want to know what is really happening here.",
        choices: [
          { label: "Show them", hint: "Everyone sees for 3 rounds · Regime alert +6", run: (g) => { g.addEffect({ id: 'press_ev', name: "Press present", icon: '📷', side: 'movement', rounds: 3, mod(m) { m.vis = Math.max(m.vis, 1); m.gs = Math.max(m.gs, 0.9); } }); g.addAlert(6); } },
          { label: "Keep a low profile", hint: "Nothing happens" },
        ] },
      { id: 'prices', art: '🍞', title: "Prices soar",
        text: "The price of flour doubled overnight. People in line are cursing, but no one dares say it loud.",
        choices: [
          { label: "Organize a protest", hint: "Brings people out now · Regime alert +5", run: (g) => { g.addSeeds(0.02); g.addAlert(5); } },
          { label: "Organize mutual aid", hint: "+3 points · Grievance rises", run: (g) => { g.me.ap += 3; griefAll(g, 0.015); } },
        ] },
      { id: 'talks', art: '🤝', title: "The regime offers talks", if: (g) => g.x > 0.015 || g.alert > 45,
        text: "An official sends word through a go-between: we can talk, but you disperse first.",
        choices: [
          { label: "Agree: disperse, then talk", hint: "Crowds go home · Regime alert −25 · +4 points", run: (g) => { g.sim.a.fill(0); g.addAlert(-25); g.me.ap += 4; } },
          { label: "Refuse: free them first, then talk", hint: "Regime alert +8 · Morale rises", run: (g) => { g.addAlert(8); griefAll(g, 0.012); } },
        ] },
      { id: 'split', art: '⚡', title: "Internal split", if: (g) => g.x > 0.005 || g.round > 10,
        text: "The radicals want to storm the government building; the moderates insist: we must not give them a reason to shoot.",
        choices: [
          { label: "Charge!", hint: "Brings many out now · but harsher punishment for 3 rounds · Regime alert +15", run: (g) => { g.addSeeds(0.04); g.addAlert(15); g.addEffect({ id: 'pretext', name: "Pretext for repression", icon: '🔥', side: 'regime', rounds: 3, mod(m) { m.P *= 1.35; } }); } },
          { label: "Stay nonviolent", hint: "Enforcers more sympathetic (permanent)", run: (g) => { scalePsi(g, 0.4, 0.85); g.base.alpha += 0.04; } },
        ] },
      { id: 'writer', art: '✍️', title: "A celebrity speaks up", modern: true,
        text: "A very famous writer has signed an open letter. He has many readers — and he may be arrested for it.",
        choices: [
          { label: "Publicize it widely", hint: "Enforcement more easily seen as over the line · More people see for 3 rounds · Regime alert +4", run: (g) => { g.base.Pbar -= 0.05; g.addEffect({ id: 'writer', name: "Celebrity support", icon: '✍️', side: 'movement', rounds: 3, mod(m) { m.gs = Math.min(1, m.gs + 0.15); } }); g.addAlert(4); } },
          { label: "Ask him to stay quiet for now, for his own safety", hint: "+2 points", run: (g) => { g.me.ap += 2; } },
        ] },
      { id: 'festival', art: '🏮', title: "Festival",
        text: "A festival has come. People would be gathering anyway.",
        choices: [
          { label: "Gather under cover of the festival", hint: "Brings people out; arrests carry light penalties this round", run: (g) => { g.addSeeds(0.025); g.addEffect({ id: 'festival', name: "Festival", icon: '🏮', side: 'movement', rounds: 1, mod(m) { m.P *= 0.6; } }); } },
          { label: "Rest and recover", hint: "+3 points · Regime alert −6", run: (g) => { g.me.ap += 3; g.addAlert(-6); } },
        ] },
      { id: 'letter', art: '✉️', title: "A soldier's letter", if: (g) => g.d > 0.02 || g.round > 8,
        text: "A young soldier secretly passes you a letter: “We don't want to shoot.”",
        choices: [
          { label: "Publish the letter", hint: "Some enforcers waver · Regime alert +6", run: (g) => { scalePsi(g, 0.25, 0.65); g.addAlert(6); } },
          { label: "Keep it secret, stay in touch", hint: "A few enforcers waver", run: (g) => { scalePsi(g, 0.12, 0.75); } },
        ] },
      { id: 'release', art: '🚪', title: "Detainees come home", if: (g) => g.sim.R > 0.02,
        text: "A group of detainees has been released and sent home. They are much thinner — and no longer afraid.",
        choices: [
          { label: "Hold a welcome gathering", hint: "Grievance rises · Regime alert +4", run: (g) => { const s = g.sim; for (let i = 0; i < s.o.N; i++) if (s.r[i] && s.rng() < 0.2) s.r[i] = 0; griefAll(g, 0.02); g.addAlert(4); } },
          { label: "Let them rest", hint: "+2 points", run: (g) => { g.me.ap += 2; } },
        ] },
    ],
    regime: [
      { id: 'r_ringleaders', art: '📋', title: "A request from below",
        text: "A local official sends up a list: “These ringleaders — do we arrest them or not?”",
        choices: [
          { label: "Arrest", hint: "Opposition organization −18 · but arrests over the line leave grievance", run: (g) => { g.org = Math.max(0, g.org - 18); const s = g.sim; let n = 0; for (let i = 0; i < s.o.N && n < g.N * 0.006; i++) if (s.flagged[i] && !s.r[i]) { s.r[i] = 1; n++; } s.R += n / g.N; s.tauDirty = true; if (s.o.P > s.o.Pbar) griefAll(g, 0.012); } },
          { label: "Watch them for now", hint: "Accurate intelligence for 5 rounds", run: (g) => g.addEffect({ id: 'watch', name: "Surveillance", icon: '👂', side: 'regime', rounds: 5, intel: true }) },
        ] },
      { id: 'r_pay', art: '💸', title: "Army pay",
        text: "The treasury is strained. The soldiers' pay may fall into arrears.",
        choices: [
          { label: "Pay the army first", hint: "Costs 4 points", run: (g) => { g.me.ap = Math.max(0, g.me.ap - 4); } },
          { label: "Delay it", hint: "Enforcer loyalty falls", run: (g) => scalePsi(g, 1, 0.85) },
        ] },
      { id: 'r_rumor', art: '🗯️', title: "Rumor",
        text: "A rumor about you is going around the streets. It grows wilder with every telling.",
        choices: [
          { label: "Refute it", hint: "Costs 2 points · Grievance eases slightly", run: (g) => { g.me.ap = Math.max(0, g.me.ap - 2); griefScale(g, 0.93); } },
          { label: "Arrest the rumormongers", hint: "Opposition organization −6 · Grievance rises", run: (g) => { g.org = Math.max(0, g.org - 6); griefAll(g, 0.015); } },
        ] },
      { id: 'r_disaster', art: '🌊', title: "Natural disaster",
        text: "Floods have wiped out the villages outside the city; refugees are pouring in.",
        choices: [
          { label: "All-out relief", hint: "Costs 6 points · Grievance −20% · The line people accept ↑", run: (g) => { g.me.ap = Math.max(0, g.me.ap - 6); griefScale(g, 0.8); g.base.Pbar += 0.05; } },
          { label: "Suppress the news", hint: "Opposition organization +12 · Grievance rises", run: (g) => { g.org += 12; griefAll(g, 0.02); } },
        ] },
      { id: 'r_hawks', art: '🦅', title: "Hardliners",
        text: "The hardliners around you say you are too soft, and demand a crackdown.",
        choices: [
          { label: "Give in to them", hint: "+4 points · Enforcement locked to Harsh for 4 rounds", run: (g) => { g.me.ap += 4; g.forcePolicy('enforce', 'harsh', 4, "Hardliners"); } },
          { label: "Resist the pressure", hint: "Costs 2 points", run: (g) => { g.me.ap = Math.max(0, g.me.ap - 2); } },
        ] },
      { id: 'r_advisor', art: '🧓', title: "An old minister's warning",
        text: "An old minister risks his life to remonstrate: the people's resentment cannot be dammed up.",
        choices: [
          { label: "Heed him", hint: "Free “Dialogue”", run: (g) => g.selfCard('dialogue', "You heeded the remonstrance.") },
          { label: "Demote him", hint: "Opposition organization +8", run: (g) => { g.org += 8; } },
        ] },
      { id: 'r_corrupt', art: '💰', title: "Officer corruption",
        text: "Officers have been caught selling off army supplies.",
        choices: [
          { label: "Punish severely", hint: "Costs 2 points · Enforcers more reliable", run: (g) => { g.me.ap = Math.max(0, g.me.ap - 2); scalePsi(g, 1, 1.1); } },
          { label: "Handle it internally", hint: "+2 points · Enforcers slightly disgruntled", run: (g) => { g.me.ap += 2; scalePsi(g, 1, 0.95); } },
        ] },
      { id: 'r_press', art: '📷', title: "Foreign reporters", modern: true,
        text: "Several foreign reporters are asking to enter the city to report.",
        choices: [
          { label: "Expel them", hint: "Opposition organization −5 · Enforcement more easily seen as over the line", run: (g) => { g.org = Math.max(0, g.org - 5); g.base.Pbar -= 0.03; } },
          { label: "Let them report", hint: "The line people accept ↑ · Everything seen for 3 rounds", run: (g) => { g.base.Pbar += 0.04; g.addEffect({ id: 'press_r', name: "Press present", icon: '📷', side: 'movement', rounds: 3, mod(m) { m.vis = Math.max(m.vis, 1); } }); } },
        ] },
    ],
  };

  /* ============================================================
   * Game
   * ============================================================ */
  class Game {
    constructor(level, opts) {
      opts = opts || {};
      // 历史事件会改动对手 AI 的设置(如戒严后更警觉): 每局拷一份, 不污染关卡定义, 重玩时从头开始
      const copy1 = (o) => (Array.isArray(o) ? o.slice() : o && typeof o === 'object' ? Object.assign({}, o) : o);
      const ai = level.ai ? Object.assign({}, level.ai) : level.ai;
      if (ai) for (const k in ai) ai[k] = copy1(ai[k]);
      this.L = Object.assign({}, level, { ai });
      this.side = level.side;                            // 玩家阵营 'movement' | 'regime'
      this.oppSide = this.side === 'movement' ? 'regime' : 'movement';
      this.diff = DIFFS[opts.diff || 'normal'];
      const seed = opts.seed != null ? opts.seed : ((Math.random() * 1e9) | 0);
      this.rng = mulberry32(seed ^ 0x5bd1e995);
      const world = Object.assign({}, level.world, { seed: (level.world.seed || 1) + (opts.seedOffset != null ? opts.seedOffset : (seed % 997)) });
      this.sim = new Sim(world);
      this.N = world.N;
      this.base = {                                      // 可被卡牌永久改变的基准参数
        P: world.P, K0: world.K0, Pbar: world.Pbar, globalScale: world.globalScale == null ? 1 : world.globalScale,
        vis: world.vis == null ? 1 : world.vis, alpha: world.alpha || 0, omega: world.omega == null ? 1 : world.omega,
        noise: world.noise || 0, psiScale: world.psiScale || 1, gamma: world.gamma || 0,
      };
      this.scale = level.scale || 1;                     // 每个点代表多少人
      this.arrestScale = level.arrestScale || this.scale; // 被抓的一个点代表多少人(人群里一个点是一片人, 被带走的是其中一部分)
      this.moodScale = level.moodScale || 0.2;
      this.maxRound = level.rounds;
      this.round = 0;
      this.pol = Object.assign({ enforce: 'normal', police: 'normal', target: 'uniform', info: 'open', release: 'normal' }, (level.policies && level.policies.start) || {});
      this.polCd = {};
      this.locks = {};                                   // policy -> {until, value, reason}
      this.effects = [];
      this.econ = level.econ != null ? level.econ : 2;     // 点数倍率(教程为 1)
      this.me = { ap: (level.startAP != null ? level.startAP : 2) * this.econ, cool: {}, used: {} };
      this.opp = { ap: this.econ, cool: {}, used: {} };
      this.apCap = level.apCap || 30;
      this.bonusIncome = 0;
      // 建设树与各种永久修正
      this.bought = {};
      this.seedMul = 1; this.penaltyMul = 1; this.relBonus = 0; this.infoResist = 0; this.intelBonus = 0; this.orgMul = 1;
      // 可见的对抗条: 当局警觉(玩家为民间时) / 反对派组织度(玩家为当局时)
      this.alert = level.alertStart || 0; this.aiStage = 0; this.pendingAlert = 0;
      this.org = level.orgStart != null ? level.orgStart : 15;
      // 气泡与突发事件
      this.bubbles = []; this._bid = 0;
      this.nextRandom = level.firstRandom != null ? level.firstRandom : 4 + ((this.rng() * 3) | 0);
      this.usedRandom = {};
      this.lastIgnite = -99;
      this.freebies = {};                                // cardId -> rounds left(免费)
      this.seedNext = 0; this.seedMode = 'random';
      this.flags = {};
      this.streak = { x: 0, d: 0, tip: 0 };
      this.news = [];
      this.fx = [];
      this.popup = null;
      this.over = null;
      this.revealUntil = -1;
      this.exposure = 0;                                 // 仅部分关卡使用
      this.exposureMul = 1;
      this.glow = new Float32Array(this.N);
      this.firedEvents = new Set();
      this.actions = [];                                 // [{round, id, side}]
      this.intelNoise = { mood: 0, army: 0, tip: 0 };
      this.prevX = 0; this.prevD = 0;
      this.tipCache = { t: -1, v: null };
      this.hist = { x: [], d: [], mood: [], moodSeen: [], tip: [], tipSeen: [], R: [], p: [], P: [], alert: [], org: [], dSeen: [], risk: [], over: [], orgSeen: [], uc: [] };
      this.reports = [];                                 // 行动回报: 出牌/改政策两轮后告诉玩家发生了什么
      this.vigor = 1;                                    // 组织元气(行动方): 小行动一次次被抓, 抓走的是骨干
      this.diagCache = { t: -1, v: null }; this.ucCache = { t: -1, v: null };
      this.allowCards = null;                            // 教程用: 只允许这些牌
      if (level.setup) level.setup(this);
      this.aiStage = this.stage();
      this._applyParams();
      this._record();
      this._pollEvents();
    }

    /* ---------- 基本读数 ---------- */
    get x() { return this.sim.meanU8(this.sim.a); }
    get d() { return this.sim.meanU8(this.sim.z); }
    isMonday() { return this.L.isMonday ? this.L.isMonday(this.round) : false; }
    dateLabel(r) { return this.L.dateFmt ? this.L.dateFmt(r == null ? this.round : r) : `Round ${(r == null ? this.round : r) + 1}`; }
    policyOpt(key, id) { const P = POLICIES[key]; return P.options.find(o => o.id === (id || this.pol[key])) || P.options[1]; }
    policyAllowed(key, id) {
      const lim = this.L.policies && this.L.policies.allow && this.L.policies.allow[key];
      return !lim || lim.includes(id);
    }
    meanGrievance() {
      const s = this.sim; let sum = 0, n = 0;
      for (let i = 0; i < s.o.N; i++) if (!s.r[i]) { sum += s.b[i]; n++; }
      return n ? sum / n : 0;
    }

    /* ---------- 参数合成: 基准 × 政策 × 临时效果 ---------- */
    _mods() {
      const B = this.base;
      const en = this.policyOpt('enforce'), po = this.policyOpt('police'), ta = this.policyOpt('target'),
        inf = this.policyOpt('info'), re = this.policyOpt('release');
      const ir = this.infoResist;
      const m = {
        P: B.P * en.P * this.penaltyMul, K0: B.K0 * po.K, gs: B.globalScale * (inf.gs + (1 - inf.gs) * ir), vis: B.vis * (inf.vis + (1 - inf.vis) * ir),
        rel: re.rel * (this.L.relMul != null ? this.L.relMul : 1) + this.relBonus,
        alpha: B.alpha, omega: B.omega, noise: B.noise, Pbar: B.Pbar, gamma: B.gamma,
        targetMode: ta.mode,
      };
      if (m.targetMode === 'organizer' && !this.sim.net) m.targetMode = 'uniform';
      if (m.targetMode === 'preventive') m.K0 *= 0.5;                  // 名单拘押: 一半警力用于盯梢
      for (const e of this.effects) if (e.mod) e.mod(m, this);
      if (this.L.modParams) this.L.modParams(m, this);
      return m;
    }
    _applyParams() {
      const m = this._mods(), o = this.sim.o;
      o.P = Math.max(0.05, m.P);
      o.K0 = Math.max(0, Math.round(m.K0));
      o.globalScale = clamp(m.gs, 0, 1);
      o.vis = clamp(m.vis, 0, 1.6);
      o.releaseProb = clamp(m.rel, 0, 1);
      o.alpha = Math.max(0, m.alpha);
      o.omega = clamp(m.omega, 0, 1);
      o.noise = Math.max(0, m.noise);
      o.Pbar = m.Pbar;
      o.gamma = m.gamma;
      o.targetMode = m.targetMode;
      o.listMode = 'flag';
      o.listThreshold = 0;
      this.m = m;
    }

    /* ---------- 行动接口 ---------- */
    addSeeds(frac, mode) {
      const mul = this._actor === 'me' ? this.seedMul * (this.side === 'movement' ? this.vigor : 1) : 1;
      const n = Math.max(1, Math.round(frac * this.N * (this.L.seedScale || 1) * mul));
      this.seedNext += n;
      if (this._actor === 'me') this.mySeedNext = (this.mySeedNext || 0) + n;
      if (this._actor === 'me') this.fx.push({ type: 'seeds', n });
      if (mode === 'near') this.seedMode = 'near';
    }
    addEffect(e) {
      const old = this.effects.find(q => q.id === e.id);
      if (old) { old.rounds = Math.max(old.rounds, e.rounds); return; }
      this.effects.push(Object.assign({}, e));
    }
    hasEffect(id) { return this.effects.some(e => e.id === id); }
    /* 供关卡事件使用的工具 */
    griefAll(amt, frac) { griefAll(this, amt, frac); this.tipCache.t = -1; }
    griefScale(mul) { griefScale(this, mul); this.tipCache.t = -1; }
    scalePsi(frac, mul) { scalePsi(this, frac, mul); }
    cutEdges(frac) { cutEdges(this, frac); }
    addEdgesFrac(frac) { addEdges(this, Math.round(this.N * frac)); }
    giveFree(id, rounds) { this.freebies[id] = Math.max(this.freebies[id] || 0, rounds || 1); this.me.cool[id] = 0; }
    /** 玩家一方因事件选择而(免费)执行一张牌的效果 */
    selfCard(id, say) {
      const c = CARDS[id]; if (!c) return;
      this._actor = 'me'; c.run(this); this._actor = null;
      this.actions.push({ round: this.round, id, side: this.side });
      this.fx.push({ type: 'card', id, side: this.side });
      if (say) this.log(say, 'mine');
      this.tipCache.t = -1;
      this._applyParams();
    }
    /** 对手无视资源与冷却, 强制打出一张牌(历史事件) */
    forceOpp(id, say) {
      const c = CARDS[id]; if (!c) return;
      this._actor = 'opp'; c.run(this); this._actor = null;
      this.actions.push({ round: this.round, id, side: this.oppSide });
      this.fx.push({ type: 'card', id, side: this.oppSide });
      if (say !== false) this.log(say || `Regime: “${this.card(id).name}”`, 'opp');
      this.tipCache.t = -1;
      this._applyParams();
    }
    revealFor(n) { this.revealUntil = Math.max(this.revealUntil, this.round + n); }
    glowRandom(frac) {
      // 看过外国影视的人; 其中一部分会被人民班登记在案
      for (let i = 0; i < this.N; i++) if (this.rng() < frac) { this.glow[i] = 1; if (this.rng() < 0.25) this.sim.flagged[i] = 1; }
    }
    /** 预先登记在案: 承受上限最高的 frac 比例(已知的积极分子) */
    flagTop(frac) {
      const s = this.sim, idx = Array.from({ length: this.N }, (_, i) => i).sort((a, b) => s.tau[b] - s.tau[a]);
      for (let q = 0; q < Math.round(frac * this.N); q++) s.flagged[idx[q]] = 1;
    }
    hurtOpponent(n) {
      // 出牌者的对手: n>0 削减其资源, n<0 给其资源
      const who = this._actor === 'opp' ? this.me : this.opp;
      who.ap = clamp(who.ap - n, 0, this.apCap);
    }
    _stateFor(side) { return side === this.side ? this.me : this.opp; }
    log(text, kind) {
      this.news.unshift({ round: this.round, date: this.dateLabel(), text, kind: kind || 'info' });
      if (this.news.length > 80) this.news.pop();
      this.fx.push({ type: 'news', text, kind: kind || 'info' });
    }

    /* ---------- 卡牌 ---------- */
    card(id) { return Object.assign({ id }, CARDS[id], (this.L.cardNames && this.L.cardNames[id]) || {}); }
    hand() { return (this.L.cards || []).map(id => this.card(id)).filter(c => c.name && !(c.once && this.me.used[c.id])).filter(c => !(c.needNet && !this.sim.net)); }
    cardCost(c, st) {
      st = st || this.me;
      if (st === this.me && this.freebies[c.id] > 0) return 0;
      return c.costFn ? c.costFn(this) : c.cost;
    }
    cardState(c) {
      const st = this.me;
      const cost = this.cardCost(c);
      const cd = st.cool[c.id] || 0;
      const blocked = this.allowCards && !this.allowCards.includes(c.id);
      const cond = c.when ? c.when(this) : true;
      return { cost, cd, ok: !this.over && !this.popup && !blocked && cond && cd <= 0 && st.ap >= cost, cond, blocked };
    }
    play(id) {
      const c = CARDS[id];
      if (!c) return false;
      const cs = this.cardState(this.card(id));   // 关卡可以改写牌的出牌条件(when)
      if (!cs.ok) return false;
      this.me.ap -= cs.cost;
      if (this.freebies[id] > 0) this.freebies[id] = 0;
      this.me.cool[id] = c.cd;
      if (c.once) this.me.used[id] = true;
      this._actor = 'me'; c.run(this); this._actor = null;
      if (this.side === 'movement' && c.alert) this.addAlert(c.alert);
      if (this.side === 'regime' && c.org) this.org = clamp(this.org + c.org, 0, 100);
      this.actions.push({ round: this.round, id, side: this.side });
      this.fx.push({ type: 'card', id, side: this.side });
      this.log(`You: “${this.card(id).name}”`, 'mine');
      this._noteAction(this.card(id).name);
      this.sim.tauDirty = true;
      this.tipCache.t = -1;
      this._applyParams();
      if (this.onPlay) this.onPlay(id);
      return true;
    }
    _oppPlay(id) {
      const c = CARDS[id];
      if (!c) return false;
      const st = this.opp;
      if ((st.cool[id] || 0) > 0 || st.ap < c.cost) return false;
      if (c.once && st.used[id]) return false;
      if (c.when && !c.when(this)) return false;
      st.ap -= c.cost; st.cool[id] = c.cd; if (c.once) st.used[id] = true;
      this._actor = 'opp'; c.run(this); this._actor = null;
      this.actions.push({ round: this.round, id, side: this.oppSide });
      this.fx.push({ type: 'card', id, side: this.oppSide });
      const nm = this.card(id).name;
      const say = (this.L.oppSay && this.L.oppSay[id]) || (this.oppSide === 'regime' ? `Regime: “${nm}”` : `Movement: “${nm}”`);
      this.log(say, 'opp');
      return true;
    }

    /* ---------- 政策 ---------- */
    policyState(key, id) {
      const opt = this.policyOpt(key, id);
      const cur = this.pol[key] === id;
      const lock = this.locks[key] && this.locks[key].until > this.round ? this.locks[key] : null;
      const cd = this.polCd[key] || 0;
      const cost = (opt.cost || 0) * this.econ;
      const allowed = this.policyAllowed(key, id);
      const needNet = opt.needNet && !this.sim.net;
      const ok = this.side === 'regime' && !this.over && !this.popup && !cur && !lock && cd <= 0 && allowed && !needNet && this.me.ap >= cost && !(this.allowCards && !this.allowCards.includes('policy:' + key));
      return { opt, cur, lock, cd, cost, allowed, needNet, ok };
    }
    setPolicy(key, id) {
      const ps = this.policyState(key, id);
      if (!ps.ok) return false;
      this.me.ap -= ps.cost;
      this.pol[key] = id;
      this.polCd[key] = 2;
      this.actions.push({ round: this.round, id: key + ':' + id, side: this.side });
      this.log(`You set “${POLICIES[key].name}” to “${ps.opt.name}”`, 'mine');
      this._noteAction(`${POLICIES[key].name}→${ps.opt.name}`);
      this.tipCache.t = -1;
      this._applyParams();
      if (this.onPlay) this.onPlay('policy:' + key);
      return true;
    }
    /** 事件或 AI 强制设定政策(可锁定若干轮) */
    forcePolicy(key, id, lockRounds, reason) {
      this.pol[key] = id;
      if (lockRounds) this.locks[key] = { until: this.round + lockRounds, value: id, reason: reason || '' };
      this.tipCache.t = -1;
      this._applyParams();
    }
    upkeep() {
      let u = 0;
      for (const k of POLICY_KEYS) u += this.policyOpt(k).upkeep || 0;
      return u;
    }
    income(side) {
      side = side || this.side;
      const x = this.x, d = this.d;
      const L = this.L;
      if (side === 'movement') {
        if (side === this.side) {
          // 玩家: 固定收入的一部分改由气泡提供
          const base = (L.income != null ? L.income : 1) * this.diff.income * (this.econ > 1 ? 0.7 : 1);
          return clamp(base * this.econ + this.bonusIncome + 1.0 * x * this.econ, 0.1, 6);
        }
        return clamp(((L.ai && L.ai.income) || 1) * this.diff.aggr * this.econ + 1.2 * x * this.econ, 0.1, 6);
      }
      return clamp(this.regimeRawIncome() * (this.side === 'regime' && this.econ > 1 ? 0.8 : 1), 0.12 * this.econ, 6);
    }
    /** 朝廷的真实收支(未截断): 为负即财政赤字 */
    regimeRawIncome() {
      const L = this.L, x = this.x, d = this.d;
      const base = this.side === 'regime' ? (L.income != null ? L.income : 1.1) * this.diff.income + this.bonusIncome / this.econ : ((L.ai && L.ai.income) || 1.1) * this.diff.aggr;
      return (base - this.upkeep() - 0.8 * d - 0.5 * x) * this.econ;
    }

    /* ---------- 建设树 ---------- */
    tree() {
      if (this.L.tree === false) return [];
      const T = TREES[this.side] || [];
      const only = this.L.tree && this.L.tree.only;
      const cost = this.L.tree && this.L.tree.costMul || 1;
      return T.map((b) => Object.assign({}, b, { nodes: b.nodes.filter((n) => !only || only.includes(n.id)).map((n) => Object.assign({}, n, { cost: Math.round(n.cost * cost) })) })).filter((b) => b.nodes.length);
    }
    nodeState(n) {
      const have = !!this.bought[n.id];
      const reqs = (n.req || []).filter((r) => this.tree().some((b) => b.nodes.some((q) => q.id === r)));
      const reqOk = !reqs.length || (n.reqAny ? reqs.some((r) => this.bought[r]) : reqs.every((r) => this.bought[r]));
      const blocked = this.allowCards && !this.allowCards.includes('tree:' + n.id);
      return { have, reqOk, ok: !have && reqOk && !blocked && !this.over && this.me.ap >= n.cost, afford: this.me.ap >= n.cost };
    }
    buy(id) {
      let node = null;
      for (const b of this.tree()) for (const n of b.nodes) if (n.id === id) node = n;
      if (!node || !this.nodeState(node).ok) return false;
      this.me.ap -= node.cost;
      this.bought[id] = true;
      this._actor = 'me'; node.run(this); this._actor = null;
      if (this.side === 'movement' && node.alert) this.addAlert(node.alert);
      this.actions.push({ round: this.round, id: 'tree:' + id, side: this.side });
      this.log(`Built: “${node.name}”`, 'mine');
      this.fx.push({ type: 'buy', id, name: node.name });
      this.tipCache.t = -1;
      this._applyParams();
      if (this.onPlay) this.onPlay('tree:' + id);
      return true;
    }
    buildLevels() {
      const out = {};
      for (const b of this.tree()) out[b.id] = { name: b.name, icon: b.icon, n: b.nodes.filter((q) => this.bought[q.id]).length, max: b.nodes.length };
      return out;
    }
    affordableNodes() { let c = 0; for (const b of this.tree()) for (const n of b.nodes) if (this.nodeState(n).ok) c++; return c; }

    /* ---------- 可见的对抗条 ---------- */
    stage() { const a = this.alert; return a >= 75 ? 3 : a >= 50 ? 2 : a >= 25 ? 1 : 0; }
    addAlert(v) {
      const A = this.L.ai || {};
      const mul = v > 0 ? (A.alertMul != null ? A.alertMul : 1) * this.diff.aggr : 1;
      this.alert = clamp(this.alert + v * mul, 0, 100);
    }
    orgShown() { return this.side === 'regime' ? this.org * (1 - this.intelBias() * 0.8) : this.org; }

    /* ---------- 气泡 ---------- */
    spawnBubble(kind, amt, where) {
      amt = Math.round(amt);
      if (amt < 1) return;
      const b = { id: ++this._bid, kind, amt, where: where || 'plaza', round: this.round, icon: BUBBLES[kind].icon, name: BUBBLES[kind].name };
      this.bubbles.push(b);
      if (this.bubbles.length > 8) this.bubbles.shift();
      this.fx.push({ type: 'bubble', b });
    }
    collect(id, frac) {
      const i = this.bubbles.findIndex((b) => b.id === id);
      if (i < 0) return 0;
      const b = this.bubbles[i]; this.bubbles.splice(i, 1);
      const v = Math.max(1, Math.round(b.amt * (frac == null ? 1 : frac)));
      this.me.ap = Math.min(this.apCap, this.me.ap + v);
      return v;
    }
    expire(id) { const i = this.bubbles.findIndex((b) => b.id === id); if (i >= 0) this.bubbles.splice(i, 1); }
    collectAll(frac) { let s = 0; for (const b of this.bubbles.slice()) s += this.collect(b.id, frac); return s; }
    _spawnBubbles(arrested, d0) {
      if (this.econ <= 1 && this.L.id !== 'tutorial') return;
      const x = this.x, n = arrested * this.N, o = this.sim.o, rng = this.rng;
      if (this.side === 'movement') {
        const over = o.P - o.Pbar;
        if (n >= 1 && over > 0 && rng() < 0.7) this.spawnBubble('anger', Math.min(3, 1 + n * over * 0.05 * clamp(o.vis, 0.3, 1.5)), 'prison');
        else if (n >= 3 && rng() < 0.2) this.spawnBubble('anger', 1, 'prison');
        const dx = x - this.prevX;
        if (dx > 0.003) this.spawnBubble('morale', Math.min(4, 1 + dx * this.N * 0.008), 'plaza');
        if (this.d - d0 > 0.03) this.spawnBubble('sympathy', Math.min(3, 1 + (this.d - d0) * 12), 'barracks');
        const lv = this.bought.m_word ? 1 + (this.bought.m_press ? 1 : 0) + (this.bought.m_foreign ? 1 : 0) : 0;
        if (lv && rng() < 0.12 * lv) this.spawnBubble('word', 1 + (lv >= 2 ? 1 : 0), 'home');
      } else {
        if (x < 0.005 && rng() < 0.45) this.spawnBubble('order', 1 + (rng() < 0.3 ? 1 : 0), 'home');
        if (n >= 1 && rng() < 0.5 + this.intelBonus) this.spawnBubble('intel', Math.min(4, 1 + n * 0.08), 'prison');
        if (this.d < d0 - 0.03) this.spawnBubble('loyalty', 2, 'barracks');
      }
    }

    /* ---------- 临界点: 真值 ---------- */
    tipping() {
      if (this.tipCache.t === this.round) return this.tipCache.v;
      const v = this._tipCalc();
      this.tipCache = { t: this.round, v };
      return v;
    }
    /** 临界点; ov 给出假想的改变(敏感性分析): kMul 执行能力倍率, Pmul 处罚倍率, gsAdd 消息可见度, shift 怨气(承受上限整体上移) */
    _tipCalc(ov) {
      ov = ov || {};
      const o = this.sim.o;
      const gs = clamp(o.globalScale + (ov.gsAdd || 0), 0, 1);
      const inf = this.sim.net ? o.omega * gs + (1 - o.omega) : gs;
      const P = ov.Pmul ? this.sim.eff().P * ov.Pmul : undefined;
      const ana = this.sim.analysis({ useMem: true, kScale: (ov.kMul || 1) / Math.max(0.05, inf), P, shift: ov.shift || 0 });
      const roots = ana.roots.filter(q => !q.boundary);
      const unstable = roots.find(q => !q.stable);
      if (unstable) return unstable.x;
      const high = roots.find(q => q.stable && q.x > 0.05);
      if (!high) return Infinity;
      // 没有分界: 若零点附近 F(x)>x → 一点就着; 否则(只有低位稳定点)是极高门槛
      const f = this.sim.frozenF(0.002, P != null ? P : o.P, ana.k, true, ov.shift || 0);
      return f > 0.002 ? 0 : Infinity;
    }

    /* ---------- 参谋: 眼下的主要阻力 / 隐患 ----------
     * 行动方: 对临界点做敏感性分析——同样"一步"的改变(抓捕能力 −30%、处罚 −25%、怨气 +一档、消息 +25%),
     * 哪一个能让临界点降得最多, 它就是眼下最大的阻力。只给定性的强弱, 不给数字。
     * 当局: 列出正在侵蚀安全边际的因素; 它们和你的情报一样会"报喜不报忧"。 */
    diagnose() {
      if (this.diagCache.t === this.round && !this.diagDirty) return this.diagCache.v;
      this.diagDirty = false;
      const v = this.side === 'movement' ? this._diagMovement() : this._diagRegime();
      this.diagCache = { t: this.round, v };
      return v;
    }
    _diagMovement() {
      const CAP = 1.2, T = (ov) => { const t = this._tipCalc(ov); return t === Infinity ? CAP : t; };
      const base = this.tipping(), B = base === Infinity ? CAP : base;
      const ms = this.moodScale || 0.2;
      const f = [
        { id: 'capacity', name: "Police can keep up", drop: B - T({ kMul: 0.7 }),
          advice: "Too few people: the regime can arrest them all. Bring out more at once (save up organizing power, play several cards in the same round), or shake the enforcers first — only when the same police force is spread over more people does each person's risk go down.",
          cards: ['strike', 'march', 'mobilize', 'fraternize', 'blockade', 'prayer', 'blankpaper'] },
        { id: 'penalty', name: "Arrest costs too much", drop: B - T({ Pmul: 0.75 }),
          advice: "The consequences of arrest are too heavy; few can bear them. Rescuing detainees and low-key ways of taking part lower the cost; and once the regime goes over the line, harsh penalties turn into grievance and push the tipping point back down.",
          cards: ['legal', 'lowkey', 'hide', 'prayer'] },
        { id: 'anger', name: "Not angry enough", drop: B - T({ shift: 0.25 * ms }),
          advice: "People are not angry enough yet — or their anger is held down by the blackout and has not surfaced. Mourning and exposure bring memory to the surface; and every penalty that goes over the line will be remembered too.",
          cards: ['memorial', 'leak', 'hunger', 'banner', 'cassette'] },
        { id: 'info', name: "People can't see each other", drop: B - T({ gsAdd: 0.25 }),
          advice: "People cannot see each other — each thinks they alone feel this way. Underground press, networking and communication builds let people know “others are out there too.”",
          cards: ['samizdat', 'network', 'usb', 'market', 'cassette'] },
      ];
      const mx = Math.max(...f.map((q) => q.drop));
      for (const q of f) q.v = mx > 1e-4 ? clamp(q.drop / mx, 0, 1) : 0;
      f.sort((a, b) => b.v - a.v);
      let head;
      if (base === 0) head = { kind: 'go', text: "Tinderbox: any spark could set the plain ablaze. Now is the time to act." };
      else if (mx <= 1e-4 && base === Infinity) head = { kind: 'stuck', text: "No opening in sight: no single change is enough. Push on several fronts at once, or wait for the moment (a crackdown that goes over the line, an anniversary…)." };
      else {
        const r = this.readout(), cap = this.pushCapacity();
        const est = r.tip.kind === 'est' ? r.tip.est : null;
        if (est != null && this.x + cap >= est) head = { kind: 'go', text: "With the organizing power in your hands, you can already bring out enough people at once to reach the estimated tipping point." };
        else if (est != null) head = { kind: 'gap', text: `At most you can bring out ~${fmtCount(Math.max(1, (this.x + cap) * this.N * this.scale))} people at once; an estimated ${r.tip.range} are needed.` };
      }
      if (this.vigor < 0.75) head = { kind: 'warn', text: `Action after action that failed to cross the tipping point has cost you your core people: organizational strength is down to ${Math.round(this.vigor * 100)}%, and every future push will bring out fewer. Pause and rebuild — strength slowly recovers while things are quiet.` };
      const g = this.L.goal || {};
      if (g.d != null && g.x == null) {
        // 这一关靠执行者倒戈取胜: 先说军心
        const r = this.readout();
        head = { kind: 'army', text: `This level is won when the enforcers defect. ${(this.L.labels && this.L.labels.army) || 'Security forces'} right now: “${r.army.words}” (rumor); the goal is “Defecting en masse”. The more people on the streets, and the more they talk to the soldiers, the more the troops waver.` };
      }
      return { side: 'movement', title: "The main obstacle now", factors: f, head, top: f[0] };
    }
    _diagRegime() {
      const bias = this.intelBias(), o = this.sim.o;
      const moodSeen = (this.meanGrievance() / this.moodScale) * (1 - bias);
      const raw = this.regimeRawIncome();
      const f = [
        { id: 'grievance', name: "Grievance eroding the margin", v: clamp(moodSeen / 0.9, 0, 1),
          advice: "Grievance doesn't show up as people on the streets, but it keeps pushing the tipping point down. Bring enforcement back within the line people accept; dialogue, amnesty and appeasement builds let it slowly fade.",
          cards: ['dialogue', 'amnesty', 'subsidy'] },
        { id: 'overline', name: "Penalties over the line", v: clamp((o.P - o.Pbar) / 0.6, 0, 1),
          advice: "Your penalties are over the line people accept: every arrest is remembered by those watching, and the enforcers grow uneasy. Lower Enforcement to the normal level or below.",
          cards: [] },
        { id: 'army', name: "Enforcers faltering", v: clamp(this.d / 0.35, 0, 1),
          advice: "The enforcers are faltering. Orders that go over the line, the numbers on the streets, their comrades' attitudes — all of it makes them hesitate. Bonuses and rotation can steady them for a while, but they treat the symptoms, not the cause.",
          cards: ['bonus', 'rotate'] },
        { id: 'money', name: "Budget in deficit", v: raw < 0 ? clamp(-raw / (0.6 * this.econ), 0.2, 1) : 0,
          advice: "Hard-line policies cost more than you take in; the bill is being passed on to ordinary people and turning into grievance. Drop the one that costs the most and is needed the least.",
          cards: [] },
        { id: 'org', name: "Opposition organizing", v: clamp(this.orgShown() / 100, 0, 1),
          advice: "When opposition organization is full, they launch a mass action. Arresting organizers or conceding in dialogue can both push it down.",
          cards: ['informants', 'cutnet', 'dialogue'] },
        { id: 'intel', name: "Intelligence distorted", v: clamp(bias / 0.5, 0, 1),
          advice: "People below dare not tell the truth — the “calm” you see may be false, and the items above may be underestimated too. Informant cards let you hear the truth for a while.",
          cards: ['informants'] },
      ];
      f.sort((a, b) => b.v - a.v);
      const r = this.readout();
      const head = { kind: bias >= 0.3 ? 'warn' : 'info', text: `Situation as reported from below: “${r.tip.words}”${bias >= 0.15 ? ' (reliability: ' + (bias >= 0.4 ? 'low' : 'medium') + ')' : ''}.` };
      return { side: 'regime', title: "The main hidden risk now", factors: f, head, top: f[0] };
    }

    /* ---------- 暗流: 城里有多少人"离站出来只差一点" ----------
     * 性质十: 临界反馈由"门槛附近的人数"决定。对每个自由的人, 比较 τ+b 与两种假想人数下的代价:
     *   2 = 只要约 5% 的人上街就会加入(蠢蠢欲动); 1 = 约四分之一的人上街才会加入(在观望)。
     * 玩家看到的是经过迷雾的版本: 民间一方是传闻(有错有漏), 当局一方越凶, 越多的人藏起心思。 */
    undercurrent() {
      if (this.ucCache.t === this.round && this.ucCache.v) return this.ucCache.v;
      const s = this.sim, N = this.N, o = s.o, P = s.eff().P;
      const { k } = s.capacity(this.d);
      const inf = s.net ? o.omega * o.globalScale + (1 - o.omega) : o.globalScale;
      const kk = k / Math.max(0.05, inf);
      const c5 = s.cost(kk, 0.05, P), c25 = s.cost(kk, 0.25, P);
      const tier = new Uint8Array(N);
      const rng = mulberry32((this.round + 1) * 7919 + (o.seed || 1));
      const bias = this.intelBias();
      let shown = 0, free = 0;
      for (let i = 0; i < N; i++) {
        if (s.r[i] || s.a[i]) continue;
        free++;
        const q = s.tau[i] + s.b[i];
        let t = q >= c5 ? 2 : q >= c25 ? 1 : 0;
        if (this.side === 'regime') { if (t && rng() < bias * 1.4) t--; }
        else { const u = rng(); if (u < 0.12) t = Math.max(0, t - 1); else if (u > 0.95 && t < 2) t++; }
        tier[i] = t;
        if (t) shown += t === 2 ? 1 : 0.5;
      }
      const v = { tier, frac: free ? shown / free : 0 };
      this.ucCache = { t: this.round, v };
      return v;
    }

    /* ---------- 行动回报 ---------- */
    _noteAction(name) {
      const r = this.round;
      let p = this.reports.find((q) => q.round === r);
      if (!p) {
        const ro = this.readout();
        p = { round: r, due: r + 2, names: [], x0: this.x, peak: this.x, R0: this.sim.R, tip0: ro.tip, mood0: ro.mood, army0: ro.army, uc0: this.undercurrent().frac, vig0: this.vigor };
        this.reports.push(p);
      }
      if (!p.names.includes(name)) p.names.push(name);
      this.diagDirty = true;
    }
    _reports() {
      for (const p of this.reports) p.peak = Math.max(p.peak, this.x);
      const due = this.reports.filter((p) => this.round >= p.due);
      if (!due.length) return;
      this.reports = this.reports.filter((p) => this.round < p.due);
      const ro = this.readout(), lab = this.L.labels || {};
      const cnt = (v) => fmtCount(Math.max(0, v) * this.N * this.scale);
      for (const p of due) {
        const what = "“" + p.names.join("”, “") + "”";
        const parts = [];
        const crowdL = lab.crowd || "On the streets";
        if (p.peak > p.x0 + 0.002 || this.x > 0.002) parts.push(`${crowdL}: peak ~${cnt(p.peak)}, now ~${cnt(this.x)}`);
        else parts.push(`${crowdL}: still empty`);
        const arrested = (this.sim.R - p.R0) * this.N * this.arrestScale;
        if (arrested >= 1) parts.push(`~${fmtCount(arrested)} taken away meanwhile`);
        let verdict = '';
        if (this.side === 'movement') {
          const t0 = p.tip0, t1 = ro.tip;
          const ignited = t1.kind === 'tinder' || (t1.kind === 'est' && this.x >= t1.est && this.x > 0.02);
          if (ignited) verdict = "The chain reaction has begun. ";
          else if (p.peak > p.x0 + 0.004 && t0.kind === 'est') {
            const ratio = p.peak / t0.est;
            verdict = ratio < 0.5 ? `Still far from the estimated tipping point (${t0.range}) — not enough people, so no one's risk was spread thin. ` : ratio < 1 ? "Just short of the tipping point. " : "Numbers briefly passed the estimated tipping point but didn't hold — the estimate itself may be too low. ";
          }
          if (ignited) { /* 已经点着了, 临界点的变化不再重要 */ }
          else if (t0.kind === 'est' && t1.kind === 'est') {
            if (t1.est < t0.est * 0.88) verdict += `The estimated tipping point fell (${cnt(t0.est)} → ${cnt(t1.est)} people). `;
            else if (t1.est > t0.est * 1.12) verdict += `The estimated tipping point rose instead (${cnt(t0.est)} → ${cnt(t1.est)} people). `;
          } else if (t0.kind === 'none' && t1.kind === 'est') verdict += "A tipping point has appeared — for the first time, an opening is visible. ";
          else if (t0.kind === 'est' && t1.kind === 'none') verdict += "The tipping point has vanished — no opening in sight for now. ";
          const uc1 = this.undercurrent().frac;
          if (uc1 > p.uc0 * 1.15 + 0.005) verdict += "The undercurrent is growing. ";
          else if (uc1 < p.uc0 * 0.85 - 0.005) verdict += "The undercurrent is shrinking. ";
          if (this.vigor < p.vig0 - 0.04) verdict += `Organizational strength hurt (${Math.round(p.vig0 * 100)}% → ${Math.round(this.vigor * 100)}%). `;
          if (!verdict) verdict = "No visible change yet. ";
        } else {
          if (p.mood0.words !== ro.mood.words) verdict += `Reported public mood: “${p.mood0.words}” → “${ro.mood.words}”${ro.mood.bias >= 0.15 ? ' (bad news may be held back)' : ''}. `;
          if (p.army0.words !== ro.army.words) verdict += `${lab.army || 'Security forces'}: “${p.army0.words}” → “${ro.army.words}”. `;
          if (p.tip0.words !== ro.tip.words) verdict += `Situation: “${p.tip0.words}” → “${ro.tip.words}”. `;
          if (!verdict) verdict = "All normal, reportedly. ";
        }
        const text = `After ${what} — ${parts.join('; ')}. ${verdict}`;
        this.log(text, 'report');
        this.fx.push({ type: 'report', text });
      }
    }
    /** 去掉行动方的临时效果(传单、记者……)之后的临界点: 衡量"持久的"变化 */
    structuralTipping() {
      const keep = this.effects, cache = this.tipCache;
      this.effects = keep.filter((e) => e.side !== 'movement');
      if (this.effects.length === keep.length) return this.tipping();
      this._applyParams(); this.tipCache = { t: -1 };
      const v = this.tipping();
      this.effects = keep; this._applyParams(); this.tipCache = cache;
      return v;
    }

    /* ---------- 战争迷雾: 玩家看到的读数 ---------- */
    intelBias() {
      if (this.side !== 'regime') return 0;
      if (this.effects.some(e => e.intel)) return 0;
      const P = this.sim.o.P;
      let b = clamp((P - 0.95) * 0.9, 0, 0.7);
      if (this.pol.info === 'blackout') b += 0.2;
      else if (this.pol.info === 'spin') b += 0.08;
      return clamp(b - this.intelBonus, 0, 0.85);
    }
    readout() {
      const s = this.sim, o = s.o, x = this.x, d = this.d;
      const { K } = s.capacity(d);
      const n = x * this.N;
      const pArr = n >= 1 ? Math.min(1, K / n) : (K > 0 ? 1 : 0);
      const crowdN = n * this.scale;
      const crowd = {
        x, count: crowdN, text: crowdN < 1 ? "Empty" : `~${fmtCount(crowdN)} people`,
        ...band(x, [0.002, 0.02, 0.08, 0.25, 0.5], ["Empty", "A handful", "A small crowd", "Growing crowd", "A sea of people", "The whole city astir"]),
      };
      const risk = band(pArr, [0.05, 0.2, 0.5, 0.9], ["Almost no arrests", "Occasional arrests", "Many arrested", "Arrest likely", "Certain arrest"]);
      risk.p = pArr;
      const pen = band(o.P, [0.8, 1.05, 1.35, 1.75], ["Warnings & fines", "Detention", "Prison sentence", "Heavy sentence", "Kin punished · executions"]);
      const over = o.P - o.Pbar;
      const legit = band(over, [0.001, 0.25, 0.6], ["Within the line people accept", "Excessive", "Brutal", "Tyrannical"]);
      legit.over = over;
      const dNoise = this.side === 'regime' ? 0 : this.intelNoise.army;
      const dShown = clamp(d + dNoise, 0, 1);
      const army = band(dShown, [0.05, 0.15, 0.35, 0.6], ["Obedient", "Grumbling in private", "Restless", "Openly defiant", "Defecting en masse"]);
      army.shown = dShown;
      army.rumor = this.side !== 'regime';
      const moodTrue = this.meanGrievance() / this.moodScale;
      const bias = this.intelBias();
      const moodShown = this.side === 'regime' ? moodTrue * (1 - bias) : Math.max(0, moodTrue * (1 + this.intelNoise.mood));
      const mood = band(moodShown, [0.1, 0.3, 0.55, 0.8], ["Calm", "Holding it in", "Aggrieved", "Seething", "Explosive"]);
      mood.shown = moodShown; mood.bias = bias;
      mood.conf = this.side === 'regime'
        ? (bias >= 0.4 ? "Low: people below dare not tell the truth" : bias >= 0.15 ? "Medium: more good news than bad" : "High")
        : "rumor";
      const tipTrue = this.L.structuralTip ? this.structuralTipping() : this.tipping();
      let tip;
      if (this.side === 'movement') {
        if (tipTrue === Infinity) tip = { kind: 'none', text: "No opening in sight", sub: "Even if the whole city stood up together, it would be crushed for now" };
        else if (tipTrue === 0) tip = { kind: 'tinder', text: "Tinderbox", sub: "Any spark could set the plain ablaze" };
        else {
          const est = tipTrue * (1 + this.intelNoise.tip);
          const spread = this.L.tipSpread != null ? this.L.tipSpread : 0.3;
          const lo = est * (1 - spread), hi = est * (1 + spread);
          const cnt = (v) => fmtCount(Math.max(1, v * this.N * this.scale));
          tip = { kind: 'est', text: `~${cnt(lo)}–${cnt(hi)} people`, range: `${cnt(lo)}–${cnt(hi)} people`, sub: "This many must stand up at once to set off a chain reaction", est };
        }
        tip.shownFrac = tipTrue === Infinity ? 1 : tipTrue === 0 ? 0 : tip.est;
      } else {
        const seen = tipTrue === Infinity ? Infinity : tipTrue * (1 + 2.5 * bias) + 0.25 * bias;
        tip = band(seen === Infinity ? 9 : seen, [0.03, 0.08, 0.18, 0.35], ["Precarious", "Fragile", "Holding", "Secure", "Rock-solid"]);
        tip.shownFrac = seen === Infinity ? 1 : Math.min(1, seen);
      }
      return { crowd, risk, pen, legit, army, mood, tip, R: s.R, detained: s.R * this.N * this.arrestScale };
    }

    /* ---------- AI: 朝廷 ----------
     * 当局按"警觉"分阶段升级: 常态 → 警戒 → 严打 → 全面镇压。
     * 警觉由街头人数、人数的突增和你的行动推高, 平静时慢慢回落。玩家看得见这根条。 */
    _alertTick() {
      const A = this.L.ai || {};
      const x = this.x, dx = Math.max(0, x - this.prevX);
      const mul = (A.alertMul != null ? A.alertMul : 1) * this.diff.aggr * clamp((A.aggression != null ? A.aggression : 0.6) / 0.6, 0.3, 1.8);
      const gain = (x * 80 + dx * 110) * mul;
      const decay = x < 0.004 ? (A.alertDecay != null ? A.alertDecay : 2) : 0.3;
      this.alert = clamp(this.alert + gain - decay, 0, 100);
    }
    _regimeAI() {
      const A = this.L.ai || {}, st = this.opp, rng = this.rng, x = this.x, d = this.d;
      const aggr = clamp((A.aggression != null ? A.aggression : 0.6) * this.diff.aggr * (this.flags.aggrMul || 1), 0, 1.5);
      const stage = this.stage();
      if (stage !== this.aiStage) {
        const up = stage > this.aiStage; this.aiStage = stage;
        this.log(up ? `The regime escalates to “${STAGES[stage].name}”: ${STAGES[stage].tip}.` : `The regime stands down to “${STAGES[stage].name}”.`, 'opp');
        this.fx.push({ type: 'stage', stage, up });
      }
      const s0 = A.start || {};
      const net = !!this.sim.net;
      const want = [
        {},
        { enforce: 'harsh', police: 'surge', info: 'spin', target: net ? 'organizer' : null },
        { enforce: 'harsh', police: 'surge', info: 'blackout', target: net ? 'organizer' : null },
        { enforce: aggr > 0.5 ? 'terror' : 'harsh', police: 'martial', info: 'blackout', target: net ? 'organizer' : null },
      ][stage];
      const ladder = (key, w) => {
        if (this.locks[key] && this.locks[key].until > this.round) return;
        const opts = POLICIES[key].options.map((o) => o.id);
        const base = s0[key] || (key === 'target' ? 'uniform' : key === 'info' ? 'open' : 'normal');
        if (!w || opts.indexOf(w) < opts.indexOf(base)) w = base;
        const lim = A.max && A.max[key];
        if (lim && opts.indexOf(w) > opts.indexOf(lim)) w = lim;
        if (!this.policyAllowed(key, w)) return;
        if (this.pol[key] !== w) {
          this.pol[key] = w;
          if (!A.quiet) this.log((A.say && A.say[key + ':' + w]) || `Regime: “${POLICIES[key].name}” → “${this.policyOpt(key).name}”`, 'opp');
        }
      };
      for (const k of ['enforce', 'police', 'info', 'target']) ladder(k, want[k]);
      const cards = A.cards || [];
      const has = (id) => cards.includes(id);
      const wantC = [];
      if (d >= 0.35 && has('rotate')) wantC.push('rotate');
      if (d >= 0.15 && has('bonus')) wantC.push('bonus');
      if (stage >= 3 && x >= 0.12 && has('crackdown') && rng() < 0.45 * aggr) wantC.push('crackdown');
      if (stage >= 1 && x >= 0.02 && x > this.prevX + 0.01 && has('editorial')) wantC.push('editorial');
      if (stage >= 1 && has('informants') && rng() < 0.2) wantC.push('informants');
      if (stage >= 2 && has('cutnet') && rng() < 0.25 * aggr) wantC.push('cutnet');
      if (aggr < 0.55 && stage <= 1 && x < 0.03 && this.meanGrievance() / this.moodScale > 0.5 && has('dialogue')) wantC.push('dialogue');
      if (aggr < 0.55 && has('amnesty') && this.sim.R > 0.04 && rng() < 0.1) wantC.push('amnesty');
      for (const id of wantC) if (this._oppPlay(id)) { if (id === 'dialogue' || id === 'amnesty') this.alert = Math.max(0, this.alert - 10); break; }
    }

    /* ---------- AI: 行动方 ----------
     * 反对派在暗中"组织": 积怨越深、街上越热闹,组织得越快; 抓串联者能打断它。
     * 组织度满了就会发动一次大规模行动——成不成, 取决于你看不见的临界点。 */
    _orgTick(arrested) {
      const A = this.L.ai || {};
      const mood = Math.min(1.5, this.meanGrievance() / this.moodScale);
      let gain = (A.orgRate != null ? A.orgRate : 1) * this.orgMul * this.diff.aggr * (0.6 + 2.4 * mood + 15 * this.x);
      if (this.pol.target !== 'uniform' && arrested > 0) gain -= arrested * this.N * 0.12;
      this.org = clamp(this.org + gain, 0, 100);
    }
    _movementAI() {
      const A = this.L.ai || {}, x = this.x, st = this.opp, rng = this.rng;
      const cards = A.cards || ['rally', 'march', 'strike', 'memorial', 'leak', 'fraternize', 'samizdat'];
      const has = (id) => cards.includes(id);
      const aggr = (A.aggression != null ? A.aggression : 0.6) * this.diff.aggr;
      // 1) 组织度满了: 倾巢而出
      if (this.org >= 100) {
        const opts = ['strike', 'march', 'rally'].filter((id) => has(id));
        for (const id of opts) { st.cool[id] = 0; this._oppPlay(id); }
        this.addSeeds(0.02 + 0.02 * Math.min(1, this.meanGrievance() / this.moodScale));
        this.org = 25;
        this.flags.aiPush = this.round;
        this.log(A.pushNews || "The opposition has launched a mass action!", 'opp');
        this.fx.push({ type: 'push' });
        return;
      }
      // 2) 对镇压的回应
      if (this.flags.lastCrackdown != null && this.round - this.flags.lastCrackdown <= 3) {
        if (this.pol.info === 'blackout' && has('leak') && this._oppPlay('leak')) return;
        if (has('memorial') && this._oppPlay('memorial')) return;
      }
      if (this.pol.info === 'blackout' && has('samizdat') && rng() < 0.3 && this._oppPlay('samizdat')) return;
      if (this.pol.info !== 'open' && has('leak') && rng() < 0.08 && this._oppPlay('leak')) return;
      if (x >= 0.05 && has('fraternize') && rng() < 0.35 && this._oppPlay('fraternize')) return;
      if (x >= 0.08 && has('march') && rng() < 0.4 && this._oppPlay('march')) return;
      // 3) 例行的小动作(议论、传单、小聚会)
      const every = A.every || 4;
      if (this.round > 0 && this.round % every === 0) {
        const sz = (A.base || 0.01) * (1 + 1.5 * Math.min(1, this.meanGrievance() / this.moodScale));
        this.addSeeds(sz * aggr);
        if (A.chatter && rng() < 0.6) this.log(A.chatter[(rng() * A.chatter.length) | 0], 'opp');
      }
    }

    /* ---------- 事件 ---------- */
    _pollEvents() {
      if (this.popup || this.over) return !!this.popup;
      for (const ev of (this.L.events || [])) {
        if (this.firedEvents.has(ev)) continue;
        const due = ev.at != null ? ev.at === this.round : (ev.when ? ev.when(this) : false);
        if (!due) continue;
        if (ev.if && !ev.if(this)) { this.firedEvents.add(ev); continue; }
        this.firedEvents.add(ev);
        if (ev.run) ev.run(this);
        if (ev.news) this.log(typeof ev.news === 'function' ? ev.news(this) : ev.news, ev.kind || 'event');
        if (ev.headline) {
          const h = typeof ev.headline === 'function' ? ev.headline(this) : ev.headline;
          if (!ev.news) this.log(h, ev.kind || 'event');
          this.fx.push({ type: 'headline', text: h, kind: ev.kind || 'event' });
        }
        if (ev.title) {
          this.popup = {
            ev, title: ev.title, art: ev.art || '📜', date: this.dateLabel(),
            text: typeof ev.text === 'function' ? ev.text(this) : ev.text,
            quote: ev.quote,
            choices: (ev.choices || [{ label: "Continue" }]).map(c => ({ label: c.label, hint: c.hint, wise: !!c.wise })),
          };
          this.fx.push({ type: 'popup' });
          return true;
        }
        this._applyParams();
        if (this.over) return false;
      }
      return this._randomEvent();
    }
    _randomEvent() {
      const L = this.L;
      if (this.popup || this.over || L.randomEvents === false || this.round < this.nextRandom || this.round >= this.maxRound) return false;
      const soon = (L.events || []).some((e) => e.title && e.at != null && e.at >= this.round && e.at <= this.round + 2);
      if (soon) { this.nextRandom = this.round + 2; return false; }
      const deck = (RANDOM_EVENTS[this.side] || []).filter((e) => !this.usedRandom[e.id] && !(e.modern && L.ancient) &&
        (!L.randomEvents || L.randomEvents.includes(e.id)) && (!e.if || e.if(this)));
      const gap = L.randomGap || [5, 4];
      this.nextRandom = this.round + gap[0] + Math.floor(this.rng() * gap[1]);
      if (!deck.length) return false;
      const ev = deck[Math.floor(this.rng() * deck.length)];
      this.usedRandom[ev.id] = true;
      const flav = (L.flavor && L.flavor[ev.id]) || {};
      const E = Object.assign({}, ev, flav);
      this.popup = { ev: E, title: E.title, art: E.art, date: this.dateLabel(), text: E.text, quote: E.quote, random: true,
        choices: E.choices.map((c) => ({ label: c.label, hint: c.hint, wise: !!c.wise })) };
      this.fx.push({ type: 'popup' });
      return true;
    }
    choose(i) {
      if (!this.popup) return;
      const ev = this.popup.ev;
      const ch = (ev.choices || [])[i];
      this.popup = null;
      if (ch && ch.run) ch.run(this);
      if (ch && ch.news) this.log(ch.news, 'event');
      this.tipCache.t = -1;
      this._applyParams();
      this._check();
      this._pollEvents();
    }

    /* ---------- 一轮 ---------- */
    step() {
      if (this.over || this.popup) return;
      const s = this.sim;
      this._applyParams();
      // 对手行动
      if (!this.L.noAI) (this.oppSide === 'regime' ? this._regimeAI() : this._movementAI());
      if (this.L.onRound) this.L.onRound(this);
      this._applyParams();
      const seeds = this.seedNext, mode = this.seedMode, mine = this.mySeedNext || 0;
      this.mySeedNext = 0;
      this.seedNext = 0; this.seedMode = 'random';
      const R0 = s.R, d0 = this.d;
      this.prevX = this.x; this.prevD = d0;
      s.step(seeds, mode);
      this.round = s.t;
      // 资源; 朝廷入不敷出时, 代价转嫁给百姓(物价、配给)——这也是积怨
      const raw = this.regimeRawIncome();
      if (raw < 0) {
        griefAll(this, Math.min(0.02, -raw * 0.025));
        if (this.round % 5 === 0) this.log(this.L.deficitNews || "Budget squeeze: prices rise, rations shrink, the queues grow longer.", this.side === 'regime' ? 'intel' : 'event');
      }
      const incMe = this.income(this.side), incOpp = this.income(this.oppSide);
      this.me.ap = clamp(this.me.ap + incMe, 0, this.apCap);
      this.opp.ap = clamp(this.opp.ap + incOpp, 0, this.apCap);
      const arrestedNow = s.R - R0;
      // 组织元气: 人群没能越过临界点、却有人被抓——被抓走的多是你的骨干。安静下来才会慢慢恢复。
      if (this.side === 'movement' && this.L.id !== 'tutorial') {
        const t = this.tipping(), failing = this.x < (t === Infinity ? 1 : t);
        // 伤得最重的是"出去的人几乎全被抓"的小行动; 大规模行动里被抓的只是一部分
        if (mine > 0) this.lastMine = this.round;
        const out = Math.max(this.prevX, seeds / this.N, 1e-6), share = Math.min(1, arrestedNow / out);
        const yours = this.lastMine != null && this.round - this.lastMine <= 1;   // 只算你自己带出来的人
        if (arrestedNow > 0 && failing && yours) this.vigor = Math.max(0.3, this.vigor - Math.min(0.15, arrestedNow * (this.L.vigorLoss || 4) * share));
        else if (arrestedNow < 0.0005) this.vigor = Math.min(1, this.vigor + 0.025);
      }
      this._spawnBubbles(arrestedNow, d0);
      if (!this.L.noAI) { if (this.side === 'movement') this._alertTick(); else this._orgTick(arrestedNow); }
      if (this.flags.anniv && this.round % 6 === 0) {
        griefAll(this, Math.min(0.03, 0.25 * s.R + 0.006));
        this.log("The anniversary has come. People remember the ones who were lost.", 'event');
      }
      // 起伏: 连锁反应 / 差一点
      const tipPrev = this.hist.tip.length ? this.hist.tip[this.hist.tip.length - 1] : 1;
      if (this.x >= 0.02 && this.x > this.prevX * 1.6 && this.x > tipPrev && this.round - this.lastIgnite > 6) {
        this.lastIgnite = this.round;
        this.fx.push({ type: 'ignite' });
        this.log("The chain reaction has begun: more and more people are joining.", 'crowd');
      } else if (this.prevX >= 0.015 && this.x < this.prevX * 0.45 && this.prevX > tipPrev * 0.55) {
        this.fx.push({ type: 'nearmiss' });
        this.log("So close. The crowd dispersed — a few more people, and it might have been different.", 'calm');
      }
      for (const st of [this.me, this.opp]) for (const k in st.cool) if (st.cool[k] > 0) st.cool[k]--;
      for (const k in this.polCd) if (this.polCd[k] > 0) this.polCd[k]--;
      for (const k in this.freebies) if (this.freebies[k] > 0) this.freebies[k]--;
      for (let i = this.effects.length - 1; i >= 0; i--) if (--this.effects[i].rounds <= 0) this.effects.splice(i, 1);
      if (this.exposure > 0) this.exposure = Math.max(0, this.exposure - 1);
      // 迷雾噪声缓慢漂移
      const drift = (v, amp) => clamp(v * 0.7 + (this.rng() * 2 - 1) * amp * 0.5, -amp, amp);
      this.intelNoise.mood = drift(this.intelNoise.mood, 0.35);
      this.intelNoise.army = drift(this.intelNoise.army, 0.12);
      this.intelNoise.tip = drift(this.intelNoise.tip, this.L.tipNoise != null ? this.L.tipNoise : 0.3);
      // 视觉事件
      const arrested = s.R - R0;
      if (arrested > 0) this.fx.push({ type: 'arrest', n: arrested * this.N });
      if (this.d > d0 + 0.08) this.fx.push({ type: 'defect' });
      this.tipCache.t = -1;
      this._applyParams();
      this._news(arrested, d0);
      this._record();
      this._reports();
      this._check();
      if (!this.over) this._pollEvents();
    }

    _record() {
      const h = this.hist, r = this.readout();
      h.x.push(this.x); h.d.push(this.d); h.R.push(this.sim.R);
      h.p.push(this.sim.hist.p.length ? this.sim.hist.p[this.sim.hist.p.length - 1] : 0);
      h.mood.push(this.meanGrievance() / this.moodScale); h.moodSeen.push(r.mood.shown);
      const t = this.tipping();
      h.tip.push(t === Infinity ? 1 : Math.min(1, t)); h.tipSeen.push(r.tip.shownFrac);
      h.P.push(this.sim.o.P);
      h.alert.push(this.alert); h.org.push(this.org);
      (h.vigor || (h.vigor = [])).push(this.vigor);
      h.dSeen.push(r.army.shown); h.risk.push(r.risk.p); h.over.push(r.legit.over); h.orgSeen.push(this.orgShown());
      const uc = this.undercurrent(); h.uc.push(uc.frac);
    }

    /** 以当前资源, 一次最多能把多少人带上街(占人口比例, 含已安排的) */
    pushCapacity() {
      let ap = this.me.ap, tot = this.seedNext / this.N;
      const ss = (this.L.seedScale || 1) * this.seedMul * (this.side === 'movement' ? this.vigor : 1);
      const cands = this.hand().filter((c) => SEEDS[c.id] || c.seedFn).map((c) => {
        const cs = this.cardState(c);
        return { cs, sz: (c.seedFn ? c.seedFn(this) : SEEDS[c.id]) * ss };
      }).filter((o) => o.cs.cond && o.cs.cd <= 0 && !o.cs.blocked).sort((a, b) => b.sz / Math.max(1, b.cs.cost) - a.sz / Math.max(1, a.cs.cost));
      for (const o of cands) if (ap >= o.cs.cost) { ap -= o.cs.cost; tot += o.sz; }
      return tot;
    }

    _news(arrested, d0) {
      const x = this.x, d = this.d, px = this.prevX, sc = this.scale;
      const cross = (v, p, th) => v >= th && p < th;
      const L = this.L;
      if (arrested * this.N >= 1) {
        const n = arrested * this.N * this.arrestScale;
        if (arrested >= 0.002 || this.rng() < 0.4) this.log(`${fmtCount(n)} people taken away.`, 'arrest');
      }
      if (cross(x, px, 0.02)) this.log(L.newsCrowd1 || "Some have begun to stand up in public.", 'crowd');
      if (cross(x, px, 0.1)) this.log(L.newsCrowd2 || "The crowd keeps growing — onlookers begin to wonder whether to join.", 'crowd');
      if (cross(x, px, 0.3)) this.log(L.newsCrowd3 || "The streets are a sea of people.", 'crowd');
      if (px >= 0.05 && x < px * 0.4) this.log("The streets are empty again.", 'calm');
      if (cross(d, d0, 0.15)) this.log("Some enforcers have begun refusing orders.", 'army');
      if (cross(d, d0, 0.4)) this.log("Mass refusal of orders across the enforcement apparatus!", 'army');
      if (this.side === 'regime') {
        if (this.round % 4 === 0) {
          const r = this.readout();
          this.log(`Intel: public mood “${r.mood.words}”. (Reliability: ${r.mood.conf.split(':')[0]})`, 'intel');
        }
      } else {
        const mu = this.sim.backfireMu().mu;
        if (mu > 1 && this.rng() < 0.3) this.log("Street talk: the arrests are only making more people restless.", 'intel');
      }
      if (x < 0.003 && this.rng() < 0.06) this.log(L.quiet || "The streets are quiet. Some are content, some are tired, some are afraid, some are waiting for others.", 'calm');
    }

    /* ---------- 胜负 ---------- */
    _check() {
      if (this.over) return;
      const G = this.L.goal || {};
      const x = this.x, d = this.d;
      this.streak.x = G.x != null && x >= G.x ? this.streak.x + 1 : 0;
      this.streak.d = G.d != null && d >= G.d ? this.streak.d + 1 : 0;
      const hold = G.hold || 3;
      if (this.L.check) {
        const r = this.L.check(this);
        if (r) return this._end(r);
      }
      if (this.exposure >= 100) return this._end({ win: false, key: 'exposed' });
      const collapse = this.streak.x >= hold || this.streak.d >= (G.dHold || hold);
      if (collapse) {
        const by = this.streak.d >= (G.dHold || hold) ? 'army' : 'crowd';
        return this._end(this.side === 'movement' ? { win: true, key: by } : { win: false, key: by });
      }
      if (this.round >= this.maxRound) {
        return this._end(this.side === 'regime' ? { win: true, key: 'survive' } : { win: false, key: 'timeout' });
      }
    }
    _end(r) {
      const E = this.L.endings || {};
      const e = E[r.key] || (r.win ? E.win : E.lose) || {};
      const stars = [];
      if (r.win) {
        stars.push({ text: this.L.starText ? this.L.starText[0] : "Goal reached", ok: true });
        for (const s of (this.L.stars || [])) stars.push({ text: s.text, ok: !!s.test(this) });
      }
      this.over = {
        win: r.win, key: r.key, title: r.title || e.title || (r.win ? "Victory" : "Defeat"),
        text: r.text || (typeof e.text === 'function' ? e.text(this) : e.text) || '',
        stars, starCount: r.win ? stars.filter(s => s.ok).length : 0,
        stats: this.stats(),
      };
      this.fx.push({ type: 'over' });
    }
    stats() {
      const h = this.hist;
      const peakX = Math.max(...h.x), peakD = Math.max(...h.d);
      return {
        peakCrowd: fmtCount(peakX * this.N * this.scale),
        detained: fmtCount(this.sim.R * this.N * this.arrestScale),
        peakArmy: band(peakD, [0.05, 0.15, 0.35, 0.6], ["Obedient", "Grumbling in private", "Restless", "Openly defiant", "Defecting en masse"]).words,
        rounds: this.round,
        moodEnd: band(this.meanGrievance() / this.moodScale, [0.1, 0.3, 0.55, 0.8], ["Calm", "Holding it in", "Aggrieved", "Seething", "Explosive"]).words,
      };
    }
  }

  const api = { Game, POLICIES, POLICY_KEYS, CARDS, DIFFS, TREES, STAGES, BUBBLES, SEEDS, RANDOM_EVENTS, fmtCount, band };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.SilenceGame = api;
})(typeof window !== 'undefined' ? window : globalThis);
