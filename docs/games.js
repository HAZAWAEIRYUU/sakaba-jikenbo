// ゲームの中身：ルールの説明、設定、配役、進行の順番、勝敗。画面にも通信にも触れない純粋な関数だけを置く。

const WORDS = [
  { c: 'つまみ', w: ['枝豆', '冷奴', '唐揚げ', '刺身', '焼き鳥', 'ポテトサラダ'] },
  { c: 'お酒', w: ['日本酒', '焼酎', 'ワイン', 'ウイスキー', '梅酒', 'ビール'] },
  { c: '飲む場所', w: ['屋台', '立ち飲み', '温泉宿', '花見', '海の家', '屋形船'] },
  { c: 'イベント', w: ['花火大会', '忘年会', '結婚式', '同窓会', '夏祭り', '正月'] },
  { c: '締めの一品', w: ['ラーメン', 'お茶漬け', 'おにぎり', 'そば', '雑炊', 'アイス'] },
  { c: '旅行先', w: ['京都', '沖縄', '北海道', 'ハワイ', 'パリ', '韓国'] }
];
export const SEATS = ['カウンター', '奥の座敷', '窓ぎわ', '入口そば'];
export const DRINKS = ['日本酒', 'ハイボール', '焼酎', '赤ワイン'];
export const COATS = ['黒', '紺', '茶', '灰色'];
const BOTTLES = ['三十年ものの古酒「月の雫」', '幻の焼酎「夜鷹」', '店主秘蔵のウイスキー「百年樽」', '一本だけ残った大吟醸「雪灯り」'];
const GEST = ['グラスを左手で持つ', '乾杯のとき、目をそらす', '話す前に、耳たぶを触る', '笑うとき、口を手で隠す', 'グラスを置くとき、指で2回たたく', 'おしぼりを、四角にたたむ', '飲む前に、グラスを少し回す', '相づちで「なるほど」と言う', '箸の向きを逆にして置く', '話を聞くとき、ほおづえをつく'];
const TITLES = ['長男', '元秘書', '行きつけの店の大将', '主治医', '釣り仲間', '運転手', '姪', '骨董商', '顧問弁護士', '幼なじみ', '料理番', '庭師'];
export const SROLE = { yashin: '野心家', chushin: '忠臣', kyuteki: '仇敵', shakkin: '借金取り', kakushi: '隠し子' };

const T = (sec, opts) => ({ k: 'time', label: '話し合いの時間', opts: opts.map(m => [String(m * 60), m ? m + '分' : 'なし']), def: String(sec) });

export const GAMES = {
  mogu: {
    name: 'もぐり酒場', min: 5, max: 10, people: '5〜10人', mins: '約10分',
    short: 'みんなが知っている合言葉を、1人だけ知らない。その1人を探せ。',
    how: ['スマホに合言葉が届きます。1人だけ「取締官」で、合言葉を知りません', '順番に、合言葉を連想させる「ひとこと」を言います（合言葉そのものは言わない）', '話がかみ合わない人に投票します'],
    win: 'みんな：取締官を当てたら勝ち。取締官：逃げきるか、最後に合言葉を当てたら勝ち',
    example: '例：合言葉が「枝豆」なら「夏に合う」「緑色」など',
    settings: [
      { k: 'cat', label: 'お題のジャンル', opts: [['rand', 'おまかせ']].concat(WORDS.map((w, i) => [String(i), w.c])), def: 'rand' },
      { k: 'agents', label: '取締官の人数', opts: [['1', '1人'], ['2', '2人（7人以上）']], def: '1' },
      { k: 'laps', label: 'ひとことを言う回数', opts: [['1', '1周'], ['2', '2周'], ['3', '3周']], def: '2' },
      T(180, [0, 2, 3, 5])
    ]
  },
  bottle: {
    name: '消えたボトル', min: 4, max: 8, people: '4〜8人', mins: '約15分',
    short: '店一番のボトルを盗んだ犯人が、この中に1人。',
    how: ['スマホに「証言」が届きます。犯人だけは、ウソの証言をします', '順番に、自分の証言を読み上げます', 'みんなの席・お酒・上着の表と見比べて、犯人に投票します'],
    win: 'みんな：犯人を当てたら勝ち。犯人：ほかの人に票を集めたら勝ち',
    example: '例：「犯人は窓ぎわにいた」という証言があれば、窓ぎわの人があやしい',
    settings: [
      { k: 'level', label: '難しさ', opts: [['easy', 'やさしい'], ['normal', 'ふつう']], def: 'easy' },
      T(300, [0, 3, 5, 10])
    ]
  },
  kessha: {
    name: '秘密結社の乾杯', min: 8, max: 30, people: '8〜30人', mins: '飲み会のあいだ',
    short: 'しゃべらずに、仕草だけで仲間を探す。',
    how: ['スマホに「月の会」か「星の会」と、仲間の合図（仕草）が届きます', '普通に飲みながら、こっそり合図を出して、同じ仕草の人を探します', 'お開きの前に、相手チームの合図を当てます'],
    win: '相手チームの合図を当てたら勝ち（チームの半分以上が正解で当たり）',
    example: '例：合図が「グラスを左手で持つ」なら、ときどき左手で飲む',
    settings: [
      { k: 'spy', label: '密偵（両方の合図を知るスパイ）', opts: [['auto', '12人以上なら入れる'], ['on', '入れる'], ['off', '入れない']], def: 'auto' },
      { k: 'cands', label: '答えの選択肢', opts: [['4', '4つ（やさしい）'], ['6', '6つ'], ['8', '8つ（難しい）']], def: '6' }
    ]
  },
  souzoku: {
    name: '相続会議', min: 6, max: 12, people: '6〜12人', mins: '約15分',
    short: '遺産を継ぐのは誰か。ひとりひとり、ねらいが違う。',
    how: ['スマホに「肩書き」と「秘密のねらい」が届きます', '順番に肩書きを名乗り、そのあとは自由に話し合い・取引をします', '最後に、遺産を継ぐ人を1人選んで投票します（自分には入れられない）'],
    win: '自分の「ねらい」が叶ったら勝ち。勝つ人は何人いてもいい',
    example: '例：「〇〇さんに継がせたい」なら、その人に票が集まるよう説得する',
    settings: [T(480, [3, 5, 8, 10])]
  }
};
export const ORDER = ['mogu', 'bottle', 'kessha', 'souzoku'];

