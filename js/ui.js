function renderHeaderPoints() {
    if (!state.me) return;
    const t = userTotals({ ...state.myPred, name: state.me.name });
    $('userPoints').textContent = `${t.total} điểm`;
}

function renderAll() {
    renderUpcoming();
    renderSquads();
    renderGroups();
    renderBracket();
    renderMatches();
    renderLeaderboard();
    renderStats();
    renderHeaderPoints();
}

function openLoginModal(hint = '') {
    const hintEl = $('loginModalHint');
    hintEl.textContent = hint;
    hintEl.classList.toggle('hidden', !hint);
    $('loginError').classList.add('hidden');
    $('loginModal').classList.remove('hidden');
    $('loginModal').classList.add('flex');
    setTimeout(() => $('inpUsername').focus(), 50);
}

function closeLoginModal() {
    $('loginModal').classList.add('hidden');
    $('loginModal').classList.remove('flex');
}

function showAnon() {
    closeLoginModal();
    $('appSection').classList.remove('hidden');
    $('anonBanner').classList.remove('hidden');
    $('loginBtn').classList.remove('hidden');
    $('userBox').classList.add('hidden');
    renderAll();
}

function showApp() {
    closeLoginModal();
    $('appSection').classList.remove('hidden');
    $('anonBanner').classList.add('hidden');
    $('loginBtn').classList.add('hidden');
    $('userBox').classList.remove('hidden');
    $('userName').textContent = state.me.name;
    const rn = state.roomName || 'Dự đoán';
    $('roomLabel').textContent = rn;
    document.title = `${rn} · World Cup 2026`;
    if (state.me.photo) { $('userAvatar').src = state.me.photo; $('userAvatar').classList.remove('hidden'); }
    else $('userAvatar').classList.add('hidden');
    renderAll();
}

function loginError(msg) {
    const el = $('loginError');
    el.textContent = msg;
    el.classList.remove('hidden');
    if ($('loginModal').classList.contains('hidden')) openLoginModal();
}

if (!useFirebase) {
    $('demoBanner').classList.remove('hidden');
}

$('masterLoginBtn').addEventListener('click', async () => {
    const btn = $('masterLoginBtn');
    const txt = $('masterLoginText');
    const loader = $('masterLoginLoader');
    const username = $('inpUsername').value.trim().toLowerCase();
    const pass = $('inpPassword').value.trim();
    const name = $('inpDisplayName').value.trim();

    if (!username) return loginError("Nhập Tên đăng nhập!");
    if (username.includes(" ")) return loginError("Tên đăng nhập không được có dấu cách!");

    $('loginError').classList.add('hidden');
    btn.disabled = true;
    txt.classList.add('hidden');
    loader.classList.remove('hidden');

    localStorage.removeItem('wc26_roomId');
    localStorage.removeItem('wc26_roomName');

    try {
        await store.loginMaster(username, pass, name);
    } catch (e) {
        loginError(e.message);
    } finally {
        btn.disabled = false;
        txt.classList.remove('hidden');
        loader.classList.add('hidden');
    }
});

$('inpPassword').addEventListener('keydown', e => { if (e.key === 'Enter') $('masterLoginBtn').click(); });
$('inpDisplayName').addEventListener('keydown', e => { if (e.key === 'Enter') $('masterLoginBtn').click(); });

$('loginBtn').addEventListener('click', () => openLoginModal());
$('closeLoginModal').addEventListener('click', closeLoginModal);
$('loginModal').addEventListener('click', e => { if (e.target === $('loginModal')) closeLoginModal(); });

$('logoutBtn').addEventListener('click', () => store.logout());
$('refreshBtn').addEventListener('click', async () => {
    await Promise.all([loadMatches(), loadSquads()]);
    await loadLiveScores();
    await loadLiveFeeds();
    renderAll();
});

function activateTab(target) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        const on = b.dataset.target === target;
        b.classList.toggle('active', on);
        b.classList.toggle('text-sky-400', on);
        b.classList.toggle('border-sky-400', on);
        b.classList.toggle('text-slate-400', !on);
        b.classList.toggle('border-transparent', !on);
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    $(target).classList.add('active');
}
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        activateTab(btn.dataset.target);
        if (btn.dataset.target === 'tab-matches') renderMatches();
    });
});
