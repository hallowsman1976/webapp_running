// src/pages/admin/qrPrint.ts
// QR Checkpoint management + Print Label

import { Api } from '../../api';
import { Toast } from '../../components/toast';
import { Modal } from '../../components/modal';
import type { Event, QrCheckpoint } from '../../types';

let _eventId = '';
let _events: Event[] = [];
let _checkpoints: QrCheckpoint[] = [];

export async function renderQrPrint(
  container: HTMLElement,
  params: Record<string, string>
): Promise<void> {
  _eventId = params.eventId || '';

  container.innerHTML = `
    <div class="space-y-5 pb-24 md:pb-8">
      <h2 class="text-xl font-bold text-runner-primary">🖨️ QR Code & พิมพ์ป้าย</h2>

      <!-- Event Selector -->
      <select id="qr-event-sel"
        class="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-2xl text-sm
               font-medium focus:border-runner-secondary focus:outline-none">
        <option value="">— เลือกงานวิ่ง —</option>
      </select>

      <!-- Create Checkpoint -->
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 class="font-bold text-runner-primary text-sm mb-4">➕ สร้างจุดเช็คอินใหม่</h3>
        <div class="space-y-3">
          <input id="cp-name" type="text"
            placeholder="ชื่อจุด เช่น ประตูทางเข้า, Start Line"
            class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-sm
                   focus:border-runner-secondary focus:outline-none" />
          <label class="flex items-center gap-3 p-3 bg-blue-50 rounded-xl cursor-pointer">
            <input type="checkbox" id="cp-multi" class="w-4 h-4 accent-runner-secondary" />
            <div>
              <p class="text-sm font-semibold text-runner-primary">อนุญาตเช็คอินซ้ำ</p>
              <p class="text-xs text-gray-400">จุดนี้สามารถเช็คอินได้หลายครั้ง</p>
            </div>
          </label>
          <button id="btn-create-cp"
            class="w-full py-3 bg-runner-secondary text-white rounded-xl
                   text-sm font-bold active:scale-95 transition-transform">
            ➕ สร้างจุดเช็คอิน
          </button>
        </div>
      </div>

      <!-- Checkpoints List -->
      <div id="checkpoints-area">
        <div class="text-center py-8 text-gray-400 text-sm">เลือกงานวิ่งเพื่อดูจุดเช็คอิน</div>
      </div>

      <!-- Print All Button -->
      <button id="btn-print-all"
        class="hidden w-full py-4 bg-runner-primary text-white rounded-2xl
               font-bold text-base active:scale-95 transition-transform
               flex items-center justify-center gap-2">
        <span>🖨️</span> พิมพ์ป้ายทั้งหมด
      </button>
    </div>

    <!-- Print Area (hidden from screen, visible when printing) -->
    <div id="print-area" class="hidden print:block"></div>`;

  // Load events
  await loadQrEvents();

  // Event selector
  document.getElementById('qr-event-sel')?.addEventListener('change', (e) => {
    _eventId = (e.target as HTMLSelectElement).value;
    if (_eventId) loadCheckpoints();
  });

  // Create checkpoint
  document.getElementById('btn-create-cp')?.addEventListener('click', handleCreateCheckpoint);

  // Print all
  document.getElementById('btn-print-all')?.addEventListener('click', printAllLabels);
}

async function loadQrEvents(): Promise<void> {
  try {
    const res = await Api.listAdminEvents();
    if (!res.success) return;
    _events = (res.data as Event[]) || [];

    const sel = document.getElementById('qr-event-sel') as HTMLSelectElement;
    _events.forEach(ev => {
      const opt = document.createElement('option');
      opt.value = ev.eventId;
      opt.textContent = ev.eventName;
      if (ev.eventId === _eventId) opt.selected = true;
      sel.appendChild(opt);
    });

    if (_eventId) await loadCheckpoints();
  } catch {}
}

