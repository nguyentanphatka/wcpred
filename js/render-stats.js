function renderStats() {
    const preds = Object.values(state.allPreds);
    const totalUsers = preds.length;
    const totalPicks = preds.reduce((s, p) => s + Object.keys(p.picks || {}).length, 0);
    const playedMatches = state.matches.filter(m => ftScore(m) || realWinner(m)).length;

    $('statsSummaryCards').innerHTML = [
        { icon: '👥', label: 'Người tham gia', val: totalUsers, color: 'sky' },
        { icon: '🎯', label: 'Tổng lượt phán quyết', val: totalPicks, color: 'indigo' },
        { icon: '✅', label: 'Trận đã có kết quả', val: `${playedMatches}/104`, color: 'amber' }
    ].map(c => `
        <div class="glass border border-sky-500/20 neon-card rounded-xl p-5 text-center transition-all duration-300 hover:-translate-y-1 hover:border-sky-400/50">
            <div class="text-3xl mb-1">${c.icon}</div>
            <div class="text-3xl font-extrabold text-${c.color}-400">${c.val}</div>
            <div class="text-xs text-slate-500 uppercase tracking-wider mt-1">${c.label}</div>
        </div>`).join('');

    const champCounts = {};
    preds.forEach(p => { if (p.champion) champCounts[p.champion] = (champCounts[p.champion] || 0) + 1; });
    const champTotal = Object.values(champCounts).reduce((a, b) => a + b, 0);
    $('championStats').innerHTML = champTotal ? Object.entries(champCounts).sort((a, b) => b[1] - a[1]).map(([team, n]) => `
        <div class="flex items-center gap-3">
            <span class="w-40 text-sm text-white truncate">${flagOf(team)} ${esc(team)}</span>
            <div class="flex-1 bg-slate-900/80 border border-white/5 rounded-full h-5 overflow-hidden">
                <div class="bg-gradient-to-r from-sky-600 to-cyan-400 h-full rounded-full flex items-center justify-end pr-2 text-xs font-bold text-slate-900 shadow-[0_0_10px_rgba(56,189,248,0.5)]" style="width:${Math.max(8, n / champTotal * 100)}%">${n}</div>
            </div>
            <span class="text-xs text-slate-500 w-10">${Math.round(n / champTotal * 100)}%</span>
        </div>`).join('')
        : '<p class="text-sm text-slate-500">Chưa ai chọn nhà vô địch.</p>';

    const sel = $('statsMatchSelect');
    const prev = sel.value;
    sel.innerHTML = state.matches.map(m => {
        const label = m.group
            ? `${m.group}: ${m.team1} vs ${m.team2} (${m.date.slice(5).replace('-', '/')})`
            : `${ROUND_VI[m.round] || m.round} #${m.num}: ${m.team1} vs ${m.team2}`;
        return `<option value="${esc(m.key)}">${esc(label)}</option>`;
    }).join('');
    if (prev && state.matches.some(m => m.key === prev)) sel.value = prev;
    renderStatsDetail();
}

