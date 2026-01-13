import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// === استبدل هذا الجزء ببياناتك من Firebase ===
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "123",
    appId: "1:123:web:abc"
};

let app, auth, provider;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    provider = new GoogleAuthProvider();
} catch (e) { console.error("Firebase config missing"); }

// === المتغيرات العامة ===
let currentUser = null;
let isPreviewMode = false;
let userLocalData = {
    balance: 0,
    activePlans: [],
    history: [], // سجل العمليات
    id: '---'
};

// === عند التحميل ===
document.addEventListener('DOMContentLoaded', () => {
    runIntroAnimation();
    if(auth) {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                currentUser = user;
                loginSuccess(user);
            } else {
                if(!isPreviewMode) document.getElementById('authModal').style.display = 'flex';
            }
        });
    }
    
    // ربط الأزرار
    document.getElementById('googleLoginBtn').addEventListener('click', googleLogin);
    setInterval(updateTimersUI, 1000);
});

// === 1. دوال النظام الأساسية ===
window.startGuestMode = () => {
    isPreviewMode = true;
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('userName').innerText = 'زائر (معاينة)';
    document.getElementById('userId').innerText = 'GUEST-101';
    userLocalData.balance = 250000; // رصيد وهمي للمعاينة
    // إضافة بيانات وهمية للسجل
    userLocalData.history = [
        { type: 'withdraw', amount: 50000, date: '2025/01/10', status: 'done' },
        { type: 'withdraw', amount: 25000, date: '2025/01/05', status: 'done' }
    ];
    updateWalletUI();
    showMsg('🎉 أنت الآن في وضع المعاينة', 'success');
};

window.googleLogin = () => {
    signInWithPopup(auth, provider).catch(err => showMsg("خطأ: " + err.message));
};

function loginSuccess(user) {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('userName').innerText = user.displayName;
    userLocalData.id = user.uid.substring(0, 8).toUpperCase();
    document.getElementById('userId').innerText = userLocalData.id;
    
    const saved = localStorage.getItem(`keyInvest_${user.uid}`);
    if(saved) userLocalData = JSON.parse(saved);
    
    updateWalletUI();
    renderActiveTimers();
}

window.logout = () => {
    if(isPreviewMode) location.reload();
    else signOut(auth).then(() => location.reload());
};

window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    // تفعيل الأيقونة المناسبة
    const tabs = ['wallet', 'invest', 'my-timers', 'features', 'team', 'profile'];
    const idx = tabs.indexOf(tabId);
    if(idx >= 0) document.querySelectorAll('.nav-item')[idx].classList.add('active');
};

// === 2. نظام الرسائل المخصص (Popup System) ===
// دالة عرض رسالة عادية
window.showMsg = (msg, type = 'info') => {
    const modal = document.getElementById('customModalOverlay');
    const icon = document.getElementById('modalIcon');
    const title = document.getElementById('modalTitle');
    
    document.getElementById('modalMessage').innerText = msg;
    document.getElementById('modalInput').style.display = 'none';
    document.getElementById('btnCancel').style.display = 'none';
    
    if(type === 'success') { icon.innerText = '✅'; title.innerText = 'تم بنجاح'; }
    else if(type === 'error') { icon.innerText = '❌'; title.innerText = 'تنبيه'; }
    else { icon.innerText = '🔔'; title.innerText = 'إشعار'; }

    // إعداد زر الموافقة ليغلق النافذة فقط
    const btnConfirm = document.getElementById('btnConfirm');
    btnConfirm.onclick = () => { modal.style.display = 'none'; };
    
    modal.style.display = 'flex';
};

// دالة لطلب إدخال (بديلة لـ prompt) - تعود بـ Promise
window.showPrompt = (titleText, placeholder) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('customModalOverlay');
        document.getElementById('modalIcon').innerText = '✍️';
        document.getElementById('modalTitle').innerText = titleText;
        document.getElementById('modalMessage').innerText = '';
        
        const input = document.getElementById('modalInput');
        input.style.display = 'block';
        input.value = '';
        input.placeholder = placeholder;
        input.focus();

        const btnConfirm = document.getElementById('btnConfirm');
        const btnCancel = document.getElementById('btnCancel');
        btnCancel.style.display = 'inline-block';

        modal.style.display = 'flex';

        btnConfirm.onclick = () => {
            const val = input.value;
            if(!val) return;
            modal.style.display = 'none';
            resolve(val);
        };

        btnCancel.onclick = () => {
            modal.style.display = 'none';
            resolve(null);
        };
    });
};

// === 3. منطق السحب الجديد (المطلوب) ===
window.handleWithdraw = async () => {
    // 1. طلب المبلغ
    const amountStr = await showPrompt("سحب الرصيد", "أدخل المبلغ (IQD)");
    
    if (!amountStr) return; // تم الإلغاء
    
    const amount = parseInt(amountStr);

    // 2. التحقق من صحة الرقم
    if (isNaN(amount) || amount <= 0) {
        showMsg("يرجى إدخال مبلغ صحيح", "error");
        return;
    }

    // 3. التحقق من الرصيد
    if (amount > userLocalData.balance) {
        showMsg("❌ عذراً، رصيدك الحالي لا يكفي لإتمام العملية.", "error");
        return;
    }

    // 4. خصم الرصيد وإضافة للسجل
    userLocalData.balance -= amount;
    
    const newRecord = {
        type: 'withdraw',
        amount: amount,
        date: new Date().toLocaleDateString(),
        status: 'pending' // قيد الانتظار
    };
    
    // إضافة لأول القائمة
    userLocalData.history.unshift(newRecord);
    
    saveData();
    updateWalletUI();
    showMsg(`✅ تم إرسال طلب سحب بقيمة ${amount.toLocaleString()} IQD للمراجعة.`, "success");
};

