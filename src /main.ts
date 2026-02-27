import './style.css';
import Swal from 'sweetalert2';
import liff from '@line/liff';

// ⚠️ ใส่ข้อมูลของคุณที่นี่
const LIFF_ID = "YOUR_LIFF_ID"; 
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwKD8MpxTizCVMwy4k178xMsaSavKaxaXCVfOpvtKFciX-iq5E35Mi1v_qggqV3Sr5d/exec"; 

declare global {
  interface Window {
    loadEvents: () => void;
    openRegisterForm: (eventId: string) => void;
    loadMyCards: () => void;
    shareCard: (card: any) => void;
    openQrScanner: () => void;
    openAdminDashboard: () => void;
    loadAdminData: (silent?: boolean) => void;
    manageReg: (regId: string, action: string) => void;
  }
}

let currentUser = { userId: '', displayName: '', pictureUrl: '' };
let currentEvents: any[] = [];
let isAdminMode = false, adminPage = 1, adminSearch = "", adminTimer: any, searchTimer: any;

// 1. App Init
async function initializeApp() {
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.has('t')) {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('t', Date.now().toString());
    window.history.replaceState(null, '', newUrl.toString());
  }

  liff.showLoading();
  try {
    await liff.init({ liffId: LIFF_ID });
    if (!liff.isLoggedIn()) { liff.login(); return; }

    const profile = await liff.getProfile();
    currentUser = {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl || 'https://via.placeholder.com/150'
    };

    (document.getElementById('profile-img') as HTMLImageElement).src = currentUser.pictureUrl;
    document.getElementById('profile-name')!.textContent = currentUser.displayName;
    document.getElementById('user-profile')!.classList.remove('hidden');

    const statusRes = await callBackend('CHECK_USER', { 
      userId: currentUser.userId, 
      displayName: currentUser.displayName, 
      pictureUrl: currentUser.pictureUrl 
    });
    
    liff.hideLoading();

    // แสดงปุ่ม Admin / Staff ถ้ามีสิทธิ์
    if (statusRes.data.isAdmin) {
      document.getElementById('menu-admin')!.classList.remove('hidden');
      document.getElementById('menu-staff-scan')!.classList.remove('hidden');
    }

    statusRes.data.isConsented ? window.loadEvents() : switchView('view-consent');

  } catch (err: any) {
    liff.hideLoading();
    Swal.fire('Error', err.message, 'error');
  }
}

// 2. API Caller
async function callBackend(action: string, payload: any) {
  const endpoint = GAS_API_URL.startsWith("http") ? GAS_API_URL : window.location.href;
  liff.showLoading();
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ action, ...payload }),
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await res.json();
    liff.hideLoading();
    if (result.status === 'error') throw new Error(result.message);
    return result;
  } catch (err) {
    liff.hideLoading();
    throw err;
  }
}

function switchView(viewId: string) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  document.getElementById(viewId)!.classList.add('active');
}

// 3. Events & Registration
document.getElementById('btn-accept-consent')?.addEventListener('click', async () => {
  try {
    await callBackend('SAVE_CONSENT', { userId: currentUser.userId, userAgent: navigator.userAgent });
    window.loadEvents();
  } catch (e: any) { Swal.fire('Error', e.message, 'error'); }
});
document.getElementById('btn-reject-consent')?.addEventListener('click', () => {
  Swal.fire('แจ้งเตือน', 'จำเป็นต้องยินยอมเพื่อใช้งานระบบ', 'warning');
});

window.loadEvents = async () => {
  isAdminMode = false;
  try {
    const res = await callBackend('GET_EVENTS', {});
    currentEvents = res.data;
    const container = document.getElementById('event-cards-container')!;
    container.innerHTML = currentEvents.length ? currentEvents.map(e => `
      <div class="bg-white rounded shadow cursor-pointer transform transition hover:scale-105" onclick="window.openRegisterForm('${e.eventId}')">
        <img src="${e.coverUrl || 'https://via.placeholder.com/400x200'}" class="w-full h-32 object-cover rounded-t">
        <div class="p-4"><h3 class="font-bold text-lg">${e.title}</h3><p class="text-sm text-blue-500 mt-2"><i class="fas fa-hand-pointer"></i> สมัครเลย</p></div>
      </div>`).join('') : '<p class="col-span-full text-center text-gray-500 py-10">ยังไม่มีงานวิ่งเปิดรับสมัคร</p>';
    switchView('view-event-list');
  } catch (err: any) { Swal.fire('Error', err.message, 'error'); }
};

