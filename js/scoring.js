function groupPoints(pick, m) {
    const ft = ftScore(m);
    if (!ft || pick == null || pick.h == null || pick.a == null) return null;
    const [h, a] = ft;
    if (pick.h === h && pick.a === a) return 3;
    if (Math.sign(pick.h - pick.a) === Math.sign(h - a)) return 1;
    return 0;
}
function koPoints(pick, m) {
    const w = realWinner(m);
    if (!w || !pick?.w) return null;
    return pick.w === w ? KO_POINT : 0;
}
function matchEarned(pred, m) {
    const pick = pred?.picks?.[m.key];
    return m.group ? groupPoints(pick, m) : koPoints(pick, m);
}
function userTotals(pred) {
    let group = 0, ko = 0;
    for (const m of state.matches) {
        const p = matchEarned(pred, m);
        if (p == null) continue;
        if (m.group) group += p; else ko += p;
    }
    let bonus = 0;
    const finalMatch = state.matches.find(m => m.round === 'Final');
    if (finalMatch && pred?.champion && realWinner(finalMatch) === pred.champion) bonus = CHAMPION_BONUS;
    return { group, ko, bonus, total: group + ko + bonus };
}
