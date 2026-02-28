// src/pages/admin/registrations.ts
// Approval table + Pagination + Search + Bulk approve

import { Api } from '../../api';
import { Store } from '../../store';
import { Toast } from '../../components/toast';
import { Modal } from '../../components/modal';
import { DateHelper } from '../../utils/dateHelper';
import { CONFIG } from '../../config';
import type { Registration, Event, EventDistance } from '../../types';

// State สำหรับหน้านี้
interface RegState {
  eventId:     string;
  distanceId:  string;
  status:      string;
  search:      string;
  page:        number;
  limit:       number;
  total:       number;
  totalPages:  number;
  items:       Registration[];
  selected:    Set<string>;
  loading:     boolean;
  events:      Event[];
  distances:   EventDistance[];
}

let _state: RegState = {
  eventId: '', distanceId: '', status: 'pending',
  search: '', page: 1, limit: CONFIG.DEFAULT_PAGE_SIZE,
  total: 0, totalPages: 0, items: [], selected: new Set(),
  loading: false, events: [], distances: []
};

let _searchTimer: ReturnType<typeof setTimeout> | null = null;

export async function renderRegistrations(
  container: HTMLElement,
  params: Record<string, string>
): Promise<void> {
  // Init state from params
  _state = {
    ..._state,
    eventId:    params.eventId    || '',
    distanceId: params.distanceId || '',
    status:     params.status     || 'pending',
    page: 1, selected: new Set()
  };

  container.innerHTML = renderShell();
  await loadFilterData();
  await loadRegistrations();
  bindEvents(container);
}

