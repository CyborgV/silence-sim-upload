/* 生成英文版: node i18n/build-en.js  →  en/ (与根目录同构, GitHub Pages 上是 /en/)
 *  1. 合并 i18n/chunks/G*.en.json → i18n/en.json(若有)
 *  2. JS: 用 acorn 找出含中文的字符串/模板字符串, 按 en.json 替换; 语法检查
 *  3. HTML: 使用人工翻译的 i18n/index.en.html、i18n/lab.en.html, 并核对元素 id 与中文版一致
 *  4. 其余文件(样式)原样复制
 * 需要 acorn(NODE_PATH 指向装有 acorn 的 node_modules)。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const { collect, JS_FILES } = require('./extract.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'en');
const CHUNKS = path.join(__dirname, 'chunks');
const EN_JSON = path.join(__dirname, 'en.json');

// 1. 合并翻译
let tr = fs.existsSync(EN_JSON) ? JSON.parse(fs.readFileSync(EN_JSON, 'utf8')) : {};
if (fs.existsSync(CHUNKS)) {
  for (const f of fs.readdirSync(CHUNKS).filter((f) => /^G\d+\.en\.json$/.test(f)).sort()) {
    // 分组译文只补 en.json 里还没有的键: en.json 是唯一的定稿, 在它上面的修改不会被覆盖
    for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(CHUNKS, f), 'utf8')))) if (!(k in tr)) tr[k] = v;
  }
}
const sorted = {};
for (const k of Object.keys(tr).sort()) sorted[k] = tr[k];
fs.writeFileSync(EN_JSON, JSON.stringify(sorted, null, 1) + '\n');
tr = sorted;

// 2. JS
fs.mkdirSync(OUT, { recursive: true });
const missing = [];
const used = new Set();
for (const f of JS_FILES) {
  let src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const items = collect(src, f).sort((a, b) => b.start - a.start);
  for (const it of items) {
    const t = tr[it.key];
    if (typeof t !== 'string') { missing.push(`${f}:${it.line} ${JSON.stringify(it.key).slice(0, 60)}`); continue; }
    used.add(it.key);
    const rep = it.kind === 'str' ? JSON.stringify(t) : '`' + t + '`';
    src = src.slice(0, it.start) + rep + src.slice(it.end);
  }
  acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });   // 译文不能破坏语法
  fs.writeFileSync(path.join(OUT, f), src);
}

// 3. HTML
const ids = (html) => new Set((html.match(/\sid="([^"]+)"/g) || []).map((s) => s.slice(5, -1)));
for (const [zh, en] of [['index.html', 'index.en.html'], ['lab.html', 'lab.en.html']]) {
  const srcEn = path.join(__dirname, en);
  if (!fs.existsSync(srcEn)) { console.warn(`缺少 i18n/${en}, 跳过 ${zh}`); continue; }
  const a = ids(fs.readFileSync(path.join(ROOT, zh), 'utf8')), html = fs.readFileSync(srcEn, 'utf8'), b = ids(html);
  const lost = [...a].filter((x) => !b.has(x)), extra = [...b].filter((x) => !a.has(x));
  if (lost.length || extra.length) console.warn(`${en}: id 不一致 缺少[${lost.join(',')}] 多出[${extra.join(',')}]`);
  fs.writeFileSync(path.join(OUT, zh), html);
}

// 4. 其余
for (const f of ['game.css']) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));

const unused = Object.keys(tr).filter((k) => !used.has(k)).length;
console.log(`en/: ${JS_FILES.length} JS files, ${used.size} strings translated, ${missing.length} missing, ${unused} unused entries`);
if (missing.length) { console.log(missing.slice(0, 30).join('\n')); process.exitCode = 1; }
