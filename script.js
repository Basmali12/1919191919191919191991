/* =========================================
   ملف التحكم المنطقي - يدعم التحديث المباشر
   ========================================= */

// متغير لتخزين بيانات المستخدم الحالية
let userData = {
    id: null,
    name: 'ضيف',
    balance: 0,
    plans: [],
    isRegistered: false
};

// === عند تحميل الصفحة ===
document.addEventListener('DOMContentLoaded', () => {
    // 1. التحقق من وجود ID محفوظ مسبقاً
    const savedId = localStorage.getItem('keyApp_userId');
    
    if (savedId) {
        // إذا وجدنا ID، نبدأ بمراقبة بيانات هذا المستخدم من السيرفر
        startDataListener(savedId);
    } else {
        // إذا لم يوجد، نظهر شاشة التسجيل
        document.getElementById('loginModal').style.display = 'flex';
    }

    // تشغيل انميشن العداد اليومي (شكلي فقط)
    startLiveTimer();
    // تجهيز رابط الدعوة
    setupInviteLink();
});

// === 1. دالة التسجيل (إنشاء مستخدم جديد في Firebase) ===
async function registerUser() {
    const nameInput = document.getElementById('regName');
    const passInput = document.getElementById('regPass'); // (اختياري حالياً)

    if (nameInput.value.length < 3) return alert('الاسم قصير جداً');

    const newId = 'USER_' + Math.floor(100000 + Math.random() * 900000);

    // هيكلة البيانات في قاعدة البيانات
    const newUserProfile = {
        id: newId,
        name: nameInput.value,
        password: passInput.value,
        balance: 0,       // الرصيد الابتدائي
        plans: [],        // مصفوفة الاشتراكات فارغة
        teamCount: 0,     // عدد الفريق
        createdAt: new Date().toISOString()
    };

    try {
        // حفظ في Firestore
        await window.setDoc(window.doc(window.db, "users", newId), newUserProfile);
        
        // حفظ الآيدي في الهاتف للدخول التلقائي
        localStorage.setItem('keyApp_userId', newId);
        
        // إخفاء المودال والبدء بالاستماع
        document.getElementById('loginModal').style.display = 'none';
        startDataListener(newId);
        
        alert('تم إنشاء الحساب بنجاح!');
    } catch (error) {
        console.error("Error creating user:", error);
        alert('حدث خطأ في الاتصال بالسيرفر');
    }
}

// === 2. دالة الاستماع الحي (Core Function) ===
// هذه الدالة هي المسؤولة عن تحديث التطبيق فوراً عند تغيير أي شيء في فايربيس
function startDataListener(userId) {
    // مرجع للمستند الخاص بالمستخدم
    const userRef = window.doc(window.db, "users", userId);

    // onSnapshot تستمع لأي تغيير
    window.onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
            userData = docSnap.data();
            
            // تحديث الواجهة فوراً
            updateDashboardUI();
            
            // إخفاء شاشة التسجيل للتأكيد
            document.getElementById('loginModal').style.display = 'none';
        } else {
            console.log("المستخدم غير موجود في قاعدة البيانات");
            localStorage.removeItem('keyApp_userId');
            location.reload();
        }
    }, (error) => {
        console.error("خطأ في جلب البيانات:", error);
    });
}

// === 3. تحديث عناصر الشاشة ===
function updateDashboardUI() {
    // تحديث النصوص الأساسية
    if(document.getElementById('headerName')) 
        document.getElementById('headerName').innerText = userData.name;
    
    if(document.getElementById('userId')) 
        document.getElementById('userId').innerText = userData.id;
    
    if(document.getElementById('walletBalance')) 
        document.getElementById('walletBalance').innerText = userData.balance.toLocaleString() + ' IQD';

    if(document.getElementById('teamCount'))
        document.getElementById('teamCount').innerText = userData.teamCount || 0;

    // تحديث قائمة الاشتراكات
    renderPlans();
    
    // تحديث رابط الدعوة
    setupInviteLink();
}

