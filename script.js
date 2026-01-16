/* =========================================
   Keey App - Logic V3 (Modified)
   ========================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, arrayUnion, collection, getDocs, increment, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

// === منطق التثبيت ===
document.addEventListener('DOMContentLoaded', () => {
    const installBtn = document.getElementById('installBtn');
    if (window.deferredPrompt) {
        const banner = document.getElementById('installBanner');
        if (banner) banner.style.display = 'flex';
    }
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (window.deferredPrompt) {
                window.deferredPrompt.prompt();
                const { outcome } = await window.deferredPrompt.userChoice;
                window.deferredPrompt = null;
            }
            closeInstallBanner();
        });
    }
});

window.closeInstallBanner = function() {
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
}

// === المتغيرات ===
let userData = {
    id: null,
    name: 'زائر',
    balance: 0,
    plans: [],
    lastProfitTime: 0
};

let timerInterval;

document.addEventListener('DOMContentLoaded', () => {
    if ("Notification" in window) {
        Notification.requestPermission();
    }

    const savedId = localStorage.getItem('keyApp_userId');
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            const userId = "USER_" + user.uid.substring(0, 10);
            localStorage.setItem('keyApp_userId', userId);
            startDataListener(userId);
        } else if (savedId && savedId.startsWith('GUEST')) {
            startDataListener(savedId);
        } else {
            document.getElementById('loginModal').style.display = 'flex';
        }
    });
    
    fetchPlansFromAdmin();
    
    if(window.gsap) {
        gsap.from(".app-header", {y: -50, opacity: 0, duration: 0.8});
        gsap.from(".balance-card", {scale: 0.9, opacity: 0, delay: 0.3});
    }
});

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
                    <div><span class="p-detail">الربح اليومي</span><span class="p-val">${p.profit.toLocaleString()}</span></div>
                </div>
                <div class="stock-info">
                    <div class="stock-bar"><div class="stock-fill" style="width: ${percent}%;"></div></div>
                    <span class="stock-text">متاح: ${p.sold}/${p.stock}</span>
                </div>
                <button onclick="requestPlan('${p.name}', ${p.price}, ${p.profit}, '${planId}')">
                    ${isFull ? 'مكتمل' : 'شراء وتفعيل فوري'}
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
                lastProfitTime: Date.now(),
                createdAt: new Date().toISOString()
            };
            await setDoc(doc(db, "users", userId), newUser);
        }
        
        localStorage.setItem('keyApp_userId', userId);
        document.getElementById('loginModal').style.display = 'none';
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

// === الاستماع للبيانات ===
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
            checkAndStartTimer();
            document.getElementById('loginModal').style.display = 'none';
        } else {
            localStorage.removeItem('keyApp_userId');
        }
    });
}

// === التعديل 2 & 3: منطق المؤقت والجمع اليدوي ===
function checkAndStartTimer() {
    if (timerInterval) clearInterval(timerInterval);

    const timerEl = document.getElementById('dailyTimer');
    const btnEl = document.getElementById('startMiningBtn');

    function updateTimerDisplay() {
        // حساب الربح اليومي الكلي
        let totalDailyProfit = 0;
        if(userData.plans) {
            userData.plans.forEach(p => {
                if(p.status === 'active') totalDailyProfit += (p.profit || 0);
            });
        }
        document.getElementById('totalDailyProfit').innerText = totalDailyProfit.toLocaleString();

        // منطق الوقت
        const now = Date.now();
        const lastTime = userData.lastProfitTime || 0;
        const targetTime = lastTime + (24 * 60 * 60 * 1000); // 24 ساعة
        const diff = targetTime - now;

        if (diff <= 0) {
            // انتهى الوقت - توقف العداد واظهر زر الجمع
            if(timerEl) timerEl.style.display = 'none';
            if(btnEl) {
                btnEl.style.display = 'block';
                // تحديث نص الزر ليشمل المبلغ
                btnEl.innerText = `⚡ اضغط لجمع ${totalDailyProfit} IQD وتشغيل العداد`;
            }
            clearInterval(timerInterval);
        } else {
            // العداد يعمل
            if(btnEl) btnEl.style.display = 'none';
            if(timerEl) timerEl.style.display = 'block';

            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            if(timerEl) timerEl.innerText = 
                (hours < 10 ? "0" + hours : hours) + ":" + 
                (minutes < 10 ? "0" + minutes : minutes) + ":" + 
                (seconds < 10 ? "0" + seconds : seconds);
        }
    }

    updateTimerDisplay(); // تحديث فوري
    timerInterval = setInterval(updateTimerDisplay, 1000);
}

// دالة الجمع اليدوي (جديدة)
window.manualClaimAndStart = async function() {
    let totalProfit = 0;
    if(userData.plans) {
        userData.plans.forEach(p => {
            if(p.status === 'active') totalProfit += (p.profit || 0);
        });
    }

    if(totalProfit === 0) {
        return window.showMsg("تنبيه", "ليس لديك عدادات نشطة للجمع.", "⚠️");
    }

    try {
        const userRef = doc(db, "users", userData.id);
        
        // إضافة الربح وتحديث وقت آخر ربح للوقت الحالي (إعادة تشغيل العداد)
        await updateDoc(userRef, {
            balance: increment(totalProfit),
            lastProfitTime: Date.now()
        });

        window.showMsg("مبروك", `تم جمع ${totalProfit} IQD وبدأ العداد ليوم جديد!`, "💰");
        
    } catch (e) {
        console.error("Claim error:", e);
        window.showMsg("خطأ", "فشل الاتصال", "❌");
    }
}

// === تحديث الواجهة والتعديل 4 (تفاصيل الاشتراكات) ===
function updateUI() {
    if(document.getElementById('headerName')) document.getElementById('headerName').innerText = userData.name;
    if(document.getElementById('userId')) document.getElementById('userId').innerText = userData.id;
    if(document.getElementById('walletBalance')) document.getElementById('walletBalance').innerText = userData.balance.toLocaleString() + ' IQD';
    if(document.getElementById('walletBalance2')) document.getElementById('walletBalance2').innerText = userData.balance.toLocaleString() + ' IQD';
    if(document.getElementById('myInviteCode')) document.getElementById('myInviteCode').innerText = userData.id;

    // تحديث قائمة "حسابي" بالتفاصيل الجديدة
    const list = document.getElementById('myPlansList');
    if(list) {
        list.innerHTML = '';
        if(userData.plans && userData.plans.length > 0) {
            userData.plans.forEach(p => {
                // حالة العداد: بما أن العداد واحد للجميع، الحالة تعتمد على العداد العام
                let isActive = p.status === 'active';
                let statusText = isActive ? 'يعمل' : 'متوقف';
                let statusColor = isActive ? 'green' : 'red';

                list.innerHTML += `
                    <li class="menu-item" style="display:block; border-right:4px solid var(--primary);">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <span style="font-weight:bold;">${p.type}</span>
                            <span style="background:${statusColor}; color:white; padding:2px 8px; border-radius:10px; font-size:0.7rem;">${statusText}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#666;">
                            <span>الربح اليومي: ${p.profit} IQD</span>
                            <span>السعر: ${p.price}</span>
                        </div>
                    </li>`;
            });
        } else {
            list.innerHTML = '<li style="text-align:center; color:#999; padding:10px;">لا توجد اشتراكات نشطة</li>';
        }
    }
}

// === التعديل 1: الشراء المباشر ===
window.requestPlan = async function(planName, price, profit, planId) {
    if(!userData.id) return;
    
    // التحقق من الرصيد
    if(userData.balance < price) {
        return window.showMsg("عذراً", "رصيدك غير كافي لشراء هذا العداد", "🚫");
    }

    if(confirm(`تأكيد شراء ${planName} بسعر ${price.toLocaleString()} IQD؟ \nسيتم تفعيل العداد فوراً.`)) {
        // إنشاء الكائن مباشرة بحالة active
        const newPlan = {
            type: planName,
            price: price,
            profit: profit, // حفظ قيمة الربح
            status: 'active', // تفعيل فوري
            date: new Date().toISOString()
        };

        try {
            const userRef = doc(db, "users", userData.id);
            const planRef = doc(db, "plans", planId);

            // خصم الرصيد + إضافة الخطة
            await updateDoc(userRef, {
                balance: increment(-price), // خصم فوري
                plans: arrayUnion(newPlan)
            });

            // تحديث عدد المبيعات في مجموعة plans (اختياري لكن جيد للإحصائيات)
            await updateDoc(planRef, {
                sold: increment(1)
            });

            window.showMsg("تم الشراء", "تم تفعيل العداد بنجاح وبدأ احتساب الأرباح ضمن العداد اليومي", "✅");
            window.switchTab('profile'); // الذهاب لصفحة الاشتراكات
        } catch (e) {
            console.error(e);
            window.showMsg("خطأ", "فشل العملية", "❌");
        }
    }
}

// === التعديل 5: السحب والإيداع ===

// 1. الإيداع
window.showDepositInfo = function() {
    window.showMsg("جاري التحويل...", "سيتم نقلك إلى قسم المالية (الوكيل) عبر التليجرام لإتمام الإيداع.", "✈️");
    setTimeout(() => {
        window.open("https://t.me/an_ln2", "_blank");
    }, 2000);
}

// 2. السحب
window.showWithdraw = function() {
    if (userData.balance < 7000) {
        return window.showMsg("تنبيه", "يجب أن يكون رصيدك 7000 IQD أو أكثر لتتمكن من السحب.", "🚫");
    }
    
    // فتح النافذة وتحديث الرصيد فيها
    document.getElementById('wTotalBalance').innerText = userData.balance.toLocaleString();
    document.getElementById('wAmount').value = '';
    document.getElementById('wAccount').value = '';
    document.getElementById('withdrawModal').style.display = 'flex';
}

window.submitWithdrawRequest = async function() {
    const amount = Number(document.getElementById('wAmount').value);
    const method = document.getElementById('wMethod').value;
    const account = document.getElementById('wAccount').value;

    if (!amount || amount < 7000) {
        return alert("أقل مبلغ للسحب هو 7000 دينار");
    }
    if (amount > userData.balance) {
        return alert("الرصيد غير كافي");
    }
    if (!account || account.length < 5) {
        return alert("يرجى إدخال رقم محفظة أو بطاقة صحيح");
    }

    if (confirm(`هل أنت متأكد من سحب ${amount} IQD عبر ${method}؟`)) {
        try {
            // 1. خصم الرصيد من المستخدم
            const userRef = doc(db, "users", userData.id);
            await updateDoc(userRef, {
                balance: increment(-amount)
            });

            // 2. إرسال الطلب للأدمن (مجموعة withdrawals)
            await addDoc(collection(db, "withdrawals"), {
                userId: userData.id,
                userName: userData.name,
                amount: amount,
                method: method,
                accountNumber: account,
                status: 'pending',
                date: new Date().toISOString()
            });

            document.getElementById('withdrawModal').style.display = 'none';
            window.showMsg("تم الطلب", "تم استقطاع المبلغ وإرسال طلب السحب إلى الإدارة.", "✅");

        } catch (e) {
            console.error(e);
            alert("حدث خطأ أثناء المعالجة، يرجى المحاولة لاحقاً");
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
    // Removed 'soon' logic
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
