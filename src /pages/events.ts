// src/pages/events.ts
// Event List Page

import { Store } from '../store';
import { Api } from '../api';
import { renderEventCard } from '../components/eventCard';
import { renderInlineSpinner } from '../components/spinner';
import { Toast } from '../components/toast';
import type { Event, EventDistance } from '../types';

interface EventWithDistances { event: Event; distances: EventDistance[]; }

export async function renderEvents(): Promise<void> {
  const app = document.getElementById('app')!;
  const state = Store.getState();

  app.innerHTML = `
    <div class="min-h-screen bg-gray-50 pb-24">

      <!-- Header -->
      <div class="bg-runner-primary sticky top-0 z-40 px-5 pt-safe-top pb-4 shadow-lg">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-white font-bold text-xl">งานวิ่ง</h1>
            <p class="text-white/60 text-xs">สมัครได้เลย</p>
          </div>
          <button id="btn-my-regs"
            class="flex items-center gap-2 bg-white/10 backdrop-blur-sm
                   text-white text-sm px-4 py-2 rounded-full active:bg-white/20 transition-colors">
            <span>🎫</span>
            <span>บัตรของฉัน</span>
          </button>
        </div>

        <!-- Profile strip -->
        <div class="flex items-center gap-3 bg-white/10 rounded-2xl px-4 py-3">
          <img src="${state.liffProfile?.pictureUrl || '/placeholder.png'}"
               alt="profile"
               class="w-9 h-9 rounded-full object-cover ring-2 ring-white/30" />
          <div class="flex-1 min-w-0">
            <p class="text-white font-medium text-sm truncate">
              ${state.liffProfile?.displayName || 'ผู้ใช้'}
            </p>
            <p class="text-white/50 text-xs">LINE Runner App</p>
          </div>
          <span class="text-green-400 text-xs font-medium bg-green-400/20 px-2 py-1 rounded-full">
            Active
          </span>
        </div>
      </div>

      <!-- Event List -->
      <div class="px-4 pt-5">
        <div id="event-list">
          ${renderInlineSpinner()}
        </div>
      </div>
    </div>`;

  // Nav: my registrations
  document.getElementById('btn-my-regs')!.addEventListener('click', () => {
    Store.setRoute('my-registrations');
    window.dispatchEvent(new CustomEvent('route-change'));
  });

  // Load events
  await loadEvents();
}

async function loadEvents(): Promise<void> {
  const listEl = document.getElementById('event-list');
  if (!listEl) return;

  try {
    const res = await Api.listEvents();
    if (!res.success || !res.data) {
      listEl.innerHTML = renderEmpty();
      return;
    }

    const events = res.data as Event[];
    if (!events.length) {
      listEl.innerHTML = renderEmpty();
      return;
    }

    // Cache in store
    Store.setState({ events });

    // Load distances สำหรับทุก event (parallel)
    const eventDetails: EventWithDistances[] = await Promise.all(
      events.map(async ev => {
        try {
          const r = await Api.getEvent(ev.eventId);
          return { event: ev, distances: r.data?.distances || [] };
        } catch {
          return { event: ev, distances: [] };
        }
      })
    );

    listEl.innerHTML = `
      <p class="text-xs text-gray-400 mb-4 font-medium uppercase tracking-wide">
        ${events.length} งานวิ่ง
      </p>
      ${eventDetails.map(({ event, distances }) =>
        renderEventCard(event, distances)
      ).join('')}`;

    // Bind click events
    listEl.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('click', () => {
        const eventId = (card as HTMLElement).dataset.eventId!;
        Store.setRoute('event-detail', { eventId });
        window.dispatchEvent(new CustomEvent('route-change'));
      });
    });

  } catch (err) {
    listEl.innerHTML = renderError((err as Error).message);
    Toast.error('โหลดรายการงานไม่สำเร็จ');
  }
}

function renderEmpty(): string {
  return `
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <span class="text-6xl mb-4">🏁</span>
      <p class="text-gray-500 font-medium">ยังไม่มีงานวิ่งที่เปิดรับสมัคร</p>
      <p class="text-gray-400 text-sm mt-1">กลับมาเช็คใหม่เร็วๆ นี้</p>
    </div>`;
}

function renderError(msg: string): string {
  return `
    <div class="flex flex-col items-center justify-center py-16 text-center px-4">
      <span class="text-5xl mb-4">😕</span>
      <p class="text-gray-600 font-medium mb-1">โหลดไม่สำเร็จ</p>
      <p class="text-gray-400 text-xs mb-4">${msg}</p>
      <button onclick="window.location.reload()"
        class="px-6 py-2 bg-runner-secondary text-white rounded-full text-sm font-medium">
        ลองใหม่
      </button>
    </div>`;
}
