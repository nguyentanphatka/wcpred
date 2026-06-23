let matchesSubTab = 'upcoming'; // 'upcoming' | 'past'
let matchesTeam = '';

function renderMatches() {
    const box = $('tab-matches');
    if (!box || !box.classList.contains('active')) return;

    const now = Date.now();
    let matches = matchesTeam
        ? state.matches.filter(m => m.team1 === matchesTeam || m.team2 === matchesTeam)
        : state.matches;

    // Populate team filter once
    const sel = $('matchesTeamFilter');
    if (sel.options.length <= 1 && state.teams.length) {
        state.teams.forEach(t => {
            const o = document.createElement('option');
            o.value = t; o.textContent = flagOf(t) + ' ' + t;
            sel.appendChild(o);
        });
    }
    sel.value = matchesTeam;
    $('matchesFilterClear').classList.toggle('hidden', !matchesTeam);
    $('matchesFilterCount').textContent = matchesTeam
        ? `${matches.length} trận của ${matchesTeam}`
        : `${state.matches.length} trận tổng`;

    const upcoming = matches
        .filter(m => !ftScore(m) && !realWinner(m))
        .sort((a, b) => a.kickoff - b.kickoff);
    const past = matches
        .filter(m => ftScore(m) || realWinner(m))
        .sort((a, b) => b.kickoff - a.kickoff);

    // Sub-tab buttons
    $('matchesTabUpcoming').className = 'matches-sub-tab flex-1 py-2 text-sm font-semibold rounded-lg transition-colors '
        + (matchesSubTab === 'upcoming' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white');
    $('matchesTabPast').className = 'matches-sub-tab flex-1 py-2 text-sm font-semibold rounded-lg transition-colors '
        + (matchesSubTab === 'past' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white');

    const list = matchesSubTab === 'upcoming' ? upcoming : past;
    $('matchesListContainer').innerHTML = list.length ? renderMatchList(list) : `
        <div class="text-center text-slate-500 py-12">
            ${matchesSubTab === 'upcoming' ? '🎉 Tất cả trận đã kết thúc' : '⏳ Chưa có trận nào kết thúc'}
        </div>`;
}

// Bàn thắng (scorers) — lưới 2 cột: đội nhà trái, đội khách phải
function matchGoalsBlock(md) {
    if (!md?.goals || (!md.goals.h?.length && !md.goals.a?.length)) return '';
    const line = gl => `<div class="truncate leading-tight"><span class="text-white">${esc(gl.name)}</span> <span class="text-amber-400 font-semibold">${esc(gl.min)}</span>${gl.pen ? '<span class="text-slate-500"> (pen)</span>' : ''}${gl.og ? '<span class="text-rose-400"> (OG)</span>' : ''}</div>`;
    return `
    <div class="grid grid-cols-2 gap-x-3 text-[11px] sm:text-sm border border-white/5 rounded-lg p-3">
        <div class="text-right space-y-0.5 pr-3 border-r border-white/5">
            <div class="text-[9px] sm:text-[11px] uppercase tracking-wider text-slate-600 mb-0.5">⚽ Bàn thắng</div>
            ${md.goals.h?.length ? md.goals.h.map(line).join('') : '<div class="text-slate-600">—</div>'}
        </div>
        <div class="text-left space-y-0.5 pl-3">
            <div class="text-[9px] sm:text-[11px] uppercase tracking-wider text-slate-600 mb-0.5">Bàn thắng ⚽</div>
            ${md.goals.a?.length ? md.goals.a.map(line).join('') : '<div class="text-slate-600">—</div>'}
        </div>
    </div>`;
}

function renderMatchList(matches) {
    const rows = matches.map(m => {
        const ft = ftScore(m);
        const winner = realWinner(m);
        const locked = isLocked(m);
        const live = locked && !ft && !winner;
        const pick = state.myPred.picks[m.key] || {};
        const earned = locked ? matchEarned(state.myPred, m) : null;
        const label = m.group ? esc(m.group) : (ROUND_VI[m.round] || esc(m.round));
        const md = (ft || winner) ? state.matchDetails?.[m.key] : null;

        // Score / state cell
        let scoreTxt, scoreClass;
        if (ft) {
            scoreTxt = `<span class="tabular-nums font-extrabold text-base sm:text-lg">${ft[0]}</span><span class="text-slate-500 mx-0.5 sm:mx-1 font-light">-</span><span class="tabular-nums font-extrabold text-base sm:text-lg">${ft[1]}</span>`;
            scoreClass = 'text-white';
        } else if (winner) {
            scoreTxt = `<span class="text-xs font-bold">${flagOf(winner)}<br>${esc(winner)}</span>`;
            scoreClass = 'text-emerald-400';
        } else if (live && m.live) {
            scoreTxt = `<span class="tabular-nums font-extrabold text-base sm:text-lg text-rose-200">${m.live.h}</span><span class="text-rose-400 mx-0.5 sm:mx-1">-</span><span class="tabular-nums font-extrabold text-base sm:text-lg text-rose-200">${m.live.a}</span>`;
            scoreClass = '';
        } else {
            scoreTxt = '<span class="text-slate-600 font-light">vs</span>';
            scoreClass = '';
        }

        // Pick cell
        let pickTxt = '<span class="text-slate-700">—</span>';
        if (m.group && pick.h != null) {
            pickTxt = `<span class="text-sky-300 font-semibold tabular-nums">${pick.h}-${pick.a}</span>`;
        } else if (!m.group && pick.w) {
            pickTxt = `<span class="text-sky-300 font-semibold text-xs">${flagOf(pick.w)} ${esc(pick.w)}</span>`;
        }

        // Points cell
        let ptsTxt = '';
        if (earned != null) {
            ptsTxt = earned > 0
                ? `<span class="text-emerald-400 font-bold">+${earned}</span>`
                : `<span class="text-slate-600">0</span>`;
        }

        // Status badge
        let badge = '';
        if (live) {
            badge = `<span class="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-950/60 border border-rose-700/50 rounded-full px-2 py-0.5 animate-pulse">🔴 LIVE${m.live ? ' · ' + esc(m.live.clock) : ''}</span>`;
        } else if (ft || winner) {
            badge = `<span class="text-[11px] sm:text-[14px] text-emerald-500/80">✔ Kết thúc</span>`;
        } else {
            const diff = m.kickoff.getTime() - Date.now();
            if (diff > 0 && diff < 7 * 86400000) {
                const days = Math.floor(diff / 86400000);
                const h = Math.floor((diff % 86400000) / 3600000);
                const min = Math.floor((diff % 3600000) / 60000);
                if (days > 0) {
                    badge = `<span class="text-[11px] sm:text-[14px] text-slate-400">${days}ng ${h}h nữa</span>`;
                } else if (h > 0) {
                    badge = `<span class="text-[11px] sm:text-[14px] text-amber-400">${h}h ${min}p nữa</span>`;
                } else {
                    badge = `<span class="text-[11px] sm:text-[14px] text-amber-400">${min}p nữa</span>`;
                }
            }
        }

        const kickStr = m.kickoff.toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' })
            + ' ' + m.kickoff.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' });

        const advBtn = (ft || winner) ? `<button class="adv-match-btn text-xs sm:text-sm text-indigo-400/70 hover:text-indigo-300 border border-indigo-800/40 rounded px-1.5 sm:px-2 py-0.5 transition-colors" data-key="${esc(m.key)}">🔍</button>` : '';

        // Advanced details panel — luôn có cho trận đã kết thúc
        const advPanel = (ft || winner) ? `
        <div class="match-adv-panel hidden px-4 pb-3 pt-1 bg-slate-900/40 border-t border-white/5 space-y-2" data-adv-content="${esc(m.key)}">
            ${matchGoalsBlock(md)}
            ${buildMatchAdvHtml(m)}
        </div>` : '';

        const hasAdv = !!(ft || winner);
        return `
        <div class="match-row border-b border-white/5 hover:bg-slate-800/40 transition-colors ${live ? 'bg-rose-950/10' : ''} ${hasAdv ? 'cursor-pointer' : ''}">
            <div class="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2.5">
                <!-- time + label -->
                <div class="w-16 sm:w-28 shrink-0 text-right">
                    <div class="text-[10px] sm:text-[16px] text-slate-400 font-mono leading-tight">${kickStr}</div>
                    <div class="text-[9px] sm:text-[13px] text-slate-600 truncate">${label}</div>
                </div>
                <!-- team 1 -->
                <div class="flex-1 text-right text-xs sm:text-sm font-semibold text-white truncate min-w-0">${teamHtml(m.team1, '', true)}</div>
                <!-- score -->
                <div class="w-14 sm:w-24 shrink-0 text-center ${scoreClass}">${scoreTxt}</div>
                <!-- team 2 -->
                <div class="flex-1 text-xs sm:text-sm font-semibold text-white truncate min-w-0">${teamHtml(m.team2, '', true)}</div>
                <!-- pick + pts + adv -->
                <div class="w-14 sm:w-28 shrink-0 text-right space-y-0.5">
                    <div class="text-[10px] sm:text-xs">${pickTxt} ${ptsTxt ? '· ' + ptsTxt : ''}</div>
                    <div class="flex items-center justify-end gap-0.5 sm:gap-1">${badge} ${advBtn}</div>
                </div>
            </div>
            ${advPanel}
        </div>`;
    }).join('');

    return `<div class="glass border border-white/10 rounded-xl overflow-hidden divide-y-0">${rows}</div>`;
}

// --- Event listeners ---

$('matchesTeamFilter').addEventListener('change', e => {
    matchesTeam = e.target.value;
    renderMatches();
});

$('matchesFilterClear').addEventListener('click', () => {
    matchesTeam = '';
    renderMatches();
});

$('matchesTabUpcoming').addEventListener('click', () => {
    matchesSubTab = 'upcoming';
    renderMatches();
});

$('matchesTabPast').addEventListener('click', () => {
    matchesSubTab = 'past';
    renderMatches();
});

// Refresh countdown badges every 5 minutes
setInterval(() => renderMatches(), 5 * 60 * 1000);

// Toggle advanced panel: click anywhere on finished match row (or 🔍 button)
document.addEventListener('click', e => {
    const row = e.target.closest('.match-row');
    if (!row) return;
    const panel = row.querySelector('.match-adv-panel');
    if (!panel) return;
    // Skip if clicking inside the panel itself (e.g. details/summary, buttons inside)
    if (e.target.closest('.match-adv-panel')) return;
    // Skip other interactive elements that aren't the adv button
    if (!e.target.closest('.adv-match-btn') && e.target.closest('button,a,select,input')) return;
    panel.classList.toggle('hidden');
    const btn = row.querySelector('.adv-match-btn');
    if (btn) btn.textContent = panel.classList.contains('hidden') ? '🔍' : '✖';
});
