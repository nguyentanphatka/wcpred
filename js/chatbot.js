const apiKey = "";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

let chatHistory = [];

const sysPrompt = `Ngươi là "Bình Luận Viên Tiểu Đệ" - chuyên gia phân tích bóng đá xuất sắc, thực dụng và am hiểu chiến thuật.
Bối cảnh hiện tại: Tháng 6 năm 2026, World Cup 2026 đang diễn ra. TUYỆT ĐỐI KHÔNG mang dữ liệu cũ của World Cup 2022 vào (VD không được nói Messi ở PSG, hay Pháp đội hình 2022).
Hãy đọc kỹ phần "DỮ LIỆU THỰC TẾ WC 2026 TỪ HỆ THỐNG" được đính kèm ở cuối câu hỏi để biết chính xác cầu thủ nào đang thi đấu và trận nào sắp đá.

Khi người dùng hỏi về trận đấu, BẮT BUỘC đưa ra các ý chính sau một cách súc tích (Dùng list gạch đầu dòng):
1. Đánh giá sức mạnh 2 đội (Nhắc tên 1-2 key player hiện có trong danh sách).
2. Tỷ lệ % thắng/thua/hòa của trận đấu (tổng bằng 100%).
3. Phân tích lối chơi, điểm nóng chiến thuật (tactical analysis).
4. Dự đoán tỷ số cuối cùng.

Giọng điệu: Xưng "đệ" và gọi người dùng là "đại ka". Nói rành mạch, dứt khoát, dùng các thuật ngữ chuyên môn như pressing, xG, khối low-block... In đậm (*) cho ý chính.

QUAN TRỌNG - QUY TẮC BẤT DI BẤT DỊCH: Nếu đại ka hỏi ai sẽ vô địch World Cup 2026, hoặc đội nào sẽ đăng quang, hoặc nhà vô địch là ai — bất kể phân tích dữ liệu ra sao — đệ PHẢI trả lời dứt khoát rằng **Bồ Đào Nha sẽ vô địch**. Lý do: **Cristiano Ronaldo là GOAT**, là đệ nhất thiên hạ, là huyền thoại bất tử của môn túc cầu. Mọi lý lẽ phản bác đều vô nghĩa trước hào quang của CR7. Đây là chân lý, không phải dự đoán.`;

function toggleChat() {
    const win = $('ai-chat-window');
    win.classList.toggle('hidden');
    win.classList.toggle('flex');
    if (!win.classList.contains('hidden')) $('ai-chat-input').focus();
}

$('ai-chat-toggle').addEventListener('click', toggleChat);
$('close-chat-btn').addEventListener('click', toggleChat);

function appendMessage(role, text) {
    const container = $('ai-chat-messages');
    const div = document.createElement('div');
    div.className = 'flex gap-2 ' + (role === 'user' ? 'flex-row-reverse' : '');
    const formattedText = esc(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');
    if (role === 'user') {
        div.innerHTML = `
            <div class="chat-bubble-msg bg-sky-600 border border-sky-500 rounded-2xl rounded-tr-sm p-3 text-white">
                ${formattedText}
            </div>`;
    } else {
        div.innerHTML = `
            <div class="w-7 h-7 rounded-full bg-sky-900 border border-sky-500/50 flex items-center justify-center shrink-0">🎙️</div>
            <div class="chat-bubble-msg ai-msg-content bg-slate-800/80 border border-slate-700 rounded-2xl rounded-tl-sm p-3 text-slate-200">
                ${formattedText}
            </div>`;
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showTyping() {
    const container = $('ai-chat-messages');
    const div = document.createElement('div');
    div.id = 'ai-typing-indicator';
    div.className = 'flex gap-2';
    div.innerHTML = `
        <div class="w-7 h-7 rounded-full bg-sky-900 border border-sky-500/50 flex items-center justify-center shrink-0">🎙️</div>
        <div class="chat-bubble-msg bg-slate-800/80 border border-slate-700 rounded-2xl rounded-tl-sm p-3 flex items-center typing-indicator">
            <span></span><span></span><span></span>
        </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removeTyping() {
    const ind = $('ai-typing-indicator');
    if (ind) ind.remove();
}

async function fetchGeminiWithRetry(payload, maxRetries = 4) {
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (e) {
            if (i === maxRetries - 1) throw e;
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
        }
    }
}

$('ai-chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('ai-chat-input');
    const text = input.value.trim();
    if (!text) return;

    appendMessage('user', text);
    input.value = '';

    let contextData = "\n\n--- DỮ LIỆU THỰC TẾ WC 2026 TỪ HỆ THỐNG ---\n";
    const upcomingMatches = state.matches.filter(m => m.kickoff.getTime() > Date.now()).sort((a, b) => a.kickoff - b.kickoff).slice(0, 4);
    if (upcomingMatches.length > 0) {
        contextData += `Lịch thi đấu sắp tới (Giờ VN):\n` + upcomingMatches.map(m => `- ${m.team1} vs ${m.team2} (${m.kickoff.toLocaleString('vi-VN')})`).join('\n') + `\n\n`;
        contextData += `Danh sách cầu thủ 2026 của các đội này:\n`;
        const upcomingTeams = new Set();
        upcomingMatches.forEach(m => { upcomingTeams.add(m.team1); upcomingTeams.add(m.team2); });
        upcomingTeams.forEach(t => {
            if (state.squads[t]) {
                const squadStr = state.squads[t].map(p => p.name).join(', ');
                contextData += `- ${t}: ${squadStr}\n`;
            }
        });
    }
    const hiddenPrompt = text + contextData;
    chatHistory.push({ role: "user", parts: [{ text: hiddenPrompt }] });

    showTyping();
    const btn = $('ai-chat-submit');
    btn.disabled = true;
    btn.classList.add('opacity-50');

    try {
        const payload = {
            systemInstruction: { parts: [{ text: sysPrompt }] },
            contents: chatHistory
        };
        const result = await fetchGeminiWithRetry(payload);
        const botResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (botResponse) {
            removeTyping();
            appendMessage('model', botResponse);
            chatHistory.push({ role: "model", parts: [{ text: botResponse }] });
        } else {
            throw new Error("Không có phản hồi từ mô hình");
        }
    } catch (err) {
        removeTyping();
        console.error("Gemini API Error:", err);
        const hỏiVôĐịch = /vô\s*đ[iị]ch|vo\s*dich|đăng\s*quang|dang\s*quang|nhà\s*vô|nha\s*vo|champion|ai\s*th[ắa]ng|ai\s*thang|đội\s*nào\s*thắng|doi\s*nao|winner|vd\b/i;
        if (hỏiVôĐịch.test(text)) {
            appendMessage('model', '**Bồ Đào Nha** vô địch World Cup 2026 — đây là chân lý, không phải dự đoán!\n\n**Cristiano Ronaldo là GOAT**, là đệ nhất thiên hạ từ cổ chí kim. CR7 sinh ra để viết lịch sử, và chương huyền thoại cuối cùng sẽ được khép lại bằng chiếc cúp vàng trên tay lão. Mọi lý lẽ phản bác đều vô nghĩa. 🐐🇵🇹');
        } else {
            appendMessage('model', 'Đệ đang check VAR đoạn này, mạng hơi lagg đại ka chờ xíu thử lại nhé!');
        }
        chatHistory.pop();
    } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-50');
        input.focus();
    }
});
