// ===================== GIÁ TRỊ CHUYỂN NHƯỢNG =====================
let MV = { values: {}, updated: '', source: '' };
try {
    const raw = typeof VALUES_DATA !== 'undefined' ? VALUES_DATA : {};
    MV = { ...raw, values: Object.fromEntries(Object.entries(raw.values || {}).map(([k, v]) => [mvNorm(k), v])) };
} catch (e) { console.warn('Không đọc được VALUES_DATA:', e); }
const playerMV = name => MV.values[mvNorm(name)];
const fmtMV = v => v >= 1 ? `€${v}M` : `€${Math.round(v * 1000)}K`;

// ===================== HỒ SƠ CẦU THỦ =====================
let PDB = {}, PDBNames = {};
try {
    const raw = typeof PLAYERDB_DATA !== 'undefined' ? PLAYERDB_DATA : {};
    for (const [k, v] of Object.entries(raw.players || {})) {
        const [n, d] = k.split('|');
        PDB[mvNorm(n) + '|' + (d || '')] = v;
        PDBNames[mvNorm(n)] = v;
    }
} catch (e) { console.warn('Không đọc được PLAYERDB_DATA:', e); }
const playerInfo = p => PDB[mvNorm(p.name) + '|' + (p.date_of_birth || '')] || PDBNames[mvNorm(p.name)];

// ===================== RENDER: GROUPS — HELPERS =====================
function fmtKick(m) {
    const d = m.kickoff;
    const day = d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    return `${day} · <b class="text-sky-300">${time}</b>`;
}
function countdownTxt(m) {
    const s = Math.max(0, (m.kickoff.getTime() - Date.now()) / 1000);
    const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), mi = Math.floor(s % 3600 / 60);
    return d ? `${d} ngày ${h}g` : h ? `${h}g ${mi}p` : `${mi} phút`;
}
function liveMinuteTxt(m) {
    const mins = Math.floor((Date.now() - m.kickoff.getTime()) / 60000);
    if (mins < 0) return `🔒 Phong ấn · Lăn bóng sau ${-mins}p`;
    if (mins > 150) return `🔴 Chờ cập nhật KQ`;
    return `🔴 Đang diễn ra (Khoảng phút ${mins})`;
}
function predictWindowHtml(m) {
    const left = (m.kickoff.getTime() - 3600000 - Date.now()) / 1000;
    if (left <= 0) return '<span class="text-amber-500 font-semibold">🔒 Đã phong ấn</span>';
    const d = Math.floor(left / 86400), h = Math.floor(left % 86400 / 3600), mi = Math.floor(left % 3600 / 60);
    const txt = d ? `${d} ngày ${h}g` : h ? `${h}g ${mi}p` : `${mi} phút`;
    return `<span class="text-emerald-400">⏳ Còn <b>${txt}</b> để thử đoán</span>`;
}
function stepperHtml(m, side, locked) {
    const pick = state.myPred.picks[m.key] || {};
    const val = pick[side];
    return `
    <div class="flex items-center rounded-full overflow-hidden ${locked ? 'bg-slate-900/40 border border-slate-800' : 'bg-slate-900/80 border border-sky-700/40 shadow-inner shadow-sky-950/50'}">
        <button class="step-btn" data-key="${esc(m.key)}" data-side="${side}" data-d="-1" ${locked ? 'disabled' : ''}>−</button>
        <span class="w-8 text-center text-base font-extrabold ${val == null ? 'text-slate-600' : 'text-white'}" data-sv="${esc(m.key)}|${side}">${val ?? '·'}</span>
        <button class="step-btn" data-key="${esc(m.key)}" data-side="${side}" data-d="1" ${locked ? 'disabled' : ''}>+</button>
    </div>`;
}
function teamHtml(name, extra = '', clickable = false) {
    if (!isRealTeam(name)) return `<span class="text-slate-500 italic text-xs">🏷 ${esc(name)}</span>`;
    if (clickable) {
        return `<span class="team-link cursor-pointer underline decoration-dotted decoration-sky-500/50 underline-offset-4 hover:text-sky-300 transition-colors ${extra}" data-team="${esc(name)}" title="Xem đội hình ${esc(name)}">${flagOf(name)} ${esc(name)}</span>`;
    }
    return `<span class="${extra}">${flagOf(name)} ${esc(name)}</span>`;
}

