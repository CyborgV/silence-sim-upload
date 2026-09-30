/* 讲解视频的脚本: 每一句旁白是一条字幕(cue), 画面按场景(scene)组织。
 * 中英文共用同一组画面, 各自按旁白长度计时。
 * 数学部分与论文《道路以目——沉默相变模型》一致: 代价 c(x)=P·min(1,k/x); 参与条件 τ+b ≥ c;
 * 反应函数 F(x)=1−G(c(x)); 均匀分布下临界种子 x₋=(1−√(1−4Pk))/2; 记忆 b←(1−ρ)b+γw(P−P̄)₊ζ;
 * 执行者规则 αx+βd+δ(P−P̄)₊ ≥ ψ。
 */
(function (global) {
  'use strict';
  const S = [
    { id: 'hook', visual: 'assembly', cues: [
      ['一千个学生站在操场上,听校领导训话:从下周起,取消周末。', 'A thousand students stand in a schoolyard. The principal announces: starting next week, no more weekends.'],
      ['如果二十个人站出来反对,他们会被一个个点名带走。操场重归安静。', 'If twenty students step forward to object, they are called out and taken away, one by one. The yard falls silent again.'],
      ['如果二十一个人站出来——三分钟后,站出来的是全校。', 'If twenty-one step forward — three minutes later, it is the whole school.'],
      ['只差一个人,结局完全不同。这背后,是一条非常简单的数学。', 'One person apart, and completely different endings. Behind this is a very simple piece of math.'],
    ] },
    { id: 'title', visual: 'title', cues: [
      ['沉默为什么会突然崩塌?', 'Why does silence collapse all at once?'],
    ] },
    { id: 'cost', visual: 'cost', cues: [
      ['先看一个人:要不要站出来?每个人心里都有一个"承受上限" τ——他愿意为表态付出多大的代价。', 'Start with one person: should I stand up? Everyone has a tolerance, tau — how much they are willing to pay for speaking out.'],
      ['代价取决于两件事:被抓之后有多重的处罚 P,和被抓的可能性有多大。', 'The cost depends on two things: how harsh the punishment P is, and how likely you are to be caught.'],
      ['关键在于,当局每一轮能处理的人是有限的——比如总人数的 k。', 'And here is the key: the authorities can only deal with so many people at a time — say, a fraction k of everyone.'],
      ['站出来的人越多,同样的警力被摊得越薄,每个人被抓的机会就越小。', 'The more people stand up, the thinner the same police force is spread, and the smaller each person\'s chance of being caught.'],
      ['所以当站出来的比例是 x 时,每个人面对的代价是 P 乘以 k/x 与 1 中较小的那个。', 'So when a share x of people are out, each person faces a cost of P times the smaller of k over x, and one.'],
      ['只要承受上限不低于这个代价,他就会站出来。', 'Anyone whose tolerance is at least that cost stands up.'],
    ] },
    { id: 'reaction', visual: 'reaction', cues: [
      ['把所有人加在一起:如果此刻有 x 的人站出来,下一刻愿意站出来的比例是 F(x)——承受上限超过代价的那部分人。', 'Add everyone up: if a share x is out now, the share willing to be out next is F of x — everyone whose tolerance exceeds the cost.'],
      ['局面停下来的地方,就是 F(x) 等于 x——曲线和对角线相交的点。', 'The system comes to rest where F of x equals x — where the curve crosses the diagonal.'],
      ['通常有三个交点:底部是稳定的沉默,顶部是稳定的大规模参与,中间还有一个不稳定的分界。', 'Usually there are three: stable silence at the bottom, stable mass participation at the top, and in between, an unstable dividing line.'],
      ['这个分界就是临界点。低于它,任何行动都会被吸回沉默;越过它,风险被越来越多的人摊薄,连锁反应开始。', 'That dividing line is the tipping point. Below it, any action is pulled back into silence. Above it, the risk is spread over more and more people, and a chain reaction begins.'],
      ['回到操场:一千人,承受上限均匀分布,处罚 P 等于 1,每轮最多处理百分之二,也就是二十个人。', 'Back to the schoolyard: a thousand students, tolerances spread evenly, punishment P equal to one, and at most two percent — twenty students — dealt with each round.'],
      ['二十个人站出来:二十个全被带走,下一轮是零。', 'Twenty stand up: all twenty are taken. Next round: zero.'],
      ['二十一个人:只能带走二十个,每个人的风险降到二十一分之二十——下一轮是 48 人,然后 580,然后 966。', 'Twenty-one: only twenty can be taken, so each person\'s risk drops to twenty in twenty-one. Next round, 48. Then 580. Then 966.'],
      ['临界点有一个精确的公式,约等于 0.0204——正好是 20.4 个人。', 'The tipping point has an exact formula. It comes to about 0.0204 — exactly 20.4 people.'],
      ['把它展开,系数恰好是卡塔兰数:一、一、二、五、十四。', 'Expand it, and the coefficients are exactly the Catalan numbers: one, one, two, five, fourteen.'],
    ] },
    { id: 'memory', visual: 'memory', cues: [
      ['现实里还有一样东西:记忆。', 'Real life has one more ingredient: memory.'],
      ['当处罚超过人们认可的界线,每一次抓捕都会被旁观者记在心里,变成积怨 b。', 'When punishment goes beyond the line people accept, every arrest is remembered by those who watch. It becomes grievance, b.'],
      ['积怨不会让人立刻上街。它悄悄抬高每个人的承受上限:从 τ 变成 τ 加 b。', 'Grievance does not send anyone into the streets. It quietly raises everyone\'s tolerance, from tau to tau plus b.'],
      ['于是街上一直是零,可临界点在一直下降——从近三成,降到不到一成。', 'So the streets stay empty, while the tipping point keeps falling — from nearly thirty percent to under ten.'],
      ['公开的记录一模一样,内部的状态完全不同。沉默不发出预警——直到某一天,一次不大的聚集就越过了它。', 'The public record looks identical; the hidden state is entirely different. Silence gives no warning — until one day, a modest gathering crosses the line.'],
    ] },
    { id: 'bucharest', visual: 'bucharest', cues: [
      ['1989年12月21日,布加勒斯特。十万人被组织来听齐奥塞斯库讲话。', 'December 21, 1989, Bucharest. A hundred thousand people are bused in to hear Ceaușescu speak.'],
      ['讲到一半,广场后排响起了口哨声。十万人站在同一个广场上——每个人都第一次看见了别人。', 'Halfway through, whistles break out at the back. A hundred thousand people in one square — and for the first time, each of them can see the others.'],
      ['第二天中午,他乘直升机从楼顶逃离。', 'By noon the next day, he had fled by helicopter from the roof.'],
    ] },
    { id: 'twolayer', visual: 'twolayer', cues: [
      ['处罚能力 k 也不是一个常数。执行命令的人,也在看。', 'The capacity to punish, k, is not a constant either. The people carrying out the orders are watching too.'],
      ['街上的人越多、同僚抗命的越多、命令越过火,士兵越可能拒绝执行。', 'The more people in the street, the more comrades refusing, the more excessive the orders — the more likely a soldier refuses.'],
      ['士兵一动摇,k 就变小;k 变小,临界点下降,街上的人更多——两层反馈互相放大。', 'When soldiers waver, k shrinks. When k shrinks, the tipping point falls and the crowd grows — two feedback loops amplifying each other.'],
    ] },
    { id: 'petrograd', visual: 'petrograd', cues: [
      ['1917年2月的彼得格勒,驻军一个团接一个团地倒戈。三天后,沙皇退位。', 'Petrograd, February 1917: the garrison went over, regiment by regiment. Three days later, the Tsar abdicated.'],
    ] },
    { id: 'beijing', visual: 'beijing', cues: [
      ['而1989年的北京,街头的人到了百万,这一层却没有松动。', 'In Beijing in 1989, a million people filled the streets — but this layer never gave way.'],
    ] },
    { id: 'info', visual: 'info', cues: [
      ['最后是信息。审查压低的不是愤怒,而是"知道别人也愤怒"。', 'Finally, information. Censorship does not suppress anger; it suppresses knowing that others are angry too.'],
      ['在模型里,它相当于把每个人看到的人数打了折扣——临界点因此被抬高。', 'In the model, it discounts the crowd each person can see — which pushes the tipping point up.'],
    ] },
    { id: 'baizhi', visual: 'baizhi', cues: [
      ['2022年11月,乌鲁木齐一场火灾之后,人们在各地举起白纸。白纸上什么也没写,所有人都知道上面写着什么。', 'In November 2022, after a deadly fire in Urumqi, people across China held up blank sheets of paper. Nothing was written on them. Everyone knew what they said.'],
    ] },
    { id: 'game', visual: 'game', cues: [
      ['我把这个模型做成了一个游戏,叫《道路以目》。十一段真实的历史,你有时站在街头,有时坐在宫殿里。', 'I turned this model into a game: Glances on the Road. Eleven real episodes from history — sometimes you are in the street, sometimes in the palace.'],
      ['你看不到任何人的门槛。只能看到街上有多少人、下面报上来的情报,和真假难辨的传闻。', 'You never see anyone\'s threshold. Only how many are in the street, what your informants report, and rumors you cannot verify.'],
      ['每一关结束,复盘会揭晓那些你看不见的真实数值。', 'When a level ends, the debrief reveals the true numbers you could not see.'],
      ['免费,打开浏览器就能玩,中英文都有。链接在简介里。', 'It is free, it runs in your browser, in English and Chinese. The link is in the description.'],
    ] },
    { id: 'outro', visual: 'outro', cues: [
      ['沉默不等于同意。它只是还没有越过那条看不见的线。', 'Silence is not consent. It just has not crossed a line no one can see.'],
      ['你,会是第二十一个人吗?', 'Would you be the twenty-first?'],
    ] },
  ];

  // 每句的时长: 按常见 TTS 语速估计并留余量(剪映「文本朗读」约每秒 4.5 字 / 每秒 2.6 词)
  function cueDur(text, lang) {
    if (lang === 'zh') return Math.max(2.4, text.replace(/[\s,。、:;!?——…"“”「」()·]/g, '').length / 4.2 + 0.7);
    return Math.max(2.2, text.split(/\s+/).length / 2.5 + 0.7);
  }
  const PAD = { hook: [1.2, 0.8], title: [0.6, 1.4], outro: [0.4, 3.0] };   // 场景前后的留白
  const GAP = 0.25;                                                     // 句与句之间

  function timeline(lang) {
    const li = lang === 'zh' ? 0 : 1;
    let t = 0;
    const scenes = [], cues = [];
    for (const sc of S) {
      const [pre, post] = PAD[sc.id] || [0.5, 0.6];
      const t0 = t;
      t += pre;
      const local = [];
      for (const c of sc.cues) {
        const text = c[li], d = cueDur(text, lang);
        cues.push({ start: t, end: t + d, text });
        local.push({ t0: t - t0, t1: t - t0 + d, text });
        t += d + GAP;
      }
      t += post;
      scenes.push({ id: sc.id, visual: sc.visual, start: t0, dur: t - t0, cues: local });
    }
    return { lang, total: t, scenes, cues };
  }

  const api = { SCENES: S, timeline };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.VideoScript = api;
})(typeof window !== 'undefined' ? window : globalThis);
