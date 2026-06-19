function scheduleSave() {
    if (!state.me) return;
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(async () => {
        if (!state.me) return;
        try {
            $('statusSpinner').classList.remove('hidden');
            $('statusText').textContent = 'Đang đồng bộ dữ liệu lên máy chủ...';

            await store.save(state.me.uid, {
                name: state.me.name,
                photo: state.me.photo || '',
                champion: state.myPred.champion || '',
                picks: state.myPred.picks,
                updatedAt: new Date().toISOString()
            });

            $('statusSpinner').classList.add('hidden');
            $('statusText').textContent = '✅ Đã ghi danh phán quyết thành công!';
        } catch (e) {
            console.error('Save failed:', e);
            $('statusSpinner').classList.add('hidden');
            $('statusText').textContent = '❌ Lỗi lưu dữ liệu: ' + e.message;
            if (e.code === 'permission-denied') {
                alert('⚠️ ĐẠI CA QUÊN MỞ LUẬT BẢO MẬT (SECURITY RULES) TRÊN FIRESTORE RỒI!\n\nVào Firebase Console -> Firestore Database -> tab Rules và dán code đệ đã gửi để lưu được data nhé.');
            }
        }
    }, 800);
}

function setPick(key, pick) {
    const m = state.matches.find(x => x.key === key);
    if (!m || isLocked(m)) {
        $('statusText').textContent = '🔒 Trận này đã phong ấn! (trước giờ bóng lăn 1 tiếng)';
        return false;
    }
    state.myPred.picks[key] = pick;
    scheduleSave();
    return true;
}
