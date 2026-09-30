/* ============================================================
 * 道路以目 · 关卡
 * 每一关 = 一段历史(或一个教学场景) + 一组世界参数 + 事件时间线。
 * 世界参数只在复盘和"模型实验室"里公开;对局中玩家只看到政策与传闻。
 * 史实部分力求准确;数值是为了玩法而设的示意,不是历史估计。
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 日期工具 ---------- */
  const CN = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  function cnNum(n) {
    if (n < 10) return CN[n];
    if (n < 20) return "10" + (n % 10 ? CN[n % 10] : '');
    return CN[Math.floor(n / 10)] + "10" + (n % 10 ? CN[n % 10] : '');
  }
  const LUNAR_M = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
  const DAY = 864e5;
  const ymd = (t) => { const d = new Date(t); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCDay()]; };
  // 英文版(window.SILENCE_LANG = 'en')的日期格式
  const EN = (typeof window !== 'undefined' ? window : globalThis).SILENCE_LANG === 'en';
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const HALF = (r) => (EN ? (r % 2 ? 'night' : 'day') : (r % 2 ? "night" : "day"));
  const md = (M, D) => (EN ? `${MON[M - 1]} ${D}` : M + "month" + D + "day");
  const ymdTxt = (Y, M, D) => (EN ? `${MON[M - 1]} ${D}, ${Y}` : `${M}/${D}/${Y}`);
  const dayFmt = (y, m, d, withYear) => { const t0 = Date.UTC(y, m - 1, d); return (r) => { const [Y, M, D] = ymd(t0 + r * DAY); return withYear === false ? md(M, D) : ymdTxt(Y, M, D); }; };
  const weekFmt = (y, m, d) => { const t0 = Date.UTC(y, m - 1, d); return (r) => { const [Y, M, D] = ymd(t0 + r * 7 * DAY); return ymdTxt(Y, M, D); }; };
  const halfDayFmt = (y, m, d) => { const t0 = Date.UTC(y, m - 1, d); return (r) => { const [, M, D] = ymd(t0 + Math.floor(r / 2) * DAY); return md(M, D) + ' · ' + HALF(r); }; };
  const monthFmt = (y, m) => (r) => { const mm = m - 1 + r, Y = y + Math.floor(mm / 12); return EN ? `${MON[mm % 12]} ${Y}` : `${(mm % 12) + 1}/${Y}`; };
  const weekday = (y, m, d) => { const t0 = Date.UTC(y, m - 1, d); return (r) => ymd(t0 + r * DAY)[3]; };

  const STD_POL = { enforce: 'normal', police: 'normal', target: 'uniform', info: 'open', release: 'normal' };

  const LEVELS = [];

  /* ============================================================
   * 序章 · 教程
   * ============================================================ */
  LEVELS.push({
    id: 'tutorial', chapter: "Prologue", title: "Twenty-One on the Playground", era: "Tutorial", place: "A middle school · Flag-raising assembly", icon: '🏫',
    side: 'movement', role: "A student in Grade 8, Class 3",
    blurb: "A thousand students stand on the playground for a lecture. Whether enough of them step forward decides everything.",
    intro: [
      "Monday morning, the flag-raising assembly. In the blazing heat, a thousand students stand on the playground in their class ranks, listening to the principal lecture from the stage.",
      "The principal announces: from next week, weekends are cancelled and replaced with extra classes. Below the stage, silence.",
      "You think: if I step forward alone to object, I'll probably be singled out and punished; if everyone steps forward at once, it's a different story.",
      "That thought is the core of the whole game — <b>everyone decides whether to act by watching what others do, and their own action in turn changes what others decide.</b>",
    ],
    goalText: "Get more than half the school to step forward and object, and hold for two minutes.",
    tips: ["Want the Duke of Shao to walk you through it? Click “💡 Start with guide”; during play you can also click “💡 Guide” at the top at any time."],
    rounds: 30, scale: 1, moodScale: 1, tipSpread: 0.1, tipNoise: 0, econ: 1, randomEvents: false,
    tree: { only: ['m_net'], costMul: 0.22 },
    layout: 'assembly',
    world: { N: 1000, tolType: 'uniform', netType: 'full', P: 1, Pbar: 9, K0: 20, M: 16, alpha: 0, beta: 0, delta: 0, gamma: 0, memDecay: 0.2, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0, seed: 7, psiScale: 1 },
    relMul: 0, noAI: true,
    policies: { start: STD_POL },
    labels: { army: "Teachers", crowd: "Students standing up", plaza: "Before the rostrum", prison: "Dean's office", barracks: "Rostrum", avenue: '' },
    cards: ['t_small', 't_big'], startAP: 1, apCap: 3, income: 1,
    goal: { x: 0.5, hold: 2 },
    dateFmt: (r) => (EN ? `Morning assembly · 8:${String(r).padStart(2, '0')} a.m.` : `Morning assembly · 8:${String(r).padStart(2, '0')} a.m.`),
    events: [
      { at: 0, headline: "The flag goes up. The sun is merciless; not a breath of wind." },
      { at: 1, headline: "The principal: “From next week, weekends are cancelled. Extra classes for everyone.”" },
      { at: 2, headline: "Someone in the ranks mutters a curse, then falls silent." },
      { at: 3, headline: "The dean of students paces between the rows, studying every face." },
      { at: 5, headline: "“Anyone who objects may step forward and say so,” the man on the stage says coldly." },
      { at: 7, headline: "In the back rows, people exchange glances." },
      { at: 10, headline: "Sweat trickles down necks. The lecture drones on." },
      { at: 15, headline: "Some start sneaking looks at their watches." },
      { at: 22, headline: "The lecture is nearly over." },
    ],
    endings: {
      crowd: { title: "Twenty-One", text: "If twenty step forward, they are named and led off one by one, and the playground falls quiet again; if twenty-one step forward, three minutes later there are more than nine hundred.<br>The same silence — on opposite sides of a divide." },
      timeout: { title: "Dismissed", text: "No one else steps forward. The extra classes go ahead." },
    },
    history: "This example comes from Glances on the Road: A Phase-Transition Model of Silence, pp. 15–16: 1,000 people, tolerance limits uniformly distributed, punishment severity 1, punishment capacity 2%. Starting from 20 people, participation falls to zero in the first round; starting from 21, it runs to about 48, 580, 966, and finally approaches 980.",
    lesson: { title: "Property 8 · Critical seed", text: "The critical seed is a “ridge,” not some fixed “percentage of brave people.” Below it, small actions are pulled back into silence (Property 6); beyond it, the risk each person faces is spread across more and more people, and the cascade begins. Watching small actions fail again and again does not prove that a larger one would fail too." },
  });

  /* ============================================================
   * 第一章 · 厉王弭谤 (朝廷)
   * ============================================================ */
  LEVELS.push({
    id: 'liwang', chapter: "Chapter 1", title: "King Li Silences His Critics", era: "Western Zhou · c. 844 BC", place: "Haojing", icon: '🏯',
    side: 'regime', role: "King Li of Zhou",
    blurb: "You can make everyone fall silent. The question is: then what?",
    intro: [
      "You are King Li of Zhou. You have raised Duke Rong to power and claimed the wealth of the mountains, forests, rivers and marshes for the royal house — what the histories call the royal “monopoly.” The capital's people seethe with resentment; every street and alley is talking about you.",
      "The Duke of Shao warns: “The people can bear your commands no longer!”",
      "You have guards and punishments, and you can summon a shaman from Wei to listen for you. You can make them fall silent — the question is, <b>then what?</b>",
    ],
    quote: "To stop the people's mouths is more perilous than to dam a river. A dammed river that bursts will surely wound many; so it is with the people. — Guoyu, “Discourses of Zhou,” I",
    goalText: "Hold the throne for three years (36 months). Don't let the capital's people rise up, and don't let the guards defect.",
    tips: ["Every reading on the left is intelligence. The harsher the enforcement, the less people below dare tell the truth — and the less accurate the intelligence.", "A calm “public mood” does not mean real calm."],
    rounds: 36, scale: 50, arrestScale: 10, moodScale: 0.18,
    world: { N: 1200, tolType: 'bell', tolMul: 0.4, netType: 'random', netDeg: 6, P: 1.0, Pbar: 0.85, K0: 50, M: 60, alpha: 0.2, beta: 0.45, delta: 0.45, gamma: 4, memDecay: 0.025, vis: 1.0, omega: 0.8, globalScale: 1, noise: 0.01, hardCore: 0.002, seed: 842, psiScale: 1.2 },
    policies: { start: STD_POL, allow: { police: ['lean', 'normal', 'surge'] } },
    labels: { army: "Guards", crowd: "The people", plaza: "City market", prison: "Prison", barracks: "Palace", avenue: "Zhou Road" },
    policyNames: {
      info: { name: "Speech", options: { open: "Let them talk", spin: "Whitewash", blackout: "Only glances" } },
      police: { name: "Guards", options: { lean: "Cut back", normal: "Standing", surge: "Recruit more" } },
      release: { name: "Prison", options: { long: "Hold long", normal: "By statute", lenient: "Lenient" } },
    },
    cardNames: {
      informants: { name: "Shaman of Wei", text: "Bring in a shaman from Wei to watch those who speak against you. Whoever he names is put to death.", tags: ["See public grievance", "Takes the boldest first", "Accurate intel (for now)"] },
      editorial: { name: "Ban criticism", text: "Issue a royal decree: whoever speaks recklessly of the court's affairs shall be punished." },
      dialogue: { name: "Let them speak", text: "“Those who tend rivers clear the channels and let them flow; those who govern the people open the way and let them speak.” Have the ministers present poems, the blind musicians songs, and the common folk pass their words upward." },
      subsidy: { name: "End the monopoly", text: "Return the wealth of mountain, forest, river and marsh to the people. Royal revenue will shrink.", tags: ["Grievance ↓"] },
      bonus: { name: "Reward the guards", text: "Shower the guards with gifts, so they remember who feeds them." },
      amnesty: { name: "Amnesty", text: "Pardon the people held in prison." },
    },
    cards: ['informants', 'editorial', 'dialogue', 'subsidy', 'bonus', 'amnesty'],
    startAP: 2, income: 1.1,
    ai: { income: 0.8, every: 3, base: 0.012, smart: 0.8, aggression: 0.8, cards: ['rally', 'march', 'strike', 'memorial', 'leak'],
      chatter: ["In the market, people are talking about the royal “monopoly.”", "Someone sang a song mocking the king at the city gate.", "Women at the well are whispering; they scatter when the guards appear.", "“Duke Rong loves monopoly and knows nothing of the great calamity to come,” someone says."] },
    goal: { x: 0.3, d: 0.55, hold: 3 },
    stars: [
      { text: "Public grievance no worse than “Holding it in” after three years", test: (g) => g.meanGrievance() / g.moodScale < 0.3 },
      { text: "Fewer than 10% of the people arrested", test: (g) => g.sim.R < 0.1 },
    ],
    dateFmt: (r) => (EN ? `King Li, year ${34 + Math.floor(r / 12)}, month ${(r % 12) + 1}` : `King Li, year ${cnNum(34 + Math.floor(r / 12))}, month ${LUNAR_M[r % 12]}`),
    events: [
      { at: 0, title: "The People Revile the King", art: '🗣️', text: "The whole capital is talking about your “monopoly.” Some say you are fighting the people for profit; some say Duke Rong will bring ruin sooner or later.<br><br>This is the first month. What will you do? (Your policies are on the left; the actions you can take are on the right.)", choices: [{ label: "Wait and see" }] },
      { at: 2, title: "The Duke of Shao Remonstrates", art: '🧓', quote: "The people can bear your commands no longer!", text: "The Duke of Shao comes to tell you the people can bear no more.", choices: [
        { label: "Heed the Duke: let them speak", hint: "Immediate “Let them speak”: grievance falls, the line people accept moves up", run: (g) => g.selfCard('dialogue', "The king summons his ministers to hear the people's words.") },
        { label: "Bring the shaman to watch the talkers", hint: "One free “Shaman of Wei”; Enforcement → Harsh", run: (g) => { g.forcePolicy('enforce', 'harsh'); g.giveFree('informants', 3); } },
      ] },
      { at: 9, title: "Stopping the People's Mouths", art: '🌊', quote: "To stop the people's mouths is more perilous than to dam a river. A dammed river that bursts will surely wound many; so it is with the people.", text: g => {
        const q = g.pol.enforce === 'terror' || g.pol.enforce === 'harsh' || g.pol.info === 'blackout';
        return q ? "You tell the Duke of Shao: “I can put an end to slander — now they dare not speak.”<br><br>The Duke answered with the words above." : "The Duke of Shao remonstrates again, warning you: stopping the people's mouths is more dangerous than damming a river.";
      }, choices: [
        { label: "Open the channels of speech", hint: "Speech → Let them talk; one free “Let them speak”", run: (g) => { g.forcePolicy('info', 'open'); g.giveFree('dialogue', 3); } },
        { label: "The king will not listen", hint: "Nothing changes" },
      ] },
      { at: 20, title: "Rui Liangfu Remonstrates", art: '📜', quote: "Should a king take up monopoly? When a common man monopolizes, he is called a thief; if a king does it, few will remain loyal to him.", text: "The minister Rui Liangfu urges you to dismiss Duke Rong and end the monopoly.", choices: [
        { label: "End the monopoly", hint: "Grievance ↓, royal revenue ↓", run: (g) => { g.griefScale(0.8); g.bonusIncome -= 0.15; } },
        { label: "Make Duke Rong chief minister", hint: "Royal revenue ↑, grievance ↑", run: (g) => { g.bonusIncome += 0.2; g.griefAll(0.03); } },
      ] },
      { at: 30, news: (g) => (g.pol.enforce === 'harsh' || g.pol.enforce === 'terror') ? "The shaman reports: the people dare not speak; on the roads they meet with glances only." : "People still talk in the market, but quietly.", kind: 'intel' },
    ],
    endings: {
      survive: { title: "Three Years", text: (g) => {
        const m = g.meanGrievance() / g.moodScale;
        if (m < 0.3) return "Three years on, the people still talk — but no one wants to overthrow you.<br>The Duke of Shao said: “Those who tend rivers clear the channels and let them flow; those who govern the people open the way and let them speak.” You did it.";
        return "Three years have passed, and no one speaks on the roads.<br><br>You think you have ended the slander. But the hidden curve in the Debrief tells you: <b>the grievance never went away, and the tipping point kept falling.</b> In the histories, this is the very year of “in the third year, they exiled the king to Zhi.”";
      } },
      crowd: { title: "Exiled to Zhi", text: "The people rose together and stormed the palace. You fled Haojing all the way to Zhi (today's Huozhou, Shanxi), and never returned.<br><br>The last secret report you read said: all is calm." },
      army: { title: "The Guards Defect", text: "The guards lay down their weapons and side with the people. No one carries out your orders anymore." },
    },
    history: "The Guoyu (“Discourses of Zhou,” I) records: King Li was tyrannical, and the people reviled him. The king, enraged, found a shaman of Wei and set him to watch the critics; those he reported were put to death. The people dared not speak, and on the roads they met with glances only. The king was pleased and told the Duke of Shao: “I can put an end to slander — now they dare not speak.” … In the third year, they exiled the king to Zhi.<br><br>In 841 BC the people rose up and King Li fled. Ministers then governed jointly — the period known as the Gonghe (“Joint Harmony”) Regency. That year, the first of Gonghe, marks the beginning of precisely dated Chinese history.",
    lesson: { title: "Property 1 · Property 2: silence gives no warning, and repression leaves a debt", text: "Once punishment goes over the line people accept, every instance leaves a memory in the minds of those who watch. It does not show up as open participation, yet it lowers the number of people the next action will need. King Li saw a quiet record of behavior and mistook it for the nature of the whole system. Worse still: the harsher the enforcement, the less accurate the intelligence — people below dare not tell the truth." },
  });

  /* ============================================================
   * 第二章 · 彼得格勒 1917 (行动方)
   * ============================================================ */
  LEVELS.push({
    id: 'petrograd', chapter: "Chapter 2", title: "Bread and Soldiers", era: "February 1917 (Old Style)", place: "Petrograd", icon: '🥖',
    side: 'movement', role: "An underground organizer in a factory",
    blurb: "Order in the capital depends on whether peasant conscripts will still fire on people queuing for bread.",
    intro: [
      "The First World War enters its third winter. In the capital, Petrograd, long lines form outside the bakeries; wages cannot keep up with prices.",
      "More than 100,000 reserve troops are garrisoned in the city, most of them freshly conscripted peasant sons. Their brothers are at the front; their sisters are in the bread lines.",
      "The Tsar is far away at headquarters near the front. <b>Order in the capital depends on whether these soldiers will still fire on the crowds.</b>",
    ],
    goalText: "Before March 1 (Old Style), make the garrison defect (and hold for two half-days), or bring half the city onto the streets.",
    tips: ["The soldiers are watching how many are on the streets too. The more people, the more they falter; the more they falter, the safer the streets.", "Play “Win over troops” when the crowds are big."],
    rounds: 32, scale: 600, arrestScale: 40, moodScale: 0.2,
    world: { N: 1500, tolType: 'bell', tolMul: 0.41, netType: 'full', P: 1.0, Pbar: 0.7, K0: 47, M: 160, alpha: 0.4, beta: 0.55, delta: 0.1, gamma: 2, memDecay: 0.08, vis: 1, omega: 1, globalScale: 0.9, noise: 0, hardCore: 0.003, seed: 1917, psiScale: 1.25 },
    policies: { start: Object.assign({}, STD_POL, { info: 'spin' }) },
    labels: { army: "Garrison", crowd: "On the streets", plaza: "Znamenskaya Square", prison: "Kresty Prison", barracks: "Barracks", avenue: "Nevsky Prospect" },
    slogans: ["Bread!", "Down with the war!", "Down with autocracy!", "Brother soldiers!"],
    cards: ['rally', 'march', 'strike', 'fraternize', 'samizdat', 'legal', 'memorial'],
    cardNames: { samizdat: { name: "Leaflets", text: "Hand out leaflets at night outside factories and barracks." } },
    startAP: 2, income: 1.0,
    ai: { aggression: 0.7, income: 1.1, lag: 2, hold: 2, alertMul: 0.5, start: { enforce: 'normal', police: 'normal', info: 'spin' }, max: { police: 'surge', info: 'spin' }, cards: ['editorial', 'bonus', 'informants'] },
    goal: { x: 0.5, d: 0.6, hold: 3, dHold: 2 },
    stars: [
      { text: "Win before the night of February 27", test: (g) => g.round <= 27 },
      { text: "Fewer than 7,000 arrested", test: (g) => g.sim.R < 0.12 },
    ],
    // 俄历: 2月14日起每轮半天; 1917年2月只有28天
    dateFmt: (r) => { const d = 14 + Math.floor(r / 2), M = d > 28 ? 3 : 2, D = d > 28 ? d - 28 : d; return (EN ? `${MON[M - 1]} ${D} (O.S.) · ` : `${M}/${D} (O.S.) · `) + HALF(r); },
    events: [
      { at: 0, title: "The Third Winter", art: '❄️', text: "The Duma has opened; the deputies make speeches, and the lines outside the bakeries grow longer. Rumors spread that bread will be rationed.<br><br>You work in a factory on the Vyborg side. People grumble, but no one dares be the first to stop the machines.", choices: [{ label: "Begin" }] },
      { at: 8, title: "The Putilov Works", art: '🏭', text: "At the Putilov works, the biggest factory in the city, workers demand a raise. Management refuses.", choices: [
        { label: "Rally in support", hint: "One free “Small rally”", run: (g) => g.giveFree('rally', 2) },
        { label: "Wait a little", hint: "Save your strength" },
      ] },
      { at: 16, news: "The Putilov works locks out its workers. 30,000 are turned onto the streets.", kind: 'event', run: (g) => g.addSeeds(0.012) },
      { at: 18, title: "International Women's Day", art: '👩‍🏭', text: "Women textile workers on the Vyborg side walk out, shouting “Bread!” They run to the engineering works next door, bang on the windows and call the men to come out with them.", choices: [
        { label: "Join in force", hint: "Many take to the streets", run: (g) => g.addSeeds(0.05) },
        { label: "Follow in small numbers", hint: "A few people", run: (g) => g.addSeeds(0.02) },
      ] },
      { at: 22, title: "The Tsar's Telegram", art: '📨', quote: "I command you to put an end to the disorders in the capital by tomorrow. — Nicholas II to General Khabalov", text: "To the Tsar, these are nothing but “bread riots.” He orders them crushed.", choices: [{ label: '……' }], run: (g) => { g.forcePolicy('enforce', 'terror', 8, "Tsar's orders"); g.forcePolicy('police', 'surge', 8); } },
      { at: 24, title: "Shots Fired", art: '💥', text: "On Znamenskaya Square, the training detachment of the Volynsky Regiment is ordered to fire on the crowd. Dozens fall.<br><br>That night, no one in the barracks speaks.", choices: [{ label: "Continue" }], run: (g) => { g.forceOpp('crackdown', false); g.scalePsi(0.35, 0.75); } },
      { at: 26, if: (g) => g.d >= 0.2 && g.x >= 0.03, title: "The Volynsky Regiment", art: '🪖', text: "Before dawn, Sergeant Kirpichnikov of the Volynsky Regiment gathers the men: we will not fire on the people again. The officer who gave the order is shot dead. The soldiers pour out of the barracks to rouse the regiments next door.", choices: [{ label: "Brother soldiers!", run: (g) => g.scalePsi(0.3, 0.3) }] },
      { at: 26, if: (g) => !(g.d >= 0.2 && g.x >= 0.03), news: "In the barracks, they are still talking about yesterday's shooting. Some say that next time, they won't fire.", kind: 'army', run: (g) => g.scalePsi(0.15, 0.7) },
    ],
    endings: {
      army: { title: "The Garrison Defects", text: "Regiment after regiment, soldiers march into the streets with their rifles and stand with the workers. General Khabalov has no troops left who will obey.<br><br>Three days later, the Tsar abdicates." },
      crowd: { title: "The City Rises", text: "The whole city is in the streets. The police have gone into hiding; the prison gates are thrown open." },
      timeout: { title: "Order Restored", text: "The garrison held. Hunger slowly wore the strike away.<br>— But the memory remains." },
    },
    history: "On February 23, 1917 (Old Style; March 8 New Style), International Women's Day, women textile workers on the Vyborg side went on strike for bread. By February 25 it had become a citywide general strike. On February 26, troops fired on crowds at several points. On February 27, the Volynsky Regiment mutinied first; other regiments followed, the prisons were thrown open, and the forces at the government's disposal rapidly melted away. On March 2 (March 15 New Style), Nicholas II abdicated, ending the Romanov dynasty.",
    lesson: { title: "Property 4 · Two layers each stable alone can be unstable together", text: "The size of the crowd shakes the soldiers; the soldiers' refusal in turn lowers the risk the crowd faces. Check “is the crowd stable?” and “is the army stable?” separately, and you miss the one interaction that matters most. A mutiny changes not the headlines but the punishment capacity people face in every round that follows." },
  });

  /* ============================================================
   * 第三章 · 清明 1976 (行动方)
   * ============================================================ */
  LEVELS.push({
    id: 'qingming', chapter: "Chapter 3", title: "Qingming", era: "March 19 – April 5, 1976", place: "Beijing · Tiananmen Square", icon: '💮',
    side: 'movement', role: "A young worker at a Beijing factory",
    blurb: "In January, the mourning was suppressed. Three months on, the Qingming festival is coming.",
    intro: [
      "On January 8, 1976, Zhou Enlai died. The day his hearse passed along Chang'an Avenue, mourners lined the long avenue for miles; yet the mourning that followed was restricted at every level, and the newspapers carried pitifully little.",
      "Since the start of the year, the campaign to “Counterattack the Right-Deviationist Wind of Reversing Verdicts” has been intensifying, aimed at Deng Xiaoping. In late March, an article in Shanghai's Wenhui Bao was read by many as a veiled attack on the Premier.",
      "On March 19, teachers and pupils from a Beijing primary school laid a wreath at the Monument to the People's Heroes. <b>Qingming is coming.</b> One person who brings a wreath may be investigated by their work unit; but what if the whole city goes?",
    ],
    goalText: "Before the night of April 5, bring 30% of Beijing to the square to mourn, and hold for a day (two half-days).",
    tips: ["The mourning in January was suppressed, but the grief did not vanish — it is hidden in people's hearts. Qingming, and exposure, will bring it to the surface.", "Qingming is a day everyone knows: no one needs to coordinate — everyone knows which day to go.", "Work units will track down those who went to the square. The more people go, the less they can track."],
    rounds: 36, scale: 4000, arrestScale: 20, moodScale: 0.2, tipSpread: 0.3,
    randomEvents: ['mole', 'split', 'release', 'letter'],
    world: { N: 2000, tolType: 'bell', tolMul: 0.42, netType: 'clusters', netGroups: 40, P: 1.0, Pbar: 0.75, K0: 40, M: 150, alpha: 0.15, beta: 0.5, delta: 0.1, gamma: 1.5, memDecay: 0.05, vis: 0.7, omega: 0.6, globalScale: 0.5, noise: 0.01, hardCore: 0.002, seed: 1976, psiScale: 1.8, latentDecay: 0.005 },
    policies: { start: Object.assign({}, STD_POL, { info: 'blackout', enforce: 'harsh' }) },
    setup: (g) => { const s = g.sim; for (let i = 0; i < g.N; i++) s.latent[i] = 0.05 + s.rng() * 0.1; },   // 一月里被压住的悲痛
    labels: { army: "Militia", crowd: "In the square", plaza: "Monument to the People's Heroes", prison: "Public Security Bureau", barracks: "Working People's Cultural Palace", avenue: "Chang'an Avenue" },
    slogans: ["Mourn the Premier", "Give back our wreaths!", "Brows raised, sword drawn"],
    cards: ['memorial', 'samizdat', 'rally', 'march', 'network', 'lowkey', 'leak'],
    cardNames: {
      memorial: { name: "Lay a wreath", text: "Make a wreath of white paper, write elegiac couplets, and lay it at the Monument." },
      samizdat: { name: "Copy poems", text: "Poems cover the Monument on every side. People copy them line by line into notebooks and carry them back to work and home." },
      rally: { name: "Go to the Monument", text: "After work, go and stand in the square awhile, and look at the wreaths and the poems." },
      march: { name: "Whole workshop goes", text: "Your workmates shoulder wreaths and march in file to the square." },
      network: { name: "Organize the factory", text: "Workshops, teams and classmates agree to go together." },
      lowkey: { name: "Stay anonymous", text: "Couplets name no work unit; poems bear no signature." },
      leak: { name: "Slogans on trains", text: "Students in Nanjing paint slogans on Beijing-bound trains. The carriages are scrubbed; the slogans are painted again. The news travels down the railway.", when: (g) => g.round >= 18, whenText: "Wait for news from Nanjing (around March 28)" },
    },
    startAP: 2, income: 1.0,
    ai: { aggression: 0.7, alertMul: 0.6, income: 1.2, lag: 2, start: { enforce: 'harsh', police: 'normal', info: 'blackout', target: 'uniform' }, max: { police: 'surge' }, cards: ['editorial', 'informants', 'bonus'] },
    oppSay: { editorial: "People's Daily: beware the “handful” stirring up trouble in the name of mourning.", informants: "Work units are investigating: who went to the square, who copied poems.", bonus: "The Capital Militia Command holds a mobilization meeting." },
    goal: { x: 0.3, hold: 2 },
    stars: [
      { text: "Do it before Qingming (April 4)", test: (g) => g.round <= 31 },
      { text: "Fewer than 2,000 arrested", test: (g) => g.sim.R < 0.05 },
    ],
    dateFmt: halfDayFmt(1976, 3, 19),
    events: [
      { at: 0, title: "The First Wreath", art: '💮', text: "On March 19, teachers and pupils from a primary school laid a wreath at the Monument to the People's Heroes.<br><br>In January, mourning for the Premier was restricted at every level. But people have not forgotten. The Monument stands there — whether to go is each person's own business; how many go is everyone's.", choices: [{ label: "Begin" }] },
      { at: 18, title: "Nanjing", art: '🚂', text: "In Nanjing, students and residents go to Yuhuatai to mourn the Premier, then paint slogans such as “Down with Zhang Chunqiao” on Beijing-bound trains. The stations send people to scrub them off; the slogans are painted again.<br><br>When the trains pull into Beijing Station, the writing on the carriages can still be read.", choices: [
        { label: "Spread the word", hint: "“Slogans on trains” free · Regime alert +6", run: (g) => { g.giveFree('leak', 3); g.addAlert(6); } },
        { label: "Keep quiet for now", hint: "Save your strength" },
      ] },
      { at: 28, news: "Work units relay an order from above: no wreaths at Tiananmen Square.", kind: 'opp', run: (g) => { g.forcePolicy('info', 'blackout', 6, "Unit orders"); g.forceOpp('editorial', false); } },
      { at: 30, news: "The wreaths around the Monument pile higher; the pine hedges are hung with poems.", kind: 'crowd', run: (g) => g.giveFree('samizdat', 2) },
      { at: 32, title: "Qingming", art: '🌸', text: "April 4, a Sunday: Qingming. From dawn to dusk, people stream into the square. Wreaths climb the Monument's steps tier upon tier, and someone stands up high to recite:<br><br>“I would grieve, but hear the demons shriek; / I weep, while wolves and jackals laugh. / With tears I honor a hero — / brows raised, I draw my sword.”", choices: [
        { label: "Whole family goes", hint: "Many come to the square · suppressed grief surfaces", run: (g) => { g.addSeeds(0.05); g.sim.reveal(0.4); } },
        { label: "Lay a wreath yourself", hint: "A few people · some grief surfaces", run: (g) => { g.addSeeds(0.02); g.sim.reveal(0.2); } },
      ] },
      { at: 33, title: "The Wreaths Are Gone", art: '🚚', text: "Late on April 4, the Politburo declares this a “counterrevolutionary” incident. That night the wreaths at the Monument are hauled away by the truckload, the poems torn down, and those keeping vigil taken away.", choices: [{ label: '……' }], run: (g) => { g.griefAll(0.04); g.sim.reveal(0.5); g.addAlert(30); g.forcePolicy('enforce', 'terror', 4, "“Counterrevolutionary”"); } },
      { at: 34, title: "Give back our wreaths!", art: '🔥', text: "April 5, a Monday. Those who hurry to the square at dawn find the wreaths gone. “Give back our wreaths! Give back our comrades!” The crowd surrounds the small building at the square's southeast corner (the joint command post); a loudspeaker van is overturned, and the building catches fire.", choices: [
        { label: "Stay in the square", hint: "Draws many out · the square will be cleared tonight", run: (g) => g.addSeeds(0.04) },
        { label: "Home before dark", hint: "Protect yourself" },
      ] },
      { at: 35, title: "The Night of April 5", art: '🌑', text: "From 6:30 p.m., loudspeakers on the square replay a broadcast speech by Wu De, First Secretary of the Beijing Party Committee, ordering people to leave. A little after 9 p.m., every light on the square blazes on at once — more than 10,000 militiamen, together with police and garrison troops, charge into the square with clubs.", choices: [{ label: '……' }], run: (g) => { g.forcePolicy('police', 'martial', 9, "Clearance"); g.forceOpp('crackdown', false); } },
    ],
    endings: {
      crowd: { title: "The People's Mourning", text: "Around Qingming, the people who came to the square numbered in the millions. Wreaths, couplets and poems ringed the Monument layer upon layer.<br><br>On the night of April 5 the square was cleared; two days later Deng Xiaoping was stripped of all his posts, and the mourning was branded a “counterrevolutionary incident.”<br>But it was not forgotten. In November 1978, the Beijing Party Committee declared the Tiananmen Incident “entirely a revolutionary action.” The poems were later collected in the anthology “Tiananmen Poems.”" },
      timeout: { title: "The Wreaths Were Taken", text: "On the night of April 5, the square was cleared. Not enough people came; the mourning never became the whole city's cause.<br><br>— Yet the memory lives on in people's hearts. Two years later, the verdict on the incident was reversed." },
    },
    history: "Zhou Enlai died on January 8, 1976; the mourning that followed was restricted. In late March, an article in the Wenhui Bao angered people in Nanjing, Beijing and elsewhere; students in Nanjing painted slogans on Beijing-bound trains. From the end of March, people came in growing numbers to lay wreaths and post poems at the Monument to the People's Heroes in Tiananmen Square, peaking on April 4, the Qingming festival. That night the Politburo branded it a counterrevolutionary incident, and the wreaths were cleared away overnight. On April 5, crowds clashed with the personnel keeping order; that evening militia, police and garrison troops cleared the square, and many were beaten and arrested. On April 7, Deng Xiaoping was stripped of all posts inside and outside the Party. In November 1978, the Beijing Party Committee declared the Tiananmen Incident “entirely a revolutionary action.”",
    lesson: { title: "Property 6 · Small actions can be pulled back into the same low state", text: "In January, mourning was pressed back into silence again and again: each small action ended with only those already willing to bear the full cost. But “seeing small actions fail to spread, over and over” shows only that they did not clear the relevant barrier; it does not prove a larger action would fail too. Qingming was a day everyone knew, and on that day the suppressed grief rose to the surface — changing exactly the judgment that “others will go too,” and the cost people were willing to bear." },
  });

  /* ============================================================
   * 第四章 · 伊朗 1978 (行动方)
   * ============================================================ */
  LEVELS.push({
    id: 'iran', chapter: "Chapter 4", title: "Forty Days", era: "January 1978 – February 1979", place: "Qom · Tabriz · Tehran", icon: '🕯️',
    side: 'movement', role: "The opposition network",
    blurb: "The dead are mourned on the fortieth day. If more die at the mourning, forty days later comes another.",
    intro: [
      "In January 1978, a state newspaper runs an article insulting the exiled religious leader. Seminary students in the holy city of Qom march in protest; the police open fire.",
      "By Shi'a custom, the dead are mourned on the fortieth day after death — the “fortieth” (chehelom). The fortieth for Qom's dead will be held in another city.",
      "<b>If more are killed at the mourning, their fortieth will come forty days later.</b>",
    ],
    goalText: "Before February 1979, get the army to declare neutrality, or bring half the country onto the streets.",
    tips: ["Every crackdown brings a peak of “fortieth-day” mourning about six weeks later — prepare ahead.", "An oil workers' strike can cut the Shah's purse strings."],
    rounds: 57, scale: 3000, arrestScale: 60, moodScale: 0.25,
    world: { N: 2000, tolType: 'bimodal', tolMul: 0.45, netType: 'random', netDeg: 8, P: 1.0, Pbar: 0.7, K0: 50, M: 150, alpha: 0.25, beta: 0.5, delta: 0.2, gamma: 1.0, memDecay: 0.5, vis: 0.8, omega: 0.8, globalScale: 0.7, noise: 0.01, hardCore: 0.003, seed: 1978, psiScale: 1.7, kernel: 'memorial', memPeak: 6, memPeakAmp: 3 },
    policies: { start: Object.assign({}, STD_POL, { info: 'spin', target: 'organizer' }) },
    labels: { army: "Army", crowd: "On the streets", plaza: "Jaleh Square", prison: "Evin Prison", barracks: "Barracks", avenue: "Shah Reza Avenue" },
    slogans: ["The fortieth day!", "Down with the Shah!", "Independence, freedom!"],
    cards: ['rally', 'march', 'cassette', 'memorial', 'strike', 'fraternize', 'samizdat'],
    cardNames: { memorial: { name: "Fortieth-day mourning", text: "Hold the fortieth-day mourning for the dead at the mosque. When it ends, people will walk out into the streets." } },
    startAP: 2, income: 0.9,
    ai: { aggression: 0.55, income: 1.2, lag: 3, start: { enforce: 'normal', police: 'normal', info: 'spin', target: 'organizer' }, cards: ['informants', 'crackdown', 'amnesty', 'dialogue', 'bonus', 'editorial'] },
    goal: { x: 0.5, d: 0.55, hold: 3, dHold: 2 },
    stars: [
      { text: "Win before the end of 1978", test: (g) => g.round <= 50 },
      { text: "Fewer than 18,000 arrested", test: (g) => g.sim.R < 0.15 },
    ],
    dateFmt: weekFmt(1978, 1, 9),
    events: [
      { at: 0, title: "Qom", art: '🕌', text: "Seminary students in Qom take to the streets against a state newspaper's insult to the exiled religious leader. The police open fire.<br><br>The fortieth day for the dead will come in about six weeks.", choices: [{ label: "Remember them" }], run: (g) => { g.forceOpp('crackdown', false); g.addSeeds(0.02); } },
      { at: 6, news: "Tabriz: the fortieth-day mourning for Qom's dead turns into riots.", kind: 'event', run: (g) => g.giveFree('memorial', 2) },
      { at: 11, news: "Yazd and other cities: the fortieth day for the dead of Tabriz.", kind: 'event' },
      { at: 32, title: "Cinema Rex", art: '🔥', text: "Cinema Rex in Abadan is set on fire; more than 400 people are trapped inside and burned to death.<br><br>It is widely believed that SAVAK, the secret police, did it. (A trial after the revolution found that the arsonists were Islamist militants.)", choices: [{ label: "Continue" }], run: (g) => { g.griefAll(0.05); } },
      { at: 34, title: "Black Friday", art: '🩸', text: "The Shah declares martial law. In Tehran's Jaleh Square, where many have not yet heard of the decree, troops open fire on the crowd.", choices: [{ label: "Continue" }], run: (g) => { g.forcePolicy('police', 'martial', 12, "Martial law"); g.forceOpp('crackdown', false); } },
      { at: 40, title: "The Oil Strike", art: '🛢️', text: "Workers in the southern oil fields strike, cutting the state's financial lifeline.", choices: [{ label: "Back the strike", hint: "Free “General strike”; regime income falls for the long term", run: (g) => { g.giveFree('strike', 3); g.flags.oilStrike = true; } }] },
      { at: 48, title: "Ashura", art: '🟩', text: "Tasua and Ashura in the Islamic calendar. On the streets of Tehran, the marchers number in the millions.", choices: [{ label: "Take to the streets", run: (g) => g.addSeeds(0.08) }] },
      { at: 53, if: (g) => g.x > 0.1, news: "The Shah has left Iran — “on vacation abroad,” supposedly.", kind: 'event' },
    ],
    modParams: (m, g) => { if (g.flags.oilStrike && g.side === 'movement') g.opp.ap = Math.max(0, g.opp.ap - 0.02); },
    endings: {
      army: { title: "The Army Stands Aside", text: "On February 11, 1979, the Supreme Military Council declared the army neutral in the political conflict. The old regime collapsed.<br><br>— But a successful spark does not mean a happy ending." },
      crowd: { title: "The Nation Rises", text: "The streets are a sea of people. The Shah's government can no longer quiet a single city.<br><br>— But a successful spark does not mean a happy ending." },
      timeout: { title: "The Throne Stands", text: "The Shah held on. Mourning after mourning was held, and dispersed." },
    },
    history: "On January 9, 1978, a protest by seminary students in Qom was met with gunfire. On February 18, the fortieth-day mourning in Tabriz turned into riots; mourning in Yazd and other cities followed on the same forty-day rhythm. On August 19, Cinema Rex in Abadan burned. On September 8 (“Black Friday”), troops opened fire in Tehran's Jaleh Square under martial law. In the autumn, the oil workers struck. At Tasua and Ashura in December, millions marched in Tehran. On January 16, 1979, the Shah left the country; on February 11, the army declared its neutrality.<br><br>The Islamic Republic established after the revolution soon purged its former allies. In 1988, thousands of political prisoners were secretly executed. In 2022, Mahsa Amini died in the custody of the morality police, and the slogan “Woman, Life, Freedom” rang out across Iran once more.",
    lesson: { title: "Delayed memory kernel · The flip side of Property 7", text: "Simple exponential decay cannot explain why new gatherings appear exactly forty days apart. A fixed one-dimensional rule only converges monotonically; it cannot generate cycles on its own. The periodicity comes from ritual, organization and time lags. Memory does not just fade smoothly — it keeps its own calendar." },
  });

  /* ============================================================
   * 第五章 · 波兰 1981 (朝廷)
   * ============================================================ */
  LEVELS.push({
    id: 'poland', chapter: "Chapter 5", title: "The Night of Martial Law", era: "December 1981 – October 1982", place: "Warsaw · Gdańsk · Katowice", icon: '❄️',
    side: 'regime', role: "Military Council of National Salvation",
    blurb: "Tanks roll into the streets; the people on the lists vanish overnight. You can make the country quiet — at what cost?",
    intro: [
      "Ten million people have joined Solidarity — nearly a third of the country's working-age population. Moscow is applying pressure; there are military exercises on the border.",
      "Late on December 12, 1981, you order martial law. Radio, television and telephones are seized; <b>more than 3,000 people are interned on the first night</b>, among them Solidarity's leading figures.",
      "Every hard-line policy is already switched on — but they cost too much, and you cannot sustain them for long. When to ease off, and on what, is your call.",
    ],
    goalText: "Hold out until October 1982 without letting mass protest or army insubordination spin out of control.",
    tips: ["Martial law, internment by list, the news blackout — each one costs money. Before your resources run out, you must choose which to keep.", "Preventive detention seizes “those most likely to step forward” — it removes the top of the distribution."],
    rounds: 44, scale: 5000, arrestScale: 100, moodScale: 0.2,
    world: { N: 2000, tolType: 'uniform', tolMul: 0.25, netType: 'clusters', netGroups: 40, P: 1.0, Pbar: 0.8, K0: 50, M: 200, alpha: 0.2, beta: 0.4, delta: 0.08, gamma: 1.3, memDecay: 0.06, vis: 0.8, omega: 0.6, globalScale: 1, noise: 0.01, hardCore: 0.004, seed: 1981, psiScale: 1.5, netDamage: 0.5 },
    policies: { start: { enforce: 'harsh', police: 'martial', target: 'preventive', info: 'blackout', release: 'long' } },
    setup: (g) => g.flagTop(0.08),   // 团结工会的积极分子早已在案
    labels: { army: "Security forces", crowd: "On the streets", plaza: "Victory Square", prison: "Internment camp", barracks: "ZOMO base", avenue: "Nowy Świat" },
    slogans: ["Solidarity!", "The winter is yours, the spring will be ours!", "Free the internees!"],
    cards: ['informants', 'editorial', 'crackdown', 'amnesty', 'dialogue', 'subsidy', 'bonus', 'cutnet'],
    startAP: 4, income: 1.15,
    ai: { income: 1.0, every: 3, base: 0.012, smart: 0.65, aggression: 0.75, orgRate: 1.6, cards: ['rally', 'march', 'strike', 'samizdat', 'memorial', 'leak', 'legal'],
      chatter: ["Underground papers are passed around the factories.", "Someone has painted a V on a wall.", "Mass is more crowded than usual.", "At 7:30 p.m., people switch off their TVs and go out for a walk — boycotting the official news."] },
    goal: { x: 0.3, d: 0.5, hold: 3, dHold: 2 },
    stars: [
      { text: "Public grievance no worse than “Aggrieved” at the end", test: (g) => g.meanGrievance() / g.moodScale < 0.55 },
      { text: "Fewer than 10,000 detained", test: (g) => g.sim.R < 0.05 },
    ],
    dateFmt: weekFmt(1981, 12, 13),
    events: [
      { at: 0, title: "December 13", art: '📺', text: "At dawn, an announcer in military uniform appears on television. You yourself declare on the radio: the country is in a state of war.<br><br>Tanks and armored vehicles fill the streets. The people on the lists are being taken away one by one.", choices: [{ label: "Begin" }] },
      { at: 1, title: "The Wujek Mine", art: '⛏️', text: "At the Wujek mine in Katowice, the miners occupy the pit in a strike against martial law.", choices: [
        { label: "Send in the riot police", hint: "Streets clear fast; grievance ↑↑", run: (g) => g.selfCard('crackdown', "ZOMO storms the Wujek mine. Nine miners are killed.") },
        { label: "Surround it, cut water and power, wait them out", hint: "Their morale ↑", run: (g) => { g.opp.ap = Math.min(g.apCap, g.opp.ap + 2); } },
      ] },
      { at: 18, news: "Underground Solidarity forms a Temporary Coordinating Commission.", kind: 'event', run: (g) => { g.L.ai.income = 1.25; } },
      { at: 20, title: "May 3", art: '🇵🇱', text: "Constitution Day. Informers report: demonstrations are likely in the major cities.", choices: [{ label: "Understood" }], run: (g) => g.addSeeds(0.02 + 0.03 * Math.min(1.5, g.meanGrievance() / g.moodScale)) },
      { at: 37, title: "August 31", art: '⚓', text: "The second anniversary of the Gdańsk Agreement. Solidarity's underground leadership calls for nationwide demonstrations.", choices: [{ label: "Prepare" }], run: (g) => g.addSeeds(0.025 + 0.045 * Math.min(1.5, g.meanGrievance() / g.moodScale)) },
      { at: 43, news: "The Sejm passes a new trade union law; Solidarity is formally banned.", kind: 'event' },
    ],
    endings: {
      survive: { title: "Winter Is Over", text: (g) => {
        const m = g.meanGrievance() / g.moodScale;
        return (m < 0.55 ? "You held on, and you did not crush the country too hard." : "You held on. The streets are quiet; the factories are back at work.<br>But the Debrief tells you: the grievance never went away — it only went underground.") +
          "<br><br>Martial law was lifted in July 1983. Strikes swept the country again in 1988; in the semi-free elections after the 1989 Round Table, Solidarity won almost every seat open to competition.";
      } },
      crowd: { title: "Spring Comes Too Soon", text: "The demonstrations can no longer be held down. Factories, ports and mines stop all at once." },
      army: { title: "The Forces Refuse", text: "More and more of the security forces refuse to lift a hand against the workers. Martial law has lost its meaning." },
    },
    history: "On December 13, 1981, Jaruzelski declared martial law. More than 3,000 people were interned the first night, and about 10,000 over the months that followed. On December 16, riot police (ZOMO) stormed the Wujek mine, killing nine miners. Solidarity went underground; demonstrations in May and August 1982 were broken up, and in October Solidarity was formally banned. Martial law was lifted in July 1983. After the 1989 Round Table, Solidarity won almost every seat open to competition in semi-free elections.",
    lesson: { title: "Property 9 · Whom you arrest matters more than how many", text: "Preventive detention by list removes the top of the distribution and cuts the key links in the network — none of which fits into a single variable called “higher punishment.” It really can hold action down. But once punishment goes over the line people accept, memory accumulates; holding action down is not the same as removing the conditions for the next action." },
  });

  /* ============================================================
   * 第六章 · 首尔 1987 六月抗争 (行动方)
   * 1—5月每轮一周, 6月每轮一天: 时间在六月慢了下来
   * ============================================================ */
  const seoulFmt = (r) => (r < 20 ? weekFmt(1987, 1, 14)(r) : dayFmt(1987, 6, 1)(r - 20));
  LEVELS.push({
    id: 'seoul', chapter: "Chapter 6", title: "June", era: "January 14 – June 30, 1987", place: "Seoul · Myeongdong · Nationwide", icon: '👔',
    side: 'movement', role: "A student at a Seoul university, later an organizer for the National Movement Headquarters",
    blurb: "A student died in an interrogation room. The police said: “We banged on the desk, and he went ‘ugh!’ and dropped.”",
    intro: [
      "On January 14, 1987, Park Jong-chul, a student at Seoul National University, died under interrogation in the police anti-communist unit at Namyeong-dong. The police version: “We banged on the desk, and he went ‘ugh!’ and dropped.”",
      "General Chun Doo-hwan came to power over the blood of Gwangju in 1980. Under the constitution the president is chosen indirectly, by an “electoral college”—and next year he will hand power to a successor of his own choosing.",
      "What people want is a constitution that lets them vote for their president. <b>Will one death be buried, or remembered?</b>",
    ],
    goalText: "Before the end of June, get more than a third of the country onto the streets and hold for two days—force the regime to accept direct presidential elections.",
    tips: ["Park Jong-chul's death is being covered up: the grief and anger lie hidden in people's hearts. “Expose the truth” can bring them to the surface—the later it comes out, the harder for the regime to contain; the sooner, the sooner it is smothered.", "Before June each turn is a week; in June each turn is a day. Save your strength for June.", "Myeongdong Cathedral is one place the police dare not enter. Once the middle class (the “Necktie brigade”) joins in, it is no longer just the students' fight."],
    rounds: 50, scale: 5000, arrestScale: 25, moodScale: 0.2, tipSpread: 0.3,
    randomEvents: ['death', 'mole', 'press', 'writer', 'split', 'release'],
    world: { N: 2000, tolType: 'bell', tolMul: 0.34, netType: 'clusters', netGroups: 30, P: 1.0, Pbar: 0.7, K0: 55, M: 160, alpha: 0.2, beta: 0.5, delta: 0.15, gamma: 1.8, memDecay: 0.06, vis: 0.6, omega: 0.6, globalScale: 0.55, noise: 0.01, hardCore: 0.004, seed: 1987, psiScale: 1.6, latentDecay: 0.01 },
    policies: { start: Object.assign({}, STD_POL, { enforce: 'harsh', police: 'surge', info: 'spin', target: 'organizer' }) },
    labels: { army: "Riot police", crowd: "On the streets", plaza: "Myeongdong Cathedral", prison: "Namyeong-dong", barracks: "Barracks", avenue: "Sejong-daero" },
    slogans: ["Down with dictatorship!", "Scrap the April 13 measure!", "Bring back Jong-chul!", "Direct elections!"],
    cards: ['rally', 'march', 'memorial', 'leak', 'network', 'fraternize', 'sanctuary', 'necktie'],
    cardNames: {
      memorial: { name: "Memorial Service", text: "Hold a memorial service for Park Jong-chul. When it ends, people will walk out into the streets." },
      leak: { name: "Expose the truth", text: "Get the hidden details of the interrogation into the hands of priests and reporters. A blackout never holds down the memory—only its telling." },
      network: { name: "Campus & Church", text: "Student councils, churches, the opposition party: the same day, the same hour." },
      fraternize: { name: "Talk to Riot Police", text: "“You're young men who got drafted too.” Speak to the faces behind the shields." },
    },
    startAP: 2, income: 1.0,
    ai: { aggression: 0.75, income: 1.2, lag: 2, start: { enforce: 'harsh', police: 'surge', info: 'spin', target: 'organizer' }, max: { police: 'surge', enforce: 'harsh' }, cards: ['editorial', 'informants', 'crackdown', 'bonus'] },
    oppSay: { editorial: "Government spokesman: a handful of “leftist elements” are trying to overthrow the state.", informants: "Plainclothes police take photographs on campus, logging the faces of protesters.", crackdown: "The riot police fire tear gas, volley after volley.", bonus: "The riot police units get extra pay." },
    goal: { x: 0.35, hold: 2 },
    stars: [
      { text: "Do it by June 20", test: (g) => g.round <= 39 },
      { text: "Fewer than 5,000 taken away", test: (g) => g.sim.R < 0.05 },
    ],
    dateFmt: seoulFmt,
    setup: (g) => { g.flags.necktie = false; },
    events: [
      { at: 0, title: "Namyeong-dong", art: '🚿', text: "On January 14, Park Jong-chul, a linguistics student at Seoul National University, was taken to the anti-communist unit of the police security headquarters at Namyeong-dong and questioned about where an older fellow student was hiding. He did not tell.<br><br>The next day the police announced that he had died of “shock”: “We banged on the desk, and he went ‘ugh!’ and dropped.”<br>The doctor who examined him saw something else.", choices: [{ label: "Remember him" }], run: (g) => { const s = g.sim; for (let i = 0; i < g.N; i++) s.latent[i] += 0.06 + s.rng() * 0.06; g.griefAll(0.01); } },
      { at: 13, title: "The April 13 Measure", art: '📺', text: "On April 13, Chun Doo-hwan made a special address: debate on revising the constitution was over, to be taken up again after next year's Seoul Olympics. Next year's president would still be chosen by the electoral college.<br><br>Which meant: his hand-picked successor would win an election with no opponent.", choices: [
        { label: "Sign in protest", hint: "Professors, priests and writers issue statement after statement · grievance rising", run: (g) => { g.griefAll(0.03); g.giveFree('network', 2); } },
        { label: "Stay silent", hint: "Save your strength" },
      ] },
      { at: 18, title: "May 18", art: '⛪', text: "May 18, at a Mass on the seventh anniversary of the Gwangju Uprising: the Catholic Priests' Association for Justice read out a statement. The police had covered up the truth about Park Jong-chul's death—more than two officers took part in the torture, their superiors knew, and scapegoats were arranged to take the fall.", choices: [
        { label: "Tell the whole nation", hint: "Buried grief and anger surface · everyone sees", run: (g) => { g.sim.reveal(0.7); g.addEffect({ id: 'priests', name: "Priests' statement", icon: '⛪', side: 'movement', rounds: 3, mod(m) { m.vis = Math.max(m.vis, 1); m.gs = Math.min(1, m.gs + 0.3); } }); } },
      ] },
      { at: 28, title: "Lee Han-yeol", art: '🩸', text: "June 9, outside the gates of Yonsei University. A student, Lee Han-yeol, was struck in the back of the head by a tear-gas canister fired straight into the crowd, and fell into a classmate's arms. The photograph ran in the papers the next day.<br><br>Tomorrow the ruling party will nominate Roh Tae-woo as its presidential candidate.", choices: [
        { label: "March tomorrow", hint: "“Mass march” free · grievance rising", run: (g) => { g.griefAll(0.04); g.giveFree('march', 2); } },
      ] },
      { at: 29, title: "June 10", art: '📣', text: "June 10: in a gymnasium, the ruling party nominates Roh Tae-woo. At the same hour, the “National Rally to Denounce the Torture-Killing Cover-up and Scrap the Constitution Protection” is held in more than twenty cities.<br><br>At dusk, protesters driven off the streets fall back into Myeongdong Cathedral.", choices: [
        { label: "Hold Myeongdong", hint: "“Myeongdong sit-in” free", run: (g) => { g.addSeeds(0.025); g.giveFree('sanctuary', 3); } },
      ] },
      { at: 31, news: "At lunchtime, office workers in neckties step out of the downtown towers to applaud the marchers.", kind: 'crowd', run: (g) => { g.flags.necktie = true; g.giveFree('necktie', 2); } },
      { at: 38, title: "June 19", art: '🪖', text: "It was later revealed that on this morning Chun Doo-hwan ordered the army to prepare to move into Seoul and other cities.<br><br>The same day, US Ambassador James Lilley delivered a personal letter from President Reagan. Next year is the Seoul Olympics. The whole world is watching.", choices: [{ label: '……' }], run: (g) => {
        if (g.x >= 0.06 || g.d >= 0.15) { g.log("That evening, the order to send in the troops was withdrawn.", 'army'); g.L.ai.aggression = 0.5; g.scalePsi(0.3, 0.8); }
        else { g.log("The army has moved into the cities.", 'opp'); g.flags.martialLaw = true; g.L.ai.max = {}; g.forcePolicy('police', 'martial', 99, "Troops deployed"); g.forcePolicy('enforce', 'terror', 99, "Troops deployed"); g.forceOpp('crackdown', false); }
      } },
      { at: 45, news: "June 26, the “Great National Peace March”: more than a million people on the streets in over thirty cities.", kind: 'crowd', run: (g) => g.addSeeds(0.035) },
    ],
    endings: {
      crowd: { title: "The June 29 Declaration", text: "On June 29, Roh Tae-woo, the ruling party's presidential candidate, issued the “June 29 Declaration”: direct presidential elections, an amnesty for Kim Dae-jung, civil rights restored to political prisoners, guarantees of press freedom…<br><br>On July 9, more than a million people saw Lee Han-yeol off at his funeral. In December, South Korea held its first direct presidential election in sixteen years." },
      timeout: { title: "The Constitution Stands", text: "Not enough people on the streets, not for long enough. The “constitution protection” measure held, and next year's president will still be chosen by the electoral college.<br><br><b>This is not history.</b> In history, the June streets finally forced the regime to give way." },
    },
    history: "On January 14, 1987, Seoul National University student Park Jong-chul died under water torture in the anti-communist unit of the police security headquarters at Namyeong-dong. The police first claimed that “we banged on the desk and he dropped,” then admitted to torture, but implicated only two officers. On April 13, Chun Doo-hwan announced his “constitution protection” measure, refusing to amend the constitution. On May 18, the Catholic Priests' Association for Justice exposed the police cover-up. On May 27, the National Movement Headquarters for a Democratic Constitution was founded. On June 9, Yonsei University student Lee Han-yeol was hit in the head by a tear-gas canister (he died on July 5). From June 10, mass demonstrations broke out across the country; the sit-in at Myeongdong Cathedral lasted for days, and office workers joined the streets. It was later revealed that on June 19 Chun ordered the army to prepare to deploy, then withdrew the order. On June 26, the “Great National Peace March” swept the country. On June 29, Roh Tae-woo issued the “June 29 Declaration,” accepting direct presidential elections.",
    lesson: { title: "Property 3 · Whether a punishment brings in more participants can be stated as an explicit local condition", text: "“The harder they crack down, the harder people push back” does not always hold. Backlash needs two conditions at once: the event must be strong enough to change people's willingness to take part, and enough people must happen to be sitting near the current threshold. In January, Park Jong-chul's death did not bring an immediate mass march; after April 13 and May 18, more and more people gathered near the threshold—and so, in June, a single tear-gas canister brought out many times more." },
  });

  /* ============================================================
   * 第七章 · 北京 1989 (行动方)
   * ============================================================ */
  LEVELS.push({
    id: 'beijing', chapter: "Chapter 7", title: "The Turn of Spring and Summer", era: "April 15 – June 4, 1989", place: "Beijing", icon: '🎓',
    side: 'movement', role: "The Beijing Students' Autonomous Federation",
    blurb: "A million people took to the streets, and the regime did not fall. It was the soldiers driving into the city who decided the ending.",
    intro: [
      "On April 15, 1989, Hu Yaobang, former General Secretary of the Chinese Communist Party, died. Beijing's university students went, unbidden, to Tiananmen Square to mourn him.",
      "Mourning soon turned into petition: against corruption, for press freedom, for dialogue with the government on equal terms.",
      "The next fifty days will bring an editorial, a hunger strike, martial law. <b>In this level, no crowd is ever big enough—the real question is: will the army fire on the people?</b>",
    ],
    goalText: "Before June 4, get the martial-law troops to defect (army morale at “defect en masse,” held for two days).",
    tips: ["The number of people in the streets affects the soldiers, but numbers alone will not break an army.", "Under martial law, “Stop the convoys” and “Win over troops” are your most important cards.", "The regime may bring in troops with no ties to the city—they will not talk to the crowd."],
    rounds: 50, scale: 1000, arrestScale: 8, moodScale: 0.2, tipSpread: 0.35,
    world: { N: 2000, tolType: 'bell', tolMul: 0.9, tolAdd: -0.45, netType: 'clusters', netGroups: 30, P: 1.0, Pbar: 0.9, K0: 30, M: 200, alpha: 0.25, beta: 0.5, delta: 0.2, gamma: 1.8, memDecay: 0.1, vis: 0.9, omega: 0.7, globalScale: 0.8, noise: 0.01, hardCore: 0.004, seed: 1989, psiScale: 1.9 },
    policies: { start: Object.assign({}, STD_POL, { info: 'spin', enforce: 'lenient', police: 'lean' }) },
    troopPsi: 2.55,
    labels: { army: "Security forces", crowd: "In the square", plaza: "Tiananmen Square", prison: "Custody & Investigation", barracks: "Outskirts camp", avenue: "Chang'an Avenue" },
    slogans: ["Down with corruption!", "Freedom of the press!", "Dialogue!", "The People's Army loves the people!", "Long live democracy!"],
    cards: ['rally', 'march', 'mobilize', 'hunger', 'fraternize', 'blockade', 'goddess', 'memorial', 'samizdat', 'legal'],
    startAP: 2, income: 1.0,
    ai: { aggression: 0.3, alertMul: 0.35, income: 1.2, lag: 2, start: { enforce: 'lenient', police: 'lean', info: 'spin' }, max: { police: 'normal', enforce: 'normal' }, cards: ['editorial', 'informants', 'bonus', 'rotate'] },
    goal: { d: 0.5, hold: 2, dHold: 2 },
    stars: [
      { text: "Win within ten days of martial law (by May 30)", test: (g) => g.round <= 45 },
      { text: "Fewer than 1,600 arrested", test: (g) => g.sim.R < 0.1 },
    ],
    dateFmt: dayFmt(1989, 4, 15),
    events: [
      { at: 0, title: "April 15", art: '💐', text: "News of Hu Yaobang's death spreads. That night, big-character posters mourning him go up on the campuses of Peking University and Tsinghua. Wreaths begin to appear at the foot of the Monument to the People's Heroes.", choices: [
        { label: "Mourn in the square", hint: "Get a free “Memorial”", run: (g) => { g.giveFree('memorial', 2); g.griefAll(0.01, 0.4); } },
      ] },
      { at: 7, title: "April 22 · The Memorial", art: '🙇', text: "The memorial service is held in the Great Hall of the People. Three students kneel on the steps at the Hall's east gate, holding up a petition, asking to see the Premier.<br><br>No one comes out to take it.", choices: [{ label: '……', run: (g) => g.griefAll(0.03, 0.3) }] },
      { at: 11, title: "The April 26 Editorial", art: '🗞️', quote: "It is necessary to take a clear-cut stand against turmoil", text: "The People's Daily runs an editorial branding the student movement “a planned conspiracy, a turmoil.”<br><br>Many students feel wronged.", choices: [
        { label: "Protest the verdict (march tomorrow)", hint: "Free Mass March; high risk", run: (g) => { g.giveFree('march', 2); } },
        { label: "Wait and see", hint: "Save your strength" },
      ], run: (g) => g.forceOpp('editorial') },
      { at: 12, news: "The April 27 march: students break through line after line of police, and people along the route applaud and hand out water.", kind: 'event', if: (g) => g.x > 0.02 },
      { at: 19, news: "The 70th anniversary of the May Fourth Movement.", kind: 'event', run: (g) => g.giveFree('rally', 1) },
      { at: 28, title: "May 13 · Hunger Strike", art: '🥣', text: "Several hundred students in the square declare a hunger strike, demanding dialogue with the government as equals and that the movement's name be cleared.", choices: [
        { label: "Join the hunger strike", hint: "Free “Hunger strike”: the whole city sympathizes", run: (g) => g.giveFree('hunger', 2) },
        { label: "Don't join", hint: '' },
      ] },
      { at: 30, title: "Gorbachev in Beijing", art: '🎥', text: "Soviet leader Mikhail Gorbachev arrives: the first Sino-Soviet summit in thirty years. More than a thousand foreign journalists have come to Beijing—and they have turned their cameras on the square.<br><br>For these few days, the regime is unwilling to move in front of the whole world.", choices: [{ label: "The world is watching" }], run: (g) => {
        g.forcePolicy('info', 'open', 4, "Foreign press present"); g.forcePolicy('enforce', 'normal', 4, "Sino-Soviet summit");
        g.addEffect({ id: 'press', name: "Foreign reporters", icon: '🎥', side: 'movement', rounds: 4, mod(m) { m.vis = Math.max(m.vis, 1); m.gs = 1; } });
      } },
      { at: 33, news: "Reportedly, Xu Qinxian, commander of the 38th Group Army, refused to lead his troops into Beijing without a written order.", kind: 'army', run: (g) => g.scalePsi(0.1, 0.6) },
      { at: 34, title: "May 19 · Before Dawn", art: '🌃', quote: "We came too late.", text: "Zhao Ziyang, General Secretary of the Chinese Communist Party, comes to the square to see the hunger strikers. He holds a loudhailer; there are tears in his eyes.<br><br>It is his last public appearance.", choices: [{ label: '……' }], run: (g) => { g.flags.aggrMul = 3.5; } },
      { at: 35, title: "May 20 · Martial Law", art: '🪖', text: "Premier Li Peng announces martial law in parts of Beijing. Hundreds of thousands of troops converge on the city from every direction.<br><br>—But they are stopped on the roads. Old people, workers and students pour into the intersections, surround the army trucks, and bring the soldiers water and food.", choices: [{ label: "Stop them", hint: "“Stop the convoys” free this turn", run: (g) => g.giveFree('blockade', 2) }], run: (g) => {
        // 部队被堵在城外: 能抓的人并没有马上变多; 外国记者也还在
        g.flags.martialLaw = true; g.alert = Math.max(g.alert, 80); g.L.ai.alertMul = 1;
        g.forcePolicy('police', 'surge', 99, "Martial law (troops blocked)"); g.forcePolicy('enforce', 'harsh', 99, "Martial law"); g.forcePolicy('info', 'spin', 99, "Martial law");
        g.L.ai.max = {};
        // 执行者从警察换成了开进城的部队
        const s = g.sim; g.base.psiScale = g.L.troopPsi || 1.1;
        for (let j = 0; j < s.psi.length; j++) s.psi[j] = s.rng() * g.base.psiScale;
        s.z.fill(0);
      } },
      { at: 39, news: "Some of the martial-law troops pull back to the outskirts.", kind: 'army', if: (g) => g.d > 0.1 },
      { at: 40, news: "The regime brings in fresh troops from other military regions.", kind: 'opp', run: (g) => g.forceOpp('rotate', false) },
      { at: 45, news: "Students from the Central Academy of Fine Arts raise a “Goddess of Democracy” in the square.", kind: 'event', run: (g) => g.giveFree('goddess', 3) },
      { at: 49, title: "June 3", art: '🌑', text: "In the evening, television and radio repeat an emergency notice: residents are not to go out into the streets, not to go to Tiananmen Square.<br><br>The troops have their orders: clear the square before 6 a.m. on June 4.", choices: [{ label: '……' }], run: (g) => { if (g.d < 0.4) { g.forcePolicy('police', 'martial', 99, "Clearance"); g.forceOpp('crackdown', false); } } },
    ],
    check: (g) => {
      if (g.round === 50) {
        if (g.d >= 0.4) return { win: true, key: 'refuse' };
        return { win: false, key: 'crackdown' };
      }
      return null;
    },
    endings: {
      army: { title: "Another June", text: "Regiment after regiment, the troops that had entered the city came to a halt. The officers said: without a written order, we will not fire on the people.<br><br><b>This is not history.</b> In history, this never happened." },
      refuse: { title: "Another June", text: "On the night of June 3, the troops heading for the square stopped on Chang'an Avenue. A division commander said: I will not fire on the people. More trucks stopped…<br><br><b>This is not history.</b> In history, this never happened." },
      crackdown: { title: "June 4", text: "On the night of June 3, the martial-law troops advanced on Tiananmen Square. At Muxidi and all along Chang'an Avenue, soldiers opened fire on the crowds that tried to block them. Before dawn on June 4, the students still in the square withdrew after negotiations.<br><br>The death toll is still unsettled. The official figure was around two to three hundred, soldiers included; other estimates run from several hundred to several thousand. Over many years, the Tiananmen Mothers have sought out the families one by one and documented the names and circumstances of more than two hundred of the dead." },
    },
    history: "Hu Yaobang died on April 15, 1989, and students went to Tiananmen Square to mourn him. On April 26 a People's Daily editorial branded the movement “turmoil”; the next day hundreds of thousands of students and residents took to the streets. On May 13 students began a hunger strike; during Gorbachev's visit, May 15–18, a million or more people filled Beijing's streets every day. Before dawn on May 19, Zhao Ziyang visited the students in the square; he was then stripped of his posts and spent the rest of his life under house arrest. Martial law was declared on May 20, and residents held the incoming troops back for days. On the night of June 3 and into the morning of June 4, the army opened fire and cleared the square.<br><br>Xu Qinxian, commander of the 38th Group Army, was sentenced to five years in prison for refusing to lead his troops without a written order.<br><br>Since then, “June 4” has been a forbidden subject in mainland China. Every year on that day, “May 35th” and the candle emoji are deleted. The candlelight vigil in Hong Kong's Victoria Park went on for thirty years; since 2020 it has been banned.<br><br>Four months later, East Germany's leadership publicly praised Beijing's handling of it. Everyone in Leipzig knew.",
    lesson: { title: "Property 4 · Enforcers have thresholds too", text: "The capacity to punish is not a constant—it depends on whether the enforcers are still willing to enforce. Soldiers, too, are watching the crowd and their comrades: when the pull of comrades is strong enough, the enforcers switch collectively. By bringing in troops with no ties to the city, the regime cut exactly the crowd's influence on the soldiers (α). A million people on the streets did not change the ending, because this layer never flipped." },
  });

  /* ============================================================
   * 第八章 · 莱比锡 1989 (行动方)
   * ============================================================ */
  LEVELS.push({
    id: 'leipzig', chapter: "Chapter 8", title: "We Are the People", era: "September 4 – October 18, 1989", place: "Leipzig", icon: '⛪',
    side: 'movement', role: "The peace prayers at St. Nicholas Church",
    blurb: "Every Monday, the church doors stand open. What happened in Beijing four months ago, everyone knows.",
    intro: [
      "Since 1982, St. Nicholas Church in Leipzig has held peace prayers every Monday. On September 4, 1989, after the prayers, people outside the church raised a banner: “For an open country with free people.”",
      "This summer, tens of thousands of East Germans fled west through Hungary. Those left behind began to chant: <b>“We're staying here!”</b>",
      "The regime has the Stasi (the Ministry for State Security), the police, and the workers' militia. It has also publicly praised what Beijing did in June.",
    ],
    goalText: "Before October 18, bring 40% of the city onto the march (about 120,000 people), and hold for two days.",
    tips: ["On Mondays, “Peace prayers” is free.", "The harder the regime clamps down on the news, the more powerful a single “Expose the truth” becomes.", "Ties between churches, schools and factories (“Build networks”) make it easier for people to carry one another along."],
    rounds: 45, scale: 150, arrestScale: 5, moodScale: 0.2, randomEvents: ['death', 'mole', 'press', 'writer', 'letter', 'release', 'split'],
    world: { N: 2000, tolType: 'uniform', tolMul: 0.37, tolAdd: -0.15, netType: 'clusters', netGroups: 30, P: 1.0, Pbar: 0.75, K0: 50, M: 150, alpha: 0.25, beta: 0.5, delta: 0.2, gamma: 1.5, memDecay: 0.15, vis: 0.8, omega: 0.6, globalScale: 0.75, noise: 0.01, hardCore: 0.004, seed: 1989, psiScale: 1.9 },
    policies: { start: Object.assign({}, STD_POL, { info: 'spin', target: 'organizer' }) },
    labels: { army: "Police & militia", crowd: "on the Ring", plaza: "Karl-Marx-Platz", prison: "Stasi jail", barracks: "People's Police barracks", avenue: "The Ring" },
    slogans: ["We are the people!", "No violence!", "We're staying here!", "Freedom of the press!"],
    cards: ['prayer', 'rally', 'march', 'mobilize', 'network', 'samizdat', 'leak', 'legal'],
    cardNames: { samizdat: { name: "West German TV", text: "Except in Dresden, the “Valley of the Clueless,” all of East Germany can pick up West German TV." } },
    startAP: 2, income: 1.0,
    isMonday: (r) => weekday(1989, 9, 4)(r) === 1,
    ai: { aggression: 0.5, income: 1.2, lag: 2, hold: 3, start: { enforce: 'normal', police: 'normal', info: 'spin', target: 'organizer' }, max: { police: 'normal', enforce: 'harsh', info: 'spin' }, cards: ['informants', 'editorial', 'bonus'] },
    goal: { x: 0.4, hold: 2 },
    stars: [
      { text: "Win by October 9", test: (g) => g.round <= 35 },
      { text: "Fewer than 1,000 taken by the Stasi", test: (g) => g.sim.R < 0.1 },
    ],
    dateFmt: (r) => dayFmt(1989, 9, 4)(r) + (weekday(1989, 9, 4)(r) === 1 ? (EN ? ' · Monday' : " · Monday") : ''),
    events: [
      { at: 0, title: "September 4 · Monday", art: '⛪', text: "The peace prayers are over. A few young people unfurl banners at the church door. Stasi plainclothesmen rush in and tear them away—and West German TV cameras catch it all.", choices: [{ label: "Begin" }] },
      { at: 7, news: "Hungary opens its border with Austria. Tens of thousands of East Germans leave that way.", kind: 'event', run: (g) => g.griefAll(0.015) },
      { at: 26, news: "Thousands of East German refugees in the West German embassy in Prague are allowed to leave for West Germany by train.", kind: 'event', run: (g) => g.griefAll(0.015) },
      { at: 33, title: "October 7 · The 40th Anniversary", art: '🎆', text: "A military parade in East Berlin. Gorbachev reportedly tells Honecker: “Life punishes those who come too late.”<br><br>That night, police across the country beat and detain the people who took to the streets.", choices: [{ label: "Continue" }], run: (g) => { g.forcePolicy('enforce', 'harsh', 2, "Republic Day"); g.forcePolicy('police', 'surge', 2); g.forceOpp('editorial'); } },
      { at: 35, title: "October 9 · Monday", art: '🩸', text: "Rumors everywhere: the hospitals have stocked blood plasma and cleared beds; a newspaper has run an article by a militia commander vowing to defend socialism “weapon in hand.”<br><br>Everyone is thinking of Beijing, four months ago.", choices: [
        { label: "Go anyway", hint: "Great numbers take to the Ring—if there aren't enough, the regime may strike", run: (g) => g.addSeeds(0.07) },
        { label: "Stay home today", hint: "Safe, but you'll miss the moment" },
      ] },
      { at: 36, if: (g) => g.x >= 0.1, title: "They Did Not Shoot", art: '🕊️', text: "Seventy thousand people take to the Ring. Commanders phone for instructions; no one dares give the order. The authorities broadcast an appeal for “no violence”—signed by the conductor Kurt Masur and five others.<br><br>That day, two young men secretly filmed the march from the tower of the Reformed Church. The tape was smuggled to West Berlin and aired on West German TV.", choices: [{ label: "The world has seen it", hint: "“Expose the truth” free", run: (g) => g.giveFree('leak', 3) }], run: (g) => { g.forcePolicy('enforce', 'lenient', 99, "Hands off"); g.forcePolicy('target', 'uniform', 99); g.L.ai.cards = []; } },
      { at: 36, if: (g) => g.x < 0.1, title: "Too Few", art: '🚨', text: "Not enough people. The police and militia charge into the crowd.", choices: [{ label: '……' }], run: (g) => g.forceOpp('crackdown', false) },
    ],
    endings: {
      crowd: { title: "We Are the People", text: "More than a hundred thousand people march around the Ring, candles in hand. No one fires.<br><br>On October 18, Honecker steps down. Three weeks later, the Berlin Wall falls." },
      timeout: { title: "Monday Will Come Again", text: "Not enough people to make the regime give up. But next Monday, the church doors will be open again." },
    },
    history: "The Leipzig Monday demonstrations: several thousand in late September, about 20,000 on October 2, about 70,000 on October 9, about 120,000 on October 16. The October 9 march was secretly filmed from a church tower by Siegbert Schefke and Aram Radomski and aired on West German TV the next day. Honecker stepped down on October 18; the Berlin Wall fell on November 9.<br><br>That June, East Germany's People's Chamber had passed a statement backing the Beijing crackdown. On October 9, the authorities had a “Chinese solution” ready—in the end, no one gave the order.",
    lesson: { title: "Property 5 · More accurate information does not necessarily raise participation", text: "What people see is a weighted mix of what is near (the church circle) and what is global (West German TV). The footage gave many people shared evidence beyond their own circle—yet “more accurate information” does not by itself raise participation; it depends on which way people's beliefs were skewed to begin with. Here, the blackout had made people underestimate one another's numbers; once the truth came out, the underestimate was corrected." },
  });

  /* ============================================================
   * 第九章 · 布加勒斯特 1989 (朝廷)
   * ============================================================ */
  LEVELS.push({
    id: 'bucharest', chapter: "Chapter 9", title: "The Last Rally", era: "December 15–31, 1989", place: "Timișoara · Bucharest", icon: '🎙️',
    side: 'regime', role: "Nicolae Ceaușescu",
    blurb: "The Securitate's reports say: all is well. The reports always say so.",
    intro: [
      "December 1989. The Berlin Wall has fallen, Prague is in the streets, Bulgaria has a new leader. In your country, nothing has changed.",
      "To pay off the foreign debt, you made the whole nation tighten its belt: bread, meat and milk are rationed, winter apartments get a few hours of heat a day, and the streetlights are dark at night. The Securitate is everywhere; in every workplace, someone is filing reports.",
      "<b>The reports say: the people love you.</b> The reports always say so.",
    ],
    quote: "A record of silence is not enough to determine the structure of response behind the silence. — Glances on the Road",
    goalText: "Hold out to the last day of 1989: don't let the streets slip out of control, and don't let the army defect.",
    tips: ["Your intelligence is almost worthless: the harsher the enforcement, the less people below dare tell the truth. “Securitate Informers” let you hear the truth for a while.", "The money saved by belt-tightening is turning into grievance you cannot see. Subsidies can buy calm—real calm.", "A hundred thousand people standing in one square can all see one another."],
    rounds: 34, scale: 5000, arrestScale: 30, moodScale: 0.2, tipSpread: 0.3,
    randomEvents: ['r_ringleaders', 'r_rumor', 'r_hawks', 'r_advisor', 'r_pay'],
    world: { N: 2000, tolType: 'uniform', tolMul: 0.4, netType: 'random', netDeg: 6, P: 1.0, Pbar: 0.7, K0: 50, M: 150, alpha: 0.3, beta: 0.45, delta: 0.2, gamma: 2, memDecay: 0.03, vis: 0.8, omega: 0.8, globalScale: 0.8, noise: 0.01, hardCore: 0.003, seed: 1989, psiScale: 1.6 },
    policies: { start: { enforce: 'harsh', police: 'surge', target: 'preventive', info: 'blackout', release: 'long' } },
    setup: (g) => { g.griefAll(0.13); g.flagTop(0.03); },   // 多年的配给、寒冷与监视
    labels: { army: "Army", crowd: "On the streets", plaza: "Palace Square", prison: "Securitate", barracks: "Ministry of Defense", avenue: "Calea Victoriei" },
    slogans: ["Down with Ceaușescu!", "Timișoara!", "We are the people!", "The army is with us!"],
    policyNames: {
      police: { name: "Police", options: { lean: "Lean", normal: "Routine", surge: "Securitate", martial: "Troops enter the city" } },
      info: { name: "Media", options: { open: "Honest reporting", spin: "Good News Only", blackout: "Only the Leader" } },
    },
    cardNames: {
      informants: { name: "Securitate Informers", text: "Send informers to listen to what people say in private. For a few days you will hear the truth—and the boldest talkers will be the first arrested." },
      editorial: { name: "TV Address", text: "Denounce the “hooligans” and “foreign agents” on television." },
      crackdown: { name: "Shots Fired", text: "Order the army and the Securitate to fire on the crowd. The streets will empty—and everyone will hear the shots." },
      subsidy: { name: "Heat & Bread", text: "Turn on the heat in the apartments; put bread and meat in the shops. You are spending the money saved to pay the debt." },
      dialogue: { name: "Negotiate", text: "Concede some demands: wages, supplies, no more evicting the pastor." },
      amnesty: { name: "Release Detainees", text: "Let go the people arrested in the past few days." },
      bonus: { name: "Pay the Officers", text: "Promotions, raises, promises. Make the generals remember who feeds them." },
    },
    cards: ['informants', 'subsidy', 'dialogue', 'amnesty', 'bonus', 'editorial', 'crackdown'],
    startAP: 4, income: 1.2,
    ai: { income: 1.0, every: 2, base: 0.01, smart: 0.8, aggression: 0.8, orgRate: 1.2, cards: ['rally', 'march', 'strike', 'memorial', 'leak', 'fraternize'],
      pushNews: "General strike across the city—people are pouring into the center!",
      chatter: ["People in the bread line talk in low voices, and scatter when they see a man in a leather cap.", "Someone is listening to Radio Free Europe.", "The apartments have only a few hours of heat a day.", "Someone wrote a name on a wall. It was painted over."] },
    goal: { x: 0.25, d: 0.5, hold: 2, dHold: 2 },
    stars: [
      { text: "Never gave the order to fire", test: (g) => !g.flags.shot },
      { text: "Public mood no worse than “Aggrieved” by year's end", test: (g) => g.meanGrievance() / g.moodScale < 0.55 },
    ],
    dateFmt: halfDayFmt(1989, 12, 15),
    events: [
      { at: 0, title: "Pastor Tőkés", art: '⛪', text: "December 15, Timișoara. László Tőkés, an ethnic Hungarian Reformed pastor, has been served an eviction order—he criticized your policies on foreign television.<br><br>His parishioners link arms around the parsonage and will not let the police in.", choices: [
        { label: "Evict him anyway", hint: "Rules are rules", run: (g) => { g.forceOpp('rally', false); g.griefAll(0.01, 0.5); } },
        { label: "Postpone the eviction", wise: true, hint: "The crowd will disperse—you'll look weak", run: (g) => { g.base.Pbar += 0.03; g.org = Math.min(100, g.org + 6); } },
      ] },
      { at: 3, title: "Timișoara", art: '🔥', text: "The crowd at the pastor's door keeps growing; Romanians have joined it too. The crowd storms the county Party headquarters, throws your portraits and books out of the windows, and chants “Down with Ceaușescu.”<br><br>The county asks for instructions: open fire?", choices: [
        { label: "Shots Fired", hint: "The streets will empty—and everyone will hear the shots", run: (g) => { g.flags.shot = true; g.selfCard('crackdown', "December 17: the army and the Securitate open fire on the crowd in Timișoara."); } },
        { label: "Hoses and batons", hint: "Disperse, but don't shoot", run: (g) => g.addEffect({ id: 'hose', name: "Water cannon", icon: '🚒', side: 'regime', rounds: 2, mod(m) { m.K0 *= 1.4; } }) },
        { label: "Send negotiators", wise: true, hint: "Concede some demands · your opponents will think you soft", run: (g) => g.selfCard('dialogue', "The county sends people to negotiate with the crowd.") },
      ] },
      { at: 6, title: "The Iran Trip", art: '✈️', text: "As planned, you leave today for a state visit to Tehran, returning on the 20th. Your wife Elena will chair the Political Executive Committee in your place.<br><br>Cancel the trip, and the whole world will guess that something is wrong at home.", choices: [
        { label: "Go as planned", hint: "For the next two days you can't play cards or change policies", run: (g) => { g.flags.away = true; g.allowCards = []; g.log("You fly to Tehran.", 'mine'); } },
        { label: "Cancel the trip", wise: true, hint: "Costs 3 pts · opposition morale ↑", run: (g) => { g.me.ap = Math.max(0, g.me.ap - 3); g.org = Math.min(100, g.org + 8); } },
      ] },
      { at: 10, if: (g) => !!g.flags.shot, news: "General strike in Timișoara. The army has pulled back to barracks, and in Opera Square the citizens declare it a “free city.”", kind: 'crowd', run: (g) => { if (g.flags.away) { g.flags.away = false; g.allowCards = null; } g.scalePsi(0.2, 0.8); g.forceOpp('strike', false); } },
      { at: 10, if: (g) => !g.flags.shot, news: "In Timișoara's factories, workers are talking about the past few days. Someone stopped at the factory gate—then went in.", kind: 'event', run: (g) => { if (g.flags.away) { g.flags.away = false; g.allowCards = null; } g.forceOpp('rally', false); } },
      { at: 11, title: "TV Address", art: '📺', text: "You return from Tehran and address the nation on television that evening.", choices: [
        { label: "Denounce “hooligans” and foreign agents", hint: "The fearful will back down—the wronged will remember", run: (g) => { g.selfCard('editorial', "You say on television: the events in Timișoara were stirred up by foreign agents and hooligans."); } },
        { label: "Announce raises and more supplies", wise: true, hint: "Costs 2 pts · grievance ↓", run: (g) => { g.me.ap = Math.max(0, g.me.ap - 2); g.griefScale(0.82); g.log("You announce on television: higher wages and pensions, more in the shops.", 'mine'); } },
      ] },
      { at: 12, title: "December 21 · The Rally", art: '🎙️', text: "You plan a rally of a hundred thousand outside the Central Committee building, to denounce the Timișoara “hooligans.” Factories and ministries bus the people in and hand out banners and your portraits. Television will carry it live to the whole nation.<br><br>A hundred thousand people standing in one square: <b>everyone can see everyone else.</b>", choices: [
        { label: "Hold it, broadcast live", hint: "If the people really are on your side, this will be a triumph", run: (g) => {
          const m = g.meanGrievance() / g.moodScale;
          g.addEffect({ id: 'rally21', name: "Live national rally", icon: '📺', side: 'movement', rounds: 1, mod(mm) { mm.gs = 1; mm.vis = 1.2; mm.omega = 1; } });
          if (m < 0.35) { g.org = Math.max(0, g.org - 25); g.me.ap += 3; g.log("The rally goes off in good order. On television, a sea of waving flags.", 'intel'); }
          else { g.addSeeds(0.004 + 0.06 * Math.min(1, m - 0.35)); g.log("Halfway through your speech, whistles and shouts of “Timișoara!” rise from the back of the square. You falter, and raise a hand for quiet. The live broadcast cuts out.", 'crowd'); }
        } },
        { label: "Cancel the rally", wise: true, hint: "Nothing will happen—today, at least", run: (g) => { g.org = Math.min(100, g.org + 8); } },
      ] },
      { at: 14, if: (g) => g.d >= 0.12 || g.x >= 0.06, title: "December 22 · The Defense Minister", art: '🪖', text: "Word comes in the morning: Defense Minister Milea is dead. Officially, he was a “traitor” who killed himself to escape punishment.<br><br>On the tanks, soldiers begin turning their guns toward the sky.", choices: [{ label: '……' }], run: (g) => g.scalePsi(0.6, 0.35) },
      { at: 14, if: (g) => !(g.d >= 0.12 || g.x >= 0.06), news: "Defense Minister Milea reports to you as usual. All is quiet in the capital.", kind: 'intel' },
    ],
    check: (g) => { if (g.flags.away && g.round >= 10) { g.flags.away = false; g.allowCards = null; } return null; },
    endings: {
      survive: { title: "New Year", text: (g) => (g.meanGrievance() / g.moodScale < 0.55 ? "You made it to 1990. The heat is on, there is bread in the shops, and people have gone home." : "You made it to 1990. The streets have gone quiet, and the reports say all is well—the reports always say so.") + "<br><br><b>This is not history.</b> In history, at noon on December 22, the Ceaușescus fled by helicopter from the roof of the Central Committee building; three days later, in Târgoviște, a makeshift military tribunal gave them a summary trial, and they were shot." },
      crowd: { title: "The Helicopter", text: "At noon on December 22, the crowd storms the Central Committee building. You and Elena flee by helicopter from the roof.<br><br>Three days later, in Târgoviște, a makeshift military tribunal tries you both, and you are shot. The trial lasts less than an hour." },
      army: { title: "The Army Is with Us", text: "The tanks turn around. Soldiers climb down and embrace the crowd. The Ministry of Defense no longer takes your calls.<br><br>Three days later, you and Elena are given a summary trial in Târgoviște and shot." },
    },
    history: "On December 15, 1989, parishioners in Timișoara surrounded the home of the ethnic Hungarian pastor László Tőkés to block his eviction; the next day the protest grew into an anti-government demonstration. On December 17, the army and the Securitate fired on the crowd; the bodies of the dead were secretly taken to Bucharest and cremated. Ceaușescu was on a visit to Iran from the 18th to the 20th. On the 20th Timișoara went on general strike and the army withdrew to barracks. At noon on the 21st, Ceaușescu held a mass rally outside the Central Committee building; midway through his speech the crowd began to jeer, and the live broadcast was cut. That night there was shooting in Bucharest. On the morning of the 22nd, Defense Minister Vasile Milea died (officially a suicide), the army went over to the people, and at noon the Ceaușescus fled by helicopter. On the 25th, the two were tried by a makeshift military tribunal and executed.",
    lesson: { title: "Property 1 · Property 13: silence gives no warning, and collapse may come without precursors", text: "Open participation can stay at zero, and the speed of recovery from small shocks can stay unchanged, while the tipping point draws ever closer—silence itself does not tell you how far you are from collapse. The model also cautions: recovery does slow near a tipping point, but the reverse does not follow—a sudden break over a few days cannot prove that “critical slowing down must have occurred beforehand.” The whistles in the square on December 21 were not the cause of the collapse; they were a state that had long existed, seen by everyone at once for the first time." },
  });

  /* ============================================================
   * 第十章 · 2022 四通桥与白纸 (行动方)
   * ============================================================ */
  LEVELS.push({
    id: 'baizhi', chapter: "Chapter 10", title: "A Blank Sheet", era: "October 13 – December 7, 2022", place: "Beijing · Shanghai · Urumqi", icon: '📄',
    side: 'movement', role: "Young people scattered across the country",
    blurb: "One man, one bridge, two banners. Then a fire — and a sheet of paper with nothing written on it.",
    intro: [
      "“Dynamic zero-COVID” enters its third year. Lockdowns, PCR tests, health codes: the lives of hundreds of millions are cut apart by fence after fence.",
      "On October 13, on Sitong Bridge in Beijing's Haidian district, a man hangs two banners: <b>“We want food, not PCR tests; we want freedom, not lockdowns…”</b>",
      "This country has the tightest censorship and the widest surveillance. Here, anyone who stands up is almost certain to be found.",
    ],
    goalText: "Before December 7, get enough people standing up at once across the country to be seen (about 20,000), and hold for two days.",
    tips: ["Censorship makes everyone underestimate everyone else's anger — “Jump the Wall” and “Repost Footage” can break through it.", "Holding up blank paper is less risky than shouting slogans.", "A tragedy will happen. When it does, a great breach will open in people's hearts."],
    rounds: 55, scale: 100, arrestScale: 2, moodScale: 0.2, tipSpread: 0.4, randomEvents: ['death', 'mole', 'prices', 'split', 'release', 'writer'],
    world: { N: 2000, tolType: 'uniform', tolMul: 0.46, netType: 'random', netDeg: 10, P: 1.0, Pbar: 0.85, K0: 42, M: 200, alpha: 0.08, beta: 0.4, delta: 0.15, gamma: 2.5, memDecay: 0.08, vis: 0.6, omega: 0.5, globalScale: 0.7, noise: 0.02, hardCore: 0.001, seed: 2022, psiScale: 2.0 },
    policies: { start: { enforce: 'harsh', police: 'surge', target: 'organizer', info: 'blackout', release: 'long' } },
    labels: { army: "Police & “Big Whites”", crowd: "On the streets", plaza: "Urumqi Middle Road", prison: "Police station", barracks: "Stability HQ", avenue: "Liangma River" },
    slogans: ['', '', "Food, not PCR tests", "Freedom, not lockdowns", '……'],
    cards: ['banner', 'rally', 'blankpaper', 'samizdat', 'leak', 'memorial', 'lowkey', 'legal'],
    cardNames: {
      samizdat: { name: "Jump the Wall", text: "Get over the Great Firewall, screenshot, rephrase, use homophones. However fast they delete, someone always sees it first." },
      leak: { name: "Repost Footage", text: "Upload the deleted videos again, and again, and again." },
      memorial: { name: "Light a Candle", text: "Leave flowers under the street sign; light a candle." },
    },
    startAP: 1, income: 0.9,
    ai: { aggression: 0.85, income: 1.4, lag: 2, start: { enforce: 'harsh', police: 'surge', info: 'blackout', target: 'organizer', release: 'long' }, cards: ['informants', 'editorial', 'cutnet'] },
    goal: { x: 0.1, hold: 2 },
    stars: [
      { text: "Succeed before the end of November", test: (g) => g.round <= 48 },
      { text: "Fewer than 400 taken away", test: (g) => g.sim.R < 0.1 },
    ],
    dateFmt: dayFmt(2022, 10, 13),
    events: [
      { at: 0, title: "Sitong Bridge", art: '🌉', text: "At noon, thick smoke rises over Sitong Bridge. A man in orange hangs two banners and reads their words through a loudspeaker, over and over.<br><br>He is soon taken away. The photos are deleted within minutes — but someone has already saved them.", choices: [{ label: "Remember this day", hint: "You now hold a “Bridge banner” card" }] },
      { at: 3, news: "The 20th Party Congress opens. Security is tightened everywhere; “Sitong Bridge,” “Haidian” and “warrior” all become censored words.", kind: 'opp', run: (g) => { g.forcePolicy('police', 'surge', 10, "20th Congress security"); } },
      { at: 29, news: "The “20 Measures” are issued and COVID rules ease somewhat. Many breathe a sigh of relief — but the lockdowns go on.", kind: 'event', run: (g) => g.griefScale(0.95) },
      { at: 42, title: "November 24 · Urumqi", art: '🔥', text: "A fire breaks out in a high-rise at the Jixiangyuan compound in Urumqi. Officially, ten people die.<br><br>The city has been locked down for more than a hundred days. Online, people keep asking: why couldn't the fire trucks get in? Why wouldn't the doors open?", choices: [{ label: "Repost", hint: "Suppressed anger surfaces; “Repost Footage” and “Light a Candle” are free", run: (g) => { g.giveFree('leak', 3); g.giveFree('memorial', 4); } }], run: (g) => { g.griefAll(0.08); g.sim.reveal(0.6); } },
      { at: 43, news: "Urumqi residents take to the streets, demanding an end to the lockdown.", kind: 'crowd', run: (g) => g.addSeeds(0.015) },
      { at: 44, title: "Urumqi Middle Road", art: '🕯️', text: "Shanghai, beneath the street sign for Urumqi Middle Road. Someone lays down flowers and lights a candle. Then a second person, a third…", choices: [{ label: "Walk over", hint: "“Blank sheets” is free", run: (g) => { g.giveFree('blankpaper', 3); g.addSeeds(0.01); } }] },
      { at: 45, news: "Tsinghua, Peking University, Nanjing, Chengdu, Wuhan, Guangzhou… people hold up blank sheets of paper.", kind: 'crowd', if: (g) => g.x > 0.005 },
      { at: 47, news: "Police begin checking subway passengers' phones and tracking down the people in photos from the scene.", kind: 'opp', run: (g) => { g.forcePolicy('target', 'preventive', 8, "Tracking down"); g.forceOpp('informants', false); } },
    ],
    endings: {
      crowd: { title: "White paper", text: "In city after city, people held up blank paper at the same time. On December 7 the “New 10 Measures” were issued, and nearly three years of dynamic zero-COVID effectively came to an end.<br><br>How far the protests caused the policy turn is still debated — the spread of the virus and fiscal pressure were causes too. What is certain is that over the following months, a number of young people who had joined the vigils were taken away, one after another." },
      timeout: { title: "Stay silent", text: "On December 7, COVID policy turned anyway — the virus did not wait for anyone's permission.<br>Only, the words that could have been spoken sank once again into silence." },
    },
    history: "On October 13, 2022, Peng Lifa hung banners from Sitong Bridge in Beijing and was taken away at once; to this day the outside world has almost no reliable news of him. On November 24, a fire at the Jixiangyuan compound in Urumqi killed 10 people, according to the official count. On November 25, protests broke out in Urumqi; on November 26–27, vigils and protests took place on Urumqi Middle Road in Shanghai, by the Liangma River in Beijing, at many universities and elsewhere, and people held up blank sheets of paper. On December 7, the “New 10 Measures” were issued. Afterwards, a number of young people who had joined the vigils were detained.",
    lesson: { title: "Limits of identification · Preference falsification", text: "Censorship lets everyone see only a compressed “overall participation,” so everyone underestimates everyone else. People hide their own views and infer the situation from others' public stances — misleading themselves, onlookers and those in power all at once. A blank sheet of paper is powerful because it lets everyone confirm something they all already knew but could not say." },
  });

  /* ============================================================
   * 第十一章 · 朝鲜 (行动方 · 信息网络)
   * ============================================================ */
  LEVELS.push({
    id: 'pyongyang', chapter: "Chapter 11", title: "The Invisible Crack", era: "2019–2022", place: "North Korea · Hyesan / Sinuiju", icon: '🌑',
    side: 'movement', role: "A border smuggling and information network",
    blurb: "There will be no marches here. What you can do is make the silence thinner — without being caught.",
    intro: [
      "In satellite photos at night, North Korea is a sheet of darkness.",
      "Your family background (songbun) decides where you live and what you may do; if one person commits a “political error,” the family pays too; neighbors in your inminban (neighborhood watch unit) report who comes to your home. An estimated 80,000 to 120,000 people are held in political prison camps.",
      "<b>Here, no open resistance survives a single round.</b> Your goal is not revolution — it is to turn the number “how many must stand up together” from “impossible” into “maybe.”",
    ],
    goalText: "Before the end of 2022, make a tipping point appear and bring it below “about one in five standing up together would be enough” (hold for three months). Meanwhile, don't let your network be exposed.",
    tips: ["Stay off the streets — here, open action is suicide.", "“K-dramas on USB” stop people believing the official line — and let them know the neighbors are watching too.", "Every action raises your exposure. Let it climb too high and Group 109 will come knocking.", "The more illegitimate punishment is seen to be, the deeper the memory each punishment leaves."],
    rounds: 48, scale: 12500, arrestScale: 200, moodScale: 0.15, tipSpread: 0.35, randomEvents: ['death', 'mole', 'prices'], structuralTip: true,
    world: { N: 2000, tolType: 'low', netType: 'clusters', netGroups: 60, P: 1.0, Pbar: 2.9, K0: 40, M: 200, alpha: 0.05, beta: 0.4, delta: 0.3, gamma: 3, memDecay: 0.03, vis: 0.35, omega: 0.9, globalScale: 0.3, noise: 0.02, hardCore: 0, seed: 1948, psiScale: 1.8, netDamage: 0.6 },
    policies: { start: { enforce: 'terror', police: 'surge', target: 'preventive', info: 'blackout', release: 'long' } },
    labels: { army: "State Security & army", crowd: "On the streets", plaza: "Square", prison: "Prison camp", barracks: "State Security", avenue: "Avenue" },
    theme: 'night',
    slogans: [],
    cards: ['usb', 'bribe', 'market', 'hide', 'samizdat', 'network', 'rally'],
    cardNames: {
      samizdat: { name: "Foreign Radio", text: "Tune a modified radio to foreign stations.", tags: ["Breaks the blackout", "Official line discredited"] },
      network: { name: "Kin & Hometown", text: "The only people you can trust are relatives, people from your hometown, and those you do business with." },
      rally: { name: "Open Protest", text: "Here, this is close to suicide." },
    },
    startAP: 2, income: 1.0,
    ai: { aggression: 1.0, income: 1.5, lag: 3, quiet: true, start: { enforce: 'terror', police: 'surge', target: 'preventive', info: 'blackout', release: 'long' }, cards: ['informants', 'crackdown', 'bonus'] },
    goal: {},
    stars: [
      { text: "Exposure never above half", test: (g) => !g.flags.exposedHalf },
      { text: "Done before June 2022", test: (g) => g.round <= 41 },
    ],
    dateFmt: monthFmt(2019, 1),
    setup: (g) => { for (const k of ['enforce', 'police', 'target', 'info', 'release']) g.forcePolicy(k, g.pol[k], 999, "North Korea"); g.exposure = 10; g.flagTop(0.02); },
    onRound: (g) => {
      if (g.exposure >= 50) g.flags.exposedHalf = true;
      const p = Math.max(0, (g.exposure - 20) / 160);
      if (g.rng() < p) {
        g.exposure = Math.max(0, g.exposure - 12);
        g.me.ap = Math.max(0, g.me.ap - 1);
        g.cutEdges(0.06);
        g.addSeeds(0.004);   // 被搜出来的人: 公开处理
        g.log("Group 109 raided several homes and took people away. They are looking for USB drives.", 'opp');
        g.fx.push({ type: 'raid' });
      }
    },
    events: [
      { at: 0, title: "Hyesan", art: '🌑', text: "China lies just across the Yalu River. In winter, when the river freezes, people can walk over — and goods can come back.<br><br>Your trade: rice, batteries, phones — and USB drives hidden in battery boxes.", choices: [{ label: "Begin" }] },
      { at: 12, title: "Border Sealed", art: '🚧', text: "COVID-19 breaks out. North Korea closes its border with China and orders that anyone approaching within a kilometer of it be shot on sight.<br><br>Smuggling all but stops. Every move you make is now more dangerous.", choices: [{ label: "Continue" }], run: (g) => { g.exposureMul = 1.6; g.bonusIncome -= 0.25; } },
      { at: 23, title: "Reactionary Ideology and Culture Rejection Act", art: '⚖️', text: "The Supreme People's Assembly passes a new law: distributing South Korean films and TV can carry the death penalty; viewers face reeducation through labor; their families and workplace heads are punished along with them.", choices: [{ label: "Continue" }], run: (g) => { g.base.P *= 1.25; } },
      { at: 27, news: "At a party meeting, Kim Jong Un says the country must wage an “even more difficult Arduous March.”", kind: 'event', run: (g) => g.griefAll(0.02) },
      { at: 30, title: "Public Execution", art: '⚫', text: "Reportedly, a public execution was held somewhere. The person executed was accused of spreading foreign films and TV. Local residents and students were made to watch.<br><br>If people still think this was “deserved,” it will only make them more afraid; if they no longer believe — they will remember this day.", choices: [{ label: '……' }], run: (g) => { g.addSeeds(0.004); g.addEffect({ id: 'forcedwatch', name: "Made to watch", icon: '👁️', side: 'regime', rounds: 1, mod(m) { m.P *= 1.4; m.vis = 1; m.omega = 0.9; } }); } },
      { at: 40, news: "The authorities admit to COVID cases in the country for the first time; nationwide lockdown.", kind: 'event', run: (g) => g.griefAll(0.02) },
    ],
    check: (g) => {
      const t = g.structuralTipping();   // 一次广播带来的短暂松动不算数(structuralTip: 界面上的估计也不含它)
      g.streak.tip = t <= 0.2 ? g.streak.tip + 1 : 0;
      if (g.streak.tip >= 3) return { win: true, key: 'crack' };
      return null;
    },
    endings: {
      crack: { title: "The Crack", text: "You succeeded — if that is what “success” means: right now, if only about one in five people stood up at once, things here could change.<br><br>But no one knows it. The streets are as quiet as yesterday; the intelligence reports still say “all normal,” just as they did yesterday. <b>Silence gives no warning.</b>" },
      exposed: { title: "Network Rolled Up", text: "Group 109 found your contacts, and then you. In North Korea, spreading foreign films and TV can mean reeducation through labor, and in serious cases, death; your family may be punished too." },
      timeout: { title: "Still Silent", text: "Four years have passed. You showed some people another kind of life, but the crack is not yet deep enough." },
    },
    history: "The UN Commission of Inquiry on Human Rights in the DPRK (2014) estimated that 80,000 to 120,000 people were held in North Korea's political prison camps. The famine of the mid-1990s (the “Arduous March”) killed hundreds of thousands to over a million people; afterwards the ration system collapsed, private markets (jangmadang, 장마당) became most people's livelihood, and foreign films and TV flowed in on USB drives, SD cards and portable players. In January 2020, North Korea closed its border because of COVID-19; that December it passed the Reactionary Ideology and Culture Rejection Act.",
    lesson: { title: "Limits of identification · Silence gives no warning", text: "“A record of silence alone is not enough to identify the response structure behind the silence.” Two completely different societies can produce exactly the same silence; and when the conditions that sustain silence change, the silence itself tells no one in advance — not even Pyongyang." },
  });

  /* ============================================================
   * 自由对局
   * ============================================================ */
  // mov / reg: 玩家分别扮演行动方 / 当局时的承受上限倍率(两边的电脑对手强弱不同, 分开校准)
  const SOCIETIES = {
    ordinary: { name: "Ordinary City", desc: "Thresholds spread evenly; a random web of acquaintances.", mov: 0.33, reg: 0.7, world: { tolType: 'uniform', netType: 'random', netDeg: 8 } },
    fearful: { name: "Society of Fear", desc: "Everyone is afraid; what people can bear is low across the board.", mov: 0.45, reg: 1.4, world: { tolType: 'low', netType: 'random', netDeg: 8 } },
    divided: { name: "Divided Society", desc: "A moderate majority, a radical few.", mov: 0.33, reg: 0.8, world: { tolType: 'bimodal', netType: 'random', netDeg: 8 } },
    tight: { name: "Tight-knit Communities", desc: "Close-knit within small groups, few ties between them.", mov: 0.33, reg: 0.8, world: { tolType: 'bell', netType: 'clusters', netGroups: 30 } },
  };
  function makeSkirmish(side, societyKey) {
    const S = SOCIETIES[societyKey] || SOCIETIES.ordinary;
    return {
      id: 'skirmish', chapter: "Free Play", title: S.name, era: "Fictional", place: "A city", icon: '🎲',
      side, role: side === 'movement' ? "The movement" : "Regime",
      intro: [S.desc, side === 'movement' ? "Within 60 rounds, get half the people onto the streets, or make the security forces defect." : "Survive 60 rounds without losing control."],
      goalText: side === 'movement' ? "Within 60 rounds, get half the people to stand up and hold for three rounds, or make the security forces defect." : "Survive 60 rounds: don't let half the people stand up, and don't let the security forces defect.",
      rounds: 60, scale: 500, arrestScale: 20, moodScale: 0.2,
      // 玩家当局时 δ 更大: 一味加码的处罚会让执行者动摇, 铁腕不是免费的
      world: Object.assign({ N: 2000, P: 1.0, Pbar: 0.8, K0: 40, M: 150, alpha: 0.25, beta: 0.5, delta: side === 'movement' ? 0.2 : 0.4, gamma: 2, memDecay: 0.1, vis: 0.9, omega: 0.8, globalScale: 1, noise: 0.01, hardCore: 0.003, seed: 99, psiScale: 1.3 }, S.world, { tolMul: side === 'movement' ? S.mov : S.reg }),
      policies: { start: STD_POL },
      labels: { army: "Security forces", crowd: "On the streets", plaza: "Central Square", prison: "Detention center", barracks: "Barracks", avenue: "Avenue" },
      slogans: ["Freedom!", "Dialogue!", "Free the detainees!"],
      cards: side === 'movement' ? ['rally', 'march', 'mobilize', 'strike', 'samizdat', 'leak', 'memorial', 'fraternize', 'network', 'legal'] : ['informants', 'editorial', 'crackdown', 'amnesty', 'dialogue', 'subsidy', 'bonus', 'rotate', 'cutnet'],
      startAP: 2, income: side === 'movement' ? 1.0 : 1.2,
      ai: side === 'movement'
        ? { income: 1.0, every: 3, base: 0.012, smart: 0.7, aggression: 0.75, cards: ['rally', 'march', 'strike', 'memorial', 'leak', 'fraternize', 'samizdat'] }
        : { aggression: 0.65, income: 1.2, lag: 2, cards: ['editorial', 'informants', 'bonus', 'crackdown', 'rotate', 'dialogue'] },
      goal: { x: 0.5, d: 0.55, hold: 3, dHold: 2 },
      stars: side === 'movement'
        ? [{ text: "Win within 30 rounds", test: (g) => g.round <= 30 }, { text: "Under 5% arrested", test: (g) => g.sim.R < 0.05 }]
        : [{ text: "Public grievance no worse than “Aggrieved”", test: (g) => g.meanGrievance() / g.moodScale < 0.55 }, { text: "Under 10% arrested", test: (g) => g.sim.R < 0.1 }],
      dateFmt: (r) => (EN ? `Round ${r + 1}` : `Round ${r + 1}`),
      endings: {},
      history: '',
      lesson: null,
    };
  }

  // 合并历史时间线(timelines.js)
  const TLmod = global.SilenceTimelines || (typeof require === 'function' ? require('./timelines.js') : null);
  if (TLmod) for (const L of LEVELS) if (TLmod.TL[L.id]) L.events = (L.events || []).concat(TLmod.TL[L.id]);

  const api = { LEVELS, SOCIETIES, makeSkirmish, cnNum };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.SilenceLevels = api;
})(typeof window !== 'undefined' ? window : globalThis);
