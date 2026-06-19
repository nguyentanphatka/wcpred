// Crawl chi tiết trận đấu đã kết thúc từ ESPN (đội hình, thống kê, diễn biến).
// Lần đầu: crawl toàn bộ trận đã đấu.
// Các lần sau: chỉ thêm trận mới kết thúc, bỏ qua trận đã có trong cache.
// Chạy: node tools/crawl-match-details.js
'use strict';
const fs = require('fs');
const path = require('path');

const WC_FILE  = path.join(__dirname, '..', 'data', 'wc2026.json');
const OUT_FILE = path.join(__dirname, '..', 'data', 'match-details.json');
const BOARD_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200';
const SUM_URL  = id => `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${id}`;

const ESPN_ALIAS = {
    'Czechia': 'Czech Republic', 'Bosnia-Herzegovina': 'Bosnia & Herzegovina',
    'United States': 'USA', 'Türkiye': 'Turkey', 'Congo DR': 'DR Congo'
};

const norm  = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJSON(url) {
    for (let a = 1; a <= 3; a++) {
        try {
            const r = await fetch(url, { headers: { Accept: 'application/json' } });
            if (r.status === 429) { await sleep(2000 * a); continue; }
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return await r.json();
        } catch (e) { if (a === 3) throw e; await sleep(800 * a); }
    }
}

function parseKickoff(m) {
    const t = /(\d{1,2}):(\d{2}) UTC([+-]\d+)/.exec(m.time || '');
    if (!t) return new Date(m.date + 'T12:00:00Z');
    const off = t[3].replace(/([+-])(\d)$/, '$10$2') + ':00';
    return new Date(`${m.date}T${t[1].padStart(2,'0')}:${t[2]}:00${off}`);
}
function matchKey(m) { return m.num ? 'm' + m.num : `g:${m.group}:${m.team1}|${m.team2}`; }
function pairKey(team1, team2, kickoff) {
    return [norm(team1), norm(team2)].sort().join('|') + '|' + kickoff.toISOString().slice(0, 10);
}

(async () => {
    // Load existing cache — giữ nguyên các trận đã crawl
    let cache = {};
    try { cache = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')); } catch {}
    const cached = new Set(Object.keys(cache));
    console.log(`Cache hiện tại: ${cached.size} trận`);

    // Load WC match list
    const wc = JSON.parse(fs.readFileSync(WC_FILE, 'utf8'));
    const wcMatches = (wc.matches || []).map(m => ({ ...m, kickoff: parseKickoff(m), key: matchKey(m) }));

    const wcByPair = {};
    for (const m of wcMatches) wcByPair[pairKey(m.team1, m.team2, m.kickoff)] = m;

    // Fetch ESPN scoreboard — chỉ các trận đã kết thúc
    console.log('Đang lấy lịch thi đấu ESPN...');
    const board = await getJSON(BOARD_URL);
    const finishedEvents = (board.events || []).filter(ev => ev.status?.type?.state === 'post');
    console.log(`ESPN: ${finishedEvents.length} trận đã kết thúc`);

    // Ghép ESPN ↔ WC, bỏ qua trận đã có trong cache
    const toFetch = [];
    for (const ev of finishedEvents) {
        const c = ev.competitions?.[0]; if (!c) continue;
        const teams = (c.competitors || []).map(x => ESPN_ALIAS[x.team?.displayName] || x.team?.displayName || '');
        if (teams.length !== 2) continue;
        const evDate = (c.date || ev.date || '').slice(0, 10);

        let wm = wcByPair[[norm(teams[0]), norm(teams[1])].sort().join('|') + '|' + evDate];
        if (!wm) {
            for (const d of [-1, 1]) {
                const alt = new Date(evDate + 'T00:00:00Z');
                alt.setDate(alt.getDate() + d);
                wm = wcByPair[[norm(teams[0]), norm(teams[1])].sort().join('|') + '|' + alt.toISOString().slice(0, 10)];
                if (wm) break;
            }
        }
        if (!wm) { console.log(`  [bỏ qua] không khớp WC: ${teams.join(' vs ')} (${evDate})`); continue; }
        if (cached.has(wm.key)) { console.log(`  [đã có]  ${wm.team1} vs ${wm.team2}`); continue; }

        toFetch.push({ wm, espnId: ev.id, competitors: c.competitors || [], details: c.details || [] });
    }

    if (toFetch.length === 0) {
        console.log('Không có trận mới cần crawl.');
        process.exit(0);
    }

    console.log(`\nCrawl ${toFetch.length} trận mới...`);
    let saved = 0, failed = 0;

    for (const { wm, espnId, competitors, details } of toFetch) {
        try {
            process.stdout.write(`  ${wm.team1} vs ${wm.team2} (id=${espnId})... `);
            const j = await getJSON(SUM_URL(espnId));

            // Lineups
            const lineups = { h: [], a: [] };
            for (const rs of (j.rosters || [])) {
                const nm = ESPN_ALIAS[rs.team?.displayName] || rs.team?.displayName || '';
                const side = norm(nm) === norm(wm.team1) ? 'h' : 'a';
                lineups[side] = (rs.roster || [])
                    .filter(p => p.starter)
                    .map(p => ({ num: p.jersey || '', name: p.athlete?.displayName || '', pos: p.position?.abbreviation || '' }));
            }

            // Commentary
            const commentary = (j.commentary || []).map(c => ({
                time: c.time?.displayValue || '', text: c.text || ''
            }));

            // Stats
            const statOf = comp => { const o = {}; for (const s of (comp?.statistics || [])) o[s.name] = s.displayValue; return o; };
            const compStats = competitors.map(x => ({
                name: ESPN_ALIAS[x.team?.displayName] || x.team?.displayName || '',
                stats: statOf(x)
            }));
            const i1 = compStats.findIndex(x => norm(x.name) === norm(wm.team1));
            const statH = i1 >= 0 ? compStats[i1].stats : {};
            const statA = i1 >= 0 ? compStats[1 - i1].stats : {};

            // Goals & events
            const goals = { h: [], a: [] };
            const events = [];
            const compIds = competitors.map(x => String(x.team?.id || ''));
            for (const dt of details) {
                const idx = compIds.indexOf(String(dt.team?.id || '')); if (idx < 0) continue;
                const typ = dt.type?.text || '';
                let kind = null;
                if (dt.scoringPlay) kind = 'goal';
                else if (/red/i.test(typ)) kind = 'red';
                else if (/yellow/i.test(typ)) kind = 'yellow';
                if (!kind) continue;
                const nm = ESPN_ALIAS[competitors[idx]?.team?.displayName] || competitors[idx]?.team?.displayName || '';
                const side = norm(nm) === norm(wm.team1) ? 'h' : 'a';
                const item = { name: dt.athletesInvolved?.[0]?.displayName || '?', min: dt.clock?.displayValue || '', og: !!dt.ownGoal, pen: !!dt.penaltyKick };
                if (kind === 'goal') goals[side].push(item);
                events.push({ side, kind, ...item });
            }

            cache[wm.key] = { espnId, venue: j.gameInfo?.venue?.fullName || '', lineups, commentary, goals, events, statH, statA, crawled: new Date().toISOString().slice(0, 10) };
            saved++;
            console.log('✓');
            await sleep(400);
        } catch (e) {
            failed++;
            console.log(`SKIP: ${e.message}`);
        }
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(cache));
    console.log(`\nXong. Thêm ${saved} trận mới, bỏ qua ${failed}. Tổng cache: ${Object.keys(cache).length} trận.`);
})().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