function renderStatsDetail() {
    const key = $('statsMatchSelect').value;
    const m = state.matches.find(x => x.key === key);
    if (!m) { $('statsMatchDetail').innerHTML = ''; return; }
    const locked = isLocked(m);
    const ft = ftScore(m);

    const rows = Object.entries(state.allPreds).map(([uid, pred]) => {
        const pick = pred.picks?.[key];
        let pickTxt = '<span class="text-slate-600">—</span>';
        if (pick) {
            if (m.group && pick.h != null) pickTxt = `<b class="text-white">${pick.h} - ${pick.a}</b>`;
            else if (pick.w) pickTxt = `<b class="text-white">${flagOf(pick.w)} ${esc(pick.w)}</b>`;
        }
        const earned = locked ? matchEarned(pred, m) : null;
        return { name: pred.name || uid, me: uid === state.me?.uid, pickTxt, earned };
    }).sort((a, b) => (b.earned ?? -1) - (a.earned ?? -1));

    const totalPlayers = Object.keys(state.allPreds).length;
    const { counts, total: predicted } = pickCountsFor(m);
    const notPredicted = totalPlayers - predicted;
    const distOrder = m.group ? [m.team1, 'Hòa', m.team2] : [m.team1, m.team2];
    const distHtml = distOrder.map(label => {
        const n = counts[label] || 0;
        const pct = predicted ? Math.round(n / predicted * 100) : 0;
        const isDraw = label === 'Hòa';
        return `
        <div class="flex items-center gap-2">
            <span class="w-36 md:w-48 text-xs text-white truncate">${isDraw ? '🤝 Hòa' : `${flagOf(label)} ${esc(label)} ${m.group ? 'thắng' : 'đi tiếp'}`}</span>
            <div class="flex-1 bg-slate-900/80 border border-white/5 rounded-full h-4 overflow-hidden">
                <div class="${isDraw ? 'bg-slate-500/80' : 'bg-gradient-to-r from-sky-600 to-cyan-400'} h-full rounded-full transition-all duration-500" style="width:${pct}%"></div>
            </div>
            <span class="text-xs text-slate-400 w-24 text-right shrink-0"><b class="text-white">${n}</b> người · ${pct}%</span>
        </div>`;
    }).join('');

    const summaryHtml = `
    <div class="grid grid-cols-3 gap-2 mb-3 text-center">
        <div class="bg-slate-900/60 border border-white/10 rounded-lg p-2.5">
            <div class="text-xl font-extrabold text-white">${totalPlayers}</div>
            <div class="text-[11px] text-slate-500 uppercase tracking-wider">👥 Dân đoán mò</div>
        </div>
        <div class="bg-sky-950/40 border border-sky-700/40 rounded-lg p-2.5">
            <div class="text-xl font-extrabold text-sky-400">${predicted}</div>
            <div class="text-[11px] text-slate-500 uppercase tracking-wider">🎯 Đã phán</div>
        </div>
        <div class="bg-slate-900/60 border border-white/10 rounded-lg p-2.5">
            <div class="text-xl font-extrabold text-slate-400">${notPredicted}</div>
            <div class="text-[11px] text-slate-500 uppercase tracking-wider">😴 Chưa phán</div>
        </div>
    </div>
    <div class="bg-slate-900/40 border border-white/10 rounded-lg p-3 mb-3 space-y-2">
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">📊 Tổng hợp lựa chọn</p>
        ${predicted ? distHtml : '<p class="text-xs text-slate-500">Chưa có anh hùng nào ra tay luận đoán trận này.</p>'}
    </div>`;

    $('statsMatchDetail').innerHTML = `
        <div class="glass border border-sky-500/25 neon-card rounded-lg p-4 mb-3 flex items-center justify-center gap-4 text-lg">
            ${teamHtml(m.team1, 'font-bold text-white')}
            <span class="text-2xl font-extrabold ${ft ? 'text-sky-400' : 'text-slate-600'}">${ft ? `${ft[0]} - ${ft[1]}` : 'vs'}</span>
            ${teamHtml(m.team2, 'font-bold text-white')}
        </div>
        ${summaryHtml}
        <table class="w-full text-sm">
            <thead class="text-xs text-slate-500 uppercase"><tr>
                <th class="text-left py-2">Người đoán mò</th><th class="text-center">Dự đoán</th><th class="text-right">Điểm</th>
            </tr></thead>
            <tbody>${rows.map(r => `
                <tr class="border-t border-slate-800 ${r.me ? 'bg-sky-950/30' : ''}">
                    <td class="py-2.5 text-white">${esc(r.name)} ${r.me ? '<span class="text-xs bg-sky-800/60 text-sky-300 px-1.5 py-0.5 rounded">BẠN</span>' : ''}</td>
                    <td class="text-center">${r.pickTxt}</td>
                    <td class="text-right font-bold ${r.earned > 0 ? 'text-sky-400' : 'text-slate-500'}">${r.earned != null ? '+' + r.earned : '—'}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
}

$('statsMatchSelect').addEventListener('change', renderStatsDetail);
