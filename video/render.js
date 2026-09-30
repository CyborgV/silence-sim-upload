/* 渲染讲解视频
 *   node video/render.js <zh|en>            整条视频 → video/out/<lang>/
 *   node video/render.js <zh|en> --from 290 --to 340 --shots    只渲染一段, 每秒存一张截图(调画面用)
 *   node video/render.js <zh|en> --post     只重做字幕/配乐/封面/简介(不重新渲染画面)
 * 输出:
 *   silence-explainer-<lang>.mp4        烧录字幕 + 轻背景音, 可直接上传
 *   silence-explainer-<lang>-clean.mp4  无字幕无声, 配合 .srt 在剪映里做「文本朗读」配音
 *   silence-explainer-<lang>.srt        字幕(时间轴与画面对齐)
 *   thumbnail-<lang>.jpg                封面 1920×1080
 *   youtube-<lang>.txt                  标题、简介、章节时间戳
 * 需要: playwright(Chromium)、ffmpeg(PATH 里的, 或环境变量 FFMPEG, 或 python 包 imageio-ffmpeg)。
 * 画面用 video/scene.html 逐帧绘制; 「游戏」一段用真实的游戏页面, 以假时钟逐帧推进并截图。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');
const VS = require('./script.js');
const { BOTS } = require('../playtest.js');

const ROOT = path.join(__dirname, '..');
const FPS = 30, W = 1920, H = 1080;
const args = process.argv.slice(2);
const LANG = args[0] === 'en' ? 'en' : 'zh';
const opt = (k) => { const i = args.indexOf('--' + k); return i < 0 ? null : args[i + 1] == null || args[i + 1].startsWith('--') ? true : args[i + 1]; };
const OUT = path.join(__dirname, 'out', LANG);
const NAME = `silence-explainer-${LANG}`;
fs.mkdirSync(OUT, { recursive: true });

/* ---------- 工具 ---------- */
function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg'; } catch (e) { /* 没有就找 imageio-ffmpeg */ }
  try { return execFileSync('python3', ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim(); } catch (e) { /* 下面报错 */ }
  throw new Error('找不到 ffmpeg: 请安装, 或设置环境变量 FFMPEG');
}
const FF = ffmpegPath();
const run = (argv) => new Promise((res, rej) => {
  const p = spawn(FF, argv, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
  p.on('close', (c) => (c ? rej(new Error('ffmpeg 失败:\n' + err)) : res()));
});
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml' };
function serve() {
  return new Promise((res) => {
    const s = http.createServer((q, r) => {
      let p = decodeURIComponent(q.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(r);
    });
    s.listen(0, '127.0.0.1', () => res(s));
  });
}
const ts = (t, sep) => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`; };
const assTs = (t) => { const cs = Math.round(t * 100), h = Math.floor(cs / 360000), m = Math.floor(cs / 6000) % 60, s = Math.floor(cs / 100) % 60; return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/* ---------- 游戏画面: 真实页面 + 假时钟 ---------- */
// 在页面里注入的助手: 机器人(与 playtest.js 的"认真玩家"相同)、快进、自动做选择
const HELPER = `window.__V = (() => {
  const MOVE_TREE = ${JSON.stringify(['m_word', 'm_net', 'm_witness', 'm_talk', 'm_press', 'm_legal', 'm_mourn', 'm_sympath', 'm_names', 'm_crypto', 'm_foreign', 'm_anniv', 'm_family', 'm_barracks', 'm_courage'])};
  function tryPlay(g, id) { if (!g.hand().some((c) => c.id === id)) return false; return g.play(id); }
  const movementBot = ${BOTS.movement.good.toString()};
  const $ = (s) => document.querySelector(s);
  const G = () => window.__game();
  function pick() {
    const g = G(), cs = g.popup ? g.popup.choices : [], w = cs.findIndex((c) => c.wise), i = w >= 0 ? w : 0;
    const b = $('#ov-event.show .choice[data-i="' + i + '"]');
    if (b) b.click(); else if (g.popup) g.choose(i);
  }
  function act(g) { if (g.side === 'movement') { g.collectAll(0.85); movementBot(g); } }
  function stepOnce() {
    const g = G(); if (g.over) return;
    if (g.popup) { pick(); return; }
    act(g); if (g.popup) { pick(); return; }
    $('#btn-step').click();
  }
  const live = { round: -1, ev: 0 };
  return {
    ffTo(r) { const g = G(); for (let i = 0; i < 600 && !g.over && g.round < r; i++) stepOnce(); },
    ffEnd() { const g = G(); for (let i = 0; i < 900 && !g.over; i++) stepOnce(); return { round: g.round, win: !!(g.over && g.over.win), stars: g.over ? g.over.starCount || 0 : 0 }; },
    tick() {
      const g = G(); if (!g || g.over) return;
      if ($('#ov-event.show')) { if (++live.ev > 50) { pick(); live.ev = 0; } } else live.ev = 0;
      if (g.round !== live.round && !g.popup) { live.round = g.round; act(g); }
    },
    pick,
    // 下一局的种子: Game 构造时第一次调用 Math.random 就是取种子
    forceSeed(n) { const f = Math.random; Math.random = () => { Math.random = f; return (n + 0.5) / 1e9; }; },
  };
})();`;

function seedRandom(seed) { let s = seed >>> 0; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

async function gamePage(browser, base, seed) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: W / 1440 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('[game] ' + e.message));
  await page.addInitScript(seedRandom, seed);
  // 游戏标题用的 Google 字体改由本地提供(vendor/fonts/game/fonts.css, 可选)
  const gcss = path.join(__dirname, 'vendor', 'fonts', 'game', 'fonts.css');
  if (fs.existsSync(gcss)) {
    const css = fs.readFileSync(gcss, 'utf8').replace(/url\(([^)]+\.woff2)\)/g, (_, f) => `url(${base}/video/vendor/fonts/game/${f})`);
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
  }
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto(`${base}/${LANG === 'en' ? 'en/' : ''}index.html`);
  await page.addScriptTag({ content: HELPER });
  await page.evaluate(async () => { await document.fonts.load("900 60px 'Noto Serif SC'", '道路以目GlancesontheRoad'); await document.fonts.load("600 30px 'Noto Serif SC'", '局势分析复盘'); await document.fonts.ready; });
  await page.clock.runFor(1200);
  return { page, cdp: await ctx.newCDPSession(page) };
}

// 「游戏」一段的分镜(时间相对于这一段的开头)
// 每种语言选一个"赢得好看"的种子(旁白长短不同, 实时段的回合数也不同; 用 --probe 试出来)
const GAME_SEED = { zh: 39, en: 39 };
function gameDirector(gp, sc, gameSeed) {
  const c = sc.cues, page = gp.page;
  const click = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  const plan = [
    [0, async () => {}],                                                         // 标题画面
    [c[0].t0 + (c[0].t1 - c[0].t0) * 0.42, async () => { await click('#m-campaign'); }],   // "十一段真实的历史"
    [c[1].t0 - 0.05, async () => {                                               // 第六章, 快进到五月底, 以 2 倍速运行
      await click('.lv[data-id="seoul"]'); await page.clock.runFor(100);
      await page.evaluate((n) => window.__V.forceSeed(n), gameSeed);
      await click('#brief-start'); await page.clock.runFor(400);
      await page.evaluate(() => window.__V.ffTo(19));
      await click('.speed [data-sp="2"]'); await page.clock.runFor(100);
    }],
    [c[1].t0 + 2.2, async () => { await page.evaluate(() => { const b = document.getElementById('layer-btn'); if (!b.classList.contains('on')) b.click(); }); }],
    [c[1].t1 - 2.6, async () => { await page.evaluate(() => { if (document.querySelector('#ov-event.show')) window.__V.pick(); }); await page.keyboard.press('a'); }],
    [c[2].t0 - 0.05, async () => {                                               // 快进到结局 → 复盘
      await page.keyboard.press('Escape'); await page.clock.runFor(50);
      const r = await page.evaluate(() => window.__V.ffEnd());
      console.log(`  游戏片段(种子 ${gameSeed}): 第 ${r.round} 轮结束, ${r.win ? '胜利 ' + r.stars + ' 星' : '失败'}`);
      result = r;
      await page.clock.runFor(1300);
    }],
    [c[3].t0, async () => { await click('#end-levels'); await page.clock.runFor(50); await click('#scr-levels [data-go="title"]'); }],
  ];
  let i = 0, lastMs = 0, scrollFrom = null, result = null;
  return {
    get result() { return result; },
    async frame(lt) {
      while (i < plan.length && plan[i][0] <= lt) await plan[i++][1]();
      // 关卡列表: 慢慢往下滚, 露出全部十二段
      if (i === 2) {
        const t0 = plan[1][0], t1 = plan[2][0];
        if (scrollFrom == null) scrollFrom = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
        const u = Math.min(1, Math.max(0, (lt - t0 - 1.2) / Math.max(1, t1 - t0 - 2)));
        await page.evaluate((y) => window.scrollTo(0, y), scrollFrom * (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2));
      }
      if (i >= 3 && i < 6) await page.evaluate(() => window.__V.tick());
      const ms = Math.round(lt * 1000);
      if (ms > lastMs) { await page.clock.runFor(ms - lastMs); lastMs = ms; }
      const fade = Math.min(1, lt / 0.35, (sc.dur - lt) / 0.3);
      await page.evaluate((f) => { document.documentElement.style.filter = f < 1 ? `brightness(${Math.max(0, f).toFixed(3)})` : ''; }, fade);
    },
  };
}

/* ---------- 渲染画面 ---------- */
async function renderVideo() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const sctx = await browser.newContext({ viewport: { width: W, height: H } });
  const sp = await sctx.newPage();
  sp.on('pageerror', (e) => console.error('[scene] ' + e.message));
  await sp.goto(`${base}/video/scene.html?lang=${LANG}`);
  await sp.evaluate(() => window.VIDEO.ready());
  const info = await sp.evaluate(() => window.VIDEO.init());
  const scdp = await sctx.newCDPSession(sp);
  // 游戏页面的 CSS 视口是 1440×810(界面大一些, 看得清), 截图时按 4/3 倍重新光栅化成 1920×1080
  const GAME_CLIP = { x: 0, y: 0, width: 1440, height: 810, scale: W / 1440 };
  const shot = async (cdp, clip) => Buffer.from((await cdp.send('Page.captureScreenshot', Object.assign({ format: 'jpeg', quality: 94, optimizeForSpeed: true }, clip ? { clip } : {}))).data, 'base64');

  const total = Math.round(info.total * FPS);
  const from = opt('from') ? Math.round(+opt('from') * FPS) : 0, to = opt('to') ? Math.min(total, Math.round(+opt('to') * FPS)) : total;
  const partial = from > 0 || to < total;
  const outFile = path.join(OUT, partial ? `part-${from}-${to}.mp4` : `${NAME}-clean.mp4`);
  const shotsDir = opt('shots') ? path.join(OUT, 'shots') : null;
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
  console.log(`${LANG}: ${info.total.toFixed(1)} 秒, 帧 ${from}–${to} / ${total} → ${path.relative(ROOT, outFile)}`);

  const ff = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error('ffmpeg 退出码 ' + c)) : res())));
  const write = (buf) => new Promise((res) => { if (ff.stdin.write(buf)) res(); else ff.stdin.once('drain', res); });

  const TL = VS.timeline(LANG);
  let gp = null, dir = null;
  const t0 = Date.now();
  for (let fr = 0; fr < to; fr++) {
    const t = fr / FPS, sc = TL.scenes.find((s) => t >= s.start && t < s.start + s.dur) || TL.scenes[TL.scenes.length - 1];
    const keep = fr >= from;
    let buf = null;
    if (sc.id === 'game') {
      if (!dir) { gp = await gamePage(browser, base, 20260930); dir = gameDirector(gp, sc, +(opt('seed') || GAME_SEED[LANG])); }
      await dir.frame(t - sc.start);
      if (keep) buf = await shot(gp.cdp, GAME_CLIP);
    } else {
      await sp.evaluate((tt) => window.VIDEO.frame(tt), t);
      if (keep) buf = await shot(scdp);
    }
    if (!buf) continue;
    await write(buf);
    if (shotsDir && fr % FPS === 0) fs.writeFileSync(path.join(shotsDir, `${sc.id}-${String(fr).padStart(5, '0')}.jpg`), buf);
    if (fr % (FPS * 10) === 0) {
      const done = (fr - from + 1) / (to - from), el = (Date.now() - t0) / 1000;
      console.log(`  ${mmss(t)}  ${sc.id.padEnd(10)} ${(done * 100).toFixed(0)}%  已用 ${el.toFixed(0)}s  剩余约 ${(el / done - el).toFixed(0)}s`);
    }
  }
  ff.stdin.end();
  await ffDone;
  await browser.close();
  server.close();
  console.log(`画面完成: ${((Date.now() - t0) / 60000).toFixed(1)} 分钟`);
  return { total: info.total, partial };
}

/* ---------- 字幕、配乐、封面、简介 ---------- */
function writeCaptions(TL) {
  const srt = TL.cues.map((c, i) => `${i + 1}\n${ts(c.start, ',')} --> ${ts(c.end, ',')}\n${c.text}\n`).join('\n');
  fs.writeFileSync(path.join(OUT, `${NAME}.srt`), srt);
  const font = LANG === 'zh' ? 'WenQuanYi Zen Hei' : 'Liberation Sans', size = LANG === 'zh' ? 50 : 48;
  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},${size},&H00F2EDE8,&H00F2EDE8,&H60000000,&H00000000,0,0,0,0,100,100,${LANG === 'zh' ? 2 : 0},0,3,14,0,2,220,220,46,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${TL.cues.map((c) => `Dialogue: 0,${assTs(c.start)},${assTs(c.end)},Default,,0,0,0,,${c.text.replace(/\n/g, '\\N')}`).join('\n')}
`;
  const assFile = path.join(OUT, `${NAME}.ass`);
  fs.writeFileSync(assFile, ass);
  return assFile;
}

// 轻背景音: A 小调的慢铺底 + 一点粉红噪声, 很小声
function ambient(dur) {
  const part = (f, a, lfo, ph) => `${a}*sin(2*PI*${f}*t)*(0.55+0.45*sin(2*PI*${lfo}*t+${ph}))`;
  const expr = [part(110, 0.05, 0.043, 0), part(110.35, 0.03, 0.031, 1.3), part(164.81, 0.032, 0.037, 2.1), part(220, 0.022, 0.029, 0.7), part(261.63, 0.016, 0.021, 2.9), part(329.63, 0.01, 0.017, 1.9)].join('+');
  return `aevalsrc='${expr}':s=48000:d=${dur.toFixed(2)},lowpass=f=1200,aformat=channel_layouts=stereo[a0];` +
    `anoisesrc=color=pink:amplitude=0.012:d=${dur.toFixed(2)}:r=48000,lowpass=f=500,aformat=channel_layouts=stereo[a1];` +
    `[a0][a1]amix=inputs=2:normalize=0,afade=t=in:d=3,afade=t=out:st=${(dur - 5).toFixed(2)}:d=5,volume=0.9[aout]`;
}

async function post(total) {
  const TL = VS.timeline(LANG);
  const assFile = writeCaptions(TL);
  const clean = path.join(OUT, `${NAME}-clean.mp4`);
  if (!fs.existsSync(clean)) throw new Error('先渲染画面: node video/render.js ' + LANG);
  const esc = (p) => p.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
  await run(['-y', '-i', clean, '-filter_complex', `[0:v]ass='${esc(assFile)}'[v];${ambient(total)}`, '-map', '[v]', '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', path.join(OUT, `${NAME}.mp4`)]);
  console.log(`字幕版: ${path.relative(ROOT, path.join(OUT, NAME + '.mp4'))}`);
  writeMeta(TL);
}

async function thumbnail() {
  const server = await serve();
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: W, height: H } });
  await p.goto(`http://127.0.0.1:${server.address().port}/video/scene.html?lang=${LANG}`);
  await p.evaluate(() => window.VIDEO.ready());
  await p.evaluate(() => { window.VIDEO.init(); window.VIDEO.thumb(); });
  await p.screenshot({ path: path.join(OUT, `thumbnail-${LANG}.jpg`), type: 'jpeg', quality: 92 });
  await browser.close(); server.close();
  console.log(`封面: ${path.relative(ROOT, path.join(OUT, `thumbnail-${LANG}.jpg`))}`);
}

