// === استيراد مكتبات فايربيس ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js";
import { getFirestore, doc, setDoc, onSnapshot, serverTimestamp, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
// تمت إضافة GoogleAuthProvider و signInWithPopup هنا
import { getAuth, signInAnonymously, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

// === إعدادات فايربيس ===
const firebaseConfig = {
    apiKey: "AIzaSyAFzCkQI0jedUl8W9xO1Bwzdg2Rhnxsh-s",
    authDomain: "kj1i-c1d4d.firebaseapp.com",
    projectId: "kj1i-c1d4d",
    storageBucket: "kj1i-c1d4d.firebasestorage.app",
    messagingSenderId: "674856242986",
    appId: "1:674856242986:web:77642057ca6ec2036c5853",
    measurementId: "G-J9QPH9Z1K1"
};

// تهيئة فايربيس
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

// === إعدادات الباقات (محلية للتجربة) ===
const PLAN_SETTINGS = {
    plan1: { total: 20, sold: 10 },
    plan2: { total: 20, sold: 18 }
};

let userData = {
    name: 'زائر',
    balance: 0,
    plans: [],
    history: []
};

// === دوال الحماية والجلسة الواحدة ===
function getDeviceId() {
    let id = localStorage.getItem("deviceId");
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem("deviceId", id);
    }
    return id;
}

function newSessionId() {
    return crypto.randomUUID();
}

async function activateSingleSession(user) {
    const deviceId = getDeviceId();
    const sessionId = newSessionId();
    localStorage.setItem("sessionId", sessionId);

    const userRef = doc(db, "users", user.uid);
    
    // نستخدم اسم جوجل إذا كان متوفراً
    const displayName = user.displayName || userData.name || "مستخدم";

    // حفظ بيانات الجلسة في فايربيس
    await setDoc(userRef, {
        activeDeviceId: deviceId,
        activeSessionId: sessionId,
        lastLoginAt: serverTimestamp(),
        name: displayName,
        email: user.email || "anonymous" // حفظ الايميل اذا وجد
    }, { merge: true });

    // مراقبة: إذا دخل من جهاز ثاني -> طرد
    onSnapshot(userRef, (snap) => {
        const data = snap.data();
        const mySessionId = localStorage.getItem("sessionId");
        if (data?.activeSessionId && mySessionId && data.activeSessionId !== mySessionId) {
            signOut(auth); 
            localStorage.removeItem("sessionId");
            alert("⚠️ تم تسجيل الدخول من جهاز آخر، تم تسجيل خروجك.");
            location.reload();
        }
        // تحديث البيانات المحلية من القاعدة إذا تغيرت
        if(data && data.balance) userData.balance = data.balance;
        updateUI();
    });
}

// === عند التحميل ===
document.addEventListener('DOMContentLoaded', () => {
    // مراقبة حالة تسجيل الدخول
    onAuthStateChanged(auth, (user) => {
        const modal = document.getElementById('loginModal');
        if (user) {
            modal.style.display = 'none';
            
            // تحديث الاسم من جوجل اذا وجد
            if(user.displayName) {
                userData.name = user.displayName;
            }
            
            document.getElementById('headerName').innerText = userData.name;
            document.getElementById('userId').innerText = user.uid.substring(0, 6);
            document.getElementById('myInviteCode').innerText = user.uid.substring(0, 6);
            document.getElementById('inviteUrlDisplay').innerText = `basmali12.github.io/ref/${user.uid.substring(0,6)}`;
            
            // تفعيل نظام الجلسة الواحدة
            activateSingleSession(user);
        } else {
            modal.style.display = 'flex';
        }
    });

    updateUI();
    updateStockDisplay();
    startLiveTimer();
    renderHistory();
    
    if(localStorage.getItem('installSkipped') === 'true') {
        document.getElementById('installBanner').style.display = 'none';
    }
});

// === الدوال المرفقة بـ window ===

window.closeInstallBanner = function() {
    document.getElementById('installBanner').style.display = 'none';
    localStorage.setItem('installSkipped', 'true');
}

window.loginGuest = function() {
    userData.name = "زائر";
    signInAnonymously(auth).catch((error) => {
        alert("خطأ في الدخول: " + error.message);
    });
}

// === دالة تسجيل الدخول بجوجل (المعدلة) ===
window.loginGoogle = function() {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
    .then((result) => {
        // تم الدخول بنجاح، onAuthStateChanged سيتكفل بالباقي
        console.log("Logged in with Google:", result.user.displayName);
    }).catch((error) => {
        // التعامل مع الأخطاء
        const errorMessage = error.message;
        alert("خطأ في تسجيل الدخول: " + errorMessage);
        console.error(error);
    });
}

window.logout = function() {
    if(confirm('خروج؟')) {
        signOut(auth).then(() => {
            location.reload();
        });
    }
}

// === بقية دوال الواجهة (UI) ===

window.showMsg = function(title, msg, icon) {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    document.querySelector('.alert-icon').innerText = icon || '⚠️';
    const overlay = document.getElementById('customAlert');
    const box = document.querySelector('.custom-alert-box');
    overlay.style.display = 'flex';
    setTimeout(() => box.classList.add('show'), 10);
}

window.closeCustomAlert = function() {
    const overlay = document.getElementById('customAlert');
    const box = document.querySelector('.custom-alert-box');
    box.classList.remove('show');
    setTimeout(() => overlay.style.display = 'none', 300);
}

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    const target = document.getElementById(tabId);
    if(target) {
        target.style.display = 'block';
        target.classList.add('active');
        gsap.fromTo(target, {opacity: 0, y: 10}, {opacity: 1, y: 0, duration: 0.3});
    }
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(tabId === 'home') document.querySelector('.center-btn').classList.add('active');
    else if(tabId === 'wallet') document.querySelectorAll('.nav-item')[4].classList.add('active');
    else if(tabId === 'profile') document.querySelectorAll('.nav-item')[0].classList.add('active');
    else if(tabId === 'team') document.querySelectorAll('.nav-item')[1].classList.add('active');
    else if(tabId === 'store') document.querySelectorAll('.nav-item')[3].classList.add('active');
}