function computeStandings(groupName) {
    const rows = {};
    for (const m of state.matches) {
        if (m.group !== groupName) continue;
        for (const t of [m.team1, m.team2]) rows[t] ??= { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
        const ft = ftScore(m);
        if (!ft) continue;
        const [g1, g2] = ft;
        const r1 = rows[m.team1], r2 = rows[m.team2];
        r1.p++; r2.p++; r1.gf += g1; r1.ga += g2; r2.gf += g2; r2.ga += g1;
        if (g1 > g2) { r1.w++; r1.pts += 3; r2.l++; }
        else if (g1 < g2) { r2.w++; r2.pts += 3; r1.l++; }
        else { r1.d++; r2.d++; r1.pts++; r2.pts++; }
    }
    return Object.values(rows).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
}

function pickCountsFor(m) {
    const counts = {};
    let total = 0;
    for (const pred of Object.values(state.allPreds)) {
        const pick = pred.picks?.[m.key];
        if (!pick) continue;
        let label;
        if (m.group) {
            if (pick.h == null) continue;
            label = pick.h > pick.a ? m.team1 : pick.h < pick.a ? m.team2 : 'Hòa';
        } else {
            if (!pick.w) continue;
            label = pick.w;
        }
        counts[label] = (counts[label] || 0) + 1;
        total++;
    }
    return { counts, total };
}

function renderGroups() {
    const container = $('groupsContainer');
    const groups = [...new Set(state.matches.filter(m => m.group).map(m => m.group))];
    const prevOpen = [...container.querySelectorAll('details[data-g][open]')].map(d => d.dataset.g);
    const openSet = new Set(prevOpen.length ? prevOpen : ['Group A']);
    const prevOpenMd = new Set([...container.querySelectorAll('details[data-md][open]')].map(d => d.dataset.md));
    container.innerHTML = groups.map(g => {
        const matches = state.matches.filter(m => m.group === g);
        const standings = computeStandings(g);
        const standingsHtml = `
            <table class="w-full text-sm md:text-base mb-3">
                <thead class="text-xs text-slate-500 uppercase tracking-wider"><tr>
                    <th class="text-left py-1.5">Đội</th><th>Tr</th><th>T</th><th>H</th><th>B</th><th>HS</th><th class="text-amber-400">Đ</th>
                </tr></thead>
                <tbody>${standings.map((r, i) => `
                    <tr class="border-t border-slate-800 transition-colors hover:bg-slate-800/50 ${i < 2 ? 'text-sky-300' : 'text-slate-400'}">
                        <td class="py-2 font-semibold">${teamHtml(r.team, '', true)}</td>
                        <td class="text-center">${r.p}</td><td class="text-center">${r.w}</td><td class="text-center">${r.d}</td><td class="text-center">${r.l}</td>
                        <td class="text-center">${r.gf - r.ga >= 0 ? '+' : ''}${r.gf - r.ga}</td>
                        <td class="text-center font-extrabold text-base md:text-lg">${r.pts}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;

        const matchesHtml = matches.map(m => {
            const pick = state.myPred.picks[m.key] || {};
            const locked = isLocked(m);
            const ft = ftScore(m);
            const live = locked && !ft;
            const earned = matchEarned(state.myPred, m);
            const hasPick = pick.h != null && pick.a != null;
            const { counts, total } = pickCountsFor(m);
            const crowd = total ? `<span class="text-xs text-slate-500">${Object.entries(counts).map(([k, v]) => `${isRealTeam(k) ? flagOf(k) : k} ${Math.round(v / total * 100)}%`).join(' · ')}</span>` : '';

            const statusHtml = ft
                ? '<span class="text-emerald-400 font-semibold">✅ Đã kết thúc</span>'
                : live
                    ? `<span class="text-rose-400 font-semibold animate-pulse">${m.live ? `🔴 LIVE ${esc(m.live.clock)}` : liveMinuteTxt(m)}</span>`
                    : '<span class="text-slate-600">Chưa đá</span>';

            const centerHtml = !locked ? `
                <div class="flex items-center gap-1.5 md:gap-2 shrink-0">
                    ${stepperHtml(m, 'h', false)}
                    <span class="text-slate-600 font-bold">:</span>
                    ${stepperHtml(m, 'a', false)}
                </div>`
                : `
                <div class="shrink-0 text-center px-2 md:px-3">
                    ${ft
                        ? `<div class="text-2xl md:text-3xl font-extrabold text-white leading-none tracking-widest">${ft[0]} - ${ft[1]}</div>
                           <div class="text-[10px] uppercase tracking-widest text-emerald-400/80 mt-1.5 font-bold">KQ Cuối cùng</div>`
                        : `<div class="text-2xl md:text-3xl font-black text-rose-100 bg-rose-900/40 border border-rose-500/50 rounded-md px-3 py-1 shadow-[0_0_12px_rgba(225,29,72,0.35)] animate-pulse leading-none tracking-widest">${m.live ? `${m.live.h} - ${m.live.a}` : '? - ?'}</div>
                           ${m.live ? `<div class="text-[10px] tracking-wider text-rose-400/80 mt-1.5 font-bold whitespace-nowrap">🔴 ${esc(m.live.clock)} · Tỉ số trực tiếp</div>` : ''}`}
                </div>`;

            const myPickHtml = locked ? `
                <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs">
                    <span class="flex items-center gap-2">
                        <span class="px-2.5 py-1 rounded-full border ${hasPick ? 'bg-sky-500/10 border-sky-500/40 text-sky-300' : 'bg-white/5 border-white/10 text-slate-500'}">
                            🎯 Bạn dự đoán: <b>${hasPick ? `${pick.h} - ${pick.a}` : 'Không dự đoán'}</b>
                        </span>
                        ${earned != null ? `<span class="font-bold ${earned > 0 ? 'text-emerald-400' : 'text-slate-500'}">+${earned}đ</span>` : ''}
                    </span>
                    ${crowd}
                </div>` : '';

            const goalLines = arr => arr.map(gl =>
                `<div class="truncate leading-tight"><span class="text-white">${esc(gl.name)}</span> <span class="text-amber-400 font-semibold">${esc(gl.min)}</span>${gl.pen ? '<span class="text-slate-500"> (pen)</span>' : ''}${gl.og ? '<span class="text-rose-400"> (OG)</span>' : ''}</div>`
            ).join('');
            const goalsHtml = (!ft && m.goals && (m.goals.h.length || m.goals.a.length)) ? `
                <div class="grid grid-cols-2 gap-x-3 text-[11px] border-t border-white/5 pt-2">
                    <div class="text-right space-y-0.5 pr-3 border-r border-white/5">
                        <div class="text-[9px] uppercase tracking-wider text-slate-600 mb-0.5">⚽ Bàn thắng</div>
                        ${m.goals.h.length ? goalLines(m.goals.h) : '<div class="text-slate-600">—</div>'}
                    </div>
                    <div class="text-left space-y-0.5">
                        <div class="text-[9px] uppercase tracking-wider text-slate-600 mb-0.5">Bàn thắng ⚽</div>
                        ${m.goals.a.length ? goalLines(m.goals.a) : '<div class="text-slate-600">—</div>'}
                    </div>
                </div>` : '';

            const STAT_ROWS = [['possessionPct', 'Kiểm soát bóng', '%'], ['totalShots', 'Dứt điểm', ''], ['shotsOnTarget', 'Sút trúng đích', ''], ['wonCorners', 'Phạt góc', ''], ['foulsCommitted', 'Phạm lỗi', '']];
            const statBar = (label, hv, av, unit) => {
                const h = parseFloat(hv) || 0, a = parseFloat(av) || 0, tot = h + a, pct = tot ? Math.round(h / tot * 100) : 50;
                return `
                <div class="space-y-0.5">
                    <div class="flex justify-between items-center text-[11px]"><b class="text-sky-300 w-10">${esc(hv ?? 0)}${unit}</b><span class="text-slate-500">${label}</span><b class="text-rose-300 w-10 text-right">${esc(av ?? 0)}${unit}</b></div>
                    <div class="flex h-1.5 rounded-full overflow-hidden bg-slate-700/40"><div class="bg-sky-400" style="width:${pct}%"></div><div class="bg-rose-400" style="width:${100 - pct}%"></div></div>
                </div>`;
            };
            const evIcon = ev => ev.kind === 'goal' ? (ev.og ? '⚽<sup class="text-rose-400">OG</sup>' : ev.pen ? '⚽<sup>P</sup>' : '⚽') : ev.kind === 'yellow' ? '🟨' : '🟥';

            // Chi tiết LIVE (trong lúc đang đá)
            const sm = m.summary;
            const liveStatsHtml = sm ? STAT_ROWS.filter(([k]) => sm.statH[k] != null || sm.statA[k] != null).map(([k, l, u]) => statBar(l, sm.statH[k], sm.statA[k], u)).join('') : '';
            const liveTimelineHtml = (sm && sm.events.length) ? sm.events.map(ev => `
                <div class="flex items-center gap-2 text-[11px] ${ev.side === 'h' ? '' : 'flex-row-reverse'}">
                    <span class="w-9 shrink-0 text-amber-400 font-semibold ${ev.side === 'h' ? 'text-left' : 'text-right'}">${esc(ev.min)}</span>
                    <span class="shrink-0">${evIcon(ev)}</span>
                    <span class="flex-1 min-w-0 truncate text-white ${ev.side === 'h' ? 'text-left' : 'text-right'}">${esc(ev.name)}</span>
                </div>`).join('') : '';
            const detailHtml = (sm && (liveStatsHtml || liveTimelineHtml)) ? `
                <details data-md="${esc(m.key)}" class="border-t border-white/5 pt-1" ${prevOpenMd.has(m.key) ? 'open' : ''}>
                    <summary class="cursor-pointer text-sm font-semibold text-sky-300/80 hover:text-sky-300 py-1">📊 Chi tiết trận đấu</summary>
                    <div class="pt-2 space-y-3">
                        ${sm.venue ? `<p class="text-[11px] text-slate-500 text-center">🏟️ ${esc(sm.venue)}</p>` : ''}
                        ${liveStatsHtml ? `<div class="space-y-1.5">${liveStatsHtml}</div>` : ''}
                        ${liveTimelineHtml ? `<div class="space-y-1 border-t border-white/5 pt-2">${liveTimelineHtml}</div>` : ''}
                    </div>
                </details>` : '';

            // Nâng cao — luôn hiện cho trận đã KẾT THÚC
            const advancedHtml = ft ? `
                <details data-adv="${esc(m.key)}" class="border-t border-white/5 pt-1">
                    <summary class="cursor-pointer text-sm font-semibold text-indigo-300/70 hover:text-indigo-300 py-1">🔍 Nâng cao</summary>
                    <div class="pt-2" data-adv-content="${esc(m.key)}">${buildMatchAdvHtml(m)}</div>
                </details>` : '';

            return `
            <div class="bg-slate-900/50 border border-slate-800 rounded-lg p-3 space-y-2 transition-all duration-300 hover:border-sky-700/50 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-sky-950/30 hover:-translate-y-0.5 ${live ? 'border-rose-800/50' : ''}">
                <div class="flex items-center justify-between gap-2 text-xs">
                    <span class="text-slate-500">${fmtKick(m)}</span>
                    <span class="text-right">${statusHtml}</span>
                </div>
                <div class="flex items-center gap-2 md:gap-3">
                    <div class="flex-1 min-w-0 text-right text-sm md:text-base font-medium truncate">${teamHtml(m.team1)}</div>
                    ${centerHtml}
                    <div class="flex-1 min-w-0 text-sm md:text-base font-medium truncate">${teamHtml(m.team2)}</div>
                </div>
                ${goalsHtml}
                ${detailHtml}
                ${advancedHtml}
                ${myPickHtml}
                ${!locked && crowd ? `<div>${crowd}</div>` : ''}
            </div>`;
        }).join('');

        return `
        <details data-g="${esc(g)}" class="group glass border border-white/10 rounded-xl overflow-hidden transition-all duration-300 hover:border-sky-500/40 open:border-sky-700/50 open:shadow-xl open:shadow-sky-950/30" ${openSet.has(g) ? 'open' : ''}>
            <summary class="cursor-pointer px-4 md:px-5 py-3.5 font-bold text-white hover:bg-slate-800 transition-colors flex items-center justify-between">
                <span>🏟️ ${esc(g)} <span class="text-xs font-normal text-slate-500 ml-2">${standings.map(r => flagOf(r.team)).join(' ')}</span></span>
            </summary>
            <div class="px-3 md:px-5 pb-4 pt-1">
                ${standingsHtml}
                <div class="space-y-2">${matchesHtml}</div>
            </div>
        </details>`;
    }).join('');
}

// Stepper delegation: 1 listener cho mọi trận (groups + upcoming panel)
document.addEventListener('click', e => {
    const btn = e.target.closest('.step-btn');
    if (!btn || btn.disabled) return;

    if (!state.me) {
        openLoginModal('Đăng nhập để đoán mò!');
        return;
    }

    const key = btn.dataset.key, side = btn.dataset.side, d = +btn.dataset.d;
    const cur = state.myPred.picks[key] || {};

    const paintSide = (sd, val) => {
        document.querySelectorAll(`[data-sv="${CSS.escape(key)}|${sd}"]`).forEach(el => {
            el.textContent = val ?? '·';
            el.classList.toggle('text-slate-600', val == null);
            el.classList.toggle('text-white', val != null);
            el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
        });
    };

    if (cur.h == null && cur.a == null) {
        state.lastInteract = Date.now();
        if (!setPick(key, { h: 0, a: 0 })) { renderGroups(); renderUpcoming(); return; }
        paintSide('h', 0); paintSide('a', 0);
        renderHeaderPoints();
        return;
    }

    let v = cur[side];
    v = v == null ? 0 : Math.min(20, Math.max(0, v + d));
    if (v === cur[side]) return;
    state.lastInteract = Date.now();
    if (!setPick(key, { ...cur, [side]: v })) {
        renderGroups(); renderUpcoming();
        return;
    }
    paintSide(side, v);
    renderHeaderPoints();
});
