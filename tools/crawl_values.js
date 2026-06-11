// Crawl giá trị chuyển nhượng từ FotMob cho các cầu thủ CHƯA có trong tnhung71,
// khớp đúng người bằng ngày sinh, rồi merge vào <script id="tnhung71"> trong index.html.
// Chạy:  node tools/crawl_values.js
'use strict';
const fs = require('fs');
const path = require('path');

const SQUADS_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.squads.json';
const INDEX = path.join(__dirname, '..', 'index.html');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

async function getJSON(url) {
  for (let a = 1; a <= 4; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (r.status === 429 || r.status === 403) { await sleep(3000 * a); continue; }
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (a === 4) return null; await sleep(1000 * a); }
  }
  return null;
}

async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

const pdCache = new Map();
async function playerData(id) {
  if (pdCache.has(id)) return pdCache.get(id);
  const r = await getJSON('https://www.fotmob.com/api/data/playerData?id=' + id);
  pdCache.set(id, r);
  return r;
}

(async () => {
  // 1) Danh sách cầu thủ + tnhung71 hiện tại
  const squads = await getJSON(SQUADS_URL);
  const players = [];
  for (const t of squads) for (const p of (t.players || [])) players.push({ team: t.name, ...p });

  let html = fs.readFileSync(INDEX, 'utf8');
  const reTn = /(<script id="tnhung71" type="application\/json">)([\s\S]*?)(<\/script>)/;
  const mTn = html.match(reTn);
  if (!mTn) throw new Error('Không tìm thấy <script id="tnhung71">');
  const tn = JSON.parse(mTn[2]);
  const have = new Set(Object.keys(tn.values || {}).map(norm));
  const missing = players.filter(p => !have.has(norm(p.name)));
  console.log(`Tổng: ${players.length} · đã có giá: ${players.length - missing.length} · thiếu: ${missing.length}`);

  // 2) Crawl FotMob cho từng cầu thủ thiếu (search -> verify ngày sinh -> market value)
  let done = 0;
  const found = await pool(missing, 5, async (p) => {
    done++; if (done % 100 === 0) console.log('  tiến độ', done, '/', missing.length);
    const sr = await getJSON('https://apigw.fotmob.com/searchapi/suggest?term=' + encodeURIComponent(p.name) + '&lang=en');
    const opts = (sr?.squadMemberSuggest || []).flatMap(g => g.options || []);
    const ids = opts.map(o => String(o.text || o).split('|').pop()).filter(x => /^\d+$/.test(x)).slice(0, 5);
    for (const id of ids) {
      const pd = await playerData(id);
      if (!pd) continue;
      const dob = (pd.birthDate?.utcTime || '').slice(0, 10);
      if (!p.date_of_birth || dob !== p.date_of_birth) continue; // bắt buộc khớp ngày sinh
      const mvInfo = (pd.playerInformation || []).find(i => i.title === 'Market value');
      const eur = mvInfo?.value?.numberValue;
      if (!eur || eur <= 0) return null;
      const m = eur / 1e6;
      return { name: p.name, mv: m >= 10 ? Math.round(m) : Math.round(m * 10) / 10 };
    }
    return null;
  });

  const adds = found.filter(Boolean);
  console.log(`Tìm được giá cho ${adds.length}/${missing.length} cầu thủ thiếu`);

  // 3) Merge vào tnhung71 (giữ nguyên data nhập tay, chỉ thêm mới)
  for (const a of adds) if (!have.has(norm(a.name))) tn.values[a.name] = a.mv;
  tn.updated = new Date().toISOString().slice(0, 10);
  tn.source = 'transfermarkt.com (nhập tay) + FotMob (crawl tự động)';
  tn.autoCount = (tn.autoCount || 0) + adds.length;

  // Nhúng thẳng vào index.html — KHÔNG ghi file phụ
  const payload = JSON.stringify(tn);
  html = html.replace(reTn, `$1\n${payload}\n$3`);
  fs.writeFileSync(INDEX, html);

  const still = missing.length - adds.length;
  console.log(`ĐÃ MERGE vào index.html · tổng giá trị có data: ${Object.keys(tn.values).length} · còn thiếu: ${still}`);
})().catch(e => { console.error('LỖI:', e); process.exit(1); });
