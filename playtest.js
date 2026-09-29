/* 关卡平衡测试: 用几种机器人策略无头跑每一关, 统计胜率
 * 运行: node playtest.js [关卡id] [局数]
 * 机器人只使用玩家能看到的读数(readout), 不偷看真实参数。
 */
'use strict';
global.SilenceSim = require('./model.js');
const { Game, CARDS } = require('./engine.js');
const { LEVELS } = require('./levels.js');

const SEED = { rally: 0.015, march: 0.04, mobilize: 0.03, strike: 0.08, prayer: 0.022, blankpaper: 0.035, hunger: 0.006, goddess: 0.03, t_small: 0.01, t_big: 0.025 };

function tryPlay(g, id) {
  if (!g.hand().some(c => c.id === id)) return false;
  return g.play(id);
}

/* ---------- 行动方: 看读数行事的"认真玩家" ---------- */
// 攒资源, 估计火候够了再一次性全押; 平时只打便宜的铺垫牌并留足储备
function movementBot(g) {
  const pushCards = ['strike', 'blankpaper', 'march', 'mobilize', 'prayer', 'goddess', 'rally', 't_big'];
  for (let guard = 0; guard < 8; guard++) {
    const r = g.readout(), x = g.x;
    // 1) 能否一次凑够临界点?
    let ap = g.me.ap, total = g.seedNext / g.N; const plan = [];
    for (const id of pushCards) {
      const c = g.hand().find(h => h.id === id); if (!c) continue;
      const cs = g.cardState(c); if (!cs.cond || cs.cd > 0 || cs.blocked) continue;
      if (ap >= cs.cost) { ap -= cs.cost; total += (SEED[id] || 0.02) * (id === 'prayer' && g.isMonday() ? 1 : 1); plan.push(id); }
    }
    const tipOk = r.tip.kind === 'tinder' || (r.tip.kind === 'est' && r.tip.est * 1.1 < x + total);
    if (plan.length && tipOk && g.L.id !== 'pyongyang') { for (const id of plan) tryPlay(g, id); break; }
    // 2) 铺垫 (保留储备, 除非资源满了)
    const reserve = g.me.ap >= g.apCap - 0.05 ? 0 : 3;
    const cheap = (id) => { const c = g.hand().find(h => h.id === id); return c && g.me.ap - g.cardCost(c) >= reserve && tryPlay(g, id); };
    const played =
      (g.L.id === 'tutorial' && tryPlay(g, 't_big')) ||
      (g.exposure >= 40 && tryPlay(g, 'hide')) ||
      (g.exposure < 55 && tryPlay(g, 'usb')) ||
      (g.exposure < 50 && tryPlay(g, 'bribe')) ||
      (g.exposure < 45 && tryPlay(g, 'market')) ||
      (g.L.id !== 'pyongyang' && g.L.id !== 'baizhi' && tryPlay(g, 'banner')) ||
      (g.L.id === 'baizhi' && g.round >= 1 && tryPlay(g, 'banner')) ||
      tryPlay(g, 'blockade') ||
      (x > 0.03 && tryPlay(g, 'fraternize')) ||
      (x > 0.05 && tryPlay(g, 'hunger')) ||
      (g.pol.info === 'blackout' && r.mood.shown > 0.25 && cheap('leak')) ||
      (g.pol.info !== 'open' && cheap('samizdat')) ||
      (g.sim.R > 0.01 && cheap('memorial')) ||
      cheap('cassette') ||
      cheap('network') ||
      (g.sim.R > 0.03 && cheap('legal')) ||
      (g.isMonday() && tryPlay(g, 'prayer'));
    if (!played) break;
  }
}

/* ---------- 朝廷: 克制的统治者 ---------- */
function wiseRegimeBot(g) {
  const r = g.readout(), x = g.x;
  const setP = (k, v) => { if (g.pol[k] !== v) g.setPolicy(k, v); };
  if (g.round % 8 === 1) tryPlay(g, 'informants');
  if (r.army.level >= 2) tryPlay(g, 'bonus');
  if (r.mood.shown > 0.3) { tryPlay(g, 'dialogue') || tryPlay(g, 'subsidy'); }
  if (x >= 0.03) { setP('police', g.policyAllowed('police', 'surge') ? 'surge' : 'normal'); }
  else if (x < 0.01) setP('police', 'normal');
  if (x >= 0.05) setP('enforce', 'harsh');
  else if (r.legit.level >= 1) setP('enforce', g.pol.enforce === 'terror' ? 'harsh' : 'normal');
  if (x < 0.02) { setP('info', 'open'); setP('target', g.sim.net ? 'organizer' : 'uniform'); setP('release', 'normal'); }
  if (x > 0.25) tryPlay(g, 'amnesty');
}

/* ---------- 朝廷: 铁腕 ---------- */
function terrorBot(g) {
  const setP = (k, v) => { if (g.pol[k] !== v) g.setPolicy(k, v); };
  setP('enforce', 'terror'); setP('info', 'blackout');
  setP('police', g.policyAllowed('police', 'martial') ? 'martial' : 'surge');
  if (g.x > 0.02) tryPlay(g, 'crackdown');
  tryPlay(g, 'informants'); tryPlay(g, 'editorial');
  if (g.readout().army.level >= 2) tryPlay(g, 'bonus');
}

function idleBot() {}

const BOTS = {
  movement: { good: movementBot, idle: idleBot },
  regime: { wise: wiseRegimeBot, terror: terrorBot, idle: idleBot },
};

function runOne(L, bot, seed, choicePolicy) {
  const g = new Game(L, { seed, seedOffset: seed });
  let guard = 0;
  while (!g.over && guard++ < 400) {
    if (g.popup) { const n = g.popup.choices.length; g.choose(choicePolicy === 'last' ? n - 1 : 0); continue; }
    bot(g);
    if (g.popup) continue;
    g.step();
  }
  return g;
}

function main() {
  const only = process.argv[2];
  const runs = +(process.argv[3] || 12);
  const rows = [];
  for (const L of LEVELS) {
    if (only && only !== 'all' && L.id !== only) continue;
    const bots = BOTS[L.side];
    for (const [name, bot] of Object.entries(bots)) {
      let wins = 0, stars = 0, rounds = 0;
      const keys = {};
      for (let s = 1; s <= runs; s++) {
        const g = runOne(L, bot, s * 7919, name === 'idle' ? 'last' : 'first');
        if (g.over.win) { wins++; stars += g.over.starCount; }
        rounds += g.round;
        keys[g.over.key] = (keys[g.over.key] || 0) + 1;
      }
      rows.push(`${L.id.padEnd(10)} ${name.padEnd(7)} 胜率 ${(wins / runs * 100).toFixed(0).padStart(3)}%  平均星 ${(wins ? stars / wins : 0).toFixed(1)}  平均轮 ${(rounds / runs).toFixed(0).padStart(3)}  结局 ${JSON.stringify(keys)}`);
      console.log(rows[rows.length - 1]);
    }
  }
}
if (require.main === module) main();
module.exports = { runOne, BOTS };
