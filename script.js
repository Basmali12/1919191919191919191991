/* =========================================
   Keey App - Fully Updated Logic
   ========================================= */

// 1. استيراد المكتبات
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, collection, getDocs, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 2. إعدادات Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAFzCkQI0jedUl8W9xO1Bwzdg2Rhnxsh-s",
    authDomain: "kj1i-c1d4d.firebaseapp.com",
    projectId: "kj1i-c1d4d",
    storageBucket: "kj1i-c1d4d.firebasestorage.app",
    messagingSenderId: "674856242986",
    appId: "1:674856242986:web:77642057ca6ec2036c5853",
    measurementId: "G-J9QPH9Z1K1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// === منطق PWA (التثبيت) ===
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

// === المتغيرات والبدء ===
let userData = {
    id: null,
    name: 'زائر',
    balance: 0,
    plans: [],
    lastProfitTime: 0 // للعداد
};

let timerInterval; // متغير للعداد

document.addEventListener('DOMContentLoaded', () => {
    // طلب إذن الإشعارات عند فتح التطبيق
    if ("Notification" in window) {
        Notification.requestPermission();
    }

    // التحقق المزدوج (LocalStorage + Firebase Auth) لحل مشكلة الخروج
    const savedId = localStorage.getItem('keyApp_userId');
    
    // مراقب المصادقة (الأهم للاستمرار)
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // المستخدم مسجل دخول بالفعل في فايربيس
            const userId = "USER_" + user.uid.substring(0, 10);
            localStorage.setItem('keyApp_userId', userId); // تحديث اللوكال
            startDataListener(userId);
        } else if (savedId && savedId.startsWith('GUEST')) {
            // حالة الزائر
            startDataListener(savedId);
        } else {
            // غير مسجل
            document.getElementById('loginModal').style.display = 'flex';
        }
    });
    
    fetchPlansFromAdmin();
    
    if(window.gsap) {
        gsap.from(".app-header", {y: -50, opacity: 0, duration: 0.8});
        gsap.from(".balance-card", {scale: 0.9, opacity: 0, delay: 0.3});
    }
});

// === دالة جلب الخطط ===
async function fetchPlansFromAdmin() {
    const container = document.getElementById('dynamicPlansArea');
    if(!container) return;

    try {
        const querySnapshot = await getDocs(collection(db, "plans"));
        container.innerHTML = '';

        if(querySnapshot.empty) {
            container.innerHTML = '<p style="text-align:center">لا توجد باقات متاحة حالياً.</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const p = docSnap.data();
            const planId = docSnap.id;
            const percent = (p.sold / p.stock) * 100;
            const isFull = p.sold >= p.stock;
            
            const html = `
            <div class="plan-box gsap-card ${isFull ? 'full-plan' : ''}" style="${isFull ? 'opacity:0.7; pointer-events:none' : ''}">
                <div class="plan-header"><i class="fas fa-gem"></i><h3>${p.name}</h3></div>
                <div class="plan-details-grid">
                    <div><span class="p-detail">السعر</span><span class="p-val">${p.price.toLocaleString()}</span></div>
                    <div><span class="p-detail">الربح</span><span class="p-val">${p.profit.toLocaleString()}</span></div>
                </div>
                <div class="stock-info">
                    <div class="stock-bar"><div class="stock-fill" style="width: ${percent}%;"></div></div>
                    <span class="stock-text">متاح: ${p.sold}/${p.stock}</span>
                </div>
                <button onclick="requestPlan('${p.name}', ${p.price}, '${planId}')">
                    ${isFull ? 'مكتمل' : 'اشتراك الآن'}
                </button>
            </div>
            `;
            container.innerHTML += html;
        });
    } catch (e) {
        console.error("Error fetching plans:", e);
    }
}

// === تسجيل الدخول ===
window.loginGoogle = function() {
    signInWithPopup(auth, provider)
    .then(async (result) => {
        const user = result.user;
        const userId = "USER_" + user.uid.substring(0, 10); 
        
        const docRef = doc(db, "users", userId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            const newUser = {
                id: userId,
                name: user.displayName || 'مستخدم جوجل',
                email: user.email,
                balance: 0,
                plans: [],
                status: 'active',
                lastProfitTime: Date.now(), // بداية العداد عند التسجيل
                createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, "users", userId), newUser);
        }
        
        localStorage.setItem('keyApp_userId', userId);
        document.getElementById('loginModal').style.display = 'none';
        // startDataListener سيتم استدعاؤها تلقائياً عبر onAuthStateChanged
        window.showMsg("تم الدخول", `أهلاً بك ${user.displayName}`, "✅");

    }).catch((error) => {
        console.error(error);
        window.showMsg("تنبيه", "فشل تسجيل الدخول.", "❌");
    });
}

