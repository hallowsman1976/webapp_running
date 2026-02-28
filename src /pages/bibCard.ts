// src/pages/bibCard.ts
// BIB Card / Runner Card Page

import { Store } from '../store';
import { Api } from '../api';
import { LiffHelper } from '../utils/liffHelper';
import { Toast } from '../components/toast';
import { renderInlineSpinner } from '../components/spinner';
import { DateHelper } from '../utils/dateHelper';
import type { Registration, Event, EventDistance } from '../types';

export async function renderBibCard(registrationId: string): Promise<void> {
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-runner-primary to-[#16213e]">
      <div class="flex items-center px-4 h-14">
        <button id="btn-back"
          class="text-white/80 p-2 -ml-2 active:scale-90 transition-transform">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 class="text-white font-semibold text-base ml-2">BIB Card</h1>
        <button id="btn-refresh"
          class="ml-auto text-white/70 p-2 active:scale-90 transition-transform">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>
      <div id="bib-content" class="px-4 pb-8">
        ${renderInlineSpinner()}
      </div>
    </div>`;

  document.getElementById('btn-back')!.addEventListener('click', () => {
    Store.goBack();
    window.dispatchEvent(new CustomEvent('route-change'));
  });

  document.getElementById('btn-refresh')!.addEventListener('click', () => {
    loadBibCard(registrationId);
  });

  await loadBibCard(registrationId);
}

async function loadBibCard(registrationId: string): Promise<void> {
  const content = document.getElementById('bib-content');
  if (!content) return;

  try {
    const res = await Api.getRegistration(registrationId);
    if (!res.success || !res.data) throw new Error(res.error || 'ไม่พบข้อมูล');

    const { registration, event, distance } = res.data as {
      registration: Registration;
      event: Event;
      distance: EventDistance;
    };

    content.innerHTML = renderCard(registration, event, distance);
    bindActions(registration, event, distance);

  } catch (err) {
    content.innerHTML = `
      <div class="text-center py-20">
        <span class="text-5xl block mb-4">😕</span>
        <p class="text-white/60">${(err as Error).message}</p>
      </div>`;
    Toast.error('โหลด BIB Card ไม่สำเร็จ');
  }
}

function renderCard(reg: Registration, event: Event, distance: EventDistance): string {
  const isChecked = reg.checkinStatus === 'checked';
  const statusColor = isChecked ? 'text-green-400' : 'text-orange-400';
  const statusBg    = isChecked ? 'bg-green-400/20 border-green-400/30' : 'bg-orange-400/20 border-orange-400/30';
  const statusText  = isChecked ? '✅ เช็คอินแล้ว' : '⏳ ยังไม่เช็คอิน';

  const approvalBadge = reg.status === 'approved'
    ? `<span class="px-3 py-1 bg-green-400/20 text-green-400 text-xs rounded-full font-semibold border border-green-400/30">
         ✅ อนุมัติแล้ว
       </span>`
    : reg.status === 'pending'
    ? `<span class="px-3 py-1 bg-yellow-400/20 text-yellow-400 text-xs rounded-full font-semibold border border-yellow-400/30">
         ⏳ รอการอนุมัติ
       </span>`
    : `<span class="px-3 py-1 bg-red-400/20 text-red-400 text-xs rounded-full font-semibold border border-red-400/30">
         ❌ ${reg.status}
       </span>`;

  return `
    <!-- BIB Card -->
    <div id="bib-card-visual"
         class="bg-white rounded-3xl overflow-hidden shadow-2xl shadow-black/30 mb-6 mt-2">

      <!-- Cover Image -->
      <div class="relative h-40 bg-gradient-to-br from-runner-primary to-runner-secondary">
        ${event.coverImageUrl
          ? `<img src="${event.coverImageUrl}" alt="${event.eventName}"
                  class="w-full h-full object-cover" />`
          : `<div class="w-full h-full flex items-center justify-center">
               <span class="text-6xl">🏃</span>
             </div>`}
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        <div class="absolute bottom-3 left-4 right-4">
          <p class="text-white font-bold text-base leading-snug line-clamp-2">
            ${event.eventName}
          </p>
          <p class="text-white/70 text-xs mt-0.5">
            📅 ${DateHelper.formatThai(event.eventDate)} • 📍 ${event.eventLocation}
          </p>
        </div>
      </div>

      <!-- BIB Number (Highlight) -->
      <div class="bg-runner-primary px-6 py-5 flex items-center justify-between">
        <div>
          <p class="text-white/50 text-xs font-medium uppercase tracking-widest">BIB NUMBER</p>
          <p class="text-white font-black text-5xl tracking-wider mt-1">${reg.bibNumber}</p>
          <p class="text-runner-secondary font-semibold text-base mt-1">${distance.distanceName}</p>
        </div>
        <!-- Profile Photo -->
        <div class="text-right">
          <img src="${Store.getState().liffProfile?.pictureUrl || ''}"
               alt="profile"
               class="w-20 h-20 rounded-2xl object-cover ring-4 ring-white/20 ml-auto" />
        </div>
      </div>

      <!-- Runner Info -->
      <div class="px-5 py-4 space-y-3">
        <div class="grid grid-cols-2 gap-3">
          ${[
            ['ชื่อ-นามสกุล', `${reg.firstName} ${reg.lastName}`],
            ['เบอร์เสื้อ', reg.shirtSize],
            ['เพศ', reg.gender === 'M' ? 'ชาย' : reg.gender === 'F' ? 'หญิง' : 'อื่นๆ'],
            ['วันเกิด', DateHelper.formatThai(reg.birthDate)]
          ].map(([label, value]) => `
            <div>
              <p class="text-xs text-gray-400">${label}</p>
              <p class="font-semibold text-runner-primary text-sm">${value}</p>
            </div>`).join('')}
        </div>

        <!-- Status badges -->
        <div class="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
          ${approvalBadge}
          <span class="px-3 py-1 ${statusBg} ${statusColor} text-xs rounded-full
                       font-semibold border">
            ${statusText}
          </span>
        </div>

        ${isChecked ? `
          <div class="text-center text-xs text-gray-400">
            เช็คอินเมื่อ ${DateHelper.formatThaiDateTime(reg.checkinAt)}
          </div>` : ''}
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="space-y-3">
      <button id="btn-share"
        class="w-full py-4 bg-line-green text-white font-bold rounded-2xl
               text-base shadow-lg shadow-green-900/30 active:scale-95 transition-transform
               flex items-center justify-center gap-2">
        <span class="text-xl">📤</span>
        แชร์บัตรผ่าน LINE
      </button>

      ${reg.status === 'approved' ? `
        <button id="btn-checkin-qr"
          class="w-full py-4 bg-runner-secondary text-white font-bold rounded-2xl
                 text-base shadow-md shadow-blue-900/30 active:scale-95 transition-transform
                 flex items-center justify-center gap-2">
          <span class="text-xl">📷</span>
          สแกน QR เช็คอิน
        </button>` : ''}

      <button id="btn-my-regs"
        class="w-full py-3 border-2 border-white/20 text-white/80 font-medium
               rounded-2xl text-sm active:scale-95 transition-transform">
        📋 รายการสมัครทั้งหมด
      </button>
    </div>`;
}

function bindActions(reg: Registration, event: Event, distance: EventDistance): void {
  // Share Flex Message
  document.getElementById('btn-share')?.addEventListener('click', async () => {
    const flex = buildBibFlex(reg, event, distance);
    const success = await LiffHelper.shareFlexMessage(
      `BIB Card: ${reg.bibNumber} — ${event.eventName}`,
      flex
    );
    if (success) Toast.success('แชร์บัตรสำเร็จ!');
    else Toast.warning('ไม่สามารถแชร์ได้ในขณะนี้');
  });

  // QR Checkin
  document.getElementById('btn-checkin-qr')?.addEventListener('click', () => {
    Store.setRoute('checkin', { registrationId: reg.registrationId });
    window.dispatchEvent(new CustomEvent('route-change'));
  });

  // My registrations
  document.getElementById('btn-my-regs')?.addEventListener('click', () => {
    Store.setRoute('my-registrations');
    window.dispatchEvent(new CustomEvent('route-change'));
  });
}

function buildBibFlex(reg: Registration, event: Event, distance: EventDistance): object {
  const isChecked = reg.checkinStatus === 'checked';
  return {
    type: 'bubble',
    size: 'mega',
    hero: {
      type: 'image',
      url: event.coverImageUrl || 'https://via.placeholder.com/800x400?text=Runner',
      size: 'full', aspectRatio: '20:13', aspectMode: 'cover'
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'md',
      contents: [
        { type: 'text', text: event.eventName, weight: 'bold', size: 'lg', wrap: true },
        { type: 'text', text: `📅 ${DateHelper.formatThai(event.eventDate)}`, size: 'sm', color: '#666' },
        { type: 'separator', margin: 'md' },
        { type: 'text', text: 'BIB NUMBER', size: 'xs', color: '#999', margin: 'md' },
        { type: 'text', text: reg.bibNumber, size: 'xxl', weight: 'bold', color: '#1a1a2e' },
        { type: 'text', text: distance.distanceName, size: 'sm', color: '#4A90D9' },
        { type: 'separator', margin: 'md' },
        { type: 'text', text: `${reg.firstName} ${reg.lastName}`, weight: 'bold', size: 'md' },
        {
          type: 'text',
          text: isChecked ? '✅ เช็คอินแล้ว' : '⏳ ยังไม่เช็คอิน',
          size: 'sm',
          color: isChecked ? '#00C851' : '#FF8800',
          weight: 'bold', margin: 'sm'
        }
      ]
    }
  };
}
