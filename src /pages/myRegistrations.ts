// src/pages/myRegistrations.ts

import { Store } from '../store';
import { Api } from '../api';
import { renderInlineSpinner } from '../components/spinner';
import { DateHelper } from '../utils/dateHelper';
import { Toast } from '../components/toast';
import type { Registration } from '../types';

export async function renderMyRegistrations(): Promise<void> {
  const app = document.getElementById('app')!;
  const state = Store.getState();

  app.innerHTML = `
    <div class="min-h-screen bg-gray-50 pb-8">
      <div class="bg-runner-primary h-14 flex items-center px-4 sticky top-0 z-40">
        <button id="btn-back" class="text-white/80 p-2 -ml-2 active:scale-90 transition-transform">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 class="text-white font-semibold text-base ml-2">บัตรของฉัน</h1>
      </div>
      <div id="my-regs-content" class="px-4 pt-5">
        ${renderInlineSpinner()}
      </div>
    </div>`;

  document.getElementById('btn-back')!.addEventListener('click', () => {
    Store.goBack();
    window.dispatchEvent(new CustomEvent('route-change'));
  });

  try {
    const userId = state.user?.userId || state.liffProfile?.userId;
    if (!userId) throw new Error('ไม่พบข้อมูลผู้ใช้');

    const res = await Api.getMyRegistrations(userId);
    if (!res.success) throw new Error(res.error);

    const regs = (res.data as Registration[]) || [];
    renderList(regs);

  } catch (err) {
    document.getElementById('my-regs-content')!.innerHTML = `
      <div class="text-center py-20">
        <span class="text-5xl block mb-4">😕</span>
        <p class="text-gray-500">${(err as Error).message}</p>
      </div>`;
    Toast.error('โหลดรายการไม่สำเร็จ');
  }
}

function renderList(regs: Registration[]): void {
  const content = document.getElementById('my-regs-content')!;

  if (!regs.length) {
    content.innerHTML = `
      <div class="text-center py-20">
        <span class="text-6xl block mb-4">🎫</span>
        <p class="text-gray-500 font-medium">ยังไม่มีการสมัครงานวิ่ง</p>
        <button id="btn-go-events"
          class="mt-4 px-6 py-2.5 bg-runner-secondary text-white
                 rounded-full text-sm font-medium active:scale-95 transition-transform">
          ดูงานวิ่งทั้งหมด
        </button>
      </div>`;
    document.getElementById('btn-go-events')?.addEventListener('click', () => {
      Store.setRoute('events');
      window.dispatchEvent(new CustomEvent('route-change'));
    });
    return;
  }

  const STATUS_CONFIG: Record<string, { color: string; text: string }> = {
    pending:  { color: 'text-yellow-600 bg-yellow-50', text: '⏳ รอการอนุมัติ' },
    approved: { color: 'text-green-600 bg-green-50',  text: '✅ อนุมัติแล้ว' },
    rejected: { color: 'text-red-600 bg-red-50',      text: '❌ ไม่ผ่าน' },
    cancelled:{ color: 'text-gray-500 bg-gray-50',    text: '🚫 ยกเลิก' }
  };

  content.innerHTML = `
    <p class="text-xs text-gray-400 mb-4 font-medium">${regs.length} รายการ</p>
    <div class="space-y-3">
      ${regs.map(reg => {
        const s = STATUS_CONFIG[reg.status] || STATUS_CONFIG.pending;
        const ev = reg.event;
        return `
          <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100
                      cursor-pointer active:scale-[0.98] transition-transform reg-card"
               data-reg-id="${reg.registrationId}">
            <div class="flex gap-3">
              <div class="w-14 h-14 rounded-xl overflow-hidden bg-runner-primary shrink-0">
                ${ev?.coverImageUrl
                  ? `<img src="${ev.coverImageUrl}" class="w-full h-full object-cover" />`
                  : `<div class="w-full h-full flex items-center justify-center text-2xl">🏃</div>`}
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-bold text-runner-primary text-sm truncate">
                  ${ev?.eventName || 'งานวิ่ง'}
                </p>
                <p class="text-xs text-gray-400 mt-0.5">
                  ${ev ? DateHelper.formatThai(ev.eventDate) : ''}
                </p>
                <div class="flex items-center gap-2 mt-2">
                  <span class="font-bold text-runner-secondary text-sm">${reg.bibNumber}</span>
                  <span class="text-xs text-gray-400">•</span>
                  <span class="text-xs text-gray-500">${reg.distance?.distanceName || ''}</span>
                </div>
              </div>
              <div class="shrink-0 flex flex-col items-end gap-2">
                <span class="px-2 py-1 rounded-full text-xs font-semibold ${s.color}">
                  ${s.text}
                </span>
                ${reg.checkinStatus === 'checked'
                  ? '<span class="text-xs text-green-500 font-medium">เช็คอินแล้ว ✅</span>'
                  : ''}
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>`;

  // Bind clicks
  document.querySelectorAll('.reg-card').forEach(card => {
    card.addEventListener('click', () => {
      const regId = (card as HTMLElement).dataset.regId!;
      Store.setRoute('bib-card', { registrationId: regId });
      window.dispatchEvent(new CustomEvent('route-change'));
    });
  });
}
