/* =========================================
   Admin Panel - Connected to Real Database
   ========================================= */

// 1. استيراد دوال فايربيس
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc, setDoc, deleteDoc, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 2. إعدادات المشروع
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

let currentUser = null; 
let notes = JSON.parse(localStorage.getItem('adminNotes')) || []; 

/* === دوال النظام الأساسية === */
window.adminLogin = function() {
    const email = document.getElementById('adminEmail').value;
    const pass = document.getElementById('adminPass').value;

    if (email === ADMIN_AUTH.email && pass === ADMIN_AUTH.pass) {
        document.getElementById('adminLoginModal').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'flex';
        renderPlans(); 
        renderNotes();
        listenToWithdrawals(); // بدء الاستماع للطلبات
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
}

window.adminLogout = function() {
    location.reload();
}

window.showTab = function(tabId) {
    document.querySelectorAll('.tab-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
}

/* === 1. إدارة العدادات (Database Plans) === */
window.toggleAddForm = function() {
    const form = document.getElementById('addPlanForm');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

window.addNewPlan = async function() {
    const name = document.getElementById('pName').value;
    const price = document.getElementById('pPrice').value;
    const profit = document.getElementById('pProfit').value;
    const stock = document.getElementById('pStock').value;

    if (!name || !price || !stock) return alert('يرجى ملء كافة الحقول');

    const newPlan = {
        name: name,
        price: Number(price),
        profit: Number(profit),
        stock: Number(stock),
        sold: 0,
        createdAt: Date.now() 
    };

    try {
        const planId = "PLAN_" + Date.now();
        await setDoc(doc(db, "plans", planId), newPlan);
        alert('تم نشر العداد في التطبيق بنجاح ✅');
        renderPlans();
        toggleAddForm();
        
        document.getElementById('pName').value = '';
        document.getElementById('pPrice').value = '';
    } catch (e) {
        console.error("Error adding plan: ", e);
        alert("حدث خطأ أثناء الاتصال بقاعدة البيانات ❌");
    }
}

window.renderPlans = async function() {
    const list = document.getElementById('adminPlansList');
    list.innerHTML = '<p style="text-align:center">جاري جلب البيانات من السيرفر...</p>';
    
    try {
        const q = query(collection(db, "plans")); 
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

window.deletePlan = async function(planId) {
    if(confirm('هل أنت متأكد؟ سيتم حذف هذا العداد من تطبيق المستخدمين أيضاً.')) {
        try {
            await deleteDoc(doc(db, "plans", planId));
            renderPlans(); 
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
        const docRef = doc(db, "users", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            currentUser = docSnap.data();
            currentUser.dbId = docSnap.id;

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

/* === 3. سجل الملاحظات === */
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

/* === 4. إدارة الطلبات (الجديد) === */
function listenToWithdrawals() {
    const list = document.getElementById('withdrawalsList');
    const q = query(collection(db, "withdrawals"), orderBy("date", "desc"));

    onSnapshot(q, (snapshot) => {
        list.innerHTML = '';
        if(snapshot.empty) {
            list.innerHTML = '<p style="text-align:center; width:100%; color:#888;">لا توجد طلبات جديدة.</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const req = doc.data();
            const dateObj = new Date(req.date);
            const dateStr = dateObj.toLocaleDateString('ar-EG') + ' ' + dateObj.toLocaleTimeString('ar-EG');
            
            // تحديد اللون والأيقونة حسب الطريقة
            const icon = req.method === 'zaincash' ? '📱' : '💳';
            const methodText = req.method === 'zaincash' ? 'زين كاش' : 'ماستر كارد';

            list.innerHTML += `
            <div class="req-card">
                <div class="req-header">
                    <h4>${icon} ${req.userName}</h4>
                    <span class="req-time">${dateStr}</span>
                </div>
                <div class="req-body">
                    <div class="req-row">
                        <span class="req-label">المبلغ المطلوب</span>
                        <span class="req-val amount">${Number(req.amount).toLocaleString()} IQD</span>
                    </div>
                    <div class="req-row">
                        <span class="req-label">رقم الحساب/الهاتف</span>
                    </div>
                    <div class="req-account-box" onclick="copyText('${req.accountNumber}')" title="اضغط للنسخ">
                        ${req.accountNumber} <i class="fas fa-copy" style="font-size:0.8rem; opacity:0.5;"></i>
                    </div>
                    <div class="req-row">
                        <span class="req-label">ID المستخدم</span>
                        <span class="req-val">${req.userId}</span>
                    </div>
                </div>
                <div class="req-footer">
                     <button class="btn-done" onclick="deleteReq('${doc.id}')"><i class="fas fa-check"></i> تم التحويل والأرشفة</button>
                </div>
            </div>
            `;
        });
    });
}

window.copyText = function(text) {
    navigator.clipboard.writeText(text);
    alert('تم نسخ الرقم: ' + text);
}

window.deleteReq = async function(docId) {
    if(confirm('هل أتممت التحويل وتريد إزالة هذا الطلب من القائمة؟')) {
        try {
            await deleteDoc(doc(db, "withdrawals", docId));
            alert('تمت الأرشفة بنجاح');
        } catch(e) {
            console.error(e);
            alert('حدث خطأ');
        }
    }
}
