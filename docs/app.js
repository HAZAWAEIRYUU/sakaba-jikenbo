import { GAMES, ORDER, SEATS, DRINKS, COATS, SROLE, deal, outcome, voters, voteReady, randomVote } from './games.js';
import { makeStore } from './store.js';
import { firebaseConfig } from './config.js';

const $view = document.getElementById('view');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const rid = n => Array.from({ length: n }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');

let store = null, me = '', code = '', room = null, loaded = false, unwatch = null, round = -1;
const ui = { secret: true, name: '', codeIn: '', err: '' };

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
  if (h) return h[1].toUpperCase();
  const q = new URLSearchParams(location.search).get('room');
  return q && /^[A-Za-z]{4}$/.test(q) ? q.toUpperCase() : '';
}
function enter(c) {
  if (unwatch) { unwatch(); unwatch = null; }
  code = c; room = null; loaded = false; ui.err = ''; ui.secret = true;
  if (c) unwatch = store.watch('rooms/' + c, v => {
    // 新しい回が始まったら、役の紙をもう一度見せる
    const r = (v && v.meta && v.meta.round) || 0;
    if (r !== round) { round = r; ui.secret = true; }
    room = v; loaded = true; render();
  },
    () => { loaded = true; ui.err = '部屋のデータを読めませんでした。データベースのルールを確認してください。'; render(); });
  render();
}

/* ---------- 部屋の中身を読む ---------- */
const meta = () => (room && room.meta) || {};
const isHost = () => meta().host === me;
const D = () => room && room.deal;
function players() {
  return Object.entries((room && room.players) || {}).map(([id, p]) => ({ id, name: p.name, at: p.at || 0, bot: !!p.bot })).sort((a, b) => a.at - b.at);
}
const nm = pid => esc((D() && D().names[pid]) || (room.players && room.players[pid] && room.players[pid].name) || '？');
const path = sub => 'rooms/' + code + (sub ? '/' + sub : '');

/* ---------- 部品 ---------- */
function paper(s) {
  return `<div class="paper"><span class="side">極秘</span><p class="role">${esc(s.role)}</p>${s.key ? `<p class="key">${esc(s.key)}</p>` : ''}${(s.lines || []).map(l => `<p>${esc(l)}</p>`).join('')}${s.small ? `<small>${esc(s.small)}</small>` : ''}</div>`;
}
function people(act, sel, skip) {
  return `<div class="people">${D().order.filter(p => p !== skip).map(p => `<button data-act="${act}" data-p="${p}" aria-pressed="${sel === p}">${nm(p)}</button>`).join('')}</div>`;
}
function qrSvg(url) {
  try {
    const q = window.qrcode(0, 'M'); q.addData(url); q.make();
    return q.createSvgTag(5, 10);
  } catch (e) { return ''; }
}
function timerHtml() {
  const g = GAMES[D().game]; if (!g.time) return '';
  const end = meta().timerEnd || 0, left = end ? Math.max(0, Math.ceil((end - Date.now()) / 1000)) : g.time;
  return `<div class="timer${end && left === 0 ? ' done' : ''}"><output id="t-out">${mmss(left)}</output>
    ${isHost() ? `<button class="ghost" data-act="timer">${end ? (left === 0 ? 'もう一度' : '止める') : 'タイマー開始'}</button>` : `<span class="lead">${end ? '' : '幹事が開始します'}</span>`}</div>`;
}
const errHtml = () => ui.err ? `<p class="err" role="alert">${esc(ui.err)}</p>` : '';
const modeHtml = () => !store ? '' : store.failed
  ? '<p class="err">接続先につながりませんでした。いまは、この端末のタブ同士だけがつながる「お試しモード」です。</p>'
  : store.mode === 'local' ? '<p class="note">いまは「お試しモード」です。この端末のタブ同士だけがつながります。ほかのスマホからは参加できません。</p>' : '';

