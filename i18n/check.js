/* 检查一个翻译分组: node i18n/check.js G3
 * 键是否齐全、模板字符串能否解析、代码里的变量有没有丢、HTML 标签是否一致 */
'use strict';
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const HAN = /[㐀-鿿]/;
const ALLOW_HAN = /道路以目/;

function identifiers(src) {
  const ids = new Set();
  const ast = acorn.parse(src, { ecmaVersion: 'latest' });
  (function walk(n) {
    if (!n || typeof n.type !== 'string') return;
    if (n.type === 'Identifier') ids.add(n.name);
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v);
    }
  })(ast);
  return ids;
}
const tags = (s) => (s.match(/<\/?[a-zA-Z][a-zA-Z0-9]*/g) || []).map((t) => t.toLowerCase()).sort().join(' ');

function check(group, dir) {
  dir = dir || path.join(__dirname, 'chunks');
  const items = JSON.parse(fs.readFileSync(path.join(dir, group + '.json'), 'utf8'));
  const tr = JSON.parse(fs.readFileSync(path.join(dir, group + '.en.json'), 'utf8'));
  let errors = 0, warns = 0;
  const E = (m) => { errors++; console.log('ERROR', m); };
  const W = (m) => { warns++; console.log('WARN ', m); };
  for (const it of items) {
    const t = tr[it.key];
    const tag = `[${it.where}] ${JSON.stringify(it.key).slice(0, 70)}`;
    if (typeof t !== 'string') { E(`missing translation ${tag}`); continue; }
    if (!t.trim() && it.key.trim()) { E(`empty translation ${tag}`); continue; }
    if (HAN.test(t) && !ALLOW_HAN.test(t)) W(`Chinese left in translation ${tag} → ${JSON.stringify(t).slice(0, 80)}`);
    if (it.kind === 'tpl') {
      let a, b;
      try { b = identifiers('(`' + t + '`)'); } catch (e) { E(`template does not parse ${tag}: ${e.message}`); continue; }
      a = identifiers('(`' + it.key + '`)');
      const lost = [...a].filter((x) => !b.has(x));
      if (lost.length) E(`code identifiers lost (${lost.join(', ')}) ${tag}`);
      const n1 = (it.key.match(/\$\{/g) || []).length, n2 = (t.match(/\$\{/g) || []).length;
      if (n1 !== n2) W(`\${} count ${n1} → ${n2} ${tag}`);
    }
    if (tags(it.key) !== tags(t)) W(`HTML tags differ ${tag}`);
    if (/^[^:\s]{1,6}:[^:]/.test(it.key) && !t.includes(':')) W(`label:explanation lost its colon ${tag}`);
  }
  const extra = Object.keys(tr).filter((k) => !items.some((i) => i.key === k));
  if (extra.length) W(`${extra.length} keys in translation that are not in the group (ignored)`);
  console.log(`${group}: ${items.length} keys, ${errors} errors, ${warns} warnings`);
  return errors;
}

if (require.main === module) process.exit(check(process.argv[2], process.argv[3]) ? 1 : 0);
module.exports = { check };