// رسم قائمة الاشتراكات بناءً على البيانات من فايربيس
function renderPlans() {
    const list = document.getElementById('myPlansList');
    if(!list) return;

    list.innerHTML = ''; // مسح القائمة القديمة

    if (!userData.plans || userData.plans.length === 0) {
        list.innerHTML = '<li style="text-align:center;color:#999;padding:10px;">لا توجد اشتراكات نشطة</li>';
        return;
    }

    // ترتيب الاشتراكات (الأحدث أولاً)
    const reversedPlans = [...userData.plans].reverse();

    reversedPlans.forEach(plan => {
        let statusText = '';
        let statusColor = '';

        if (plan.status === 'active') {
            statusText = 'نشط ✅';
            statusColor = '#2ecc71'; // أخضر
        } else if (plan.status === 'pending') {
            statusText = 'قيد المراجعة ⏳';
            statusColor = '#f39c12'; // برتقالي
        } else {
            statusText = 'منتهي ❌';
            statusColor = '#e74c3c'; // أحمر
        }

        list.innerHTML += `
            <li class="menu-item" style="justify-content:space-between; border-right: 3px solid ${statusColor}">
                <div>
                    <span style="font-weight:bold; display:block">${plan.type}</span>
                    <span style="font-size:0.75rem; color:#888">${plan.requestDate.split('T')[0]}</span>
                </div>
                <span style="color:${statusColor}; font-weight:bold; font-size:0.9rem">${statusText}</span>
            </li>
        `;
    });
}

// === 4. طلب اشتراك جديد ===
async function requestPlan(type, price) {
    if(!userData.id) return;

    if(confirm(`تأكيد طلب الاشتراك في باقة ${price.toLocaleString()}؟`)) {
        // تجهيز كائن الاشتراك الجديد
        const newPlanObj = {
            type: type,      // مثلاً "باقة المبتدئ"
            price: price,
            status: 'pending', // الحالة الافتراضية
            requestDate: new Date().toISOString()
        };

        try {
            const userRef = window.doc(window.db, "users", userData.id);
            
            // استخدام arrayUnion لإضافة العنصر للمصفوفة دون حذف القديم
            await window.updateDoc(userRef, {
                plans: window.arrayUnion(newPlanObj)
            });
            
            alert('✅ تم إرسال الطلب بنجاح! سيظهر في القائمة فوراً.');
            switchTab('profile'); // الذهاب للبروفايل لرؤية الطلب
            
        } catch (e) {
            console.error("Error adding plan:", e);
            alert('فشل إرسال الطلب، تأكد من الإنترنت');
        }
    }
}

// === 5. الوظائف المساعدة والتنقل ===

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });
    
    const target = document.getElementById(tabId);
    if(target) {
        target.style.display = 'block';
        // مهلة بسيطة لتشغيل الانميشن
        setTimeout(() => target.classList.add('active'), 10);
        
        // GSAP Animation
        if(window.gsap) {
            gsap.fromTo(target, {opacity: 0, y: 15}, {opacity: 1, y: 0, duration: 0.4});
        }
    }

    // تحديث أزرار الناف بار
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // منطق بسيط لتحديد الزر
    if(tabId === 'home') document.querySelector('.center-btn').classList.add('active');
    if(tabId === 'profile') document.querySelectorAll('.nav-item')[0].classList.add('active');
    if(tabId === 'team') document.querySelectorAll('.nav-item')[1].classList.add('active');
    if(tabId === 'store') document.querySelectorAll('.nav-item')[3].classList.add('active');
    if(tabId === 'agents') document.querySelectorAll('.nav-item')[4].classList.add('active');
}

function setupInviteLink() {
    const linkInput = document.getElementById('myInviteLink');
    if(linkInput && userData.id) {
        linkInput.value = `https://key-invest.app/join?ref=${userData.id}`;
    }
}

function copyInviteLink() {
    const copyText = document.getElementById("myInviteLink");
    if(!copyText) return;
    copyText.select();
    navigator.clipboard.writeText(copyText.value);
    alert("تم نسخ الرابط: " + copyText.value);
}

function showComingSoon() {
    alert('⚠️ هذه الميزة قيد التطوير حالياً');
}

function showDepositInfo() {
    // فتح رابط التليجرام الخاص بالإيداع
    window.open('https://t.me/an_ln2', '_blank');
}

function logout() {
    if(confirm('تسجيل خروج؟')) {
        localStorage.removeItem('keyApp_userId');
        location.reload();
    }
}

// === 6. انميشن العداد (تجميلي فقط) ===
function startLiveTimer() {
    const timerEl = document.getElementById('dailyTimer');
    if(!timerEl) return;
    
    setInterval(() => {
        const now = new Date();
        const end = new Date();
        end.setHours(23, 59, 59);
        const diff = end - now;
        
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        
        timerEl.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }, 1000);
}