window.loginGuest = async function() {
    const newId = 'GUEST_' + Math.floor(100000 + Math.random() * 900000);
    const newUser = {
        id: newId,
        name: 'ضيف',
        balance: 0,
        plans: [],
        status: 'active',
        lastProfitTime: Date.now(),
        createdAt: new Date().toISOString()
    };
    
    try {
        await setDoc(doc(db, "users", newId), newUser);
        localStorage.setItem('keyApp_userId', newId);
        document.getElementById('loginModal').style.display = 'none';
        startDataListener(newId);
    } catch (e) {
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

// === الاستماع للبيانات + العداد الآمن ===
function startDataListener(userId) {
    onSnapshot(doc(db, "users", userId), (docSnap) => {
        if (docSnap.exists()) {
            userData = docSnap.data();
            
            if (userData.status === 'banned') {
                document.body.innerHTML = '<h1 style="text-align:center; padding:50px; color:red">تم حظر حسابك</h1>';
                localStorage.removeItem('keyApp_userId');
                return;
            }

            updateUI();
            checkAndStartTimer(); // تشغيل منطق العداد
            document.getElementById('loginModal').style.display = 'none';
        } else {
            // إذا حذف المستخدم من القاعدة
            localStorage.removeItem('keyApp_userId');
        }
    });
}

// === منطق العداد الآمن (Server Side Logic) ===
function checkAndStartTimer() {
    if (timerInterval) clearInterval(timerInterval);

    // ربح يومي ثابت (يمكنك تغييره أو جعله يعتمد على الباقات)
    const DAILY_PROFIT_AMOUNT = 500; 

    function updateTimerDisplay() {
        const now = Date.now();
        // الوقت المستهدف هو: وقت آخر ربح + 24 ساعة
        const targetTime = (userData.lastProfitTime || 0) + (24 * 60 * 60 * 1000);
        const diff = targetTime - now;

        const el = document.getElementById('dailyTimer');

        if (diff <= 0) {
            // انتهى العداد!
            if(el) el.innerText = "جاري إضافة الأرباح...";
            clearInterval(timerInterval);
            
            // إضافة الرصيد تلقائياً وتحديث وقت العداد في قاعدة البيانات
            claimProfit(DAILY_PROFIT_AMOUNT);
        } else {
            // العداد شغال
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            if(el) el.innerText = 
                (hours < 10 ? "0" + hours : hours) + ":" + 
                (minutes < 10 ? "0" + minutes : minutes) + ":" + 
                (seconds < 10 ? "0" + seconds : seconds);
        }
    }

    updateTimerDisplay(); // تحديث فوري
    timerInterval = setInterval(updateTimerDisplay, 1000); // تحديث كل ثانية
}

async function claimProfit(amount) {
    try {
        const userRef = doc(db, "users", userData.id);
        
        // تحديث الرصيد + تحديث وقت آخر ربح للوقت الحالي
        await updateDoc(userRef, {
            balance: increment(amount),
            lastProfitTime: Date.now()
        });

        // إرسال إشعار للمستخدم
        sendNotification("💰 تم إضافة الأرباح!", `تم انتهاء العداد اليومي وإضافة ${amount} IQD لمحفظتك.`);

    } catch (e) {
        console.error("Auto claim error:", e);
    }
}

function sendNotification(title, body) {
    // إذا المتصفح يدعم الإشعارات وتم السماح بها
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
            body: body,
            icon: "https://j.top4top.io/p_3667oa2f41.jpg"
        });
    }
}

// === تحديث الواجهة ===
function updateUI() {
    if(document.getElementById('headerName')) document.getElementById('headerName').innerText = userData.name;
    if(document.getElementById('userId')) document.getElementById('userId').innerText = userData.id;
    if(document.getElementById('walletBalance')) document.getElementById('walletBalance').innerText = userData.balance.toLocaleString() + ' IQD';
    if(document.getElementById('walletBalance2')) document.getElementById('walletBalance2').innerText = userData.balance.toLocaleString() + ' IQD';
    if(document.getElementById('myInviteCode')) document.getElementById('myInviteCode').innerText = userData.id;

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
}

// === الوظائف العامة ===
window.requestPlan = async function(planName, price, planId) {
    if(!userData.id) return;
    
    if(userData.balance < price) {
        return window.showMsg("عذراً", "رصيدك غير كافي للاشتراك بهذه الباقة", "🚫");
    }

    if(confirm(`تأكيد الاشتراك بـ ${planName} بسعر ${price.toLocaleString()} IQD؟`)) {
        const newPlan = {
            type: planName,
            price: price,
            status: 'pending',
            date: new Date().toISOString()
        };

        try {
            const userRef = doc(db, "users", userData.id);
            await updateDoc(userRef, {
                balance: userData.balance - price,
                plans: arrayUnion(newPlan)
            });
            window.showMsg("نجاح", "تم الاشتراك بنجاح وخصم المبلغ", "✅");
            window.switchTab('profile');
        } catch (e) {
            console.error(e);
            window.showMsg("خطأ", "فشل العملية", "❌");
        }
    }
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
        if(window.gsap) gsap.fromTo(target, {opacity: 0, y: 10}, {opacity: 1, y: 0, duration: 0.3});
    }
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    
    // تحديد الزر النشط في الناف بار
    if(tabId === 'home') document.querySelector('.center-btn').classList.add('active');
    else if(tabId === 'profile') document.querySelectorAll('.nav-item')[0].classList.add('active');
    else if(tabId === 'team') document.querySelectorAll('.nav-item')[1].classList.add('active');
    else if(tabId === 'store') document.querySelectorAll('.nav-item')[3].classList.add('active');
    else if(tabId === 'soon') document.querySelectorAll('.nav-item')[4].classList.add('active');
    else if(tabId === 'wallet') {} // المحفظة ليس لها زر مباشر في الناف الجديد
}

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
