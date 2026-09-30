# Translating 道路以目 into English

**Workflow.** `i18n/en.json` is the one canonical translation table (Chinese source string → English).
After changing Chinese text in the code, run `node i18n/extract.js --missing` (with NODE_PATH pointing at
an `acorn` install): untranslated keys land in `i18n/chunks/G99.json`. Translate them into
`i18n/chunks/G99.en.json` as described below, validate with `node i18n/check.js G99`, then
`node i18n/build-en.js` folds them into en.json and regenerates `en/`. The English HTML pages are
hand-translated in `i18n/index.en.html` and `i18n/lab.en.html` (keep their element ids in sync).

The game is a historical strategy game (Chinese) built on a formal model of silence, fear and
collective action. The English build replaces every Chinese string literal / template literal in
the JS source with its English translation (see `build-en.js`). You translate one group file.

## Input / output

- Input: `i18n/chunks/Gx.json` — an array of `{ key, kind, where }`.
  - `kind: "str"` → `key` is the *value* of a JS string literal. Your translation is also a plain
    string value (the build JSON-escapes it; do not add quotes around it).
  - `kind: "tpl"` → `key` is the *raw source between the backticks* of a JS template literal,
    including `${...}` expressions. Your translation must also be raw template source:
    - keep every `${...}` expression's **code** exactly (you may move it within the sentence);
    - but DO translate Chinese string literals that appear *inside* those expressions,
      e.g. `${r % 2 ? '夜' : '昼'}` → `${r % 2 ? 'night' : 'day'}`, and nested templates too;
    - never add a bare backtick; keep backslash escapes as they are.
  - `where` is `file:line` — open the file to see context when a string is short or ambiguous.
- Output: `i18n/chunks/Gx.en.json` — ONE JSON object `{ "<key exactly as given>": "<English>" }`
  covering every key. Write it with a script (node/python `json.dump`, `ensure_ascii=False`) —
  do not hand-escape JSON.
- Validate: `NODE_PATH=/tmp/claude-0/-home-user-silence-sim-upload/5f5b9950-8204-5626-a29d-bf43672777b5/scratchpad/node_modules node i18n/check.js Gx`
  (run from the repo root). Fix every ERROR; look at WARNs.

## Rules

- Keep HTML tags (`<b>`, `<br>`, `<span class="...">`, `<div ...>`), entities and emoji exactly.
  Translate Chinese inside attribute values (e.g. `data-tip`, `title`).
- Keep leading/trailing spaces and separators like `' · '`.
- Strings shaped like `低:下面的人不敢说真话` (short label, ASCII colon, explanation) are split on
  `:` by the code — keep exactly one ASCII colon after the short label: `Low: people below dare not tell the truth`.
- Chinese punctuation → English punctuation. 「X」 / 『X』 → “X” (or nothing, for button-like names).
  `——` → em dash `—`. `……` → `…`.
- Numbers with 万/亿: convert (`12万` → `120,000`; `约 2 万人` → `about 20,000 people`).
  Chinese dates → English (`4月4日` → `April 4`, `1989年6月` → `June 1989`).
- Card names, policy option names, button labels: SHORT (1–3 words). They sit on small buttons.
- Tone: terse, concrete, a little literary; like a good strategy-game UI and a history book.
  Don't soften or editorialize the history; keep hedges such as 据说/据报道 (“reportedly”).
- Some strings are only used by the Chinese build (e.g. Chinese date formats); translate them anyway.

## Glossary (use consistently)

