/* 抽取源码里所有含中文的字符串字面量与模板字符串, 供翻译
 * 用法: node i18n/extract.js  → i18n/strings.json (键 = 源码里的原文; 模板字符串保留 ${...} 原样)
 * 需要 acorn: 在任意目录 npm install acorn, 用 NODE_PATH 指过去。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const ROOT = path.join(__dirname, '..');
const JS_FILES = ['engine.js', 'app.js', 'levels.js', 'timelines.js', 'city.js', 'model.js', 'lab.js'];
const CJK = /[　-〿㐀-鿿＀-￯‘-‟…·]/;
const HAS_HAN = /[㐀-鿿　-〿！-～]/;

function collect(src, file) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script', locations: true });
  const out = [];
  (function walk(node, parent) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'TemplateLiteral') {
      const raw = src.slice(node.start + 1, node.end - 1);
      if (HAS_HAN.test(raw)) { out.push({ kind: 'tpl', key: raw, start: node.start, end: node.end, line: node.loc.start.line, file }); return; }
    }
    if (node.type === 'Literal' && typeof node.value === 'string' && HAS_HAN.test(node.value)) {
      // 'use strict' 之类的指令不会含中文; 对象键里的中文也一并处理
      out.push({ kind: 'str', key: node.value, start: node.start, end: node.end, line: node.loc.start.line, file });
      return;
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'start' || k === 'end') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach((c) => walk(c, node));
      else if (v && typeof v.type === 'string') walk(v, node);
    }
  })(ast, null);
  return out;
}

function extractAll() {
  const all = [];
  for (const f of JS_FILES) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const e of collect(src, f)) all.push(e);
  }
  return all;
}

if (require.main === module) {
  const all = extractAll();
  const map = {};
  for (const e of all) {
    if (!map[e.key]) map[e.key] = { kind: e.kind, where: [] };
    map[e.key].where.push(`${e.file}:${e.line}`);
  }
  fs.writeFileSync(path.join(__dirname, 'strings.json'), JSON.stringify(map, null, 1));
  // --missing: 把 en.json 里还没有译文的键写成一个待翻译分组 i18n/chunks/G99.json
  if (process.argv.includes('--missing')) {
    const en = fs.existsSync(path.join(__dirname, 'en.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'en.json'), 'utf8')) : {};
    const todo = Object.keys(map).filter((k) => !(k in en)).map((k) => ({ key: k, kind: map[k].kind, where: map[k].where[0] }));
    fs.mkdirSync(path.join(__dirname, 'chunks'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, 'chunks', 'G99.json'), JSON.stringify(todo, null, 1));
    console.log('untranslated keys →', todo.length, 'i18n/chunks/G99.json');
  }
  const keys = Object.keys(map);
  const chars = keys.reduce((s, k) => s + k.length, 0);
  const byFile = {};
  for (const e of all) byFile[e.file] = (byFile[e.file] || 0) + 1;
  console.log('unique keys', keys.length, 'total chars', chars, byFile);
}
module.exports = { collect, extractAll, JS_FILES, HAS_HAN };
