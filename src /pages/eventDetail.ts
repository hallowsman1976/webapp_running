// src/pages/eventDetail.ts

import { Store } from '../store';
import { Api } from '../api';
import { Toast } from '../components/toast';
import { renderInlineSpinner } from '../components/spinner';
import { DateHelper } from '../utils/dateHelper';
import type { Event, EventDistance } from '../types';

export async function renderEventDetail(eventId: string): Promise<void> {
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <div class="min-h-screen bg-gray-50">
      <!-- Back button + header placeholder -->
      <div class="bg-runner-primary h-14 flex items-center px-4 sticky top-0 z-40">
        <button id="btn-back"
          class="text-white/80 hover:text-white p-2 -ml-2 active:scale-90 transition-transform">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 class="text-white font-semibold text-base ml-2">รายละเอียดงาน</h1>
      </div>
      <div id="event-detail-content">${renderInlineSpinner()}</div>
    </div>`;

  document.getElementById('btn-back')!.addEventListener('click', () => {
    Store.goBack();
    window.dispatchEvent(new CustomEvent('route-change'));
  });

  try {
    const res = await Api.getEvent(eventId);
    if (!res.success || !res.data) throw new Error(res.error || 'ไม่พบงานวิ่ง');

    const { event, distances } = res.data;
    renderDetail(event, distances);

  } catch (err) {
    document.getElementById('event-detail-content')!.innerHTML = `
      <div class="flex flex-col items-center justify-center py-20 text-center px-6">
        <span class="text-5xl mb-4">😕</span>
        <p class="text-red-500 font-medium">${(err as Error).message}</p>
      </div>`;
    Toast.error('โหลดรายละเอียดไม่สำเร็จ');
  }
}

function renderDetail(event: Event, distances: EventDistance[]): void {
  const isOpen = DateHelper.isRegistrationOpen(event.registrationOpenAt, event.registrationCloseAt);

  document.getElementById('event-detail-content')!.innerHTML = `
    <!-- Cover -->
    <div class="relative h-56 bg-gradient-to-br from-runner-primary to-runner-secondary">
      ${event.coverImageUrl
        ? `<img src="${event.coverImageUrl}" alt="${event.eventName}"
                class="w-full h-full object-cover" />`
        : `<div class="w-full h-full flex items-center justify-center">
             <span class="text-7xl">🏃</span>
           </div>`}
      <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
    </div>

    <div class="px-5 py-6 space-y-6">

      <!-- Title + Status -->
      <div>
        <div class="flex items-start justify-between gap-3 mb-3">
          <h2 class="text-runner-primary font-bold text-xl leading-snug flex-1">
            ${event.eventName}
          </h2>
          <span class="shrink-0 px-3 py-1 rounded-full text-xs font-semibold
            ${isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
            ${isOpen ? '🟢 เปิด' : '⏸ ปิด'}
          </span>
        </div>

        <!-- Info rows -->
        <div class="space-y-2.5">
          ${[
            ['📅', 'วันที่จัด', DateHelper.formatThai(event.eventDate)],
            ['📍', 'สถานที่', event.eventLocation],
            ['🗓️', 'เปิดรับสมัคร', DateHelper.formatThaiDateTime(event.registrationOpenAt)],
            ['⏰', 'ปิดรับสมัคร', DateHelper.formatThaiDateTime(event.registrationCloseAt)],
            ['👥', 'จำนวนรับ', `${event.maxParticipants.toLocaleString()} คน`]
          ].map(([icon, label, value]) => `
            <div class="flex items-start gap-3">
              <span class="text-base w-6">${icon}</span>
              <div class="flex-1">
                <span class="text-xs text-gray-400">${label}</span>
                <p class="text-sm text-runner-primary font-medium">${value}</p>
              </div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Description -->
      ${event.description ? `
        <div class="bg-gray-50 rounded-2xl p-4">
          <h3 class="font-semibold text-runner-primary text-sm mb-2">รายละเอียด</h3>
          <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
            ${event.description}
          </p>
        </div>` : ''}

      <!-- Distances -->
      <div>
        <h3 class="font-bold text-runner-primary mb-3">เลือกระยะทาง</h3>
        <div class="space-y-3" id="distances-list">
          ${distances.map(d => renderDistanceCard(d, event, isOpen)).join('')}
        </div>
      </div>

      ${event.requireApproval ? `
        <div class="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex gap-3">
          <span class="text-xl">⚠️</span>
          <p class="text-sm text-orange-700">
            งานนี้ต้องรอการอนุมัติจากผู้จัดงานก่อน
            จึงจะได้รับสถานะ "อนุมัติแล้ว"
          </p>
        </div>` : ''}
    </div>`;

  // Bind distance selection
  document.querySelectorAll('.btn-register').forEach(btn => {
    btn.addEventListener('click', () => {
      const distanceId = (btn as HTMLElement).dataset.distanceId!;
      const eventId    = (btn as HTMLElement).dataset.eventId!;
      Store.setRoute('register', { eventId, distanceId });
      window.dispatchEvent(new CustomEvent('route-change'));
    });
  });
}

function renderDistanceCard(d: EventDistance, event: Event, isOpen: boolean): string {
  const remaining = Math.max(0, Number(d.quota) - Number(d.registeredCount));
  const isFull    = remaining === 0;
  const canRegister = isOpen && !isFull && d.status === 'active';

  return `
    <div class="bg-white rounded-2xl border ${isFull ? 'border-gray-100 opacity-60' : 'border-blue-100'}
                p-4 flex items-center gap-4">
      <div class="w-16 h-16 rounded-xl bg-blue-50 flex flex-col items-center justify-center shrink-0">
        <span class="text-lg font-bold text-runner-secondary">${d.distanceName}</span>
        <span class="text-xs text-gray-400">${d.distanceKm} km</span>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="font-bold text-runner-primary text-sm">${d.distanceName}</span>
          ${isFull ? '<span class="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">เต็มแล้ว</span>' : ''}
        </div>
        <p class="text-runner-accent font-bold text-base">
          ${Number(d.price) > 0 ? `฿${Number(d.price).toLocaleString()}` : 'ฟรี'}
        </p>
        <div class="mt-1 flex items-center gap-2">
          <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div class="h-full bg-runner-secondary rounded-full transition-all"
                 style="width:${Math.min(100, (Number(d.registeredCount)/Number(d.quota))*100)}%">
            </div>
          </div>
          <span class="text-xs text-gray-400 shrink-0">เหลือ ${remaining}</span>
        </div>
      </div>

      <button
        class="btn-register shrink-0 px-4 py-2.5 rounded-xl font-semibold text-sm
               transition-transform active:scale-95
               ${canRegister
                 ? 'bg-runner-secondary text-white shadow-md shadow-blue-200'
                 : 'bg-gray-100 text-gray-400 cursor-not-allowed'}"
        data-event-id="${event.eventId}"
        data-distance-id="${d.distanceId}"
        ${!canRegister ? 'disabled' : ''}>
        ${isFull ? 'เต็ม' : isOpen ? 'สมัคร' : 'ปิด'}
      </button>
    </div>`;
}
