/* ブラウザ内エンジン: データ生成・保存・集計・将来推計・画像・AI 呼び出し（サーバー不要） */
window.Engine = (() => {
  // ------------------------------------------------------------------ マスタ
  const RAW = [
    [1,"北海道","北海道",5225,4523,32.1,38.1],[2,"青森県","東北",1238,965,33.7,41.7],[3,"岩手県","東北",1211,980,33.6,40.3],[4,"宮城県","東北",2302,2049,28.3,34.3],
    [5,"秋田県","東北",960,713,37.5,44.5],[6,"山形県","東北",1068,870,33.8,40.0],[7,"福島県","東北",1833,1500,31.7,38.6],[8,"茨城県","関東",2867,2560,29.7,35.0],
    [9,"栃木県","関東",1933,1725,29.1,34.4],[10,"群馬県","関東",1939,1730,30.2,34.9],[11,"埼玉県","関東",7345,7100,27.0,31.0],[12,"千葉県","関東",6284,6080,27.9,31.9],
    [13,"東京都","関東",14048,14200,22.7,24.9],[14,"神奈川県","関東",9237,9050,25.6,29.6],[15,"新潟県","中部",2201,1835,32.8,39.0],[16,"富山県","中部",1035,890,32.6,37.3],
    [17,"石川県","中部",1133,1010,29.8,34.5],[18,"福井県","中部",767,665,30.6,35.9],[19,"山梨県","中部",810,700,30.8,36.3],[20,"長野県","中部",2048,1790,32.0,36.9],
    [21,"岐阜県","中部",1979,1710,30.4,35.5],[22,"静岡県","中部",3633,3220,30.1,35.3],[23,"愛知県","中部",7542,7250,25.3,29.3],[24,"三重県","近畿",1770,1560,29.9,35.0],
    [25,"滋賀県","近畿",1414,1340,26.3,31.5],[26,"京都府","近畿",2578,2340,29.3,33.8],[27,"大阪府","近畿",8838,8250,27.6,31.6],[28,"兵庫県","近畿",5465,4980,29.3,34.0],
    [29,"奈良県","近畿",1324,1140,31.7,38.0],[30,"和歌山県","近畿",923,760,33.1,39.5],[31,"鳥取県","中国",553,480,32.3,37.3],[32,"島根県","中国",671,580,34.3,38.9],
    [33,"岡山県","中国",1888,1700,30.3,34.6],[34,"広島県","中国",2800,2530,29.4,34.0],[35,"山口県","中国",1342,1130,34.6,39.7],[36,"徳島県","四国",720,600,34.2,40.3],
    [37,"香川県","四国",950,830,31.8,37.0],[38,"愛媛県","四国",1335,1130,33.2,38.7],[39,"高知県","四国",692,570,35.5,41.0],[40,"福岡県","九州・沖縄",5135,4900,27.9,32.7],
    [41,"佐賀県","九州・沖縄",811,720,30.6,35.6],[42,"長崎県","九州・沖縄",1312,1100,33.0,39.0],[43,"熊本県","九州・沖縄",1738,1560,31.4,36.1],[44,"大分県","九州・沖縄",1124,980,33.3,38.3],
    [45,"宮崎県","九州・沖縄",1070,930,32.8,37.7],[46,"鹿児島県","九州・沖縄",1588,1370,32.5,38.0],[47,"沖縄県","九州・沖縄",1467,1460,22.6,28.0]];
  const PREF = {}; RAW.forEach(([code, name, region, p20, p35, a20, a35]) => { PREF[code] = { code, name, region, pop_2020: p20, pop_2035: p35, aged65_2020: a20, aged65_2035: a35, total_change_ratio: +(p35 / p20).toFixed(4) }; });
  const PREFS = Object.values(PREF);
  const REGIONS = [...new Set(PREFS.map((p) => p.region))];
  const LICENSE_TYPES = ["普通", "準中型", "中型", "大型", "普通二輪", "大型二輪", "原付", "小型特殊", "大型特殊", "けん引", "普通二種", "大型二種"];
  const COLORS = ["グリーン", "ブルー", "ゴールド"];
  const SEXES = ["男性", "女性"];
  const CONDITIONS = ["", "眼鏡等", "AT限定", "眼鏡等・AT限定", "補聴器", "眼鏡等・補聴器"];
  const STATUSES = ["有効", "失効", "返納"];
  const AGE_BANDS = [[16, 19], [20, 29], [30, 39], [40, 49], [50, 59], [60, 69], [70, 74], [75, 79], [80, 84], [85, 120]];
  const AGE_BAND_LABELS = ["16-19", "20代", "30代", "40代", "50代", "60代", "70-74", "75-79", "80-84", "85+"];
  const bandOf = new Uint8Array(121); for (let a = 0; a <= 120; a++) { bandOf[a] = 0; AGE_BANDS.forEach(([lo, hi], i) => { if (a >= lo && a <= hi) bandOf[a] = i; }); }
  const SURNAMES = ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田", "佐々木", "山口", "松本", "井上", "木村", "林", "斎藤", "清水", "山崎", "森", "池田", "橋本", "阿部", "石川", "山下", "中島", "石井", "小川", "前田", "岡田", "長谷川", "藤田", "後藤", "近藤", "村上", "遠藤", "青木", "坂本", "斉藤", "福田", "太田", "西村", "藤井"];
  const SURNAMES_KANA = ["サトウ", "スズキ", "タカハシ", "タナカ", "イトウ", "ワタナベ", "ヤマモト", "ナカムラ", "コバヤシ", "カトウ", "ヨシダ", "ヤマダ", "ササキ", "ヤマグチ", "マツモト", "イノウエ", "キムラ", "ハヤシ", "サイトウ", "シミズ", "ヤマザキ", "モリ", "イケダ", "ハシモト", "アベ", "イシカワ", "ヤマシタ", "ナカジマ", "イシイ", "オガワ", "マエダ", "オカダ", "ハセガワ", "フジタ", "ゴトウ", "コンドウ", "ムラカミ", "エンドウ", "アオキ", "サカモト", "サイトウ", "フクダ", "オオタ", "ニシムラ", "フジイ"];
  const GIVEN = [["太郎", "健太", "大輔", "翔太", "拓也", "誠", "浩", "隆", "健一", "直樹", "蓮", "悠真", "陽翔", "颯太", "大和", "修", "正雄", "勝", "茂", "清"], ["花子", "美咲", "さくら", "陽菜", "結衣", "愛", "優子", "恵子", "裕子", "久美子", "葵", "凛", "芽依", "和子", "幸子", "節子", "文子", "明美", "由美", "真由美"]];
  const GIVEN_KANA = [["タロウ", "ケンタ", "ダイスケ", "ショウタ", "タクヤ", "マコト", "ヒロシ", "タカシ", "ケンイチ", "ナオキ", "レン", "ユウマ", "ハルト", "ソウタ", "ヤマト", "オサム", "マサオ", "マサル", "シゲル", "キヨシ"], ["ハナコ", "ミサキ", "サクラ", "ヒナ", "ユイ", "アイ", "ユウコ", "ケイコ", "ユウコ", "クミコ", "アオイ", "リン", "メイ", "カズコ", "サチコ", "セツコ", "フミコ", "アケミ", "ユミ", "マユミ"]];
  const TOWNS = ["中央", "本町", "栄町", "緑町", "旭町", "幸町", "桜町", "若葉", "大手町", "新町", "東", "西", "南", "北", "駅前", "港町", "山手", "川沿", "田園", "高台"];
  const MUNI_SUFFIX = ["市", "市", "市", "町", "区"];
  const URBAN = new Set([11, 12, 13, 14, 23, 26, 27, 28]);
  const POPULATION_HOLDERS_JP = 81_000_000;

  const SCENARIOS = {
    base: { name: "基準シナリオ", return_rate_mult: 1, acquisition_mult: 1, population_adjust: 0, migration_to_urban: 0, notes: "IPSS 推計どおりの人口変化、返納率・取得率は現状維持" },
    return_up: { name: "返納促進シナリオ", return_rate_mult: 1.6, acquisition_mult: 1, population_adjust: 0, migration_to_urban: 0, notes: "75歳以上の返納促進策が強化され返納率 1.6 倍" },
    youth_decline: { name: "若年取得減少シナリオ", return_rate_mult: 1, acquisition_mult: 0.8, population_adjust: 0, migration_to_urban: 0, notes: "若年層の免許取得率が 2 割低下" },
    urban_shift: { name: "都市集中シナリオ", return_rate_mult: 1, acquisition_mult: 1, population_adjust: -0.02, migration_to_urban: 0.004, notes: "地方から三大都市圏への流出が加速、地方人口は推計比 2% 下振れ" },
    autonomous: { name: "自動運転普及シナリオ", return_rate_mult: 1.3, acquisition_mult: 0.9, population_adjust: 0, migration_to_urban: 0, notes: "移動サービスの普及で返納が増え、若年取得も減少" },
  };

  // ------------------------------------------------------------------ 乱数
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hash(i, salt) { let h = (i * 2654435761 + salt * 40503) >>> 0; h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; }
  const DAY = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const TODAY_DAY = Math.floor(today.getTime() / DAY);
  const dayToStr = (d) => new Date(d * DAY).toISOString().slice(0, 10);
  const strToDay = (s) => Math.floor(Date.parse(s + "T00:00:00Z") / DAY);
  const ageFromBirth = (bday) => { const b = new Date(bday * DAY); let a = today.getUTCFullYear() - b.getUTCFullYear(); if (today.getUTCMonth() < b.getUTCMonth() || (today.getUTCMonth() === b.getUTCMonth() && today.getUTCDate() < b.getUTCDate())) a--; return a; };

  // ------------------------------------------------------------------ データ（列指向の TypedArray）
  const D = { n: 0, seed: 42, f: null, over: new Map(), extra: [], deleted: new Set() };
  const AGE_W = []; { const push = (k, v) => { for (let i = 0; i < k; i++) AGE_W.push(v); }; [0.05, 0.23, 0.42, 0.6].forEach((v) => AGE_W.push(v)); push(10, 1); push(10, 1.05); push(10, 1.35); push(10, 1.3); push(10, 1.15); push(5, 1); push(5, 0.7); push(5, 0.35); for (let i = 0; i < 16; i++) AGE_W.push(0.15 - (0.14 * i) / 15); }
  function cdf(w) { const s = w.reduce((a, b) => a + b, 0); const c = []; let acc = 0; for (const x of w) { acc += x / s; c.push(acc); } return c; }
  function pick(c, u) { let lo = 0, hi = c.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (u <= c[m]) hi = m; else lo = m + 1; } return lo; }

  async function generate(n, seed = 42, onProgress) {
    D.n = n; D.seed = seed;
    const F = D.f = {
      pref: new Uint8Array(n), age: new Uint8Array(n), sex: new Uint8Array(n), typeTop: new Uint8Array(n), typeMask: new Uint16Array(n), color: new Uint8Array(n),
      cond: new Uint8Array(n), birth: new Int32Array(n), issue: new Int32Array(n), expiry: new Int32Array(n), firstYear: new Uint16Array(n), points: new Uint8Array(n),
      status: new Uint8Array(n), ocr: new Uint8Array(n), hasImage: new Uint8Array(n),
    };
    const r = rng(seed);
    const codes = PREFS.map((p) => p.code);
    const prefCdf = cdf(PREFS.map((p) => p.pop_2020 * ((p.code === 13 || p.code === 27) ? 0.62 : [11, 12, 14, 23, 26, 28, 40].includes(p.code) ? 0.68 : 0.74)));
    const ageCdfByPref = {}; const ages = []; for (let a = 16; a <= 100; a++) ages.push(a);
    for (const p of PREFS) { const dev = (p.aged65_2020 - 28.6) / 28.6; ageCdfByPref[p.code] = cdf(ages.map((a, i) => { const ramp = Math.min(1, Math.max(0, (a - 50) / 25)); return AGE_W[i] * Math.max(0.2, 1 + dev * (ramp * 1.6 - (1 - ramp) * 0.5)); })); }
    const todayY = today.getUTCFullYear(), todayM = today.getUTCMonth() + 1, todayD = today.getUTCDate();
    const chunk = 50000;
    for (let i = 0; i < n; i++) {
      const pref = codes[pick(prefCdf, r())]; F.pref[i] = pref;
      const age = 16 + pick(ageCdfByPref[pref], r()); F.age[i] = age;
      const sex = r() < Math.min(0.75, Math.max(0.45, 0.55 - (age - 50) * 0.0025)) ? 0 : 1; F.sex[i] = sex;
      let y = todayY - age; const m = 1 + Math.floor(r() * 12), d = 1 + Math.floor(r() * 28);
      if (!(m < todayM || (m === todayM && d <= todayD))) y -= 1;
      F.birth[i] = strToDay(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
      // 免許種類
      const u = r(); let top = 0; const old = age >= 45;
      if (u < 0.08 && sex === 0) top = 3; else if (u < 0.14 && sex === 0) top = 2; else if (u >= 0.14 && u < 0.40 && old) top = 2; else if (u >= 0.40 && u < 0.46 && age < 45) top = 1; else if (u >= 0.46 && u < 0.49 && sex === 0 && age >= 25) top = 11; else if (u >= 0.49 && u < 0.50) top = 10;
      let mask = 1 << top;
      if (r() < 0.11) mask |= 1 << 4; if (r() < 0.05 && sex === 0) mask |= 1 << 5; if (r() < 0.30 && age >= 50) mask |= 1 << 6; if (r() < 0.04) mask |= 1 << 8;
      F.typeTop[i] = top; F.typeMask[i] = mask;
      // 色
      const pg = Math.min(0.8, Math.max(0.05, 0.15 + (age - 20) * 0.012)); const pgreen = age <= 21 ? 0.9 : age <= 24 ? 0.3 : 0; const uc = r();
      const color = uc < pgreen ? 0 : uc < pgreen + pg * (1 - pgreen) ? 2 : 1; F.color[i] = color;
      // 条件
      const cr = r(); const at = r() < (sex === 1 ? 0.55 : 0.25) && age < 60; const glasses = cr < Math.min(0.6, Math.max(0.2, 0.25 + (age - 30) * 0.004));
      F.cond[i] = glasses && at ? 3 : glasses ? 1 : at ? 2 : cr > 0.97 && age >= 70 ? 4 : 0;
      // 交付・期限
      let fy = y + 18 + Math.floor(r() * 5); if (fy > todayY) fy = todayY - Math.min(Math.max(age - 17, 0), Math.floor(r() * 3)); F.firstYear[i] = Math.max(1950, fy);
      const yv = age >= 71 ? 3 : age === 70 ? 4 : color === 2 ? 5 : color === 0 ? 3 : 5;
      const since = Math.floor(r() * yv * 365); F.issue[i] = TODAY_DAY - since; F.expiry[i] = F.issue[i] + yv * 365 + 30;
      const s = r(); let st = 0; if (age >= 75 && s < 0.004 * (age - 70)) st = 2; else if (s > 0.985) { st = 1; F.expiry[i] = TODAY_DAY - 1 - Math.floor(r() * 700); } F.status[i] = st;
      const pr = r(); F.points[i] = color === 2 ? 0 : pr < 0.7 ? 0 : pr < 0.8 ? 1 : pr < 0.88 ? 2 : pr < 0.94 ? 3 : pr < 0.98 ? 6 : 0;
      let g = 0; for (let k = 0; k < 4; k++) g += r(); F.ocr[i] = Math.round(Math.min(100, Math.max(50, 96 + (g - 2) * 4)));
      if (i % chunk === chunk - 1) { if (onProgress) onProgress(i + 1, n); await new Promise((res) => setTimeout(res, 0)); }
    }
    for (let i = 0; i < Math.min(n, 100); i++) F.hasImage[i] = 1;
    D.over = new Map(); D.extra = []; D.deleted = new Set();
    await persistMeta();
    if (onProgress) onProgress(n, n);
  }

  // 派生文字列（id から決定的に生成）
  function derived(i) {
    const F = D.f, sex = F.sex[i];
    const si = hash(i, 1) % SURNAMES.length, gi = hash(i, 2) % 20; const pref = F.pref[i];
    const muni = SURNAMES[hash(i, 3) % 45] + MUNI_SUFFIX[hash(i, 4) % 5];
    return {
      name: SURNAMES[si] + " " + GIVEN[sex][gi], name_kana: SURNAMES_KANA[si] + " " + GIVEN_KANA[sex][gi], municipality: muni,
      address: PREF[pref].name + muni + TOWNS[hash(i, 5) % 20] + (1 + hash(i, 6) % 5) + "丁目" + (1 + hash(i, 7) % 29) + "-" + (1 + hash(i, 8) % 19),
      license_no: String(pref).padStart(2, "0") + String(F.firstYear[i] % 100).padStart(2, "0") + String(hash(i, 9) % 1e7).padStart(7, "0") + String(hash(i, 10) % 10),
    };
  }
  function baseRecord(i) {
    const F = D.f; const d = derived(i); const types = []; for (let k = 0; k < 12; k++) if (F.typeMask[i] & (1 << k)) types.push(LICENSE_TYPES[k]);
    return { id: i + 1, ...d, sex: SEXES[F.sex[i]], birth_date: dayToStr(F.birth[i]), age: F.age[i], prefecture_code: F.pref[i], license_type: LICENSE_TYPES[F.typeTop[i]], license_types: types.join(","),
      color: COLORS[F.color[i]], conditions: CONDITIONS[F.cond[i]], issue_date: dayToStr(F.issue[i]), expiry_date: dayToStr(F.expiry[i]), first_issue_year: F.firstYear[i], violation_points: F.points[i],
      image_path: F.hasImage[i] ? `img/${i + 1}.png` : null, ocr_confidence: F.ocr[i] / 100, status: STATUSES[F.status[i]], updated_at: dayToStr(TODAY_DAY) + "T00:00:00" };
  }
  function getRecord(id) {
    if (D.deleted.has(id)) return null;
    if (id > D.n) { const e = D.extra.find((x) => x.id === id); return e ? { ...e } : null; }
    if (id < 1) return null;
    const r = baseRecord(id - 1); const o = D.over.get(id); return o ? { ...r, ...o } : r;
  }
  // 編集を TypedArray にも反映（集計に効かせる）
  function applyToColumns(id, rec) {
    if (id > D.n) return; const i = id - 1, F = D.f;
    F.pref[i] = rec.prefecture_code; F.sex[i] = SEXES.indexOf(rec.sex); F.birth[i] = strToDay(rec.birth_date); F.age[i] = rec.age;
    F.typeTop[i] = Math.max(0, LICENSE_TYPES.indexOf(rec.license_type)); let m = 0; (rec.license_types || rec.license_type).split(",").forEach((t) => { const k = LICENSE_TYPES.indexOf(t.trim()); if (k >= 0) m |= 1 << k; }); F.typeMask[i] = m || (1 << F.typeTop[i]);
    F.color[i] = Math.max(0, COLORS.indexOf(rec.color)); F.cond[i] = Math.max(0, CONDITIONS.indexOf(rec.conditions || "")); F.issue[i] = strToDay(rec.issue_date); F.expiry[i] = strToDay(rec.expiry_date);
    F.firstYear[i] = rec.first_issue_year || 0; F.points[i] = rec.violation_points || 0; F.status[i] = Math.max(0, STATUSES.indexOf(rec.status)); F.ocr[i] = Math.round((rec.ocr_confidence ?? 0.95) * 100); F.hasImage[i] = rec.image_path ? 1 : 0;
  }

  // ------------------------------------------------------------------ 永続化 (IndexedDB)
  let idb;
  function openDb() { return new Promise((res, rej) => { const q = indexedDB.open("license-analytics", 1); q.onupgradeneeded = () => { const db = q.result; db.createObjectStore("kv"); db.createObjectStore("images"); }; q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  async function kv(store, mode, fn) { if (!idb) idb = await openDb(); return new Promise((res, rej) => { const tx = idb.transaction(store, mode); const r = fn(tx.objectStore(store)); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); }); }
  const kvGet = (k) => kv("kv", "readonly", (s) => s.get(k)); const kvSet = (k, v) => kv("kv", "readwrite", (s) => s.put(v, k));
  async function persistMeta() { try { await kvSet("meta", { n: D.n, seed: D.seed }); await kvSet("over", [...D.over.entries()]); await kvSet("extra", D.extra); await kvSet("deleted", [...D.deleted]); } catch (e) { console.warn("persist failed", e); } }
  async function load(onProgress) {
    let meta = null; try { meta = await kvGet("meta"); } catch {}
    if (!meta) return false;
    await generate(meta.n, meta.seed, onProgress);
    try { D.over = new Map(await kvGet("over") || []); D.extra = (await kvGet("extra")) || []; D.deleted = new Set((await kvGet("deleted")) || []); } catch {}
    for (const [id] of D.over) { const r = getRecord(id); if (r) applyToColumns(id, r); }
    for (const id of D.deleted) if (id <= D.n) D.f.status[id - 1] = 255;
    return true;
  }
  async function reset() { try { await kv("kv", "readwrite", (s) => s.clear()); await kv("images", "readwrite", (s) => s.clear()); } catch {} }

  // ------------------------------------------------------------------ フィルタと集計
  function parseQuery(q) { const p = new URLSearchParams(q || ""); const all = (k) => p.getAll(k).filter((x) => x !== ""); return { prefecture: all("prefecture").map(Number), region: p.get("region") || null, age_min: p.get("age_min") ? +p.get("age_min") : null, age_max: p.get("age_max") ? +p.get("age_max") : null, license_type: all("license_type"), color: all("color"), sex: p.get("sex") || null, status: p.get("status") || null, q: p.get("q") || null, page: +(p.get("page") || 1), per_page: +(p.get("per_page") || 50), sort: p.get("sort") || "id", desc: p.get("desc") === "true", scenario: p.get("scenario") || "base", horizon: +(p.get("horizon") || 10), group_by: p.get("group_by") || "age_band", return_rate_mult: p.get("return_rate_mult"), acquisition_mult: p.get("acquisition_mult"), population_adjust: p.get("population_adjust"), migration_to_urban: p.get("migration_to_urban"), limit: +(p.get("limit") || 100000), row: p.get("row") || "age_band", col: p.get("col") || "license_type" }; }
  function mask(f) {
    const n = D.n, F = D.f, m = new Uint8Array(n);
    let prefSet = null; if (f.prefecture?.length || f.region) { prefSet = new Uint8Array(48); (f.prefecture || []).forEach((c) => prefSet[c] = 1); if (f.region) PREFS.filter((p) => p.region === f.region).forEach((p) => prefSet[p.code] = 1); }
    let tmask = 0; (f.license_type || []).forEach((t) => { const k = LICENSE_TYPES.indexOf(t); if (k >= 0) tmask |= 1 << k; });
    let cset = null; if (f.color?.length) { cset = new Uint8Array(3); f.color.forEach((c) => { const k = COLORS.indexOf(c); if (k >= 0) cset[k] = 1; }); }
    const sex = f.sex ? SEXES.indexOf(f.sex) : -1, st = f.status ? STATUSES.indexOf(f.status) : -1, amin = f.age_min ?? -1, amax = f.age_max ?? 999;
    const q = f.q ? f.q.trim() : null;
    for (let i = 0; i < n; i++) {
      if (F.status[i] === 255) continue;
      if (prefSet && !prefSet[F.pref[i]]) continue; if (F.age[i] < amin || F.age[i] > amax) continue; if (tmask && !(F.typeMask[i] & tmask)) continue;
      if (cset && !cset[F.color[i]]) continue; if (sex >= 0 && F.sex[i] !== sex) continue; if (st >= 0 && F.status[i] !== st) continue;
      if (q) { const r = getRecord(i + 1); if (!(r.license_no.includes(q) || r.name.includes(q) || r.name_kana.includes(q) || r.address.includes(q))) continue; }
      m[i] = 1;
    }
    return m;
  }
  function extraMatches(f, e) {
    if (f.prefecture?.length && !f.prefecture.includes(e.prefecture_code)) return false; if (f.region && PREF[e.prefecture_code].region !== f.region) return false;
    if (f.age_min != null && e.age < f.age_min) return false; if (f.age_max != null && e.age > f.age_max) return false;
    if (f.license_type?.length && !f.license_type.some((t) => (e.license_types || "").split(",").includes(t))) return false; if (f.color?.length && !f.color.includes(e.color)) return false;
    if (f.sex && e.sex !== f.sex) return false; if (f.status && e.status !== f.status) return false;
    if (f.q && !(e.license_no.includes(f.q) || e.name.includes(f.q) || (e.name_kana || "").includes(f.q) || (e.address || "").includes(f.q))) return false; return true;
  }
  // 行イテレータ（生成行 + 追加行）
  function* rows(f, m) { const F = D.f; for (let i = 0; i < D.n; i++) if (m[i]) yield { pref: F.pref[i], age: F.age[i], sex: F.sex[i], top: F.typeTop[i], color: F.color[i], status: F.status[i], cond: F.cond[i], expiry: F.expiry[i], firstYear: F.firstYear[i] };
    for (const e of D.extra) if (!D.deleted.has(e.id) && extraMatches(f, e)) yield { pref: e.prefecture_code, age: e.age, sex: SEXES.indexOf(e.sex), top: LICENSE_TYPES.indexOf(e.license_type), color: COLORS.indexOf(e.color), status: STATUSES.indexOf(e.status), cond: Math.max(0, CONDITIONS.indexOf(e.conditions || "")), expiry: strToDay(e.expiry_date), firstYear: e.first_issue_year || 0 }; }

  function summary(f) {
    const m = mask(f); let total = 0, ageSum = 0, a65 = 0, a75 = 0, gold = 0, active = 0, overdue = 0, female = 0;
    for (const r of rows(f, m)) { total++; ageSum += r.age; if (r.age >= 65) a65++; if (r.age >= 75) a75++; if (r.color === 2) gold++; if (r.status === 0) active++; if (r.status === 0 && r.expiry < TODAY_DAY) overdue++; if (r.sex === 1) female++; }
    const pc = (x) => (total ? +(100 * x / total).toFixed(1) : 0);
    return { total, avg_age: total ? +(ageSum / total).toFixed(1) : 0, aged65: a65, aged75: a75, gold, active, overdue, female, aged65_share: pc(a65), aged75_share: pc(a75), gold_share: pc(gold), female_share: pc(female) };
  }
  const yearOfDay = (d) => new Date(d * DAY).getUTCFullYear();
  function keyOf(dim, r) { switch (dim) { case "age_band": return AGE_BAND_LABELS[bandOf[Math.min(r.age, 120)]]; case "license_type": return LICENSE_TYPES[r.top]; case "color": return COLORS[r.color]; case "sex": return SEXES[r.sex]; case "prefecture": case "region": return r.pref; case "status": return STATUSES[r.status]; case "first_issue_year": return r.firstYear; case "condition": return CONDITIONS[r.cond] || "なし"; case "expiry_year": return yearOfDay(r.expiry); default: throw new Error("unknown dimension: " + dim); } }
  function breakdown(f, dim) {
    keyOf(dim, { age: 20, top: 0, color: 0, sex: 0, pref: 1, status: 0, firstYear: 2000, cond: 0, expiry: TODAY_DAY });
    const m = mask(f), agg = new Map();
    for (const r of rows(f, m)) { const k = keyOf(dim, r); let a = agg.get(k); if (!a) { a = { key: k, count: 0, ageSum: 0, aged65: 0, gold: 0 }; agg.set(k, a); } a.count++; a.ageSum += r.age; if (r.age >= 65) a.aged65++; if (r.color === 2) a.gold++; }
    const out = [...agg.values()].map((a) => ({ key: a.key, count: a.count, avg_age: +(a.ageSum / a.count).toFixed(1), aged65: a.aged65, gold: a.gold }));
    if (dim === "age_band") out.sort((a, b) => AGE_BAND_LABELS.indexOf(a.key) - AGE_BAND_LABELS.indexOf(b.key)); else out.sort((a, b) => (a.key > b.key ? 1 : a.key < b.key ? -1 : 0));
    return out;
  }
  function crosstab(f, rd, cd) { const m = mask(f), agg = new Map(); for (const r of rows(f, m)) { const k = keyOf(rd, r) + "\u0001" + keyOf(cd, r); agg.set(k, (agg.get(k) || 0) + 1); } return { rows: [...agg.entries()].map(([k, n]) => { const [a, b] = k.split("\u0001"); return { r: isNaN(a) ? a : +a, c: isNaN(b) ? b : +b, n }; }) }; }
  function scale() { if (!D.f) return 1; let n = 0; const F = D.f; for (let i = 0; i < D.n; i++) if (F.status[i] === 0) n++; for (const e of D.extra) if (!D.deleted.has(e.id) && e.status === "有効") n++; return n ? POPULATION_HOLDERS_JP / n : 1; }
  function mapData(f) {
    const m = mask(f), by = {};
    for (const r of rows(f, m)) { const d = by[r.pref] || (by[r.pref] = { count: 0, ageSum: 0, a70: 0, a75: 0, gold: 0, by_age_band: {}, by_type: {}, by_color: {} }); d.count++; d.ageSum += r.age; if (r.age >= 70) d.a70++; if (r.age >= 75) d.a75++; if (r.color === 2) d.gold++; const b = AGE_BAND_LABELS[bandOf[Math.min(r.age, 120)]]; d.by_age_band[b] = (d.by_age_band[b] || 0) + 1; const t = LICENSE_TYPES[r.top]; d.by_type[t] = (d.by_type[t] || 0) + 1; const c = COLORS[r.color]; d.by_color[c] = (d.by_color[c] || 0) + 1; }
    const sc = scale();
    return { scale: sc, prefectures: Object.entries(by).map(([code, d]) => { const p = PREF[code]; const n = d.count; return { code: +code, name: p.name, region: p.region, count: n, avg_age: +(d.ageSum / n).toFixed(1), aged70_share: +(100 * d.a70 / n).toFixed(1), aged75_share: +(100 * d.a75 / n).toFixed(1), gold_share: +(100 * d.gold / n).toFixed(1), holding_rate: +((n * sc) / (p.pop_2020 * 1000) * 100).toFixed(1), pop_change_2035: +(100 * (p.total_change_ratio - 1)).toFixed(1), by_age_band: d.by_age_band, by_type: d.by_type, by_color: d.by_color }; }) };
  }

  // ------------------------------------------------------------------ 将来推計（コホート要因法）
  const MAX_AGE = 100, BASE_YEAR = 2025, REGIONAL_DAMPING = 0.5;
  function baseCont(a) { if (a < 60) return 1 - (a >= 18 ? 0.0005 + (a - 18) * 0.00004 : 0.0003) - 0.001; if (a < 70) return 1 - 0.007; if (a < 75) return 1 - 0.022; if (a < 80) return 1 - 0.055; if (a < 85) return 1 - 0.105; if (a < 90) return 1 - 0.19; return 1 - 0.30; }
  function cont(a, sc) { const b = baseCont(a); if (a < 70) return b; let loss = 1 - b; loss = loss * 0.4 + loss * 0.6 * sc.return_rate_mult; return Math.max(0, 1 - loss); }
  function annualRatio(p, a) { const yrs = 15; const yr = (p.pop_2035 * (1 - p.aged65_2035 / 100)) / (p.pop_2020 * (1 - p.aged65_2020 / 100)); const or = (p.pop_2035 * p.aged65_2035 / 100) / (p.pop_2020 * p.aged65_2020 / 100); if (a < 65) return Math.pow(yr * (a < 40 ? 0.95 : 1.02), 1 / yrs); return Math.pow(or, 1 / yrs); }
  const natCache = {}; function nationalRatio(a) { const k = a < 40 ? 0 : a < 65 ? 1 : 2; if (natCache[k] == null) { const w = PREFS.reduce((s, p) => s + p.pop_2020, 0); natCache[k] = PREFS.reduce((s, p) => s + annualRatio(p, a) * p.pop_2020, 0) / w; } return natCache[k]; }
  function popAdj(code, a, sc) { const p = PREF[code]; const annual = annualRatio(p, a) * Math.pow(1 + sc.population_adjust, 0.1); let adj = Math.pow(annual / nationalRatio(a), REGIONAL_DAMPING); if (sc.migration_to_urban) adj *= URBAN.has(code) ? 1 + sc.migration_to_urban : 1 - sc.migration_to_urban; return adj; }
  function youthSize(code, year, base, sc) { const p = PREF[code]; const yr = (p.pop_2035 * (1 - p.aged65_2035 / 100)) / (p.pop_2020 * (1 - p.aged65_2020 / 100)); let annual = Math.pow(yr * 0.93, 1 / 15) * Math.pow(1 + sc.population_adjust, 0.1); return base * Math.pow(annual, year - BASE_YEAR); }
  const projCache = new Map();
  function project(f, sc) {
    const key = JSON.stringify([f.prefecture, f.region, f.age_min, f.age_max, f.license_type, f.color, f.sex, sc, D.n, D.over.size, D.extra.length, D.deleted.size]);
    if (projCache.has(key)) return projCache.get(key);
    const m = mask({ ...f, status: "有効" }); const sample = scale();
    const state = {}; // pref -> type -> color -> Float64Array(101)
    const cell = (p, t, c) => { const a = state[p] || (state[p] = {}); const b = a[t] || (a[t] = {}); return b[c] || (b[c] = new Float64Array(MAX_AGE + 1)); };
    for (const r of rows({ ...f, status: "有効" }, m)) cell(r.pref, r.top, r.color)[Math.min(r.age, MAX_AGE)] += sample;
    const profile = {}, youthBase = {};
    for (const p in state) { const prof = {}; let tot = 0, yb = 0; for (const t in state[p]) for (const c in state[p][t]) { const arr = state[p][t][c]; let v = 0; for (let a = 18; a < 25; a++) v += arr[a]; if (v > 0) { prof[t + "," + c] = v; tot += v; } for (let a = 22; a < 27; a++) yb += arr[a]; } profile[p] = tot > 0 ? Object.fromEntries(Object.entries(prof).map(([k, v]) => [k, v / tot])) : { "0,0": 1 }; youthBase[p] = yb / 5; }
    const contArr = Array.from({ length: MAX_AGE + 1 }, (_, a) => cont(a, sc));
    const years = []; for (let y = BASE_YEAR; y <= BASE_YEAR + sc.horizon; y++) years.push(y);
    const out = [];
    const snap = (year) => { for (const p in state) for (const t in state[p]) for (const c in state[p][t]) { const arr = state[p][t][c]; AGE_BANDS.forEach(([lo, hi], bi) => { let v = 0; for (let a = lo; a <= Math.min(hi, MAX_AGE); a++) v += arr[a]; if (v > 0.5) out.push({ year, prefecture_code: +p, age_band: AGE_BAND_LABELS[bi], license_type: LICENSE_TYPES[t], color: COLORS[c], n: +v.toFixed(1) }); }); } };
    snap(BASE_YEAR);
    for (const year of years.slice(1)) {
      for (const p in state) {
        const adj = Array.from({ length: MAX_AGE + 1 }, (_, a) => popAdj(+p, a, sc));
        for (const t in state[p]) for (const c in state[p][t]) { const arr = state[p][t][c]; const aged = new Float64Array(MAX_AGE + 1); for (let a = 1; a <= MAX_AGE; a++) aged[a] = arr[a - 1] * contArr[a - 1] * adj[a - 1]; aged[MAX_AGE] += arr[MAX_AGE] * contArr[MAX_AGE]; state[p][t][c] = aged; }
        const newTotal = youthSize(+p, year, youthBase[p], sc) * sc.acquisition_mult;
        for (const [k, share] of Object.entries(profile[p])) { const [t, c] = k.split(",").map(Number); const arr = cell(+p, t, c); [[18, 0.35], [19, 0.30], [20, 0.20], [21, 0.15]].forEach(([a, w]) => { arr[a] += newTotal * share * w; }); }
        for (const t in state[p]) { const g = cell(+p, +t, 0), b = cell(+p, +t, 1), gold = cell(+p, +t, 2); for (let a = 0; a <= MAX_AGE; a++) { const gb = g[a] / 3, bg = b[a] * 0.12, back = gold[a] * 0.03; g[a] -= gb; b[a] += gb - bg + back; gold[a] += bg - back; } }
      }
      snap(year);
    }
    const res = { scenario: { ...sc }, base_year: BASE_YEAR, years, rows: out };
    if (projCache.size > 40) projCache.delete(projCache.keys().next().value); projCache.set(key, res); return res;
  }
  function aggregate(res, by) { const agg = new Map(); for (const r of res.rows) { const k = by.map((b) => r[b]).join("\u0001"); agg.set(k, (agg.get(k) || 0) + r.n); } return [...agg.entries()].map(([k, v]) => { const o = {}; k.split("\u0001").forEach((x, i) => { o[by[i]] = by[i] === "year" || by[i] === "prefecture_code" ? +x : x; }); o.n = Math.round(v); return o; }).sort((a, b) => a.year - b.year); }
  function scenarioFrom(q) { const base = SCENARIOS[q.scenario] || SCENARIOS.base; const num = (v, d) => (v == null || v === "" ? d : +v); return { name: SCENARIOS[q.scenario] ? base.name : "カスタム", horizon: Math.max(1, Math.min(q.horizon || 10, 30)), return_rate_mult: num(q.return_rate_mult, base.return_rate_mult), acquisition_mult: num(q.acquisition_mult, base.acquisition_mult), population_adjust: num(q.population_adjust, base.population_adjust), migration_to_urban: num(q.migration_to_urban, base.migration_to_urban), notes: base.notes }; }
  const OLD = new Set(["75-79", "80-84", "85+"]);
  function outlook(res, f, areaLabel) {
    const tot = Object.fromEntries(aggregate(res, ["year"]).map((r) => [r.year, r.n])); const bands = {}, colors = {};
    aggregate(res, ["year", "age_band"]).forEach((r) => { (bands[r.year] = bands[r.year] || {})[r.age_band] = r.n; }); aggregate(res, ["year", "color"]).forEach((r) => { (colors[r.year] = colors[r.year] || {})[r.color] = r.n; });
    const years = res.years.map((y) => { const a75 = Object.entries(bands[y] || {}).filter(([k]) => OLD.has(k)).reduce((s, [, v]) => s + v, 0); return { year: y, total: tot[y] || 0, age_bands: bands[y] || {}, colors: colors[y] || {}, aged75_share: tot[y] ? +(100 * a75 / tot[y]).toFixed(1) : 0 }; });
    const first = years[0], last = years[years.length - 1];
    return { prefecture: areaLabel, years, change: { total_pct: first.total ? +(100 * (last.total / first.total - 1)).toFixed(1) : 0, aged75_share_from: first.aged75_share, aged75_share_to: last.aged75_share, age_band_pct: Object.fromEntries(Object.entries(first.age_bands).filter(([, v]) => v).map(([k, v]) => [k, +(100 * ((last.age_bands[k] || 0) / v - 1)).toFixed(1)])) } };
  }

  // ------------------------------------------------------------------ 画像
  function renderCard(rec) {
    const cv = document.createElement("canvas"); cv.width = 860; cv.height = 540; const x = cv.getContext("2d");
    const band = { "ゴールド": "#d4af37", "ブルー": "#3c6ec8", "グリーン": "#46a05a" }[rec.color] || "#777";
    const rr = (X, Y, W, H, R) => { x.beginPath(); x.roundRect(X, Y, W, H, R); };
    x.fillStyle = "#f6f7fa"; x.fillRect(0, 0, 860, 540); rr(8, 8, 844, 524, 28); x.fillStyle = "#fff"; x.fill(); x.lineWidth = 3; x.strokeStyle = "#bec4ce"; x.stroke();
    x.save(); rr(8, 8, 844, 524, 28); x.clip(); x.fillStyle = band; x.fillRect(8, 8, 844, 62); x.restore();
    x.fillStyle = "#fff"; x.font = "bold 30px sans-serif"; x.fillText("運転免許証（サンプル）", 32, 50); x.font = "22px sans-serif"; x.fillText(`有効期限 ${rec.expiry_date}`, 530, 48);
    x.fillStyle = "#e1e6ee"; x.fillRect(40, 100, 200, 240); x.strokeStyle = "#96a0af"; x.lineWidth = 2; x.strokeRect(40, 100, 200, 240);
    x.fillStyle = "#b4becd"; x.beginPath(); x.arc(140, 180, 40, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(140, 300, 70, Math.PI, 0); x.fill(); x.fillStyle = "#6e7887"; x.font = "16px sans-serif"; x.fillText("PHOTO", 112, 330);
    const lines = [["氏名", `${rec.name}  (${rec.name_kana || ""})`], ["生年月日", `${rec.birth_date}  (${rec.age}歳 / ${rec.sex})`], ["住所", (rec.address || "").slice(0, 28)], ["交付", `${rec.issue_date}   初回取得 ${rec.first_issue_year}年`], ["番号", String(rec.license_no)], ["種類", String(rec.license_types)], ["条件等", rec.conditions || "なし"]];
    let y = 120; for (const [l, v] of lines) { x.fillStyle = "#5a6473"; x.font = "16px sans-serif"; x.fillText(l, 270, y); x.fillStyle = "#141923"; x.font = "22px sans-serif"; x.fillText(v, 370, y + 2); y += 46; }
    x.fillStyle = "#c8cdd7"; x.fillRect(40, 380, 780, 2); x.fillStyle = "#141923"; x.font = "22px sans-serif"; x.fillText(`区分: ${rec.color}   状態: ${rec.status}   違反点数: ${rec.violation_points}`, 40, 420);
    x.fillStyle = "#963c3c"; x.font = "16px sans-serif"; x.fillText("※ 本画像はデモ用に自動生成した架空データです。実在の人物・番号とは無関係です。", 40, 465);
    x.fillStyle = "#5a6473"; x.fillText(`OCR信頼度 ${rec.ocr_confidence}   record#${rec.id}`, 40, 500);
    return new Promise((res) => cv.toBlob(res, "image/png"));
  }
  async function imageBlob(id) { try { const b = await kv("images", "readonly", (s) => s.get(id)); if (b) return b; } catch {} return renderCard(getRecord(id)); }
  async function saveImage(id, file) { await kv("images", "readwrite", (s) => s.put(file, id)); const rec = getRecord(id); const rel = `upload/${id}.${(file.name.split(".").pop() || "png").toLowerCase()}`; await update(id, { image_path: rel }); return rel; }

  // ------------------------------------------------------------------ CRUD
  function validate(d) { if ("sex" in d && !SEXES.includes(d.sex)) throw new Error("性別は 男性/女性"); if ("color" in d && !COLORS.includes(d.color)) throw new Error("色が不正です"); if ("license_type" in d && !LICENSE_TYPES.includes(d.license_type)) throw new Error("免許種類が不正です"); if ("prefecture_code" in d && !PREF[d.prefecture_code]) throw new Error("都道府県コードが不正です"); if ("status" in d && !STATUSES.includes(d.status)) throw new Error("状態が不正です"); }
  async function create(d) { validate(d); const id = D.n + D.extra.length + 1 + (D._extraSeq = (D._extraSeq || 0)); D._extraSeq++; const rec = { id, name_kana: null, municipality: null, address: null, conditions: "", first_issue_year: null, violation_points: 0, image_path: null, ocr_confidence: null, status: "有効", ...d, license_types: d.license_types || d.license_type, age: ageFromBirth(strToDay(d.birth_date)), updated_at: new Date().toISOString().slice(0, 19) }; D.extra.push(rec); projCache.clear(); await persistMeta(); return rec; }
  async function update(id, d) { validate(d); const cur = getRecord(id); if (!cur) throw new Error("not found"); const next = { ...cur, ...d, updated_at: new Date().toISOString().slice(0, 19) }; if (d.birth_date) next.age = ageFromBirth(strToDay(d.birth_date)); if (id > D.n) { const i = D.extra.findIndex((e) => e.id === id); D.extra[i] = next; } else { const o = D.over.get(id) || {}; Object.assign(o, d, { updated_at: next.updated_at }); if (d.birth_date) o.age = next.age; D.over.set(id, o); applyToColumns(id, next); } projCache.clear(); await persistMeta(); return next; }
  async function remove(id) { if (!getRecord(id)) throw new Error("not found"); D.deleted.add(id); if (id <= D.n) D.f.status[id - 1] = 255; projCache.clear(); await persistMeta(); }
  function list(f) {
    const m = mask(f); const ids = []; for (let i = 0; i < D.n; i++) if (m[i]) ids.push(i + 1); for (const e of D.extra) if (!D.deleted.has(e.id) && extraMatches(f, e)) ids.push(e.id);
    const total = ids.length; const sort = f.sort || "id";
    let page;
    if (sort === "id") { page = f.desc ? ids.reverse() : ids; }
    else { const F = D.f; const colKey = { age: "age", expiry_date: "expiry", issue_date: "issue", prefecture_code: "pref", first_issue_year: "firstYear" }[sort]; const keyed = ids.map((id) => [id, id <= D.n && colKey ? F[colKey][id - 1] : (getRecord(id)[sort] ?? "")]); keyed.sort((a, b) => (a[1] > b[1] ? 1 : a[1] < b[1] ? -1 : 0) * (f.desc ? -1 : 1)); page = keyed.map((k) => k[0]); }
    const start = (f.page - 1) * f.per_page; return { total, page: f.page, per_page: f.per_page, items: page.slice(start, start + f.per_page).map(getRecord) };
  }
  function quality() { const F = D.f; let total = 0, mi = 0, lo = 0, ex = 0, ret = 0; for (let i = 0; i < D.n; i++) { if (F.status[i] === 255) continue; total++; if (!F.hasImage[i]) mi++; if (F.ocr[i] < 80) lo++; if (F.status[i] === 0 && F.expiry[i] < TODAY_DAY) ex++; if (F.status[i] === 2) ret++; } for (const e of D.extra) if (!D.deleted.has(e.id)) { total++; if (!e.image_path) mi++; if ((e.ocr_confidence ?? 1) < 0.8) lo++; if (e.status === "有効" && strToDay(e.expiry_date) < TODAY_DAY) ex++; if (e.status === "返納") ret++; } return { total, missing_image: mi, low_ocr: lo, expired_active: ex, missing_kana: 0, returned: ret, distinct_no: total, duplicate_no: 0 }; }
  const COLUMNS = ["id", "license_no", "name", "name_kana", "sex", "birth_date", "age", "prefecture_code", "municipality", "address", "license_type", "license_types", "color", "conditions", "issue_date", "expiry_date", "first_issue_year", "violation_points", "image_path", "ocr_confidence", "status", "updated_at"];
  function exportCsv(f) { const res = list({ ...f, page: 1, per_page: Math.min(f.limit || 100000, 1000000) }); const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; return "﻿" + [COLUMNS.join(","), ...res.items.map((r) => COLUMNS.map((c) => esc(r[c])).join(","))].join("\n"); }
  function parseCsv(text) { const rows = []; let cur = "", row = [], q = false; text = text.replace(/^﻿/, ""); for (let i = 0; i < text.length; i++) { const ch = text[i]; if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === ",") { row.push(cur); cur = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; } else cur += ch; } if (cur !== "" || row.length) { row.push(cur); rows.push(row); } const [h, ...body] = rows; return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(h.map((k, i) => [k.trim(), r[i] ?? ""]))); }
  async function importCsv(text) { const recs = parseCsv(text); let n = 0; const errors = []; for (let i = 0; i < recs.length; i++) { try { const r = recs[i]; const d = {}; for (const k of COLUMNS) if (r[k] !== undefined && r[k] !== "" && !["id", "age", "updated_at", "image_path"].includes(k)) d[k] = r[k]; ["prefecture_code", "first_issue_year", "violation_points"].forEach((k) => { if (d[k] != null) d[k] = parseInt(d[k], 10); }); if (d.ocr_confidence != null) d.ocr_confidence = parseFloat(d.ocr_confidence); for (const k of ["license_no", "name", "sex", "birth_date", "prefecture_code", "license_type", "color", "issue_date", "expiry_date"]) if (d[k] == null || Number.isNaN(d[k])) throw new Error(k + " が未入力"); await create(d); n++; } catch (e) { errors.push({ line: i + 2, error: e.message }); } } return { imported: n, errors: errors.slice(0, 50), error_count: errors.length }; }

  // ------------------------------------------------------------------ AI
  const AI_MODEL = "claude-opus-5-5";
  const SYSTEM_PROMPT = `あなたは自動車関連事業（販売・整備・保険・レンタカー・教習所・モビリティサービス）の戦略コンサルタント兼データアナリストです。運転免許証データベースの集計結果と、国立社会保障・人口問題研究所の地域別将来人口推計を組み合わせて、地域の将来像を分析します。
原則:
- 与えられた数表に基づいて定量的に述べる。数値を引用するときは年と単位を明示する。
- 推計には不確実性があるため、楽観・基準・悲観など複数のシナリオで幅を示す。
- 事業機会は「誰に・何を・なぜ今か」が分かる粒度で、実行可能なものに絞る。
- 日本語で、経営会議で使える簡潔な表現にする。
- 入力データはサンプル抽出（拡大係数あり）である点、人口推計は概数である点を注意事項に含める。`;
  const OUTPUT_SCHEMA = { type: "object", properties: { headline: { type: "string" }, summary: { type: "string" },
    key_figures: { type: "array", items: { type: "object", properties: { label: { type: "string" }, now: { type: "string" }, future: { type: "string" }, comment: { type: "string" } }, required: ["label", "now", "future", "comment"], additionalProperties: false } },
    scenarios: { type: "array", items: { type: "object", properties: { name: { type: "string" }, probability: { type: "string" }, assumptions: { type: "string" }, license_holder_outlook: { type: "string" }, impact_on_business: { type: "string" } }, required: ["name", "probability", "assumptions", "license_holder_outlook", "impact_on_business"], additionalProperties: false } },
    business_opportunities: { type: "array", items: { type: "object", properties: { title: { type: "string" }, target: { type: "string" }, rationale: { type: "string" }, market_size_hint: { type: "string" }, timing: { type: "string" }, priority: { type: "string", enum: ["高", "中", "低"] } }, required: ["title", "target", "rationale", "market_size_hint", "timing", "priority"], additionalProperties: false } },
    risks: { type: "array", items: { type: "object", properties: { risk: { type: "string" }, mitigation: { type: "string" } }, required: ["risk", "mitigation"], additionalProperties: false } },
    recommended_actions: { type: "array", items: { type: "string" } }, data_notes: { type: "array", items: { type: "string" } } },
    required: ["headline", "summary", "key_figures", "scenarios", "business_opportunities", "risks", "recommended_actions", "data_notes"], additionalProperties: false };
  function apiKey() { try { return localStorage.getItem("anthropic_api_key") || ""; } catch { return ""; } }
  function setApiKey(k) { try { if (k) localStorage.setItem("anthropic_api_key", k); else localStorage.removeItem("anthropic_api_key"); } catch {} }
  function buildContext(req) {
    const f = { prefecture: req.prefecture || [], region: req.region, age_min: req.age_min, age_max: req.age_max, license_type: req.license_type || [], color: req.color || [] };
    const area = f.prefecture.length ? f.prefecture.map((c) => PREF[c].name).join("・") : f.region || "全国";
    const current = summary(f); current.by_age_band = Object.fromEntries(breakdown(f, "age_band").map((r) => [r.key, r.count])); current.by_license_type = Object.fromEntries(breakdown(f, "license_type").map((r) => [r.key, r.count])); current.by_color = Object.fromEntries(breakdown(f, "color").map((r) => [r.key, r.count])); current.scale_factor = +scale().toFixed(2);
    const projection = {}; for (const k of Object.keys(SCENARIOS)) { const sc = { ...SCENARIOS[k], horizon: req.horizon }; const res = project(f, sc); projection[k] = outlook(res, f, area); projection[k].scenario = { name: sc.name, notes: sc.notes }; if (f.prefecture.length === 1) projection[k].population_projection = PREF[f.prefecture[0]]; }
    let population; if (f.prefecture.length === 1) population = PREF[f.prefecture[0]]; else { const ps = f.prefecture.length ? f.prefecture.map((c) => PREF[c]) : PREFS.filter((p) => !f.region || p.region === f.region); const p20 = ps.reduce((s, p) => s + p.pop_2020, 0), p35 = ps.reduce((s, p) => s + p.pop_2035, 0); population = { area, pop_2020: p20, pop_2035: p35, total_change_ratio: +(p35 / p20).toFixed(4), aged65_2020: +(ps.reduce((s, p) => s + p.pop_2020 * p.aged65_2020, 0) / p20).toFixed(1), aged65_2035: +(ps.reduce((s, p) => s + p.pop_2035 * p.aged65_2035, 0) / p35).toFixed(1) }; }
    return { filters: { area, horizon_years: req.horizon, age_min: req.age_min, age_max: req.age_max, license_type: req.license_type, color: req.color }, current, projection, population };
  }
  async function callClaude(question, ctx) {
    const user = `## 質問\n${question}\n\n## 分析対象の条件\n${JSON.stringify(ctx.filters)}\n\n## 現状の集計（免許証データベース）\n${JSON.stringify(ctx.current)}\n\n## 将来推計（コホート要因法、シナリオ別）\n${JSON.stringify(ctx.projection)}\n\n## 外部データ: 地域別将来推計人口（IPSS 概数）\n${JSON.stringify(ctx.population)}\n\n上記を踏まえ、質問に答える形で、複数シナリオと事業機会を提示してください。`;
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": apiKey(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 12000, system: SYSTEM_PROMPT, thinking: { type: "adaptive" }, output_config: { effort: "high", format: { type: "json_schema", schema: OUTPUT_SCHEMA } }, messages: [{ role: "user", content: user }] }) });
    if (!r.ok) { let m = r.statusText; try { m = (await r.json()).error?.message || m; } catch {} throw new Error(`${r.status} ${m}`); }
    const msg = await r.json(); if (msg.stop_reason === "refusal") throw new Error("refusal");
    const text = msg.content.find((b) => b.type === "text")?.text; const data = JSON.parse(text); data.engine = AI_MODEL; data.usage = msg.usage; return data;
  }
  function fallback(ctx) {
    const proj = ctx.projection, cur = ctx.current, pop = ctx.population, base = proj.base, years = base.years, first = years[0], last = years[years.length - 1], ch = base.change, area = base.prefecture;
    const hy = last.year, youth = ch.age_band_pct["20代"] || 0, old = ch.age_band_pct["75-79"] || 0; const alt = (k) => { const ys = proj[k].years; return ys[ys.length - 1]; };
    const f = (n) => Number(n || 0).toLocaleString("ja-JP"); const ab = (y, k) => f(y.age_bands[k]);
    return { headline: `${area}の免許保有者は${hy}年に${ch.total_pct >= 0 ? "+" : ""}${ch.total_pct}%、75歳以上比率は${ch.aged75_share_from}%→${ch.aged75_share_to}%へ。`,
      summary: `${area}の現在の有効免許保有者は約${f(first.total)}人（拡大推計値）です。基準シナリオでは${hy}年に約${f(last.total)}人（${ch.total_pct >= 0 ? "+" : ""}${ch.total_pct}%）となり、75歳以上の比率は${ch.aged75_share_from}%から${ch.aged75_share_to}%へ上昇します。20代の保有者は${youth >= 0 ? "+" : ""}${youth}%、75〜79歳は${old >= 0 ? "+" : ""}${old}%と推移します。人口推計（2020→2035年）では地域人口が${((pop.total_change_ratio - 1) * 100).toFixed(1)}%と見込まれます。`,
      key_figures: [{ label: "免許保有者数", now: f(first.total) + "人", future: f(last.total) + "人", comment: `${ch.total_pct}%` }, { label: "75歳以上比率", now: ch.aged75_share_from + "%", future: ch.aged75_share_to + "%", comment: "返納・安全運転サポート需要の指標" }, { label: "20代保有者", now: ab(first, "20代") + "人", future: ab(last, "20代") + "人", comment: `${youth}%` }, { label: "ゴールド免許", now: f(first.colors["ゴールド"]) + "人", future: f(last.colors["ゴールド"]) + "人", comment: "優良ドライバー向け保険の母集団" }],
      scenarios: [{ name: "基準シナリオ", probability: "50%", assumptions: "人口推計どおり、返納率・取得率は現状維持", license_holder_outlook: `${hy}年 約${f(last.total)}人、75歳以上 ${last.aged75_share}%`, impact_on_business: "新車販売は若年層の縮小で漸減。整備・車検は保有台数の減少が遅れて現れるため当面横ばい。高齢者向け安全装備・サポカー需要が拡大。" },
        { name: "返納促進シナリオ", probability: "25%", assumptions: "75歳以上の返納率が1.6倍", license_holder_outlook: `${hy}年 約${f(alt("return_up").total)}人、75歳以上 ${alt("return_up").aged75_share}%`, impact_on_business: "高齢層の車両処分・下取りが増加し中古車流通が一時的に増える。返納後の移動手段（デマンド交通、送迎サービス）が事業機会に。" },
        { name: "若年取得減少シナリオ", probability: "15%", assumptions: "若年層の取得率が2割低下", license_holder_outlook: `${hy}年 約${f(alt("youth_decline").total)}人、75歳以上 ${alt("youth_decline").aged75_share}%`, impact_on_business: "教習所・初回購入層の縮小。カーシェア・サブスクなど所有を前提としないサービスへの転換が必要。" },
        { name: "都市集中シナリオ", probability: "10%", assumptions: "地方から都市圏への流出が加速", license_holder_outlook: `${hy}年 約${f(alt("urban_shift").total)}人、75歳以上 ${alt("urban_shift").aged75_share}%`, impact_on_business: "地方拠点の統廃合と、都市部での駐車場・EV充電・カーシェア需要の増加。" }],
      business_opportunities: [{ title: "高齢ドライバー向け安全運転サポート＆乗り換え提案", target: "70〜79歳の有効保有者とその家族", rationale: `75歳以上比率が${ch.aged75_share_to}%まで上がり、認知機能検査・サポカー限定免許への移行が増える`, market_size_hint: `対象 約${f((last.age_bands["70-74"] || 0) + (last.age_bands["75-79"] || 0))}人（${hy}年）`, timing: "今後3年以内に立ち上げ", priority: "高" },
        { title: "免許返納者向けモビリティ・サービス（送迎、買い物代行、デマンド交通）", target: "返納予定の80歳以上と自治体", rationale: "返納促進シナリオでは返納者が大幅に増加し、公共交通が薄い地域ほど需要が顕在化する", market_size_hint: `80歳以上 約${f((last.age_bands["80-84"] || 0) + (last.age_bands["85+"] || 0))}人`, timing: "自治体連携で5年以内", priority: "高" },
        { title: "若年層向けカーシェア・サブスク、AT限定・二輪の取得支援", target: "18〜29歳", rationale: `20代の保有者は${youth}%と推移するため、所有前提から利用前提へ`, market_size_hint: `20代 約${ab(last, "20代")}人`, timing: "中期", priority: "中" },
        { title: "ゴールド免許層向け優良ドライバー保険・ロイヤリティ", target: "ゴールド免許保有者", rationale: "高齢化によりゴールド比率は上昇し、低リスク層の囲い込みが収益性を左右する", market_size_hint: `約${f(last.colors["ゴールド"])}人`, timing: "即時", priority: "中" }],
      risks: [{ risk: "高齢層の返納が想定より早く進み、保有台数・整備需要が急減する", mitigation: "返納者向けサービスへの早期シフト、拠点の多機能化" }, { risk: "若年層の免許離れによる新規顧客の枯渇", mitigation: "カーシェア・サブスクで接点を維持し、ライフステージ変化時に販売へ接続" }, { risk: "人口推計の下振れ（災害・産業構造変化）", mitigation: "年次で免許データを更新し推計を再計算、拠点投資は段階的に" }],
      recommended_actions: ["70歳以上の保有者を市区町村単位で可視化し、返納見込みと接点（整備入庫履歴）を紐づける", "若年層比率が高いエリアにカーシェア拠点を先行配置する", "自治体のデマンド交通・返納支援制度と連携した送迎サービスを試行する", "推計を毎年更新し、シナリオごとの KPI（保有者数、75歳以上比率、ゴールド比率）をモニタリングする"],
      data_notes: ["免許証データはサンプル抽出のため拡大係数で母集団規模に換算しています", "人口推計は国立社会保障・人口問題研究所の公表値を概数化したものです", "画面右上の「AI設定」で Anthropic API キーを設定すると生成AIによる詳細分析に切り替わります"] };
  }
  async function analyze(req) {
    const ctx = buildContext(req); let result;
    if (apiKey()) { try { result = await callClaude(req.question, ctx); } catch (e) { result = { engine: "rule-based", notice: `AI 呼び出しに失敗したため簡易分析を表示しています: ${e.message}`, ...fallback(ctx) }; } }
    else result = { engine: "rule-based", ...fallback(ctx) };
    result.context_preview = { area: ctx.filters.area, horizon: req.horizon, current_total: ctx.current.total, scale_factor: ctx.current.scale_factor }; return result;
  }

  // ------------------------------------------------------------------ 疑似 API ルータ（app.js の fetch を置き換える）
  async function api(path, opts = {}) {
    const [p, q] = path.split("?"); const f = parseQuery(q); const body = opts.body && typeof opts.body === "string" ? JSON.parse(opts.body) : null; const method = (opts.method || "GET").toUpperCase();
    let mm;
    if (p === "/api/meta") return { prefectures: PREFS.map((x) => ({ ...x })), regions: REGIONS, license_types: LICENSE_TYPES, colors: COLORS, sexes: SEXES, conditions: CONDITIONS, age_bands: AGE_BAND_LABELS, scenarios: SCENARIOS, scale: scale(), ai_enabled: !!apiKey(), ai_model: AI_MODEL, n: D.n };
    if (p === "/api/summary") return summary(f);
    if ((mm = p.match(/^\/api\/breakdown\/(\w+)$/))) return { dimension: mm[1], rows: breakdown(f, mm[1]) };
    if (p === "/api/crosstab") return crosstab(f, f.row, f.col);
    if (p === "/api/map") return mapData(f);
    if (p === "/api/projection") { const sc = scenarioFrom(f); const res = project(f, sc); const by = { age_band: ["year", "age_band"], license_type: ["year", "license_type"], color: ["year", "color"], prefecture: ["year", "prefecture_code"], total: ["year"] }[f.group_by] || ["year", "age_band"]; return { scenario: res.scenario, years: res.years, group_by: by.length > 1 ? by[1] : "total", rows: aggregate(res, by) }; }
    if (p === "/api/projection/compare") { return { scenarios: Object.entries(SCENARIOS).map(([key, b]) => { const sc = { ...b, horizon: f.horizon }; const res = project(f, sc); const tot = Object.fromEntries(aggregate(res, ["year"]).map((r) => [r.year, r.n])); const old = {}; aggregate(res, ["year", "age_band"]).forEach((r) => { if (OLD.has(r.age_band)) old[r.year] = (old[r.year] || 0) + r.n; }); return { key, name: sc.name, notes: sc.notes, series: res.years.map((y) => ({ year: y, total: tot[y] || 0, aged75_share: tot[y] ? +(100 * (old[y] || 0) / tot[y]).toFixed(1) : 0 })) }; }) }; }
    if (p === "/api/projection/map") { const sc = scenarioFrom(f); const res = project(f, sc); const last = res.years[res.years.length - 1]; const agg = {}; for (const r of res.rows) { if (r.year !== res.base_year && r.year !== last) continue; const d = agg[r.prefecture_code] || (agg[r.prefecture_code] = { now: 0, future: 0, now75: 0, future75: 0 }); const k = r.year === res.base_year ? "now" : "future"; d[k] += r.n; if (OLD.has(r.age_band)) d[k + "75"] += r.n; } return { year: last, prefectures: Object.entries(agg).map(([c, d]) => ({ code: +c, name: PREF[c].name, now: Math.round(d.now), future: Math.round(d.future), change_pct: d.now ? +(100 * (d.future / d.now - 1)).toFixed(1) : 0, aged75_share_now: d.now ? +(100 * d.now75 / d.now).toFixed(1) : 0, aged75_share_future: d.future ? +(100 * d.future75 / d.future).toFixed(1) : 0 })) }; }
    if (p === "/api/ai/analyze") return analyze(body);
    if (p === "/api/quality") return quality();
    if (p === "/api/records" && method === "GET") return list(f);
    if (p === "/api/records" && method === "POST") return create(body);
    if ((mm = p.match(/^\/api\/records\/(\d+)$/))) { const id = +mm[1]; if (method === "GET") { const r = getRecord(id); if (!r) throw new Error("not found"); return r; } if (method === "PATCH") return update(id, body); if (method === "DELETE") return remove(id); }
    if ((mm = p.match(/^\/api\/records\/(\d+)\/image$/)) && method === "POST") { const file = opts.body.get("file"); return { image_path: await saveImage(+mm[1], file) }; }
    if (p === "/api/import") return importCsv(await opts.body.get("file").text());
    throw new Error("unknown route " + path);
  }

  return { api, generate, load, reset, imageBlob, exportCsv, parseQuery, apiKey, setApiKey, get n() { return D.n; }, AI_MODEL };
})();
