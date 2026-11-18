import * as m from '../docs/games.js';
let runs = 0;
for (const g of m.ORDER) { const G = m.GAMES[g];
  const combos = [m.defaults(g)];
  G.settings.forEach(s => s.opts.forEach(([v]) => combos.push({ ...m.defaults(g), [s.k]: v })));
  for (let n = G.min; n <= G.max; n++) for (const st of combos) for (let k = 0; k < 30; k++) {
    const ps = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: '名' + i }));
    const d = JSON.parse(JSON.stringify(m.deal(g, ps, st)));
    const s = JSON.stringify(d);
    if (s.includes('undefined') || s.includes('null') || s.includes('NaN')) throw new Error('bad ' + g + s.slice(0, 200));
    if (Object.keys(d.secret).length !== n || d.order.some(p => !d.secret[p].goal)) throw new Error('secret');
    if (g !== 'kessha' && d.steps.length !== n * d.laps) throw new Error('steps');
    if (g === 'mogu') { if (d.ans.agents.length !== (st.agents === '2' && n >= 7 ? 2 : 1)) throw new Error('agents'); if (st.cat !== 'rand' && d.pub.cat === undefined) throw new Error('cat'); }
    if (g === 'bottle') { const key = p => d.pub.attrs[p].join(); if (d.order.filter(p => key(p) === key(d.ans.c)).length !== 1) throw new Error('uniq');
      if (st.level === 'easy' && d.order.some(p => p !== d.ans.c && !d.ans.pos.includes(d.ans.clues[p]))) throw new Error('easy'); }
    if (g === 'kessha') { const sp = st.spy === 'on' || (st.spy === 'auto' && n >= 12); if (!!d.ans.spy !== sp) throw new Error('spy'); if (d.pub.cands.length !== Number(st.cands)) throw new Error('cands'); }
    const v = {}; m.voters(d).forEach(p => { v[p] = m.randomVote(d, p); if (!m.voteReady(d, v[p])) throw new Error('ready'); });
    const o = m.outcome(d, v, k % 7 - 1);
    if (!o.verdict || !Array.isArray(o.winners) || JSON.stringify(o).includes('undefined')) throw new Error('outcome');
    runs++;
  } }
const ps = [0, 1, 2, 3, 4, 5, 6].map(i => ({ id: 'p' + i, name: '名' + i }));
let d = m.deal('mogu', ps, { agents: '2' }), v = {};
const cits = d.order.filter(p => !d.ans.agents.includes(p));
d.order.forEach(p => v[p] = p === cits[0] ? cits[1] : cits[0]);
let o = m.outcome(d, v, -1); if (o.caught) throw new Error('split should not catch');
d.order.forEach(p => v[p] = d.ans.agents[0]); if (d.ans.agents.includes(d.order[0])) {}
v[d.ans.agents[0]] = d.order.find(p => !d.ans.agents.includes(p));
o = m.outcome(d, v, -1); if (!o.caught || !o.needGuess) throw new Error('caught');
o = m.outcome(d, v, d.pub.cands.indexOf(d.ans.word)); if (!o.hit || o.winners.length !== 2) throw new Error('hit');
o = m.outcome(d, v, (d.pub.cands.indexOf(d.ans.word) + 1) % 6); if (o.hit || o.winners.length !== 5) throw new Error('miss');
console.log('unit ok', runs, m.settingsText('mogu', {}));
