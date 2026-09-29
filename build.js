/* 打包成离线单文件: 把样式和脚本全部内联, 双击 HTML 即可在任何电脑上玩(无需服务器、无需联网)
 * 运行: node build.js   → dist/道路以目.html 与 dist/模型实验室.html
 * 唯一的外部资源是 Google 字体; 离线时自动退回系统字体。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const GAME = '道路以目.html', LAB = '模型实验室.html';

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
// 内联脚本里出现 "</script" 会提前结束标签
const safeJs = (s) => s.replace(/<\/script/gi, '<\\/script');

function inline(html) {
  html = html.replace(/<link rel="stylesheet" href="([^"]+\.css)">/g, (_, f) => `<style>\n${read(f)}\n</style>`);
  html = html.replace(/<script src="([^"]+\.js)"><\/script>/g, (_, f) => `<script>\n/* ---- ${f} ---- */\n${safeJs(read(f))}\n</script>`);
  const left = html.match(/<(?:script|link)[^>]+(?:src|href)="(?!https?:)[^"]+\.(?:js|css)"/g);
  if (left) throw new Error('还有未内联的本地资源: ' + left.join(', '));
  return html;
}

fs.mkdirSync(OUT, { recursive: true });
const game = inline(read('index.html')).replace(/href="lab\.html"/g, `href="${LAB}"`);
const lab = inline(read('lab.html')).replace(/href="index\.html"/g, `href="${GAME}"`);
fs.writeFileSync(path.join(OUT, GAME), game);
fs.writeFileSync(path.join(OUT, LAB), lab);
for (const f of [GAME, LAB]) console.log(`dist/${f}  ${(fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0)} KB`);
