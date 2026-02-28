// src/components/eventCard.ts

import type { Event, EventDistance } from '../types';
import { DateHelper } from '../utils/dateHelper';

export function renderEventCard(event: Event, distances: EventDistance[] = []): string {
  const isOpen = DateHelper.isRegistrationOpen(event.registrationOpenAt, event.registrationCloseAt);
  const daysLeft = DateHelper.daysUntil(event.registrationCloseAt);
  const minPrice = distances.length
    ? Math.min(...distances.map(d => Number(d.price)))
    : 0;

  const distanceTags = distances.slice(0, 4).map(d => `
    <span class="px-2 py-1 bg-blue-50 text-runner-secondary
                 text-xs rounded-full font-medium">
      ${d.distanceName}
    </span>`).join('');

  const statusBadge = isOpen
    ? `<span class="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-semibold">
         🟢 เปิดรับสมัคร
       </span>`
    : `<span class="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full font-semibold">
         ⏸ ปิดรับสมัคร
       </span>`;

  const urgencyBadge = isOpen && daysLeft <= 7 && daysLeft > 0
    ? `<span class="px-2 py-1 bg-orange-100 text-orange-600 text-xs rounded-full font-semibold">
         ⚡ ปิดใน ${daysLeft} วัน
       </span>`
    : '';

  return `
    <div class="event-card bg-white rounded-2xl overflow-hidden shadow-sm
                border border-gray-100 active:scale-[0.98] transition-transform
                cursor-pointer mb-4"
         data-event-id="${event.eventId}">

      <!-- Cover Image -->
      <div class="relative h-44 bg-gradient-to-br from-runner-primary to-runner-secondary overflow-hidden">
        ${event.coverImageUrl
          ? `<img src="${event.coverImageUrl}" alt="${event.eventName}"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  onerror="this.style.display='none'" />`
          : `<div class="w-full h-full flex items-center justify-center">
               <span class="text-5xl">🏃</span>
             </div>`}

        <!-- Overlay badges -->
        <div class="absolute top-3 left-3 flex gap-2">
          ${statusBadge}
          ${urgencyBadge}
        </div>

        <!-- Date badge -->
        <div class="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm
                    rounded-xl px-3 py-1.5 text-white text-xs font-medium">
          📅 ${DateHelper.formatThai(event.eventDate)}
        </div>
      </div>

      <!-- Content -->
      <div class="p-4">
        <h3 class="font-bold text-runner-primary text-base leading-snug mb-1 line-clamp-2">
          ${event.eventName}
        </h3>
        <p class="text-sm text-gray-500 mb-3 flex items-center gap-1">
          <span>📍</span>
          <span class="line-clamp-1">${event.eventLocation}</span>
        </p>

        <!-- Distances -->
        <div class="flex flex-wrap gap-1.5 mb-3">
          ${distanceTags}
          ${distances.length > 4
            ? `<span class="text-xs text-gray-400">+${distances.length - 4} อื่นๆ</span>`
            : ''}
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between pt-3 border-t border-gray-50">
          <span class="text-xs text-gray-400">
            เริ่มต้น
            <span class="text-runner-accent font-bold text-sm ml-1">
              ${minPrice > 0 ? `฿${minPrice.toLocaleString()}` : 'ฟรี'}
            </span>
          </span>
          <span class="text-runner-secondary text-sm font-semibold flex items-center gap-1">
            ดูรายละเอียด
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </span>
        </div>
      </div>
    </div>`;
}