export function defaults(game) {
  const o = {};
  GAMES[game].settings.forEach(s => { o[s.k] = s.def; });
  return o;
}
function cfg(game, settings) {
  const d = defaults(game), o = {};
  GAMES[game].settings.forEach(s => {
    const v = settings && settings[s.k];
    o[s.k] = s.opts.some(x => x[0] === v) ? v : d[s.k];
  });
  return o;
}
/** 設定を一行の説明にする（参加者の待ち画面に出す） */
export function settingsText(game, settings) {
  const c = cfg(game, settings);
  return GAMES[game].settings.map(s => `${s.label}：${(s.opts.find(x => x[0] === c[s.k]) || s.opts[0])[1]}`).join(' ／ ');
}

const rint = (n, r) => Math.floor(r() * n);
const pick = (a, r) => a[rint(a.length, r)];
function shuffle(a, r) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rint(i + 1, r); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// 役の紙。保存先は undefined を受け付けないので、ある項目だけを入れる。
function card(role, goal, lines, small) {
  const o = { role, goal, lines };
  if (small) o.small = small;
  return o;
}

function dealMogu(order, names, c, r) {
  const g = c.cat === 'rand' ? pick(WORDS, r) : WORDS[Number(c.cat)];
  const word = pick(g.w, r);
  const na = c.agents === '2' && order.length >= 7 ? 2 : 1;
  const agents = shuffle(order, r).slice(0, na), secret = {};
  order.forEach(p => {
    secret[p] = agents.includes(p)
      ? card('取締官', '合言葉を知らないことを、バレないようにする', ['みんなの「ひとこと」から合言葉を推理して、知っているふりをしてください。', na === 2 ? 'この中に、取締官がもう1人います。誰かは知らされていません。' : ''].filter(Boolean), '合言葉は、この6つのどれかです：' + g.w.join('、'))
      : card('客', '合言葉：' + word, ['合言葉そのものは言わずに、連想させる「ひとこと」を言ってください。', '取締官は合言葉を知りません。話がかみ合わない人を探しましょう。'], 'はっきり言いすぎると、取締官に合言葉を当てられます。');
  });
  return { secret, pub: { cat: g.c, cands: g.w, na }, ans: { word, agents } };
}