// ─────────────────────────────────────────────────────────────
// Shell HTML
// ─────────────────────────────────────────────────────────────
function renderShell(): string {
  return `
    <div class="space-y-4 pb-24 md:pb-8" id="reg-page">

      <!-- Header + Bulk Actions -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h2 class="text-xl font-bold text-runner-primary">📋 รายการสมัคร</h2>
        <div class="flex gap-2">
          <button id="btn-bulk-approve"
            class="hidden px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-semibold
                   active:scale-95 transition-transform shadow-sm">
            ✅ อนุมัติที่เลือก
          </button>
          <button id="btn-select-all"
            class="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium
                   text-gray-600 active:scale-95 transition-transform hidden">
            เลือกทั้งหน้า
          </button>
        </div>
      </div>

      <!-- Filters Row -->
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">

        <!-- Search -->
        <div class="relative">
          <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input id="reg-search" type="search"
            placeholder="ค้นหา BIB, ชื่อ, LINE ID..."
            value="${_state.search}"
            class="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 text-sm
                   focus:border-runner-secondary focus:outline-none transition-colors" />
        </div>

        <!-- Filter row -->
        <div class="grid grid-cols-3 gap-2">
          <select id="filter-event"
            class="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-xs font-medium
                   focus:border-runner-secondary focus:outline-none text-gray-700">
            <option value="">ทุกงาน</option>
          </select>

          <select id="filter-distance"
            class="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-xs font-medium
                   focus:border-runner-secondary focus:outline-none text-gray-700">
            <option value="">ทุกระยะ</option>
          </select>

          <select id="filter-status"
            class="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-xs font-medium
                   focus:border-runner-secondary focus:outline-none text-gray-700">
            <option value="">ทุกสถานะ</option>
            <option value="pending"  ${_state.status === 'pending'  ? 'selected' : ''}>รออนุมัติ</option>
            <option value="approved" ${_state.status === 'approved' ? 'selected' : ''}>อนุมัติแล้ว</option>
            <option value="rejected" ${_state.status === 'rejected' ? 'selected' : ''}>ไม่ผ่าน</option>
            <option value="cancelled"${_state.status === 'cancelled'? 'selected' : ''}>ยกเลิก</option>
          </select>
        </div>
      </div>

      <!-- Stats bar -->
      <div id="reg-stats-bar" class="text-xs text-gray-400 font-medium px-1"></div>

      <!-- Table Area -->
      <div id="reg-table-area">
        ${renderTableSkeleton()}
      </div>

      <!-- Pagination -->
      <div id="reg-pagination" class="flex items-center justify-center gap-2 py-2"></div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Load filter data (events + distances)
// ─────────────────────────────────────────────────────────────
async function loadFilterData(): Promise<void> {
  try {
    const res = await Api.listAdminEvents();
    if (!res.success) return;

    _state.events = (res.data as Event[]) || [];

    const evSel = document.getElementById('filter-event') as HTMLSelectElement;
    _state.events.forEach(ev => {
      const opt = document.createElement('option');
      opt.value = ev.eventId;
      opt.textContent = ev.eventName;
      if (ev.eventId === _state.eventId) opt.selected = true;
      evSel.appendChild(opt);
    });

    // Load distances for selected event
    if (_state.eventId) await loadDistanceFilter(_state.eventId);

  } catch (err) {
    console.error('loadFilterData', err);
  }
}

async function loadDistanceFilter(eventId: string): Promise<void> {
  try {
    const res = await Api.getEvent(eventId);
    if (!res.success || !res.data) return;

    _state.distances = res.data.distances || [];
    const dSel = document.getElementById('filter-distance') as HTMLSelectElement;
    // Clear existing (keep first "ทุกระยะ")
    while (dSel.options.length > 1) dSel.remove(1);

    _state.distances.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.distanceId;
      opt.textContent = d.distanceName;
      if (d.distanceId === _state.distanceId) opt.selected = true;
      dSel.appendChild(opt);
    });
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// Load registrations
// ─────────────────────────────────────────────────────────────
async function loadRegistrations(): Promise<void> {
  if (_state.loading) return;
  _state.loading = true;

  const area = document.getElementById('reg-table-area');
  if (area) area.innerHTML = renderTableSkeleton();

  try {
    const res = await Api.listAdminRegistrations({
      eventId:    _state.eventId    || undefined,
      distanceId: _state.distanceId || undefined,
      status:     _state.status     || undefined,
      search:     _state.search     || undefined,
      page:       _state.page,
      limit:      _state.limit
    });

    if (!res.success) throw new Error(res.error);

    _state.items      = (res.data as Registration[]) || [];
    _state.total      = res.total      ?? 0;
    _state.totalPages = res.totalPages ?? 0;

    renderTable();
    renderPagination();
    renderStatsBar();

  } catch (err) {
    if (area) area.innerHTML = `
      <div class="text-center py-12 text-gray-400">
        <span class="block text-4xl mb-2">😕</span>
        โหลดไม่สำเร็จ: ${(err as Error).message}
      </div>`;
    Toast.error('โหลดรายการไม่สำเร็จ');
  } finally {
    _state.loading = false;
  }
}

// ─────────────────────────────────────────────────────────────
// Render Table
// ─────────────────────────────────────────────────────────────
function renderTable(): void {
  const area = document.getElementById('reg-table-area');
  if (!area) return;

  if (!_state.items.length) {
    area.innerHTML = `
      <div class="text-center py-16 bg-white rounded-2xl border border-gray-100">
        <span class="text-5xl block mb-3">🔍</span>
        <p class="text-gray-500 font-medium">ไม่พบรายการ</p>
        <p class="text-xs text-gray-400 mt-1">ลองเปลี่ยนตัวกรองหรือคำค้นหา</p>
      </div>`;
    return;
  }

  const hasPending = _state.items.some(r => r.status === 'pending');

  // Show/hide bulk action buttons
  const bulkBtn  = document.getElementById('btn-bulk-approve');
  const selectAllBtn = document.getElementById('btn-select-all');
  if (bulkBtn && hasPending) bulkBtn.classList.remove('hidden');
  if (selectAllBtn && hasPending) selectAllBtn.classList.remove('hidden');

  // Desktop table + Mobile cards
  area.innerHTML = `
    <!-- Desktop Table (md+) -->
    <div class="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-gray-50 border-b border-gray-100">
              <th class="px-4 py-3 text-left">
                <input type="checkbox" id="th-select-all" class="w-4 h-4 accent-runner-secondary" />
              </th>
              ${['BIB','ชื่อ-นามสกุล','ระยะ','เสื้อ','สถานะ','เช็คอิน','เวลาสมัคร','จัดการ']
                .map(h => `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">${h}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            ${_state.items.map(reg => renderTableRow(reg)).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Mobile Cards -->
    <div class="md:hidden space-y-3">
      ${_state.items.map(reg => renderMobileCard(reg)).join('')}
    </div>`;

  // Bind select all (desktop)
  document.getElementById('th-select-all')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    toggleSelectAll(checked);
  });

  // Bind row checkboxes
  document.querySelectorAll('.reg-checkbox').forEach(cb => {
    cb.addEventListener('change', () => updateBulkButton());
  });

  // Bind action buttons
  bindRowActions();
}