window.showDepositInfo = function() {
    window.showMsg('إيداع رصيد', 'سيتم تحويلك للوكيل..', '💳');
    setTimeout(() => window.open('https://t.me/an_ln2', '_blank'), 2000);
}

window.showWithdraw = function() {
    if(userData.balance < 10000) return window.showMsg('سحب الرصيد', 'رصيدك غير كافٍ.', '🚫');
    window.showMsg('سحب الرصيد', 'تم استلام الطلب.', '✅');
    userData.history.unshift({type: 'سحب', amount: 0, date: new Date().toLocaleDateString()}); 
    renderHistory();
}

window.copyInviteLink = function() {
    const code = document.getElementById('myInviteCode').innerText;
    navigator.clipboard.writeText(`https://basmali12.github.io/ref/${code}`);
    window.showMsg('نسخ الرابط', 'تم نسخ كود الدعوة!', '📋');
}

window.addMemberSim = function() {
    let current = parseInt(document.getElementById('teamCount').innerText);
    if(current < 10) document.getElementById('teamCount').innerText = current + 1;
    else window.showMsg('تنبيه', 'الحد الأقصى للفريق 10', '🛑');
}

window.requestPlan = function(type, price, planId) {
    let settings = PLAN_SETTINGS['plan'+planId];
    if(settings.sold >= settings.total) return window.showMsg('نأسف', 'نفذت الكمية!', '🔒');
    window.showMsg('تأكيد الطلب', 'تم إرسال الطلب.', '⏳');
    userData.plans.push({type: type, status: 'pending'});
    updateUI(); 
    window.switchTab('profile');
}

// دوال مساعدة داخلية
function updateStockDisplay() {
    let p1 = PLAN_SETTINGS.plan1;
    let perc1 = (p1.sold / p1.total) * 100;
    document.getElementById('fill1').style.width = perc1 + '%';
    document.getElementById('txt1').innerText = `متاح: ${p1.total - p1.sold}/${p1.total}`;
    if(p1.sold >= p1.total) document.getElementById('plan1').classList.add('sold-out');

    let p2 = PLAN_SETTINGS.plan2;
    let perc2 = (p2.sold / p2.total) * 100;
    document.getElementById('fill2').style.width = perc2 + '%';
    document.getElementById('txt2').innerText = `متاح: ${p2.total - p2.sold}/${p2.total}`;
    if(p2.sold >= p2.total) document.getElementById('plan2').classList.add('sold-out');
}

function startLiveTimer() {
    setInterval(() => {
        const now = new Date();
        const end = new Date(); end.setHours(23, 59, 59);
        const diff = end - now;
        const h = Math.floor((diff % (86400000)) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        document.getElementById('dailyTimer').innerText = `${h}:${m}:${s}`;
    }, 1000);
}

function updateUI() {
    document.getElementById('walletBalance').innerText = userData.balance.toLocaleString() + ' IQD';
    document.getElementById('walletBalance2').innerText = userData.balance.toLocaleString() + ' IQD';
    // لا نحتاج لتحديث الاسم هنا لأنه يحدث في onAuthStateChanged
    const list = document.getElementById('myPlansList');
    list.innerHTML = '';
    if(userData.plans.length === 0) list.innerHTML = '<p style="text-align:center;color:#999">لا توجد اشتراكات</p>';
    userData.plans.forEach(p => {
        list.innerHTML += `<li class="menu-item" style="justify-content:space-between"><span>${p.type}</span> <span style="color:orange">قيد المراجعة</span></li>`;
    });
}

function renderHistory() {
    const list = document.getElementById('transList');
    list.innerHTML = '';
    if(userData.history.length === 0) {
        list.innerHTML = '<li style="text-align:center; color:#999; padding:10px;">لا توجد عمليات حديثة</li>';
        return;
    }
    userData.history.forEach(h => {
        let cls = h.type === 'إيداع' ? 'in' : 'out';
        list.innerHTML += `<li class="h-item ${cls}"><span>${h.type}</span><span>${h.date}</span></li>`;
    });
}
