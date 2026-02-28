// src/pages/admin/checkinDesk.ts
// Staff Check-in Desk: QR Scan + Manual + Real-time Stats

import { Api } from '../../api';
import { Toast } from '../../components/toast';
import { DateHelper } from '../../utils/dateHelper';
import type { Event } from '../../types';

let _eventId = '';
let _events: Event[] = [];
let _recentCheckins: Array<{
  bibNumber: string; name: string; distance: string; time: string;
}> = [];

export async function renderCheckinDesk(
  container: HTMLElement,
  params: Record<string, string>
): Promise<void> {
  _eventId = params.eventId || '';
  _recentCheckins = [];

  container.innerHTML = `
    <div class="space-y-5 pb-24 md:pb-8">
      <h2 class="text-xl font-bold text-runner-primary">✅ จุดเช็คอิน Staff</h2>

      <!-- Event Selector -->
      <select id="checkin-event-sel"
        class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-2xl text-sm
               font-medium focus:border-runner-secondary focus:outline-none">
        <option value="">— เลือกงานวิ่ง —</option>
      </select>

      <!-- BIB Manual Search -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 class="font-bold text-runner-primary text-sm mb-3">🔢 ค้นหาด้วย BIB</h3>
        <div class="flex gap-2">
          <input id="bib-search-input" type="text"
            placeholder="กรอก BIB (เช่น BIB-0001)"
            class="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 text-sm
                   focus:border-runner-secondary focus:outline-none uppercase" />
          <button id="btn-bib-search"
            class="px-5 py-3 bg-runner-secondary text-white rounded-xl text-sm font-bold
                   active:scale-95 transition-transform">
            ค้นหา
          </button>
        </div>
        <div id="bib-result" class="mt-3"></div>
      </div>

      <!-- Stats Quick View -->
      <div id="checkin-stats" class="grid grid-cols-3 gap-3">
        ${Array(3).fill(0).map(() => `
          <div class="bg-white rounded-2xl p-3 text-center border border-gray-100 animate-pulse">
            <div class="h-6 bg-gray-200 rounded w-12 mx-auto mb-1"></div>
            <div class="h-3 bg-gray-100 rounded w-16 mx-auto"></div>
          </div>`).join('')}
      </div>

      <!-- Recent Check-ins -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="px-5 py-4 border-b border-gray-50">
          <h3 class="font-bold text-runner-primary text-sm">🕐 เช็คอินล่าสุด</h3>
        </div>
        <div id="recent-list" class="divide-y divide-gray-50">
          <div class="text-center py-8 text-gray-400 text-sm">ยังไม่มีการเช็คอิน</div>
        </div>
      </div>
    </div>`;

  // Load events
  await loadCheckinEvents();

  // BIB search
  const bibInput = document.getElementById('bib-search-input') as HTMLInputElement;
  document.getElementById('btn-bib-search')?.addEventListener('click', () => {
    searchByBib(bibInput.value.trim());
  });
  bibInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchByBib(bibInput.value.trim());
  });

  // Event selector
  document.getElementById('checkin-event-sel')?.addEventListener('change', (e) => {
    _eventId = (e.target as HTMLSelectElement).value;
    if (_eventId) loadCheckinStats();
  });
}

async function loadCheckinEvents(): Promise<void> {
  try {
    const res = await Api.listAdminEvents();
    if (!res.success) return;
    _events = (res.data as Event[]) || [];

    const sel = document.getElementById('checkin-event-sel') as HTMLSelectElement;
    _events.forEach(ev => {
      const opt = document.createElement('option');
      opt.value = ev.eventId;
      opt.textContent = `${ev.eventName} — ${DateHelper.formatThai(ev.eventDate)}`;
      if (ev.eventId === _eventId) opt.selected = true;
      sel.appendChild(opt);
    });

    if (_eventId) await loadCheckinStats();

  } catch (err) {
    Toast.error('โหลดรายการงานไม่สำเร็จ');
  }
}

async function loadCheckinStats(): Promise<void> {
  try {
    const res = await Api.getCheckinStats(_eventId);
    if (!res.success || !res.data) return;

    const stats = res.data as { total: number; checked: number; absent: number; checkinRate: number };
    const el = document.getElementById('checkin-stats');
    if (!el) return;

    el.innerHTML = [
      { label: 'อนุมัติแล้ว', value: stats.total,   color: 'text-blue-600' },
      { label: 'เช็คอินแล้ว', value: stats.checked,  color: 'text-green-600' },
      { label: 'ยังไม่มา',    value: stats.absent,   color: 'text-orange-600' }
    ].map(({ label, value, color }) => `
      <div class="bg-white rounded-2xl p-3 text-center border border-gray-100 shadow-sm">
        <p class="text-2xl font-black ${color}">${value.toLocaleString()}</p>
        <p class="text-xs text-gray-400 mt-0.5">${label}</p>
      </div>`).join('');

  } catch {}
}