/* ---------- 画面 ---------- */
function viewHome() {
  return `<div><h1>酒場の事件簿</h1><p class="lead">QRを読んだ全員のスマホに、その人だけの秘密の役が届きます。</p></div>
  ${errHtml()}${modeHtml()}
  <button class="go" data-act="create">部屋を作る（幹事）</button>
  <div class="sec"><h3>部屋番号で参加する</h3>
    <div class="inline"><input id="code-in" data-bind="codeIn" type="text" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="例：KMTR" value="${esc(ui.codeIn)}" aria-label="部屋番号"><button class="ghost" data-act="gocode">参加する</button></div></div>
  <ul class="menu">${ORDER.map(id => `<li><b>${GAMES[id].name}<i>${GAMES[id].people}・${GAMES[id].mins}</i></b><span>${GAMES[id].desc}</span></li>`).join('')}</ul>`;
}
function viewJoin() {
  const mid = meta().phase !== 'lobby';
  return `<div><h2>部屋 ${code} に参加</h2><p class="lead">みんなに呼ばれている名前を入れてください。</p></div>
  ${errHtml()}
  <div class="sec"><input id="name-in" data-bind="name" type="text" maxlength="12" autocomplete="off" placeholder="名前" value="${esc(ui.name)}" aria-label="名前"></div>
  <button class="go" data-act="join">参加する</button>
  ${mid ? '<p class="note">いまゲームの途中です。次の回から参加できます。</p>' : ''}`;
}
function viewLobby() {
  const ps = players(), g = GAMES[meta().game], n = ps.length, host = isHost();
  const list = `<div class="sec"><h3>参加者（${n}人）</h3><div class="chips">${ps.map(p => `<span class="chip${p.id === me ? ' me' : ''}">${esc(p.name)}${p.id === meta().host ? '<i>幹事</i>' : ''}${host && p.id !== me ? `<button data-act="kick" data-p="${p.id}" aria-label="${esc(p.name)}さんを外す">×</button>` : ''}</span>`).join('')}</div></div>`;
  if (!host) return `<div><h2>部屋 ${code}</h2><p class="lead">幹事が始めるのを待っています。</p></div>${errHtml()}
    <div class="box"><p><b>今夜の演目：${g.name}</b>（${g.people}）</p><p>${g.desc}</p></div>${list}`;
  const url = location.origin + location.pathname + '#r-' + code;
  const short = n < g.min ? `あと${g.min - n}人で始められます` : n > g.max ? `この演目は${g.max}人までです` : '';
  return `<div><h2>部屋を開きました</h2><p class="lead">参加する人に、QRを読んでもらってください。</p></div>
  ${errHtml()}
  <div class="invite">${store.mode === 'online' ? `<div class="qr">${qrSvg(url)}</div>` : ''}
    <div><p class="code">${code}</p><p class="lead">部屋番号</p>${store.mode === 'online' ? `<p class="url">${esc(url)}</p>` : ''}</div></div>
  ${modeHtml()}${list}
  ${store.mode === 'local' ? '<button class="ghost" data-act="addbot">お試し用の参加者を1人足す</button>' : ''}
  <div class="sec"><h3>演目を選ぶ</h3>
    <div class="wall">${ORDER.map(id => `<button class="strip" data-act="game" data-id="${id}" aria-pressed="${meta().game === id}"><span class="ttl">${GAMES[id].name}</span><span class="meta">${GAMES[id].people}<br>${GAMES[id].mins}</span></button>`).join('')}</div>
    <p class="lead">${g.desc}</p></div>
  <button class="go" data-act="start" ${short ? 'disabled' : ''}>${g.name}を始める</button>
  ${short ? `<p class="note">${short}</p>` : ''}`;
}
function secretBlock() {
  const d = D();
  if (!d.order.includes(me)) return '<p class="note">この回は見学です。次の回から役が届きます。</p>';
  return ui.secret
    ? `<p class="lead">ほかの人に見せないでください。</p>${paper(d.secret[me])}<button class="ghost" data-act="hide">隠す</button>`
    : '<button class="ghost" data-act="show">自分の役を見る</button>';
}
function viewPlay() {
  const d = D(), g = GAMES[d.game], host = isHost();
  let h = `<h2>${g.name}</h2>${errHtml()}${secretBlock()}`;
  if (d.game === 'mogu') h += `<div class="box"><ol><li>幹事の左隣から順番に、合言葉を<b>におわせる一言</b>を言います。2周します。</li><li>取締官も、知っているふりをして一言を言います。</li><li>終わったら、取締官だと思う人に各自のスマホで投票します。</li></ol></div>
    <div class="sec"><h3>今夜の合言葉は、この6つのどれか（${esc(d.pub.cat)}）</h3><div class="words">${d.pub.cands.map(w => `<span>${esc(w)}</span>`).join('')}</div></div>`;
  if (d.game === 'bottle') h += `<div class="box"><p>店の棚から、${esc(d.pub.bottle)}が消えました。犯人は、この中に1人。</p><ol><li>1人ずつ、自分の証言を話します。</li><li>証言と下の表を突き合わせます。犯人の証言だけが、うそです。</li><li>10分たったら、各自のスマホで犯人に投票します。</li></ol></div>
    <div class="sec"><h3>今夜の全員の様子（全員が知っている事実）</h3><div class="tablewrap"><table><thead><tr><th>名前</th><th>席</th><th>飲んでいた酒</th><th>上着</th></tr></thead><tbody>
    ${d.order.map(p => `<tr><td>${nm(p)}</td><td>${SEATS[d.pub.attrs[p][0]]}</td><td>${DRINKS[d.pub.attrs[p][1]]}</td><td>${COATS[d.pub.attrs[p][2]]}</td></tr>`).join('')}</tbody></table></div></div>`;
  if (d.game === 'kessha') h += `<div class="box"><ol><li>ここからは、普通に飲んでください。ゲームは裏で続きます。</li><li>ときどき、自分の結社の合図をさりげなく出します。</li><li>同じ合図の人が仲間です。言葉で確かめてはいけません。</li><li>相手の結社の合図も、見破ってください。</li></ol></div>
    ${d.pub.hasSpy ? '<p class="note">この中に、どちらの結社でもない密偵が1人います。両方の合図を使います。</p>' : ''}
    <p class="lead">月の会 ${d.pub.nm}人、星の会 ${d.pub.ns}人${d.pub.hasSpy ? '、密偵 1人' : ''}。お開きの前に、各自のスマホで答えます。</p>`;
  if (d.game === 'souzoku') h += `<div class="box"><p>大酒飲みの富豪、酒巻権蔵が亡くなりました。遺言は一行だけ。「今夜の席で、最も多くの票を集めた者に、すべてを譲る」。</p><ol><li>1人ずつ、肩書きを名乗ります。</li><li>8分間、自由に話します。説得、取引、うそ、何でもありです。</li><li>最後に、各自のスマホで投票します。自分には入れられません。</li><li>同点なら、遺産は寄付されて誰も継げません。</li></ol></div>
    <div class="sec"><h3>今夜の出席者</h3><div class="tablewrap"><table><tbody>${d.order.map(p => `<tr><td>${nm(p)}</td><td>${esc(d.pub.titles[p])}</td></tr>`).join('')}</tbody></table></div></div>`;
  h += timerHtml();
  h += host ? `<button class="go" data-act="tovote">${d.game === 'kessha' ? '答え合わせを始める' : '投票を始める'}</button>` : '<p class="lead">投票は幹事が始めます。</p>';
  return h;
}
function progress() {
  const d = D(), vs = voters(d), done = vs.filter(p => voteReady(d, (room.votes || {})[p])).length;
  return { done, all: vs.length };
}
function viewVote() {
  const d = D(), mine = (room.votes || {})[me], host = isHost(), pr = progress();
  let h = '';
  const inGame = d.order.includes(me);
  if (!inGame) h = '<h2>投票中</h2><p class="note">この回は見学です。</p>';
  else if (d.game === 'kessha') {
    if (me === d.ans.spy) h = '<h2>答え合わせ</h2><p class="lead">あなたは密偵なので、答えることはありません。知らん顔で待ってください。</p>';
    else {
      const v = mine || { g: -1, spy: '' };
      h = `<h2>相手の結社の合図は</h2><p class="lead">自分の結社ではなく、<b>相手の結社</b>の合図を1つ選んでください。</p>
        <div class="words">${d.pub.cands.map((w, j) => `<button data-act="kg" data-w="${j}" aria-pressed="${v.g === j}">${esc(w)}</button>`).join('')}</div>
        ${d.pub.hasSpy ? `<h2>密偵は誰だ</h2>${people('ks', v.spy, me)}` : ''}`;
    }
  } else {
    const q = d.game === 'mogu' ? '取締官は誰だ' : d.game === 'bottle' ? '犯人は誰だ' : '誰に遺産を継がせますか';
    h = `<h2>${q}</h2><p class="lead">${mine ? `${nm(mine)}さんに投票しました。開票までは変えられます。` : '1人選んでください。'}</p>${people('vote', mine || '', me)}`;
  }
  h += `${errHtml()}<p class="count">投票済み ${pr.done} / ${pr.all}人</p>`;
  if (host) h += `<button class="go" data-act="tally">${pr.done >= pr.all ? '開票する' : '全員を待たずに開票する'}</button><button class="ghost" data-act="backplay">話し合いに戻る</button>`;
  return h;
}
function viewGuess() {
  const d = D();
  if (me === d.ans.agent) return `<h2>見破られた</h2><p class="lead">ただし、最後の機会があります。合言葉を1つ選んでください。当たれば逆転です。</p>${errHtml()}
    <div class="words">${d.pub.cands.map((w, j) => `<button data-act="guess" data-w="${j}">${esc(w)}</button>`).join('')}</div>`;
  return `<h2>取締官は${nm(d.ans.agent)}さん</h2><p class="lead">見破りました。ただし、取締官が合言葉を当てれば逆転されます。${nm(d.ans.agent)}さんが選んでいます。</p>
    ${isHost() && room.players[d.ans.agent] && room.players[d.ans.agent].bot ? '<button class="ghost" data-act="botguess">お試し用の取締官に答えさせる</button>' : ''}`;
}
function bars(t, max) {
  const d = D();
  return d.order.slice().sort((a, b) => t[b] - t[a]).map(p => `<div class="bar"><span>${nm(p)}</span><i style="width:${max ? t[p] / max * 100 : 0}%"></i><b>${t[p]}</b></div>`).join('');
}
function viewEnd() {
  const d = D(), a = d.ans, o = outcome(d, room.votes || {}, meta().guess ?? -1);
  let h = `<p class="verdict">${esc(o.verdict)}</p>`;
  const maxOf = t => Math.max(0, ...d.order.map(p => t[p]));
  if (d.game === 'mogu') h += `<div class="box"><p>取締官：<b>${nm(a.agent)}さん</b></p><p>合言葉：<b>${esc(a.word)}</b></p>${o.caught ? `<p>取締官の答え：${esc(d.pub.cands[meta().guess] ?? '')}</p>` : ''}</div>
    <div class="sec"><h3>開票</h3>${bars(o.tally, maxOf(o.tally))}</div>`;
  if (d.game === 'bottle') h += `<div class="box"><p>犯人：<b>${nm(a.c)}さん</b>${o.ok ? '' : o.acc ? `（票が集まったのは${nm(o.acc)}さん）` : '（票が割れました）'}</p><ul>${a.pos.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
    <div class="sec"><h3>開票</h3>${bars(o.tally, maxOf(o.tally))}</div>
    <div class="sec"><h3>それぞれの本当の証言</h3><div class="tablewrap"><table><tbody>${d.order.map(p => `<tr${p === a.c ? ' class="hit"' : ''}><td>${nm(p)}</td><td class="wrap">${p === a.c ? '犯人。証言はうそ' : esc(a.clues[p])}</td></tr>`).join('')}</tbody></table></div></div>`;
  if (d.game === 'kessha') h += `<div class="box"><p>月の会の合図：<b>${esc(a.gm)}</b></p><p>星の会の合図：<b>${esc(a.gs)}</b></p>
      <p>月の会は ${a.moon.length}人中${o.mr}人が正解。${o.moonHit ? '見破りました' : '見破れませんでした'}</p><p>星の会は ${a.star.length}人中${o.sr}人が正解。${o.starHit ? '見破りました' : '見破れませんでした'}</p>
      ${a.spy ? `<p>密偵の${nm(a.spy)}さんは${o.spyHit ? '見破られました' : '逃げきりました'}</p>` : ''}</div>
    <div class="box"><p><b>月の会</b>：${a.moon.map(nm).join('、')}</p><p><b>星の会</b>：${a.star.map(nm).join('、')}</p></div>`;
  if (d.game === 'souzoku') h += `<div class="sec"><h3>開票</h3>${bars(o.tally, o.max)}</div>
    <div class="sec"><h3>全員の正体</h3><div class="tablewrap"><table><thead><tr><th>名前</th><th>正体</th><th>目的</th><th>結果</th></tr></thead><tbody>
    ${d.order.map(p => `<tr><td>${nm(p)}</td><td>${SROLE[a.role[p]]}</td><td class="wrap">${esc(o.goal[p])}</td><td class="${o.won[p] ? 'win' : 'lose'}">${o.won[p] ? '勝ち' : '負け'}</td></tr>`).join('')}</tbody></table></div></div>`;
  h += errHtml();
  h += isHost() ? '<button class="go" data-act="start">同じ演目でもう一度</button><button class="ghost" data-act="tolobby">演目を選び直す</button>' : '<p class="lead">次の回は幹事が始めます。</p>';
  return h;
}
function view() {
  if (!store) return '<p class="lead">準備しています…</p>';
  if (!code) return viewHome();
  if (!loaded) return `<p class="lead">部屋 ${code} を探しています…</p>${errHtml()}`;
  if (!room || !room.meta) return `<h2>部屋 ${code} は見つかりません</h2><p class="lead">番号を確かめるか、幹事にQRをもう一度見せてもらってください。</p><button class="ghost" data-act="leave">最初の画面へ</button>`;
  const joined = room.players && room.players[me];
  const top = `<p class="bar-top"><span>部屋 ${code}</span>${joined ? `<span>${esc(room.players[me].name)}さん</span>` : ''}</p>`;
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
async function startGame() {
  const g = meta().game, ps = players();
  if (ps.length < GAMES[g].min || ps.length > GAMES[g].max) { ui.err = `${GAMES[g].name}は${GAMES[g].people}で遊びます。`; render(); return; }
  ui.secret = true;
  await store.update(path(), { deal: deal(g, ps), votes: null, meta: { ...meta(), phase: 'play', timerEnd: 0, guess: -1, round: (meta().round || 0) + 1 } });
}
async function tallyVotes() {
  const d = D(), up = {};
  // お試し用の参加者は、開票のときにでたらめに投票する
  voters(d).forEach(p => { if (room.players[p] && room.players[p].bot && !voteReady(d, (room.votes || {})[p])) up[p] = randomVote(d, p); });
  if (Object.keys(up).length) await store.update(path('votes'), up);
  const o = outcome(d, { ...(room.votes || {}), ...up }, -1);
  await store.update(path('meta'), { phase: d.game === 'mogu' && o.needGuess ? 'guess' : 'end', timerEnd: 0 });
}
const ACTS = {
  async create() {
    let c = '';
    for (let i = 0; i < 6; i++) { c = rid(4); if (!(await store.get('rooms/' + c + '/meta'))) break; }
    await store.set('rooms/' + c, { meta: { host: me, phase: 'lobby', game: 'mogu', created: Date.now(), timerEnd: 0, guess: -1 } });
    location.hash = 'r-' + c;
  },
  gocode() {
    const c = ui.codeIn.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(c)) { ui.err = '部屋番号は、アルファベット4文字です。'; render(); return; }
    location.hash = 'r-' + c;
  },
  leave() { ui.codeIn = ''; history.replaceState(null, '', location.pathname); enter(''); },
  async join() {
    const name = ui.name.trim().slice(0, 12);
    if (!name) { ui.err = '名前を入れてください。'; render(); return; }
    if (players().some(p => p.name === name)) { ui.err = '同じ名前の人がいます。区別できる名前にしてください。'; render(); return; }
    ui.err = '';
    await store.set(path('players/' + me), { name, at: Date.now() });
  },
  async addbot() {
    const k = players().filter(p => p.bot).length + 1;
    await store.set(path('players/bot' + rid(5).toLowerCase()), { name: 'お試し' + k, at: Date.now(), bot: true });
  },
  async kick(b) { if (isHost()) await store.remove(path('players/' + b.dataset.p)); },
  async game(b) { if (isHost()) await store.update(path('meta'), { game: b.dataset.id }); },
  async start() { if (isHost()) await startGame(); },
  show() { ui.secret = true; render(); },
  hide() { ui.secret = false; render(); },
  async timer() {
    if (!isHost()) return;
    const end = meta().timerEnd || 0, running = end && end > Date.now();
    await store.update(path('meta'), { timerEnd: running ? 0 : Date.now() + GAMES[D().game].time * 1000 });
  },
  async tovote() { if (isHost()) { ui.secret = false; await store.update(path('meta'), { phase: 'vote', timerEnd: 0 }); } },
  async backplay() { if (isHost()) await store.update(path('meta'), { phase: 'play' }); },
  async vote(b) { await store.set(path('votes/' + me), b.dataset.p); },
  async kg(b) { const v = (room.votes || {})[me] || { g: -1, spy: '' }; await store.set(path('votes/' + me), { g: Number(b.dataset.w), spy: v.spy || '' }); },
  async ks(b) { const v = (room.votes || {})[me] || { g: -1, spy: '' }; await store.set(path('votes/' + me), { g: typeof v.g === 'number' ? v.g : -1, spy: b.dataset.p }); },
  async tally() { if (isHost()) await tallyVotes(); },
  async guess(b) { if (me === D().ans.agent) await store.update(path('meta'), { guess: Number(b.dataset.w), phase: 'end' }); },
  async botguess() { if (isHost()) await store.update(path('meta'), { guess: Math.floor(Math.random() * D().pub.cands.length), phase: 'end' }); },
  async tolobby() { if (isHost()) await store.update(path(), { deal: null, votes: null, meta: { ...meta(), phase: 'lobby', timerEnd: 0, guess: -1 } }); }
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
makeStore(firebaseConfig).then(s => { store = s; me = myId(); enter(parseCode()); });
