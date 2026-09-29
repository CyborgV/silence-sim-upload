/* 场景叙事调校 harness: 模拟各场景的“预期玩法”, 输出检查点 */
'use strict';
const path = __dirname + '/';
const { Sim, theory } = require(path + 'model.js');
const fs = require('fs');
const src = fs.readFileSync(path + 'lab.js', 'utf8');
const SCENARIOS = eval('(' + src.match(/const SCENARIOS = \{[\s\S]*?\n\};/)[0].replace('const SCENARIOS = ', '').replace(/;$/, '') + ')');

let pass = 0, fail = 0;
const ck = (name, cond, detail) => { cond ? pass++ : fail++; console.log((cond ? '  ✓ ' : '  ✗ ') + name + (detail ? `  [${detail}]` : '')); };
const mk = (key, over) => new Sim(Object.assign({}, SCENARIOS[key].opts, over || {}));

/* ---- ② 厉王弭谤 ---- */
console.log('【② 厉王弭谤】');
{
  const sim = mk('liwang');
  let xmax = 0;
  for (let t = 0; t < 40; t++) xmax = Math.max(xmax, sim.step(10).x);
  const b1 = sim.b.reduce((s, v) => s + v, 0) / sim.o.N;
  ck('40轮小动作始终被压平 (x<0.05)', xmax < 0.05, `xmax=${xmax.toFixed(3)}`);
  ck('记忆债务显著累积 (b̄>0.04)', b1 > 0.04, `b=${b1.toFixed(3)}`);
  sim.step(80);
  for (let t = 0; t < 20; t++) sim.step(0);
  const x = sim.snapshot().x;
  ck('债务积累后 80 人行动可点火 (x>0.3)', x > 0.3, `x=${x.toFixed(3)}`);
}

/* ---- ③ 道路以目: 无预警 ---- */
console.log('【③ 道路以目·无预警】');
{
  const sim = mk('nowarn');
  let silent = true;
  for (let t = 0; t < 30; t++) if (sim.step(0).x !== 0) silent = false;
  ck('30 轮公开参与恒为 0', silent);
  const kEnd = sim.snapshot().k, kExpect = 0.02 * Math.pow(0.9, 30);
  ck('k 几何侵蚀(有限人口容差)', Math.abs(kEnd - kExpect) < 3e-3, `k=${kEnd.toFixed(5)} expect≈${kExpect.toFixed(5)}`);
  const xc1 = theory.xMinus(1, 0.02), xc2 = theory.xMinus(1, kEnd);
  ck('临界种子持续缩小', xc2 < xc1 * 0.5, `x₋ ${xc1.toFixed(4)}→${xc2.toFixed(4)}`);
}

/* ---- ④ 莱比锡 ---- */
console.log('【④ 莱比锡】');
{
  const sim = mk('leipzig');
  let preMax = 0;
  for (let w = 1; w <= 8; w++)
    for (let r = 0; r < 6; r++) preMax = Math.max(preMax, sim.step(r === 0 ? 15 : 0).x);
  ck('前 8 周被压平 (x<0.09)', preMax < 0.09, `preMax=${preMax.toFixed(3)}`);
  sim.pushEvent({ rounds: 1, vis: 1, globalScale: 1, omega: 0.6 });
  let post = 0;
  for (let t = 0; t < 30; t++) post = Math.max(post, sim.step(45).x);
  ck('录像外泄+出席潮后点火 (max x>0.35)', post > 0.35, `postMax=${post.toFixed(3)}`);
}

/* ---- ⑤ 彼得格勒 ---- */
console.log('【⑤ 彼得格勒】');
{
  const sim = mk('petrograd');
  sim.step(40);
  let d15 = 0;
  for (let t = 0; t < 28; t++) { const s = sim.step(0); if (t === 14) d15 = s.d; }
  const s = sim.snapshot();
  ck('d 渐进上升而非瞬间崩解 (t+14时 0.15<d<0.97)', d15 > 0.15 && d15 < 0.97, `d=${d15.toFixed(3)}`);
  ck('终态高参与 (x>0.8)', s.x > 0.8, `x=${s.x.toFixed(3)} d=${s.d.toFixed(3)}`);
}

/* ---- ⑥ 血腥星期日 ---- */
console.log('【⑥ 血腥星期日】');
{
  const sim = mk('bloody');
  let calmMax = 0;
  for (let t = 0; t < 12; t++) calmMax = Math.max(calmMax, sim.step(8).x);
  ck('事件前平静 (x<0.06)', calmMax < 0.06, `calmMax=${calmMax.toFixed(3)}`);
  sim.pushEvent({ rounds: 2, P: sim.o.P * 3, vis: 1 });
  let after = 0, muMax = 0;
  for (let t = 0; t < 16; t++) { const s = sim.step(8); after = Math.max(after, s.x); muMax = Math.max(muMax, s.mu.mu); }
  ck('流血后净增参与 (max x>0.15)', after > 0.15, `x=${after.toFixed(3)} μmax=${muMax.toFixed(2)}`);
}

