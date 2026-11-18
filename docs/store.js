// 部屋のデータの置き場所。
// 接続先が設定されていれば Firebase、なければ「お試しモード」（同じ端末のタブ同士だけがつながる）。

const SDK = 'https://www.gstatic.com/firebasejs/13.3.0/';

export async function makeStore(config) {
  const ready = config && config.apiKey && config.databaseURL && !/^YOUR/.test(config.apiKey);
  if (!ready) return localStore(false);
  try {
    const [{ initializeApp }, m] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-database.js')]);
    const db = m.getDatabase(initializeApp(config));
    const ref = p => m.ref(db, p);
    return {
      mode: 'online', failed: false,
      get: async p => (await m.get(ref(p))).val(),
      set: (p, v) => m.set(ref(p), v),
      update: (p, o) => m.update(ref(p), o),
      remove: p => m.remove(ref(p)),
      watch: (p, cb, onErr) => m.onValue(ref(p), s => cb(s.val()), e => { if (onErr) onErr(e); })
    };
  } catch (e) {
    console.error('Firebase に接続できませんでした', e);
    return localStore(true);
  }
}

function localStore(failed) {
  const KEY = 'sakaba-db';
  let tree = {};
  const load = () => { try { tree = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { /* 保存先が使えなければ、このタブの中だけで動かす */ } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(tree)); } catch (e) { /* 同上 */ } };
  load();
  let ch = null;
  try { ch = new BroadcastChannel('sakaba'); } catch (e) { /* 使えない環境では、タブ同士はつながらない */ }
  const watchers = new Set();
  const read = p => { let o = tree; for (const k of p.split('/')) { if (o === null || typeof o !== 'object' || !(k in o)) return null; o = o[k]; } return o === undefined ? null : o; };
  const write = (p, v) => {
    const ks = p.split('/'), last = ks.pop();
    let o = tree;
    for (const k of ks) { if (o[k] === null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
    if (v === null || v === undefined) delete o[last]; else o[last] = JSON.parse(JSON.stringify(v));
  };
  const fire = () => watchers.forEach(w => w.cb(read(w.p)));
  // ほかのタブへは「何を書いたか」そのものを送る。保存先の反映はタブごとに遅れることがあり、
  // 合図だけ送って読み直させると、古い内容を読んでしまう。
  const commit = ops => { ops.forEach(([p, v]) => write(p, v)); save(); if (ch) ch.postMessage(ops); fire(); };
  if (ch) ch.onmessage = e => { (e.data || []).forEach(([p, v]) => write(p, v)); fire(); };
  return {
    mode: 'local', failed,
    get: async p => read(p),
    set: async (p, v) => commit([[p, v]]),
    update: async (p, o) => commit(Object.keys(o).map(k => [p + '/' + k, o[k]])),
    remove: async p => commit([[p, null]]),
    watch: (p, cb) => { const w = { p, cb }; watchers.add(w); Promise.resolve().then(() => { if (watchers.has(w)) cb(read(p)); }); return () => watchers.delete(w); }
  };
}
