const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260719&limit=200';
const ESPN_ALIAS = { 'Czechia': 'Czech Republic', 'Bosnia-Herzegovina': 'Bosnia & Herzegovina', 'United States': 'USA', 'Türkiye': 'Turkey', 'Congo DR': 'DR Congo' };
const espnPairKey = (a, b, iso) => [mvNorm(a), mvNorm(b)].sort().join('|') + '|' + String(iso).slice(0, 10);

async function loadLiveScores() {
    try {
        const res = await fetch(ESPN_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const byPair = {};
        for (const ev of (data.events || [])) {
            const c = ev.competitions?.[0]; if (!c) continue;
            const t = (c.competitors || []).map(x => ({
                id: String(x.team?.id || ''),
                name: ESPN_ALIAS[x.team?.displayName] || x.team?.displayName || '',
                score: +x.score || 0,
                shoot: x.shootoutScore != null ? +x.shootoutScore : null
            }));
            if (t.length !== 2) continue;
            const goals = [[], []];
            const events = [];
            for (const dt of (c.details || [])) {
                const idx = t.findIndex(x => x.id === String(dt.team?.id || ''));
                if (idx < 0) continue;
                const typ = dt.type?.text || '';
                let kind = null;
                if (dt.scoringPlay) kind = 'goal';
                else if (/red/i.test(typ)) kind = 'red';
                else if (/yellow/i.test(typ)) kind = 'yellow';
                if (!kind) continue;
                const item = {
                    name: dt.athletesInvolved?.[0]?.displayName || dt.athletesInvolved?.[0]?.shortName || '?',
                    min: dt.clock?.displayValue || '', og: !!dt.ownGoal, pen: !!dt.penaltyKick
                };
                if (kind === 'goal') goals[idx].push(item);
                events.push({ idx, kind, ...item });
            }
            const statOf = comp => { const o = {}; for (const s of (comp.statistics || [])) o[s.name] = s.displayValue; return o; };
            const stats = [statOf(c.competitors[0]), statOf(c.competitors[1])];
            byPair[espnPairKey(t[0].name, t[1].name, c.date || ev.date)] = {
                id: ev.id, t, goals, events, stats,
                venue: (c.venue?.fullName || '') + (c.venue?.address?.city ? ' · ' + c.venue.address.city : ''),
                state: ev.status?.type?.state, clock: ev.status?.displayClock || '', detail: ev.status?.type?.detail || ''
            };
        }
        let liveCount = 0;
        for (const m of state.matches) {
            const ev = byPair[espnPairKey(m.team1, m.team2, m.kickoff.toISOString())];
            delete m.live; delete m.goals; delete m.summary;
            if (!ev) continue;
            const i1 = mvNorm(ev.t[0].name) === mvNorm(m.team1) ? 0 : 1;
            const s1 = ev.t[i1], s2 = ev.t[1 - i1];
            if (ev.goals[i1].length || ev.goals[1 - i1].length) m.goals = { h: ev.goals[i1], a: ev.goals[1 - i1] };
            if (ev.events.length || Object.keys(ev.stats[i1] || {}).length) {
                m.summary = {
                    venue: ev.venue,
                    statH: ev.stats[i1] || {}, statA: ev.stats[1 - i1] || {},
                    events: ev.events.map(e => ({ side: e.idx === i1 ? 'h' : 'a', kind: e.kind, name: e.name, min: e.min, og: e.og, pen: e.pen }))
                };
            }
            m.espnId = ev.id; // keep for on-demand detail fetch
            if (ev.state === 'in') {
                m.live = { h: s1.score, a: s2.score, clock: ev.clock, detail: ev.detail, espnId: ev.id, flip: i1 === 1 };
                liveCount++;
            } else if (ev.state === 'post' && !ftScore(m)) {
                m.score = m.score || {};
                m.score.ft = [s1.score, s2.score];
                if (s1.shoot != null && s2.shoot != null && (s1.shoot || s2.shoot)) m.score.p = [s1.shoot, s2.shoot];
            }
        }
        if (liveCount) $('statusText').textContent = `🔴 LIVE: ${liveCount} trận đang đá · tỉ số & phút cập nhật trực tiếp (ESPN)`;
        return true;
    } catch (e) {
        console.warn('Không lấy được tỉ số trực tiếp (ESPN), dùng openfootball:', e);
        return false;
    }
}

const ESPN_SUMMARY = id => `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${id}`;
async function loadLiveFeeds() {
    const lives = state.matches.filter(m => m.live && m.live.espnId);
    await Promise.all(lives.map(async m => {
        try {
            const r = await fetch(ESPN_SUMMARY(m.live.espnId), { cache: 'no-store' });
            if (!r.ok) return;
            const j = await r.json();
            const lu = { h: [], a: [] };
            for (const rs of (j.rosters || [])) {
                const nm = ESPN_ALIAS[rs.team?.displayName] || rs.team?.displayName || '';
                const side = mvNorm(nm) === mvNorm(m.team1) ? 'h' : 'a';
                lu[side] = (rs.roster || []).filter(p => p.starter).map(p => ({
                    num: p.jersey || '', name: p.athlete?.displayName || '', pos: p.position?.abbreviation || ''
                }));
            }
            const commentary = (j.commentary || []).map(c => ({ time: c.time?.displayValue || '', text: c.text || '', type: c.play?.type?.text || '' }));
            m.feed = { lineups: lu, commentary };
        } catch (e) { /* bỏ qua nếu không có feed */ }
    }));
    for (const m of state.matches) if (!m.live && m.feed) delete m.feed;
}

// ===================== VIỆT HÓA DIỄN BIẾN (ESPN chỉ có tiếng Anh) =====================
const VI_RULES = [
    [/Lineups are announced and players are warming up\.?/i, 'Đội hình ra sân, các cầu thủ đang khởi động.'],
    [/First Half begins\.?/i, 'Hiệp 1 bắt đầu.'],
    [/Second Half begins\s*/i, 'Hiệp 2 bắt đầu. '],
    [/First Half ends,/i, 'Hết hiệp 1,'],
    [/Second Half ends,/i, 'Hết hiệp 2,'],
    [/Match ends,/i, 'Trận đấu kết thúc,'],
    [/Delay over\.[^.]*\./i, 'Hết tạm dừng, trận đấu tiếp tục.'],
    [/Delay in match for a drinks break\.?/i, 'Tạm dừng để nghỉ uống nước.'],
    [/Delay in match because of an injury /i, 'Tạm dừng vì chấn thương '],
    [/Fourth official has announced (\d+) minutes of added time\.?/i, 'Trọng tài thứ tư công bố $1 phút bù giờ.'],
    [/Goal!\s*/g, 'BÀN THẮNG! '],
    [/Substitution, ([^.]+?)\. (.+?) replaces (.+?)\./g, 'Thay người, $1. $2 vào sân thay $3.'],
    [/Corner, ([^.]+?)\. Conceded by (.+?)\./g, 'Phạt góc, $1. Do $2 nhượng.'],
    [/Offside, ([^.]+?)\. (.+?) is caught offside\./g, 'Việt vị, $1. $2 rơi vào thế việt vị.'],
    [/Penalty conceded by /g, 'Phạt đền do '],
    [/Penalty ([^.,]+?)\./g, 'Phạt đền cho $1.'],
    [/Foul by /g, 'Phạm lỗi: '],
    [/Handball by /g, 'Để bóng chạm tay: '],
    [/Dangerous play by /g, 'Pha bóng nguy hiểm: '],
    [/ is shown the yellow card for a bad foul\./g, ' nhận thẻ vàng vì lỗi nghiêm trọng.'],
    [/ is shown the yellow card\.?/g, ' nhận thẻ vàng.'],
    [/ is shown the red card for violent conduct\./g, ' nhận thẻ đỏ vì hành vi bạo lực.'],
    [/ is shown the red card\.?/g, ' nhận thẻ đỏ.'],
    [/VAR Decision: Card upgraded /g, 'Quyết định VAR: nâng thẻ phạt '],
    [/ wins a free kick in the attacking half\./g, ' được hưởng quả phạt bên phần sân đối phương.'],
    [/ wins a free kick in the defensive half\./g, ' được hưởng quả phạt bên phần sân nhà.'],
    [/ wins a free kick on the left wing\./g, ' được hưởng quả phạt bên cánh trái.'],
    [/ wins a free kick on the right wing\./g, ' được hưởng quả phạt bên cánh phải.'],
    [/Attempt blocked\.\s*/g, 'Cú sút bị chặn. '],
    [/Attempt saved\.\s*/g, 'Cú sút bị cản phá. '],
    [/Attempt missed\.\s*/g, 'Cú sút ra ngoài. '],
    [/right footed shot/g, 'cú sút chân phải'],
    [/left footed shot/g, 'cú sút chân trái'],
    [/\bheader\b/g, 'pha đánh đầu'],
    [/from outside the box/g, 'từ ngoài vòng cấm'],
    [/from the centre of the box/g, 'từ giữa vòng cấm'],
    [/from the left side of the box/g, 'từ phía trái vòng cấm'],
    [/from the right side of the box/g, 'từ phía phải vòng cấm'],
    [/from very close range/g, 'từ cự ly rất gần'],
    [/from more than (\d+) yards/g, 'từ hơn $1 yard'],
    [/hits the right post/g, 'sút trúng cột dọc phải'],
    [/hits the left post/g, 'sút trúng cột dọc trái'],
    [/hits the bar/g, 'sút trúng xà ngang'],
    [/ is blocked\./g, ' bị chặn lại.'],
    [/ is too high\./g, ' đi quá cao.'],
    [/ is high and wide to the left\./g, ' đi cao và chệch trái.'],
    [/ is high and wide to the right\./g, ' đi cao và chệch phải.'],
    [/ is close, but misses to the left\./g, ' đi sát nhưng chệch trái.'],
    [/ is close, but misses to the right\./g, ' đi sát nhưng chệch phải.'],
    [/ is close, but misses the top left corner\./g, ' đi sát nhưng chệch góc trên bên trái.'],
    [/ is close, but misses the top right corner\./g, ' đi sát nhưng chệch góc trên bên phải.'],
    [/ misses to the left\./g, ' chệch sang trái.'],
    [/ misses to the right\./g, ' chệch sang phải.'],
    [/ is saved\b/g, ' bị cản phá'],
    [/Assisted by /g, 'Kiến tạo: '],
    [/ with a cross\b/g, ' bằng quả tạt'],
    [/ following a corner\b/g, ' sau quả phạt góc'],
    [/ following a set piece situation\b/g, ' sau tình huống cố định'],
    [/ to the bottom left corner\b/g, ' vào góc dưới bên trái'],
    [/ to the bottom right corner\b/g, ' vào góc dưới bên phải'],
    [/ to the top left corner\b/g, ' vào góc trên bên trái'],
    [/ to the top right corner\b/g, ' vào góc trên bên phải'],
    [/ to the centre of the goal\b/g, ' vào giữa khung thành'],
    [/ in the top left corner\b/g, ' ở góc trên bên trái'],
    [/ in the bottom left corner\b/g, ' ở góc dưới bên trái'],
    [/ in the top right corner\b/g, ' ở góc trên bên phải'],
    [/ in the bottom right corner\b/g, ' ở góc dưới bên phải'],
    [/ in the top centre of the goal\b/g, ' ở chính giữa trên khung thành'],
    [/ by (?=[A-ZÀ-Ỹ])/g, ' bởi ']
];
const viComment = txt => { let s = String(txt || ''); for (const [re, rep] of VI_RULES) s = s.replace(re, rep); return s; };

// ===================== NÂNG CAO — SHARED BUILDER =====================
const ADV_STAT_ROWS = [
    ['possessionPct','Kiểm soát bóng','%'],['totalShots','Dứt điểm',''],
    ['shotsOnTarget','Sút trúng đích',''],['wonCorners','Phạt góc',''],['foulsCommitted','Phạm lỗi','']
];

function buildMatchAdvHtml(m) {
    const md = state.matchDetails?.[m.key];

    if (!md) {
        return '<p class="text-sm text-slate-600 italic">Chưa có dữ liệu — GitHub Action sẽ crawl tự động.</p>';
    }

    const statBar = (label, hv, av, unit) => {
        const h = parseFloat(hv) || 0, a = parseFloat(av) || 0, tot = h + a, pct = tot ? Math.round(h / tot * 100) : 50;
        return `<div class="space-y-1">
            <div class="flex justify-between items-center text-sm">
                <b class="text-sky-300 w-12">${esc(String(hv ?? 0))}${unit}</b>
                <span class="text-slate-500">${label}</span>
                <b class="text-rose-300 w-12 text-right">${esc(String(av ?? 0))}${unit}</b>
            </div>
            <div class="flex h-2 rounded-full overflow-hidden bg-slate-700/40">
                <div class="bg-sky-400" style="width:${pct}%"></div><div class="bg-rose-400" style="width:${100-pct}%"></div>
            </div>
        </div>`;
    };
    const luCol = arr => arr?.length ? arr.map(p =>
        `<div class="truncate leading-snug"><span class="inline-block w-6 text-slate-500 text-xs">${esc(p.num)}</span> ${esc(p.name)}${p.pos ? ` <span class="text-xs text-slate-600">${esc(p.pos)}</span>` : ''}</div>`
    ).join('') : '<div class="text-slate-600 text-xs">—</div>';

    const statsHtml = ADV_STAT_ROWS
        .filter(([k]) => md.statH?.[k] != null || md.statA?.[k] != null)
        .map(([k, l, u]) => statBar(l, md.statH?.[k], md.statA?.[k], u)).join('');
    const comHtml = md.commentary?.length ? md.commentary.slice().reverse().slice(0, 50).map(c => `
        <div class="flex gap-2 items-baseline text-sm">
            <span class="w-10 shrink-0 text-amber-400/70 font-semibold">${esc(c.time)}</span>
            <span class="flex-1 text-slate-400 leading-snug">${esc(viComment(c.text))}</span>
        </div>`).join('') : '';
    const hasLineup = md.lineups?.h?.length || md.lineups?.a?.length;

    // Chấm điểm cầu thủ (FotMob)
    const ratings = state.playerRatings?.[m.key];
    const ratingColor = r => { const v = parseFloat(r) || 0; return v >= 8 ? 'text-emerald-400' : v >= 7 ? 'text-amber-400' : v >= 6 ? 'text-slate-300' : 'text-rose-400'; };
    const ratingCol = arr => arr?.length ? arr.map(p =>
        `<div class="flex items-baseline gap-1.5 leading-snug"><span class="inline-block w-6 text-slate-500 text-xs shrink-0">${esc(p.num)}</span><span class="flex-1 truncate">${esc(p.name)}</span><b class="${ratingColor(p.rating)} tabular-nums shrink-0">${esc(p.rating)}</b></div>`
    ).join('') : '<div class="text-slate-600 text-xs">—</div>';
    const hasRatings = ratings && (ratings.h?.length || ratings.a?.length);

    const sub = (icon, label, cls, content) => content ? `
        <details class="border border-white/5 rounded-lg p-3">
            <summary class="cursor-pointer text-sm font-semibold ${cls} py-0.5">${icon} ${label}</summary>
            <div class="pt-2">${content}</div>
        </details>` : '';

    return `<div class="space-y-2 text-sm">
        ${md.venue ? `<p class="text-xs text-slate-600 text-center">🏟️ ${esc(md.venue)}</p>` : ''}
        ${sub('📋', 'Đội hình ra sân', 'text-sky-300/70 hover:text-sky-300', hasLineup ? `
            <div class="grid grid-cols-2 gap-x-4 text-sm">
                <div class="text-right space-y-0.5 pr-4 border-r border-white/5">${luCol(md.lineups.h)}</div>
                <div class="text-left space-y-0.5">${luCol(md.lineups.a)}</div>
            </div>` : '')}
        ${sub('⭐', 'Chấm điểm cầu thủ', 'text-amber-300/70 hover:text-amber-300', hasRatings ? `
            <div class="grid grid-cols-2 gap-x-4 text-sm">
                <div class="space-y-0.5 pr-4 border-r border-white/5">${ratingCol(ratings.h)}</div>
                <div class="space-y-0.5">${ratingCol(ratings.a)}</div>
            </div>` : '')}
        ${sub('📊', 'Thống kê', 'text-emerald-300/70 hover:text-emerald-300', statsHtml ? `<div class="space-y-2">${statsHtml}</div>` : '')}
        ${sub('📝', 'Diễn biến', 'text-slate-400/70 hover:text-slate-300', comHtml ? `<div class="space-y-2 max-h-80 overflow-y-auto pr-1">${comHtml}</div>` : '')}
    </div>`;
}

