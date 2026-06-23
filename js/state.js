const state = {
    matches: [],
    teams: [],
    me: null,
    myPred: { picks: {}, champion: '' },
    allPreds: {},
    raceChart: null,
    saveTimer: null,
    lastInteract: 0,
    squads: {},
    squadTeam: '',
    roomId: 'default',
    roomName: '',
    matchDetails: {},
    playerRatings: {}
};
const interacting = () => Date.now() - state.lastInteract < 2500;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// Normalize: bỏ dấu, chữ thường, chuẩn hóa khoảng trắng — dùng chung cho ESPN alias + transfer value lookup
const mvNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

function isRealTeam(name) { return state.teams.includes(name); }
function matchKey(m) { return m.num ? 'm' + m.num : `g:${m.group}:${m.team1}|${m.team2}`; }
function parseKickoff(m) {
    const t = /(\d{1,2}):(\d{2}) UTC([+-]\d+)/.exec(m.time || '');
    if (!t) return new Date(m.date + 'T12:00:00Z');
    const off = t[3].replace(/([+-])(\d)$/, '$10$2') + ':00';
    return new Date(`${m.date}T${t[1].padStart(2,'0')}:${t[2]}:00${off}`);
}
function isLocked(m) { return Date.now() >= m.kickoff.getTime() - 3600000; }

function realWinner(m) {
    const s = m.score || {};
    const final = s.p || s.et || s.ft;
    if (!final) return null;
    if (final[0] === final[1]) return null;
    return final[0] > final[1] ? m.team1 : m.team2;
}
function ftScore(m) { return m.score?.ft || null; }
