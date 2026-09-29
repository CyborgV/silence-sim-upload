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
      tags: ['上街 +大量', '对方资源 −'], run(g) { g.addSeeds(0.08); g.hurtOpponent(2); },
    },
    samizdat: {
      side: 'movement', name: '地下刊物', icon: '📰', cost: 1, cd: 4,
      text: '手抄本、传单、境外广播。让人知道:不止你一个人这么想。',
      tags: ['打破封锁', '官方说法失信'],
      run(g) {
        g.addEffect({ id: 'samizdat', name: '地下刊物流传', icon: '📰', side: 'movement', rounds: 4, mod(m) { m.gs = Math.min(1, m.gs + 0.25); m.noise *= 0.5; } });
        g.base.Pbar = Math.max(0.2, g.base.Pbar - 0.02);
      },
    },
    leak: {
      side: 'movement', name: '曝光真相', icon: '📼', cost: 2, cd: 8,
      text: '把被压下去的画面送出去。封锁压住的不是记忆,只是记忆的公开。',
      tags: ['被压住的愤怒 → 公开', '人人看见'],
      run(g) {
        g.addEffect({ id: 'leak', name: '真相曝光', icon: '📼', side: 'movement', rounds: 2, mod(m) { m.vis = Math.max(m.vis, 1); m.gs = 1; m.omega = Math.max(m.omega, 0.7); } });
        const v = g.sim.reveal(0.7);
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
      text: '你和九个最要好的同学,十个人一起走到台前。',
      tags: ['上街 +10 人'], run(g) { g.addSeeds(10 / g.N); },
    },
    t_big: {
      side: 'movement', name: '全年级串联', icon: '📣', cost: 3, cd: 0, special: true,
      text: '前一天晚上,你们挨个宿舍敲门,约好明天课间一起站出来。二十五个人答应了。',
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
      run(g) { g.base.Pbar += 0.08; griefScale(g, 0.72); g.hurtOpponent(-1); },
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
        cutEdges(g, 0.25);
      },
    },
  };

  const DIFFS = {
    easy: { name: '简单', income: 1.25, aggr: 0.75 },
    normal: { name: '标准', income: 1.0, aggr: 1.0 },
    hard: { name: '困难', income: 0.85, aggr: 1.2 },
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
      this.me = { ap: level.startAP != null ? level.startAP : 2, cool: {}, used: {} };
      this.opp = { ap: 1, cool: {}, used: {} };
      this.apCap = level.apCap || 5;
      this.bonusIncome = 0;
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
      this.hist = { x: [], d: [], mood: [], moodSeen: [], tip: [], tipSeen: [], R: [], p: [], P: [] };
      this.allowCards = null;                            // 教程用: 只允许这些牌
      if (level.setup) level.setup(this);
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
      const m = {
        P: B.P * en.P, K0: B.K0 * po.K, gs: B.globalScale * inf.gs, vis: B.vis * inf.vis, rel: re.rel * (this.L.relMul != null ? this.L.relMul : 1),
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
      this.seedNext += Math.max(1, Math.round(frac * this.N * (this.L.seedScale || 1)));
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
      const cost = opt.cost || 0;
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
        const base = (side === this.side ? (L.income != null ? L.income : 1) * this.diff.income + this.bonusIncome : ((L.ai && L.ai.income) || 1) * this.diff.aggr);
        return clamp(base + 1.2 * x, 0.1, 2.5);
      }
      return clamp(this.regimeRawIncome(), 0.12, 2.5);
    }
    /** 朝廷的真实收支(未截断): 为负即财政赤字 */
    regimeRawIncome() {
      const L = this.L, x = this.x, d = this.d;
      const base = this.side === 'regime' ? (L.income != null ? L.income : 1.1) * this.diff.income + this.bonusIncome : ((L.ai && L.ai.income) || 1.1) * this.diff.aggr;
      return base - this.upkeep() - 0.8 * d - 0.5 * x;
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

    /* ---------- 战争迷雾: 玩家看到的读数 ---------- */
    intelBias() {
      if (this.side !== 'regime') return 0;
      if (this.effects.some(e => e.intel)) return 0;
      const P = this.sim.o.P;
      let b = clamp((P - 0.95) * 0.9, 0, 0.7);
      if (this.pol.info === 'blackout') b += 0.2;
      else if (this.pol.info === 'spin') b += 0.08;
      return clamp(b, 0, 0.85);
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
      const tipTrue = this.tipping();
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

    /* ---------- AI: 朝廷 ---------- */
    _regimeAI() {
      // 当局的反应有一轮延迟: 看到的是上一轮的街头(官僚层层上报)
      // 而且警觉会维持一段时间: 取最近若干轮里最高的街头人数
      const hx = this.hist.x, A = this.L.ai || {}, st = this.opp;
      const x1 = hx.length >= 2 ? hx[hx.length - 2] : this.x, d = this.d;
      const px = hx.length >= 3 ? hx[hx.length - 3] : x1;
      let x = x1;
      for (let i = Math.max(0, hx.length - 1 - (A.hold || 6)); i < hx.length - 1; i++) x = Math.max(x, hx[i] * 0.85);
      const aggr = clamp((A.aggression != null ? A.aggression : 0.6) * this.diff.aggr * (this.flags.aggrMul || 1), 0, 1.3);
      const rng = this.rng;
      const lag = A.lag || 2;
      const ladder = (key, want) => {
        if (this.locks[key] && this.locks[key].until > this.round) return;
        if (!this.policyAllowed(key, want)) return;
        const lim = A.max && A.max[key];
        const opts = POLICIES[key].options.map(o => o.id);
        if (lim && opts.indexOf(want) > opts.indexOf(lim)) want = lim;
        if (this.pol[key] !== want) {
          this.pol[key] = want;
          const on = this.policyOpt(key).name;
          if (!A.quiet) this.log((A.say && A.say[key + ':' + want]) || `当局:「${POLICIES[key].name}」→「${on}」`, 'opp');
        }
      };
      if (this.round % lag === 0 || x > px + 0.03) {
        const s0 = (A.start || {});
        const calm = s0.enforce || 'normal';
        let en = calm;
        if (x >= 0.004) en = aggr > 0.35 ? 'harsh' : calm;
        if (x >= 0.12 && aggr > 0.75) en = 'terror';
        if (x < 0.002 && this.meanGrievance() / this.moodScale > 0.6 && aggr < 0.5) en = 'lenient';
        ladder('enforce', en);
        let po = s0.police || 'normal';
        if (x >= 0.015 && aggr > 0.3) po = 'surge';
        if (x >= 0.18 && aggr > 0.55) po = 'martial';
        ladder('police', po);
        let inf = s0.info || 'open';
        if (x >= 0.02) inf = 'spin';
        if (x >= 0.1 && aggr > 0.5) inf = 'blackout';
        ladder('info', inf);
        let ta = s0.target || 'uniform';
        if (this.sim.net && x >= 0.01 && aggr > 0.4) ta = 'organizer';
        if (aggr > 0.85 && x >= 0.03 && x < 0.2) ta = 'preventive';
        ladder('target', ta);
      }
      const cards = A.cards || [];
      const has = (id) => cards.includes(id);
      const want = [];
      if (d >= 0.35 && has('rotate')) want.push('rotate');
      if (d >= 0.15 && has('bonus')) want.push('bonus');
      if (x >= 0.22 && has('crackdown') && rng() < 0.35 * aggr) want.push('crackdown');
      if (x1 >= 0.03 && x1 > px + 0.01 && has('editorial')) want.push('editorial');
      if (x >= 0.02 && has('informants') && rng() < 0.25) want.push('informants');
      if (x >= 0.05 && has('cutnet') && rng() < 0.3 * aggr) want.push('cutnet');
      if (aggr < 0.55 && x < 0.03 && this.meanGrievance() / this.moodScale > 0.5 && has('dialogue')) want.push('dialogue');
      if (aggr < 0.55 && has('amnesty') && this.sim.R > 0.04 && rng() < 0.1) want.push('amnesty');
      for (const id of want) if (this._oppPlay(id)) break;
    }

    /* ---------- AI: 行动方 ---------- */
    _movementAI() {
      const A = this.L.ai || {}, x = this.x, st = this.opp, rng = this.rng;
      const cards = A.cards || ['rally', 'march', 'strike', 'memorial', 'leak', 'fraternize', 'samizdat'];
      const has = (id) => cards.includes(id);
      const aggr = (A.aggression != null ? A.aggression : 0.6) * this.diff.aggr;
      // 1) 看准时机的大动作(聪明的对手能感到"火候")
      const tip = this.tipping();
      if (rng() < (A.smart != null ? A.smart : 0.6) * aggr) {
        // 能凑出的最大一次性动员: 按规模从大到小, 在资源允许内全部打出
        const ss = this.L.seedScale || 1;
        const opts = [['strike', 0.08], ['march', 0.04], ['rally', 0.015]].filter(([id]) => has(id) && !((st.cool[id] || 0) > 0));
        let ap = st.ap, total = 0; const plan = [];
        for (const [id, sz] of opts) if (ap >= CARDS[id].cost) { ap -= CARDS[id].cost; total += sz * ss; plan.push(id); }
        const lastPush = this.flags.aiPush != null ? this.flags.aiPush : -99;
        if (plan.length && this.round - lastPush >= (A.pushGap || 5) && tip !== Infinity && tip * 0.9 < total + x) {
          for (const id of plan) this._oppPlay(id);
          this.flags.aiPush = this.round;
          return;
        }
      }
      // 2) 对镇压的回应
      if (this.flags.lastCrackdown != null && this.round - this.flags.lastCrackdown <= 3) {
        if (this.pol.info === 'blackout' && has('leak') && this._oppPlay('leak')) return;
        if (has('memorial') && this._oppPlay('memorial')) return;
      }
      if (this.pol.info === 'blackout' && has('samizdat') && rng() < 0.3 && this._oppPlay('samizdat')) return;
      if (this.pol.info !== 'open' && has('leak') && this.sim.latent && rng() < 0.12 && this._oppPlay('leak')) return;
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
      return false;
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

  const api = { Game, POLICIES, POLICY_KEYS, CARDS, DIFFS, fmtCount, band };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.SilenceGame = api;
})(typeof window !== 'undefined' ? window : globalThis);