function renderTableRow(reg: Registration): string {
  const status = getStatusBadge(reg.status);
  const checkin = reg.checkinStatus === 'checked'
    ? `<span class="text-green-500 font-semibold text-xs">✅ ${DateHelper.formatTime(reg.checkinAt)}</span>`
    : `<span class="text-gray-400 text-xs">—</span>`;

  return `
    <tr class="hover:bg-gray-50/50 transition-colors"
        data-reg-id="${reg.registrationId}">
      <td class="px-4 py-3">
        ${reg.status === 'pending'
          ? `<input type="checkbox" class="reg-checkbox w-4 h-4 accent-runner-secondary"
                    data-id="${reg.registrationId}" />`
          : ''}
      </td>
      <td class="px-4 py-3">
        <span class="font-bold text-runner-secondary">${reg.bibNumber}</span>
      </td>
      <td class="px-4 py-3">
        <div>
          <p class="font-semibold text-runner-primary whitespace-nowrap">
            ${reg.firstName} ${reg.lastName}
          </p>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="text-xs text-gray-400 font-mono">${reg.userId.substring(0,12)}...</span>
            <button class="btn-copy-uid text-xs text-blue-400 hover:text-blue-600"
                    data-uid="${reg.userId}" title="Copy User ID">📋</button>
          </div>
        </div>
      </td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 bg-blue-50 text-runner-secondary text-xs rounded-full font-medium whitespace-nowrap">
          ${reg.distanceName || '—'}
        </span>
      </td>
      <td class="px-4 py-3 text-xs text-gray-600 font-semibold">${reg.shirtSize}</td>
      <td class="px-4 py-3">${status}</td>
      <td class="px-4 py-3">${checkin}</td>
      <td class="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
        ${DateHelper.relativeTime(reg.createdAt)}
      </td>
      <td class="px-4 py-3">
        <div class="flex items-center gap-1.5">
          ${reg.status === 'pending'
            ? `<button class="btn-approve px-3 py-1.5 bg-green-500 text-white
                             rounded-lg text-xs font-semibold hover:bg-green-600
                             transition-colors active:scale-95"
                       data-id="${reg.registrationId}"
                       data-name="${reg.firstName} ${reg.lastName}">
                 อนุมัติ
               </button>`
            : ''}
          ${reg.status === 'approved'
            ? `<button class="btn-staff-checkin px-3 py-1.5 bg-runner-secondary text-white
                             rounded-lg text-xs font-semibold hover:bg-blue-600
                             transition-colors active:scale-95"
                       data-id="${reg.registrationId}"
                       data-bib="${reg.bibNumber}"
                       data-name="${reg.firstName} ${reg.lastName}">
                 เช็คอิน
               </button>`
            : ''}
          <button class="btn-view-bib px-2 py-1.5 bg-gray-100 text-gray-600
                         rounded-lg text-xs hover:bg-gray-200 transition-colors"
                  data-id="${reg.registrationId}">
            👁
          </button>
        </div>
      </td>
    </tr>`;
}

