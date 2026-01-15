/* *** نظام الحماية والأمان (Anti-Cheat & Security Core) ***
   هذا الجزء يمنع المستخدم من التلاعب بالوقت لتسريع العدادات 
*/
const SECURITY_KEY = 'secure_time_check_v1';

function checkTimeIntegrity() {
    const now = Date.now();
    const lastTime = localStorage.getItem(SECURITY_KEY);

    if (lastTime && now < parseInt(lastTime)) {
        // إذا كان الوقت الحالي أقل من آخر وقت محفوظ، يعني المستخدم رجع ساعة التليفون
        document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:50px;">🚫 تم اكتشاف تلاعب بالوقت! <br> يرجى ضبط ساعة هاتفك.</h1>';
        throw new Error("Time Manipulation Detected");
    }
    
    // حفظ الوقت الحالي
    localStorage.setItem(SECURITY_KEY, now);
}

// تشغيل فحص الأمان كل ثانية
setInterval(checkTimeIntegrity, 1000);
checkTimeIntegrity(); // فحص أولي عند التحميل

/* ========================================= */

// === تهيئة البيانات ===
let userData = JSON.parse(localStorage.getItem('keyAppUser_v5')) || {
    isRegistered: false,
    name: '',
    id: 'ID' + Math.floor(10000 + Math.random() * 90000),
    balance: 0,
    plans: []
};

// === عند تحميل الصفحة ===
document.addEventListener('DOMContentLoaded', () => {
    checkLogin();
    updateUI();
    generateInviteLink();
    startLiveTimer(); // تشغيل العداد الانميشن
});

// === 1. الوظائف الأساسية ===
function switchTab(tabId) {
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
    // تحديد الزر النشط (تقريبي)
    if(tabId === 'home') document.querySelector('.center-btn').classList.add('active');
}

// === 2. نظام المستخدم والتسجيل ===
function checkLogin() {
    const modal = document.getElementById('loginModal');
    if (!userData.isRegistered) {
        modal.style.display = 'flex';
    } else {
        modal.style.display = 'none';
        document.getElementById('headerName').innerText = userData.name;
        document.getElementById('userId').innerText = userData.id;
    }
}

function registerUser() {
    const name = document.getElementById('regName').value;
    const pass = document.getElementById('regPass').value;
    if (name.length < 3 || pass.length < 4) return alert('يرجى ملء البيانات بشكل صحيح');
    
    userData.isRegistered = true;
    userData.name = name;
    saveData();
    checkLogin();
}

function logout() {
    if(confirm('هل تريد تسجيل الخروج؟')) {
        localStorage.removeItem('keyAppUser_v5');
        location.reload();
    }
}

// === 3. الوظائف المطلوبة (قريباً + الإيداع) ===

// وظيفة عامة لأي شيء غير جاهز
function showComingSoon() {
    alert('⏳ قريباً.. هذه الميزة قيد التطوير والصيانة حالياً.');
}

// الإيداع - تم التحديث لليوزر الجديد
function showDepositInfo() {
    alert('لشحن الرصيد يرجى مراسلة الوكيل المعتمد على التليجرام:\n\nUser: @an_ln2\n\nيرجى إرسال صورة التحويل والآيدي الخاص بك.');
    window.open('https://t.me/an_ln2', '_blank');
}

// رابط الدعوة - يعمل الآن
function generateInviteLink() {
    const linkInput = document.getElementById('myInviteLink');
    if(linkInput) {
        // رابط وهمي يحاكي الموقع الحقيقي مع كود المستخدم
        linkInput.value = `https://key-invest.app/join?ref=${userData.id}`;
    }
}

function copyInviteLink() {
    const copyText = document.getElementById("myInviteLink");
    copyText.select();
    copyText.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(copyText.value);
    alert("✅ تم نسخ رابط الدعوة: " + copyText.value);
}

// === 4. نظام العداد (Animation) ===
function startLiveTimer() {
    const timerElement = document.getElementById('dailyTimer');
    // مؤقت وهمي يعد تنازلياً حتى نهاية اليوم
    setInterval(() => {
        const now = new Date();
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        
        const diff = endOfDay - now;
        
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        if(timerElement) {
            timerElement.innerText = 
                (hours < 10 ? "0" + hours : hours) + ":" + 
                (minutes < 10 ? "0" + minutes : minutes) + ":" + 
                (seconds < 10 ? "0" + seconds : seconds);
        }
    }, 1000);
}

// === 5. طلب الباقات ===
function requestPlan(type, price) {
    if(confirm('هل تريد إرسال طلب تفعيل لهذه الباقة؟')) {
        userData.plans.push({type: type, status: 'pending', date: new Date().toLocaleDateString()});
        saveData();
        updateUI();
        alert('تم إرسال الطلب للمراجعة.');
        switchTab('profile');
    }
}

// تحديث الواجهة
function updateUI() {
    document.getElementById('walletBalance').innerText = userData.balance.toLocaleString() + ' IQD';
    document.getElementById('teamCount').innerText = Math.floor(Math.random() * 5); // رقم عشوائي للتجربة
    
    const list = document.getElementById('myPlansList');
    if(list) {
        list.innerHTML = '';
        if(userData.plans.length === 0) list.innerHTML = '<p style="text-align:center;color:#999">لا توجد اشتراكات</p>';
        userData.plans.forEach(p => {
            list.innerHTML += `<li class="menu-item" style="justify-content:space-between"><span>${p.type}</span> <span style="color:orange">قيد المراجعة</span></li>`;
        });
    }
}

// حفظ البيانات
function saveData() {
    localStorage.setItem('keyAppUser_v5', JSON.stringify(userData));
}
