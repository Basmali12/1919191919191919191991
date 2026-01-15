/* =========================================
   Key Invest VIP - Main Logic & Auth
   ========================================= */

// 1. استيراد المكتبات الضرورية (Auth + Firestore)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 2. إعدادات مشروعك الحقيقية (تم دمجها هنا)
const firebaseConfig = {
    apiKey: "AIzaSyAFzCkQI0jedUl8W9xO1Bwzdg2Rhnxsh-s",
    authDomain: "kj1i-c1d4d.firebaseapp.com",
    projectId: "kj1i-c1d4d",
    storageBucket: "kj1i-c1d4d.firebasestorage.app",
    messagingSenderId: "674856242986",
    appId: "1:674856242986:web:77642057ca6ec2036c5853",
    measurementId: "G-J9QPH9Z1K1"
};

// 3. تهيئة الاتصال بـ Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);      // قاعدة البيانات
const auth = getAuth(app);         // المصادقة
const provider = new GoogleAuthProvider(); // مزود جوجل

// ==================================================
//  بداية منطق التطبيق (Logic)
// ==================================================

// === 1. منطق تثبيت التطبيق (PWA) ===
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'flex';
});

const installBtn = document.getElementById('installBtn');
if (installBtn) {
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
        }
        closeInstallBanner();
    });
}

window.closeInstallBanner = function() {
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
}

// === 2. المتغيرات والبدء ===
let userData = {
    id: null,
    name: 'زائر',
    balance: 0,
    plans: []
};

document.addEventListener('DOMContentLoaded', () => {
    // التحقق مما إذا كان هناك مستخدم مسجل مسبقاً في الهاتف
    const savedId = localStorage.getItem('keyApp_userId');
    if (savedId) {
        startDataListener(savedId);
    } else {
        document.getElementById('loginModal').style.display = 'flex';
    }
    
    startLiveTimer();
    
    // انميشن بسيط عند الفتح
    if(window.gsap) {
        gsap.from(".app-header", {y: -50, opacity: 0, duration: 0.8});
        gsap.from(".balance-card", {scale: 0.9, opacity: 0, delay: 0.3});
    }
});

// === 3. وظائف تسجيل الدخول ===

// دالة الدخول عبر جوجل (الحقيقية)
window.loginGoogle = function() {
    signInWithPopup(auth, provider)
    .then(async (result) => {
        const user = result.user;
        // نستخدم جزء من الـ UID الخاص بجوجل ليكون ID المستخدم
        const userId = "USER_" + user.uid.substring(0, 10); 
        
        // التحقق هل المستخدم جديد أم قديم في قاعدة البيانات
        const docRef = doc(db, "users", userId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            // مستخدم جديد: ننشئ له حساب في قاعدة البيانات
            const newUser = {
                id: userId,
                name: user.displayName || 'مستخدم جوجل',
                email: user.email,
                balance: 0,
                plans: [],
                createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, "users", userId), newUser);
        }
        
        // حفظ الآيدي محلياً والدخول
        localStorage.setItem('keyApp_userId', userId);
        document.getElementById('loginModal').style.display = 'none';
        
        // بدء جلب البيانات
        startDataListener(userId);
        
        window.showMsg("تم الدخول", `أهلاً بك ${user.displayName}`, "✅");

    }).catch((error) => {
        console.error(error);
        window.showMsg("تنبيه", "فشل تسجيل الدخول. هل أضفت رابط موقعك في إعدادات Firebase؟", "❌");
    });
}

// دالة دخول الزائر (للتجربة)
window.loginGuest = async function() {
    const newId = 'GUEST_' + Math.floor(100000 + Math.random() * 900000);
    const newUser = {
        id: newId,
        name: 'ضيف',
        balance: 0,
        plans: [],
        createdAt: new Date().toISOString()
    };
    
    try {
        await setDoc(doc(db, "users", newId), newUser);
        localStorage.setItem('keyApp_userId', newId);
        document.getElementById('loginModal').style.display = 'none';
        startDataListener(newId);
    } catch (e) {
        console.error(e);
        window.showMsg("خطأ", "فشل الاتصال بقاعدة البيانات", "⚠️");
    }
}

window.logout = function() {
    localStorage.removeItem('keyApp_userId');
    signOut(auth).then(() => {
        location.reload();
    }).catch(() => {
        location.reload();
    });
}

// === 4. الاستماع الحي للبيانات (Real-time) ===
function startDataListener(userId) {
    // هذه الدالة تراقب أي تغيير في قاعدة البيانات وتعكسه في التطبيق فوراً
    onSnapshot(doc(db, "users", userId), (docSnap) => {
        if (docSnap.exists()) {
            userData = docSnap.data();
            updateUI();
            // تأكد من إخفاء المودال
            document.getElementById('loginModal').style.display = 'none';
        } else {
            // إذا تم حذف المستخدم من القاعدة
            localStorage.removeItem('keyApp_userId');
            location.reload();
        }
    }, (error) => {
        console.error("Error getting document:", error);
    });
}