function renderMobileCard(reg: Registration): string {
  const status = getStatusBadge(reg.status);

  return `
    <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
         data-reg-id="${reg.registrationId}">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-3">
          ${reg.status === 'pending'
            ? `<input type="checkbox" class="reg-checkbox w-5 h-5 accent-runner-secondary mt-0.5 shrink-0"
                      data-id="${reg.registrationId}" />`
            : '<div class="w-5"></div>'}
          <div>
            <div class="flex items-center gap-2">
              <span class="font-black text-runner-secondary text-lg">${reg.bibNumber}</span>
              <span class="px-2 py-0.5 bg-blue-50 text-runner-secondary text-xs rounded-full">
                ${reg.distanceName || '—'}
              </span>
            </div>
            <p class="font-semibold text-runner-primary text-sm">
              ${reg.firstName} ${reg.lastName}
            </p>
          </div>
        </div>
        ${status}
      </div>

      <!-- User ID row -->
      <div class="flex items-center gap-2 mb-3 bg-gray-50 rounded-xl px-3 py-2">
        <span class="font-mono text-xs text-gray-400 flex-1 truncate">${reg.userId}</span>
        <button class="btn-copy-uid text-xs text-blue-400 active:scale-90 transition-transform shrink-0"
                data-uid="${reg.userId}">
          📋 คัดลอก
        </button>
      </div>

      <!-- Details -->
      <div class="grid grid-cols-3 gap-2 mb-3 text-center">
        <div class="bg-gray-50 rounded-xl p-2">
          <p class="text-xs text-gray-400">เสื้อ</p>
          <p class="font-bold text-runner-primary text-sm">${reg.shirtSize}</p>
        </div>
        <div class="bg-gray-50 rounded-xl p-2">
          <p class="text-xs text-gray-400">เช็คอิน</p>
          <p class="font-bold text-sm ${reg.checkinStatus === 'checked' ? 'text-green-500' : 'text-gray-300'}">
            ${reg.checkinStatus === 'checked' ? '✅' : '—'}
          </p>
        </div>
        <div class="bg-gray-50 rounded-xl p-2">
          <p class="text-xs text-gray-400">สมัครเมื่อ</p>
          <p class="font-bold text-runner-primary text-xs">${DateHelper.relativeTime(reg.createdAt)}</p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex gap-2">
        ${reg.status === 'pending'
          ? `<button class="btn-approve flex-1 py-2.5 bg-green-500 text-white
                           rounded-xl text-sm font-bold active:scale-95 transition-transform"
                     data-id="${reg.registrationId}"
                     data-name="${reg.firstName} ${reg.lastName}">
               ✅ อนุมัติ
             </button>`
          : ''}
        ${reg.status === 'approved' && reg.checkinStatus !== 'checked'
          ? `<button class="btn-staff-checkin flex-1 py-2.5 bg-runner-secondary text-white
                           rounded-xl text-sm font-bold active:scale-95 transition-transform"
                     data-id="${reg.registrationId}"
                     data-bib="${reg.bibNumber}"
                     data-name="${reg.firstName} ${reg.lastName}">
               📷 เช็คอิน
             </button>`
          : ''}
        <button class="btn-view-bib px-4 py-2.5 bg-gray-100 text-gray-600
                       rounded-xl text-sm font-medium active:scale-95 transition-transform"
                data-id="${reg.registrationId}">
          👁 BIB
        </button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Bind Events
// ─────────────────────────────────────────────────────────────
function bindEvents(container: HTMLElement): void {
  // Search with debounce
  container.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    if (target.id === 'reg-search') {
      if (_searchTimer) clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => {
        _state.search = target.value.trim();
        _state.page = 1; // Reset to page 1 on search
        _state.selected = new Set();
        loadRegistrations();
      }, CONFIG.SEARCH_DEBOUNCE);
    }
  });

  // Filter changes
  container.addEventListener('change', async (e) => {
    const target = e.target as HTMLSelectElement;
    if (target.id === 'filter-event') {
      _state.eventId = target.value;
      _state.distanceId = '';
      _state.page = 1;
      _state.selected = new Set();
      await loadDistanceFilter(_state.eventId);
      loadRegistrations();
    }
    if (target.id === 'filter-distance') {
      _state.distanceId = target.value;
      _state.page = 1;
      loadRegistrations();
    }
    if (target.id === 'filter-status') {
      _state.status = target.value;
      _state.page = 1;
      _state.selected = new Set();
      loadRegistrations();
    }
  });

  // Bulk approve button
  document.getElementById('btn-bulk-approve')?.addEventListener('click', handleBulkApprove);

  // Select all button
  document.getElementById('btn-select-all')?.addEventListener('click', () => {
    toggleSelectAll(true);
  });
}

function bindRowActions(): void {
  // Approve buttons
  document.querySelectorAll('.btn-approve').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id   = (btn as HTMLElement).dataset.id!;
      const name = (btn as HTMLElement).dataset.name!;
      await handleApprove(id, name, btn as HTMLButtonElement);
    });
  });

  // Staff checkin buttons
  document.querySelectorAll('.btn-staff-checkin').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id   = (btn as HTMLElement).dataset.id!;
      const bib  = (btn as HTMLElement).dataset.bib!;
      const name = (btn as HTMLElement).dataset.name!;
      await handleStaffCheckin(id, bib, name, btn as HTMLButtonElement);
    });
  });

  // View BIB buttons
  document.querySelectorAll('.btn-view-bib').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.id!;
      Store.setRoute('bib-card', { registrationId: id });
      window.dispatchEvent(new CustomEvent('route-change'));
    });
  });

  // Copy User ID buttons
  document.querySelectorAll('.btn-copy-uid').forEach(btn => {
    btn.addEventListener('click', async () => {
      const uid = (btn as HTMLElement).dataset.uid!;
      try {
        await navigator.clipboard.writeText(uid);
        Toast.success('คัดลอก User ID แล้ว');
      } catch {
        // Fallback
        const el = document.createElement('textarea');
        el.value = uid;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        el.remove();
        Toast.success('คัดลอก User ID แล้ว');
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────
async function handleApprove(
  registrationId: string,
  name: string,
  btn: HTMLButtonElement
): Promise<void> {
  const ok = await Modal.confirm(
    `อนุมัติการสมัครของ ${name}?`,
    'ผู้สมัครจะได้รับการแจ้งเตือนผ่าน LINE'
  );
  if (!ok) return;

  btn.disabled = true;
  btn.textContent = '...';

  try {
    const res = await Api.approveRegistration(registrationId);
    if (!res.success) throw new Error(res.error);

    Toast.success(`อนุมัติ ${name} สำเร็จ`);

    // อัปเดต item ใน state แทน reload ทั้งหมด
    _state.items = _state.items.map(r =>
      r.registrationId === registrationId
        ? { ...r, status: 'approved', approvedAt: new Date().toISOString() }
        : r
    );
    _state.total = Math.max(0, _state.total - 1);
    renderTable();
    renderStatsBar();

  } catch (err) {
    Toast.error(`อนุมัติไม่สำเร็จ: ${(err as Error).message}`);
    btn.disabled = false;
    btn.textContent = 'อนุมัติ';
  }
}

async function handleStaffCheckin(
  registrationId: string,
  bibNumber: string,
  name: string,
  btn: HTMLButtonElement
): Promise<void> {
  const ok = await Modal.confirm(
    `เช็คอิน ${name}?`,
    `BIB: ${bibNumber} — ยืนยันการเช็คอิน`
  );
  if (!ok) return;

  btn.disabled = true;
  btn.textContent = '...';

  try {
    const res = await Api.staffCheckin(registrationId);
    if (!res.success) throw new Error(res.error);

    Toast.success(`เช็คอิน ${name} (${bibNumber}) สำเร็จ!`);

    _state.items = _state.items.map(r =>
      r.registrationId === registrationId
        ? { ...r, checkinStatus: 'checked', checkinAt: new Date().toISOString() }
        : r
    );
    renderTable();

  } catch (err) {
    Toast.error(`เช็คอินไม่สำเร็จ: ${(err as Error).message}`);
    btn.disabled = false;
    btn.textContent = '📷 เช็คอิน';
  }
}

async function handleBulkApprove(): Promise<void> {
  const selected = getSelectedIds();
  if (!selected.length) {
    Toast.warning('กรุณาเลือกรายการที่ต้องการอนุมัติ');
    return;
  }

  const ok = await Modal.confirm(
    `อนุมัติ ${selected.length} รายการ?`,
    'ผู้สมัครทั้งหมดที่เลือกจะได้รับการแจ้งเตือนผ่าน LINE'
  );
  if (!ok) return;

  const btn = document.getElementById('btn-bulk-approve') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = `กำลังอนุมัติ ${selected.length} รายการ...`;

  try {
    const res = await Api.bulkApprove(selected);
    if (!res.success) throw new Error(res.error);

    const { approvedCount, errors } = res.data as any;
    Toast.success(`อนุมัติสำเร็จ ${approvedCount} รายการ`);
    if (errors?.length) Toast.warning(`ล้มเหลว ${errors.length} รายการ`);

    _state.selected = new Set();
    _state.page = 1;
    await loadRegistrations();

  } catch (err) {
    Toast.error(`Bulk approve ล้มเหลว: ${(err as Error).message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ อนุมัติที่เลือก';
  }
}