// YouTube 标题、简介与章节(章节时间来自画面时间轴; 太短的场景并入前一章)
function writeMeta(TL) {
  const CH = {
    hook: ['操场上的二十一个人', 'The twenty-first student'], cost: ['站出来的代价', 'The cost of standing up'],
    reaction: ['临界点', 'The tipping point'], memory: ['积怨:看不见的变化', 'Grievance: the invisible shift'],
    bucharest: ['布加勒斯特,1989', 'Bucharest, 1989'], twolayer: ['执行命令的人也在看', 'The soldiers are watching too'],
    info: ['审查与白纸', 'Censorship and the blank page'], game: ['游戏《道路以目》', 'The game'],
  };
  const li = LANG === 'zh' ? 0 : 1;
  const chapters = TL.scenes.filter((s) => CH[s.id]).map((s) => `${mmss(s.id === 'hook' ? 0 : s.start)} ${CH[s.id][li]}`);
  const zh = `标题(建议):
沉默为什么会突然崩塌?一个关于恐惧与集体行动的数学模型|道路以目

简介:
二十个人站出来,会被一个个带走;二十一个人站出来,三分钟后站出来的是全校。只差一个人,结局完全不同。
这支视频用一个很简单的模型讲清楚:为什么高压下的沉默看起来稳如磐石,却会在某一天突然崩塌——以及为什么没有人能提前看见它。

${chapters.join('\n')}

模型要点:
· 代价 c(x) = P·min(1, k/x):站出来的人越多,同样的警力摊得越薄
· 反应函数 F(x) = 1 − G(c(x)),不动点 F(x) = x;中间那个不稳定的不动点就是临界点
· 均匀分布下临界点 x₋ = (1 − √(1 − 4Pk))/2,展开系数是卡塔兰数
· 积怨 b 不让人上街,却悄悄压低临界点;执行者的动摇让 k 变小;审查抬高临界点

免费游戏《道路以目》(中文 / English,浏览器直接玩):[链接]
理论:《道路以目——沉默相变模型》

说明:视频中的历史画面由游戏引擎模拟,用来说明模型的机制,不是对历史的精确重现;人数等数值只是示意。

#数学 #博弈论 #集体行动 #社会科学 #独立游戏
`;
  const en = `Title (suggested):
Why Silence Collapses All at Once — The Math of Fear and Collective Action

Description:
If twenty students step forward, they are taken away one by one. If twenty-one step forward, three minutes later it is the whole school. One person apart — completely different endings.
This video walks through a simple model of why silence under repression looks rock-solid, then collapses in a day — and why no one can see it coming.

${chapters.join('\n')}

The model in brief:
• Cost c(x) = P·min(1, k/x): the more people stand up, the thinner the same police force is spread
• Reaction function F(x) = 1 − G(c(x)); fixed points F(x) = x — the unstable one in the middle is the tipping point
• With uniform tolerances the tipping point is x₋ = (1 − √(1 − 4Pk))/2; its series coefficients are the Catalan numbers
• Grievance b doesn't send anyone into the street, but quietly lowers the tipping point; wavering enforcers shrink k; censorship raises the tipping point

Play the free game "Glances on the Road" (English / 中文, runs in your browser): [link]
Theory: "Glances on the Road: A Phase-Transition Model of Silence"

Note: the historical scenes are simulated in the game engine to illustrate the model's mechanics. They are not precise reconstructions of history, and the numbers are illustrative.

#math #gametheory #collectiveaction #socialscience #indiegame
`;
  fs.writeFileSync(path.join(OUT, `youtube-${LANG}.txt`), LANG === 'zh' ? zh : en);
  console.log(`简介: ${path.relative(ROOT, path.join(OUT, `youtube-${LANG}.txt`))}`);
}

// 只跑「游戏」一段的分镜, 不截图, 看这个种子的结局: node video/render.js zh --probe 39,45,24
async function probe(seeds) {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const sc = VS.timeline(LANG).scenes.find((s) => s.id === 'game');
  for (const seed of seeds) {
    const gp = await gamePage(browser, base, 20260930), dir = gameDirector(gp, sc, seed);
    for (let fr = 0; fr < Math.round(sc.dur * FPS); fr++) await dir.frame(fr / FPS);
    await gp.page.context().close();
  }
  await browser.close(); server.close();
}

(async () => {
  const total = VS.timeline(LANG).total;
  if (opt('probe')) { await probe(String(opt('probe')).split(',').map(Number)); return; }
  if (opt('post')) { await post(total); await thumbnail(); return; }
  const r = await renderVideo();
  if (!r.partial) { await post(r.total); await thumbnail(); }
})().catch((e) => { console.error(e); process.exit(1); });