async function loadCheckpoints(): Promise<void> {
  const area = document.getElementById('checkpoints-area');
  if (!area) return;

  area.innerHTML = `<div class="text-center py-8 text-gray-400 animate-pulse">กำลังโหลด...</div>`;

  try {
    const res = await Api.listQrCheckpoints(_eventId);
    if (!res.success) throw new Error(res.error);

    _checkpoints = (res.data as QrCheckpoint[]) || [];

    if (!_checkpoints.length) {
      area.innerHTML = `
        <div class="text-center py-10 bg-white rounded-2xl border border-gray-100">
          <span class="text-4xl block mb-3">📭</span>
          <p class="text-gray-400 text-sm">ยังไม่มีจุดเช็คอิน กดปุ่มสร้างด้านบน</p>
        </div>`;
      document.getElementById('btn-print-all')?.classList.add('hidden');
      return;
    }

    document.getElementById('btn-print-all')?.classList.remove('hidden');

    area.innerHTML = `
      <div class="space-y-3">
        ${_checkpoints.map(cp => renderCheckpointCard(cp)).join('')}
      </div>`;

    // Bind actions
    bindCheckpointActions();

  } catch (err) {
    area.innerHTML = `<div class="text-center py-8 text-red-400">${(err as Error).message}</div>`;
    Toast.error('โหลดจุดเช็คอินไม่สำเร็จ');
  }
}

function renderCheckpointCard(cp: QrCheckpoint): string {
  // Generate QR URL สำหรับแสดง (ใช้ QR code API สาธารณะ)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(cp.qrPayload)}`;

  return `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
         data-cp-id="${cp.checkpointId}">
      <div class="flex items-start gap-4 p-4">
        <!-- QR Code Preview -->
        <div class="w-24 h-24 shrink-0 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center border border-gray-200">
          <img src="${qrUrl}"
               alt="QR: ${cp.checkpointName}"
               class="w-full h-full object-contain p-1"
               loading="lazy" />
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <h4 class="font-bold text-runner-primary">${cp.checkpointName}</h4>
            <span class="shrink-0 px-2 py-1 text-xs rounded-full font-medium
              ${cp.allowMultiCheckin ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-500'}">
              ${cp.allowMultiCheckin ? '🔄 เช็คซ้ำได้' : '1️⃣ ครั้งเดียว'}
            </span>
          </div>
          <p class="text-xs text-gray-400 font-mono mt-1 truncate">${cp.qrPayload}</p>

          <div class="flex gap-2 mt-3">
            <button class="btn-print-cp flex-1 py-2 bg-runner-primary text-white
                           rounded-xl text-xs font-semibold active:scale-95 transition-transform"
                    data-cp-id="${cp.checkpointId}">
              🖨️ พิมพ์ป้าย
            </button>
            <button class="btn-download-qr px-3 py-2 bg-blue-50 text-runner-secondary
                           rounded-xl text-xs font-semibold active:scale-95 transition-transform"
                    data-qr-url="${qrUrl}"
                    data-cp-name="${cp.checkpointName}">
              ⬇️ ดาวน์โหลด
            </button>
            <button class="btn-delete-cp px-3 py-2 bg-red-50 text-red-500
                           rounded-xl text-xs active:scale-95 transition-transform"
                    data-cp-id="${cp.checkpointId}"
                    data-cp-name="${cp.checkpointName}">
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function bindCheckpointActions(): void {
  // Print single checkpoint label
  document.querySelectorAll('.btn-print-cp').forEach(btn => {
    btn.addEventListener('click', () => {
      const cpId = (btn as HTMLElement).dataset.cpId!;
      const cp = _checkpoints.find(c => c.checkpointId === cpId);
      if (cp) printSingleLabel(cp);
    });
  });

  // Download QR
  document.querySelectorAll('.btn-download-qr').forEach(btn => {
    btn.addEventListener('click', async () => {
      const qrUrl  = (btn as HTMLElement).dataset.qrUrl!;
      const name   = (btn as HTMLElement).dataset.cpName!;
      await downloadQr(qrUrl, name);
    });
  });

  // Delete checkpoint
  document.querySelectorAll('.btn-delete-cp').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cpId   = (btn as HTMLElement).dataset.cpId!;
      const cpName = (btn as HTMLElement).dataset.cpName!;
      await handleDeleteCheckpoint(cpId, cpName);
    });
  });
}

async function handleCreateCheckpoint(): Promise<void> {
  if (!_eventId) { Toast.warning('กรุณาเลือกงานวิ่งก่อน'); return; }

  const name  = (document.getElementById('cp-name') as HTMLInputElement).value.trim();
  const multi = (document.getElementById('cp-multi') as HTMLInputElement).checked;

  if (!name) { Toast.warning('กรุณากรอกชื่อจุดเช็คอิน'); return; }

  const btn = document.getElementById('btn-create-cp') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'กำลังสร้าง...';

  try {
    const res = await Api.createQrCheckpoint({
      eventId: _eventId,
      checkpointName: name,
      allowMultiCheckin: multi
    });
    if (!res.success) throw new Error(res.error);

    Toast.success(`สร้างจุด "${name}" สำเร็จ`);
    (document.getElementById('cp-name') as HTMLInputElement).value = '';
    (document.getElementById('cp-multi') as HTMLInputElement).checked = false;
    await loadCheckpoints();

  } catch (err) {
    Toast.error(`สร้างไม่สำเร็จ: ${(err as Error).message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '➕ สร้างจุดเช็คอิน';
  }
}

