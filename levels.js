/* ============================================================
 * 道路以目 · 关卡
 * 每一关 = 一段历史(或一个教学场景) + 一组世界参数 + 事件时间线。
 * 世界参数只在复盘和"模型实验室"里公开;对局中玩家只看到政策与传闻。
 * 史实部分力求准确;数值是为了玩法而设的示意,不是历史估计。
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 日期工具 ---------- */
  const CN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  function cnNum(n) {
    if (n < 10) return CN[n];
    if (n < 20) return '十' + (n % 10 ? CN[n % 10] : '');
    return CN[Math.floor(n / 10)] + '十' + (n % 10 ? CN[n % 10] : '');
  }
  const LUNAR_M = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
  const DAY = 864e5;
  const ymd = (t) => { const d = new Date(t); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCDay()]; };
  const dayFmt = (y, m, d, withYear) => { const t0 = Date.UTC(y, m - 1, d); return (r) => { const [Y, M, D] = ymd(t0 + r * DAY); return (withYear === false ? '' : Y + '年') + M + '月' + D + '日'; }; };
  const weekFmt = (y, m, d) => { const t0 = Date.UTC(y, m - 1, d); return (r) => { const [Y, M, D] = ymd(t0 + r * 7 * DAY); return `${Y}年${M}月${D}日`; }; };
  const halfDayFmt = (y, m, d) => { const t0 = Date.UTC(y, m - 1, d); return (r) => { const [, M, D] = ymd(t0 + Math.floor(r / 2) * DAY); return M + '月' + D + '日 · ' + (r % 2 ? '夜' : '昼'); }; };
  const monthFmt = (y, m) => (r) => { const mm = m - 1 + r; return `${y + Math.floor(mm / 12)}年${(mm % 12) + 1}月`; };
  const weekday = (y, m, d) => { const t0 = Date.UTC(y, m - 1, d); return (r) => ymd(t0 + r * DAY)[3]; };

  const STD_POL = { enforce: 'normal', police: 'normal', target: 'uniform', info: 'open', release: 'normal' };

  const LEVELS = [];

  /* ============================================================
   * 序章 · 教程
   * ============================================================ */
  LEVELS.push({
    id: 'tutorial', chapter: '序章', title: '操场上的二十一个人', era: '教程', place: '某中学 · 升旗仪式', icon: '🏫',
    side: 'movement', role: '初二(3)班的一名学生',
    blurb: '一千名学生站在操场上听训话。站出来的人够不够多,决定了一切。',
    intro: [
      '周一早上的升旗仪式。大热天,一千名学生按班级站在操场上,听台上的校领导训话。',
      '校领导宣布:从下周起取消周末,全部补课。台下一片沉默。',
      '你心想:假如只有我站出来提异议,大概会被单独处理;假如所有人同时站出来,事情就不一样了。',
      '这个念头,就是整个游戏的核心——<b>每个人都根据别人的行动决定自己是否行动,而自己的行动又会改变别人的决定。</b>',
    ],
    goalText: '让全校一半以上的学生站出来提异议,并坚持两分钟。',
    tips: ['想让召公一步步带你玩?点「💡 带引导开始」;对局中也可以随时点上方的「💡 引导」。'],
    rounds: 30, scale: 1, moodScale: 1, tipSpread: 0.1, tipNoise: 0, econ: 1, randomEvents: false,
    tree: { only: ['m_net'], costMul: 0.22 },
    layout: 'assembly',
    world: { N: 1000, tolType: 'uniform', netType: 'full', P: 1, Pbar: 9, K0: 20, M: 16, alpha: 0, beta: 0, delta: 0, gamma: 0, memDecay: 0.2, vis: 1, omega: 1, globalScale: 1, noise: 0, hardCore: 0, seed: 7, psiScale: 1 },
    relMul: 0, noAI: true,
    policies: { start: STD_POL },
    labels: { army: '老师们', crowd: '站出来的学生', plaza: '主席台前', prison: '教导处', barracks: '主席台', avenue: '' },
    cards: ['t_small', 't_big'], startAP: 1, apCap: 3, income: 1,
    goal: { x: 0.5, hold: 2 },
    dateFmt: (r) => `升旗仪式 · 上午 8:${String(r).padStart(2, '0')}`,
    events: [
      { at: 0, headline: '升旗仪式。太阳很毒,没有一丝风。' },
      { at: 1, headline: '校领导:"从下周起,取消周末,全部补课。"' },
      { at: 2, headline: '队伍里有人小声骂了一句,马上又不作声了。' },
      { at: 3, headline: '教导主任在队伍之间来回走,盯着每一张脸。' },
      { at: 5, headline: '"有意见的,可以站出来说。"台上的人冷冷地说。' },
      { at: 7, headline: '后排有人在交换眼色。' },
      { at: 10, headline: '汗顺着脖子往下流。训话还在继续。' },
      { at: 15, headline: '有人开始偷偷看表。' },
      { at: 22, headline: '训话快结束了。' },
    ],
    endings: {
      crowd: { title: '二十一个人', text: '二十个人站出来,会被一个个点名带走,操场重归安静;二十一个人站出来,三分钟之后就是九百多人。<br>同样的沉默,不同的分界。' },
      timeout: { title: '散会了', text: '没有人再站出来。补课照常进行。' },
    },
    history: '这个例子来自《道路以目——沉默相变模型》第15—16页:千人,承受上限均匀分布,处罚强度 1,处罚能力 2%。从 20 人出发,第一轮就归零;从 21 人出发,依次约为 48、580、966 人,最终趋近 980 人。',
    lesson: { title: '性质八 · 临界种子', text: '临界种子是一道"山脊",不是某个固定的"勇敢者百分比"。低于它,小行动被吸回沉默(性质六);越过它,每个人面对的风险被越来越多的人摊薄,连锁开始。反复看见小行动失败,不能证明更大的行动也会失败。' },
  });

  /* ============================================================
   * 第一章 · 厉王弭谤 (朝廷)
   * ============================================================ */
  LEVELS.push({
    id: 'liwang', chapter: '第一章', title: '厉王弭谤', era: '西周 · 约公元前844年', place: '镐京', icon: '🏯',
    side: 'regime', role: '周厉王',
    blurb: '你可以让所有人闭嘴。问题是,闭嘴之后呢?',
    intro: [
      '你是周厉王。你重用荣夷公,把山林川泽之利收归王室——史称"专利"。都城里的国人怨声四起,街头巷尾都在议论你。',
      '召公进言:"民不堪命矣!"',
      '你手里有卫士、有刑罚,还能找来卫国的巫师替你监听。你可以让他们闭嘴——问题是,<b>闭嘴之后呢?</b>',
    ],
    quote: '防民之口,甚于防川。川壅而溃,伤人必多,民亦如之。——《国语·周语上》',
    goalText: '坐稳王位三年(36 个月),别让国人暴动,也别让卫士倒戈。',
    tips: ['左边的读数都是情报。执法越凶,下面的人越不敢说真话——情报就越不准。', '"民间情绪"看起来平静,不代表真的平静。'],
    rounds: 36, scale: 50, arrestScale: 10, moodScale: 0.18,
    world: { N: 1200, tolType: 'bell', tolMul: 0.4, netType: 'random', netDeg: 6, P: 1.0, Pbar: 0.85, K0: 50, M: 60, alpha: 0.2, beta: 0.45, delta: 0.45, gamma: 4, memDecay: 0.025, vis: 1.0, omega: 0.8, globalScale: 1, noise: 0.01, hardCore: 0.002, seed: 842, psiScale: 1.2 },
    policies: { start: STD_POL, allow: { police: ['lean', 'normal', 'surge'] } },
    labels: { army: '卫士', crowd: '国人', plaza: '王城市集', prison: '囹圄', barracks: '王宫', avenue: '周道' },
    policyNames: {
      info: { name: '言路', options: { open: '任人议论', spin: '粉饰太平', blackout: '道路以目' } },
      police: { name: '卫士', options: { lean: '裁撤', normal: '常备', surge: '增募' } },
      release: { name: '囹圄', options: { long: '长系', normal: '依律', lenient: '宽宥' } },
    },
    cardNames: {
      informants: { name: '卫巫监谤', text: '找来卫国的巫师,让他监视议论你的人。以告,则杀之。', tags: ['看见民间怨气', '先抓最敢说话的人', '情报准确(暂时)'] },
      editorial: { name: '明令禁谤', text: '颁下王命:妄议朝政者,罪之。' },
      dialogue: { name: '宣之使言', text: '"为川者决之使导,为民者宣之使言。"让公卿献诗、瞽献曲、庶人传语。' },
      subsidy: { name: '罢专利', text: '把山林川泽之利还给国人。王室的收入会少一些。', tags: ['积怨 ↓'] },
      bonus: { name: '厚赏卫士', text: '赏赐卫士,让他们记得是谁在养活他们。' },
      amnesty: { name: '大赦', text: '赦免系于囹圄的国人。' },
    },
    cards: ['informants', 'editorial', 'dialogue', 'subsidy', 'bonus', 'amnesty'],
    startAP: 2, income: 1.1,
    ai: { income: 0.8, every: 3, base: 0.012, smart: 0.8, aggression: 0.8, cards: ['rally', 'march', 'strike', 'memorial', 'leak'],
      chatter: ['国人在市集上议论"专利"。', '有人在城门口唱了一首讽刺王的歌。', '井边的妇人们在小声说话,看见卫士就散了。', '"荣夷公好专利而不知大难。"有人这样说。'] },
    goal: { x: 0.3, d: 0.55, hold: 3 },
    stars: [
      { text: '三年后民间积怨不超过"隐忍"', test: (g) => g.meanGrievance() / g.moodScale < 0.3 },
      { text: '被抓的国人少于一成', test: (g) => g.sim.R < 0.1 },
    ],
    dateFmt: (r) => `厉王${cnNum(34 + Math.floor(r / 12))}年${LUNAR_M[r % 12]}月`,
    events: [
      { at: 0, title: '国人谤王', art: '🗣️', text: '都城里的人都在议论你的"专利"。有人说你与民争利,有人说荣夷公迟早要坏事。<br><br>这是第一个月。你打算怎么办?(左边是你的政策,右边是你能做的事。)', choices: [{ label: '先看看再说' }] },
      { at: 2, title: '召公谏', art: '🧓', quote: '民不堪命矣!', text: '召公来见你,说国人已经受不了了。', choices: [
        { label: '听召公的:让人说话', hint: '立即「宣之使言」:积怨下降,民众认可的界线上移', run: (g) => g.selfCard('dialogue', '王召集公卿,听国人之言。') },
        { label: '找卫巫来,监视议论的人', hint: '获得一次免费的「卫巫监谤」,执法 → 严厉', run: (g) => { g.forcePolicy('enforce', 'harsh'); g.giveFree('informants', 3); } },
      ] },
      { at: 9, title: '防民之口', art: '🌊', quote: '防民之口,甚于防川。川壅而溃,伤人必多,民亦如之。', text: g => {
        const q = g.pol.enforce === 'terror' || g.pol.enforce === 'harsh' || g.pol.info === 'blackout';
        return q ? '你对召公说:"吾能弭谤矣,乃不敢言。"——我能消除非议了,他们都不敢说话了。<br><br>召公回答了上面那句话。' : '召公再次进谏,提醒你:堵住人民的嘴,比堵住河流还危险。';
      }, choices: [
        { label: '广开言路', hint: '言路 → 任人议论;获得一次免费的「宣之使言」', run: (g) => { g.forcePolicy('info', 'open'); g.giveFree('dialogue', 3); } },
        { label: '王不听', hint: '一切照旧' },
      ] },
      { at: 20, title: '芮良夫谏', art: '📜', quote: '王而学专利,其可乎?匹夫专利,犹谓之盗;王而行之,其归鲜矣。', text: '大夫芮良夫劝你罢免荣夷公、停止专利。', choices: [
        { label: '罢专利', hint: '积怨 ↓,王室收入 ↓', run: (g) => { g.griefScale(0.8); g.bonusIncome -= 0.15; } },
        { label: '卒以荣公为卿士', hint: '王室收入 ↑,积怨 ↑', run: (g) => { g.bonusIncome += 0.2; g.griefAll(0.03); } },
      ] },
      { at: 30, news: (g) => (g.pol.enforce === 'harsh' || g.pol.enforce === 'terror') ? '卫巫报告:国人莫敢言,道路以目。' : '市集上仍然有人议论,但声音不大。', kind: 'intel' },
    ],
    endings: {
      survive: { title: '三年', text: (g) => {
        const m = g.meanGrievance() / g.moodScale;
        if (m < 0.3) return '三年过去,国人仍在议论,却没有人想推翻你。<br>召公说:"是故为川者决之使导,为民者宣之使言。"你做到了。';
        return '三年过去了,道路上没有人说话。<br><br>你以为自己消除了非议。可复盘里那条看不见的曲线告诉你:<b>积怨从未消失,临界点一直在下降。</b>史书上,这正是"三年,乃流王于彘"的那一年。';
      } },
      crowd: { title: '流王于彘', text: '国人相与叛,袭王宫。你逃出镐京,一路逃到彘(今山西霍州),再也没有回来。<br><br>你看到的最后一份密报上写着:一切平静。' },
      army: { title: '卫士倒戈', text: '卫士们放下了兵器,站到了国人一边。没有人再执行你的命令。' },
    },
    history: '《国语·周语上》载:厉王虐,国人谤王。王怒,得卫巫,使监谤者,以告,则杀之。国人莫敢言,道路以目。王喜,告召公曰:"吾能弭谤矣,乃不敢言。"……三年,乃流王于彘。<br><br>公元前841年,国人暴动,厉王出奔。此后由大臣共同执政,史称"共和"。这一年——共和元年——是中国历史有确切纪年的开端。',
    lesson: { title: '性质一 · 性质二:沉默不发出预警,镇压会留下债务', text: '处罚一旦越过人们认可的界线,每一次都会在旁观者心里留下记忆。它不表现为公开参与,却在降低下一次行动所需的人数。厉王看到的是一条安静的行为记录,却把它当成了整个系统的性质。更危险的是:执法越凶,情报越不准——下面的人不敢说真话。' },
  });

  /* ============================================================
   * 第二章 · 彼得格勒 1917 (行动方)
   * ============================================================ */
  LEVELS.push({
    id: 'petrograd', chapter: '第二章', title: '面包与士兵', era: '1917年2月(俄历)', place: '彼得格勒', icon: '🥖',
    side: 'movement', role: '工厂里的地下组织者',
    blurb: '首都的秩序,取决于那些农民子弟兵还愿不愿意向排队买面包的人开枪。',
    intro: [
      '第一次世界大战进入第三个冬天。首都彼得格勒的面包店前排起长队,工资追不上物价。',
      '城里驻扎着十几万后备部队,大多是刚征召的农民子弟。他们的兄弟在前线,他们的姐妹在排队买面包。',
      '沙皇远在前线大本营。<b>首都的秩序,取决于这些士兵还愿不愿意向人群开枪。</b>',
    ],
    goalText: '在俄历3月1日前,让驻军倒戈(并维持两个半天),或让全城一半的人走上街头。',
    tips: ['士兵也在看街上有多少人。人越多,他们越动摇;他们越动摇,街上越安全。', '「劝说士兵」要趁人多的时候打。'],
    rounds: 32, scale: 600, arrestScale: 40, moodScale: 0.2,
    world: { N: 1500, tolType: 'bell', tolMul: 0.41, netType: 'full', P: 1.0, Pbar: 0.7, K0: 47, M: 160, alpha: 0.4, beta: 0.55, delta: 0.1, gamma: 2, memDecay: 0.08, vis: 1, omega: 1, globalScale: 0.9, noise: 0, hardCore: 0.003, seed: 1917, psiScale: 1.25 },
    policies: { start: Object.assign({}, STD_POL, { info: 'spin' }) },
    labels: { army: '驻军', crowd: '街头', plaza: '兹纳缅斯卡亚广场', prison: '克列斯特监狱', barracks: '兵营', avenue: '涅瓦大街' },
    slogans: ['面包!', '打倒战争!', '打倒专制!', '士兵兄弟们!'],
    cards: ['rally', 'march', 'strike', 'fraternize', 'samizdat', 'legal', 'memorial'],
    cardNames: { samizdat: { name: '传单', text: '夜里在工厂和兵营外面散发传单。' } },
    startAP: 2, income: 1.0,
    ai: { aggression: 0.7, income: 1.1, lag: 2, hold: 2, alertMul: 0.5, start: { enforce: 'normal', police: 'normal', info: 'spin' }, max: { police: 'surge', info: 'spin' }, cards: ['editorial', 'bonus', 'informants'] },
    goal: { x: 0.5, d: 0.6, hold: 3, dHold: 2 },
    stars: [
      { text: '在2月27日夜之前成功', test: (g) => g.round <= 27 },
      { text: '被捕者少于七千人', test: (g) => g.sim.R < 0.12 },
    ],
    dateFmt: (r) => `俄历2月${14 + Math.floor(r / 2)}日 · ${r % 2 ? '夜' : '昼'}`.replace('2月29日', '3月1日').replace('2月30日', '3月2日'),
    events: [
      { at: 0, title: '第三个冬天', art: '❄️', text: '杜马开幕了,议员们在演讲,面包店前的队伍越来越长。城里流传着要实行面包配给的消息。<br><br>你在维堡区的一家工厂里。人们在抱怨,但没有人敢第一个停下机器。', choices: [{ label: '开始' }] },
      { at: 8, title: '普梯洛夫工厂', art: '🏭', text: '全城最大的普梯洛夫工厂,工人们要求加薪。厂方拒绝了。', choices: [
        { label: '组织声援', hint: '获得一次免费的「小型集会」', run: (g) => g.giveFree('rally', 2) },
        { label: '再等等', hint: '保存力量' },
      ] },
      { at: 16, news: '普梯洛夫工厂闭厂。三万工人被赶到街上。', kind: 'event', run: (g) => g.addSeeds(0.012) },
      { at: 18, title: '国际妇女节', art: '👩‍🏭', text: '维堡区的纺织女工走出工厂,喊着"面包!"。她们跑到隔壁机械厂,敲着窗户喊男人们一起走。', choices: [
        { label: '全力加入', hint: '大量的人走上街头', run: (g) => g.addSeeds(0.05) },
        { label: '小规模跟随', hint: '少量的人', run: (g) => g.addSeeds(0.02) },
      ] },
      { at: 22, title: '沙皇的电报', art: '📨', quote: '命令你务必于明日制止首都的骚乱。——尼古拉二世致哈巴洛夫将军', text: '这些骚乱在沙皇眼中不过是"面包暴动"。他下令镇压。', choices: [{ label: '……' }], run: (g) => { g.forcePolicy('enforce', 'terror', 8, '沙皇命令'); g.forcePolicy('police', 'surge', 8); } },
      { at: 24, title: '开枪', art: '💥', text: '兹纳缅斯卡亚广场上,沃伦斯基团的教导队奉命向人群开枪。广场上倒下了几十个人。<br><br>当天夜里,兵营里没有人说话。', choices: [{ label: '继续' }], run: (g) => { g.forceOpp('crackdown', false); g.scalePsi(0.35, 0.75); } },
      { at: 26, if: (g) => g.d >= 0.2 && g.x >= 0.03, title: '沃伦斯基团', art: '🪖', text: '天亮前,沃伦斯基团的上士基尔皮奇尼科夫召集士兵:我们不再向人民开枪。下令的军官被打死。士兵们冲出兵营,去找隔壁的团。', choices: [{ label: '士兵兄弟们!', run: (g) => g.scalePsi(0.3, 0.3) }] },
      { at: 26, if: (g) => !(g.d >= 0.2 && g.x >= 0.03), news: '兵营里还在议论昨天的开枪。有人说,下次不开了。', kind: 'army', run: (g) => g.scalePsi(0.15, 0.7) },
    ],
    endings: {
      army: { title: '驻军倒戈', text: '一个团接一个团,士兵们带着枪走上街头,和工人站在一起。哈巴洛夫将军手里已经没有可以执行命令的部队。<br><br>三天后,沙皇退位。' },
      crowd: { title: '全城起义', text: '全城的人都在街上。警察躲了起来,监狱的大门被打开。' },
      timeout: { title: '秩序恢复', text: '驻军守住了。罢工在饥饿中一点点散去。<br>——但记忆还在。' },
    },
    history: '1917年俄历2月23日(公历3月8日)国际妇女节,维堡区纺织女工罢工,要求面包。到2月25日发展为全城总罢工。2月26日,军队在多处向人群开枪。2月27日,沃伦斯基团率先哗变,其他团队相继加入,监狱被打开,政府可用的力量迅速瓦解。3月2日(公历3月15日),尼古拉二世退位,罗曼诺夫王朝结束。',
    lesson: { title: '性质四 · 两层单独稳定,合在一起也可能失稳', text: '人群的规模动摇士兵,士兵的抗命又降低了人群面对的风险。只分别检查"群众是否稳定""军队是否稳定",会漏掉最关键的那条相互作用。兵变改变的不是新闻,而是此后每一轮人们面对的处罚能力。' },
  });

  /* ============================================================
   * 第三章 · 清明 1976 (行动方)
   * ============================================================ */
  LEVELS.push({
    id: 'qingming', chapter: '第三章', title: '清明', era: '1976年3月19日—4月5日', place: '北京 · 天安门广场', icon: '💮',
    side: 'movement', role: '北京一家工厂的青年工人',
    blurb: '一月里,悼念被压了下去。三个月后,清明节要到了。',
    intro: [
      '1976年1月8日,周恩来逝世。灵车经过长安街那天,十里长街站满了送行的人;此后的悼念活动却被层层限制,报纸上的消息少得可怜。',
      '年初,"反击右倾翻案风"运动愈演愈烈,矛头指向邓小平。三月下旬,上海《文汇报》的一篇文章被许多人读作影射总理。',
      '3月19日,北京一所小学的师生把一个花圈送到了人民英雄纪念碑下。<b>清明节就要到了。</b>一个人去送花圈,可能会被单位追查;如果全城的人都去呢?',
    ],
    goalText: '在4月5日夜之前,让三成北京人来到广场悼念,并坚持一天(两个半天)。',
    tips: ['一月里的悼念被压下去了,悲痛却没有消失——它藏在人们心里。清明节、曝光会让它浮出来。', '清明节是所有人都知道的日子:不用串联,大家也知道哪一天该去。', '单位会追查去过广场的人。人越多,越查不过来。'],
    rounds: 36, scale: 4000, arrestScale: 20, moodScale: 0.2, tipSpread: 0.3,
    randomEvents: ['mole', 'split', 'release', 'letter'],
    world: { N: 2000, tolType: 'bell', tolMul: 0.42, netType: 'clusters', netGroups: 40, P: 1.0, Pbar: 0.75, K0: 40, M: 150, alpha: 0.15, beta: 0.5, delta: 0.1, gamma: 1.5, memDecay: 0.05, vis: 0.7, omega: 0.6, globalScale: 0.5, noise: 0.01, hardCore: 0.002, seed: 1976, psiScale: 1.8, latentDecay: 0.005 },
    policies: { start: Object.assign({}, STD_POL, { info: 'blackout', enforce: 'harsh' }) },
    setup: (g) => { const s = g.sim; for (let i = 0; i < g.N; i++) s.latent[i] = 0.05 + s.rng() * 0.1; },   // 一月里被压住的悲痛
    labels: { army: '民兵', crowd: '广场上', plaza: '人民英雄纪念碑', prison: '公安局', barracks: '劳动人民文化宫', avenue: '长安街' },
    slogans: ['悼念总理', '还我花圈', '扬眉剑出鞘'],
    cards: ['memorial', 'samizdat', 'rally', 'march', 'network', 'lowkey', 'leak'],
    cardNames: {
      memorial: { name: '送花圈', text: '用白纸扎一个花圈,写上挽联,送到纪念碑下。' },
      samizdat: { name: '抄诗', text: '纪念碑四周贴满了诗。人们一句一句地抄在本子上,带回单位、带回家。' },
      rally: { name: '去纪念碑前', text: '下了班,去广场上站一站,看一看那些花圈和诗。' },
      march: { name: '全车间一起去', text: '工友们扛着花圈,排着队走到广场。' },
      network: { name: '厂里串联', text: '车间、班组、同学之间,约好一起去。' },
      lowkey: { name: '不留名', text: '挽联不写单位,诗不署名字。' },
      leak: { name: '列车上的标语', text: '南京的学生把标语刷在开往北京的列车上。车厢被冲洗,标语又被刷上。消息顺着铁路传开。', when: (g) => g.round >= 18, whenText: '要等南京的消息传来(3月28日前后)' },
    },
    startAP: 2, income: 1.0,
    ai: { aggression: 0.7, alertMul: 0.6, income: 1.2, lag: 2, start: { enforce: 'harsh', police: 'normal', info: 'blackout', target: 'uniform' }, max: { police: 'surge' }, cards: ['editorial', 'informants', 'bonus'] },
    oppSay: { editorial: '《人民日报》:要警惕"一小撮"借悼念之名兴风作浪。', informants: '单位里在追查:谁去过广场,谁抄过诗。', bonus: '首都民兵指挥部召开动员会。' },
    goal: { x: 0.3, hold: 2 },
    stars: [
      { text: '在清明节(4月4日)之前做到', test: (g) => g.round <= 31 },
      { text: '被抓的人少于两千', test: (g) => g.sim.R < 0.05 },
    ],
    dateFmt: halfDayFmt(1976, 3, 19),
    events: [
      { at: 0, title: '第一个花圈', art: '💮', text: '3月19日,一所小学的师生把一个花圈送到了人民英雄纪念碑下。<br><br>一月里,悼念总理的活动被层层限制。可人们没有忘。纪念碑就在那里——去不去,是每个人自己的事;去的人多不多,却是所有人的事。', choices: [{ label: '开始' }] },
      { at: 18, title: '南京', art: '🚂', text: '南京的学生和市民到雨花台悼念总理,又把"打倒张春桥"之类的标语刷在开往北京的列车上。车站派人冲洗,标语又被刷上。<br><br>列车进了北京站,车厢上的字迹还看得出来。', choices: [
        { label: '把消息传开', hint: '「列车上的标语」免费 · 当局警觉 +6', run: (g) => { g.giveFree('leak', 3); g.addAlert(6); } },
        { label: '先别声张', hint: '保存力量' },
      ] },
      { at: 28, news: '各单位传达上级通知:不许去天安门广场送花圈。', kind: 'opp', run: (g) => { g.forcePolicy('info', 'blackout', 6, '单位传达'); g.forceOpp('editorial', false); } },
      { at: 30, news: '纪念碑四周的花圈越堆越高,松墙上挂满了诗。', kind: 'crowd', run: (g) => g.giveFree('samizdat', 2) },
      { at: 32, title: '清明', art: '🌸', text: '4月4日,星期天,清明节。从早到晚,人流涌向广场。花圈一层一层堆上纪念碑的台阶,有人站在高处念诗:<br><br>"欲悲闻鬼叫,我哭豺狼笑。洒泪祭雄杰,扬眉剑出鞘。"', choices: [
        { label: '全家都去', hint: '很多人来到广场 · 被压住的悲痛浮出水面', run: (g) => { g.addSeeds(0.05); g.sim.reveal(0.4); } },
        { label: '自己去送一次花圈', hint: '少量的人 · 悲痛浮出一些', run: (g) => { g.addSeeds(0.02); g.sim.reveal(0.2); } },
      ] },
      { at: 33, title: '花圈不见了', art: '🚚', text: '4月4日深夜,中央政治局认定这是一起"反革命"事件。当夜,纪念碑前的花圈被卡车一车一车地拉走,诗被撕掉,守在那里的人被带走。', choices: [{ label: '……' }], run: (g) => { g.griefAll(0.04); g.sim.reveal(0.5); g.addAlert(30); g.forcePolicy('enforce', 'terror', 4, '"反革命事件"'); } },
      { at: 34, title: '还我花圈', art: '🔥', text: '4月5日,星期一。一早赶到广场的人发现花圈没了。"还我花圈!还我战友!"人群围住了广场东南角的小楼(联合指挥部),一辆广播车被掀翻,小楼起了火。', choices: [
        { label: '留在广场', hint: '带出很多人 · 今晚会清场', run: (g) => g.addSeeds(0.04) },
        { label: '天黑前回家', hint: '保护自己' },
      ] },
      { at: 35, title: '4月5日夜', art: '🌑', text: '傍晚六点半起,广场上的高音喇叭反复播放北京市委第一书记吴德的广播讲话,要人们离开。晚上九点多,广场上的灯突然全亮了——上万名民兵,和公安干警、卫戍部队一起,手持木棍冲进广场。', choices: [{ label: '……' }], run: (g) => { g.forcePolicy('police', 'martial', 9, '清场'); g.forceOpp('crackdown', false); } },
    ],
    endings: {
      crowd: { title: '人民的悼念', text: '清明前后,来到广场的人数以百万计。花圈、挽联和诗把纪念碑围了一层又一层。<br><br>4月5日夜,广场被清场;两天后,邓小平被撤销一切职务,这次悼念被定性为"反革命事件"。<br>可它没有被忘记。1978年11月,中共北京市委宣布:天安门事件"完全是革命行动"。那些诗后来被编成了《天安门诗抄》。' },
      timeout: { title: '花圈被收走了', text: '4月5日夜,广场被清场。来的人不够多,这次悼念没能成为全城的事。<br><br>——可在人们心里,记忆还在。两年后,这次事件被平反。' },
    },
    history: '1976年1月8日周恩来逝世,此后的悼念活动受到限制。3月下旬,《文汇报》的文章引发南京、北京等地民众不满;南京学生把标语刷上开往北京的列车。3月底起,人们陆续到天安门广场人民英雄纪念碑前献花圈、贴诗词,4月4日清明节达到高潮。当夜中央政治局将其定性为反革命事件,花圈被连夜清走。4月5日,民众与维持秩序的人员发生冲突,当晚民兵、公安干警和卫戍部队清场,许多人被打伤、被抓。4月7日,邓小平被撤销党内外一切职务。1978年11月,中共北京市委宣布天安门事件"完全是革命行动"。',
    lesson: { title: '性质六 · 小规模行动可能被吸回同一个低位状态', text: '一月里,悼念被一次次压回沉默:每一次小规模行动,最后都只剩下那批本来就愿意承担完整代价的人。可"反复看见小行动没有扩散",只说明它们没有跨过相关障碍,不能证明更大的行动也会失败。清明节是一个人人都知道的日子;被压住的悲痛也在那一天浮出水面——改变的正是"别人也会去"这一判断,和人们愿意承担的代价。' },
  });

  /* ============================================================
   * 第四章 · 伊朗 1978 (行动方)
   * ============================================================ */
  LEVELS.push({
    id: 'iran', chapter: '第四章', title: '四十日', era: '1978年1月—1979年2月', place: '库姆 · 大不里士 · 德黑兰', icon: '🕯️',
    side: 'movement', role: '反对派网络',
    blurb: '人死后第四十天要悼念。悼念会上若再有人死去,四十天后又是一次悼念。',
    intro: [
      '1978年1月,官方报纸刊文侮辱流亡中的宗教领袖。圣城库姆的神学院学生上街抗议,警察开枪。',
      '按什叶派习俗,人死后第四十天要举行悼念——"四十日"。库姆死难者的四十日,会在另一座城市举行。',
      '<b>悼念会上若再有人被打死,他们的四十日,又将在四十天后到来。</b>',
    ],
    goalText: '在1979年2月前,让军队宣布中立,或让全国一半的人走上街头。',
    tips: ['每次镇压,都会在大约六周后迎来一次"四十日"悼念高峰——提前做好准备。', '石油工人的罢工能掐断国王的钱袋。'],
    rounds: 57, scale: 3000, arrestScale: 60, moodScale: 0.25,
    world: { N: 2000, tolType: 'bimodal', tolMul: 0.45, netType: 'random', netDeg: 8, P: 1.0, Pbar: 0.7, K0: 50, M: 150, alpha: 0.25, beta: 0.5, delta: 0.2, gamma: 1.0, memDecay: 0.5, vis: 0.8, omega: 0.8, globalScale: 0.7, noise: 0.01, hardCore: 0.003, seed: 1978, psiScale: 1.7, kernel: 'memorial', memPeak: 6, memPeakAmp: 3 },
    policies: { start: Object.assign({}, STD_POL, { info: 'spin', target: 'organizer' }) },
    labels: { army: '军队', crowd: '街头', plaza: '贾勒广场', prison: '埃文监狱', barracks: '军营', avenue: '国王大道' },
    slogans: ['四十日!', '打倒国王!', '独立,自由!'],
    cards: ['rally', 'march', 'cassette', 'memorial', 'strike', 'fraternize', 'samizdat'],
    cardNames: { memorial: { name: '四十日悼念', text: '在清真寺里为死者举行第四十天的悼念。悼念结束,人们会走到街上。' } },
    startAP: 2, income: 0.9,
    ai: { aggression: 0.55, income: 1.2, lag: 3, start: { enforce: 'normal', police: 'normal', info: 'spin', target: 'organizer' }, cards: ['informants', 'crackdown', 'amnesty', 'dialogue', 'bonus', 'editorial'] },
    goal: { x: 0.5, d: 0.55, hold: 3, dHold: 2 },
    stars: [
      { text: '在1978年内成功', test: (g) => g.round <= 50 },
      { text: '被捕者少于一万八千人', test: (g) => g.sim.R < 0.15 },
    ],
    dateFmt: weekFmt(1978, 1, 9),
    events: [
      { at: 0, title: '库姆', art: '🕌', text: '库姆的神学院学生走上街头,抗议官方报纸对流亡宗教领袖的侮辱。警察开枪了。<br><br>死者的四十日,将在大约六周后到来。', choices: [{ label: '记住他们' }], run: (g) => { g.forceOpp('crackdown', false); g.addSeeds(0.02); } },
      { at: 6, news: '大不里士:库姆死难者的四十日悼念会演变为骚乱。', kind: 'event', run: (g) => g.giveFree('memorial', 2) },
      { at: 11, news: '亚兹德等城市:大不里士死难者的四十日。', kind: 'event' },
      { at: 32, title: '雷克斯电影院', art: '🔥', text: '阿巴丹的雷克斯电影院被人纵火,四百多人被困在里面烧死。<br><br>人们普遍认为是秘密警察萨瓦克所为。(多年后的审判认定,纵火者是伊斯兰激进分子。)', choices: [{ label: '继续' }], run: (g) => { g.griefAll(0.05); } },
      { at: 34, title: '黑色星期五', art: '🩸', text: '国王宣布戒严。德黑兰贾勒广场上,许多人还不知道戒严令,军队向人群开火。', choices: [{ label: '继续' }], run: (g) => { g.forcePolicy('police', 'martial', 12, '戒严令'); g.forceOpp('crackdown', false); } },
      { at: 40, title: '石油工人罢工', art: '🛢️', text: '南方油田的工人罢工,国家的财政命脉被掐断。', choices: [{ label: '支援罢工', hint: '获得免费的「总罢工」,当局收入长期下降', run: (g) => { g.giveFree('strike', 3); g.flags.oilStrike = true; } }] },
      { at: 48, title: '阿舒拉', art: '🟩', text: '伊斯兰历的塔苏阿与阿舒拉节。德黑兰街头,游行的人数以百万计。', choices: [{ label: '走上街头', run: (g) => g.addSeeds(0.08) }] },
      { at: 53, if: (g) => g.x > 0.1, news: '国王离开了伊朗,说是"出国度假"。', kind: 'event' },
    ],
    modParams: (m, g) => { if (g.flags.oilStrike && g.side === 'movement') g.opp.ap = Math.max(0, g.opp.ap - 0.02); },
    endings: {
      army: { title: '军队中立', text: '1979年2月11日,最高军事委员会宣布军队在政治冲突中保持中立。旧政权崩溃了。<br><br>——但点火成功,不等于结局美好。' },
      crowd: { title: '全国起来了', text: '街头是一片人海。国王的政府已经没有办法让任何一座城市安静下来。<br><br>——但点火成功,不等于结局美好。' },
      timeout: { title: '王座仍在', text: '国王撑了下来。悼念一次次举行,又一次次被驱散。' },
    },
    history: '1978年1月9日,库姆神学院学生抗议遭开枪镇压。2月18日,大不里士的四十日悼念演变为骚乱;此后亚兹德等地的悼念也以四十天为节奏接续。8月19日,阿巴丹雷克斯电影院大火。9月8日("黑色星期五"),戒严令下的德黑兰贾勒广场发生开枪事件。秋季石油工人罢工。12月的塔苏阿与阿舒拉节,德黑兰出现数百万人的游行。1979年1月16日国王出走,2月11日军队宣布中立。<br><br>革命后建立的伊斯兰共和国很快清洗了昔日盟友。1988年,数千名政治犯被秘密处决。2022年,玛莎·阿米尼在道德警察羁押后死亡,"女性,生命,自由"的口号再次响遍伊朗。',
    lesson: { title: '延迟记忆核 · 性质七的另一面', text: '简单的指数衰减解释不了为什么恰好隔四十天出现新的集会。一维的固定规则只会单调收敛,不会自己产生周期;周期性来自仪式、组织安排与时滞。记忆不只是平滑地消退——它有自己的日程表。' },
  });

  /* ============================================================
   * 第五章 · 波兰 1981 (朝廷)
   * ============================================================ */
  LEVELS.push({
    id: 'poland', chapter: '第五章', title: '戒严之夜', era: '1981年12月—1982年10月', place: '华沙 · 格但斯克 · 卡托维兹', icon: '❄️',
    side: 'regime', role: '救国军事委员会',
    blurb: '坦克开上街头,名单上的人一夜之间消失。你可以让国家安静下来——代价是什么?',
    intro: [
      '一千万人加入了团结工会,几乎占全国劳动人口的三分之一。莫斯科在施压,边境上有演习。',
      '1981年12月12日深夜,你下令实施戒严。广播、电视、电话被接管,<b>第一夜就有三千多人被拘押</b>,其中包括团结工会的重要人物。',
      '所有高压政策都已经打开了——但它们太贵了,你撑不了多久。什么时候放松、放松哪一样,由你决定。',
    ],
    goalText: '撑到1982年10月,不让大规模抗议或军队抗命失控。',
    tips: ['戒严、名单拘押、封锁新闻,每一项都要花钱。资源耗尽之前,你必须选择保留哪些。', '预防性拘押抓的是"最可能站出来的人"——它移除的是分布的顶端。'],
    rounds: 44, scale: 5000, arrestScale: 100, moodScale: 0.2,
    world: { N: 2000, tolType: 'uniform', tolMul: 0.25, netType: 'clusters', netGroups: 40, P: 1.0, Pbar: 0.8, K0: 50, M: 200, alpha: 0.2, beta: 0.4, delta: 0.08, gamma: 1.3, memDecay: 0.06, vis: 0.8, omega: 0.6, globalScale: 1, noise: 0.01, hardCore: 0.004, seed: 1981, psiScale: 1.5, netDamage: 0.5 },
    policies: { start: { enforce: 'harsh', police: 'martial', target: 'preventive', info: 'blackout', release: 'long' } },
    setup: (g) => g.flagTop(0.08),   // 团结工会的积极分子早已在案
    labels: { army: '军警', crowd: '街头', plaza: '胜利广场', prison: '拘留营', barracks: 'ZOMO 营地', avenue: '新世界街' },
    slogans: ['团结!', '冬天是你们的,春天是我们的!', '释放被拘押者!'],
    cards: ['informants', 'editorial', 'crackdown', 'amnesty', 'dialogue', 'subsidy', 'bonus', 'cutnet'],
    startAP: 4, income: 1.15,
    ai: { income: 1.0, every: 3, base: 0.012, smart: 0.65, aggression: 0.75, orgRate: 1.6, cards: ['rally', 'march', 'strike', 'samizdat', 'memorial', 'leak', 'legal'],
      chatter: ['地下刊物在工厂里传阅。', '有人在墙上刷了一个 V 字。', '教堂里的弥撒比平时人多。', '晚上七点半,有人关掉电视、上街散步——抵制官方新闻。'] },
    goal: { x: 0.3, d: 0.5, hold: 3, dHold: 2 },
    stars: [
      { text: '结束时民间积怨不超过"积怨"', test: (g) => g.meanGrievance() / g.moodScale < 0.55 },
      { text: '被拘押者少于一万人', test: (g) => g.sim.R < 0.05 },
    ],
    dateFmt: weekFmt(1981, 12, 13),
    events: [
      { at: 0, title: '12月13日', art: '📺', text: '清晨,电视上出现了一位穿军装的播音员。你本人在广播里宣布:国家处于战争状态。<br><br>街上是坦克和装甲车。名单上的人正在被一个个带走。', choices: [{ label: '开始' }] },
      { at: 1, title: '武耶克煤矿', art: '⛏️', text: '卡托维兹的武耶克煤矿,矿工占矿罢工,抗议戒严。', choices: [
        { label: '派防暴部队强攻', hint: '街头迅速清空,积怨 ↑↑', run: (g) => g.selfCard('crackdown', 'ZOMO 强攻武耶克煤矿。九名矿工遇难。') },
        { label: '包围,断水断电,等他们出来', hint: '对方士气 ↑', run: (g) => { g.opp.ap = Math.min(g.apCap, g.opp.ap + 2); } },
      ] },
      { at: 18, news: '地下团结工会成立了临时协调委员会。', kind: 'event', run: (g) => { g.L.ai.income = 1.25; } },
      { at: 20, title: '5月3日', art: '🇵🇱', text: '宪法纪念日。线人报告:各大城市可能有示威。', choices: [{ label: '知道了' }], run: (g) => g.addSeeds(0.02 + 0.03 * Math.min(1.5, g.meanGrievance() / g.moodScale)) },
      { at: 37, title: '8月31日', art: '⚓', text: '格但斯克协议签署两周年。团结工会地下领导号召全国示威。', choices: [{ label: '准备应对' }], run: (g) => g.addSeeds(0.025 + 0.045 * Math.min(1.5, g.meanGrievance() / g.moodScale)) },
      { at: 43, news: '议会通过新工会法,团结工会被正式取缔。', kind: 'event' },
    ],
    endings: {
      survive: { title: '冬天过去了', text: (g) => {
        const m = g.meanGrievance() / g.moodScale;
        return (m < 0.55 ? '你撑过来了,国家也没有被你压得太狠。' : '你撑过来了。街道安静,工厂复工。<br>可复盘告诉你:积怨从未消失,它只是转入了地下。') +
          '<br><br>戒严于1983年7月解除。1988年罢工潮再起;1989年圆桌会议后的半自由选举中,团结工会赢下了几乎所有开放竞争的席位。';
      } },
      crowd: { title: '春天来得太早', text: '示威压不下去了。工厂、港口、矿山同时停工。' },
      army: { title: '军警不再执行', text: '越来越多的军警拒绝对工人动手。戒严失去了意义。' },
    },
    history: '1981年12月13日,雅鲁泽尔斯基宣布戒严。第一夜拘押三千多人,此后数月被拘押者约一万人。12月16日,防暴部队(ZOMO)强攻武耶克煤矿,九名矿工遇难。团结工会转入地下,1982年5月与8月的示威均被驱散,10月团结工会被正式取缔。戒严于1983年7月解除。1989年圆桌会议后,团结工会在半自由选举中赢下了几乎所有开放竞争的席位。',
    lesson: { title: '性质九 · 抓谁,比抓多少更重要', text: '预防性拘押按名单抓走的是分布的顶端,切断的是网络中的关键联系——这不能全部塞进"处罚强度上升"一个变量。它确实能压住行动。但处罚越过了人们认可的界线,记忆就在累积;压住行动,不等于消除了下一次行动的条件。' },
  });

  /* ============================================================
   * 第六章 · 首尔 1987 六月抗争 (行动方)
   * 1—5月每轮一周, 6月每轮一天: 时间在六月慢了下来
   * ============================================================ */
  const seoulFmt = (r) => (r < 20 ? weekFmt(1987, 1, 14)(r) : dayFmt(1987, 6, 1)(r - 20));
  LEVELS.push({
    id: 'seoul', chapter: '第六章', title: '六月', era: '1987年1月14日—6月30日', place: '首尔 · 明洞 · 全国', icon: '👔',
    side: 'movement', role: '首尔一所大学的学生,后来是国民运动本部的组织者',
    blurb: '一个学生死在审讯室里。警方说:"啪地一拍桌子,他\'呃\'的一声就倒下了。"',
    intro: [
      '1987年1月14日,首尔大学学生朴钟哲在南营洞的警察对共分室里接受审讯时死亡。警方的说法是:"啪地一拍桌子,他\'呃\'的一声就倒下了。"',
      '全斗焕将军在1980年光州的血泊之后掌权。宪法规定总统由"选举人团"间接选出——明年,他将把权力交给自己指定的接班人。',
      '人们要的是一部让自己投票选总统的宪法。<b>一个人的死,会被压下去,还是会被记住?</b>',
    ],
    goalText: '在6月底之前,让全国三分之一以上的人走上街头,并坚持两天——逼当局接受总统直选。',
    tips: ['朴钟哲的死被掩盖着:悲愤藏在人们心里。「曝光真相」能让它浮出来——越晚曝光,当局越难收场;越早,越早被压下去。', '六月之前每轮是一周,六月每轮是一天。积蓄的力量,要留到六月。', '明洞圣堂是一个警察不敢进去的地方。中产阶级(「领带部队」)一加入,就不再只是学生的事。'],
    rounds: 50, scale: 5000, arrestScale: 25, moodScale: 0.2, tipSpread: 0.3,
    randomEvents: ['death', 'mole', 'press', 'writer', 'split', 'release'],
    world: { N: 2000, tolType: 'bell', tolMul: 0.34, netType: 'clusters', netGroups: 30, P: 1.0, Pbar: 0.7, K0: 55, M: 160, alpha: 0.2, beta: 0.5, delta: 0.15, gamma: 1.8, memDecay: 0.06, vis: 0.6, omega: 0.6, globalScale: 0.55, noise: 0.01, hardCore: 0.004, seed: 1987, psiScale: 1.6, latentDecay: 0.01 },
    policies: { start: Object.assign({}, STD_POL, { enforce: 'harsh', police: 'surge', info: 'spin', target: 'organizer' }) },
    labels: { army: '战警', crowd: '街头', plaza: '明洞圣堂', prison: '南营洞', barracks: '军营', avenue: '世宗大路' },
    slogans: ['打倒独裁!', '撤销护宪!', '还我钟哲!', '直选!'],
    cards: ['rally', 'march', 'memorial', 'leak', 'network', 'fraternize', 'sanctuary', 'necktie'],
    cardNames: {
      memorial: { name: '追悼会', text: '为朴钟哲举行追悼会。追悼会结束,人们会走到街上。' },
      leak: { name: '曝光真相', text: '把被掩盖的审讯细节送到神父、记者手里。封锁压住的不是记忆,只是记忆的公开。' },
      network: { name: '校园与教会串联', text: '学生会、教会、在野党,约好同一天、同一个时间。' },
      fraternize: { name: '向战警喊话', text: '"你们也是被征来的年轻人。"对着盾牌后面的脸说话。' },
    },
    startAP: 2, income: 1.0,
    ai: { aggression: 0.75, income: 1.2, lag: 2, start: { enforce: 'harsh', police: 'surge', info: 'spin', target: 'organizer' }, max: { police: 'surge', enforce: 'harsh' }, cards: ['editorial', 'informants', 'crackdown', 'bonus'] },
    oppSay: { editorial: '政府发言人:一小撮"左倾势力"企图颠覆国家。', informants: '便衣警察在校园里拍照,登记示威者的脸。', crackdown: '战警发射了成排的催泪弹。', bonus: '战警部队加发津贴。' },
    goal: { x: 0.35, hold: 2 },
    stars: [
      { text: '在6月20日之前做到', test: (g) => g.round <= 39 },
      { text: '被带走的人少于五千', test: (g) => g.sim.R < 0.05 },
    ],
    dateFmt: seoulFmt,
    setup: (g) => { g.flags.necktie = false; },
    events: [
      { at: 0, title: '南营洞', art: '🚿', text: '1月14日,首尔大学语言学系的学生朴钟哲被带到南营洞的治安本部对共分室,追问一位学长的下落。他没有说。<br><br>第二天,警方宣布他死于"休克":"啪地一拍桌子,他\'呃\'的一声就倒下了。"<br>给他做检查的医生看到的是另一回事。', choices: [{ label: '记住他' }], run: (g) => { const s = g.sim; for (let i = 0; i < g.N; i++) s.latent[i] += 0.06 + s.rng() * 0.06; g.griefAll(0.01); } },
      { at: 13, title: '四一三护宪措施', art: '📺', text: '4月13日,全斗焕发表特别谈话:修宪讨论到此为止,等明年汉城奥运会之后再说。明年的总统,仍将由选举人团选出。<br><br>这意味着:他指定的接班人,将在一个没有对手的选举里当选。', choices: [
        { label: '联署反对', hint: '教授、神父、作家接连发表声明 · 积怨上升', run: (g) => { g.griefAll(0.03); g.giveFree('network', 2); } },
        { label: '沉默', hint: '保存力量' },
      ] },
      { at: 18, title: '五一八', art: '⛪', text: '5月18日,光州事件七周年的弥撒上,天主教正义实现全国司祭团宣读了一份声明:朴钟哲之死,警方掩盖了真相——参与拷问的警察不止两个,上面知道,还安排了顶罪。', choices: [
        { label: '让全国都知道', hint: '被压住的悲愤浮出水面 · 人人看见', run: (g) => { g.sim.reveal(0.7); g.addEffect({ id: 'priests', name: '司祭团声明', icon: '⛪', side: 'movement', rounds: 3, mod(m) { m.vis = Math.max(m.vis, 1); m.gs = Math.min(1, m.gs + 0.3); } }); } },
      ] },
      { at: 28, title: '李韩烈', art: '🩸', text: '6月9日,延世大学门前。学生李韩烈被一枚平射的催泪弹击中后脑,倒在同学的怀里。那张照片第二天登上了报纸。<br><br>明天,执政党要提名卢泰愚为总统候选人。', choices: [
        { label: '明天上街', hint: '「大游行」免费 · 积怨上升', run: (g) => { g.griefAll(0.04); g.giveFree('march', 2); } },
      ] },
      { at: 29, title: '六一〇', art: '📣', text: '6月10日,执政党在体育馆里提名卢泰愚。同一时间,"声讨拷问杀人掩盖、撤销护宪"国民大会在全国二十多座城市举行。<br><br>傍晚,被驱散的示威者退进了明洞圣堂。', choices: [
        { label: '守住明洞', hint: '「明洞圣堂静坐」免费', run: (g) => { g.addSeeds(0.025); g.giveFree('sanctuary', 3); } },
      ] },
      { at: 31, news: '午休时间,市中心打着领带的上班族走出写字楼,为示威队伍鼓掌。', kind: 'crowd', run: (g) => { g.flags.necktie = true; g.giveFree('necktie', 2); } },
      { at: 38, title: '6月19日', art: '🪖', text: '据后来披露,全斗焕在这一天上午下令:军队准备进驻首尔等城市。<br><br>同一天,美国大使李洁明递交了里根总统的亲笔信。明年就是汉城奥运会,全世界都在看。', choices: [{ label: '……' }], run: (g) => {
        if (g.x >= 0.06 || g.d >= 0.15) { g.log('傍晚,出兵的命令被收回了。', 'army'); g.L.ai.aggression = 0.5; g.scalePsi(0.3, 0.8); }
        else { g.log('军队开进了城市。', 'opp'); g.flags.martialLaw = true; g.L.ai.max = {}; g.forcePolicy('police', 'martial', 99, '出兵'); g.forcePolicy('enforce', 'terror', 99, '出兵'); g.forceOpp('crackdown', false); }
      } },
      { at: 45, news: '6月26日,"国民平和大行进":全国三十多座城市,上百万人上街。', kind: 'crowd', run: (g) => g.addSeeds(0.035) },
    ],
    endings: {
      crowd: { title: '六二九宣言', text: '6月29日,执政党总统候选人卢泰愚发表"六二九宣言":接受总统直选,赦免金大中,恢复政治犯的公民权,保障新闻自由……<br><br>7月9日,李韩烈的葬礼上,上百万人送他。12月,韩国举行了十六年来第一次总统直选。' },
      timeout: { title: '护宪', text: '街头的人不够多,也不够久。"护宪措施"维持了下去,明年的总统仍由选举人团选出。<br><br><b>这不是历史。</b>历史上,六月的街头最终逼得当局让步。' },
    },
    history: '1987年1月14日,首尔大学学生朴钟哲在南营洞治安本部对共分室受水刑致死,警方起初声称"一拍桌子他就倒下了",随后承认拷问,但只承认两名警察涉案。4月13日,全斗焕发表"护宪措施",拒绝修宪。5月18日,天主教正义实现全国司祭团揭露警方掩盖真相。5月27日,民主宪法争取国民运动本部成立。6月9日,延世大学学生李韩烈被催泪弹击中头部(7月5日去世)。6月10日起,全国各地爆发大规模示威,明洞圣堂静坐持续数日,上班族也加入了街头。据后来披露,6月19日全斗焕曾下令军队准备出动,随后收回。6月26日"国民平和大行进"遍及全国。6月29日,卢泰愚发表"六二九宣言",接受总统直选。',
    lesson: { title: '性质三 · 一次处罚会不会带来更多参与者,可以写成明确的局部条件', text: '"越压越反"并不总成立。反作用需要两个条件同时满足:事件足以改变人们的参与意愿,而且恰好有足够多的人位于当前门槛附近。一月里,朴钟哲的死没有立刻带来大游行;经过四一三、五一八,门槛附近的人越来越多——六月的一枚催泪弹,才带来了成倍的人。' },
  });

  /* ============================================================
   * 第七章 · 北京 1989 (行动方)
   * ============================================================ */
  LEVELS.push({
    id: 'beijing', chapter: '第七章', title: '春夏之交', era: '1989年4月15日—6月4日', place: '北京', icon: '🎓',
    side: 'movement', role: '高校学生自治联合会',
    blurb: '百万人上街,政权并没有倒下。决定结局的,是那些开进城的士兵。',
    intro: [
      '1989年4月15日,前中共中央总书记胡耀邦去世。北京的大学生自发来到天安门广场悼念。',
      '悼念很快变成了请愿:反对腐败,要求新闻自由,要求与政府平等对话。',
      '接下来的五十天里,会有社论、绝食、戒严令。<b>这一关里,人再多也不够——真正的问题是:军队会不会向人群开枪?</b>',
    ],
    goalText: '在6月4日前,让戒严部队倒戈(军心"成建制倒戈"并维持两天)。',
    tips: ['街上的人数会影响士兵,但光靠人多压不垮军队。', '戒严后,「拦阻军车」和「劝说士兵」是你最重要的牌。', '当局可能调来与本地毫无联系的部队——他们不会和人群说话。'],
    rounds: 50, scale: 1000, arrestScale: 8, moodScale: 0.2, tipSpread: 0.35,
    world: { N: 2000, tolType: 'bell', tolMul: 0.9, tolAdd: -0.45, netType: 'clusters', netGroups: 30, P: 1.0, Pbar: 0.9, K0: 30, M: 200, alpha: 0.25, beta: 0.5, delta: 0.2, gamma: 1.8, memDecay: 0.1, vis: 0.9, omega: 0.7, globalScale: 0.8, noise: 0.01, hardCore: 0.004, seed: 1989, psiScale: 1.9 },
    policies: { start: Object.assign({}, STD_POL, { info: 'spin', enforce: 'lenient', police: 'lean' }) },
    troopPsi: 2.32,
    labels: { army: '军警', crowd: '广场上', plaza: '天安门广场', prison: '收容审查', barracks: '城郊营地', avenue: '长安街' },
    slogans: ['反腐败!', '新闻自由!', '对话!', '人民军队爱人民!', '民主万岁!'],
    cards: ['rally', 'march', 'mobilize', 'hunger', 'fraternize', 'blockade', 'goddess', 'memorial', 'samizdat', 'legal'],
    startAP: 2, income: 1.0,
    ai: { aggression: 0.3, alertMul: 0.35, income: 1.2, lag: 2, start: { enforce: 'lenient', police: 'lean', info: 'spin' }, max: { police: 'normal', enforce: 'normal' }, cards: ['editorial', 'informants', 'bonus', 'rotate'] },
    goal: { d: 0.5, hold: 2, dHold: 2 },
    stars: [
      { text: '在戒严后十天内成功(5月30日前)', test: (g) => g.round <= 45 },
      { text: '被抓走的人少于一千六', test: (g) => g.sim.R < 0.1 },
    ],
    dateFmt: dayFmt(1989, 4, 15),
    events: [
      { at: 0, title: '4月15日', art: '💐', text: '胡耀邦去世的消息传开。当晚,北大、清华的校园里贴出了悼念的大字报。花圈开始出现在人民英雄纪念碑下。', choices: [
        { label: '去广场悼念', hint: '获得免费的「悼念活动」', run: (g) => { g.giveFree('memorial', 2); g.griefAll(0.01, 0.4); } },
      ] },
      { at: 7, title: '4月22日 · 追悼会', art: '🙇', text: '追悼会在人民大会堂举行。三名学生跪在大会堂东门的台阶上,举着请愿书,要求见总理。<br><br>没有人出来接。', choices: [{ label: '……', run: (g) => g.griefAll(0.03, 0.3) }] },
      { at: 11, title: '四二六社论', art: '🗞️', quote: '必须旗帜鲜明地反对动乱', text: '《人民日报》发表社论,把学生运动定性为"一场有计划的阴谋,是一次动乱"。<br><br>许多学生觉得被冤枉了。', choices: [
        { label: '上街抗议定性(明日大游行)', hint: '免费的大游行;风险高', run: (g) => { g.giveFree('march', 2); } },
        { label: '暂时观望', hint: '保存力量' },
      ], run: (g) => g.forceOpp('editorial') },
      { at: 12, news: '四二七大游行:学生冲破一道道警察人墙,沿途市民鼓掌、送水。', kind: 'event', if: (g) => g.x > 0.02 },
      { at: 19, news: '五四运动七十周年。', kind: 'event', run: (g) => g.giveFree('rally', 1) },
      { at: 28, title: '5月13日 · 绝食', art: '🥣', text: '几百名学生在广场上宣布绝食,要求政府与学生平等对话、为运动正名。', choices: [
        { label: '加入绝食', hint: '免费的「绝食请愿」:全城同情', run: (g) => g.giveFree('hunger', 2) },
        { label: '不绝食', hint: '' },
      ] },
      { at: 30, title: '戈尔巴乔夫访华', art: '🎥', text: '苏联领导人戈尔巴乔夫来访,这是三十年来的第一次中苏高级会晤。上千名外国记者来到北京——他们把镜头对准了广场。<br><br>这几天,当局不愿在全世界面前动手。', choices: [{ label: '全世界在看' }], run: (g) => {
        g.forcePolicy('info', 'open', 4, '外国记者在场'); g.forcePolicy('enforce', 'normal', 4, '中苏高级会晤');
        g.addEffect({ id: 'press', name: '外国记者', icon: '🎥', side: 'movement', rounds: 4, mod(m) { m.vis = Math.max(m.vis, 1); m.gs = 1; } });
      } },
      { at: 33, news: '据说,第38集团军军长徐勤先拒绝在没有书面命令的情况下带兵进京。', kind: 'army', run: (g) => g.scalePsi(0.1, 0.6) },
      { at: 34, title: '5月19日 · 凌晨', art: '🌃', quote: '我们来得太晚了。', text: '中共中央总书记赵紫阳来到广场,看望绝食学生。他拿着喇叭,眼里有泪。<br><br>这是他最后一次公开露面。', choices: [{ label: '……' }], run: (g) => { g.flags.aggrMul = 3.5; } },
      { at: 35, title: '5月20日 · 戒严', art: '🪖', text: '国务院总理李鹏宣布:北京部分地区实行戒严。几十万军队从四面八方向城区开进。<br><br>——但他们被堵在了路上。老人、工人、学生涌上路口,围住军车,给士兵送水送饭。', choices: [{ label: '拦住他们', hint: '「拦阻军车」本回合免费', run: (g) => g.giveFree('blockade', 2) }], run: (g) => {
        // 部队被堵在城外: 能抓的人并没有马上变多; 外国记者也还在
        g.flags.martialLaw = true; g.alert = Math.max(g.alert, 80); g.L.ai.alertMul = 1;
        g.forcePolicy('police', 'surge', 99, '戒严令(部队受阻)'); g.forcePolicy('enforce', 'harsh', 99, '戒严令'); g.forcePolicy('info', 'spin', 99, '戒严令');
        g.L.ai.max = {};
        // 执行者从警察换成了开进城的部队
        const s = g.sim; g.base.psiScale = g.L.troopPsi || 1.1;
        for (let j = 0; j < s.psi.length; j++) s.psi[j] = s.rng() * g.base.psiScale;
        s.z.fill(0);
      } },
      { at: 39, news: '部分戒严部队撤回了城郊。', kind: 'army', if: (g) => g.d > 0.1 },
      { at: 40, news: '当局从其他军区调来新的部队。', kind: 'opp', run: (g) => g.forceOpp('rotate', false) },
      { at: 45, news: '美院学生在广场上立起了一座"民主女神像"。', kind: 'event', run: (g) => g.giveFree('goddess', 3) },
      { at: 49, title: '6月3日', art: '🌑', text: '晚上,电视和广播反复播放紧急通告:市民不要上街,不要去天安门广场。<br><br>部队接到命令:6月4日清晨6时前,完成清场。', choices: [{ label: '……' }], run: (g) => { if (g.d < 0.4) { g.forcePolicy('police', 'martial', 99, '清场'); g.forceOpp('crackdown', false); } } },
    ],
    check: (g) => {
      if (g.round === 50) {
        if (g.d >= 0.4) return { win: true, key: 'refuse' };
        return { win: false, key: 'crackdown' };
      }
      return null;
    },
    endings: {
      army: { title: '另一种六月', text: '一个团接一个团,开进城的部队停了下来。军官们说:没有书面命令,我们不向老百姓开枪。<br><br><b>这不是历史。</b>历史上,这一幕没有发生。' },
      refuse: { title: '另一种六月', text: '6月3日夜,开往广场的部队在长安街上停了下来。一个师长说:我不会向老百姓开枪。更多的车停了下来……<br><br><b>这不是历史。</b>历史上,这一幕没有发生。' },
      crackdown: { title: '六月四日', text: '6月3日夜,戒严部队向天安门广场推进。在木樨地、在长安街沿线,军队向阻拦的人群开枪。6月4日凌晨,留在广场上的学生经过谈判后撤离。<br><br>死亡人数至今没有定论。官方公布的数字约两三百人(含军人),各方估计从数百到数千不等。"天安门母亲"群体多年来逐一寻访,已经记录了两百多位遇难者的姓名与经过。' },
    },
    history: '1989年4月15日胡耀邦去世,学生到天安门广场悼念。4月26日《人民日报》社论把运动定性为"动乱",次日数十万学生与市民上街。5月13日学生开始绝食;5月15日至18日戈尔巴乔夫访华,北京每天有上百万人上街。5月19日凌晨赵紫阳到广场看望学生,此后失去职务,在软禁中度过余生。5月20日宣布戒严,进城部队被市民拦阻数日。6月3日夜至4日凌晨,军队开枪清场。<br><br>第38集团军军长徐勤先因拒绝在没有书面命令的情况下带兵,被判处五年徒刑。<br><br>此后,"六四"在中国大陆成为禁区。每年这一天,"五月三十五日"、蜡烛表情都会被删除。香港维多利亚公园的烛光悼念持续了三十年,2020年起被禁止。<br><br>四个月后,东德领导层公开称赞了北京的做法。莱比锡的人们,都知道这件事。',
    lesson: { title: '性质四 · 执行者也有门槛', text: '处罚能力不是常数——它取决于执行者还愿不愿意执行。士兵同样在观察人群和同僚:同僚影响足够强时,执行者的变化会呈现集体切换。当局调来与本地毫无联系的部队,切断的正是人群对士兵的影响(α)。百万人的街头之所以没有改变结局,是因为这一层没有翻转。' },
  });

  /* ============================================================
   * 第八章 · 莱比锡 1989 (行动方)
   * ============================================================ */
  LEVELS.push({
    id: 'leipzig', chapter: '第八章', title: '我们是人民', era: '1989年9月4日—10月16日', place: '莱比锡', icon: '⛪',
    side: 'movement', role: '尼古拉教堂的和平祈祷会',
    blurb: '每周一,教堂的门开着。四个月前北京发生的事,每个人都知道。',
    intro: [
      '从1982年起,莱比锡尼古拉教堂每周一都有和平祈祷。1989年9月4日,祈祷结束后,有人在教堂外举起标语:"为了一个人民自由的开放国家"。',
      '这个夏天,成千上万东德人经匈牙利逃往西方。留下的人开始喊:<b>"我们要留下来!"</b>',
      '当局有斯塔西(国家安全部)、有警察、有战斗队。他们还公开称赞了北京在六月的做法。',
    ],
    goalText: '在10月16日前,让周一游行达到全城的四成(约12万人),并坚持两天。',
    tips: ['周一的「和平祈祷」是免费的。', '当局把新闻压得越狠,一次「曝光真相」就越有力。', '教会、学校、工厂之间的联系(「串联织网」)会让人更容易互相带动。'],
    rounds: 42, scale: 150, arrestScale: 5, moodScale: 0.2, randomEvents: ['death', 'mole', 'press', 'writer', 'letter', 'release', 'split'],
    world: { N: 2000, tolType: 'uniform', tolMul: 0.37, tolAdd: -0.15, netType: 'clusters', netGroups: 30, P: 1.0, Pbar: 0.75, K0: 50, M: 150, alpha: 0.25, beta: 0.5, delta: 0.2, gamma: 1.5, memDecay: 0.15, vis: 0.8, omega: 0.6, globalScale: 0.75, noise: 0.01, hardCore: 0.004, seed: 1989, psiScale: 1.9 },
    policies: { start: Object.assign({}, STD_POL, { info: 'spin', target: 'organizer' }) },
    labels: { army: '警察与战斗队', crowd: '环城大道上', plaza: '卡尔·马克思广场', prison: '斯塔西看守所', barracks: '人民警察营地', avenue: '环城大道' },
    slogans: ['我们是人民!', '不要暴力!', '我们要留下来!', '新闻自由!'],
    cards: ['prayer', 'rally', 'march', 'mobilize', 'network', 'samizdat', 'leak', 'legal'],
    cardNames: { samizdat: { name: '西德电视', text: '除了"无知之谷"德累斯顿,全东德都能收到西德电视。' } },
    startAP: 2, income: 1.0,
    isMonday: (r) => weekday(1989, 9, 4)(r) === 1,
    ai: { aggression: 0.5, income: 1.2, lag: 2, hold: 3, start: { enforce: 'normal', police: 'normal', info: 'spin', target: 'organizer' }, max: { police: 'normal', enforce: 'harsh', info: 'spin' }, cards: ['informants', 'editorial', 'bonus'] },
    goal: { x: 0.4, hold: 2 },
    stars: [
      { text: '在10月9日之前成功', test: (g) => g.round <= 35 },
      { text: '被斯塔西带走的人少于一千', test: (g) => g.sim.R < 0.1 },
    ],
    dateFmt: (r) => dayFmt(1989, 9, 4)(r) + (weekday(1989, 9, 4)(r) === 1 ? ' · 周一' : ''),
    events: [
      { at: 0, title: '9月4日 · 周一', art: '⛪', text: '和平祈祷结束了。几个年轻人在教堂门口展开标语。斯塔西的便衣冲上去抢走了标语——西德的电视台正好拍到了这一幕。', choices: [{ label: '开始' }] },
      { at: 7, news: '匈牙利开放了与奥地利的边境。成千上万东德人从那里出走。', kind: 'event', run: (g) => g.griefAll(0.015) },
      { at: 26, news: '布拉格西德使馆里的数千名东德难民获准乘火车前往西德。', kind: 'event', run: (g) => g.griefAll(0.015) },
      { at: 33, title: '10月7日 · 建国四十周年', art: '🎆', text: '东柏林在阅兵。据说,戈尔巴乔夫对昂纳克说:"谁来得太晚,生活就会惩罚谁。"<br><br>当晚,各地的警察殴打、拘押了上街的人。', choices: [{ label: '继续' }], run: (g) => { g.forcePolicy('enforce', 'harsh', 2, '建国纪念日'); g.forcePolicy('police', 'surge', 2); g.forceOpp('editorial'); } },
      { at: 35, title: '10月9日 · 周一', art: '🩸', text: '传言四起:医院备好了血浆和病床;报纸上刊出一位战斗队指挥官的文章,说要"用手中的武器"保卫社会主义。<br><br>每个人都想起了四个月前的北京。', choices: [
        { label: '还是去', hint: '大量的人走上环城大道——如果人不够多,当局可能动手', run: (g) => g.addSeeds(0.07) },
        { label: '今天留在家里', hint: '安全,但会错过时机' },
      ] },
      { at: 36, if: (g) => g.x >= 0.1, title: '他们没有开枪', art: '🕊️', text: '七万人走上了环城大道。指挥官们打电话请示,没有人敢下令。当局广播了一份呼吁"不要暴力"的声明——由指挥家库尔特·马苏尔等六人联名。<br><br>当天,两个年轻人从改革宗教堂的塔楼上偷拍了游行。录像被送到西柏林,在西德电视台播出。', choices: [{ label: '全世界都看见了', hint: '「曝光真相」免费', run: (g) => g.giveFree('leak', 3) }], run: (g) => { g.forcePolicy('enforce', 'lenient', 99, '不再动手'); g.forcePolicy('target', 'uniform', 99); g.L.ai.cards = []; } },
      { at: 36, if: (g) => g.x < 0.1, title: '人太少了', art: '🚨', text: '人不够多。警察和战斗队冲进了人群。', choices: [{ label: '……' }], run: (g) => g.forceOpp('crackdown', false) },
    ],
    endings: {
      crowd: { title: '我们是人民', text: '十几万人在环城大道上游行,手里拿着蜡烛。没有人开枪。<br><br>两天后,昂纳克下台。三周后,柏林墙倒塌。' },
      timeout: { title: '周一还会再来', text: '人没有多到让当局放弃。但下一个周一,教堂的门还会开着。' },
    },
    history: '莱比锡周一游行:9月下旬数千人,10月2日约两万人,10月9日约七万人,10月16日约十二万人。10月9日的游行被西格伯特·舍夫克和阿拉姆·拉多姆斯基从教堂塔楼上秘密拍摄,次日在西德电视台播出。10月18日昂纳克下台,11月9日柏林墙倒塌。<br><br>这一年六月,东德人民议院通过声明支持北京的镇压。10月9日,当局准备了"中国式解决"——最终没有下令。',
    lesson: { title: '性质五 · 信息更准确,未必增加参与', text: '人们看见的是身边(教会圈)与全局(西德电视)的加权。录像让许多人获得了超出熟人圈的共同证据——可"信息更准确"本身不一定增加参与,关键看原来的认知偏在哪一边。在这里,封锁让人们低估了彼此的数量;真相一旦出现,低估就被纠正了。' },
  });

  /* ============================================================
   * 第九章 · 布加勒斯特 1989 (朝廷)
   * ============================================================ */
  LEVELS.push({
    id: 'bucharest', chapter: '第九章', title: '最后一次大会', era: '1989年12月15日—12月31日', place: '蒂米什瓦拉 · 布加勒斯特', icon: '🎙️',
    side: 'regime', role: '尼古拉·齐奥塞斯库',
    blurb: '国家安全局的报告说:一切正常。报告一直都这么说。',
    intro: [
      '1989年12月。柏林墙倒了,布拉格的人上了街,保加利亚换了领导人。在你的国家,一切照旧。',
      '为了还清外债,你让全国勒紧了腰带:面包、肉、牛奶凭票供应,冬天的公寓里只有几个小时的暖气,晚上街灯是黑的。国家安全局(Securitate)无处不在,每个单位都有人打报告。',
      '<b>报告说:人民拥护你。</b>报告一直都这么说。',
    ],
    quote: '沉默的记录,不足以确定沉默背后的反应结构。——《道路以目》',
    goalText: '撑到1989年最后一天,别让街头失控,也别让军队倒戈。',
    tips: ['你的情报几乎完全不可信:执法越凶,下面的人越不敢说真话。「国家安全局线人」能让你暂时听到真话。', '勒紧腰带省下的钱,正变成看不见的积怨。补贴能买来平静——真正的平静。', '十万人站在同一个广场上,每个人都能看见别人。'],
    rounds: 34, scale: 5000, arrestScale: 30, moodScale: 0.2, tipSpread: 0.3,
    randomEvents: ['r_ringleaders', 'r_rumor', 'r_hawks', 'r_advisor', 'r_pay'],
    world: { N: 2000, tolType: 'uniform', tolMul: 0.4, netType: 'random', netDeg: 6, P: 1.0, Pbar: 0.7, K0: 50, M: 150, alpha: 0.3, beta: 0.45, delta: 0.2, gamma: 2, memDecay: 0.03, vis: 0.8, omega: 0.8, globalScale: 0.8, noise: 0.01, hardCore: 0.003, seed: 1989, psiScale: 1.6 },
    policies: { start: { enforce: 'harsh', police: 'surge', target: 'preventive', info: 'blackout', release: 'long' } },
    setup: (g) => { g.griefAll(0.13); g.flagTop(0.03); },   // 多年的配给、寒冷与监视
    labels: { army: '军队', crowd: '街头', plaza: '宫殿广场', prison: '国家安全局', barracks: '国防部', avenue: '胜利大道' },
    slogans: ['打倒齐奥塞斯库!', '蒂米什瓦拉!', '我们是人民!', '军队和我们在一起!'],
    policyNames: {
      police: { name: '警力', options: { lean: '精简', normal: '常规', surge: '国家安全局', martial: '军队进城' } },
      info: { name: '舆论', options: { open: '如实报道', spin: '报喜不报忧', blackout: '只播领袖' } },
    },
    cardNames: {
      informants: { name: '国家安全局线人', text: '让线人去听人们私下说什么。这几天你会听到真话——最敢说话的人也会先被抓。' },
      editorial: { name: '电视讲话', text: '在电视上谴责"流氓"和"外国特务"。' },
      crackdown: { name: '开枪', text: '命令军队和国家安全局向人群开枪。街道会空——枪声也会被所有人听见。' },
      subsidy: { name: '恢复暖气与供应', text: '给公寓通上暖气,让商店里有面包和肉。花掉的是还债省下的钱。' },
      dialogue: { name: '派人谈判', text: '承认一部分诉求:工资、供应、不再驱逐牧师。' },
      amnesty: { name: '释放被捕者', text: '放掉这几天抓起来的人。' },
      bonus: { name: '给军官加薪', text: '升职、加薪、许诺。让将军们记得是谁在养活他们。' },
    },
    cards: ['informants', 'subsidy', 'dialogue', 'amnesty', 'bonus', 'editorial', 'crackdown'],
    startAP: 4, income: 1.2,
    ai: { income: 1.0, every: 2, base: 0.01, smart: 0.8, aggression: 0.8, orgRate: 1.2, cards: ['rally', 'march', 'strike', 'memorial', 'leak', 'fraternize'],
      pushNews: '全城罢工,人们涌向市中心!',
      chatter: ['排队买面包的人在小声说话,看见戴皮帽的人就散了。', '有人在收听自由欧洲电台。', '公寓里只有几个小时的暖气。', '有人在墙上写了一个名字,又被刷掉了。'] },
    goal: { x: 0.25, d: 0.5, hold: 2, dHold: 2 },
    stars: [
      { text: '没有下令开枪', test: (g) => !g.flags.shot },
      { text: '年底时民间积怨不超过"积怨"', test: (g) => g.meanGrievance() / g.moodScale < 0.55 },
    ],
    dateFmt: halfDayFmt(1989, 12, 15),
    events: [
      { at: 0, title: '特凯什牧师', art: '⛪', text: '12月15日,蒂米什瓦拉。匈牙利族归正会牧师特凯什·拉斯洛接到了驱逐令——他在外国电视上批评了你的政策。<br><br>他的教友们手挽手,围在牧师住所门前,不让警察进去。', choices: [
        { label: '照常驱逐', hint: '规矩就是规矩', run: (g) => { g.forceOpp('rally', false); g.griefAll(0.01, 0.5); } },
        { label: '暂缓驱逐', wise: true, hint: '人群会散——你会显得软弱', run: (g) => { g.base.Pbar += 0.03; g.org = Math.min(100, g.org + 6); } },
      ] },
      { at: 3, title: '蒂米什瓦拉', art: '🔥', text: '围在牧师门前的人越来越多,罗马尼亚人也加入了。人群冲进县党委大楼,把你的画像和书扔出窗外,喊着"打倒齐奥塞斯库"。<br><br>县里请示:要不要开枪?', choices: [
        { label: '开枪', hint: '街道会空——枪声也会被所有人听见', run: (g) => { g.flags.shot = true; g.selfCard('crackdown', '12月17日,军队和国家安全局在蒂米什瓦拉向人群开枪。'); } },
        { label: '水龙和警棍', hint: '驱散,但不开枪', run: (g) => g.addEffect({ id: 'hose', name: '水龙驱散', icon: '🚒', side: 'regime', rounds: 2, mod(m) { m.K0 *= 1.4; } }) },
        { label: '派人去谈', wise: true, hint: '承认一部分诉求 · 对手会觉得你软', run: (g) => g.selfCard('dialogue', '县里派人和人群谈判。') },
      ] },
      { at: 6, title: '伊朗之行', art: '✈️', text: '按计划,你今天出发去德黑兰进行国事访问,20日回来。夫人埃列娜会替你主持政治执行委员会。<br><br>取消出访,全世界都会猜到国内出了事。', choices: [
        { label: '按计划出访', hint: '接下来两天你无法出牌、也不能改政策', run: (g) => { g.flags.away = true; g.allowCards = []; g.log('你飞往德黑兰。', 'mine'); } },
        { label: '取消出访', wise: true, hint: '花费 3 点 · 反对派士气 ↑', run: (g) => { g.me.ap = Math.max(0, g.me.ap - 3); g.org = Math.min(100, g.org + 8); } },
      ] },
      { at: 10, if: (g) => !!g.flags.shot, news: '蒂米什瓦拉全城罢工。军队撤回了兵营,市民在歌剧院广场上宣布:这里是"自由城市"。', kind: 'crowd', run: (g) => { if (g.flags.away) { g.flags.away = false; g.allowCards = null; } g.scalePsi(0.2, 0.8); g.forceOpp('strike', false); } },
      { at: 10, if: (g) => !g.flags.shot, news: '蒂米什瓦拉的工厂里,工人们在议论这几天的事。有人在厂门口停了下来,又走了进去。', kind: 'event', run: (g) => { if (g.flags.away) { g.flags.away = false; g.allowCards = null; } g.forceOpp('rally', false); } },
      { at: 11, title: '电视讲话', art: '📺', text: '你从德黑兰回来,当晚在电视上发表讲话。', choices: [
        { label: '谴责"流氓"和外国特务', hint: '怕的人会退缩——被冤枉的人会记住', run: (g) => { g.selfCard('editorial', '你在电视上说:蒂米什瓦拉的事件是外国特务和流氓挑起的。'); } },
        { label: '宣布涨工资、增加供应', wise: true, hint: '花费 2 点 · 积怨 ↓', run: (g) => { g.me.ap = Math.max(0, g.me.ap - 2); g.griefScale(0.82); g.log('你在电视上宣布:提高工资和养老金,增加供应。', 'mine'); } },
      ] },
      { at: 12, title: '12月21日 · 群众大会', art: '🎙️', text: '你打算在中央委员会大楼前召开十万人大会,谴责蒂米什瓦拉的"流氓"。工厂和机关用大巴把人拉来,发了标语和你的画像。电视将向全国直播。<br><br>十万人站在同一个广场上,<b>每个人都能看见别人。</b>', choices: [
        { label: '召开大会,全国直播', hint: '如果人们真的站在你这边,这会是一次胜利', run: (g) => {
          const m = g.meanGrievance() / g.moodScale;
          g.addEffect({ id: 'rally21', name: '全国直播的大会', icon: '📺', side: 'movement', rounds: 1, mod(mm) { mm.gs = 1; mm.vis = 1.2; mm.omega = 1; } });
          if (m < 0.35) { g.org = Math.max(0, g.org - 25); g.me.ap += 3; g.log('大会秩序井然。电视上是一片挥舞的旗帜。', 'intel'); }
          else { g.addSeeds(0.004 + 0.06 * Math.min(1, m - 0.35)); g.log('讲话进行到一半,广场后排传来口哨声和"蒂米什瓦拉!"的喊声。你愣住了,抬手示意安静。直播中断了。', 'crowd'); }
        } },
        { label: '取消大会', wise: true, hint: '什么也不会发生——至少今天', run: (g) => { g.org = Math.min(100, g.org + 8); } },
      ] },
      { at: 14, if: (g) => g.d >= 0.12 || g.x >= 0.06, title: '12月22日 · 国防部长', art: '🪖', text: '上午传来消息:国防部长米利亚死了。官方说他是"叛徒",畏罪自杀。<br><br>坦克上的士兵,开始把枪口转向天空。', choices: [{ label: '……' }], run: (g) => g.scalePsi(0.6, 0.35) },
      { at: 14, if: (g) => !(g.d >= 0.12 || g.x >= 0.06), news: '国防部长米利亚照常向你汇报。首都一切如常。', kind: 'intel' },
    ],
    check: (g) => { if (g.flags.away && g.round >= 10) { g.flags.away = false; g.allowCards = null; } return null; },
    endings: {
      survive: { title: '新年', text: (g) => (g.meanGrievance() / g.moodScale < 0.55 ? '你撑到了1990年。暖气通上了,商店里有了面包,人们回到了家里。' : '你撑到了1990年。街道安静下来,报告说一切正常——报告一直都这么说。') + '<br><br><b>这不是历史。</b>历史上,12月22日中午,齐奥塞斯库夫妇乘直升机从中央委员会大楼楼顶逃离;三天后,他们在特尔戈维什泰被一个临时军事法庭草草审判,随即枪决。' },
      crowd: { title: '直升机', text: '12月22日中午,人群冲进中央委员会大楼。你和埃列娜从楼顶乘直升机逃离。<br><br>三天后,你们在特尔戈维什泰被一个临时军事法庭审判,随即枪决。审判持续了不到一个小时。' },
      army: { title: '军队和我们在一起', text: '坦克调转了方向。士兵们爬下车,和人群拥抱。国防部已经不再接你的电话。<br><br>三天后,你和埃列娜在特尔戈维什泰被草草审判,随即枪决。' },
    },
    history: '1989年12月15日,蒂米什瓦拉的教友围住匈牙利族牧师特凯什·拉斯洛的住所,阻止驱逐;次日抗议扩大为反政府示威。12月17日,军队和国家安全局向人群开枪,遇难者遗体被秘密运往布加勒斯特火化。齐奥塞斯库于18日至20日访问伊朗。20日蒂米什瓦拉全城罢工,军队撤回兵营。21日中午,齐奥塞斯库在中央委员会大楼前召开群众大会,讲话中途人群发出嘘声,电视直播中断;当晚布加勒斯特发生枪击。22日上午,国防部长米利亚死亡(官方称自杀),军队转向民众一方,齐奥塞斯库夫妇中午乘直升机逃离。25日,二人经临时军事法庭审判后被处决。',
    lesson: { title: '性质一 · 性质十三:沉默不发出预警,崩落也未必有前兆', text: '公开参与可以一直是零,小扰动的恢复速度也可以一直不变,而临界点正在向它靠近——沉默本身不告诉你离崩落还有多远。模型也提醒我们:接近临界点时恢复会变慢,可反过来,不能用几天里的突变去证明"此前必定出现了临界减速"。12月21日广场上的口哨声,不是崩落的原因,而是一个早已存在的状态,第一次被所有人同时看见。' },
  });

  /* ============================================================
   * 第十章 · 2022 四通桥与白纸 (行动方)
   * ============================================================ */
  LEVELS.push({
    id: 'baizhi', chapter: '第十章', title: '一张白纸', era: '2022年10月13日—12月7日', place: '北京 · 上海 · 乌鲁木齐', icon: '📄',
    side: 'movement', role: '散落在各地的年轻人',
    blurb: '一个人,一座桥,两条横幅。然后是一场火,和一张什么也没写的纸。',
    intro: [
      '"动态清零"进入第三年。封控、核酸、健康码,几亿人的生活被一道道围栏分割。',
      '10月13日,北京海淀的四通桥上,一个男人挂出两条横幅:<b>"不要核酸要吃饭,不要封控要自由……"</b>',
      '这个国家有最严密的审查和最广的监控。在这里,站出来的人几乎一定会被找到。',
    ],
    goalText: '在12月7日前,让各地同时站出来的人达到一个足以被看见的规模(约 1.2 万人),并坚持两天。',
    tips: ['审查让每个人都低估了别人的愤怒——「翻墙转发」和「曝光真相」能打破它。', '举白纸的风险比喊口号小。', '悲剧会发生。那时候,人们的心里会有一个很大的缺口。'],
    rounds: 55, scale: 100, arrestScale: 2, moodScale: 0.2, tipSpread: 0.4, randomEvents: ['death', 'mole', 'prices', 'split', 'release', 'writer'],
    world: { N: 2000, tolType: 'uniform', tolMul: 0.46, netType: 'random', netDeg: 10, P: 1.0, Pbar: 0.85, K0: 42, M: 200, alpha: 0.08, beta: 0.4, delta: 0.15, gamma: 2.5, memDecay: 0.08, vis: 0.6, omega: 0.5, globalScale: 0.7, noise: 0.02, hardCore: 0.001, seed: 2022, psiScale: 2.0 },
    policies: { start: { enforce: 'harsh', police: 'surge', target: 'organizer', info: 'blackout', release: 'long' } },
    labels: { army: '警察与"大白"', crowd: '街头', plaza: '乌鲁木齐中路', prison: '派出所', barracks: '维稳指挥部', avenue: '亮马河' },
    slogans: ['', '', '不要核酸要吃饭', '不要封控要自由', '……'],
    cards: ['banner', 'rally', 'blankpaper', 'samizdat', 'leak', 'memorial', 'lowkey', 'legal'],
    cardNames: {
      samizdat: { name: '翻墙转发', text: '翻墙、截图、换个说法、用谐音。删得再快,总有人先看到。' },
      leak: { name: '转发现场视频', text: '把被删掉的视频一遍遍重新发上去。' },
      memorial: { name: '点一支蜡烛', text: '在路牌下放一束花、点一支蜡烛。' },
    },
    startAP: 1, income: 0.9,
    ai: { aggression: 0.85, income: 1.4, lag: 2, start: { enforce: 'harsh', police: 'surge', info: 'blackout', target: 'organizer', release: 'long' }, cards: ['informants', 'editorial', 'cutnet'] },
    goal: { x: 0.06, hold: 2 },
    stars: [
      { text: '在11月底前成功', test: (g) => g.round <= 48 },
      { text: '被带走的人少于四百', test: (g) => g.sim.R < 0.1 },
    ],
    dateFmt: dayFmt(2022, 10, 13),
    events: [
      { at: 0, title: '四通桥', art: '🌉', text: '中午,四通桥上冒起浓烟。一个穿橙色衣服的男人挂出两条横幅,用喇叭一遍遍念着上面的字。<br><br>他很快被带走。照片在几分钟内被删除——但已经有人存了下来。', choices: [{ label: '记住这一天', hint: '你手里有一张「桥上的横幅」' }] },
      { at: 3, news: '二十大开幕。各地安保升级,"四通桥""海淀""勇士"都成了敏感词。', kind: 'opp', run: (g) => { g.forcePolicy('police', 'surge', 10, '二十大安保'); } },
      { at: 29, news: '"二十条"发布,防疫措施有所松动。许多人松了一口气——但封控仍在继续。', kind: 'event', run: (g) => g.griefScale(0.95) },
      { at: 42, title: '11月24日 · 乌鲁木齐', art: '🔥', text: '乌鲁木齐吉祥苑小区一栋高层住宅起火。官方通报十人遇难。<br><br>这个城市已经封控了一百多天。人们在网上追问:消防车为什么进不去?门为什么打不开?', choices: [{ label: '转发', hint: '被压住的愤怒浮出水面;「曝光真相」「点一支蜡烛」免费', run: (g) => { g.giveFree('leak', 3); g.giveFree('memorial', 4); } }], run: (g) => { g.griefAll(0.08); g.sim.reveal(0.6); } },
      { at: 43, news: '乌鲁木齐市民走上街头,要求解封。', kind: 'crowd', run: (g) => g.addSeeds(0.015) },
      { at: 44, title: '乌鲁木齐中路', art: '🕯️', text: '上海,乌鲁木齐中路的路牌下。有人放下一束花,点起一支蜡烛。接着是第二个人,第三个人……', choices: [{ label: '走过去', hint: '「举起白纸」免费', run: (g) => { g.giveFree('blankpaper', 3); g.addSeeds(0.01); } }] },
      { at: 45, news: '清华、北大、南京、成都、武汉、广州……人们举起了白纸。', kind: 'crowd', if: (g) => g.x > 0.005 },
      { at: 47, news: '警察开始检查地铁乘客的手机,排查现场照片里的人。', kind: 'opp', run: (g) => { g.forcePolicy('target', 'preventive', 8, '排查'); g.forceOpp('informants', false); } },
    ],
    endings: {
      crowd: { title: '白纸', text: '在很多个城市,人们同时举起了白纸。12月7日,"新十条"发布,持续近三年的动态清零实际上结束了。<br><br>抗议与政策转向之间的因果关系至今仍有争论——病毒的扩散与财政压力同样是原因。可以确定的是,此后数月,一批参加过悼念的年轻人陆续被带走。' },
      timeout: { title: '沉默', text: '12月7日,防疫政策还是转向了——病毒并没有等待任何人的许可。<br>只是那些本可以被说出来的话,又一次沉入了沉默。' },
    },
    history: '2022年10月13日,彭立发在北京四通桥挂出横幅,随即被带走,外界至今几乎没有他的可靠消息。11月24日乌鲁木齐吉祥苑火灾,官方通报10人遇难。11月25日乌鲁木齐出现抗议;26日至27日,上海乌鲁木齐中路、北京亮马河、多所高校等地出现悼念与抗议,人们举起白纸。12月7日,"新十条"发布。此后,多名参与悼念的年轻人被拘押。',
    lesson: { title: '识别的限制 · 偏好伪装', text: '审查让每个人都只看到被压缩过的"总体参与",于是每个人都低估了别人。人们隐藏自己的态度,又从别人的公开态度中推断局势——结果同时误导了自己、旁观者和掌权者。一张白纸之所以有力量,是因为它让所有人确认了一件大家早就知道、却不能说出来的事。' },
  });

  /* ============================================================
   * 第十一章 · 朝鲜 (行动方 · 信息网络)
   * ============================================================ */
  LEVELS.push({
    id: 'pyongyang', chapter: '第十一章', title: '看不见的裂缝', era: '2019年—2022年', place: '朝鲜 · 惠山 / 新义州', icon: '🌑',
    side: 'movement', role: '边境的走私与信息网络',
    blurb: '这里不会有游行。你能做的,是让沉默变薄——在不被发现的前提下。',
    intro: [
      '夜晚的卫星照片上,朝鲜是一片漆黑。',
      '出身成分决定你住在哪里、能做什么;一个人犯了"政治错误",家人也会受牵连;人民班的邻居会报告你家来了什么人。据估计,政治犯收容所里关押着八万到十二万人。',
      '<b>在这里,任何公开的反抗都活不过一轮。</b>你的目标不是革命——而是让那个"需要多少人一起站出来"的数字,从"不可能"变成"也许可以"。',
    ],
    goalText: '在2022年底前,让临界点出现,并降到"约两成人一起站出来就够"以下(维持三个月)。同时,别让你的网络暴露。',
    tips: ['别上街——在这里公开行动只是送死。', '「U盘里的韩剧」让人们不再相信官方说法,也让人知道邻居也在看。', '每一次行动都会增加暴露风险。暴露太高,109 常务组会找上门。', '处罚越被看作不正当,每一次处罚留下的记忆就越深。'],
    rounds: 48, scale: 12500, arrestScale: 200, moodScale: 0.15, tipSpread: 0.35, randomEvents: ['death', 'mole', 'prices'], structuralTip: true,
    world: { N: 2000, tolType: 'low', netType: 'clusters', netGroups: 60, P: 1.0, Pbar: 2.9, K0: 40, M: 200, alpha: 0.05, beta: 0.4, delta: 0.3, gamma: 3, memDecay: 0.03, vis: 0.35, omega: 0.9, globalScale: 0.3, noise: 0.02, hardCore: 0, seed: 1948, psiScale: 1.8, netDamage: 0.6 },
    policies: { start: { enforce: 'terror', police: 'surge', target: 'preventive', info: 'blackout', release: 'long' } },
    labels: { army: '保卫部与军队', crowd: '街头', plaza: '广场', prison: '管理所', barracks: '保卫部', avenue: '大街' },
    theme: 'night',
    slogans: [],
    cards: ['usb', 'bribe', 'market', 'hide', 'samizdat', 'network', 'rally'],
    cardNames: {
      samizdat: { name: '境外广播', text: '把改装过的收音机调到境外电台的频率。', tags: ['打破封锁', '官方说法失信'] },
      network: { name: '亲戚与同乡', text: '信得过的人只有亲戚、同乡和一起做生意的人。' },
      rally: { name: '公开抗议', text: '在这里,这几乎是自杀。' },
    },
    startAP: 2, income: 1.0,
    ai: { aggression: 1.0, income: 1.5, lag: 3, quiet: true, start: { enforce: 'terror', police: 'surge', target: 'preventive', info: 'blackout', release: 'long' }, cards: ['informants', 'crackdown', 'bonus'] },
    goal: {},
    stars: [
      { text: '暴露风险从未超过一半', test: (g) => !g.flags.exposedHalf },
      { text: '在2022年6月之前完成', test: (g) => g.round <= 41 },
    ],
    dateFmt: monthFmt(2019, 1),
    setup: (g) => { for (const k of ['enforce', 'police', 'target', 'info', 'release']) g.forcePolicy(k, g.pol[k], 999, '朝鲜'); g.exposure = 10; g.flagTop(0.02); },
    onRound: (g) => {
      if (g.exposure >= 50) g.flags.exposedHalf = true;
      const p = Math.max(0, (g.exposure - 20) / 160);
      if (g.rng() < p) {
        g.exposure = Math.max(0, g.exposure - 12);
        g.me.ap = Math.max(0, g.me.ap - 1);
        g.cutEdges(0.06);
        g.addSeeds(0.004);   // 被搜出来的人: 公开处理
        g.log('109 常务组突击搜查了几户人家,带走了人。他们在找 U 盘。', 'opp');
        g.fx.push({ type: 'raid' });
      }
    },
    events: [
      { at: 0, title: '惠山', art: '🌑', text: '鸭绿江对岸就是中国。冬天江面结冰的时候,人可以走过去,货也可以走过来。<br><br>你做的生意是:大米、电池、手机——还有藏在电池盒里的 U 盘。', choices: [{ label: '开始' }] },
      { at: 12, title: '国境封锁', art: '🚧', text: '新冠疫情暴发。朝鲜关闭了与中国的边境,下令边境一公里内接近者格杀勿论。<br><br>走私几乎断绝。你的每一次行动都更危险了。', choices: [{ label: '继续' }], run: (g) => { g.exposureMul = 1.6; g.bonusIncome -= 0.25; } },
      { at: 23, title: '反动思想文化排斥法', art: '⚖️', text: '最高人民会议通过新法:传播韩国影视作品,最高可判处死刑;观看者判处劳动教养;家人、单位负责人连带受罚。', choices: [{ label: '继续' }], run: (g) => { g.base.P *= 1.25; } },
      { at: 27, news: '金正恩在党的会议上说,要进行"更艰难的苦难行军"。', kind: 'event', run: (g) => g.griefAll(0.02) },
      { at: 30, title: '公开处决', art: '⚫', text: '据传,某地举行了公开处决。被处决者被指传播外国影视。附近的居民、学生被组织去观看。<br><br>如果人们仍然觉得这是"应得的",这只会让他们更害怕;如果他们已经不再相信——他们会记住这一天。', choices: [{ label: '……' }], run: (g) => { g.addSeeds(0.004); g.addEffect({ id: 'forcedwatch', name: '被组织观看', icon: '👁️', side: 'regime', rounds: 1, mod(m) { m.P *= 1.4; m.vis = 1; m.omega = 0.9; } }); } },
      { at: 40, news: '官方首次承认国内出现新冠疫情,全国封锁。', kind: 'event', run: (g) => g.griefAll(0.02) },
    ],
    check: (g) => {
      const t = g.structuralTipping();   // 一次广播带来的短暂松动不算数(structuralTip: 界面上的估计也不含它)
      g.streak.tip = t <= 0.2 ? g.streak.tip + 1 : 0;
      if (g.streak.tip >= 3) return { win: true, key: 'crack' };
      return null;
    },
    endings: {
      crack: { title: '裂缝', text: '你成功了——如果"成功"是这个意思的话:此刻,只要大约两成人同时站出来,这里就可能发生变化。<br><br>但没有人知道这件事。街道和昨天一样安静,密报和昨天一样写着"一切正常"。<b>沉默不发出预警。</b>' },
      exposed: { title: '网络被端掉了', text: '109 常务组找到了你的联络人,然后是你。在朝鲜,传播外国影视可以被判处劳动教养,情节严重的可以被判处死刑;你的家人也可能被牵连。' },
      timeout: { title: '沉默依旧', text: '四年过去了。你让一些人看到了另一种生活,但裂缝还不够深。' },
    },
    history: '据联合国朝鲜人权调查委员会(2014)估计,朝鲜政治犯收容所关押着八万至十二万人。1990年代中期的饥荒("苦难的行军")造成数十万至上百万人死亡;此后配给制崩溃,民间市场(장마당)成了多数人的生计来源,外国影视也随 U 盘、SD 卡和便携播放器流入。2020年1月,朝鲜因新冠疫情关闭边境;同年12月通过《反动思想文化排斥法》。',
    lesson: { title: '识别的限制 · 沉默不发出预警', text: '"只有沉默的记录,不足以确定沉默背后的反应结构。"两个完全不同的社会可以产生一模一样的沉默;而维持沉默的条件发生了变化,沉默本身并不会提前告诉任何人——包括平壤。' },
  });

  /* ============================================================
   * 自由对局
   * ============================================================ */
  // mov / reg: 玩家分别扮演行动方 / 当局时的承受上限倍率(两边的电脑对手强弱不同, 分开校准)
  const SOCIETIES = {
    ordinary: { name: '普通城市', desc: '门槛均匀分布,随机熟人网络。', mov: 0.33, reg: 0.7, world: { tolType: 'uniform', netType: 'random', netDeg: 8 } },
    fearful: { name: '高压社会', desc: '人人都怕,承受上限整体很低。', mov: 0.45, reg: 1.4, world: { tolType: 'low', netType: 'random', netDeg: 8 } },
    divided: { name: '撕裂社会', desc: '大多数温和,少数激进。', mov: 0.33, reg: 0.8, world: { tolType: 'bimodal', netType: 'random', netDeg: 8 } },
    tight: { name: '紧密社区', desc: '小团体内部紧密,团体之间联系少。', mov: 0.33, reg: 0.8, world: { tolType: 'bell', netType: 'clusters', netGroups: 30 } },
  };
  function makeSkirmish(side, societyKey) {
    const S = SOCIETIES[societyKey] || SOCIETIES.ordinary;
    return {
      id: 'skirmish', chapter: '自由对局', title: S.name, era: '虚构', place: '某城', icon: '🎲',
      side, role: side === 'movement' ? '行动方' : '当局',
      intro: [S.desc, side === 'movement' ? '60 轮内,让一半的人走上街头,或让军警倒戈。' : '撑过 60 轮,别让局面失控。'],
      goalText: side === 'movement' ? '60 轮内,让一半的人站出来并坚持三轮,或让军警倒戈。' : '撑过 60 轮,别让一半的人站出来,也别让军警倒戈。',
      rounds: 60, scale: 500, arrestScale: 20, moodScale: 0.2,
      // 玩家当局时 δ 更大: 一味加码的处罚会让执行者动摇, 铁腕不是免费的
      world: Object.assign({ N: 2000, P: 1.0, Pbar: 0.8, K0: 40, M: 150, alpha: 0.25, beta: 0.5, delta: side === 'movement' ? 0.2 : 0.4, gamma: 2, memDecay: 0.1, vis: 0.9, omega: 0.8, globalScale: 1, noise: 0.01, hardCore: 0.003, seed: 99, psiScale: 1.3 }, S.world, { tolMul: side === 'movement' ? S.mov : S.reg }),
      policies: { start: STD_POL },
      labels: { army: '军警', crowd: '街头', plaza: '中心广场', prison: '看守所', barracks: '兵营', avenue: '大街' },
      slogans: ['自由!', '对话!', '释放被捕者!'],
      cards: side === 'movement' ? ['rally', 'march', 'mobilize', 'strike', 'samizdat', 'leak', 'memorial', 'fraternize', 'network', 'legal'] : ['informants', 'editorial', 'crackdown', 'amnesty', 'dialogue', 'subsidy', 'bonus', 'rotate', 'cutnet'],
      startAP: 2, income: side === 'movement' ? 1.0 : 1.2,
      ai: side === 'movement'
        ? { income: 1.0, every: 3, base: 0.012, smart: 0.7, aggression: 0.75, cards: ['rally', 'march', 'strike', 'memorial', 'leak', 'fraternize', 'samizdat'] }
        : { aggression: 0.65, income: 1.2, lag: 2, cards: ['editorial', 'informants', 'bonus', 'crackdown', 'rotate', 'dialogue'] },
      goal: { x: 0.5, d: 0.55, hold: 3, dHold: 2 },
      stars: side === 'movement'
        ? [{ text: '30 轮内成功', test: (g) => g.round <= 30 }, { text: '被捕者少于 5%', test: (g) => g.sim.R < 0.05 }]
        : [{ text: '民间积怨不超过"积怨"', test: (g) => g.meanGrievance() / g.moodScale < 0.55 }, { text: '被捕者少于 10%', test: (g) => g.sim.R < 0.1 }],
      dateFmt: (r) => `第 ${r + 1} 轮`,
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