window.handleDeposit = () => {
    window.location.href = 'https://t.me/am_an12';
};

// === 4. تحديث الواجهة ===
function updateWalletUI() {
    document.getElementById('totalBalance').innerText = userLocalData.balance.toLocaleString() + ' IQD';
    
    const list = document.getElementById('withdrawalHistory');
    list.innerHTML = '';

    if(userLocalData.history.length === 0) {
        list.innerHTML = '<li style="text-align:center; padding:10px; color:#aaa;">لا توجد عمليات</li>';
        return;
    }

    userLocalData.history.forEach(item => {
        let statusHtml = '';
        if(item.status === 'pending') {
            statusHtml = `<span class="history-status status-pending">قيد الانتظار <span class="loading-dots"></span></span>`;
        } else {
            statusHtml = `<span class="history-status status-done">تم التحويل</span>`;
        }

        list.innerHTML += `
            <li class="history-item">
                <div style="display:flex; flex-direction:column; align-items:flex-start;">
                    <span style="font-weight:bold; color: #ff5252;">${item.amount.toLocaleString()} IQD</span>
                    <span style="font-size:0.75rem; color:#ccc;">${item.date}</span>
                </div>
                ${statusHtml}
            </li>
        `;
    });
}

// === 5. بقية الوظائف (شراء، نسخ، الخ) ===
window.buyPlan = (type, price, profit) => {
    if(userLocalData.balance < price) return showMsg("رصيدك غير كافي للشراء", "error");
    
    userLocalData.balance -= price;
    userLocalData.activePlans.push({
        id: Date.now(),
        name: type === 'starter' ? 'الباقة الأساسية' : 'الباقة الذهبية',
        profit: profit,
        nextClaim: Date.now() + 86400000
    });
    saveData();
    updateWalletUI();
    renderActiveTimers();
    showMsg("تم تفعيل الباقة بنجاح! 🚀", "success");
    switchTab('my-timers');
};

function renderActiveTimers() {
    const box = document.getElementById('activeTimersList');
    box.innerHTML = '';
    userLocalData.activePlans.forEach((plan, idx) => {
        box.innerHTML += `
            <div class="timer-item">
                <div>${plan.name}<br><small>ربح: ${plan.profit}</small></div>
                <div id="t-${plan.id}" class="timer-count">--:--</div>
                <button id="b-${plan.id}" onclick="claim(${idx})" style="display:none;" class="btn-primary">استلام</button>
            </div>
        `;
    });
}

function updateTimersUI() {
    const now = Date.now();
    userLocalData.activePlans.forEach(p => {
        const diff = p.nextClaim - now;
        const tDiv = document.getElementById(`t-${p.id}`);
        const bDiv = document.getElementById(`b-${p.id}`);
        if(!tDiv) return;
        
        if(diff <= 0) {
            tDiv.style.display = 'none';
            bDiv.style.display = 'block';
        } else {
            tDiv.style.display = 'block';
            bDiv.style.display = 'none';
            let h = Math.floor(diff/3600000);
            let m = Math.floor((diff%3600000)/60000);
            let s = Math.floor((diff%60000)/1000);
            tDiv.innerText = `${h}:${m}:${s}`;
        }
    });
}

window.claim = (idx) => {
    const p = userLocalData.activePlans[idx];
    userLocalData.balance += p.profit;
    p.nextClaim = Date.now() + 86400000;
    saveData();
    updateWalletUI();
    showMsg(`تم استلام ${p.profit} IQD`, "success");
};

window.copyLink = () => {
    navigator.clipboard.writeText(`https://key.app?ref=${userLocalData.id}`);
    showMsg("تم نسخ الرابط");
};

window.openTelegram = () => location.href = 'https://t.me/keey10';

function saveData() {
    if(currentUser) localStorage.setItem(`keyInvest_${currentUser.uid}`, JSON.stringify(userLocalData));
}

function runIntroAnimation() {
    var textWrapper = document.querySelector('.ml11 .letters');
    textWrapper.innerHTML = textWrapper.textContent.replace(/([^\x00-\x80]|\w)/g, "<span class='letter'>$&</span>");
    anime.timeline({loop: false})
    .add({ targets: '.ml11 .line', scaleY: [0,1], opacity: [0.5,1], easing: "easeOutExpo", duration: 700 })
    .add({ targets: '.ml11 .line', translateX: [0, document.querySelector('.ml11 .letters').getBoundingClientRect().width + 10], easing: "easeOutExpo", duration: 700, delay: 100 })
    .add({ targets: '.ml11 .letter', opacity: [0,1], easing: "easeOutExpo", duration: 600, offset: '-=775', delay: (el, i) => 34 * (i+1) })
    .add({ targets: '#intro-overlay', opacity: 0, duration: 1000, delay: 1000, complete: function(anim) { document.getElementById('intro-overlay').style.display = 'none'; }});
}

// تصدير البيانات ليستخدمها الملف الآخر
window.userLocalData = userLocalData;
window.saveData = saveData;
window.updateWalletUI = updateWalletUI;