// تحديث الواجهة بالبيانات الجديدة
function updateUI() {
    // تحديث النصوص
    if(document.getElementById('headerName')) document.getElementById('headerName').innerText = userData.name;
    if(document.getElementById('userId')) document.getElementById('userId').innerText = userData.id;
    if(document.getElementById('walletBalance')) document.getElementById('walletBalance').innerText = userData.balance.toLocaleString() + ' IQD';
    if(document.getElementById('walletBalance2')) document.getElementById('walletBalance2').innerText = userData.balance.toLocaleString() + ' IQD';
    if(document.getElementById('myInviteCode')) document.getElementById('myInviteCode').innerText = userData.id;
    if(document.getElementById('inviteUrlDisplay')) document.getElementById('inviteUrlDisplay').innerText = `https://basmali12.github.io?ref=${userData.id}`;

    // تحديث قوائم الاشتراكات
    const list = document.getElementById('myPlansList');
    if(list) {
        list.innerHTML = '';
        if(userData.plans && userData.plans.length > 0) {
            userData.plans.forEach(p => {
                let color = p.status === 'active' ? 'green' : 'orange';
                let txt = p.status === 'active' ? 'نشط' : 'قيد المراجعة';
                list.innerHTML += `
                    <li class="menu-item" style="justify-content:space-between; border-right:3px solid ${color}">
                        <span>${p.type}</span> <span style="color:${color}">${txt}</span>
                    </li>`;
            });
        } else {
            list.innerHTML = '<li style="text-align:center; color:#999; padding:10px;">لا توجد اشتراكات</li>';
        }
    }
    
    // تحديث عدد الفريق (وهمي حالياً، يمكن ربطه لاحقاً)
    if(document.getElementById('teamCount')) document.getElementById('teamCount').innerText = userData.teamCount || 0;
}

// === 5. التنقل والوظائف العامة ===
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    const target = document.getElementById(tabId);
    if(target) {
        target.style.display = 'block';
        target.classList.add('active');
        if(window.gsap) gsap.fromTo(target, {opacity: 0, y: 10}, {opacity: 1, y: 0, duration: 0.3});
    }
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(tabId === 'home') document.querySelector('.center-btn').classList.add('active');
    else if(tabId === 'profile') document.querySelectorAll('.nav-item')[0].classList.add('active');
    else if(tabId === 'team') document.querySelectorAll('.nav-item')[1].classList.add('active');
    else if(tabId === 'store') document.querySelectorAll('.nav-item')[3].classList.add('active');
    else if(tabId === 'wallet') document.querySelectorAll('.nav-item')[4].classList.add('active');
}

window.requestPlan = async function(type, price, duration) {
    if(!userData.id) return;
    if(confirm(`تأكيد الاشتراك بـ ${price.toLocaleString()} IQD؟`)) {
        const newPlan = {
            type: type === 'starter' ? 'باقة المبتدئ' : 'باقة المحترف',
            price: price,
            status: 'pending',
            date: new Date().toISOString()
        };
        try {
            const userRef = doc(db, "users", userData.id);
            await updateDoc(userRef, {
                plans: arrayUnion(newPlan)
            });
            window.showMsg("نجاح", "تم إرسال طلب الاشتراك للمراجعة", "✅");
            window.switchTab('profile');
        } catch (e) {
            console.error(e);
            window.showMsg("خطأ", "فشل الاتصال", "❌");
        }
    }
}

// وظائف مساعدة للعرض والنسخ
window.showMsg = function(title, msg, icon) {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = msg;
    document.getElementById('alertIcon').innerText = icon;
    document.getElementById('customAlert').style.display = 'flex';
}

window.closeCustomAlert = function() {
    document.getElementById('customAlert').style.display = 'none';
}

window.copyInviteLink = function() {
    navigator.clipboard.writeText(userData.id);
    window.showMsg("تم النسخ", "تم نسخ كود الدعوة بنجاح", "📋");
}

window.showDepositInfo = function() {
    window.open("https://t.me/an_ln2", "_blank");
}
window.showWithdraw = function() {
    window.showMsg("سحب", "السحب متاح يوم الجمعة فقط", "💸");
}

window.addMemberSim = function() {
    window.showMsg("تنبيه", "هذه الميزة متاحة فقط لرؤساء الفرق", "🔒");
}

function startLiveTimer() {
    setInterval(() => {
        const d = new Date();
        const str = `${String(23-d.getHours()).padStart(2,'0')}:${String(59-d.getMinutes()).padStart(2,'0')}:${String(59-d.getSeconds()).padStart(2,'0')}`;
        const el = document.getElementById('dailyTimer');
        if(el) el.innerText = str;
    }, 1000);
}
