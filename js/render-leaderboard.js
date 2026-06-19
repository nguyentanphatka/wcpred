function leaderboardRows() {
    return Object.entries(state.allPreds)
        .map(([uid, pred]) => ({ uid, name: pred.name || uid, photo: pred.photo, ...userTotals(pred), champion: pred.champion }))
        .sort((a, b) => b.total - a.total);
}

function renderLeaderboard() {
    const rows = leaderboardRows();
    $('leaderboardBody').innerHTML = rows.length ? rows.map((r, i) => `
        <tr class="border-t border-white/5 transition-colors duration-200 ${i === 0 ? 'bg-gradient-to-r from-amber-500/10 via-transparent to-transparent' : ''} ${r.uid === state.me?.uid ? 'bg-sky-500/10' : ''} hover:bg-sky-500/[0.06]">
            <td class="px-2 md:px-4 py-3 font-bold ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-500'}">${['🥇','🥈','🥉'][i] || i + 1}</td>
            <td class="px-2 md:px-4 py-3">
                <span class="font-semibold text-white">${esc(r.name)}</span>
                ${r.champion ? `<span class="text-xs text-slate-500 ml-2 hidden md:inline">👑 ${flagOf(r.champion)} ${esc(r.champion)}</span>` : ''}
                ${r.uid === state.me?.uid ? '<span class="text-xs bg-sky-800/60 text-sky-300 px-1.5 py-0.5 rounded ml-2">BẠN</span>' : ''}
            </td>
            <td class="px-4 py-3 text-center text-slate-300 hidden sm:table-cell">${r.group}</td>
            <td class="px-4 py-3 text-center text-slate-300 hidden sm:table-cell">${r.ko}</td>
            <td class="px-4 py-3 text-center hidden sm:table-cell ${r.bonus ? 'text-amber-400 font-bold' : 'text-slate-600'}">${r.bonus || '-'}</td>
            <td class="px-2 md:px-4 py-3 text-right text-lg font-extrabold neon-text">${r.total}</td>
        </tr>`).join('')
        : '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">Chưa có anh hùng nào lên tiếng. Hãy là người tiên phong ra tay!</td></tr>';

    renderRaceChart(rows);
}

function renderRaceChart(rows) {
    const dates = [...new Set(state.matches.filter(m => ftScore(m) || realWinner(m)).map(m => m.date))].sort();
    const top = rows.slice(0, 8);
    const palette = ['#38bdf8', '#fbbf24', '#fb7185', '#818cf8', '#22d3ee', '#a3e635', '#f472b6', '#94a3b8'];
    const datasets = top.map((r, i) => {
        const pred = state.allPreds[r.uid];
        let cum = 0;
        const data = dates.map(d => {
            for (const m of state.matches) {
                if (m.date !== d) continue;
                const p = matchEarned(pred, m);
                if (p != null) cum += p;
            }
            return cum;
        });
        return { label: r.name, data, borderColor: palette[i], backgroundColor: palette[i], tension: 0.3, pointRadius: 2 };
    });

    if (state.raceChart) state.raceChart.destroy();
    state.raceChart = new Chart($('raceChart').getContext('2d'), {
        type: 'line',
        data: { labels: dates.map(d => d.slice(5).replace('-', '/')), datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#cbd5e1' } } },
            scales: {
                y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(51,65,85,0.4)' } },
                x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(51,65,85,0.2)' } }
            }
        }
    });
}
