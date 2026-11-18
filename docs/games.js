// 配役と勝敗の計算。画面にも通信にも触れない、純粋な関数だけを置く。

export const GAMES = {
  mogu: { name: 'もぐり酒場', min: 5, max: 10, mins: '10分', people: '5〜10人', time: 300,
    desc: '客だけが知る合言葉。紛れ込んだ取締官は、話を合わせて探り出す。' },
  bottle: { name: '消えたボトル', min: 4, max: 8, mins: '15分', people: '4〜8人', time: 600,
    desc: '店一番のボトルが消えた。証言を突き合わせ、うそをついている犯人を指名する。' },
  kessha: { name: '秘密結社の乾杯', min: 8, max: 30, mins: '会のあいだ', people: '8〜30人', time: 0,
    desc: '合図は仕草だけ。飲みながら仲間を探し、相手の結社の合図を見破る。' },
  souzoku: { name: '相続会議', min: 6, max: 12, mins: '15分', people: '6〜12人', time: 480,
    desc: '大酒飲みの富豪の遺産は誰の手に。秘密の目的を胸に、票を集める。' }
};
export const ORDER = ['mogu', 'bottle', 'kessha', 'souzoku'];

const WORDS = [
  { c: 'つまみ', w: ['枝豆', '冷奴', '唐揚げ', '刺身', '焼き鳥', 'ポテトサラダ'] },
  { c: '酒', w: ['日本酒', '焼酎', 'ワイン', 'ウイスキー', '梅酒', 'ビール'] },
  { c: '飲む場所', w: ['屋台', '立ち飲み', '温泉宿', '花見', '海の家', '屋形船'] },
  { c: '集まり', w: ['花火大会', '忘年会', '結婚式', '同窓会', '夏祭り', '正月'] },
  { c: '締めの一品', w: ['ラーメン', 'お茶漬け', 'おにぎり', 'そば', '雑炊', 'アイス'] }
];
export const SEATS = ['カウンター', '奥の座敷', '窓ぎわ', '入口そば'];
export const DRINKS = ['日本酒', 'ハイボール', '焼酎', '赤ワイン'];
export const COATS = ['黒', '紺', '茶', '灰色'];
const BOTTLES = ['三十年ものの古酒「月の雫」', '幻の焼酎「夜鷹」', '店主秘蔵のウイスキー「百年樽」', '蔵元に一本だけ残った大吟醸「雪灯り」'];
const GEST = ['グラスを左手で持つ', '乾杯のとき、わざと目をそらす', '話しはじめる前に、耳たぶを触る', '笑うとき、口を手で隠す', 'グラスを置くとき、指で2回たたく', 'おしぼりを、きっちり四角にたたむ', '飲む前に、グラスを少し回す', '相づちで「なるほど」と言う', '箸を置くとき、向きを逆にする', '話を聞くとき、ほおづえをつく'];
const TITLES = ['長男', '元秘書', '行きつけの店の大将', '主治医', '釣り仲間', '運転手', '姪', '骨董商', '顧問弁護士', '幼なじみ', '料理番', '庭師'];
export const SROLE = { yashin: '野心家', chushin: '忠臣', kyuteki: '仇敵', shakkin: '借金取り', kakushi: '隠し子' };

const rint = (n, r) => Math.floor(r() * n);
const pick = (a, r) => a[rint(a.length, r)];
function shuffle(a, r) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1, r); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// 保存先は undefined を受け付けないので、ある項目だけを入れる
function sec(role, key, lines, small) {
  const o = { role, lines };
  if (key) o.key = key;
  if (small) o.small = small;
  return o;
}

function dealMogu(order, names, r) {
  const g = pick(WORDS, r), word = pick(g.w, r), agent = pick(order, r), secret = {};
  order.forEach(p => {
    secret[p] = p === agent
      ? sec('あなたは取締官', '', ['合言葉を知りません。', '客のふりをして話を合わせ、合言葉を探ってください。'], '候補：' + g.w.join('、'))
      : sec('あなたは客', '合言葉：' + word, ['合言葉そのものは口にできません。におわせる一言で、仲間に伝えてください。'], 'はっきり言いすぎると、取締官に当てられます。');
  });
  return { secret, pub: { cat: g.c, cands: g.w }, ans: { word, agent } };
}