window.openRegisterForm = (eventId: string) => {
  const ev = currentEvents.find(e => e.eventId === eventId);
  document.getElementById('reg-event-title')!.textContent = ev.title;
  (document.getElementById('reg-event-id') as HTMLInputElement).value = ev.eventId;
  
  const select = document.getElementById('reg-distance')!;
  select.innerHTML = '<option value="">-- เลือกระยะทาง --</option>';
  if(ev.distances && ev.distances.length > 0) {
    ev.distances.forEach((d:any) => {
      select.innerHTML += `<option value="${d.distanceId}">${d.distanceName}</option>`;
    });
  } else {
    select.innerHTML += `<option value="5K">5K Fun Run</option><option value="10K">10K Mini Marathon</option>`;
  }
  switchView('view-register');
};

document.getElementById('form-register')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dist = (document.getElementById('reg-distance') as HTMLSelectElement).value;
  if (!dist) return Swal.fire('แจ้งเตือน', 'กรุณาเลือกระยะทาง', 'warning');
  
  const conf = await Swal.fire({ title: 'ยืนยันการสมัคร?', icon: 'question', showCancelButton: true });
  if (!conf.isConfirmed) return;
  
  try {
    const evId = (document.getElementById('reg-event-id') as HTMLInputElement).value;
    const res = await callBackend('REGISTER_EVENT', { userId: currentUser.userId, eventId: evId, distanceId: dist });
    Swal.fire('สมัครสำเร็จ!', `รอแอดมินอนุมัติ\nหมายเลข BIB ชั่วคราว: ${res.data.bibNumber}`, 'success').then(window.loadMyCards);
  } catch (err: any) { Swal.fire('ข้อผิดพลาด', err.message, 'error'); }
});

// 4. My Cards & Flex Share
window.loadMyCards = async () => {
  isAdminMode = false;
  try {
    const res = await callBackend('GET_MY_CARDS', { userId: currentUser.userId });
    const container = document.getElementById('my-cards-container')!;
    container.innerHTML = res.data.length ? res.data.map((c: any) => `
      <div class="bg-white rounded-xl shadow border p-6 text-center">
        <h3 class="font-bold text-xl">${c.eventTitle}</h3>
        <p class="text-sm text-gray-500 mb-2 uppercase tracking-wider">${c.distanceName}</p>
        <h1 class="text-6xl font-black text-blue-600 mb-6 tracking-tighter">${c.bibNumber}</h1>
        <div class="bg-gray-50 inline-block p-2 rounded-lg border mb-4">
          <img src="https://chart.googleapis.com/chart?chs=180x180&cht=qr&chl=${c.regId}&choe=UTF-8" class="w-32 h-32">
        </div>
        ${c.isCheckedIn ? '<div class="bg-green-100 text-green-700 p-3 font-bold mb-4 rounded-lg">✅ Check-in หน้างานเรียบร้อยแล้ว</div>' : '<div class="bg-yellow-100 text-yellow-700 p-3 font-bold mb-4 rounded-lg">⚠️ รอสแกน Check-in หน้างาน</div>'}
        <button onclick='window.shareCard(${JSON.stringify(c)})' class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition"><i class="fas fa-share-alt"></i> อวดเพื่อนใน LINE</button>
      </div>`).join('') : '<p class="text-center text-gray-500 py-10 bg-white rounded shadow">คุณยังไม่มีบัตรวิ่งที่ได้รับการอนุมัติ<br><span class="text-xs">(หากเพิ่งสมัคร กรุณารอแอดมินอนุมัติ)</span></p>';
    switchView('view-my-cards');
  } catch (err: any) { Swal.fire('Error', err.message, 'error'); }
};

window.shareCard = async (card: any) => {
  if (!liff.isApiAvailable('shareTargetPicker')) return Swal.fire('Error', 'อุปกรณ์ไม่รองรับการแชร์', 'error');
  try {
    await liff.shareTargetPicker([{
      type: "flex", altText: `บัตรวิ่งของฉัน: ${card.eventTitle}`,
      contents: { type: "bubble", body: { type: "box", layout: "vertical", contents: [ { type: "text", text: card.eventTitle, weight: "bold", size: "xl", wrap: true }, { type: "text", text: `BIB: ${card.bibNumber}`, size: "3xl", weight: "bold", color: "#1d4ed8" }, { type: "text", text: `ระยะ: ${card.distanceName}`, size: "sm", color: "#888888", margin: "md" } ] } }
    }] as any);
  } catch(e) { console.error(e); }
};

