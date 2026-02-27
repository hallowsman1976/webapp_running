import { Store } from '../store';
import { callApi } from '../api';

const AdminState = { eventId: 'E-202601', page: 1, limit: 20, search: '', stats: { total:0, approved:0, present:0, absent:0 }, regs: { items: [], totalPages: 1 } };

export async function renderAdminApp() {
  const appDiv = document.getElementById('app')!;
  appDiv.innerHTML = `
    <div class="bg-gray-900 text-white p-4 flex justify-between items-center sticky top-0 z-20">
      <h1 class="font-bold">Admin Dashboard</h1>
      <button id="btn-scan" class="bg-[#06C755] px-3 py-1 rounded text-sm font-bold">📷 Scan QR</button>
    </div>
    <div id="admin-content" class="p-4 max-w-4xl mx-auto"></div>
  `;

  document.getElementById('btn-scan')?.addEventListener('click', async () => {
    sessionStorage.setItem('returnToAdmin', 'true');
    try {
      const res = await window.liff.scanCodeV2();
      if(res?.value) {
        const d = JSON.parse(res.value);
        if(confirm(`ยืนยัน Check-in: ${d.r}?`)) {
          await callApi('adminCheckin', { regId: d.r, eventId: d.e, userId: d.u, checkpointId: 'CP-01' });
          alert('Check-in สำเร็จ!'); loadAdminData();
        }
      }
    } catch(e) { /* user cancelled */ }
    sessionStorage.removeItem('returnToAdmin');
  });

  await loadAdminData();
}

async function loadAdminData() {
  const content = document.getElementById('admin-content')!;
  const [stats, regs] = await Promise.all([
    callApi('adminGetStats', { eventId: AdminState.eventId }),
    callApi('adminGetRegs', { eventId: AdminState.eventId, page: AdminState.page, limit: AdminState.limit, search: AdminState.search })
  ]);
  AdminState.stats = stats; AdminState.regs = regs;

  content.innerHTML = `
    <div class="grid grid-cols-4 gap-2 mb-4 text-center text-sm">
      <div class="bg-blue-100 p-2 rounded">Total<br><b class="text-lg">${stats.total}</b></div>
      <div class="bg-yellow-100 p-2 rounded">Appr<br><b class="text-lg">${stats.approved}</b></div>
      <div class="bg-green-100 p-2 rounded">In<br><b class="text-lg">${stats.present}</b></div>
      <div class="bg-red-100 p-2 rounded">Out<br><b class="text-lg">${stats.absent}</b></div>
    </div>
    <input type="text" id="a-search" placeholder="ค้นหา..." class="p-2 border rounded w-full mb-4" value="${AdminState.search}">
    <div class="bg-white rounded shadow overflow-x-auto">
      <table class="w-full text-left text-sm"><tbody id="t-body"></tbody></table>
    </div>
  `;

  const tbody = document.getElementById('t-body')!;
  AdminState.regs.items.forEach((r:any) => {
    const isApp = r.status === 'APPROVED';
    tbody.innerHTML += `
      <tr class="border-b">
        <td class="p-2">${r.displayName}<br><span class="text-xs text-gray-500">${r.bibNumber||'-'}</span></td>
        <td class="p-2 text-right">
          ${isApp ? `<button class="bg-gray-200 px-2 py-1 rounded btn-print mr-1" data-bib="${r.bibNumber}" data-name="${r.displayName}" data-r="${r.regId}">🖨️</button>` : ''}
          ${!isApp ? `<button class="bg-blue-600 text-white px-2 py-1 rounded btn-appr" data-id="${r.regId}">อนุมัติ</button>` 
                   : `<button class="bg-gray-800 text-white px-2 py-1 rounded btn-chk" data-r="${r.regId}" data-u="${r.userId}">Check-in</button>`}
        </td>
      </tr>
    `;
  });

  document.getElementById('a-search')?.addEventListener('input', (e:any) => {
    setTimeout(() => { AdminState.search = e.target.value; AdminState.page = 1; loadAdminData(); }, 500);
  });

  document.querySelectorAll('.btn-appr').forEach(b => b.addEventListener('click', async (e) => {
    await callApi('adminApprove', { regId: (e.currentTarget as any).getAttribute('data-id'), adminId: Store.user.userId }); loadAdminData();
  }));
  document.querySelectorAll('.btn-chk').forEach(b => b.addEventListener('click', async (e) => {
    const t = e.currentTarget as any; await callApi('adminCheckin', { regId: t.getAttribute('data-r'), eventId: AdminState.eventId, userId: t.getAttribute('data-u'), checkpointId:'CP-01' }); loadAdminData();
  }));
  document.querySelectorAll('.btn-print').forEach(b => b.addEventListener('click', (e) => {
    const t = e.currentTarget as any;
    const pa = document.getElementById('print-area')!;
    pa.innerHTML = `<div style="width:80mm;height:50mm;padding:10px;text-align:center;border:1px solid #000;">
      <h2 style="font-size:12px;">RUNNER EVENT 2026</h2><h1 style="font-size:36px;margin:5px 0;">${t.getAttribute('data-bib')}</h1>
      <p style="font-weight:bold;">${t.getAttribute('data-name')}</p><p style="font-size:10px;">Ref: ${t.getAttribute('data-r')}</p>
    </div>`;
    pa.classList.remove('hidden'); window.print(); setTimeout(() => pa.classList.add('hidden'), 1000);
  }));
}