// ─────────────────────────────────────────────────────────────
// Selection helpers
// ─────────────────────────────────────────────────────────────
function toggleSelectAll(checked: boolean): void {
  document.querySelectorAll('.reg-checkbox').forEach(cb => {
    (cb as HTMLInputElement).checked = checked;
  });
  updateBulkButton();
}

function getSelectedIds(): string[] {
  return Array.from(
    document.querySelectorAll('.reg-checkbox:checked')
  ).map(cb => (cb as HTMLElement).dataset.id!).filter(Boolean);
}

function updateBulkButton(): void {
  const selected = getSelectedIds();
  const btn = document.getElementById('btn-bulk-approve') as HTMLButtonElement;
  if (!btn) return;
  if (selected.length > 0) {
    btn.textContent = `✅ อนุมัติที่เลือก (${selected.length})`;
    btn.classList.remove('hidden');
  } else {
    btn.textContent = '✅ อนุมัติที่เลือก';
  }
}

// ─────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────
function renderPagination(): void {
  const el = document.getElementById('reg-pagination');
  if (!el || _state.totalPages <= 1) {
    if (el) el.innerHTML = '';
    return;
  }

  const { page, totalPages } = _state;
  const pages: number[] = [];

  // Smart page range
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push(-1); // ellipsis
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push(-2); // ellipsis
    pages.push(totalPages);
  }

  el.innerHTML = `
    <!-- Prev -->
    <button id="pg-prev"
      class="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200
             text-gray-500 text-sm transition-colors
             ${page === 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100 active:scale-90'}"
      ${page === 1 ? 'disabled' : ''}>
      ‹
    </button>

    <!-- Pages -->
    ${pages.map(p => p < 0
      ? `<span class="w-9 h-9 flex items-center justify-center text-gray-400 text-sm">…</span>`
      : `<button
          class="pg-btn w-9 h-9 flex items-center justify-center rounded-xl text-sm font-medium
                 transition-colors active:scale-90
                 ${p === page
                   ? 'bg-runner-secondary text-white shadow-md'
                   : 'border border-gray-200 text-gray-600 hover:bg-gray-100'}"
          data-page="${p}">${p}
         </button>`
    ).join('')}

    <!-- Next -->
    <button id="pg-next"
      class="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200
             text-gray-500 text-sm transition-colors
             ${page === totalPages ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100 active:scale-90'}"
      ${page === totalPages ? 'disabled' : ''}>
      ›
    </button>`;

  // Bind pagination buttons
  document.getElementById('pg-prev')?.addEventListener('click', () => {
    if (_state.page > 1) { _state.page--; loadRegistrations(); }
  });
  document.getElementById('pg-next')?.addEventListener('click', () => {
    if (_state.page < _state.totalPages) { _state.page++; loadRegistrations(); }
  });
  document.querySelectorAll('.pg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      _state.page = parseInt((btn as HTMLElement).dataset.page!);
      _state.selected = new Set();
      loadRegistrations();
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Stats Bar + Status Badge + Skeleton
// ─────────────────────────────────────────────────────────────
function renderStatsBar(): void {
  const el = document.getElementById('reg-stats-bar');
  if (!el) return;
  const start = (_state.page - 1) * _state.limit + 1;
  const end   = Math.min(_state.page * _state.limit, _state.total);
  el.textContent = _state.total > 0
    ? `แสดง ${start}–${end} จาก ${_state.total.toLocaleString()} รายการ`
    : 'ไม่พบรายการ';
}

function getStatusBadge(status: string): string {
  const map: Record<string, string> = {
    pending:   'bg-yellow-50 text-yellow-700 border-yellow-200',
    approved:  'bg-green-50 text-green-700 border-green-200',
    rejected:  'bg-red-50 text-red-700 border-red-200',
    cancelled: 'bg-gray-50 text-gray-500 border-gray-200'
  };
  const label: Record<string, string> = {
    pending: '⏳ รออนุมัติ', approved: '✅ อนุมัติ',
    rejected: '❌ ไม่ผ่าน', cancelled: '🚫 ยกเลิก'
  };
  return `<span class="px-2 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${map[status] || map.cancelled}">
    ${label[status] || status}
  </span>`;
}

function renderTableSkeleton(): string {
  return `
    <div class="space-y-3">
      ${Array(5).fill(0).map(() => `
        <div class="bg-white rounded-2xl p-4 border border-gray-100 animate-pulse">
          <div class="flex gap-3">
            <div class="w-12 h-6 bg-gray-200 rounded"></div>
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-gray-200 rounded w-32"></div>
              <div class="h-3 bg-gray-100 rounded w-24"></div>
            </div>
            <div class="w-20 h-8 bg-gray-200 rounded-xl"></div>
          </div>
        </div>`).join('')}
    </div>`;
}