/* ---- ⑦ 波兰戒严 ---- */
console.log('【⑦ 波兰戒严】');
{
  const run = (over) => {
    const sim = mk('martial', over);
    const xcBefore = sim.analysis().xCrit;
    for (let t = 0; t < 30; t++) sim.step(0);          // 持续拘捕 30 轮
    const xcAfter = sim.analysis().xCrit;
    for (let t = 0; t < 5; t++) sim.step(0);
    sim.step(55);                                       // 行动测试
    let xm = 0;
    for (let t = 0; t < 25; t++) xm = Math.max(xm, sim.step(0).x);
    return { xcBefore, xcAfter, xm };
  };
  const M = run({}), U = run({ targetMode: 'uniform', netDamage: 0 });
  ck('预防性拘捕抬升 x₋', M.xcAfter > M.xcBefore * 1.3, `x₋ ${M.xcBefore.toFixed(4)}→${M.xcAfter && M.xcAfter.toFixed(4)} (均匀臂 ${U.xcAfter && U.xcAfter.toFixed(4)})`);
  ck('55 人行动: 预防性臂死亡, 均匀臂点火', M.xm < 0.1 && U.xm > 0.5, `预防=${M.xm.toFixed(3)} 均匀=${U.xm.toFixed(3)}`);
}

/* ---- ⑧ 格兰诺维特阶梯 ---- */
console.log('【⑧ 格兰诺维特阶梯】');
{
  const sim = mk('granovetter');
  sim.step(4);
  for (let t = 0; t < 12; t++) sim.step(0);
  ck('4 人行动被拘平 (x<0.01)', sim.snapshot().x < 0.01, `x=${sim.snapshot().x.toFixed(3)}`);
  const sim2 = mk('granovetter');
  sim2.step(8);
  let xs = [];
  for (let t = 0; t < 45; t++) xs.push(sim2.step(0).x);
  const peak = Math.max(...xs);
  ck('8 人行动链式爬满 (峰值 x>0.9)', peak > 0.9, `peak=${peak.toFixed(3)} 轨迹=${xs.filter((_, i) => i % 10 === 9).map(v => v.toFixed(2)).join('→')}`);
}

/* ---- ⑨ 四十日纪念 ---- */
console.log('【⑨ 四十日纪念】');
{
  const run = (kernel) => {
    const sim = mk('chehlom', kernel ? { kernel } : {});
    for (let t = 0; t < 3; t++) sim.step(0);
    sim.pushEvent({ rounds: 2, P: sim.o.P * 3, vis: 1 });
    const xs = [];
    for (let t = 0; t < 30; t++) xs.push(sim.step(t === 0 ? 40 : 0).x);
    return xs;
  };
  const xs = run();
  console.log('   轨迹:', xs.map(v => v.toFixed(2)).join(' '));
  const ig = xs.findIndex((v, i) => i >= 6 && v > 0.3);
  ck('纪念核: 峰后无种子自燃 (t∈[6,20] 内 x>0.3)', ig >= 6 && ig <= 20, `t=${ig}`);
  const xe = run('exp');
  let q1 = 0; for (let i = 0; i < xe.length; i++) if (xe[i] > xe[q1]) q1 = i;
  const m2 = Math.max(...xe.slice(q1 + 2));
  ck('对照: 指数核永远沉寂 (首峰后 max≤0.05)', m2 <= 0.05, `exp max=${m2.toFixed(3)}`);
}

/* ---- ⑩ 迟滞 ---- */
console.log('【⑩ 双稳态·迟滞】');
{
  const walk = (sim, from, to, step, roundsEach) => {
    const path = [];
    const dir = Math.sign(to - from);
    for (let P = from; dir > 0 ? P <= to : P >= to; P += step * dir) {
      sim.o.P = P;
      let x = 0;
      for (let r = 0; r < roundsEach; r++) x = sim.step(0).x;
      path.push([P, x]);
    }
    return path;
  };
  const sim = mk('hysteresis');
  const down = walk(sim, 1.4, 0.6, 0.02, 25);
  const jd = down.find(([P, v]) => v > 0.5);
  ck('降压到低态消失 P_↓≈0.8 才跳升', jd && Math.abs(jd[0] - 0.8) < 0.05, `P=${jd && jd[0].toFixed(2)}`);
  const up = walk(sim, 0.6, 1.35, 0.02, 25);
  const ju = up.find(([P, v]) => v < 0.1 && P > 1.0);
  ck('升压到高态消失 P_↑≈1.25 才跌落', ju && Math.abs(ju[0] - 1.25) < 0.05, `P=${ju && ju[0].toFixed(2)}`);
  const midDown = down.find(([P]) => Math.abs(P - 0.9) < 0.011);
  const midUp = up.find(([P]) => Math.abs(P - 0.9) < 0.011);
  ck('同 P=0.9 双态 (低≈0.1 / 高≈0.76)', midDown && midUp && midDown[1] < 0.2 && midUp[1] > 0.6,
    `低支=${midDown && midDown[1].toFixed(2)} 高支=${midUp && midUp[1].toFixed(2)}`);
}

console.log(`\n场景检查: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
