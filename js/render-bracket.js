function bracketMatchCard(m) {
    const pick = state.myPred.picks[m.key] || {};
    const locked = isLocked(m);
    const bothReal = isRealTeam(m.team1) && isRealTeam(m.team2);
    const winner = realWinner(m);
    const earned = matchEarned(state.myPred, m);
    const { counts, total } = pickCountsFor(m);

    const sideRow = (team) => {
        const real = isRealTeam(team);
        const isPicked = pick.w === team;
        const isWinner = winner === team;
        const pct = total && counts[team] ? Math.round(counts[team] / total * 100) : 0;
        return `
        <button class="bracket-pick w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded text-left text-sm transition-all duration-200
            ${isWinner ? 'bg-cyan-500/15 border border-cyan-300/70 shadow-[0_0_12px_rgba(34,211,238,0.4)]' : isPicked ? 'bg-sky-500/15 border border-sky-400/70 shadow-[0_0_10px_rgba(56,189,248,0.4)]' : 'bg-white/[0.04] border border-white/10'}
            ${(!real || locked) ? 'cursor-default' : 'hover:border-sky-400/80 hover:bg-sky-500/10 hover:scale-[1.03] hover:shadow-[0_0_10px_rgba(56,189,248,0.3)] active:scale-95 cursor-pointer'}"
            data-key="${esc(m.key)}" data-team="${esc(team)}" ${(!real || locked) ? 'disabled' : ''}>
            <span class="truncate min-w-0 ${real ? 'text-white font-medium' : 'text-slate-500 italic text-xs'}">${real ? flagOf(team) + ' ' + esc(team) : '🏷 ' + esc(team)}</span>
            <span class="flex items-center gap-1.5 shrink-0">
                ${total && real ? `<span class="text-xs text-slate-500">${pct}%</span>` : ''}
                ${isPicked ? '<span class="neon-text">✔</span>' : ''}
                ${isWinner ? '<span>🏆</span>' : ''}
            </span>
        </button>`;
    };

    const s = m.score || {};
    const scoreTxt = s.ft ? `${s.ft[0]}-${s.ft[1]}${s.et ? ` (hp ${s.et[0]}-${s.et[1]})` : ''}${s.p ? ` (pen ${s.p[0]}-${s.p[1]})` : ''}` : '';
    const ROUND_GLOW = {
        'Round of 32': 'glow-r32', 'Round of 16': 'glow-r16', 'Quarter-final': 'glow-qf',
        'Semi-final': 'glow-sf', 'Match for third place': 'glow-qf', 'Final': 'glow-final'
    };
    return `
    <div class="bracket-match glass border ${ROUND_GLOW[m.round] || 'glow-r32'} rounded-lg p-2 space-y-1.5 transition-all duration-300">
        <div class="flex justify-between text-xs text-slate-500 px-0.5">
            <span>#${m.num} · ${m.kickoff.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} ${m.kickoff.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
            <span>${scoreTxt ? `<b class="text-white">${scoreTxt}</b>` : (locked ? `<span class="text-rose-400 animate-pulse">${m.live ? `🔴 ${m.live.h}-${m.live.a} · ${esc(m.live.clock)}` : liveMinuteTxt(m)}</span>` : bothReal ? 'Chọn đội đi tiếp' : 'Chờ xác định đội')}
            ${earned != null ? ` <b class="${earned > 0 ? 'text-sky-400' : 'text-slate-500'}">+${earned}đ</b>` : ''}</span>
        </div>
        ${sideRow(m.team1)}
        ${sideRow(m.team2)}
    </div>`;
}

function renderBracket() {
    const byNum = {};
    state.matches.forEach(m => { if (m.num) byNum[m.num] = m; });

    $('bracketContainer').innerHTML = BRACKET_COLS.map(col => `
        <div class="bracket-col">${col.map(num => byNum[num] ? bracketMatchCard(byNum[num]) : '').join('')}</div>
    `).join('');

    const third = byNum[103];
    $('thirdPlaceContainer').innerHTML = third ? `
        <h4 class="text-sm font-bold text-slate-400 mb-2">🥉 Tranh hạng 3 (+2đ)</h4>
        ${bracketMatchCard(third)}` : '';

    document.querySelectorAll('.bracket-pick:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => {
            state.lastInteract = Date.now();
            setPick(btn.dataset.key, { w: btn.dataset.team });
            const sc = document.querySelector('.bracket-scroll');
            const x = sc ? sc.scrollLeft : 0;
            renderBracket();
            if (sc) sc.scrollLeft = x;
            renderHeaderPoints();
        });
    });

    // Champion select
    const sel = $('championSelect');
    const championLocked = Date.now() >= KO_START.getTime() || !!state.myPred.champion;
    sel.innerHTML = '<option value="">— Chưa chọn —</option>' + state.teams.map(t =>
        `<option value="${esc(t)}" ${state.myPred.champion === t ? 'selected' : ''}>${esc(t)}</option>`).join('');
    sel.disabled = championLocked;
    sel.classList.toggle('champ-select-attention', !championLocked);
    $('championLockNote').textContent = championLocked ? '🔒 Đã chốt, không thể thay đổi' : 'Chọn 1 LẦN DUY NHẤT trước vòng knockout (28/6/2026)';
}

// Champion select listeners
$('championSelect').addEventListener('change', e => {
    const selected = e.target.value;
    if (!selected) return;

    if (!state.me) {
        openLoginModal('Đăng nhập để phong ấn Thiên Hạ Vô Địch!');
        e.target.value = '';
        return;
    }

    $('confirmTeamName').textContent = selected;
    $('championConfirmModal').classList.remove('hidden');
    $('confirmChampionBtn').dataset.team = selected;
});

$('cancelChampionBtn').addEventListener('click', () => {
    $('championSelect').value = state.myPred.champion || "";
    $('championConfirmModal').classList.add('hidden');
});

$('confirmChampionBtn').addEventListener('click', () => {
    const team = $('confirmChampionBtn').dataset.team;
    state.myPred.champion = team;
    scheduleSave();
    $('championSelect').disabled = true;
    $('championSelect').classList.remove('champ-select-attention');
    $('championSelect').value = team;
    $('championLockNote').textContent = '🔒 Đã chốt, không thể thay đổi';
    $('championConfirmModal').classList.add('hidden');
});