async function searchByBib(bib: string): Promise<void> {
  const resultEl = document.getElementById('bib-result');
  if (!resultEl) return;
  if (!bib) { Toast.warning('กรุณากรอก BIB'); return; }
  if (!_eventId) { Toast.warning('กรุณาเลือกงานวิ่งก่อน'); return; }

  resultEl.innerHTML = `<div class="text-center py-4 text-gray-400 text-sm animate-pulse">กำลังค้นหา...</div>`;

  try {
    const res = await Api.listAdminRegistrations({
      eventId: _eventId,
      search: bib,
      limit: 5
    });

    if (!res.success) throw new Error(res.error);
    const regs = (res.data as any[]) || [];

    if (!regs.length) {
      resultEl.innerHTML = `
        <div class="text-center py-4 bg-red-50 rounded-xl border border-red-200">
          <p class="text-red-500 font-medium text-sm">ไม่พบ BIB: ${bib}</p>
        </div>`;
      return;
    }

    const reg = regs[0];
    const isChecked = reg.checkinStatus === 'checked';

    resultEl.innerHTML = `
      <div class="bg-gray-50 rounded-2xl p-4 border ${isChecked ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}">
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="font-black text-runner-secondary text-2xl">${reg.bibNumber}</p>
            <p class="font-bold text-runner-primary">${reg.firstName} ${reg.lastName}</p>
            <p class="text-xs text-gray-500">${reg.distanceName || ''} • เสื้อ ${reg.shirtSize}</p>
          </div>
          <div class="text-right">
            <span class="px-3 py-1.5 rounded-full text-xs font-bold ${isChecked ? 'bg-green-100 text-green-700' : 'bg-white text-runner-primary border border-gray-200'}">
              ${isChecked ? '✅ เช็คอินแล้ว' : '⏳ ยังไม่เช็คอิน'}
            </span>
            ${isChecked
              ? `<p class="text-xs text-gray-400 mt-1">${DateHelper.formatTime(reg.checkinAt)}</p>`
              : ''}
          </div>
        </div>
        ${reg.status === 'approved' && !isChecked
          ? `<button id="btn-do-checkin"
               class="w-full py-3 bg-green-500 text-white rounded-xl font-bold text-sm
                      active:scale-95 transition-transform shadow-md shadow-green-200"
               data-id="${reg.registrationId}"
               data-bib="${reg.bibNumber}"
               data-name="${reg.firstName} ${reg.lastName}">
               ✅ เช็คอินเลย
             </button>`
          : reg.status !== 'approved'
          ? `<div class="text-center py-2 text-orange-600 text-sm font-medium">
               ⚠️ ยังไม่ได้รับการอนุมัติ
             </div>`
          : `<div class="text-center py-2 text-green-600 text-sm font-medium">
               เช็คอินสำเร็จแล้ว
             </div>`}
      </div>`;

    document.getElementById('btn-do-checkin')?.addEventListener('click', async (e) => {
      const btn = e.target as HTMLButtonElement;
      const id   = btn.dataset.id!;
      const bib  = btn.dataset.bib!;
      const name = btn.dataset.name!;

      btn.disabled = true;
      btn.textContent = 'กำลังเช็คอิน...';

      try {
        const res = await Api.staffCheckin(id);
        if (!res.success) throw new Error(res.error);

        Toast.success(`✅ เช็คอิน ${name} (${bib}) สำเร็จ!`);

        // Add to recent list
        addToRecentList({ bibNumber: bib, name, distance: '', time: DateHelper.formatTime(new Date()) });

        // Clear search
        (document.getElementById('bib-search-input') as HTMLInputElement).value = '';
        resultEl.innerHTML = '';
        await loadCheckinStats();

      } catch (err) {
        Toast.error(`เช็คอินไม่สำเร็จ: ${(err as Error).message}`);
        btn.disabled = false;
        btn.textContent = '✅ เช็คอินเลย';
      }
    });

  } catch (err) {
    resultEl.innerHTML = `
      <div class="text-center py-3 bg-red-50 rounded-xl">
        <p class="text-red-500 text-sm">${(err as Error).message}</p>
      </div>`;
  }
}

function addToRecentList(entry: typeof _recentCheckins[0]): void {
  _recentCheckins.unshift(entry);
  if (_recentCheckins.length > 20) _recentCheckins.pop();

  const el = document.getElementById('recent-list');
  if (!el) return;

  el.innerHTML = _recentCheckins.map((c, i) => `
    <div class="flex items-center px-5 py-3 ${i === 0 ? 'bg-green-50' : ''}">
      <span class="font-bold text-runner-secondary w-24 shrink-0">${c.bibNumber}</span>
      <span class="flex-1 text-sm text-runner-primary font-medium truncate">${c.name}</span>
      <span class="text-xs text-gray-400 shrink-0">${c.time}</span>
    </div>`).join('');
}
