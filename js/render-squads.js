function ageOf(dob) {
    if (!dob) return '?';
    const d = new Date(dob), t = new Date();
    let a = t.getFullYear() - d.getFullYear();
    if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
    return a;
}

const POS_VI = { GK: '🧤 Thủ môn', DF: '🛡️ Hậu vệ', MF: '⚙️ Tiền vệ', FW: '⚡ Tiền đạo' };

function showPlayerModal(p, team) {
    const info = playerInfo(p) || {};
    const mv = playerMV(p.name);
    const dobTxt = p.date_of_birth
        ? `${new Date(p.date_of_birth).toLocaleDateString('vi-VN')} (${ageOf(p.date_of_birth)} tuổi)` : '—';
    const rows = [
        ['🧩 Vị trí', POS_VI[p.pos] || p.pos || '—'],
        ['🎂 Ngày sinh', dobTxt],
        ['📏 Chiều cao', info.h ? `${info.h} cm` : '—'],
        ['⚖️ Cân nặng', info.w ? `${info.w} kg` : '—'],
        ['🏟️ CLB', info.club ? esc(info.club) : '—'],
        ['💰 Giá trị', mv != null ? fmtMV(mv) : '—']
    ];
    $('playerModalBody').innerHTML = `
    <div class="bg-gradient-to-b from-sky-900/50 via-sky-950/20 to-transparent px-5 pt-6 pb-4 flex flex-col items-center text-center">
        ${info.img
            ? `<img src="${esc(info.img)}" alt="" loading="lazy" class="w-32 h-32 object-cover object-top rounded-full border-2 border-sky-400/60 shadow-[0_0_24px_rgba(56,189,248,0.45)] mb-3 bg-slate-800"
                 onerror="this.outerHTML='<div class=\\'w-32 h-32 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-5xl mb-3\\'>⚽</div>'">`
            : '<div class="w-32 h-32 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-5xl mb-3">⚽</div>'}
        <h3 class="text-xl font-extrabold text-white leading-tight">
            <span class="text-sky-400">#${p.number ?? '–'}</span> ${esc(p.name)}
        </h3>
        <p class="text-sm text-slate-400 mt-1">${flagOf(team)} ${esc(team)}</p>
    </div>
    <div class="grid grid-cols-2 gap-2 px-4 pb-4 text-sm">
        ${rows.map(([k, v]) => `
        <div class="bg-slate-900/60 border border-white/5 rounded-lg px-3 py-2">
            <div class="text-[10px] uppercase tracking-wider text-slate-500">${k}</div>
            <div class="font-bold text-white mt-0.5">${v}</div>
        </div>`).join('')}
    </div>
    ${info.img ? '<p class="text-[10px] text-slate-600 text-center pb-3">Ảnh & số liệu: Wikidata / Wikimedia Commons</p>' : '<p class="text-[10px] text-slate-600 text-center pb-3">Số liệu: Wikidata (chưa có ảnh public)</p>'}`;
    $('playerModal').classList.remove('hidden');
}