| 中文 | English |
|---|---|
| 道路以目 (game title) | Glances on the Road |
| 《道路以目——沉默相变模型》 | *Glances on the Road: A Phase-Transition Model of Silence* |
| 临界点 | tipping point |
| 临界种子 | critical seed |
| 积怨 | grievance |
| 民间情绪 | public mood |
| 人们认可的界线 / 界线 | the line people accept (as legitimate) |
| 越界 / 越过界线 | over the line |
| 当局 | the regime (UI side label: Regime) |
| 民间 / 行动方 / 民间一方 | the movement (UI side label: Movement) |
| 扮演民间 / 扮演当局 | Play the movement / Play the regime |
| 当局警觉 | Regime alert |
| 反对派组织度 | Opposition organization |
| 组织力 (movement resource) | organizing power |
| 政治资本 (regime resource) | political capital |
| 组织元气 | organizational strength |
| 暗流 | undercurrent |
| 在观望 / 观望 | wavering |
| 蠢蠢欲动 / 欲动 | ready to move / ready |
| 参谋 | Advisor |
| 眼下的主要阻力 | The main obstacle now |
| 眼下的隐患 | The main hidden risk now |
| 回报 | Report |
| 走势 / 走势图 | Trends / trend chart |
| 局势分析 | Situation analysis |
| 组织建设 / 政权建设 / 建设 | Movement building / Regime building / Build |
| 气泡 | bubbles |
| 对策 (movement cards) | Tactics |
| 行动 (regime cards) | Actions |
| 政策 | Policies |
| 执法力度 / 警力 / 抓捕对象 / 舆论管控 / 关押政策 | Enforcement / Police / Arrest targets / Media / Detention |
| 执行者 / 军警 | enforcers / security forces |
| 倒戈 / 成建制倒戈 | defect / defect en masse |
| 迷雾 / 情报 | fog / intelligence |
| 复盘 | Debrief |
| 引导 / 新手引导 | Guide / Tutorial guide |
| 召公 (the guide character) | the Duke of Shao |
| 星级 | stars |
| 性质三 (etc., the paper's numbered results) | Property 3 |
| 常态 / 警戒 / 严打 / 全面镇压 (regime stages) | Normal / Alert / Crackdown / Total repression |
| 上升 / 下降 | rising / falling |
| 扩大 / 收缩 | growing / shrinking |
| 在升高 / 在降低 | going up / going down |
| 平稳 | steady |
| 传闻 | rumor |
| 据报 | reported |
| 约 X 人 | ~X people |
| 街上 / 街头 | on the streets / the streets |
| 章 (第一章…第十一章) | Chapter 1 … Chapter 11 |
| 序章 | Prologue |

Names: 周厉王 King Li of Zhou · 召公 the Duke of Shao · 荣夷公 Duke Rong · 卫巫 the shaman of Wei ·
国人 the capital's people (guoren) · 镐京 Haojing · 周恩来 Zhou Enlai · 邓小平 Deng Xiaoping ·
胡耀邦 Hu Yaobang · 赵紫阳 Zhao Ziyang · 李鹏 Li Peng · 吴德 Wu De · 张春桥 Zhang Chunqiao ·
哈巴洛夫 General Khabalov · 基尔皮奇尼科夫 Kirpichnikov · 沃伦斯基团 the Volynsky Regiment ·
巴甫洛夫斯基团 the Pavlovsky Regiment · 罗江科 Rodzianko · 普梯洛夫工厂 the Putilov works · 维堡区 the Vyborg side ·
霍梅尼 Khomeini · 萨瓦克 SAVAK · 库姆 Qom · 大不里士 Tabriz · 雷克斯电影院 Cinema Rex · 阿巴丹 Abadan ·
贾勒广场 Jaleh Square · 雅鲁泽尔斯基 Jaruzelski · 武耶克煤矿 the Wujek mine · 团结工会 Solidarity ·
朴钟哲 Park Jong-chul · 李韩烈 Lee Han-yeol · 全斗焕 Chun Doo-hwan · 卢泰愚 Roh Tae-woo · 金大中 Kim Dae-jung ·
金泳三 Kim Young-sam · 明洞圣堂 Myeongdong Cathedral · 南营洞 Namyeong-dong · 尼古拉教堂 St. Nicholas Church ·
斯塔西 the Stasi · 昂纳克 Honecker · 库尔特·马苏尔 Kurt Masur · 齐奥塞斯库 Ceaușescu · 埃列娜 Elena ·
特凯什·拉斯洛 László Tőkés · 蒂米什瓦拉 Timișoara · 米利亚 Vasile Milea · 国家安全局 the Securitate ·
特尔戈维什泰 Târgoviște · 四通桥 Sitong Bridge · 乌鲁木齐中路 Urumqi Middle Road · 109 常务组 Group 109 ·
人民班 inminban (neighborhood watch unit) · 长马当 jangmadang (market) · 惠山 Hyesan · 新义州 Sinuiju.
