import { GAMES, ORDER, SEATS, DRINKS, COATS, SROLE, TALK, defaults, settingsText, deal, outcome, voters, voteReady, randomVote } from './games.js';
import { makeStore } from './store.js';
import { firebaseConfig } from './config.js';

const $view = document.getElementById('view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const rid = n => Array.from({ length: n }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
const LOCAL = new URLSearchParams(location.search).has('local');

let store = null, me = '', code = '', room = null, loaded = false, unwatch = null, round = -1;
const ui = { secret: true, rules: false, name: '', codeIn: '', err: '' };

/* ---------- 自分の端末の番号 ---------- */
function myId() {
  // お試しモードではタブごとに別人として扱う。本番では、読み込み直しても同じ人のままにする。
  let box = null;
  try { box = store.mode === 'online' ? localStorage : sessionStorage; } catch (e) { /* 保存できない端末 */ }
  try { const v = box && box.getItem('sakaba-me'); if (v) return v; } catch (e) { /* 同上 */ }
  const v = 'p' + rid(8).toLowerCase();
  try { if (box) box.setItem('sakaba-me', v); } catch (e) { /* 同上 */ }
  return v;
}
function parseCode() {
  const h = (location.hash || '').match(/^#r-([A-Za-z]{4})$/);
  return h ? h[1].toUpperCase() : '';
}
function enter(c) {
  if (unwatch) { unwatch(); unwatch = null; }
  code = c; room = null; loaded = false; ui.err = '';
  if (c) unwatch = store.watch('rooms/' + c, v => {
    // 新しい回が始まったら、役の紙を開いた状態から見せる
    const r = (v && v.meta && v.meta.round) || 0;
    if (r !== round) { round = r; ui.secret = true; ui.rules = false; }
    room = v; loaded = true; render();
  }, () => { loaded = true; ui.err = '部屋のデータを読めませんでした。データベースのルールを確認してください。'; render(); });
  render();
}

/* ---------- 部屋の中身 ---------- */
const meta = () => (room && room.meta) || {};
const isHost = () => meta().host === me;
const D = () => room && room.deal;
const path = sub => 'rooms/' + code + (sub ? '/' + sub : '');
function players() {
  return Object.entries((room && room.players) || {}).map(([id, p]) => ({ id, name: p.name, at: p.at || 0, bot: !!p.bot })).sort((a, b) => a.at - b.at);
}
const nm = pid => esc((D() && D().names[pid]) || (room.players && room.players[pid] && room.players[pid].name) || '？');
const isBot = pid => !!(room.players && room.players[pid] && room.players[pid].bot);
const settingsOf = g => Object.assign(defaults(g), (meta().settings || {})[g] || {});

/* ---------- 部品 ---------- */
function rulesHtml(g, open = true) {
  const G = GAMES[g];
  return `<div class="rules">
    <p class="short">${esc(G.short)}</p>
    ${open ? `<ol class="how">${G.how.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
    <p class="ex">${esc(G.example)}</p>
    <p class="winrule"><b>勝ち方</b>${esc(G.win)}</p>` : ''}
  </div>`;
}
function paper(s) {
  return `<div class="paper"><span class="side">あなたの役</span>
    <p class="role">${esc(s.role)}</p>
    <p class="goal"><b>目的</b>${esc(s.goal)}</p>
    ${(s.lines || []).map(l => `<p>${esc(l)}</p>`).join('')}
    ${s.small ? `<small>${esc(s.small)}</small>` : ''}</div>`;
}
function people(act, sel, skip) {
  return `<div class="people">${D().order.filter(p => p !== skip).map(p => `<button data-act="${act}" data-p="${p}" aria-pressed="${sel === p}">${nm(p)}</button>`).join('')}</div>`;
}
function qrSvg(url) {
  try { const q = window.qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag(5, 10); } catch (e) { return ''; }
}
const errHtml = () => ui.err ? `<p class="err" role="alert">${esc(ui.err)}</p>` : '';
const modeHtml = () => !store ? '' : store.failed
  ? '<p class="err">接続先につながりませんでした。いまは、この端末のタブ同士だけがつながる「お試しモード」です。</p>'
  : store.mode === 'local' ? '<p class="note">「お試しモード」です。この端末のタブ同士だけがつながります。「お試し用の参加者」を足すと、1人で流れを確かめられます。</p>' : '';
function now(text, sub) {
  return `<div class="now"><span>いまやること</span><p>${text}</p>${sub ? `<small>${sub}</small>` : ''}</div>`;
}
function fit(g, n) {
  const G = GAMES[g];
  return n < G.min ? { ok: false, t: `あと${G.min - n}人` } : n > G.max ? { ok: false, t: `${G.max}人まで` } : { ok: true, t: '遊べます' };
}

/* ---------- 画面：入口 ---------- */
function viewHome() {
  return `<div class="hero"><h1>酒場の<br>事件簿</h1><p class="lead">飲みの席の、正体隠しゲーム。幹事が部屋を作り、みんなはQRを読むだけ。自分のスマホに、自分だけの秘密の役が届きます。</p></div>
  ${errHtml()}${modeHtml()}
  <button class="go" data-act="create">部屋を作る（幹事）</button>
  <div class="sec"><h3>部屋番号で参加する</h3>
    <div class="inline"><input id="code-in" data-bind="codeIn" type="text" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="例：KMTR" value="${esc(ui.codeIn)}" aria-label="部屋番号"><button class="ghost" data-act="gocode">参加する</button></div></div>
  <div class="sec"><h3>遊べる演目</h3><div class="cards">${ORDER.map(id => `<div class="gcard"><b>${GAMES[id].name}</b><i>${GAMES[id].people}・${GAMES[id].mins}</i><p>${esc(GAMES[id].short)}</p></div>`).join('')}</div></div>`;
}
function viewJoin() {
  const mid = meta().phase && meta().phase !== 'lobby';
  return `<div><h2>部屋 ${code} に参加</h2><p class="lead">みんなに呼ばれている名前を入れてください。</p></div>
  ${errHtml()}
  <input id="name-in" data-bind="name" type="text" maxlength="12" autocomplete="off" placeholder="名前" value="${esc(ui.name)}" aria-label="名前">
  <button class="go" data-act="join">参加する</button>
  ${mid ? '<p class="note">いまゲームの途中です。次の回から参加できます。</p>' : ''}`;
}

/* ---------- 画面：待合室 ---------- */
function scoreboard() {
  const sc = room.scores || {}, ps = players().filter(p => sc[p.id]);
  if (!ps.length) return '';
  ps.sort((a, b) => sc[b.id] - sc[a.id]);
  const top = sc[ps[0].id];
  return `<div class="sec"><h3>これまでの勝ち数</h3><ol class="score">${ps.map(p => `<li class="${sc[p.id] === top ? 'top' : ''}"><span>${esc(p.name)}</span><b>${sc[p.id]}</b></li>`).join('')}</ol></div>`;
}
function viewLobby() {
  const ps = players(), n = ps.length, host = isHost(), g = meta().game || '';
  const list = `<div class="sec"><h3>参加者 ${n}人</h3><div class="chips">${ps.map(p => `<span class="chip${p.id === me ? ' me' : ''}">${esc(p.name)}${p.id === meta().host ? '<i>幹事</i>' : ''}${host && p.id !== me ? `<button data-act="kick" data-p="${p.id}" aria-label="${esc(p.name)}さんを外す">×</button>` : ''}</span>`).join('')}</div></div>`;
  if (!host) {
    return `<div><h2>まもなく始まります</h2><p class="lead">幹事が始めるのを待っています。そのあいだに遊び方をどうぞ。</p></div>${errHtml()}
      ${g ? `<div class="sec"><h3>今夜の演目</h3><p class="gname">${GAMES[g].name}</p>${rulesHtml(g)}<p class="note">${esc(settingsText(g, settingsOf(g)))}</p></div>` : '<p class="note">幹事が演目を選んでいます。</p>'}
      ${list}${scoreboard()}`;
  }
  const url = location.origin + location.pathname + '#r-' + code;
  const online = store.mode === 'online';
  let h = `<div class="invite">${online ? `<div class="qr">${qrSvg(url)}</div>` : ''}<div><p class="lead">QRを読むか、部屋番号を入れて参加</p><p class="code">${code}</p></div></div>
    ${errHtml()}${modeHtml()}${list}
    ${!online ? '<button class="ghost" data-act="addbot">お試し用の参加者を1人足す</button>' : ''}
    <div class="sec"><h3>演目を選ぶ</h3><div class="cards">${ORDER.map(id => { const f = fit(id, n); return `<button class="gcard${f.ok ? '' : ' off'}" data-act="game" data-id="${id}" aria-pressed="${g === id}"><b>${GAMES[id].name}</b><i>${GAMES[id].people}・${GAMES[id].mins}</i><p>${esc(GAMES[id].short)}</p><em class="${f.ok ? 'ok' : ''}">${f.t}</em></button>`; }).join('')}</div></div>`;
  if (g) {
    const s = settingsOf(g), f = fit(g, n);
    h += `<div class="sec"><h3>${GAMES[g].name}の遊び方</h3>${rulesHtml(g)}</div>
      <div class="sec"><h3>設定</h3>${GAMES[g].settings.map(st => `<div class="set"><span>${esc(st.label)}</span><div class="seg">${st.opts.map(([v, l]) => `<button data-act="set" data-k="${st.k}" data-v="${v}" aria-pressed="${s[st.k] === v}">${esc(l)}</button>`).join('')}</div></div>`).join('')}</div>
      <button class="go" data-act="start" ${f.ok ? '' : 'disabled'}>${GAMES[g].name}を始める</button>
      ${f.ok ? '' : `<p class="note">${GAMES[g].name}は${GAMES[g].people}で遊びます（いま${n}人）。</p>`}`;
  } else h += '<p class="note">演目を選ぶと、遊び方と設定が出ます。</p>';
  return h + scoreboard();
}

/* ---------- 画面：ゲーム中 ---------- */
function timerHtml() {
  const d = D(); if (!d.time) return '';
  const end = meta().timerEnd || 0, left = end ? Math.max(0, Math.ceil((end - Date.now()) / 1000)) : d.time;
  return `<div class="timer${end && left === 0 ? ' done' : ''}"><output id="t-out">${mmss(left)}</output>
    ${isHost() ? `<button class="ghost" data-act="timer">${end ? (left === 0 ? 'もう一度' : '止める') : 'タイマー開始'}</button>` : `<span class="lead">${end ? (left === 0 ? '時間です' : '') : '幹事が開始します'}</span>`}</div>`;
}
function publicInfo() {
  const d = D();
  if (d.game === 'mogu') return `<div class="sec"><h3>合言葉は、この6つのどれか（${esc(d.pub.cat)}）</h3><div class="words">${d.pub.cands.map(w => `<span>${esc(w)}</span>`).join('')}</div></div>`;
  if (d.game === 'bottle') return `<div class="sec"><h3>事件の夜、みんなはこうだった</h3><p class="lead">店の棚から、${esc(d.pub.bottle)}が消えました。</p><div class="tablewrap"><table><thead><tr><th>名前</th><th>席</th><th>お酒</th><th>上着</th></tr></thead><tbody>
    ${d.order.map(p => `<tr${p === me ? ' class="mine"' : ''}><td>${nm(p)}</td><td>${SEATS[d.pub.attrs[p][0]]}</td><td>${DRINKS[d.pub.attrs[p][1]]}</td><td>${COATS[d.pub.attrs[p][2]]}</td></tr>`).join('')}</tbody></table></div></div>`;
  if (d.game === 'kessha') return `<p class="lead">月の会 ${d.pub.nm}人、星の会 ${d.pub.ns}人${d.pub.hasSpy ? '、密偵 1人' : ''}。お開きの前に答え合わせをします。</p>`;
  return `<div class="sec"><h3>出席者</h3><div class="tablewrap"><table><tbody>${d.order.map(p => `<tr${p === me ? ' class="mine"' : ''}><td>${nm(p)}</td><td>${esc(d.pub.titles[p])}</td></tr>`).join('')}</tbody></table></div></div>`;
}
function secretBlock() {
  const d = D();
  if (!d.order.includes(me)) return '<p class="note">この回は見学です。次の回から役が届きます。</p>';
  return ui.secret
    ? `${paper(d.secret[me])}<button class="ghost" data-act="hide">役を隠す</button>`
    : '<button class="ghost reveal" data-act="show">自分の役を見る</button>';
}
function viewPlay() {
  const d = D(), host = isHost(), step = meta().step || 0, steps = d.steps || [];
  let top = '';
  if (step < steps.length) {
    const s = steps[step], mine = s.who === me, can = mine || host || isBot(s.who);
    top = `<div class="turn${mine ? ' mine' : ''}"><span>${d.laps > 1 ? `${s.lap}周目・` : ''}${step + 1} / ${steps.length}</span>
      <p class="who">${mine ? 'あなたの番です' : `${nm(s.who)}さんの番`}</p><p>${esc(d.say)}</p>
      ${can ? `<button class="go" data-act="nextturn">${mine ? '言い終わった' : '次の人へ'}</button>` : '<small>言い終わったら、本人がボタンを押します</small>'}</div>`;
  } else {
    top = now(esc(TALK[d.game]), host ? '' : (d.game === 'kessha' ? '答え合わせは幹事が始めます' : '投票は幹事が始めます')) + timerHtml()
      + (host ? `<button class="go" data-act="tovote">${d.game === 'kessha' ? '答え合わせを始める' : '投票を始める'}</button>` : '');
  }
  return `<div class="gtitle"><h2>${GAMES[d.game].name}</h2><button class="link" data-act="rules">${ui.rules ? '遊び方を閉じる' : '遊び方を見る'}</button></div>
    ${ui.rules ? rulesHtml(d.game) : ''}
    ${errHtml()}${top}${secretBlock()}${publicInfo()}`;
}
function progress() {
  const d = D(), vs = voters(d), done = vs.filter(p => voteReady(d, (room.votes || {})[p])).length;
  return { done, all: vs.length };
}
function viewVote() {
  const d = D(), mine = (room.votes || {})[me], host = isHost(), pr = progress();
  let h = '';
  if (!d.order.includes(me)) h = '<h2>投票中です</h2><p class="note">この回は見学です。</p>';
  else if (d.game === 'kessha') {
    if (me === d.ans.spy) h = now('あなたは密偵なので、答えることはありません', '知らん顔で待っていてください');
    else {
      const v = mine || { g: -1, spy: '' };
      h = now(`相手チーム（${d.ans.moon.includes(me) ? '星の会' : '月の会'}）の合図はどれ？`, 'チームの半分以上が正解すれば、あなたのチームの勝ちです')
        + `<div class="words big">${d.pub.cands.map((w, j) => `<button data-act="kg" data-w="${j}" aria-pressed="${v.g === j}">${esc(w)}</button>`).join('')}</div>`
        + (d.pub.hasSpy ? `<div class="sec"><h3>密偵は誰だと思う？</h3>${people('ks', v.spy, me)}</div>` : '');
    }
  } else {
    const q = d.game === 'mogu' ? '取締官だと思う人に投票' : d.game === 'bottle' ? '犯人だと思う人に投票' : '遺産を継がせたい人に投票';
    h = now(q, mine ? `${nm(mine)}さんに投票しました。開票までは変えられます` : '1人を選んでください') + people('vote', mine || '', me);
  }
  h += `${errHtml()}<p class="count">投票済み ${pr.done} / ${pr.all}人</p>`;
  if (host) h += `<button class="go" data-act="tally">${pr.done >= pr.all ? '開票する' : '全員を待たずに開票する'}</button><button class="ghost" data-act="backplay">話し合いに戻る</button>`;
  return h;
}
function viewGuess() {
  const d = D(), o = outcome(d, room.votes || {}, -1), ag = o.acc;
  if (me === ag) return now('見破られました。でも、最後のチャンス！', '合言葉を当てれば、取締官の大逆転勝ちです') + errHtml()
    + `<div class="words big">${d.pub.cands.map((w, j) => `<button data-act="guess" data-w="${j}">${esc(w)}</button>`).join('')}</div>`;
  return now(`取締官は ${nm(ag)}さん でした！`, `${nm(ag)}さんが合言葉を当てれば、取締官の大逆転です。いま選んでいます`)
    + (isHost() && isBot(ag) ? '<button class="ghost" data-act="botguess">お試し用の取締官に答えさせる</button>' : '');
}
function bars(t, max) {
  const d = D();
  return `<div class="bars">${d.order.slice().sort((a, b) => t[b] - t[a]).map(p => `<div class="bar"><span>${nm(p)}</span><i style="width:${max ? t[p] / max * 100 : 0}%"></i><b>${t[p]}票</b></div>`).join('')}</div>`;
}
function viewEnd() {
  const d = D(), a = d.ans, o = outcome(d, room.votes || {}, meta().guess ?? -1), win = o.winners.includes(me);
  let h = `<div class="result${win ? ' won' : ''}"><p class="verdict">${esc(o.verdict)}</p>${d.order.includes(me) ? `<p class="me-res">${win ? 'あなたは勝ちました' : 'あなたは負けました'}</p>` : ''}</div>`;
  if (d.game === 'mogu') h += `<div class="box"><p>合言葉は <b>${esc(a.word)}</b></p><p>取締官は <b>${a.agents.map(nm).join('さん、')}さん</b></p>${o.caught ? `<p>取締官の答え：${esc(d.pub.cands[meta().guess] ?? '')}</p>` : ''}</div><div class="sec"><h3>投票の結果</h3>${bars(o.tally, o.max)}</div>`;
  if (d.game === 'bottle') h += `<div class="box"><p>犯人は <b>${nm(a.c)}さん</b></p><ul>${a.pos.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div><div class="sec"><h3>投票の結果</h3>${bars(o.tally, o.max)}</div>
    <div class="sec"><h3>みんなの本当の証言</h3><div class="tablewrap"><table><tbody>${d.order.map(p => `<tr${p === a.c ? ' class="hit"' : ''}><td>${nm(p)}</td><td class="wrap">${p === a.c ? '犯人（証言はウソ）' : esc(a.clues[p])}</td></tr>`).join('')}</tbody></table></div></div>`;
  if (d.game === 'kessha') h += `<div class="box"><p>月の会の合図：<b>${esc(a.gm)}</b>（星の会は ${a.star.length}人中${o.sr}人が正解）</p><p>星の会の合図：<b>${esc(a.gs)}</b>（月の会は ${a.moon.length}人中${o.mr}人が正解）</p>${a.spy ? `<p>密偵の${nm(a.spy)}さんは${o.spyHit ? '見破られました' : '逃げきりました'}</p>` : ''}</div>
    <div class="box"><p><b>月の会</b>：${a.moon.map(nm).join('、')}</p><p><b>星の会</b>：${a.star.map(nm).join('、')}</p></div>`;
  if (d.game === 'souzoku') h += `<div class="sec"><h3>投票の結果</h3>${bars(o.tally, o.max)}</div>
    <div class="sec"><h3>みんなの正体</h3><div class="tablewrap"><table><thead><tr><th>名前</th><th>正体</th><th>ねらい</th><th></th></tr></thead><tbody>
    ${d.order.map(p => `<tr><td>${nm(p)}</td><td>${SROLE[a.role[p]]}</td><td class="wrap">${esc(o.goal[p])}</td><td class="${o.won[p] ? 'win' : 'lose'}">${o.won[p] ? '勝ち' : '負け'}</td></tr>`).join('')}</tbody></table></div></div>`;
  h += `<div class="sec"><h3>勝った人（1点ずつ）</h3><div class="chips">${o.winners.length ? o.winners.map(p => `<span class="chip win">${nm(p)}</span>`).join('') : '<span class="lead">なし</span>'}</div></div>`;
  h += scoreboard() + errHtml();
  h += isHost() ? '<button class="go" data-act="start">同じ演目でもう一度</button><button class="ghost" data-act="tolobby">演目・設定を変える</button>' : '<p class="lead">次の回は幹事が始めます。</p>';
  return h;
}
function view() {
  if (!store) return '<p class="lead">準備しています…</p>';
  if (!code) return viewHome();
  if (!loaded) return `<p class="lead">部屋 ${code} を探しています…</p>${errHtml()}`;
  if (!room || !room.meta) return `<h2>部屋 ${code} は見つかりません</h2><p class="lead">番号を確かめるか、幹事にQRをもう一度見せてもらってください。</p><button class="ghost" data-act="leave">最初の画面へ</button>`;
  const joined = room.players && room.players[me];
  const top = `<p class="bar-top"><span>部屋 ${code}</span>${joined ? `<span>${esc(room.players[me].name)}さん${isHost() ? '（幹事）' : ''}</span>` : ''}</p>`;
  if (!joined) return top + viewJoin();
  const ph = meta().phase;
  if (ph !== 'lobby' && !D()) return top + viewLobby();
  return top + (ph === 'play' ? viewPlay() : ph === 'vote' ? viewVote() : ph === 'guess' ? viewGuess() : ph === 'end' ? viewEnd() : viewLobby());
}
function render() {
  const act = document.activeElement, fid = act && act.id, pos = act && act.selectionStart;
  $view.innerHTML = view();
  if (fid) { const el = document.getElementById(fid); if (el && el.tagName === 'INPUT') { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) { /* 位置を戻せなくても困らない */ } } }
}

/* ---------- 操作 ---------- */
async function finish(d, votes, guess) {
  // 勝った人に1点ずつ。同じ回を二度数えないように、点を入れた回の番号を残す。
  const o = outcome(d, votes, guess), up = { 'meta/phase': 'end', 'meta/timerEnd': 0, 'meta/guess': guess };
  if (meta().scored !== meta().round) {
    const sc = room.scores || {};
    o.winners.forEach(p => { up['scores/' + p] = (sc[p] || 0) + 1; });
    up['meta/scored'] = meta().round;
  }
  await store.update(path(), up);
}
async function startGame() {
  const g = meta().game, ps = players();
  if (!g) { ui.err = '演目を選んでください。'; render(); return; }
  if (!fit(g, ps.length).ok) { ui.err = `${GAMES[g].name}は${GAMES[g].people}で遊びます。`; render(); return; }
  await store.update(path(), { deal: deal(g, ps, settingsOf(g)), votes: null, 'meta/phase': 'play', 'meta/step': 0, 'meta/timerEnd': 0, 'meta/guess': -1, 'meta/round': (meta().round || 0) + 1 });
}
async function tallyVotes() {
  const d = D(), up = {};
  voters(d).forEach(p => { if (isBot(p) && !voteReady(d, (room.votes || {})[p])) up[p] = randomVote(d, p); });
  if (Object.keys(up).length) await store.update(path('votes'), up);
  const votes = { ...(room.votes || {}), ...up }, o = outcome(d, votes, -1);
  if (d.game === 'mogu' && o.needGuess) await store.update(path('meta'), { phase: 'guess', timerEnd: 0 });
  else await finish(d, votes, -1);
}
const ACTS = {
  async create() {
    let c = '';
    for (let i = 0; i < 6; i++) { c = rid(4); if (!(await store.get('rooms/' + c + '/meta'))) break; }
    await store.set('rooms/' + c, { meta: { host: me, phase: 'lobby', game: '', created: Date.now(), timerEnd: 0, guess: -1, step: 0, round: 0 } });
    location.hash = 'r-' + c;
  },
  gocode() {
    const c = ui.codeIn.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(c)) { ui.err = '部屋番号は、アルファベット4文字です。'; render(); return; }
    location.hash = 'r-' + c;
  },
  leave() { ui.codeIn = ''; history.replaceState(null, '', location.pathname + location.search); enter(''); },
  async join() {
    const name = ui.name.trim().slice(0, 12);
    if (!name) { ui.err = '名前を入れてください。'; render(); return; }
    if (players().some(p => p.name === name)) { ui.err = '同じ名前の人がいます。区別できる名前にしてください。'; render(); return; }
    await store.set(path('players/' + me), { name, at: Date.now() });
  },
  async addbot() {
    const k = players().filter(p => p.bot).length + 1;
    await store.set(path('players/bot' + rid(5).toLowerCase()), { name: 'お試し' + k, at: Date.now(), bot: true });
  },
  async kick(b) { if (isHost()) await store.remove(path('players/' + b.dataset.p)); },
  async game(b) { if (isHost()) await store.update(path('meta'), { game: b.dataset.id }); },
  async set(b) { if (isHost()) await store.update(path('meta/settings/' + meta().game), { [b.dataset.k]: b.dataset.v }); },
  async start() { if (isHost()) await startGame(); },
  show() { ui.secret = true; render(); },
  hide() { ui.secret = false; render(); },
  rules() { ui.rules = !ui.rules; render(); },
  async nextturn() { await store.update(path('meta'), { step: (meta().step || 0) + 1 }); },
  async timer() {
    if (!isHost()) return;
    const end = meta().timerEnd || 0, running = end && end > Date.now();
    await store.update(path('meta'), { timerEnd: running ? 0 : Date.now() + D().time * 1000 });
  },
  async tovote() { if (isHost()) { ui.secret = false; await store.update(path('meta'), { phase: 'vote', timerEnd: 0 }); } },
  async backplay() { if (isHost()) await store.update(path('meta'), { phase: 'play' }); },
  async vote(b) { await store.set(path('votes/' + me), b.dataset.p); },
  async kg(b) { const v = (room.votes || {})[me] || {}; await store.set(path('votes/' + me), { g: Number(b.dataset.w), spy: v.spy || '' }); },
  async ks(b) { const v = (room.votes || {})[me] || {}; await store.set(path('votes/' + me), { g: typeof v.g === 'number' ? v.g : -1, spy: b.dataset.p }); },
  async tally() { if (isHost()) await tallyVotes(); },
  async guess(b) { const d = D(); if (outcome(d, room.votes || {}, -1).acc === me) await finish(d, room.votes || {}, Number(b.dataset.w)); },
  async botguess() { if (isHost()) await finish(D(), room.votes || {}, Math.floor(Math.random() * D().pub.cands.length)); },
  async tolobby() { if (isHost()) await store.update(path(), { deal: null, votes: null, 'meta/phase': 'lobby', 'meta/timerEnd': 0, 'meta/step': 0 }); }
};
$view.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled || !store) return;
  const f = ACTS[b.dataset.act];
  if (!f) return;
  try { ui.err = ''; await f(b); }
  catch (err) { console.error(err); ui.err = 'うまく送れませんでした。電波を確かめて、もう一度押してください。'; render(); }
});
$view.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.bind; if (k) ui[k] = e.target.value; });
$view.addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.dataset || !e.target.dataset.bind) return;
  const b = $view.querySelector(e.target.dataset.bind === 'name' ? '[data-act="join"]' : '[data-act="gocode"]');
  if (b) b.click();
});
window.addEventListener('hashchange', () => { const c = parseCode(); if (c !== code) enter(c); });
setInterval(() => {
  const o = document.getElementById('t-out'), end = meta().timerEnd || 0;
  if (!o || !end) return;
  const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
  if (o.textContent !== mmss(left)) { o.textContent = mmss(left); if (left === 0) render(); }
}, 500);

/* ---------- 起動 ---------- */
render();
makeStore(LOCAL ? null : firebaseConfig).then(s => { store = s; me = myId(); enter(parseCode()); });
