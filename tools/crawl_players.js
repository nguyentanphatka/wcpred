// Crawl hồ sơ cầu thủ WC2026 từ Wikidata (public domain data, ảnh Wikimedia Commons)
// và nhúng vào <script id="playerdb"> trong index.html.
// Chạy:  node tools/crawl_players.js
'use strict';
const fs = require('fs');
const path = require('path');

const SQUADS_URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.squads.json';
const INDEX = path.join(__dirname, '..', 'index.html');
const UA = 'WC2026-PredictArena/1.0 (du doan noi bo; lien he: nguyentanphatuit@gmail.com)';
const FOOTBALLER = 'Q937857'; // occupation: association football player

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url) {
  for (let a = 1; a <= 4; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (r.status === 429) { await sleep(2500 * a); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { if (a === 4) throw e; await sleep(800 * a); }
  }
}
const wapi = p => getJSON('https://www.wikidata.org/w/api.php?format=json&origin=*&' + new URLSearchParams(p));

// Chạy fn trên items với tối đa n request song song
async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch { out[k] = null; } }
  }));
  return out;
}

(async () => {
  const squads = await getJSON(SQUADS_URL);
  const players = [];
  for (const t of squads) for (const p of (t.players || [])) players.push({ team: t.name, ...p });
  console.log('Tổng cầu thủ:', players.length);

  // 1) Tìm ứng viên Wikidata theo tên
  console.log('B1: search tên trên Wikidata...');
  const cands = await pool(players, 6, async (p, k) => {
    if (k && k % 200 === 0) console.log('  search', k, '/', players.length);
    const r = await wapi({ action: 'wbsearchentities', search: p.name, language: 'en', uselang: 'en', type: 'item', limit: 7 });
    return (r?.search || []).map(s => s.id);
  });

  // 2) Lấy claims của toàn bộ ứng viên (batch 50 id/request)
  const allIds = [...new Set(cands.flat().filter(Boolean))];
  console.log('B2: lấy dữ liệu', allIds.length, 'ứng viên...');
  const ent = {};
  const batches = []; for (let i = 0; i < allIds.length; i += 50) batches.push(allIds.slice(i, i + 50));
  await pool(batches, 4, async (ids, k) => {
    if (k && k % 20 === 0) console.log('  entities batch', k, '/', batches.length);
    const r = await wapi({ action: 'wbgetentities', ids: ids.join('|'), props: 'claims' });
    Object.assign(ent, r?.entities || {});
  });

  const claims = (e, p) => e?.claims?.[p] || [];
  const time = c => c?.mainsnak?.datavalue?.value?.time || '';
  const qty = c => c?.mainsnak?.datavalue?.value;
  const item = c => c?.mainsnak?.datavalue?.value?.id;

  // 3) Khớp đúng người bằng NGÀY SINH + nghề cầu thủ
  const db = {}; const clubIds = new Set();
  players.forEach((p, k) => {
    let hit = null;
    for (const id of (cands[k] || [])) {
      const e = ent[id]; if (!e) continue;
      const isFoot = claims(e, 'P106').some(c => item(c) === FOOTBALLER) || claims(e, 'P54').length > 0;
      if (!isFoot) continue;
      if (p.date_of_birth && claims(e, 'P569').some(c => time(c).startsWith('+' + p.date_of_birth))) { hit = e; break; }
    }
    if (!hit) return;
    const rec = {};
    const img = claims(hit, 'P18')[0]?.mainsnak?.datavalue?.value;
    if (img) rec.img = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(String(img).replace(/ /g, '_')) + '?width=400';
    const h = qty(claims(hit, 'P2048')[0]);
    if (h) { let v = parseFloat(h.amount); if (String(h.unit).endsWith('Q11573')) v *= 100; v = Math.round(v); if (v > 140 && v < 230) rec.h = v; }
    const w = qty(claims(hit, 'P2067')[0]);
    if (w) { const v = Math.round(parseFloat(w.amount)); if (v > 40 && v < 130) rec.w = v; }
    // CLB hiện tại: các statement P54 không có ngày kết thúc (lọc đội tuyển QG sau khi có label)
    const open = claims(hit, 'P54').filter(c => !(c.qualifiers && c.qualifiers.P582)).map(item).filter(Boolean);
    if (open.length) { rec._clubs = open; open.forEach(id => clubIds.add(id)); }
    if (Object.keys(rec).length) db[p.name + '|' + (p.date_of_birth || '')] = rec;
  });

  // 4) Lấy label CLB, bỏ các entry là đội tuyển quốc gia
  console.log('B3: lấy tên', clubIds.size, 'CLB...');
  const clubArr = [...clubIds]; const clubLabel = {};
  for (let i = 0; i < clubArr.length; i += 50) {
    const r = await wapi({ action: 'wbgetentities', ids: clubArr.slice(i, i + 50).join('|'), props: 'labels', languages: 'en' });
    for (const [id, e] of Object.entries(r?.entities || {})) clubLabel[id] = e?.labels?.en?.value || '';
  }
  for (const rec of Object.values(db)) {
    if (!rec._clubs) continue;
    const names = rec._clubs.map(id => clubLabel[id]).filter(n => n && !/national|under-\d|U-?\d\d/i.test(n));
    if (names.length) rec.club = names[names.length - 1];
    delete rec._clubs;
  }

  const stats = {
    players: players.length,
    matched: Object.keys(db).length,
    withImg: Object.values(db).filter(r => r.img).length,
    withHeight: Object.values(db).filter(r => r.h).length,
    withWeight: Object.values(db).filter(r => r.w).length,
    withClub: Object.values(db).filter(r => r.club).length
  };
  console.log('Kết quả:', stats);

  const payload = JSON.stringify({ updated: new Date().toISOString().slice(0, 10), source: 'Wikidata / Wikimedia Commons', stats, players: db });
  fs.writeFileSync(path.join(__dirname, 'playerdb.json'), payload);

  // 5) Nhúng vào index.html (thay nội dung <script id="playerdb">)
  let html = fs.readFileSync(INDEX, 'utf8');
  const re = /(<script id="playerdb" type="application\/json">)[\s\S]*?(<\/script>)/;
  if (!re.test(html)) throw new Error('Không tìm thấy <script id="playerdb"> trong index.html');
  html = html.replace(re, `$1\n${payload}\n$2`);
  fs.writeFileSync(INDEX, html);
  console.log('ĐÃ NHÚNG vào index.html —', (payload.length / 1024).toFixed(0), 'KB');
})().catch(e => { console.error('LỖI:', e); process.exit(1); });
