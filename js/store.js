const useFirebase = !!firebaseConfig.apiKey;
let store;

async function setupStore() {
    if (useFirebase) {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        const authMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        const fsMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        const app = initializeApp(firebaseConfig);
        const auth = authMod.getAuth(app);
        const db = fsMod.getFirestore(app);

        try {
            await authMod.setPersistence(auth, authMod.browserLocalPersistence);
        } catch (e) {
            console.warn('Cảnh báo Persistence (có thể do trình duyệt block):', e);
        }

        let bannedList = [];
        const safeRoomId = s => { let h = 5381; const str = String(s || ''); for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return 'r' + h.toString(36); };
        const authCreds = (username, roomId) => {
            const room = roomId && roomId !== 'default' ? roomId : '';
            return {
                email: `${username}@${room ? room + '.' : ''}banghoi.local`,
                pass: `Arena@${room ? room + '_' : ''}${username}2026!`
            };
        };
        const usernameOf = u => ((u?.email || '').split('@')[0]).toLowerCase();
        const isBannedName = (uname, roomName) => {
            const u = String(uname || '').trim().toLowerCase();
            if (!u) return false;
            const r = String(roomName || '').trim().toLowerCase();
            return bannedList.some(b => { const x = String(b).trim().toLowerCase(); return x === u || (r && x === `${r}:${u}`); });
        };
        async function fetchBanned() {
            try {
                const snap = await fsMod.getDoc(fsMod.doc(db, 'config-user', 'settings'));
                bannedList = (snap.exists() && snap.data().banned) || [];
            } catch (e) { console.warn('Không đọc được danh sách banned:', e); }
        }
        async function kickOut() {
            localStorage.removeItem('arena_username');
            await authMod.signOut(auth);
            alert('🚫 Tài khoản của bạn đã bị quản trị viên khóa.');
        }

        store = {
            init(onUser, onAllPreds) {
                let unsubPreds = null;

                fsMod.onSnapshot(fsMod.doc(db, 'config-user', 'settings'), snap => {
                    bannedList = (snap.exists() && snap.data().banned) || [];
                    if (auth.currentUser && isBannedName(usernameOf(auth.currentUser), state.roomName)) kickOut();
                });

                const startPredsListener = (roomId) => {
                    if (unsubPreds) unsubPreds();
                    unsubPreds = fsMod.onSnapshot(fsMod.collection(db, 'rooms', roomId, 'predictions'), snap => {
                        const all = {};
                        snap.forEach(d => { all[d.id] = d.data(); });
                        onAllPreds(all);
                    }, err => {
                        console.error('Firestore listen error:', err);
                        if (err.code === 'permission-denied') {
                            alert('⚠️ CẢNH BÁO TỪ TIỂU ĐỆ:\nĐại ca chưa mở Security Rules cho Database rồi! Vô tab Rules sửa lại ngay để app lưu được data.');
                        }
                    });
                };

                authMod.onAuthStateChanged(auth, async u => {
                    if (u) {
                        await fetchBanned();
                        const roomId = localStorage.getItem('wc26_roomId') || 'default';
                        const roomName = localStorage.getItem('wc26_roomName') || 'Dự đoán';
                        state.roomId = roomId;
                        state.roomName = roomName;
                        if (isBannedName(usernameOf(u), roomName)) { await kickOut(); return; }
                        const dName = u.displayName || (u.email ? u.email.split('@')[0] : 'User');
                        startPredsListener(roomId);
                        onUser({ uid: u.uid, name: dName, photo: u.photoURL || '' });
                    } else {
                        if (unsubPreds) { unsubPreds(); unsubPreds = null; }
                        const savedUser = localStorage.getItem('arena_username');
                        const savedRoom = localStorage.getItem('wc26_roomId') || 'default';
                        if (savedUser) {
                            try {
                                const { email: fakeEmail, pass: fakePass } = authCreds(savedUser, savedRoom);
                                await authMod.signInWithEmailAndPassword(auth, fakeEmail, fakePass);
                            } catch (e) {
                                console.warn("Auto-login ngầm thất bại:", e);
                                localStorage.removeItem('arena_username');
                                localStorage.removeItem('wc26_roomId');
                                localStorage.removeItem('wc26_roomName');
                                onUser(null);
                            }
                        } else {
                            onUser(null);
                        }
                    }
                });
            },
            async loginMaster(username, pass, name) {
                await fetchBanned();

                let roomId, roomName, cfg = null;
                try {
                    const snap = await fsMod.getDoc(fsMod.doc(db, 'config-user', 'settings'));
                    cfg = snap.exists() ? snap.data() : null;
                } catch (e) {
                    throw new Error("Không đọc được cấu hình phòng (kiểm tra Security Rules)!");
                }
                const rooms = (cfg && cfg.rooms && typeof cfg.rooms === 'object') ? cfg.rooms : null;
                if (rooms) {
                    const key = pass || 'default';
                    if (!Object.prototype.hasOwnProperty.call(rooms, key)) throw new Error("Sai Mật khẩu Bang Hội!");
                    roomId = safeRoomId(key);
                    roomName = rooms[key] || key;
                } else if (cfg && cfg.masterPassword) {
                    if (pass && pass !== cfg.masterPassword) throw new Error("Sai Mật khẩu Bang Hội!");
                    roomId = 'default';
                    roomName = 'Dự đoán';
                } else {
                    throw new Error("Hệ thống chưa cấu hình phòng (config-user/settings). Báo admin!");
                }

                if (isBannedName(username, roomName)) throw new Error("🚫 Tài khoản này đã bị quản trị viên khóa!");

                localStorage.setItem('wc26_roomId', roomId);
                localStorage.setItem('wc26_roomName', roomName);
                state.roomId = roomId;
                state.roomName = roomName;

                const { email: fakeEmail, pass: fakePass } = authCreds(username, roomId);

                try {
                    const cred = await authMod.signInWithEmailAndPassword(auth, fakeEmail, fakePass);
                    if (name && name !== cred.user.displayName) {
                        await authMod.updateProfile(cred.user, { displayName: name });
                        if (state.me) state.me.name = name;
                    }
                } catch (authErr) {
                    if (!name) {
                        throw new Error("Tài khoản mới (lần đầu): Bắt buộc phải nhập Tên hiển thị!");
                    }
                    const cred = await authMod.createUserWithEmailAndPassword(auth, fakeEmail, fakePass);
                    await authMod.updateProfile(cred.user, { displayName: name });
                    if (state.me) state.me.name = name;
                    document.getElementById('userName').textContent = name;
                }

                localStorage.setItem('arena_username', username);
            },
            async logout() {
                localStorage.clear();
                sessionStorage.clear();
                await authMod.signOut(auth);
            },
            async save(uid, data) {
                const roomId = state.roomId || 'default';
                await fsMod.setDoc(fsMod.doc(db, 'rooms', roomId, 'predictions', uid), data, { merge: true });
            }
        };
    } else {
        const LS_ALL = 'wc26_demo_predictions', LS_ME = 'wc26_demo_currentUser';
        let userCb = null, predsCb = null;
        const readAll = () => JSON.parse(localStorage.getItem(LS_ALL) || '{}');
        store = {
            init(onUser, onAllPreds) {
                userCb = onUser; predsCb = onAllPreds;
                const me = localStorage.getItem(LS_ME);
                onUser(me ? JSON.parse(me) : null);
                onAllPreds(readAll());
            },
            async loginMaster(username, pass, name) {
                if (!pass) throw new Error("Nhập mật khẩu (Demo không check đúng/sai nhưng phải nhập)!");
                const uid = 'demo_' + username.toLowerCase().replace(/\s+/g, '_');
                const all = readAll();
                let finalName = name;
                if (all[uid] && all[uid].name) {
                    finalName = all[uid].name;
                } else {
                    if (!name) throw new Error("Tài khoản mới (lần đầu): Bắt buộc phải nhập Tên hiển thị!");
                }
                const me = { uid, name: finalName, photo: '' };
                localStorage.setItem(LS_ME, JSON.stringify(me));
                userCb(me);
            },
            async logout() { localStorage.clear(); sessionStorage.clear(); userCb(null); },
            async save(uid, data) {
                const all = readAll();
                all[uid] = data;
                localStorage.setItem(LS_ALL, JSON.stringify(all));
                predsCb(all);
            }
        };
    }
}
