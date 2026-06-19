function renderUpcoming() {
    const box = $('upcomingContainer');
    if (!box) return;
    const prevOpenFeed = new Set([...box.querySelectorAll('details[data-lf][open]')].map(d => d.dataset.lf));
    const live = state.matches.filter(m => m.live);
    const next = state.matches
        .filter(m => m.kickoff.getTime() > Date.now())
        .sort((a, b) => a.kickoff - b.kickoff)
        .slice(0, 2);
    if (!live.length && !next.length) { box.innerHTML = ''; return; }

    let html = '';

    if (live.length) {
        html += `
        <div class="mb-5">
            <div class="flex items-center gap-2 mb-3">
                <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.9)]"></span>
                <span class="text-xs font-bold text-red-400 uppercase tracking-widest">Đang đá trực tiếp</span>
            </div>
            <div class="flex flex-col gap-4">
                ${live.map(m => {
                    const label = m.group ? esc(m.group) : (ROUND_VI[m.round] || esc(m.round));
                    const clockTxt = m.live.clock || m.live.detail || '';
                    const goalLine = gl => `<div class="truncate leading-tight"><span class="text-white">${esc(gl.name)}</span> <span class="text-amber-400 font-semibold">${esc(gl.min)}</span>${gl.pen ? '<span class="text-slate-500"> (pen)</span>' : ''}${gl.og ? '<span class="text-rose-400"> (OG)</span>' : ''}</div>`;
                    const goalsBlock = (m.goals && (m.goals.h.length || m.goals.a.length)) ? `
                    <div class="grid grid-cols-2 gap-x-4 mt-5 pt-4 border-t border-red-500/20 text-xs md:text-sm">
                        <div class="text-right space-y-1 pr-4 border-r border-red-500/20">
                            <div class="text-[10px] uppercase tracking-wider text-red-400/70 mb-1">⚽ Bàn thắng</div>
                            ${m.goals.h.length ? m.goals.h.map(goalLine).join('') : '<div class="text-slate-600">—</div>'}
                        </div>
                        <div class="text-left space-y-1">
                            <div class="text-[10px] uppercase tracking-wider text-red-400/70 mb-1">Bàn thắng ⚽</div>
                            ${m.goals.a.length ? m.goals.a.map(goalLine).join('') : '<div class="text-slate-600">—</div>'}
                        </div>
                    </div>` : '';

                    const fd = m.feed;
                    const luCol = arr => arr.length ? arr.map(p => `<div class="truncate leading-tight"><span class="inline-block w-5 text-slate-500 text-[10px]">${esc(p.num)}</span> ${esc(p.name)}${p.pos ? ` <span class="text-slate-600 text-[10px]">${esc(p.pos)}</span>` : ''}</div>`).join('') : '<div class="text-slate-600">—</div>';
                    const navBtn = team => isRealTeam(team) ? `<button class="squad-nav inline-flex items-center gap-1 mb-2 px-2 py-1 rounded-md bg-red-500/15 border border-red-500/30 text-red-200 hover:text-white hover:border-red-400/60 font-semibold transition-colors" data-team="${esc(team)}" title="Xem đội hình đầy đủ ${esc(team)}">📋 Chi tiết đội hình <span class="text-[10px]">→</span></button>` : '';
                    const lineupHtml = (fd && (fd.lineups.h.length || fd.lineups.a.length)) ? `
                    <details data-lf="${esc(m.key)}|lu" class="mt-4 pt-3 border-t border-red-500/20" ${prevOpenFeed.has(m.key + '|lu') ? 'open' : ''}>
                        <summary class="cursor-pointer text-xs font-bold text-red-300/90 hover:text-red-200 py-1">📋 Đội hình ra sân</summary>
                        <div class="grid grid-cols-2 gap-x-4 pt-2 text-[11px] md:text-xs">
                            <div class="text-right space-y-0.5 pr-4 border-r border-red-500/15">${navBtn(m.team1)}${luCol(fd.lineups.h)}</div>
                            <div class="text-left space-y-0.5">${navBtn(m.team2)}${luCol(fd.lineups.a)}</div>
                        </div>
                    </details>` : '';

                    const HILITE = [
                        [/BÀN THẮNG!?/g, 'text-emerald-300 font-extrabold text-sm md:text-base'],
                        [/thẻ vàng/g, 'text-amber-300 font-extrabold text-sm md:text-base'],
                        [/thẻ đỏ/g, 'text-rose-300 font-extrabold text-sm md:text-base'],
                        [/Thay người/g, 'text-sky-300 font-extrabold text-sm md:text-base'],
                        [/Phạt đền/g, 'text-orange-300 font-extrabold text-sm md:text-base'],
                        [/Phạt góc/g, 'text-cyan-300 font-bold'],
                        [/Việt vị/g, 'text-fuchsia-300 font-bold'],
                        [/chạm tay/g, 'text-orange-300 font-bold'],
                        [/\bVAR\b/g, 'text-indigo-300 font-bold'],
                        [/Phạm lỗi/g, 'text-slate-200 font-semibold']
                    ];
                    const hilite = txt => { let s = esc(viComment(txt)); for (const [re, cls] of HILITE) s = s.replace(re, mm => `<span class="${cls}">${mm}</span>`); return s; };
                    const comHtml = (fd && fd.commentary.length) ? `
                    <details data-lf="${esc(m.key)}|cm" class="mt-3 pt-3 border-t border-red-500/20" ${prevOpenFeed.has(m.key + '|cm') ? 'open' : ''}>
                        <summary class="cursor-pointer text-xs font-bold text-red-300/90 hover:text-red-200 py-1">📝 Diễn biến trận đấu</summary>
                        <div class="pt-2 space-y-1.5 max-h-80 overflow-y-auto pr-1">
                            ${fd.commentary.slice().reverse().slice(0, 60).map(c => `
                            <div class="flex gap-2 items-baseline text-[11px] md:text-xs">
                                <span class="w-9 shrink-0 text-amber-400/80 font-semibold">${esc(c.time)}</span>
                                <span class="flex-1 text-slate-300 leading-snug">${hilite(c.text)}</span>
                            </div>`).join('')}
                        </div>
                    </details>` : '';

                    const sm = m.summary;
                    const STAT_ROWS = [['possessionPct', 'Kiểm soát bóng', '%'], ['totalShots', 'Dứt điểm', ''], ['shotsOnTarget', 'Sút trúng đích', ''], ['wonCorners', 'Phạt góc', ''], ['foulsCommitted', 'Phạm lỗi', '']];
                    const statBar = (label, hv, av, unit) => {
                        const h = parseFloat(hv) || 0, a = parseFloat(av) || 0, tot = h + a, pct = tot ? Math.round(h / tot * 100) : 50;
                        return `
                        <div class="space-y-0.5">
                            <div class="flex justify-between items-center text-xs"><b class="text-sky-300 w-12">${esc(hv ?? 0)}${unit}</b><span class="text-slate-400">${label}</span><b class="text-rose-300 w-12 text-right">${esc(av ?? 0)}${unit}</b></div>
                            <div class="flex h-1.5 rounded-full overflow-hidden bg-slate-700/40"><div class="bg-sky-400" style="width:${pct}%"></div><div class="bg-rose-400" style="width:${100 - pct}%"></div></div>
                        </div>`;
                    };
                    const statsRows = sm ? STAT_ROWS.filter(([k]) => sm.statH[k] != null || sm.statA[k] != null).map(([k, l, u]) => statBar(l, sm.statH[k], sm.statA[k], u)).join('') : '';
                    const statsBlock = statsRows ? `
                    <details data-lf="${esc(m.key)}|st" class="mt-3 pt-3 border-t border-red-500/20" ${prevOpenFeed.has(m.key + '|st') ? 'open' : ''}>
                        <summary class="cursor-pointer text-xs font-bold text-red-300/90 hover:text-red-200 py-1">📊 Thống kê chi tiết trận đấu</summary>
                        <div class="pt-2 space-y-2">
                            <div class="flex justify-between text-[10px] uppercase tracking-wider text-slate-500 px-0.5"><span class="text-sky-400/80">${teamHtml(m.team1)}</span><span class="text-rose-400/80">${teamHtml(m.team2)}</span></div>
                            ${statsRows}
                        </div>
                    </details>` : '';
                    return `
                <div class="relative w-full rounded-2xl px-6 py-7 md:py-9 overflow-hidden transition-all duration-300
                    bg-gradient-to-br from-red-950/35 via-slate-900/95 to-slate-900
                    border border-red-500/45
                    shadow-[0_0_30px_rgba(239,68,68,0.2),0_0_8px_rgba(239,68,68,0.12)]
                    hover:border-red-400/70 hover:shadow-[0_0_44px_rgba(239,68,68,0.35),0_0_14px_rgba(239,68,68,0.2)]">
                    <div class="absolute -top-12 -right-12 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div class="absolute -bottom-12 -left-12 w-40 h-40 bg-orange-600/8 rounded-full blur-3xl pointer-events-none"></div>
                    <div class="flex items-center justify-between mb-5">
                        <span class="text-sm font-bold uppercase tracking-wider text-slate-400">🔥 ${label}</span>
                        <span class="flex items-center gap-1.5 text-sm font-bold text-red-300 bg-red-500/15 border border-red-500/30 rounded-full px-3 py-1.5">
                            <span class="w-2 h-2 bg-red-400 rounded-full animate-pulse shadow-[0_0_4px_rgba(239,68,68,0.8)]"></span>
                            LIVE${clockTxt ? ' · ' + esc(clockTxt) : ''}
                        </span>
                    </div>
                    <div class="flex items-center justify-center gap-4 md:gap-8">
                        <span class="flex-1 text-right text-base md:text-2xl font-bold text-white leading-tight">${teamHtml(m.team1)}</span>
                        <span class="flex items-center gap-2 px-5 py-3 rounded-2xl
                            bg-red-500/12 border border-red-500/35
                            shadow-[0_0_16px_rgba(239,68,68,0.22),inset_0_0_10px_rgba(239,68,68,0.06)]
                            text-4xl md:text-5xl font-extrabold tabular-nums tracking-tight">
                            <span class="text-red-100">${m.live.h}</span>
                            <span class="text-slate-600 font-light text-3xl mx-1">:</span>
                            <span class="text-red-100">${m.live.a}</span>
                        </span>
                        <span class="flex-1 text-base md:text-2xl font-bold text-white leading-tight">${teamHtml(m.team2)}</span>
                    </div>
                    ${goalsBlock}
                    <p class="text-center text-xs text-slate-500 mt-5">🕐 ${fmtKick(m)} · ${esc(m.ground || '')}</p>
                    ${lineupHtml}
                    ${comHtml}
                    ${statsBlock}
                </div>`;
                }).join('')}
            </div>
        </div>`;
    }

    if (next.length) {
        html += `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${next.map(m => {
                const label = m.group ? esc(m.group) : (ROUND_VI[m.round] || esc(m.round));
                const bothReal = isRealTeam(m.team1) && isRealTeam(m.team2);
                const locked = isLocked(m);
                return `
            <div class="glass border border-sky-500/25 rounded-2xl p-4 relative overflow-hidden transition-all duration-300 hover:border-sky-400/50 hover:shadow-xl hover:shadow-sky-950/40">
                <div class="absolute -top-10 -right-10 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-bold uppercase tracking-wider text-sky-400">⚡ Sắp diễn ra · ${label}</span>
                    <span class="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2.5 py-1">⏳ còn ${countdownTxt(m)}</span>
                </div>
                <div class="flex flex-wrap items-center justify-center gap-2 md:gap-3 text-sm md:text-lg font-bold text-white mb-1">
                    <span class="flex-1 text-right">${teamHtml(m.team1)}</span>
                    ${m.group && bothReal ? `
                        <span class="flex items-center gap-2">${stepperHtml(m, 'h', locked)}<span class="text-slate-600">:</span>${stepperHtml(m, 'a', locked)}</span>
                    ` : '<span class="text-slate-500 text-sm font-extrabold px-2">VS</span>'}
                    <span class="flex-1">${teamHtml(m.team2)}</span>
                </div>
                <p class="text-center text-xs text-slate-500">🕐 ${fmtKick(m)} <span class="text-slate-600">(giờ máy bạn)</span> · ${esc(m.ground || '')}</p>
                <p class="text-center text-xs mt-1">${predictWindowHtml(m)}</p>
            </div>`;
            }).join('')}
        </div>`;
    }

    box.innerHTML = html;
}

// Đếm ngược trận sắp đá: nhịp mỗi phút
setInterval(() => { if (state.me && !interacting()) renderUpcoming(); }, 60000);

// Tự cập nhật tỉ số trận đang đá
const LIVE_POLL_MS = 30000;
const hasLiveMatch = () => state.matches.some(m => !ftScore(m)
    && Date.now() >= m.kickoff.getTime() - 3600000
    && Date.now() <= m.kickoff.getTime() + 150 * 60000);
setInterval(async () => {
    if (!state.me || interacting() || !hasLiveMatch()) return;
    await loadLiveScores();
    await loadLiveFeeds();
    renderUpcoming(); renderGroups(); renderBracket(); renderMatches();
    renderLeaderboard(); renderStats(); renderHeaderPoints();
}, LIVE_POLL_MS);