function renderSquads() {
    const chips = $('squadChips'), detail = $('squadDetail');
    if (!chips) return;
    const teams = Object.keys(state.squads).sort();
    if (!teams.length) {
        chips.innerHTML = '';
        detail.innerHTML = '<p class="text-sm text-slate-500 py-6 text-center">Chưa tải được dữ liệu đội hình. Bấm "⟳ Cập nhật KQ" để thử lại.</p>';
        return;
    }
    chips.innerHTML = teams.map(t => `
        <button class="squad-chip flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200
            ${t === state.squadTeam ? 'bg-sky-500/20 border border-sky-400/70 text-white shadow-[0_0_10px_rgba(56,189,248,0.35)]' : 'bg-white/[0.04] border border-white/10 text-slate-300 hover:border-sky-400/50 hover:text-white'}"
            data-team="${esc(t)}">${flagOf(t)} ${esc(t)}</button>`).join('');

    const team = state.squadTeam;
    const players = state.squads[team];
    if (!team || !players) {
        detail.innerHTML = '<p class="text-sm text-slate-500 py-6 text-center">👆 Chọn một đội để xem danh sách cầu thủ</p>';
        return;
    }
    const grp = state.matches.find(m => m.group && (m.team1 === team || m.team2 === team))?.group || '';
    const byPos = { GK: [], DF: [], MF: [], FW: [] };
    players.forEach(p => (byPos[p.pos] || (byPos[p.pos] = [])).push(p));
    const mvTotal = players.reduce((s, p) => s + (playerMV(p.name) || 0), 0);
    const mvKnown = players.filter(p => playerMV(p.name) != null).length;

    detail.innerHTML = `
    <div class="glass border border-sky-500/25 neon-card rounded-xl p-4 md:p-5 mb-4 flex flex-wrap items-center gap-3">
        <span class="text-2xl">${flagOf(team)}</span>
        <div class="flex-1">
            <h3 class="text-xl md:text-2xl font-extrabold text-white">${esc(team)}</h3>
            <p class="text-xs text-slate-500">${esc(grp)} · ${players.length} cầu thủ đăng ký · Tuổi TB: <b class="text-sky-300">${(players.reduce((s, p) => s + ageOf(p.date_of_birth), 0) / players.length).toFixed(1)}</b>${mvKnown ? ` · 💰 Giá trị đội hình: <b class="text-amber-400">€${Math.round(mvTotal)}M</b> <span class="text-slate-600">(${mvKnown}/${players.length} cầu thủ có data)</span>` : ''}</p>
        </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        ${Object.entries(byPos).filter(([, list]) => list.length).map(([pos, list]) => `
        <div class="glass border border-white/10 neon-card rounded-xl overflow-hidden">
            <div class="px-4 py-2.5 bg-sky-500/[0.08] border-b border-white/10 text-sm font-bold neon-text">${POS_VI[pos] || pos} <span class="text-slate-500 font-normal">(${list.length})</span></div>
            <div class="divide-y divide-white/5">
                ${list.sort((a, b) => (a.number || 99) - (b.number || 99)).map(p => {
                    const mv = playerMV(p.name);
                    return `
                <div class="player-row px-4 py-2 flex items-center gap-3 hover:bg-sky-500/[0.06] transition-colors cursor-pointer" data-pn="${esc(p.name)}" title="Xem hồ sơ ${esc(p.name)}">
                    <span class="w-7 h-7 shrink-0 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-extrabold flex items-center justify-center">${p.number ?? '–'}</span>
                    <span class="flex-1 min-w-0 text-sm font-medium text-white truncate">${esc(p.name)}</span>
                    <span class="text-xs text-slate-500 shrink-0">${ageOf(p.date_of_birth)} tuổi</span>
                    <span class="text-xs font-bold w-14 text-right shrink-0 ${mv != null ? 'text-amber-400' : 'text-slate-700'}">${mv != null ? fmtMV(mv) : '—'}</span>
                </div>`;}).join('')}
            </div>
        </div>`).join('')}
    </div>`;
}

function showSquad(team) {
    state.squadTeam = team;
    activateTab('tab-squads');
    renderSquads();
    $('squadDetail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Team chip / team link → mở tab Đội hình
document.addEventListener('click', e => {
    const el = e.target.closest('.team-link, .squad-chip, .squad-nav');
    if (!el) return;
    showSquad(el.dataset.team);
});

// Dòng cầu thủ → mở popup hồ sơ
document.addEventListener('click', e => {
    const row = e.target.closest('.player-row');
    if (!row) return;
    const p = (state.squads[state.squadTeam] || []).find(x => x.name === row.dataset.pn);
    if (p) showPlayerModal(p, state.squadTeam);
});

$('playerModalClose').addEventListener('click', () => $('playerModal').classList.add('hidden'));
$('playerModal').addEventListener('click', e => { if (e.target === $('playerModal')) $('playerModal').classList.add('hidden'); });
