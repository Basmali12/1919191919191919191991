/* =========================================
   Key Invest VIP - User App (Connected)
   ========================================= */

// 1. استيراد المكتبات
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
    plans: []
};

document.addEventListener('DOMContentLoaded', () => {
    const savedId = localStorage.getItem('keyApp_userId');
    if (savedId) {
        startDataListener(savedId);
    } else {
        document.getElementById('loginModal').style.display = 'flex';
    }
    
    startLiveTimer();
    fetchPlansFromAdmin(); // دالة جديدة لجلب الخطط من الأدمن
    
    if(window.gsap) {
        gsap.from(".app-header", {y: -50, opacity: 0, duration: 0.8});
        gsap.from(".balance-card", {scale: 0.9, opacity: 0, delay: 0.3});
    }
});

// === دالة جلب الخطط من الأدمن (جديد) ===
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
            
            // حساب نسبة الامتلاء
            const percent = (p.sold / p.stock) * 100;
            const isFull = p.sold >= p.stock;
            
            // قالب HTML للباقة
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

// === وظائف تسجيل الدخول ===
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
                status: 'active', // مهم للحظر
                createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, "users", userId), newUser);
        }
        
        localStorage.setItem('keyApp_userId', userId);
        document.getElementById('loginModal').style.display = 'none';
        startDataListener(userId);
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

// === الاستماع الحي للبيانات ===
function startDataListener(userId) {
    onSnapshot(doc(db, "users", userId), (docSnap) => {
        if (docSnap.exists()) {
            userData = docSnap.data();
            
            // التحقق من الحظر
            if (userData.status === 'banned') {
                document.body.innerHTML = '<h1 style="text-align:center; padding:50px; color:red">تم حظر حسابك لمخالفة القوانين</h1>';
                localStorage.removeItem('keyApp_userId');
                return;
            }

            updateUI();
            document.getElementById('loginModal').style.display = 'none';
        } else {
            localStorage.removeItem('keyApp_userId');
            location.reload();
        }
    });
}

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

// === الوظائف العامة (طلب اشتراك) ===
window.requestPlan = async function(planName, price, planId) {
    if(!userData.id) return;
    
    // التحقق من الرصيد
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
            
            // خصم الرصيد وإضافة الباقة
            await updateDoc(userRef, {
                balance: userData.balance - price,
                plans: arrayUnion(newPlan)
            });

            // تحديث عدد المشتركين في العداد (اختياري لكن مفضل)
            /* يمكنك إضافة كود هنا لزيادة عداد sold في كولكشن plans 
               باستخدام increment من فايربيس
            */

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
    if(tabId === 'home') document.querySelector('.center-btn').classList.add('active');
    else if(tabId === 'profile') document.querySelectorAll('.nav-item')[0].classList.add('active');
    else if(tabId === 'team') document.querySelectorAll('.nav-item')[1].classList.add('active');
    else if(tabId === 'store') document.querySelectorAll('.nav-item')[3].classList.add('active');
    else if(tabId === 'wallet') document.querySelectorAll('.nav-item')[4].classList.add('active');
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

function startLiveTimer() {
    setInterval(() => {
        const d = new Date();
        const str = `${String(23-d.getHours()).padStart(2,'0')}:${String(59-d.getMinutes()).padStart(2,'0')}:${String(59-d.getSeconds()).padStart(2,'0')}`;
        const el = document.getElementById('dailyTimer');
        if(el) el.innerText = str;
    }, 1000);
}