async function handleDeleteCheckpoint(cpId: string, cpName: string): Promise<void> {
  const ok = await Modal.confirm(`ลบจุดเช็คอิน "${cpName}"?`);
  if (!ok) return;

  try {
    const res = await Api.deleteQrCheckpoint(cpId);
    if (!res.success) throw new Error(res.error);
    Toast.success('ลบจุดเช็คอินสำเร็จ');
    await loadCheckpoints();
  } catch (err) {
    Toast.error(`ลบไม่สำเร็จ: ${(err as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Print Label
// ─────────────────────────────────────────────────────────────
function printSingleLabel(cp: QrCheckpoint): void {
  const event = _events.find(e => e.eventId === _eventId);
  printLabels([cp], event);
}

function printAllLabels(): void {
  const event = _events.find(e => e.eventId === _eventId);
  printLabels(_checkpoints, event);
}

function printLabels(checkpoints: QrCheckpoint[], event?: Event): void {
  const printContent = checkpoints.map(cp => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(cp.qrPayload)}`;
    return `
      <div style="
        width: 10cm; height: 12cm;
        border: 3px solid #1a1a2e;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: space-between;
        margin: 8px;
        page-break-inside: avoid;
        font-family: 'Noto Sans Thai', sans-serif;
        background: white;
      ">
        <div style="text-align:center">
          <p style="font-size:10px;color:#888;margin:0">🏃 ${event?.eventName || 'Runner Event'}</p>
          <h2 style="font-size:18px;font-weight:900;color:#1a1a2e;margin:4px 0">
            ${cp.checkpointName}
          </h2>
          ${cp.allowMultiCheckin
            ? '<p style="font-size:10px;color:#4A90D9;margin:0">🔄 เช็คอินซ้ำได้</p>'
            : ''}
        </div>

        <img src="${qrUrl}" alt="QR"
             style="width:180px;height:180px;object-fit:contain" />

        <div style="text-align:center;width:100%">
          <p style="font-size:8px;color:#aaa;word-break:break-all;margin:0">
            ${cp.qrPayload}
          </p>
          <p style="font-size:10px;color:#1a1a2e;font-weight:600;margin:4px 0 0">
            📱 สแกน QR เพื่อเช็คอิน
          </p>
        </div>
      </div>`;
  }).join('');

  // Open print window
  const printWin = window.open('', '_blank', 'width=800,height=600');
  if (!printWin) {
    Toast.error('กรุณาอนุญาต popup เพื่อพิมพ์');
    return;
  }

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>พิมพ์ป้ายเช็คอิน</title>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f0f0f0; padding: 16px; }
        .labels-grid {
          display: flex; flex-wrap: wrap;
          justify-content: center; gap: 8px;
        }
        @media print {
          body { background: white; padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="text-align:center;padding:16px">
        <button onclick="window.print()"
          style="padding:12px 32px;background:#1a1a2e;color:white;border:none;
                 border-radius:8px;font-size:16px;cursor:pointer;font-weight:bold">
          🖨️ พิมพ์เลย
        </button>
      </div>
      <div class="labels-grid">${printContent}</div>
    </body>
    </html>`);

  printWin.document.close();
  printWin.focus();
}

async function downloadQr(qrUrl: string, cpName: string): Promise<void> {
  try {
    const res = await fetch(qrUrl);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `QR_${cpName.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Toast.success('ดาวน์โหลด QR สำเร็จ');
  } catch {
    Toast.error('ดาวน์โหลดไม่สำเร็จ');
  }
}
