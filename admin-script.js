/* =========================================
   Admin Panel - Connected to Real Database
   ========================================= */

// 1. استيراد دوال فايربيس
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, setDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. إعدادات المشروع (نفس الموجودة في تطبيق المستخدم)
const firebaseConfig = {
    apiKey: "AIzaSyAFzCkQI0jedUl8W9xO1Bwzdg2Rhnxsh-s",
    authDomain: "kj1i-c1d4d.firebaseapp.com",
    projectId: "kj1i-c1d4d",
    storageBucket: "kj1i-c1d4d.firebasestorage.app",
    messagingSenderId: "674856242986",
    appId: "1:674856242986:web:77642057ca6ec2036c5853",
    measurementId: "G-J9QPH9Z1K1"
};

// تهيئة الاتصال
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// بيانات دخول الأدمن
const ADMIN_AUTH = {
    email: "saraameer1022@gmail.com",
    pass: "1998b"
};

// متغيرات عامة
let currentUser = null; // لتخزين المستخدم الحالي عند البحث
let notes = JSON.parse(localStorage.getItem('adminNotes')) || []; // الملاحظات تبقى محلية حالياً

/* === دوال النظام الأساسية === */

// تسجيل الدخول
window.adminLogin = function() {
    const email = document.getElementById('adminEmail').value;
    const pass = document.getElementById('adminPass').value;

    if (email === ADMIN_AUTH.email && pass === ADMIN_AUTH.pass) {
        document.getElementById('adminLoginModal').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'flex';
        renderPlans(); // جلب الخطط فور الدخول
        renderNotes();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
}

window.adminLogout = function() {
    location.reload();
}

// التنقل بين التبويبات
window.showTab = function(tabId) {
    document.querySelectorAll('.tab-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    // إضافة كلاس active للزر (تحتاج تحسين بسيط في HTML لكن هذا يؤدي الغرض)
}

/* === 1. إدارة العدادات (Database Plans) === */

window.toggleAddForm = function() {
    const form = document.getElementById('addPlanForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

// إضافة خطة جديدة لقاعدة البيانات
window.addNewPlan = async function() {
    const name = document.getElementById('pName').value;
    const price = document.getElementById('pPrice').value;
    const profit = document.getElementById('pProfit').value;
    const stock = document.getElementById('pStock').value;

    if (!name || !price || !stock) return alert('يرجى ملء كافة الحقول');

    // إنشاء كائن البيانات
    const newPlan = {
        name: name,
        price: Number(price),
        profit: Number(profit),
        stock: Number(stock),
        sold: 0,
        createdAt: Date.now() // للترتيب
    };

    try {
        // نستخدم الوقت الحالي كـ ID لضمان عدم التكرار
        const planId = "PLAN_" + Date.now();
        await setDoc(doc(db, "plans", planId), newPlan);
        
        alert('تم نشر العداد في التطبيق بنجاح ✅');
        renderPlans();
        toggleAddForm();
        
        // تفريغ الحقول
        document.getElementById('pName').value = '';
        document.getElementById('pPrice').value = '';
    } catch (e) {
        console.error("Error adding plan: ", e);
        alert("حدث خطأ أثناء الاتصال بقاعدة البيانات ❌");
    }
}

// جلب وعرض الخطط من قاعدة البيانات
window.renderPlans = async function() {
    const list = document.getElementById('adminPlansList');
    list.innerHTML = '<p style="text-align:center">جاري جلب البيانات من السيرفر...</p>';
    
    try {
        const q = query(collection(db, "plans")); // يمكن إضافة orderBy لاحقاً
        const querySnapshot = await getDocs(q);
        
        list.innerHTML = '';
        
        if (querySnapshot.empty) {
            list.innerHTML = '<p>لا توجد عدادات حالياً.</p>';
            return;
        }

        querySnapshot.forEach((docSnap) => {
            const plan = docSnap.data();
            const planId = docSnap.id;
            
            let isFull = plan.sold >= plan.stock;
            let statusHtml = isFull ? '<span style="color:red; font-weight:bold;">(مكتمل)</span>' : '';
            
            list.innerHTML += `
                <div class="plan-item" style="${isFull ? 'opacity:0.6; background:#f0f0f0;' : ''}">
                    <div>
                        <strong>${plan.name}</strong> ${statusHtml} <br>
                        <small>السعر: ${plan.price.toLocaleString()} | الربح: ${plan.profit.toLocaleString()} | المشتركين: ${plan.sold}/${plan.stock}</small>
                    </div>
                    <button onclick="deletePlan('${planId}')" class="btn-del">حذف</button>
                </div>
            `;
        });
    } catch (e) {
        console.error(e);
        list.innerHTML = '<p style="color:red">فشل تحميل العدادات.</p>';
    }
}

// حذف خطة من قاعدة البيانات
window.deletePlan = async function(planId) {
    if(confirm('هل أنت متأكد؟ سيتم حذف هذا العداد من تطبيق المستخدمين أيضاً.')) {
        try {
            await deleteDoc(doc(db, "plans", planId));
            renderPlans(); // تحديث القائمة
        } catch (e) {
            alert("حدث خطأ أثناء الحذف");
        }
    }
}

/* === 2. إدارة المستثمرين (Users Database) === */

window.searchUser = async function() {
    const id = document.getElementById('searchId').value.trim();
    if(!id) return alert("يرجى إدخال ID");

    try {
        // البحث المباشر في قاعدة البيانات
        const docRef = doc(db, "users", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentUser = docSnap.data();
            currentUser.dbId = docSnap.id; // حفظ المعرف

            document.getElementById('userResult').style.display = 'block';
            document.getElementById('uName').innerText = currentUser.name;
            document.getElementById('uID').innerText = currentUser.id;
            document.getElementById('uBalance').value = currentUser.balance;
            
            const status = currentUser.status || 'active';
            const badge = document.getElementById('uStatus');
            badge.innerText = status === 'active' ? 'نشط' : 'محظور';
            badge.style.color = status === 'active' ? 'green' : 'red';
        } else {
            alert('المستخدم غير موجود في قاعدة البيانات!');
            document.getElementById('userResult').style.display = 'none';
        }
    } catch (e) {
        console.error(e);
        alert("خطأ في الاتصال");
    }
}

window.updateBalance = function(direction) {
    let val = parseInt(document.getElementById('uBalance').value) || 0;
    if(direction === 1) val += 1000;
    else val -= 1000;
    document.getElementById('uBalance').value = val;
}

window.saveUserChanges = async function() {
    if(currentUser && currentUser.dbId) {
        const newBalance = parseInt(document.getElementById('uBalance').value);
        
        try {
            const userRef = doc(db, "users", currentUser.dbId);
            await updateDoc(userRef, {
                balance: newBalance
            });
            alert(`تم تحديث رصيد ${currentUser.name} بنجاح ✅`);
        } catch (e) {
            console.error(e);
            alert("فشل الحفظ ❌");
        }
    }
}

window.banUser = async function() {
    if(currentUser && currentUser.dbId) {
        if(confirm("هل أنت متأكد من حظر هذا المستخدم؟")) {
            try {
                const userRef = doc(db, "users", currentUser.dbId);
                await updateDoc(userRef, {
                    status: 'banned'
                });
                alert('تم حظر المستخدم');
                document.getElementById('uStatus').innerText = 'محظور';
                document.getElementById('uStatus').style.color = 'red';
            } catch(e) {
                alert("فشل العملية");
            }
        }
    }
}

/* === 3. المذكرة (محلية - LocalStorage) === */
window.addNote = function() {
    const name = document.getElementById('noteName').value;
    const date = document.getElementById('noteDate').value;
    if(!name || !date) return;

    notes.push({name, date});
    localStorage.setItem('adminNotes', JSON.stringify(notes));
    renderNotes();
}

window.renderNotes = function() {
    const tbody = document.getElementById('notesList');
    tbody.innerHTML = '';
    notes.forEach((n, i) => {
        tbody.innerHTML += `
            <tr>
                <td>${n.name}</td>
                <td>${n.date}</td>
                <td><button onclick="deleteNote(${i})" style="color:red; background:none; border:none; cursor:pointer;">X</button></td>
            </tr>
        `;
    });
}

window.deleteNote = function(i) {
    notes.splice(i, 1);
    localStorage.setItem('adminNotes', JSON.stringify(notes));
    renderNotes();
}
