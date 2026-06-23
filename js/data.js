async function loadMatches() {
    $('statusSpinner').classList.remove('hidden');
    $('statusText').textContent = 'Đang tải lịch thi đấu & kết quả World Cup 2026...';

    const sources = [
        { url: DATA_URL, opts: { cache: 'no-store' }, offline: false },
        { url: './data/wc2026.json', opts: {}, offline: true },
    ];

    for (const src of sources) {
        try {
            const res = await fetch(src.url, src.opts);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            const teamSet = new Set();
            state.matches = data.matches.map(m => {
                if (m.group) { teamSet.add(m.team1); teamSet.add(m.team2); }
                const norm = { ...m, kickoff: parseKickoff(m) };
                norm.key = matchKey(norm);
                return norm;
            });
            state.teams = [...teamSet].sort();
            $('matchCountBadge').textContent = `${state.matches.length} trận`;
            $('statusSpinner').classList.add('hidden');
            if (src.offline) {
                $('statusText').textContent = `⚠️ Dùng lịch offline · ${state.matches.length} trận (không kết nối được nguồn online)`;
                $('statusBanner').classList.add('bg-amber-950/40', 'border-amber-700/50');
            } else {
                $('statusText').textContent = `Đã tải ${state.matches.length} trận · nguồn cập nhật ~hằng ngày`;
                $('statusBanner').classList.add('bg-sky-950/40', 'border-sky-800/50');
            }
            return true;
        } catch (e) {
            console.warn(`[loadMatches] ${src.offline ? 'offline' : 'online'} failed:`, e);
        }
    }

    $('statusSpinner').classList.add('hidden');
    $('statusText').textContent = '❌ Không tải được dữ liệu trận đấu. Kiểm tra mạng rồi bấm "Cập nhật KQ".';
    return false;
}

async function loadMatchDetails() {
    try {
        const res = await fetch('./data/match-details.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        state.matchDetails = await res.json();
    } catch (e) {
        console.warn('Không tải được match-details.json:', e);
    }
}

async function loadPlayerRatings() {
    try {
        const res = await fetch('./data/player-ratings.json', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        state.playerRatings = await res.json();
    } catch (e) {
        console.warn('Không tải được player-ratings.json:', e);
    }
}

async function loadSquads() {
    try {
        const res = await fetch(SQUADS_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        state.squads = {};
        data.forEach(t => { state.squads[TEAM_ALIAS[t.name] || t.name] = t.players || []; });
    } catch (e) {
        console.error('Không tải được đội hình:', e);
    }
}
