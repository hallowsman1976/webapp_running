import { Store } from '../store';
import { callApi } from '../api';

export function renderApp() {
  const appDiv = document.getElementById('app');
  if (!appDiv) return;

  appDiv.innerHTML = Store.currentPage === 'pdpa' || Store.currentPage === 'loading' ? '' : `
    <div class="bg-blue-600 text-white p-4 flex justify-between items-center shadow-md sticky top-0 z-10">
      <h1 class="text-lg font-bold">Runner Event</h1>
      <div class="flex gap-2 text-sm">
        <button id="nav-events" class="${Store.currentPage === 'events' ? 'underline' : ''}">งานวิ่ง</button>
        <button id="nav-mycards" class="${Store.currentPage === 'mycards' ? 'underline' : ''}">ตั๋วฉัน</button>
      </div>
    </div>
  `;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'p-4';

  if (Store.currentPage === 'loading') contentDiv.innerHTML = `<p class="text-center mt-10">กำลังโหลด...</p>`;
  else if (Store.currentPage === 'pdpa') contentDiv.appendChild(renderPDPA());
  else if (Store.currentPage === 'events') contentDiv.appendChild(renderEvents());
  else if (Store.currentPage === 'mycards') contentDiv.appendChild(renderMyCards());

  appDiv.appendChild(contentDiv);

  document.getElementById('nav-events')?.addEventListener('click', async () => {
    Store.currentPage = 'events'; if(Store.events.length===0) Store.events = await callApi('getEvents'); renderApp();
  });
  document.getElementById('nav-mycards')?.addEventListener('click', async () => {
    Store.currentPage = 'mycards'; Store.myCards = await callApi('getMyCards', { userId: Store.user.userId }); renderApp();
  });
}

function renderPDPA() {
  const div = document.createElement('div');
  div.innerHTML = `
    <h2 class="text-xl font-bold mb-4">นโยบายความเป็นส่วนตัว</h2>
    <div class="bg-gray-50 p-4 border h-64 overflow-y-auto text-sm mb-4">ยินยอมให้เก็บข้อมูล...</div>
    <button id="btn-accept" class="w-full bg-blue-600 text-white p-3 rounded font-bold mb-2">ยอมรับ</button>
  `;
  div.querySelector('#btn-accept')?.addEventListener('click', async () => {
    await callApi('saveConsent', { userId: Store.user.userId, isAccepted: true });
    Store.user.needConsent = false; Store.currentPage = 'events'; 
    Store.events = await callApi('getEvents'); renderApp();
  });
  return div;
}

function renderEvents() {
  const div = document.createElement('div');
  div.innerHTML = `<h2 class="text-xl font-bold mb-4">งานวิ่งที่เปิดรับ</h2>`;
  Store.events.forEach(e => {
    let opts = e.distances.map((d:any) => `<option value="${d.distanceId}">${d.distanceName} (${d.price}B)</option>`).join('');
    div.innerHTML += `
      <div class="bg-white rounded-lg shadow-md mb-6 border">
        <img src="${e.coverImage}" class="w-full h-40 object-cover" />
        <div class="p-4">
          <h3 class="font-bold text-lg">${e.name}</h3>
          <select id="dist-${e.eventId}" class="w-full p-2 border rounded mt-2"><option value="">เลือกระยะ...</option>${opts}</select>
          <button class="w-full bg-green-500 text-white p-2 rounded mt-4 btn-reg" data-eid="${e.eventId}">สมัครทันที</button>
        </div>
      </div>
    `;
  });

  setTimeout(() => div.querySelectorAll('.btn-reg').forEach(btn => btn.addEventListener('click', async (e) => {
    const eid = (e.currentTarget as HTMLElement).getAttribute('data-eid');
    const did = (document.getElementById(`dist-${eid}`) as HTMLSelectElement).value;
    if(!did) return alert('เลือกระยะทางด้วยครับ');
    await callApi('registerEvent', { eventId: eid, distanceId: did, userId: Store.user.userId });
    alert('สมัครสำเร็จ รออนุมัติ!'); document.getElementById('nav-mycards')?.click();
  })), 100);
  return div;
}

function renderMyCards() {
  const div = document.createElement('div');
  div.innerHTML = `<h2 class="text-xl font-bold mb-4">ตั๋ววิ่งของฉัน</h2>`;
  Store.myCards.forEach((reg, i) => {
    const event = Store.events.find((e:any) => e.eventId === reg.eventId) || {};
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(JSON.stringify({r:reg.regId, e:reg.eventId, u:reg.userId}))}`;
    const isAppr = reg.status === "APPROVED";
    
    div.innerHTML += `
      <div class="bg-white rounded shadow border mb-4 p-4 relative">
        <span class="absolute top-2 right-2 px-2 py-1 text-xs text-white rounded ${isAppr ? 'bg-green-500' : 'bg-yellow-500'}">${reg.status}</span>
        <h3 class="font-bold">${event.name}</h3><p class="text-sm text-gray-500">Ref: ${reg.regId}</p>
        <div class="bg-gray-100 p-3 mt-3 flex justify-between rounded items-center">
          <div><p class="text-xs">BIB NUMBER</p><p class="text-2xl font-black text-blue-600">${reg.bibNumber || 'WAITING'}</p></div>
          ${isAppr ? `<img src="${qrUrl}" class="w-16 h-16"/>` : ''}
        </div>
        ${isAppr ? `<button class="w-full mt-3 bg-[#06C755] text-white p-2 rounded btn-share" data-i="${i}">อวดเพื่อน (Share)</button>` : ''}
      </div>
    `;
  });

  setTimeout(() => div.querySelectorAll('.btn-share').forEach(b => b.addEventListener('click', async (e) => {
    const idx = parseInt((e.currentTarget as HTMLElement).getAttribute('data-i')!);
    const reg = Store.myCards[idx];
    const ev = Store.events.find((ev:any) => ev.eventId === reg.eventId) || {};
    await window.liff.shareTargetPicker([{
      type: "flex", altText: "ฉันได้ BIB แล้ว!", contents: {
        type: "bubble", hero: { type: "image", url: ev.coverImage, size: "full", aspectRatio: "20:13", aspectMode: "cover" },
        body: { type: "box", layout: "vertical", contents: [
          { type: "text", text: ev.name, weight: "bold", size: "xl" },
          { type: "text", text: `BIB: ${reg.bibNumber}`, size: "lg", color: "#06C755", weight: "bold" }
        ]}
      }
    }]);
  })), 100);
  return div;
}