// 5. Staff QR Scanner
window.openQrScanner = async () => {
  if (!liff.isApiAvailable('scanCodeV2')) return Swal.fire('คำเตือน', 'กรุณาเปิดผ่านแอป LINE บนมือถือ', 'warning');
  try {
    const res = await liff.scanCodeV2();
    if (res && res.value) {
      const apiRes = await callBackend('PROCESS_QR_CHECKIN', { staffId: currentUser.userId, qrData: res.value });
      Swal.fire('✅ Check-in สำเร็จ!', `ผู้สมัคร BIB: <strong class="text-3xl text-blue-600">${apiRes.data.bibNumber}</strong>`, 'success');
    }
  } catch (err: any) { if(err.message) Swal.fire('Error', err.message, 'error'); }
};

// 6. Admin Dashboard
window.openAdminDashboard = async () => {
  isAdminMode = true; switchView('view-admin');
  window.loadAdminData();
  if(adminTimer) clearInterval(adminTimer);
  adminTimer = setInterval(() => { if(isAdminMode) window.loadAdminData(true); }, 30000);
};

window.loadAdminData = async (silent = false) => {
  try {
    const statsRes = await callBackend('ADMIN_GET_DASHBOARD', { adminId: currentUser.userId });
    const tableRes = await callBackend('ADMIN_GET_REGS', { adminId: currentUser.userId, page: adminPage, limit: 10, search: adminSearch });
    
    document.getElementById('dash-total')!.textContent = statsRes.data.totalRegs;
    document.getElementById('dash-pending')!.textContent = statsRes.data.pendingRegs;
    document.getElementById('dash-checkin')!.textContent = statsRes.data.totalCheckins;
    document.getElementById('dash-absent')!.textContent = statsRes.data.absentRegs;

    document.getElementById('admin-table-body')!.innerHTML = tableRes.data.data.map((r:any) => `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3 font-bold text-blue-600">${r.bibNumber || '-'}</td>
        <td class="px-4 py-3"><div class="flex items-center space-x-2"><img src="${r.pictureUrl}" class="w-6 h-6 rounded-full"><span>${r.displayName}</span></div></td>
        <td class="px-4 py-3">${r.status === 'approved' ? '<span class="text-green-600 text-xs font-bold">Approved</span>' : r.status === 'rejected' ? '<span class="text-red-600 text-xs font-bold">Rejected</span>' : '<span class="text-yellow-600 text-xs font-bold">Pending</span>'}</td>
        <td class="px-4 py-3 text-center">
          ${r.status === 'pending' ? `<button onclick="window.manageReg('${r.regId}', 'approve')" class="bg-green-500 text-white px-3 py-1 rounded text-xs shadow hover:bg-green-600 mr-1">Approve</button><button onclick="window.manageReg('${r.regId}', 'reject')" class="bg-red-500 text-white px-3 py-1 rounded text-xs shadow hover:bg-red-600">Reject</button>` : 
            r.status === 'approved' ? `<button onclick="window.manageReg('${r.regId}', 'checkin')" class="bg-blue-600 text-white px-3 py-1 rounded text-xs shadow hover:bg-blue-700 font-bold">Check-in</button>` : '-'}
        </td>
      </tr>
    `).join('');
    document.getElementById('page-info')!.textContent = `หน้า ${tableRes.data.pagination.page} / ${tableRes.data.pagination.totalPages}`;
  } catch (err: any) { if(!silent) Swal.fire('Error', err.message, 'error'); }
};

window.manageReg = async (regId: string, action: string) => {
  const c = await Swal.fire({ title: 'ยืนยันดำเนินการ?', icon: 'warning', showCancelButton: true });
  if (!c.isConfirmed) return;
  try {
    await callBackend('ADMIN_UPDATE_REG', { adminId: currentUser.userId, regId, action });
    Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'อัปเดตสำเร็จ', showConfirmButton: false, timer: 1500 });
    window.loadAdminData();
  } catch(err: any) { Swal.fire('Error', err.message, 'error'); }
};

document.getElementById('admin-search')?.addEventListener('input', (e) => {
  adminSearch = (e.target as HTMLInputElement).value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { adminPage = 1; window.loadAdminData(); }, 500);
});

document.getElementById('btn-prev-page')?.addEventListener('click', () => { if(adminPage > 1) { adminPage--; window.loadAdminData(); } });
document.getElementById('btn-next-page')?.addEventListener('click', () => { adminPage++; window.loadAdminData(); });

document.addEventListener('DOMContentLoaded', initializeApp);