function dealBottle(order, names, c, r) {
  const cul = pick(order, r), s = rint(4, r), d = rint(4, r), k = rint(4, r);
  const oth = v => { let x; do { x = rint(4, r); } while (x === v); return x; };
  const attrs = { [cul]: [s, d, k] };
  const inn = shuffle(order.filter(p => p !== cul), r);
  // 最初の3人は、犯人と1か所だけ違う。犯人がウソで疑いを向ける相手になる。
  const near = [[oth(s), d, k], [s, oth(d), k], [s, d, oth(k)]];
  inn.forEach((p, j) => {
    if (j < 3) attrs[p] = near[j];
    else { let t; do { t = [rint(4, r), rint(4, r), rint(4, r)]; } while (t[0] === s && t[1] === d && t[2] === k); attrs[p] = t; }
  });
  const pos = [`犯人は「${SEATS[s]}」の席にいた`, `犯人は「${DRINKS[d]}」を飲んでいた`, `犯人の上着は「${COATS[k]}」だった`];
  const clues = {};
  shuffle(inn, r).forEach((p, j) => {
    if (j < 3) clues[p] = pos[j];
    else if (c.level === 'easy') clues[p] = pos[j % 3]; // やさしい：本当の手がかりが2回ずつ出るので、ウソが目立つ
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
    secret[p] = p === cul
      ? card('犯人', 'ウソの証言で、ほかの人に疑いを向ける', [`あなたの番が来たら、このウソを読み上げてください：「${lie}」`, `そうすれば、${names[ft]}さんが疑われます。もちろん、自分で考えたウソでもかまいません。`], '自分の席・お酒・上着は、表でみんなに見えています。')
      : card('目撃者', '証言：' + clues[p], ['あなたの番が来たら、この証言をそのまま読み上げてください。', '証言と表を見比べて、犯人を探しましょう。'], '犯人も目撃者のふりをして、ウソの証言をします。');
  });
  return { secret, pub: { bottle: pick(BOTTLES, r), attrs }, ans: { c: cul, pos, clues } };
}

function dealKessha(order, names, c, r) {
  const sh = shuffle(order, r);
  const withSpy = c.spy === 'on' || (c.spy === 'auto' && order.length >= 12);
  const spy = withSpy ? sh.pop() : '';
  const half = Math.ceil(sh.length / 2);
  const moon = sh.slice(0, half), star = sh.slice(half);
  const cs = shuffle(GEST, r).slice(0, Number(c.cands)), gm = cs[0], gs = cs[1];
  const secret = {};
  order.forEach(p => {
    if (p === spy) secret[p] = card('密偵', '最後まで、密偵だとバレない', [`月の会の合図：${gm}`, `星の会の合図：${gs}`, '両方の合図を使い分けて、どちらの仲間のふりもしてください。'], '最後の投票で、密偵だと当てられなければ勝ちです。');
    else {
      const m = moon.includes(p);
      secret[p] = card(m ? '月の会' : '星の会', '仲間の合図：' + (m ? gm : gs), ['飲み会のあいだ、ときどきさりげなく、この仕草をしてください。', '同じ仕草をしている人が仲間です。言葉で確かめてはいけません。'], '相手チームの仕草も、こっそり見破ってください。最後に当てます。');
    }
  });
  return { secret, pub: { cands: shuffle(cs, r), nm: moon.length, ns: star.length, hasSpy: !!spy }, ans: { moon, star, spy, gm, gs } };
}

function dealSouzoku(order, names, c, r) {
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
    const goal = ro === 'yashin' ? '自分が遺産を継ぐ（いちばん多く票を集める）'
      : ro === 'chushin' ? `${t}さんに、遺産を継がせる`
      : ro === 'kyuteki' ? `${t}さんにだけは、遺産を継がせない`
      : ro === 'shakkin' ? '遺産を継ぐ人に、自分の1票を入れる'
      : '自分に2票以上集める';
    const hint = ro === 'yashin' ? 'ほかにも野心家がいます。説得や取引で票を集めてください。'
      : ro === 'chushin' ? '本人にも、ねらいは明かさないほうが動きやすいでしょう。'
      : ro === 'kyuteki' ? '同点で誰も継げなくても、あなたの勝ちです。'
      : ro === 'shakkin' ? '誰が勝ちそうかを見きわめて、勝ち馬に乗ってください。'
      : '遺産は要りません。家族として認めてほしいだけです。';
    secret[p] = card(`${tl[i]}（${SROLE[ro]}）`, goal, [hint], `みんなには「${tl[i]}」と名乗ってください。${SROLE[ro]}であることは秘密です。`);
  });
  return { secret, pub: { titles }, ans: { role, target } };
}

const DEALERS = { mogu: dealMogu, bottle: dealBottle, kessha: dealKessha, souzoku: dealSouzoku };
const SAY = { mogu: '合言葉を連想させる「ひとこと」を言ってください', bottle: 'スマホに届いた証言を、読み上げてください', souzoku: '肩書きを名乗って、遺産への思いをひとこと' };
export const TALK = {
  mogu: '自由に話し合って、合言葉を知らなさそうな人を探してください',
  bottle: '表と証言を見比べて、誰がウソをついているか話し合ってください',
  kessha: '普通に飲んでください。ときどき、こっそり合図の仕草を',
  souzoku: '自由に話し合い・取引をしてください。ウソもOKです'
};