function dealBottle(order, names, r) {
  const c = pick(order, r), s = rint(4, r), d = rint(4, r), k = rint(4, r);
  const oth = v => { let x; do { x = rint(4, r); } while (x === v); return x; };
  const attrs = { [c]: [s, d, k] };
  const inn = shuffle(order.filter(p => p !== c), r);
  // 最初の3人は、犯人と1か所だけ違う。犯人がうそで疑いを向けられる相手になる。
  const near = [[oth(s), d, k], [s, oth(d), k], [s, d, oth(k)]];
  inn.forEach((p, j) => {
    if (j < 3) attrs[p] = near[j];
    else { let t; do { t = [rint(4, r), rint(4, r), rint(4, r)]; } while (t[0] === s && t[1] === d && t[2] === k); attrs[p] = t; }
  });
  const pos = [`犯人は「${SEATS[s]}」の席にいた`, `犯人は「${DRINKS[d]}」を飲んでいた`, `犯人の上着は「${COATS[k]}」だった`];
  const clues = {};
  shuffle(inn, r).forEach((p, j) => {
    if (j < 3) clues[p] = pos[j];
    else if (j % 2 === 1) {
      const t = pick(inn.slice(0, 3).filter(x => x !== p), r);
      clues[p] = `${names[t]}さんは、ずっとあなたの隣で飲んでいた。犯人ではない`;
    } else {
      const cat = rint(3, r), v = oth([s, d, k][cat]);
      clues[p] = cat === 0 ? `犯人は「${SEATS[v]}」の席にはいなかった` : cat === 1 ? `犯人は「${DRINKS[v]}」を飲んでいなかった` : `犯人の上着は「${COATS[v]}」ではなかった`;
    }
  });
  const fj = rint(3, r), ft = inn[fj], fa = attrs[ft];
  const lie = fj === 0 ? `犯人は「${SEATS[fa[0]]}」の席にいた` : fj === 1 ? `犯人は「${DRINKS[fa[1]]}」を飲んでいた` : `犯人の上着は「${COATS[fa[2]]}」だった`;
  const secret = {};
  order.forEach(p => {
    secret[p] = p === c
      ? sec('あなたが犯人', '', ['ボトルを持ち出したのは、あなたです。', '目撃者のふりをして、うその証言を1つ言い、ほかの人に疑いを向けてください。'], `例：「${lie}」と言えば、${names[ft]}さんが疑われます。`)
      : sec('あなたは目撃者', '証言：' + clues[p], ['この証言は本当です。みんなに伝えてください。'], '犯人も目撃者のふりをして、うその証言をします。食い違いを探してください。');
  });
  return { secret, pub: { bottle: pick(BOTTLES, r), attrs }, ans: { c, pos, clues } };
}

function dealKessha(order, names, r) {
  const sh = shuffle(order, r);
  let spy = '';
  if (order.length >= 12) spy = sh.pop();
  const half = Math.ceil(sh.length / 2);
  const moon = sh.slice(0, half), star = sh.slice(half);
  const c = shuffle(GEST, r).slice(0, 6), gm = c[0], gs = c[1];
  const rule = '会のあいだ、ときどきさりげなく合図を出して、仲間を探してください。言葉で確かめてはいけません。';
  const secret = {};
  order.forEach(p => {
    if (p === spy) secret[p] = sec('あなたは密偵', '', ['どちらの結社にも属していません。', `月の会の合図：${gm}`, `星の会の合図：${gs}`, '2つの合図を使い分けて、どちらの仲間のふりもしてください。'], '最後に密偵だと当てられなければ、あなたの勝ちです。');
    else { const m = moon.includes(p); secret[p] = sec(m ? 'あなたは月の会' : 'あなたは星の会', '合図：' + (m ? gm : gs), [rule], '相手の結社の合図も、よく見て見破ってください。最後に当てます。'); }
  });
  return { secret, pub: { cands: shuffle(c, r), nm: moon.length, ns: star.length, hasSpy: !!spy }, ans: { moon, star, spy, gm, gs } };
}

function dealSouzoku(order, names, r) {
  const n = order.length, sh = shuffle(order, r), ny = Math.max(2, Math.round(n / 3));
  const role = {}, target = {}, titles = {}, secret = {};
  sh.forEach((p, i) => { role[p] = i < ny ? 'yashin' : ['chushin', 'kyuteki', 'shakkin', 'kakushi'][(i - ny) % 4]; });
  const yas = order.filter(p => role[p] === 'yashin');
  order.forEach(p => {
    if (role[p] === 'chushin') target[p] = pick(order.filter(x => x !== p), r);
    if (role[p] === 'kyuteki') target[p] = pick(yas, r);
  });
  const tl = shuffle(TITLES, r);
  order.forEach((p, i) => {
    titles[p] = tl[i];
    const ro = role[p], t = names[target[p]];
    const goal = ro === 'yashin' ? '最多の票を集めて、遺産を継げば勝ち'
      : ro === 'chushin' ? `${t}さんに遺産を継がせれば勝ち`
      : ro === 'kyuteki' ? `${t}さんが遺産を継がなければ勝ち`
      : ro === 'shakkin' ? '遺産を継ぐ人に、自分の1票を入れていれば勝ち'
      : '2票以上もらえれば勝ち';
    const hint = ro === 'yashin' ? '自分には投票できません。人を説得して票を集めてください。'
      : ro === 'chushin' ? '故人から「あの人を頼む」と言われています。本人にも明かさないほうが動きやすいでしょう。'
      : ro === 'kyuteki' ? '同点で遺産が寄付になっても、あなたの勝ちです。'
      : ro === 'shakkin' ? '誰が勝ちそうかを見きわめて、勝ち馬に乗ってください。'
      : '遺産は要りません。家族として認めてほしいだけです。';
    secret[p] = sec(`${tl[i]}・${SROLE[ro]}`, goal, [hint], `表向きの肩書きは「${tl[i]}」です。${SROLE[ro]}であることは秘密にできます。`);
  });
  return { secret, pub: { titles }, ans: { role, target } };
}

