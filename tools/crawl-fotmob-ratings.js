// Crawl điểm cầu thủ (rating) các trận đã đá từ FotMob.
// Nguồn: trang league WC (lấy danh sách trận) + endpoint matchDetails (lấy rating).
// Lần đầu: crawl toàn bộ trận đã đấu. Các lần sau: chỉ thêm trận mới, bỏ qua trận đã có cache.
// Fail mềm: lỗi mạng/bị chặn sẽ exit 0 để không làm vỡ pipeline.
// Chạy: node tools/crawl-fotmob-ratings.js
'use strict';
const fs = require('fs');
const path = require('path');

const WC_FILE  = path.join(__dirname, '..', 'data', 'wc2026.json');
const OUT_FILE = path.join(__dirname, '..', 'data', 'player-ratings.json');
const LEAGUE_URL = 'https://www.fotmob.com/leagues/77/matches/world-cup';
const DETAIL_URL = id => `https://www.fotmob.com/api/data/matchDetails?matchId=${id}`;

// FotMob dùng tên đội hơi khác wc2026.json
const FOTMOB_ALIAS = {
    'Czechia': 'Czech Republic', 'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
    'United States': 'USA', 'Turkiye': 'Turkey', 'Türkiye': 'Turkey', 'DR Congo': 'DR Congo'
};

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: 'https://www.fotmob.com/'
};

const norm  = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getText(url) {
    for (let a = 1; a <= 3; a++) {
        try {
            const r = await fetch(url, { headers: HEADERS });
            if (r.status === 429) { await sleep(2000 * a); continue; }
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return await r.text();
        } catch (e) { if (a === 3) throw e; await sleep(800 * a); }
    }
}
async function getJSON(url) { return JSON.parse(await getText(url)); }

function parseKickoff(m) {
    const t = /(\d{1,2}):(\d{2}) UTC([+-]\d+)/.exec(m.time || '');
    if (!t) return new Date(m.date + 'T12:00:00Z');
    const off = t[3].replace(/([+-])(\d)$/, '$10$2') + ':00';
    return new Date(`${m.date}T${t[1].padStart(2, '0')}:${t[2]}:00${off}`);
}
function matchKey(m) { return m.num ? 'm' + m.num : `g:${m.group}:${m.team1}|${m.team2}`; }
function pairKey(team1, team2, dateStr) {
    return [norm(team1), norm(team2)].sort().join('|') + '|' + dateStr;
}
const alias = n => FOTMOB_ALIAS[n] || n;

// Lấy rating mỗi cầu thủ ra sân từ 1 team-object trong lineup
function ratingsOf(team) {
    const all = [...(team?.starters || []), ...(team?.subs || [])];
    return all
        .filter(p => p?.performance?.rating != null)
        .map(p => ({ num: String(p.shirtNumber ?? ''), name: p.name || '', rating: String(p.performance.rating) }))
        .sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating));
}

(async () => {
    // Cache hiện tại
    let cache = {};
    try { cache = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')); } catch {}
    const cached = new Set(Object.keys(cache));
    console.log(`Cache rating hiện tại: ${cached.size} trận`);

    // Danh sách trận WC từ file local
    const wc = JSON.parse(fs.readFileSync(WC_FILE, 'utf8'));
    const wcMatches = (wc.matches || []).map(m => ({ ...m, kickoff: parseKickoff(m), key: matchKey(m) }));
    const wcByPair = {};
    for (const m of wcMatches) wcByPair[pairKey(m.team1, m.team2, m.kickoff.toISOString().slice(0, 10))] = m;

    // Lấy danh sách trận từ FotMob (qua __NEXT_DATA__ của trang league)
    let allMatches;
    try {
        const html = await getText(LEAGUE_URL);
        const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
        if (!m) throw new Error('không tìm thấy __NEXT_DATA__');
        const j = JSON.parse(m[1]);
        allMatches = j.props?.pageProps?.fixtures?.allMatches || [];
        console.log(`FotMob: ${allMatches.length} trận trong lịch`);
    } catch (e) {
        console.log(`Không lấy được lịch FotMob (có thể bị chặn): ${e.message}`);
        process.exit(0); // fail mềm
    }

    // Ghép FotMob ↔ WC, bỏ qua trận đã có cache
    const toFetch = [];
    for (const fm of allMatches) {
        if (!fm.status?.finished) continue;
        const date = (fm.status?.utcTime || '').slice(0, 10);
        const home = alias(fm.home?.name || ''), away = alias(fm.away?.name || '');
        let wm = wcByPair[pairKey(home, away, date)];
        if (!wm) {
            for (const d of [-1, 1]) {
                const alt = new Date(date + 'T00:00:00Z'); alt.setDate(alt.getDate() + d);
                wm = wcByPair[pairKey(home, away, alt.toISOString().slice(0, 10))];
                if (wm) break;
            }
        }
        if (!wm || cached.has(wm.key)) continue;
        toFetch.push({ wm, fmId: fm.id });
    }

    if (toFetch.length === 0) { console.log('Không có trận mới cần crawl rating.'); process.exit(0); }
    console.log(`\nCrawl rating ${toFetch.length} trận mới...`);

    let saved = 0, failed = 0;
    for (const { wm, fmId } of toFetch) {
        try {
            process.stdout.write(`  ${wm.team1} vs ${wm.team2} (id=${fmId})... `);
            const j = await getJSON(DETAIL_URL(fmId));
            const lu = j.content?.lineup;
            if (!lu) throw new Error('thiếu lineup');
            // Map home/away của FotMob → team1/team2 của WC theo tên
            const homeName = alias(lu.homeTeam?.name || '');
            const homeIsTeam1 = norm(homeName) === norm(wm.team1);
            const h = ratingsOf(homeIsTeam1 ? lu.homeTeam : lu.awayTeam);
            const a = ratingsOf(homeIsTeam1 ? lu.awayTeam : lu.homeTeam);
            if (!h.length && !a.length) throw new Error('không có rating');
            cache[wm.key] = { h, a, crawled: new Date().toISOString().slice(0, 10) };
            saved++;
            console.log('✓');
            await sleep(500);
        } catch (e) {
            failed++;
            console.log(`SKIP: ${e.message}`);
        }
    }

    if (saved > 0) {
        fs.writeFileSync(OUT_FILE, JSON.stringify(cache));
        console.log(`\nXong. Thêm ${saved} trận, bỏ qua ${failed}. Tổng cache: ${Object.keys(cache).length} trận.`);
    } else {
        console.log(`\nKhông lưu (thêm 0, bỏ qua ${failed}).`);
    }
})().catch(e => { console.error('LỖI:', e.message); process.exit(0); });
