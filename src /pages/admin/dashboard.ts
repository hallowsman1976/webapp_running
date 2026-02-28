// src/pages/admin/dashboard.ts
// Real-time Dashboard with polling

import { Api } from '../../api';
import { Store } from '../../store';
import { Toast } from '../../components/toast';
import { DateHelper } from '../../utils/dateHelper';
import { CONFIG } from '../../config';
import type { DashboardStats, Event } from '../../types';

let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _currentEventId = '';

export async function renderDashboard(
  container: HTMLElement,
  params: Record<string, string>
): Promise<void> {
  // Stop previous polling
  stopPolling();

  // Load events for selector
  container.innerHTML = renderDashboardShell();

  try {
    const evRes = await Api.listAdminEvents();
    if (!evRes.success) throw new Error(evRes.error);

    const events = (evRes.data as Event[]) || [];
    if (!events.length) {
      container.innerHTML = renderNoEvents();
      return;
    }

    // Populate event selector
    const selector = document.getElementById('event-selector') as HTMLSelectElement;
    events.forEach(ev => {
      const opt = document.createElement('option');
      opt.value = ev.eventId;
      opt.textContent = `${ev.eventName} — ${DateHelper.formatThai(ev.eventDate)}`;
      selector.appendChild(opt);
    });

    // Select from params or first event
    _currentEventId = params.eventId || events[0].eventId;
    selector.value = _currentEventId;

    selector.addEventListener('change', () => {
      _currentEventId = selector.value;
      loadStats(_currentEventId);
    });

    await loadStats(_currentEventId);
    startPolling();

  } catch (err) {
    Toast.error(`โหลดข้อมูลไม่สำเร็จ: ${(err as Error).message}`);
  }
}

function renderDashboardShell(): string {
  return `
    <div class="space-y-5 pb-20 md:pb-5">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-bold text-runner-primary">📊 ภาพรวม</h2>
        <div class="flex items-center gap-2">
          <div id="poll-indicator"
               class="w-2.5 h-2.5 rounded-full bg-gray-300 transition-colors"
               title="สถานะอัปเดต">
          </div>
          <span class="text-xs text-gray-400" id="last-updated">—</span>
        </div>
      </div>

      <!-- Event Selector -->
      <select id="event-selector"
        class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-2xl text-sm
               font-medium text-runner-primary focus:border-runner-secondary focus:outline-none">
        <option value="">— เลือกงานวิ่ง —</option>
      </select>

      <!-- Stats Cards -->
      <div id="stats-area">
        ${renderStatsLoading()}
      </div>
    </div>`;
}

async function loadStats(eventId: string): Promise<void> {
  if (!eventId) return;
  const area = document.getElementById('stats-area');
  if (!area) return;

  // Pulse indicator
  const indicator = document.getElementById('poll-indicator');
  if (indicator) indicator.className = 'w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse-fast';

  try {
    const res = await Api.getDashboard(eventId);
    if (!res.success || !res.data) throw new Error(res.error || 'ไม่มีข้อมูล');

    const data = res.data as DashboardStats;
    area.innerHTML = renderStats(data);
    bindDashboardActions(data);

    // Update timestamp
    const lastEl = document.getElementById('last-updated');
    if (lastEl) lastEl.textContent = `อัปเดต ${DateHelper.formatTime(new Date())}`;
    if (indicator) indicator.className = 'w-2.5 h-2.5 rounded-full bg-green-500';

  } catch (err) {
    if (indicator) indicator.className = 'w-2.5 h-2.5 rounded-full bg-red-400';
    console.error('[Dashboard]', err);
  }
}

