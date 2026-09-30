/* 打包成离线单文件: 把样式和脚本全部内联, 双击 HTML 即可在任何电脑上玩(无需服务器、无需联网)
 * 运行: node build.js
 *   → dist/道路以目.html、dist/模型实验室.html(中文)
 *   → dist/Glances-on-the-Road.html、dist/Model-Lab.html(英文, 需先 node i18n/build-en.js 生成 en/)
 * 唯一的外部资源是 Google 字体; 离线时自动退回系统字体。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const ZH = { game: '道路以目.html', lab: '模型实验室.html' };
const EN = { game: 'Glances-on-the-Road.html', lab: 'Model-Lab.html' };

// 内联脚本里出现 "</script" 会提前结束标签
const safeJs = (s) => s.replace(/<\/script/gi, '<\\/script');

function inline(dir, file) {
  const read = (f) => fs.readFileSync(path.join(dir, f), 'utf8');
  let html = read(file);
  html = html.replace(/<link rel="stylesheet" href="([^"]+\.css)">/g, (_, f) => `<style>\n${read(f)}\n</style>`);
  html = html.replace(/<script src="([^"]+\.js)"><\/script>/g, (_, f) => `<script>\n/* ---- ${f} ---- */\n${safeJs(read(f))}\n</script>`);
  const left = html.match(/<(?:script|link)[^>]+(?:src|href)="(?!https?:)[^"]+\.(?:js|css)"/g);
  if (left) throw new Error('还有未内联的本地资源: ' + left.join(', '));
  return html;
}
const write = (name, html) => { fs.writeFileSync(path.join(OUT, name), html); console.log(`dist/${name}  ${(fs.statSync(path.join(OUT, name)).size / 1024).toFixed(0)} KB`); };

fs.mkdirSync(OUT, { recursive: true });
// 中文
write(ZH.game, inline(ROOT, 'index.html').replace(/href="lab\.html"/g, `href="${ZH.lab}"`).replace(/href="en\/index\.html"/g, `href="${EN.game}"`));
write(ZH.lab, inline(ROOT, 'lab.html').replace(/href="index\.html"/g, `href="${ZH.game}"`));
// 英文
const enDir = path.join(ROOT, 'en');
if (fs.existsSync(path.join(enDir, 'index.html'))) {
  write(EN.game, inline(enDir, 'index.html').replace(/href="lab\.html"/g, `href="${EN.lab}"`).replace(/href="\.\.\/index\.html"/g, `href="${ZH.game}"`));
  write(EN.lab, inline(enDir, 'lab.html').replace(/href="index\.html"/g, `href="${EN.game}"`));
} else console.log('没有 en/, 跳过英文版(先运行 node i18n/build-en.js)');
