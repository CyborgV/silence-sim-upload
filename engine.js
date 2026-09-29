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
  function fmtCount(n) {
    n = Math.max(0, n);
    if (n < 1) return '0';
    if (n < 20) return String(Math.round(n));
    if (n < 1e4) {
      const p = Math.pow(10, Math.floor(Math.log10(n)) - 1);
      return String(Math.round(n / p) * p);
    }
    const w = n / 1e4;
    return (w < 10 ? w.toFixed(1).replace(/\.0$/, '') : String(Math.round(w))) + '万';
  }
  const band = (v, cuts, words) => { let i = 0; while (i < cuts.length && v >= cuts[i]) i++; return { level: i, words: words[i] }; };

  /* ============================================================
   * 政策: 常设立场(朝廷一方)。每个选项对应模型参数的一个倍率。
   * ============================================================ */
  const POLICIES = {
    enforce: {
      name: '执法力度', icon: '⚖️',
      desc: '抓到之后怎么处置。越重,上街越可怕;可一旦超出民众认可的界线,每一次处罚都会被人记在心里,也会让执行者不安。',
      options: [
        { id: 'lenient', name: '宽松', short: '训诫为主', P: 0.7, upkeep: 0 },
        { id: 'normal', name: '常规', short: '依法拘留', P: 1.0, upkeep: 0 },
        { id: 'harsh', name: '严厉', short: '重判示众', P: 1.3, upkeep: 0.1, cost: 1 },
        { id: 'terror', name: '铁腕', short: '株连处决', P: 1.7, upkeep: 0.2, cost: 1 },
      ],
    },
    police: {
      name: '警力部署', icon: '🚓',
      desc: '每一轮能抓多少人。人手越多,零星的抗议者越跑不掉;人手有限时,人一多,每个人被抓的机会就被摊薄了。',
      options: [
        { id: 'lean', name: '精简', short: '省下开支', K: 0.6, upkeep: -0.15 },
        { id: 'normal', name: '常规', short: '日常警力', K: 1.0, upkeep: 0 },
        { id: 'surge', name: '增派', short: '调集外地警力', K: 1.7, upkeep: 0.3, cost: 1 },
        { id: 'martial', name: '戒严', short: '军队进城', K: 3.0, upkeep: 0.6, cost: 2 },
      ],
    },
    target: {
      name: '抓捕对象', icon: '🎯',
      desc: '抓谁。专抓串联者会切断联系;按名单预防性拘押不等人上街就先抓走最可能站出来的人——但名单越长,开销越大。',
      options: [
        { id: 'uniform', name: '见一个抓一个', short: '街上抓到谁算谁', mode: 'uniform', upkeep: 0 },
        { id: 'organizer', name: '专抓串联者', short: '切断联系', mode: 'organizer', upkeep: 0.1, needNet: true },
        { id: 'preventive', name: '预防性拘押', short: '按名单先抓', mode: 'preventive', upkeep: 0.3, cost: 1 },
      ],
    },
    info: {
      name: '舆论管控', icon: '📺',
      desc: '人们能看到多少。封锁让人低估别人的参与、也看不见镇压——但被压住的记忆并没有消失,一旦曝光会加倍兑现。封锁也会蒙住你自己的眼睛。',
      options: [
        { id: 'open', name: '如实报道', short: '人人看得见', gs: 1.0, vis: 1.0, upkeep: 0 },
        { id: 'spin', name: '淡化处理', short: '大事化小', gs: 0.72, vis: 0.65, upkeep: 0.05 },
        { id: 'blackout', name: '全面封锁', short: '断网禁言', gs: 0.42, vis: 0.35, upkeep: 0.25, cost: 1 },
      ],
    },
    release: {
      name: '关押政策', icon: '🔓',
      desc: '抓进去的人关多久。放人会让他们回到街头(带着记忆),关着则要花钱,也让家属与邻居记恨。',
      options: [
        { id: 'long', name: '从严关押', short: '长期羁押', rel: 0.02, upkeep: 0.1 },
        { id: 'normal', name: '依法释放', short: '关满就放', rel: 0.08, upkeep: 0 },
        { id: 'lenient', name: '宽大处理', short: '教育释放', rel: 0.25, upkeep: -0.05 },
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
      side: 'movement', name: '小型集会', icon: '✊', cost: 1, cd: 2,
      text: '召集一小群人公开表态。人少的时候,他们多半会被抓走——但也可能是火种。',
      tags: ['上街 +少量'], run(g) { g.addSeeds(0.015); },
    },
    march: {
      side: 'movement', name: '大游行', icon: '🚩', cost: 2, cd: 4,
      text: '提前约好时间地点,一起走上街。人越多,每个人被抓的机会越小。',
      tags: ['上街 +较多'], run(g) { g.addSeeds(0.04); },
    },
    mobilize: {
      side: 'movement', name: '串联动员', icon: '📞', cost: 2, cd: 5,
      text: '一个一个去找那些"只差一步"的人。犹豫的人最容易被身边的人带动。',
      tags: ['上街 +精准', '找到犹豫的人'], run(g) { g.addSeeds(0.03, 'near'); g.revealFor(2); },
    },
    strike: {
      side: 'movement', name: '总罢工', icon: '🏭', cost: 3, cd: 10,
      text: '工厂停工、商店关门、学校罢课。人多,而且让对方的钱袋子吃紧。',
      tags: ['上街 +大量', '对方资源 −'], run(g) { g.addSeeds(0.08); g.hurtOpponent(4); },
    },
    samizdat: {
      side: 'movement', name: '地下刊物', icon: '📰', cost: 1, cd: 4,
      text: '手抄本、传单、境外广播。让人知道:不止你一个人这么想。',
      tags: ['打破封锁', '官方说法失信'],
      run(g) {
        const fw = g._actor === 'opp' && g.flags.firewall ? 0.5 : 1;
        g.addEffect({ id: 'samizdat', name: '地下刊物流传', icon: '📰', side: 'movement', rounds: 4, mod(m) { m.gs = Math.min(1, m.gs + 0.25 * fw); m.noise *= 0.5; } });
        g.base.Pbar = Math.max(0.2, g.base.Pbar - 0.02);
      },
    },
    leak: {
      side: 'movement', name: '曝光真相', icon: '📼', cost: 2, cd: 8,
      text: '把被压下去的画面送出去。封锁压住的不是记忆,只是记忆的公开。',
      tags: ['被压住的愤怒 → 公开', '人人看见'],
      run(g) {
        g.addEffect({ id: 'leak', name: '真相曝光', icon: '📼', side: 'movement', rounds: 2, mod(m) { m.vis = Math.max(m.vis, 1); m.gs = 1; m.omega = Math.max(m.omega, 0.7); } });
        const v = g.sim.reveal(g._actor === 'opp' && g.flags.firewall ? 0.35 : 0.7);
        g.fx.push({ type: 'reveal', amt: v });
      },
    },
    memorial: {
      side: 'movement', name: '悼念活动', icon: '🕯️', cost: 1, cd: 6,
      text: '为被抓、被害的人点一支蜡烛。悼念让"发生过什么"留在人们心里。',
      tags: ['记忆 ↑', '此后的处罚更刺痛'],
      run(g) {
        g.addEffect({ id: 'memorial', name: '悼念', icon: '🕯️', side: 'movement', rounds: 5, mod(m) { m.vis = Math.min(1.6, m.vis * 1.6 + 0.1); } });
        griefAll(g, Math.min(0.06, 0.3 * g.sim.R + 0.006));
      },
    },
    fraternize: {
      side: 'movement', name: '劝说士兵', icon: '🌷', cost: 2, cd: 6,
      text: '给士兵送水、送花,和他们说话:"你们也是人民的子弟。"',
      tags: ['军心 ↓'],
      run(g) {
        scalePsi(g, 0.3, 0.7);
        g.addEffect({ id: 'fraternize', name: '军民对话', icon: '🌷', side: 'movement', rounds: 6, mod(m) { m.alpha += 0.12; } });
      },
    },
    network: {
      side: 'movement', name: '串联织网', icon: '🕸️', cost: 1, cd: 5, needNet: true,
      text: '在学校、工厂、教会之间建立可信的联系。熟人之间,一个人站出来就能带动另一个。',
      tags: ['更容易互相带动'], run(g) { addEdges(g, Math.round(g.N * 0.35)); },
    },
    legal: {
      side: 'movement', name: '营救被捕者', icon: '📜', cost: 1, cd: 6,
      text: '律师、家属、联名信。把人要回来——他们回来时带着记忆。',
      tags: ['被捕者获释', '人手回流'],
      run(g) {
        const s = g.sim;
        for (let i = 0; i < s.o.N; i++) if (s.r[i] && s.rng() < 0.15) s.r[i] = 0;
        s.tauDirty = true;
        g.addEffect({ id: 'legal', name: '营救行动', icon: '📜', side: 'movement', rounds: 6, mod(m) { m.rel += 0.12; } });
      },
    },
    hunger: {
      side: 'movement', name: '绝食请愿', icon: '🥣', cost: 2, cd: 14,
      text: '不吃饭,不离开。最弱者的姿态,最难被忽视。',
      tags: ['同情 ↑↑', '少量坚守者'],
      run(g) {
        g.addSeeds(0.006);
        const vis = g.sim.o.vis;
        griefAll(g, 0.035 * clamp(vis + 0.3, 0.3, 1.3));
      },
    },
    lowkey: {
      side: 'movement', name: '化整为零', icon: '🌫️', cost: 1, cd: 6,
      text: '分散、换地点、不留名。对方更难找到你,但别人也更难看见你。',
      tags: ['被抓风险 ↓', '可见度 ↓'],
      run(g) { g.addEffect({ id: 'lowkey', name: '化整为零', icon: '🌫️', side: 'movement', rounds: 3, mod(m) { m.K0 *= 0.6; m.gs *= 0.8; } }); },
    },

    /* ---- 关卡专属(行动方) ---- */
    blockade: {
      side: 'movement', name: '拦阻军车', icon: '🚚', cost: 1, cd: 3, special: true,
      text: '市民、老人、学生涌上路口,围住军车,给士兵送饭、讲道理。',
      tags: ['戒严部队受阻', '军心 ↓'],
      when: (g) => g.pol.police === 'martial' || !!g.flags.martialLaw, whenText: '仅在戒严时可用',
      run(g) {
        g.addEffect({ id: 'blockade', name: '军车受阻', icon: '🚚', side: 'movement', rounds: 2, mod(m) { m.K0 *= 0.55; m.alpha += 0.1; } });
        scalePsi(g, 0.2, 0.75);
      },
    },
    goddess: {
      side: 'movement', name: '民主女神像', icon: '🗽', cost: 2, cd: 99, once: true, special: true,
      text: '美院学生连夜赶制的泡沫雕像,立在广场上,面对城楼。',
      tags: ['士气 ↑', '全世界在看'],
      run(g) {
        g.addSeeds(0.03);
        g.addEffect({ id: 'goddess', name: '女神像', icon: '🗽', side: 'movement', rounds: 3, mod(m) { m.vis = Math.max(m.vis, 1); m.gs = Math.max(m.gs, 0.8); } });
        griefAll(g, 0.015);
      },
    },
    prayer: {
      side: 'movement', name: '和平祈祷', icon: '⛪', cost: 1, cd: 2, special: true,
      text: '尼古拉教堂每周一的和平祈祷。教堂的门开着,出来的人会走到街上。周一免费。',
      tags: ['上街 +精准', '周一免费'],
      costFn: (g) => (g.isMonday() ? 0 : 1),
      run(g) { g.addSeeds(g.isMonday() ? 0.022 : 0.01, 'near'); },
    },
    cassette: {
      side: 'movement', name: '录音带布道', icon: '📼', cost: 1, cd: 4, special: true,
      text: '流亡者的讲道录在卡带上,在清真寺和集市之间一盘盘翻录。',
      tags: ['更容易互相带动', '王权失信'],
      run(g) { addEdges(g, Math.round(g.N * 0.2)); g.base.Pbar = Math.max(0.25, g.base.Pbar - 0.03); },
    },
    banner: {
      side: 'movement', name: '桥上的横幅', icon: '🪧', cost: 1, cd: 99, once: true, special: true,
      text: '一个人,一座桥,两条横幅,一团浓烟。他会被带走——但照片会留下来。',
      tags: ['一个人', '全网都看见了'],
      run(g) {
        g.addSeeds(1 / g.N);
        griefAll(g, 0.025);
        g.addEffect({ id: 'banner', name: '横幅照片流传', icon: '🪧', side: 'movement', rounds: 3, mod(m) { m.vis = Math.max(m.vis, 1); m.gs = Math.min(1, m.gs + 0.2); } });
      },
    },
    blankpaper: {
      side: 'movement', name: '举起白纸', icon: '📄', cost: 2, cd: 4, special: true,
      text: '白纸上什么也没写——所有人都知道上面写着什么。罪名很难定。',
      tags: ['上街 +较多', '被抓后果 ↓'],
      run(g) {
        g.addSeeds(0.035);
        g.addEffect({ id: 'blankpaper', name: '白纸', icon: '📄', side: 'movement', rounds: 2, mod(m) { m.P *= 0.65; } });
      },
    },
    usb: {
      side: 'movement', name: 'U盘里的韩剧', icon: '💾', cost: 1, cd: 2, special: true,
      text: '从边境带进来的 U 盘和 SD 卡。人们看到另一种日常——也渐渐知道,邻居也在偷偷看。',
      tags: ['官方说法失信', '知道别人也在看', '暴露风险 ↑'],
      run(g) {
        g.base.Pbar = Math.max(0.35, g.base.Pbar - 0.07);
        g.base.globalScale = Math.min(0.9, g.base.globalScale + 0.02);
        g.exposure += 9 * g.exposureMul;
        g.glowRandom(0.05);
      },
    },
    bribe: {
      side: 'movement', name: '打点关系', icon: '💵', cost: 1, cd: 3, special: true,
      text: '一条烟、一袋米、几张人民币。执法的人也要养家,市场让忠诚有了价格。',
      tags: ['执行者松动', '暴露风险 ↑'],
      run(g) { for (let j = 0; j < g.sim.psi.length; j++) g.sim.psi[j] *= 0.94; g.exposure += 5 * g.exposureMul; },
    },
    market: {
      side: 'movement', name: '市场网络', icon: '🧺', cost: 2, cd: 6, special: true,
      text: '长马当(集市)里的熟人网络。配给制度塌了以后,人们靠它活下来,也靠它传话。',
      tags: ['更容易互相带动', '组织力 +', '暴露风险 ↑'],
      run(g) { addEdges(g, Math.round(g.N * 0.25)); g.bonusIncome += 0.12; g.exposure += 7 * g.exposureMul; },
    },
    hide: {
      side: 'movement', name: '销毁痕迹', icon: '🔥', cost: 1, cd: 3, special: true,
      text: '烧掉名单,换掉联络人,把 U 盘藏进墙缝。',
      tags: ['暴露风险 ↓↓'], run(g) { g.exposure = Math.max(0, g.exposure - 28); },
    },

    /* ---- 教程 ---- */
    t_small: {
      side: 'movement', name: '几个人先站出来', icon: '🙋', cost: 1, cd: 0, special: true,
      text: '你和同班九个最要好的同学,十个人一起走出队列,站到主席台前。',
      tags: ['上街 +10 人'], run(g) { g.addSeeds(10 / g.N); },
    },
    t_big: {
      side: 'movement', name: '全年级串联', icon: '📣', cost: 3, cd: 0, special: true,
      text: '前一天晚上,你们挨个宿舍敲门,约好一听到"补课"就一起走出队列。二十五个人答应了。',
      tags: ['上街 +25 人'], run(g) { g.addSeeds(25 / g.N); },
    },

    /* ---------------- 朝廷 ---------------- */
    informants: {
      side: 'regime', name: '线人网络', icon: '👂', cost: 1, cd: 6,
      text: '派人混进人群,听他们私下说什么。这几天你会听到真话——最敢说话的人也会先被抓。',
      tags: ['情报准确', '看见民间怨气', '先抓最坚定的人'],
      run(g) {
        g.addEffect({ id: 'informants', name: '线人在听', icon: '👂', side: 'regime', rounds: 5, intel: true, mod(m) { if (m.targetMode === 'uniform') m.targetMode = 'zealot'; } });
        g.revealFor(5);
      },
    },
    editorial: {
      side: 'regime', name: '社论定性', icon: '🗞️', cost: 1, cd: 8,
      text: '在头版把这件事定性。怕的人会退缩——被冤枉的人会记住。',
      tags: ['上街风险 ↑', '一部分人被激怒'],
      run(g) {
        g.addEffect({ id: 'editorial', name: '定性社论', icon: '🗞️', side: 'regime', rounds: 6, mod(m) { m.P *= 1.2; } });
        griefAll(g, 0.045, 0.25);
      },
    },
    crackdown: {
      side: 'regime', name: '开枪清场', icon: '💥', cost: 3, cd: 12,
      text: '动用武力,不惜代价清空街道。街道会空——枪声也会被所有人听见。',
      tags: ['街头迅速清空', '积怨 ↑↑↑', '军心 ↓'],
      run(g) {
        g.addEffect({ id: 'crackdown', name: '清场', icon: '💥', side: 'regime', rounds: 2, mod(m) { m.P *= 2.2; m.K0 *= 2; m.vis = Math.max(m.vis, 0.85); } });
        g.flags.lastCrackdown = g.round;
        g.fx.push({ type: 'crackdown' });
      },
    },
    amnesty: {
      side: 'regime', name: '大赦', icon: '🕊️', cost: 2, cd: 12,
      text: '释放所有被关押的人。一些怨气会消散,但他们会回到街头。',
      tags: ['全部释放', '积怨 ↓'],
      run(g) { g.sim.r.fill(0); g.sim.tauDirty = true; griefScale(g, 0.88); },
    },
    dialogue: {
      side: 'regime', name: '对话让步', icon: '🤝', cost: 2, cd: 10,
      text: '"为民者宣之使言。"坐下来谈,认下一部分诉求。怨气会消,对手也会觉得你软。',
      tags: ['积怨 ↓↓', '民众认可的界线 ↑', '对方士气 ↑'],
      run(g) { g.base.Pbar += 0.08; griefScale(g, 0.72); g.hurtOpponent(-2); },
    },
    subsidy: {
      side: 'regime', name: '发放补贴', icon: '🍚', cost: 2, cd: 8,
      text: '降价、发粮、涨工资。买来的平静是真的——只是买不了多久。',
      tags: ['积怨 ↓'], run(g) { griefScale(g, 0.85); },
    },
    bonus: {
      side: 'regime', name: '加薪稳军心', icon: '💰', cost: 2, cd: 8,
      text: '给军警发奖金、升职、许诺。让他们觉得站在你这边值得。',
      tags: ['军心 ↑'],
      run(g) {
        const s = g.sim;
        for (let j = 0; j < s.psi.length; j++) s.psi[j] *= 1.25;
        for (let j = 0; j < s.z.length; j++) if (s.z[j] && s.rng() < 0.5) s.z[j] = 0;
      },
    },
    rotate: {
      side: 'regime', name: '调外地部队', icon: '🪖', cost: 3, cd: 15,
      text: '换上与本地人无亲无故、只听命令的部队。他们不会和人群说话。',
      tags: ['军心重置', '人群影响 ↓'],
      run(g) {
        const s = g.sim, sc = (g.base.psiScale || 1) * 1.3;
        for (let j = 0; j < s.psi.length; j++) s.psi[j] = s.rng() * sc;
        s.z.fill(0);
        g.addEffect({ id: 'rotate', name: '外地部队', icon: '🪖', side: 'regime', rounds: 8, mod(m) { m.alpha *= 0.4; } });
      },
    },
    cutnet: {
      side: 'regime', name: '切断通讯', icon: '📵', cost: 2, cd: 10,
      text: '掐断电话、网络、广播。人们只能听到你想让他们听到的。',
      tags: ['互相看不见', '被压住的记忆 ↑'],
      run(g) {
        g.addEffect({ id: 'cutnet', name: '通讯中断', icon: '📵', side: 'regime', rounds: 4, mod(m) { m.omega = 1; m.gs *= 0.6; m.vis *= 0.6; } });
        cutEdges(g, g.flags.cutResist ? 0.1 : 0.25);
      },
    },
  };

  const DIFFS = {
    easy: { name: '简单', income: 1.25, aggr: 0.75 },
    normal: { name: '标准', income: 1.0, aggr: 1.0 },
    hard: { name: '困难', income: 0.85, aggr: 1.2 },
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
  const SEEDS = { rally: 0.015, march: 0.04, mobilize: 0.03, strike: 0.08, goddess: 0.03, blankpaper: 0.035, hunger: 0.006, t_small: 0.01, t_big: 0.025 };
  CARDS.prayer.seedFn = (g) => (g.isMonday() ? 0.022 : 0.01);

  /* ---------- 气泡: 局势变化时冒出来, 点击收集 ---------- */
  const BUBBLES = {
    anger: { icon: '💢', name: '愤怒', tip: '越界的处罚被人看见了' },
    morale: { icon: '✊', name: '士气', tip: '街上的人多了' },
    sympathy: { icon: '🌷', name: '同情', tip: '有执行者动摇了' },
    word: { icon: '📡', name: '消息', tip: '消息在网络里传开' },
    order: { icon: '🏛️', name: '安定', tip: '又一个平静的日子' },
    intel: { icon: '👂', name: '情报', tip: '审讯带来了情报' },
    loyalty: { icon: '🎖️', name: '忠诚', tip: '军心稳住了' },
  };

  /* ============================================================
   * 建设树: 永久升级(像《瘟疫公司》的进化)。每项都让对方更警觉。
   * ============================================================ */
  const shiftTau = (g, d) => { const s = g.sim; for (let i = 0; i < s.tau.length; i++) s.tau[i] += d; s.tauDirty = true; };
  const TREES = {
    movement: [
      { id: 'spread', name: '传播', icon: '📡', desc: '人们能看见彼此多少', nodes: [
        { id: 'm_word', name: '口耳相传', cost: 4, alert: 1, text: '熟人之间的消息网。一个人站出来,更容易带动身边的人。', tags: ['互相带动 ↑', '偶尔冒出「消息」气泡'], run(g) { addEdges(g, Math.round(g.N * 0.2)); } },
        { id: 'm_net', name: '联络网', cost: 9, req: ['m_word'], alert: 2, text: '固定的联络人与暗号。约好的行动,来的人更多。', tags: ['每次行动带出的人 +25%'], run(g) { g.seedMul *= 1.25; } },
        { id: 'm_press', name: '地下刊物', cost: 9, req: ['m_word'], alert: 3, text: '手抄本、油印传单。官方的说法不再是唯一的说法。', tags: ['封锁的效果 −30%', '执法更容易被看作越界'], run(g) { g.infoResist = Math.max(g.infoResist, 0.3); g.base.Pbar -= 0.04; } },
        { id: 'm_foreign', name: '境外媒体', cost: 14, req: ['m_press'], alert: 4, text: '外国记者、短波电台、翻墙。被压下去的事情,终究会被知道。', tags: ['封锁的效果 −60%', '被压住的愤怒立刻浮出'], run(g) { g.infoResist = Math.max(g.infoResist, 0.6); g.sim.reveal(0.6); } },
        { id: 'm_crypto', name: '加密通讯', cost: 18, req: ['m_net'], alert: 3, text: '抓走一个人,不再能顺藤摸瓜。', tags: ['每次行动带出的人 +25%', '断联打击减半'], run(g) { g.seedMul *= 1.25; g.sim.o.netDamage = (g.sim.o.netDamage || 0.5) * 0.5; g.flags.cutResist = true; } },
      ] },
      { id: 'memory', name: '记忆', icon: '🕯️', desc: '镇压在人们心里留下多少', nodes: [
        { id: 'm_witness', name: '口述见证', cost: 4, alert: 1, text: '把看到的事情讲给别人听。每一次越界的处罚,都会被更多人记住。', tags: ['处罚留下的记忆 +30%'], run(g) { g.base.gamma *= 1.3; } },
        { id: 'm_mourn', name: '悼念传统', cost: 8, req: ['m_witness'], alert: 2, text: '为逝者守灵、做七、过四十日。记忆不再很快褪去。', tags: ['遗忘速度 −40%'], run(g) { g.sim.o.memDecay *= 0.6; } },
        { id: 'm_names', name: '受难者名单', cost: 10, req: ['m_witness'], alert: 3, text: '一个一个地记下名字。处罚不再是数字,而是某个人。', tags: ['处罚被看见的程度 +25%'], run(g) { g.base.vis *= 1.25; } },
        { id: 'm_anniv', name: '纪念日', cost: 12, req: ['m_mourn'], alert: 3, text: '每到那一天,人们都会想起。', tags: ['每隔一段时间,积怨自动上升'], run(g) { g.flags.anniv = true; } },
        { id: 'm_courage', name: '不再沉默', cost: 21, req: ['m_names', 'm_anniv'], reqAny: true, alert: 6, text: '人们开始相信:沉默保护不了任何人。', tags: ['所有人都更敢站出来'], run(g) { shiftTau(g, g.L.courage != null ? g.L.courage : 0.035); } },
      ] },
      { id: 'resist', name: '韧性', icon: '🛡️', desc: '扛住镇压,赢得执行者', nodes: [
        { id: 'm_legal', name: '法律援助', cost: 4, alert: 1, text: '律师、家属、联名信。被抓的人能更快回来。', tags: ['被捕者获释 ↑'], run(g) { g.relBonus += 0.07; } },
        { id: 'm_family', name: '家属互助', cost: 9, req: ['m_legal'], alert: 1, text: '有人被抓,他的家人有人照顾。站出来不再意味着全家遭殃。', tags: ['被抓的代价 −12%'], run(g) { g.penaltyMul *= 0.88; } },
        { id: 'm_talk', name: '与士兵交谈', cost: 8, alert: 2, text: '士兵也是某人的儿子。和他们说话,给他们送水。', tags: ['人群对执行者的影响 ↑'], run(g) { g.base.alpha += 0.08; } },
        { id: 'm_sympath', name: '军中同情者', cost: 14, req: ['m_talk'], alert: 3, text: '有些军官私下表示同情。', tags: ['执行者更容易动摇'], run(g) { scalePsi(g, 1, 0.85); } },
        { id: 'm_barracks', name: '兵营串联', cost: 20, req: ['m_sympath'], alert: 4, text: '一个团倒戈,消息会传到下一个团。', tags: ['倒戈会连锁'], run(g) { g.sim.o.beta += 0.15; } },
      ] },
    ],
    regime: [
      { id: 'fist', name: '铁拳', icon: '🪖', desc: '能抓多少人,执行者是否可靠', nodes: [
        { id: 'r_police', name: '扩编警力', cost: 6, text: '更多的警察、更多的车。', tags: ['每轮能抓的人 +20%'], run(g) { g.base.K0 *= 1.2; } },
        { id: 'r_riot', name: '防暴部队', cost: 10, req: ['r_police'], text: '专门训练过的防暴队伍。', tags: ['每轮能抓的人 +15%'], run(g) { g.base.K0 *= 1.15; } },
        { id: 'r_pay', name: '军饷优先', cost: 9, req: ['r_police'], text: '先保证拿枪的人吃饱。', tags: ['执行者更可靠'], run(g) { scalePsi(g, 1, 1.2); } },
        { id: 'r_outside', name: '外地驻军', cost: 14, req: ['r_riot'], text: '换防成与本地无亲无故的部队。', tags: ['人群对执行者的影响 −30%'], run(g) { g.base.alpha *= 0.7; } },
        { id: 'r_loyal', name: '政治委员', cost: 18, req: ['r_outside', 'r_pay'], reqAny: true, text: '每个连队都有人盯着。', tags: ['执行者之间不再互相带动'], run(g) { g.sim.o.beta *= 0.5; } },
      ] },
      { id: 'eye', name: '天网', icon: '👁️', desc: '你能知道多少,他们能看见多少', nodes: [
        { id: 'r_inform', name: '线人', cost: 6, text: '在每个单位、每条街安插耳目。', tags: ['情报更准', '「情报」气泡更多'], run(g) { g.intelBonus += 0.2; } },
        { id: 'r_grid', name: '网格化管理', cost: 10, req: ['r_inform'], text: '每户都有人负责盯着。', tags: ['在案名单扩大', '反对派组织更慢'], run(g) { g.flagTop(0.04); g.orgMul *= 0.8; } },
        { id: 'r_censor', name: '新闻审查', cost: 9, req: ['r_inform'], text: '删帖、封号、约谈编辑。', tags: ['人们更低估彼此'], run(g) { g.base.globalScale *= 0.85; } },
        { id: 'r_propaganda', name: '舆论引导', cost: 12, req: ['r_censor'], text: '让大家相信:别人都很满意。', tags: ['人们更低估彼此', '执法更少被看作越界'], run(g) { g.base.globalScale *= 0.85; g.base.Pbar += 0.05; } },
        { id: 'r_firewall', name: '防火墙', cost: 16, req: ['r_propaganda'], text: '外面的消息进不来。', tags: ['对方的「曝光」「刊物」效果减半'], run(g) { g.flags.firewall = true; } },
      ] },
      { id: 'heart', name: '民心', icon: '⚖️', desc: '人们是否还认为你的统治正当', nodes: [
        { id: 'r_relief', name: '惠民补贴', cost: 6, text: '降价、发粮。', tags: ['积怨 −15%', '以后每轮收入略减'], run(g) { griefScale(g, 0.85); g.bonusIncome -= 0.15; } },
        { id: 'r_petition', name: '信访渠道', cost: 9, req: ['r_relief'], text: '让人有地方说话。', tags: ['人们认可的界线 ↑', '反对派组织更慢'], run(g) { g.base.Pbar += 0.1; g.orgMul *= 0.85; } },
        { id: 'r_law', name: '依法治理', cost: 12, req: ['r_petition'], text: '按程序抓人,按程序审判。', tags: ['人们认可的界线 ↑', '执行者更安心'], run(g) { g.base.Pbar += 0.1; g.sim.o.delta *= 0.6; } },
        { id: 'r_share', name: '让利于民', cost: 14, req: ['r_relief'], text: '日子过得去的人,有更多可以失去。', tags: ['所有人都更不愿冒险'], run(g) { shiftTau(g, -(g.L.courage != null ? g.L.courage : 0.035)); } },
        { id: 'r_reform', name: '政治改革', cost: 22, req: ['r_law', 'r_share'], reqAny: true, text: '让一部分诉求成为制度。', tags: ['积怨 −40%', '界线大幅上移'], run(g) { g.base.Pbar += 0.25; griefScale(g, 0.6); g.org = Math.max(0, g.org - 30); } },
      ] },
    ],
  };
  const STAGES = [
    { name: '常态', tip: '日常管控' },
    { name: '警戒', tip: '增派警力、加重处罚、淡化报道' },
    { name: '严打', tip: '封锁新闻、专抓串联者、社论定性' },
    { name: '全面镇压', tip: '铁腕、戒严、可能开枪清场' },
  ];

  /* ============================================================
   * 突发事件: 每隔几轮抽一张, 逼你在两难之间选择
   * modern: 只出现在近现代关卡; if: 出现条件
   * ============================================================ */
  const RANDOM_EVENTS = {
    movement: [
      { id: 'death', art: '⚰️', title: '拘留所里的死讯', if: (g) => g.sim.R > 0.01,
        text: '一名被带走的人死在了拘留所里。官方说是"突发疾病"。他的家人想见遗体。',
        choices: [
          { label: '公开遗体照片,组织送葬', hint: '积怨大增 · 当局警觉 +12 · 悼念免费', run: (g) => { griefAll(g, 0.04); g.addAlert(12); g.giveFree('memorial', 3); } },
          { label: '私下安葬,保护他的家人', hint: '少量积怨 · 当局警觉 −5', run: (g) => { griefAll(g, 0.01); g.addAlert(-5); } },
        ] },
      { id: 'mole', art: '🕵️', title: '内鬼', if: (g) => g.round > 4,
        text: '最近几次聚会,警察都来得太快了。有人怀疑组织里混进了线人。',
        choices: [
          { label: '彻底清查', hint: '花费 3 点 · 联系网收缩 · 当局警觉 −8', run: (g) => { g.me.ap = Math.max(0, g.me.ap - 3); cutEdges(g, 0.06); g.addAlert(-8); } },
          { label: '不能自乱阵脚', hint: '接下来 4 轮,对方抓人效率 +40%', run: (g) => g.addEffect({ id: 'mole', name: '内鬼', icon: '🕵️', side: 'regime', rounds: 4, mod(m) { m.K0 *= 1.4; } }) },
        ] },
      { id: 'press', art: '📷', title: '记者来了', modern: true,
        text: '一队外国记者进了城。他们想知道这里到底发生了什么。',
        choices: [
          { label: '带他们去看', hint: '3 轮内所有人都看得见 · 当局警觉 +6', run: (g) => { g.addEffect({ id: 'press_ev', name: '记者在场', icon: '📷', side: 'movement', rounds: 3, mod(m) { m.vis = Math.max(m.vis, 1); m.gs = Math.max(m.gs, 0.9); } }); g.addAlert(6); } },
          { label: '保持低调', hint: '什么也不发生' },
        ] },
      { id: 'prices', art: '🍞', title: '物价飞涨',
        text: '面粉的价格一夜之间翻了一倍。排队的人在骂,但没人敢大声。',
        choices: [
          { label: '组织抗议', hint: '立刻带出一批人 · 当局警觉 +5', run: (g) => { g.addSeeds(0.02); g.addAlert(5); } },
          { label: '组织互助', hint: '+3 点 · 积怨上升', run: (g) => { g.me.ap += 3; griefAll(g, 0.015); } },
        ] },
      { id: 'talks', art: '🤝', title: '当局提出谈判', if: (g) => g.x > 0.015 || g.alert > 45,
        text: '一位官员托人带话:可以谈,但你们先解散。',
        choices: [
          { label: '同意谈判,先解散', hint: '街上的人回家 · 当局警觉 −25 · +4 点', run: (g) => { g.sim.a.fill(0); g.addAlert(-25); g.me.ap += 4; } },
          { label: '拒绝:先放人,再谈', hint: '当局警觉 +8 · 士气上升', run: (g) => { g.addAlert(8); griefAll(g, 0.012); } },
        ] },
      { id: 'split', art: '⚡', title: '内部分歧', if: (g) => g.x > 0.005 || g.round > 10,
        text: '激进派要冲击政府大楼;温和派坚持:我们不能给他们开枪的理由。',
        choices: [
          { label: '冲!', hint: '立刻带出很多人 · 但 3 轮内对方处罚加重 · 当局警觉 +15', run: (g) => { g.addSeeds(0.04); g.addAlert(15); g.addEffect({ id: 'pretext', name: '镇压的借口', icon: '🔥', side: 'regime', rounds: 3, mod(m) { m.P *= 1.35; } }); } },
          { label: '坚持非暴力', hint: '执行者更同情你们(永久)', run: (g) => { scalePsi(g, 0.4, 0.85); g.base.alpha += 0.04; } },
        ] },
      { id: 'writer', art: '✍️', title: '一位名人声援', modern: true,
        text: '一位很有名的作家在公开信上签了名。他的读者很多——他也可能因此被抓。',
        choices: [
          { label: '大力宣传', hint: '执法更容易被看作越界 · 3 轮内更多人看见 · 当局警觉 +4', run: (g) => { g.base.Pbar -= 0.05; g.addEffect({ id: 'writer', name: '名人声援', icon: '✍️', side: 'movement', rounds: 3, mod(m) { m.gs = Math.min(1, m.gs + 0.15); } }); g.addAlert(4); } },
          { label: '请他暂时沉默,保护自己', hint: '+2 点', run: (g) => { g.me.ap += 2; } },
        ] },
      { id: 'festival', art: '🏮', title: '节日',
        text: '节日到了。人们本来就会聚在一起。',
        choices: [
          { label: '借节日集会', hint: '带出一批人,这一轮被抓的后果很轻', run: (g) => { g.addSeeds(0.025); g.addEffect({ id: 'festival', name: '节日', icon: '🏮', side: 'movement', rounds: 1, mod(m) { m.P *= 0.6; } }); } },
          { label: '休养生息', hint: '+3 点 · 当局警觉 −6', run: (g) => { g.me.ap += 3; g.addAlert(-6); } },
        ] },
      { id: 'letter', art: '✉️', title: '士兵的信', if: (g) => g.d > 0.02 || g.round > 8,
        text: '一个年轻士兵偷偷递来一封信:"我们不想开枪。"',
        choices: [
          { label: '公开这封信', hint: '一部分执行者动摇 · 当局警觉 +6', run: (g) => { scalePsi(g, 0.25, 0.65); g.addAlert(6); } },
          { label: '保密,继续联络', hint: '少数执行者动摇', run: (g) => { scalePsi(g, 0.12, 0.75); } },
        ] },
      { id: 'release', art: '🚪', title: '一批人被放了回来', if: (g) => g.sim.R > 0.02,
        text: '一批被关押的人获释回家。他们瘦了很多,也不再害怕。',
        choices: [
          { label: '办一场欢迎会', hint: '积怨上升 · 当局警觉 +4', run: (g) => { const s = g.sim; for (let i = 0; i < s.o.N; i++) if (s.r[i] && s.rng() < 0.2) s.r[i] = 0; griefAll(g, 0.02); g.addAlert(4); } },
          { label: '让他们好好休养', hint: '+2 点', run: (g) => { g.me.ap += 2; } },
        ] },
    ],
    regime: [
      { id: 'r_ringleaders', art: '📋', title: '下面来请示',
        text: '地方官报上来一份名单:"这几个带头的,抓不抓?"',
        choices: [
          { label: '抓', hint: '反对派组织度 −18 · 但越界的抓捕会留下积怨', run: (g) => { g.org = Math.max(0, g.org - 18); const s = g.sim; let n = 0; for (let i = 0; i < s.o.N && n < g.N * 0.006; i++) if (s.flagged[i] && !s.r[i]) { s.r[i] = 1; n++; } s.R += n / g.N; s.tauDirty = true; if (s.o.P > s.o.Pbar) griefAll(g, 0.012); } },
          { label: '先盯着', hint: '5 轮内情报准确', run: (g) => g.addEffect({ id: 'watch', name: '盯梢', icon: '👂', side: 'regime', rounds: 5, intel: true }) },
        ] },
      { id: 'r_pay', art: '💸', title: '军饷',
        text: '国库吃紧。军饷可能要拖欠了。',
        choices: [
          { label: '先保军饷', hint: '花费 4 点', run: (g) => { g.me.ap = Math.max(0, g.me.ap - 4); } },
          { label: '拖一拖', hint: '执行者的忠诚下降', run: (g) => scalePsi(g, 1, 0.85) },
        ] },
      { id: 'r_rumor', art: '🗯️', title: '谣言',
        text: '街头流传一个关于你的谣言。越传越离谱。',
        choices: [
          { label: '辟谣', hint: '花费 2 点 · 积怨略降', run: (g) => { g.me.ap = Math.max(0, g.me.ap - 2); griefScale(g, 0.93); } },
          { label: '抓造谣的人', hint: '反对派组织度 −6 · 积怨上升', run: (g) => { g.org = Math.max(0, g.org - 6); griefAll(g, 0.015); } },
        ] },
      { id: 'r_disaster', art: '🌊', title: '天灾',
        text: '大水冲毁了城外的村子,灾民涌进城里。',
        choices: [
          { label: '全力救灾', hint: '花费 6 点 · 积怨 −20% · 人们认可的界线 ↑', run: (g) => { g.me.ap = Math.max(0, g.me.ap - 6); griefScale(g, 0.8); g.base.Pbar += 0.05; } },
          { label: '封锁消息', hint: '反对派组织度 +12 · 积怨上升', run: (g) => { g.org += 12; griefAll(g, 0.02); } },
        ] },
      { id: 'r_hawks', art: '🦅', title: '强硬派',
        text: '身边的强硬派说你太软弱了,要求严打。',
        choices: [
          { label: '顺从他们', hint: '+4 点 · 执法被锁定为「严厉」4 轮', run: (g) => { g.me.ap += 4; g.forcePolicy('enforce', 'harsh', 4, '强硬派'); } },
          { label: '顶住压力', hint: '花费 2 点', run: (g) => { g.me.ap = Math.max(0, g.me.ap - 2); } },
        ] },
      { id: 'r_advisor', art: '🧓', title: '老臣进谏',
        text: '一位老臣冒死进谏:百姓的怨气,不是堵得住的。',
        choices: [
          { label: '采纳', hint: '免费「对话让步」', run: (g) => g.selfCard('dialogue', '你采纳了进谏。') },
          { label: '贬斥他', hint: '反对派组织度 +8', run: (g) => { g.org += 8; } },
        ] },
      { id: 'r_corrupt', art: '💰', title: '军官贪腐',
        text: '有军官倒卖军需被揭发了。',
        choices: [
          { label: '严惩', hint: '花费 2 点 · 执行者更可靠', run: (g) => { g.me.ap = Math.max(0, g.me.ap - 2); scalePsi(g, 1, 1.1); } },
          { label: '内部处理', hint: '+2 点 · 执行者略有不满', run: (g) => { g.me.ap += 2; scalePsi(g, 1, 0.95); } },
        ] },
      { id: 'r_press', art: '📷', title: '外国记者', modern: true,
        text: '几名外国记者申请进城采访。',
        choices: [
          { label: '驱逐出境', hint: '反对派组织度 −5 · 执法更容易被看作越界', run: (g) => { g.org = Math.max(0, g.org - 5); g.base.Pbar -= 0.03; } },
          { label: '允许采访', hint: '人们认可的界线 ↑ · 3 轮内一切都被看见', run: (g) => { g.base.Pbar += 0.04; g.addEffect({ id: 'press_r', name: '记者在场', icon: '📷', side: 'movement', rounds: 3, mod(m) { m.vis = Math.max(m.vis, 1); } }); } },
        ] },
    ],
  };

  /* ============================================================
   * Game
   * ============================================================ */
  class Game {
    constructor(level, opts) {
      opts = opts || {};
      this.L = level;
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
      this.hist = { x: [], d: [], mood: [], moodSeen: [], tip: [], tipSeen: [], R: [], p: [], P: [], alert: [], org: [] };
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
    dateLabel(r) { return this.L.dateFmt ? this.L.dateFmt(r == null ? this.round : r) : `第 ${(r == null ? this.round : r) + 1} 轮`; }
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
      const mul = this._actor === 'me' ? this.seedMul : 1;
      const n = Math.max(1, Math.round(frac * this.N * (this.L.seedScale || 1) * mul));
      this.seedNext += n;
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
      if (say !== false) this.log(say || `当局:「${this.card(id).name}」`, 'opp');
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
      const cs = this.cardState(Object.assign({ id }, c));
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
      this.log(`你:「${this.card(id).name}」`, 'mine');
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
      const say = (this.L.oppSay && this.L.oppSay[id]) || (this.oppSide === 'regime' ? `当局:「${nm}」` : `对方:「${nm}」`);
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
      this.log(`你把「${POLICIES[key].name}」改为「${ps.opt.name}」`, 'mine');
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
      this.log(`建设:「${node.name}」`, 'mine');
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
      const o = this.sim.o;
      const inf = this.sim.net ? o.omega * o.globalScale + (1 - o.omega) : o.globalScale;
      const ana = this.sim.analysis({ useMem: true, kScale: 1 / Math.max(0.05, inf) });
      let v;
      const roots = ana.roots.filter(q => !q.boundary);
      const unstable = roots.find(q => !q.stable);
      if (unstable) v = unstable.x;
      else {
        const high = roots.find(q => q.stable && q.x > 0.05);
        if (high) {
          // 没有分界: 若零点附近 F(x)>x → 一点就着; 否则(只有低位稳定点)是极高门槛
          const f = this.sim.frozenF(0.002, o.P, ana.k, true);
          v = f > 0.002 ? 0 : Infinity;
        } else v = Infinity;
      }
      this.tipCache = { t: this.round, v };
      return v;
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
        x, count: crowdN, text: crowdN < 1 ? '空无一人' : `约 ${fmtCount(crowdN)} 人`,
        ...band(x, [0.002, 0.02, 0.08, 0.25, 0.5], ['空无一人', '零星几人', '一小群人', '人越来越多', '人山人海', '全城沸腾']),
      };
      const risk = band(pArr, [0.05, 0.2, 0.5, 0.9], ['几乎不会被抓', '偶尔有人被抓', '不少人被抓', '多半会被抓', '必被抓']);
      risk.p = pArr;
      const pen = band(o.P, [0.8, 1.05, 1.35, 1.75], ['训诫罚款', '拘留', '判刑', '重判', '株连·处决']);
      const over = o.P - o.Pbar;
      const legit = band(over, [0.001, 0.25, 0.6], ['在人们认可的界线内', '过火', '残暴', '暴虐']);
      legit.over = over;
      const dNoise = this.side === 'regime' ? 0 : this.intelNoise.army;
      const dShown = clamp(d + dNoise, 0, 1);
      const army = band(dShown, [0.05, 0.15, 0.35, 0.6], ['令行禁止', '私下抱怨', '人心浮动', '公开抗命', '成建制倒戈']);
      army.rumor = this.side !== 'regime';
      const moodTrue = this.meanGrievance() / this.moodScale;
      const bias = this.intelBias();
      const moodShown = this.side === 'regime' ? moodTrue * (1 - bias) : Math.max(0, moodTrue * (1 + this.intelNoise.mood));
      const mood = band(moodShown, [0.1, 0.3, 0.55, 0.8], ['平静', '隐忍', '积怨', '怨声载道', '一触即发']);
      mood.shown = moodShown; mood.bias = bias;
      mood.conf = this.side === 'regime'
        ? (bias >= 0.4 ? '低:下面的人不敢说真话' : bias >= 0.15 ? '中:报喜多于报忧' : '高')
        : '传闻';
      const tipTrue = this.L.structuralTip ? this.structuralTipping() : this.tipping();
      let tip;
      if (this.side === 'movement') {
        if (tipTrue === Infinity) tip = { kind: 'none', text: '看不到转机', sub: '即使全城一起站出来,眼下也会被压下去' };
        else if (tipTrue === 0) tip = { kind: 'tinder', text: '一点就着', sub: '任何一点火星都可能燎原' };
        else {
          const est = tipTrue * (1 + this.intelNoise.tip);
          const spread = this.L.tipSpread != null ? this.L.tipSpread : 0.3;
          const lo = est * (1 - spread), hi = est * (1 + spread);
          const cnt = (v) => fmtCount(Math.max(1, v * this.N * this.scale));
          tip = { kind: 'est', text: `约 ${cnt(lo)}～${cnt(hi)} 人`, sub: '需要这么多人同时站出来,才会连锁', est };
        }
        tip.shownFrac = tipTrue === Infinity ? 1 : tipTrue === 0 ? 0 : tip.est;
      } else {
        const seen = tipTrue === Infinity ? Infinity : tipTrue * (1 + 2.5 * bias) + 0.25 * bias;
        tip = band(seen === Infinity ? 9 : seen, [0.03, 0.08, 0.18, 0.35], ['岌岌可危', '脆弱', '尚稳', '稳固', '固若金汤']);
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
        this.log(up ? `当局升级为「${STAGES[stage].name}」:${STAGES[stage].tip}。` : `当局的戒备降到「${STAGES[stage].name}」。`, 'opp');
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
          if (!A.quiet) this.log((A.say && A.say[key + ':' + w]) || `当局:「${POLICIES[key].name}」→「${this.policyOpt(key).name}」`, 'opp');
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
        this.log(A.pushNews || '反对派发动了一次大规模行动!', 'opp');
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
            choices: (ev.choices || [{ label: '继续' }]).map(c => ({ label: c.label, hint: c.hint })),
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
        choices: E.choices.map((c) => ({ label: c.label, hint: c.hint })) };
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
      const seeds = this.seedNext, mode = this.seedMode;
      this.seedNext = 0; this.seedMode = 'random';
      const R0 = s.R, d0 = this.d;
      this.prevX = this.x; this.prevD = d0;
      s.step(seeds, mode);
      this.round = s.t;
      // 资源; 朝廷入不敷出时, 代价转嫁给百姓(物价、配给)——这也是积怨
      const raw = this.regimeRawIncome();
      if (raw < 0) {
        griefAll(this, Math.min(0.02, -raw * 0.025));
        if (this.round % 5 === 0) this.log(this.L.deficitNews || '财政吃紧:物价上涨,配给减少,排队的人更多了。', this.side === 'regime' ? 'intel' : 'event');
      }
      const incMe = this.income(this.side), incOpp = this.income(this.oppSide);
      this.me.ap = clamp(this.me.ap + incMe, 0, this.apCap);
      this.opp.ap = clamp(this.opp.ap + incOpp, 0, this.apCap);
      const arrestedNow = s.R - R0;
      this._spawnBubbles(arrestedNow, d0);
      if (!this.L.noAI) { if (this.side === 'movement') this._alertTick(); else this._orgTick(arrestedNow); }
      if (this.flags.anniv && this.round % 6 === 0) {
        griefAll(this, Math.min(0.03, 0.25 * s.R + 0.006));
        this.log('纪念日到了。人们又想起了那些人。', 'event');
      }
      // 起伏: 连锁反应 / 差一点
      const tipPrev = this.hist.tip.length ? this.hist.tip[this.hist.tip.length - 1] : 1;
      if (this.x >= 0.02 && this.x > this.prevX * 1.6 && this.x > tipPrev && this.round - this.lastIgnite > 6) {
        this.lastIgnite = this.round;
        this.fx.push({ type: 'ignite' });
        this.log('连锁反应开始了:越来越多的人加入。', 'crowd');
      } else if (this.prevX >= 0.015 && this.x < this.prevX * 0.45 && this.prevX > tipPrev * 0.55) {
        this.fx.push({ type: 'nearmiss' });
        this.log('差一点。人群散去了——再多一些人,也许就不一样了。', 'calm');
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
    }

    /** 以当前资源, 一次最多能把多少人带上街(占人口比例, 含已安排的) */
    pushCapacity() {
      let ap = this.me.ap, tot = this.seedNext / this.N;
      const ss = (this.L.seedScale || 1) * this.seedMul;
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
        if (arrested >= 0.002 || this.rng() < 0.4) this.log(`${fmtCount(n)} 人被带走。`, 'arrest');
      }
      if (cross(x, px, 0.02)) this.log(L.newsCrowd1 || '有人开始公开站出来了。', 'crowd');
      if (cross(x, px, 0.1)) this.log(L.newsCrowd2 || '人越聚越多——旁观的人开始犹豫要不要加入。', 'crowd');
      if (cross(x, px, 0.3)) this.log(L.newsCrowd3 || '街上已经是人的海洋。', 'crowd');
      if (px >= 0.05 && x < px * 0.4) this.log('街道又空了。', 'calm');
      if (cross(d, d0, 0.15)) this.log('执行者中有人开始拒绝执行命令。', 'army');
      if (cross(d, d0, 0.4)) this.log('执行系统出现大面积抗命!', 'army');
      if (this.side === 'regime') {
        if (this.round % 4 === 0) {
          const r = this.readout();
          this.log(`密报:民间${r.mood.words}。(可信度${r.mood.conf.slice(0, 1)})`, 'intel');
        }
      } else {
        const mu = this.sim.backfireMu().mu;
        if (mu > 1 && this.rng() < 0.3) this.log('街谈巷议:抓人反而让更多人坐不住了。', 'intel');
      }
      if (x < 0.003 && this.rng() < 0.06) this.log(L.quiet || '街上很安静。有人满意,有人疲惫,有人害怕,有人在等别人。', 'calm');
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
        stars.push({ text: this.L.starText ? this.L.starText[0] : '达成目标', ok: true });
        for (const s of (this.L.stars || [])) stars.push({ text: s.text, ok: !!s.test(this) });
      }
      this.over = {
        win: r.win, key: r.key, title: r.title || e.title || (r.win ? '胜利' : '失败'),
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
        peakArmy: band(peakD, [0.05, 0.15, 0.35, 0.6], ['令行禁止', '私下抱怨', '人心浮动', '公开抗命', '成建制倒戈']).words,
        rounds: this.round,
        moodEnd: band(this.meanGrievance() / this.moodScale, [0.1, 0.3, 0.55, 0.8], ['平静', '隐忍', '积怨', '怨声载道', '一触即发']).words,
      };
    }
  }

  const api = { Game, POLICIES, POLICY_KEYS, CARDS, DIFFS, TREES, STAGES, BUBBLES, SEEDS, RANDOM_EVENTS, fmtCount, band };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.SilenceGame = api;
})(typeof window !== 'undefined' ? window : globalThis);