function renderStats(data: DashboardStats): string {
  const { summary, byDistance, event } = data;
  const checkinPct = summary.checkinRate;

  return `
    <!-- Summary KPI Cards -->
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      ${[
        { label: 'สมัครทั้งหมด',  value: summary.totalRegistrations, icon: '📝', color: 'bg-blue-50 text-blue-700',   border: 'border-blue-200' },
        { label: 'รออนุมัติ',      value: summary.pending,            icon: '⏳', color: 'bg-yellow-50 text-yellow-700', border: 'border-yellow-200' },
        { label: 'อนุมัติแล้ว',    value: summary.approved,           icon: '✅', color: 'bg-green-50 text-green-700',  border: 'border-green-200' },
        { label: 'เช็คอินแล้ว',    value: summary.checkedIn,          icon: '🏃', color: 'bg-purple-50 text-purple-700', border: 'border-purple-200' },
      ].map(({ label, value, icon, color, border }) => `
        <div class="bg-white rounded-2xl p-4 border ${border} shadow-sm">
          <div class="flex items-center justify-between mb-2">
            <span class="text-2xl">${icon}</span>
            <span class="text-xs font-medium px-2 py-1 rounded-full ${color}">${label}</span>
          </div>
          <p class="text-3xl font-black text-runner-primary">${value.toLocaleString()}</p>
        </div>`).join('')}
    </div>

    <!-- Check-in Progress Bar -->
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-bold text-runner-primary text-sm">อัตราเช็คอิน</h3>
        <span class="text-2xl font-black
          ${checkinPct >= 80 ? 'text-green-500' : checkinPct >= 50 ? 'text-yellow-500' : 'text-red-500'}">
          ${checkinPct}%
        </span>
      </div>
      <div class="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-700
          ${checkinPct >= 80 ? 'bg-green-500' : checkinPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}"
          style="width:${checkinPct}%">
        </div>
      </div>
      <div class="flex justify-between mt-2 text-xs text-gray-400">
        <span>เช็คอิน ${summary.checkedIn} คน</span>
        <span>ไม่มา ${summary.absent} คน</span>
      </div>
    </div>

    <!-- By Distance Table -->
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 class="font-bold text-runner-primary text-sm">แยกตามระยะทาง</h3>
        <button id="btn-go-approve"
          class="text-xs text-runner-secondary font-semibold flex items-center gap-1">
          จัดการสมัคร →
        </button>
      </div>
      <div class="divide-y divide-gray-50">
        ${byDistance.map(d => {
          const pct = d.approved > 0
            ? Math.round((d.checked / d.approved) * 100) : 0;
          const quotaPct = d.quota > 0
            ? Math.round((d.total / d.quota) * 100) : 0;
          return `
            <div class="px-5 py-3">
              <div class="flex items-center justify-between mb-2">
                <div>
                  <span class="font-semibold text-runner-primary text-sm">${d.distanceName}</span>
                  <span class="text-xs text-gray-400 ml-2">quota ${d.quota}</span>
                </div>
                <div class="text-right text-xs">
                  <span class="text-gray-500">${d.checked}/${d.approved} เช็คอิน</span>
                  <span class="ml-2 font-bold
                    ${pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-yellow-500' : 'text-red-400'}">
                    ${pct}%
                  </span>
                </div>
              </div>
              <!-- Quota bar -->
              <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                <div class="h-full bg-runner-secondary/40 rounded-full"
                     style="width:${Math.min(100, quotaPct)}%"></div>
              </div>
              <!-- Checkin bar -->
              <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div class="h-full bg-green-400 rounded-full transition-all"
                     style="width:${pct}%"></div>
              </div>
              <div class="flex justify-between mt-1 text-xs text-gray-400">
                <span>สมัคร ${d.total} / อนุมัติ ${d.approved} / รอ ${d.pending}</span>
                <span>ไม่มา ${d.approved - d.checked}</span>
              </div>
            </div>`}).join('')}
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="grid grid-cols-2 gap-3">
      <button id="btn-quick-approve"
        class="bg-white rounded-2xl p-4 border border-yellow-200 shadow-sm
               flex items-center gap-3 active:scale-95 transition-transform">
        <span class="text-2xl">⚡</span>
        <div class="text-left">
          <p class="font-bold text-runner-primary text-sm">อนุมัติด่วน</p>
          <p class="text-xs text-yellow-600">${summary.pending} รอดำเนินการ</p>
        </div>
      </button>
      <button id="btn-quick-checkin"
        class="bg-white rounded-2xl p-4 border border-blue-200 shadow-sm
               flex items-center gap-3 active:scale-95 transition-transform">
        <span class="text-2xl">📷</span>
        <div class="text-left">
          <p class="font-bold text-runner-primary text-sm">สแกน QR</p>
          <p class="text-xs text-blue-600">เช็คอินทันที</p>
        </div>
      </button>
    </div>`;
}

function bindDashboardActions(data: DashboardStats): void {
  document.getElementById('btn-go-approve')?.addEventListener('click', () => {
    Store.setRoute('admin-registrations', { eventId: data.event.eventId, status: 'pending' });
    window.dispatchEvent(new CustomEvent('route-change'));
  });
  document.getElementById('btn-quick-approve')?.addEventListener('click', () => {
    Store.setRoute('admin-registrations', { eventId: data.event.eventId, status: 'pending' });
    window.dispatchEvent(new CustomEvent('route-change'));
  });
  document.getElementById('btn-quick-checkin')?.addEventListener('click', () => {
    Store.setRoute('admin-checkin', { eventId: data.event.eventId });
    window.dispatchEvent(new CustomEvent('route-change'));
  });
}

function renderStatsLoading(): string {
  return `
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      ${Array(4).fill(0).map(() => `
        <div class="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm animate-pulse">
          <div class="h-4 bg-gray-200 rounded mb-3 w-16"></div>
          <div class="h-8 bg-gray-200 rounded w-12"></div>
        </div>`).join('')}
    </div>`;
}

function renderNoEvents(): string {
  return `
    <div class="text-center py-20">
      <span class="text-5xl block mb-4">🏁</span>
      <p class="text-gray-500 font-medium">ยังไม่มีงานวิ่ง</p>
      <button id="btn-create-event"
        class="mt-4 px-6 py-2.5 bg-runner-secondary text-white rounded-full text-sm font-medium">
        สร้างงานวิ่งแรก
      </button>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Polling
// ─────────────────────────────────────────────────────────────
function startPolling(): void {
  stopPolling();
  _pollTimer = setInterval(() => {
    if (_currentEventId && document.getElementById('stats-area')) {
      loadStats(_currentEventId);
    } else {
      stopPolling();
    }
  }, CONFIG.DASHBOARD_POLL_INTERVAL);
  console.log('[Dashboard] polling started');
}

export function stopPolling(): void {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
    console.log('[Dashboard] polling stopped');
  }
}