/** players: [{id,name}]。1回ぶんの配役と、話す順番を返す */
export function deal(game, players, settings = {}, r = Math.random) {
  const order = players.map(p => p.id), names = {};
  players.forEach(p => { names[p.id] = p.name; });
  const c = cfg(game, settings);
  const d = Object.assign({ game, order, names, time: Number(c.time || 0) }, DEALERS[game](order, names, c, r));
  // 順番に話す段取り。最初の人は毎回変わる。
  const laps = game === 'mogu' ? Number(c.laps) : game === 'kessha' ? 0 : 1;
  const start = rint(order.length, r), seq = order.slice(start).concat(order.slice(0, start)), steps = [];
  for (let l = 0; l < laps; l++) seq.forEach(p => steps.push({ who: p, lap: l + 1 }));
  d.steps = steps;
  d.laps = laps;
  d.say = SAY[game] || '';
  return d;
}

/** 投票する人（密偵は投票しない） */
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

/** 投票から勝敗を出す。guess は捕まった取締官が選んだ合言葉の番号（まだなら -1） */
export function outcome(d, votes = {}, guess = -1) {
  const a = d.ans, v = votes || {};
  if (d.game === 'mogu') {
    const tl = tally(d.order, d.order.map(p => v[p]).filter(Boolean));
    const caught = a.agents.includes(tl.top);
    const hit = caught && guess >= 0 && d.pub.cands[guess] === a.word;
    const agentsWin = !caught || hit;
    return { tally: tl.t, max: tl.max, acc: tl.top, caught, needGuess: caught && guess < 0, hit,
      winners: d.order.filter(p => a.agents.includes(p) === agentsWin),
      verdict: !caught ? '取締官の勝ち！ 見破れませんでした' : hit ? '取締官の大逆転！ 合言葉を当てました' : 'みんなの勝ち！ 取締官を見破りました' };
  }
  if (d.game === 'bottle') {
    const tl = tally(d.order, d.order.map(p => v[p]).filter(Boolean));
    const ok = tl.top === a.c;
    return { tally: tl.t, max: tl.max, acc: tl.top, ok,
      winners: d.order.filter(p => (p === a.c) !== ok),
      verdict: ok ? 'みんなの勝ち！ ボトルは棚に戻りました' : '犯人の勝ち！ ボトルを抱えて夜の街へ' };
  }
  if (d.game === 'kessha') {
    const right = (grp, g) => grp.filter(p => v[p] && d.pub.cands[v[p].g] === g).length;
    const mr = right(a.moon, a.gs), sr = right(a.star, a.gm);
    const moonHit = mr * 2 > a.moon.length, starHit = sr * 2 > a.star.length;
    let spyHit = false;
    if (a.spy) spyHit = tally(d.order, d.order.filter(p => p !== a.spy).map(p => v[p] && v[p].spy).filter(Boolean)).top === a.spy;
    const winners = (moonHit ? a.moon : []).concat(starHit ? a.star : []).concat(a.spy && !spyHit ? [a.spy] : []);
    return { mr, sr, moonHit, starHit, spyHit, winners,
      verdict: moonHit && !starHit ? '月の会の勝ち！' : starHit && !moonHit ? '星の会の勝ち！' : moonHit ? '両チームとも見破った！ 引き分け' : '両チームとも隠しきった！ 引き分け' };
  }
  const tl = tally(d.order, d.order.map(p => (v[p] && v[p] !== p) ? v[p] : '').filter(Boolean));
  const w = tl.top, won = {}, goal = {};
  d.order.forEach(p => {
    const ro = a.role[p], t = a.target[p], tn = d.names[t];
    won[p] = ro === 'yashin' ? w === p : ro === 'chushin' ? w === t : ro === 'kyuteki' ? w !== t : ro === 'shakkin' ? (w !== '' && v[p] === w) : tl.t[p] >= 2;
    goal[p] = ro === 'yashin' ? '自分が継ぐ' : ro === 'chushin' ? `${tn}さんに継がせる` : ro === 'kyuteki' ? `${tn}さんに継がせない` : ro === 'shakkin' ? '継ぐ人に投票する' : '2票以上もらう';
  });
  return { tally: tl.t, max: tl.max, w, won, goal, winners: d.order.filter(p => won[p]),
    verdict: w ? `遺産は${d.names[w]}さんの手に！` : '同点！ 遺産は寄付されました' };
}