const DEALERS = { mogu: dealMogu, bottle: dealBottle, kessha: dealKessha, souzoku: dealSouzoku };

/** players: [{id,name}] を受け取り、1回ぶんの配役を返す */
export function deal(game, players, r = Math.random) {
  const order = players.map(p => p.id), names = {};
  players.forEach(p => { names[p.id] = p.name; });
  return Object.assign({ game, order, names }, DEALERS[game](order, names, r));
}

/** この回で投票する人（密偵は投票しない） */
export function voters(d) {
  return d.game === 'kessha' ? d.order.filter(p => p !== d.ans.spy) : d.order;
}
/** その人の投票が出そろっているか */
export function voteReady(d, v) {
  if (v === undefined || v === null) return false;
  if (d.game !== 'kessha') return typeof v === 'string' && v !== '';
  return typeof v.g === 'number' && v.g >= 0 && (!d.pub.hasSpy || !!v.spy);
}
/** お試し用の参加者が入れる、でたらめな1票 */
export function randomVote(d, pid, r = Math.random) {
  const others = d.order.filter(p => p !== pid);
  if (d.game !== 'kessha') return pick(others, r);
  return { g: rint(d.pub.cands.length, r), spy: d.pub.hasSpy ? pick(others, r) : '' };
}

function tally(order, picks) {
  const t = {};
  order.forEach(p => { t[p] = 0; });
  picks.forEach(v => { if (v in t) t[v]++; });
  const max = Math.max(0, ...order.map(p => t[p]));
  const tops = order.filter(p => max > 0 && t[p] === max);
  return { t, max, top: tops.length === 1 ? tops[0] : '' };
}

/** 投票から勝敗を出す。guess は取締官が最後に選んだ合言葉の番号（まだなら -1） */
export function outcome(d, votes = {}, guess = -1) {
  const a = d.ans, v = votes || {};
  if (d.game === 'mogu') {
    const tl = tally(d.order, d.order.map(p => v[p]).filter(Boolean));
    const caught = tl.top === a.agent;
    const hit = caught && guess >= 0 && d.pub.cands[guess] === a.word;
    return { tally: tl.t, acc: tl.top, caught, needGuess: caught && guess < 0, hit,
      verdict: !caught ? '取締官の勝ち。客は見破れませんでした' : hit ? '取締官の逆転勝ち。合言葉を当てました' : '客の勝ち。もぐり酒場は守られました' };
  }
  if (d.game === 'bottle') {
    const tl = tally(d.order, d.order.map(p => v[p]).filter(Boolean));
    const ok = tl.top === a.c;
    return { tally: tl.t, acc: tl.top, ok, verdict: ok ? 'お見事。ボトルは棚に戻りました' : '残念。犯人はボトルを抱えて夜の街へ' };
  }
  if (d.game === 'kessha') {
    const right = (grp, g) => grp.filter(p => v[p] && d.pub.cands[v[p].g] === g).length;
    const mr = right(a.moon, a.gs), sr = right(a.star, a.gm);
    const moonHit = mr * 2 > a.moon.length, starHit = sr * 2 > a.star.length;
    let spyHit = false, spyTally = {};
    if (a.spy) {
      const tl = tally(d.order, d.order.filter(p => p !== a.spy).map(p => v[p] && v[p].spy).filter(Boolean));
      spyHit = tl.top === a.spy; spyTally = tl.t;
    }
    return { mr, sr, moonHit, starHit, spyHit, spyTally,
      verdict: moonHit && !starHit ? '月の会の勝ち' : starHit && !moonHit ? '星の会の勝ち' : moonHit ? '引き分け。どちらも見破りました' : '引き分け。どちらも隠しとおしました' };
  }
  // souzoku
  const tl = tally(d.order, d.order.map(p => (v[p] && v[p] !== p) ? v[p] : '').filter(Boolean));
  const w = tl.top, won = {}, goal = {};
  d.order.forEach(p => {
    const ro = a.role[p], t = a.target[p], tn = d.names[t];
    won[p] = ro === 'yashin' ? w === p : ro === 'chushin' ? w === t : ro === 'kyuteki' ? w !== t : ro === 'shakkin' ? (w !== '' && v[p] === w) : tl.t[p] >= 2;
    goal[p] = ro === 'yashin' ? '自分が継ぐ' : ro === 'chushin' ? `${tn}さんに継がせる` : ro === 'kyuteki' ? `${tn}さんに継がせない` : ro === 'shakkin' ? '継ぐ人に投票する' : '2票以上もらう';
  });
  return { tally: tl.t, max: tl.max, w, won, goal, verdict: w ? `遺産は${d.names[w]}さんの手に` : '同点。遺産は寄付されました' };
}
