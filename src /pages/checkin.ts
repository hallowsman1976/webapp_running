// src/pages/checkin.ts
// Runner self check-in ผ่าน QR Scanner
// พร้อม Android workaround ครบ

import { Store } from '../store';
import { Api } from '../api';
import { Toast } from '../components/toast';
import { Modal } from '../components/modal';
import { QrScanner } from '../utils/qrScanner';

// State สำหรับ check-in page
let _scanner: QrScanner | null = null;
let _lastPayload = '';
let _isProcessing = false;

// Android: ป้องกันสแกนซ้ำ
const SCAN_COOLDOWN_MS = 3000;
let _lastScanTime = 0;

export async function renderCheckin(params: Record<string, string>): Promise<void> {
  // Stop scanner เก่า (ถ้ามี) — สำคัญมากสำหรับ Android
  cleanupScanner();

  const app = document.getElementById('app')!;

  app.innerHTML = `
    <div class="min-h-screen bg-runner-primary flex flex-col">

      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 pt-safe-top">
        <button id="btn-back-checkin"
          class="text-white/80 p-2 -ml-2 active:scale-90 transition-transform">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 class="text-white font-bold text-lg">สแกน QR เช็คอิน</h1>
        <button id="btn-torch" class="text-white/70 p-2 active:scale-90 transition-transform"
                title="ไฟฉาย" style="display:none">
          💡
        </button>
      </div>

      <!-- Camera View -->
      <div class="relative flex-1 overflow-hidden">

        <!-- Video Feed -->
        <video id="qr-video" playsinline muted autoplay
               class="w-full h-full object-cover absolute inset-0">
        </video>

        <!-- Hidden canvas for jsQR processing -->
        <canvas id="qr-canvas" class="hidden absolute"></canvas>

        <!-- Scan Overlay -->
        <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">

          <!-- Dark overlay (corners) -->
          <div class="absolute inset-0 bg-black/50"></div>

          <!-- Scan window -->
          <div id="scan-window"
               class="relative w-64 h-64 z-10">
            <!-- Corner frames -->
            <div class="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-2xl"></div>
            <div class="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-2xl"></div>
            <div class="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-2xl"></div>
            <div class="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-2xl"></div>

            <!-- Scan line animation -->
            <div id="scan-line"
                 class="absolute left-2 right-2 h-0.5 bg-line-green shadow-lg
                        shadow-green-400/50"
                 style="animation: scanLine 2s linear infinite; top: 10%;">
            </div>
          </div>

          <!-- Instruction text -->
          <p class="relative z-10 text-white text-sm mt-6 font-medium text-center px-6">
            จัดตำแหน่ง QR Code ให้อยู่ในกรอบ
          </p>
        </div>

        <!-- Status overlay (แสดงเมื่อสแกนสำเร็จ/ผิดพลาด) -->
        <div id="scan-result-overlay"
             class="absolute inset-0 hidden items-center justify-center z-20
                    bg-black/80 backdrop-blur-sm">
        </div>

        <!-- Loading overlay -->
        <div id="scan-loading"
             class="absolute inset-0 hidden items-center justify-center z-20
                    bg-black/70">
          <div class="bg-white rounded-2xl px-6 py-5 flex flex-col items-center gap-3">
            <div class="w-10 h-10 border-4 border-gray-200 border-t-line-green
                        rounded-full animate-spin"></div>
            <p class="text-runner-primary font-medium text-sm">กำลังเช็คอิน...</p>
          </div>
        </div>
      </div>

      <!-- Bottom Panel -->
      <div class="bg-white rounded-t-3xl px-5 pt-5 pb-8 safe-area-bottom">

        <!-- Camera Status -->
        <div id="camera-status"
             class="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
          <div id="camera-dot"
               class="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse shrink-0">
          </div>
          <p id="camera-status-text" class="text-sm text-gray-500">
            กำลังเปิดกล้อง...
          </p>
        </div>

        <!-- Manual Input (fallback) -->
        <div class="space-y-3">
          <p class="text-xs text-gray-400 text-center">หรือกรอก QR Payload ด้วยตนเอง</p>
          <div class="flex gap-2">
            <input id="manual-qr-input" type="text"
              placeholder="วาง QR payload ที่นี่..."
              class="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 text-sm
                     focus:border-runner-secondary focus:outline-none font-mono" />
            <button id="btn-manual-checkin"
              class="px-4 py-3 bg-runner-secondary text-white rounded-xl text-sm
                     font-bold active:scale-95 transition-transform">
              ✅
            </button>
          </div>

          <!-- Upload QR Image (Android fallback) -->
          <label class="flex items-center justify-center gap-2 py-3 border-2 border-dashed
                        border-gray-200 rounded-xl cursor-pointer active:bg-gray-50
                        transition-colors">
            <span class="text-lg">🖼️</span>
            <span class="text-sm text-gray-500 font-medium">อัปโหลดรูป QR Code</span>
            <input type="file" accept="image/*" id="qr-file-input" class="hidden" />
          </label>
        </div>
      </div>
    </div>

    <style>
      @keyframes scanLine {
        0%   { top: 10%; opacity: 1; }
        45%  { top: 85%; opacity: 1; }
        50%  { top: 85%; opacity: 0; }
        51%  { top: 10%; opacity: 0; }
        55%  { top: 10%; opacity: 1; }
        100% { top: 10%; opacity: 1; }
      }
    </style>`;

  // ── Back button ──────────────────────────────────────────
  document.getElementById('btn-back-checkin')!.addEventListener('click', () => {
    cleanupScanner();
    Store.goBack();
    window.dispatchEvent(new CustomEvent('route-change'));
  });

  // ── Manual input ─────────────────────────────────────────
  document.getElementById('btn-manual-checkin')!.addEventListener('click', () => {
    const val = (document.getElementById('manual-qr-input') as HTMLInputElement).value.trim();
    if (val) handleQrPayload(val);
    else Toast.warning('กรุณากรอก QR payload');
  });

  document.getElementById('manual-qr-input')!.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      const val = (e.target as HTMLInputElement).value.trim();
      if (val) handleQrPayload(val);
    }
  });

  // ── Upload QR Image (Android fallback) ───────────────────
  document.getElementById('qr-file-input')!.addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    setCameraStatus('scanning', '🖼️ กำลังอ่าน QR จากรูปภาพ...');
    const result = await QrScanner.scanFromFile(file);
    if (result) {
      Toast.info(`พบ QR: ${result.substring(0, 30)}...`);
      handleQrPayload(result);
    } else {
      Toast.error('ไม่พบ QR Code ในรูปภาพ กรุณาลองใหม่');
      setCameraStatus('error', 'ไม่พบ QR ในรูปภาพ');
    }
  });

  // ── Start Camera Scanner ─────────────────────────────────
  await startScanner();
}

// ─────────────────────────────────────────────────────────────
// Start QR Scanner
// ─────────────────────────────────────────────────────────────
async function startScanner(): Promise<void> {
  // ตรวจสอบ camera support
  const supported = await QrScanner.isSupported();
  if (!supported) {
    setCameraStatus('error', 'อุปกรณ์ไม่รองรับการใช้กล้อง');
    Toast.warning('ใช้การกรอก QR ด้วยตนเองแทน');
    return;
  }

  const videoEl  = document.getElementById('qr-video') as HTMLVideoElement;
  const canvasEl = document.getElementById('qr-canvas') as HTMLCanvasElement;

  if (!videoEl || !canvasEl) return;

  setCameraStatus('loading', 'กำลังขอสิทธิ์เข้าถึงกล้อง...');

  _scanner = new QrScanner({
    onSuccess: (payload) => {
      // Android: debounce ป้องกัน double-fire
      const now = Date.now();
      if (now - _lastScanTime < SCAN_COOLDOWN_MS) {
        console.log('[Checkin] scan debounced');
        setTimeout(() => _scanner?.resumeScan(), SCAN_COOLDOWN_MS);
        return;
      }
      if (payload === _lastPayload && now - _lastScanTime < 10000) {
        console.log('[Checkin] same payload within 10s, ignoring');
        setTimeout(() => _scanner?.resumeScan(), SCAN_COOLDOWN_MS);
        return;
      }
      _lastScanTime = now;
      _lastPayload  = payload;
      handleQrPayload(payload);
    },

    onError: (err) => {
      setCameraStatus('error', err);
      Toast.error(err);
    },

    onFrame: () => {
      // ทุก frame: อัปเดต camera status เป็น active
      const dot = document.getElementById('camera-dot');
      if (dot && dot.className.includes('yellow')) {
        setCameraStatus('active', 'กล้องพร้อมใช้งาน กรุณาสแกน QR');
      }
    }
  });

  try {
    await _scanner.start(videoEl, canvasEl);
    setCameraStatus('active', 'กล้องพร้อมใช้งาน กรุณาสแกน QR');

    // Android: แสดงปุ่มไฟฉาย (ถ้า track รองรับ)
    checkTorchSupport();

  } catch (err) {
    console.error('[Checkin] scanner start failed:', err);
    setCameraStatus('error', (err as Error).message);
  }
}

// ─────────────────────────────────────────────────────────────
// Handle QR Payload → Call API
// ─────────────────────────────────────────────────────────────
async function handleQrPayload(payload: string): Promise<void> {
  if (_isProcessing) {
    console.log('[Checkin] already processing, skip');
    return;
  }

  // Validate payload format: CHKPT:{eventId}:{checkpointId}:{random}
  if (!payload.startsWith('CHKPT:')) {
    showScanError('QR Code ไม่ถูกต้อง\nกรุณาสแกน QR จากจุดเช็คอินที่กำหนด');
    setTimeout(() => {
      hideScanOverlay();
      _scanner?.resumeScan();
    }, 2500);
    return;
  }

  _isProcessing = true;
  showScanLoading(true);

  try {
    const res = await Api.selfCheckin(payload);

    if (!res.success) {
      throw new Error(res.error || 'เช็คอินไม่สำเร็จ');
    }

    const data = res.data as {
      bibNumber: string;
      firstName: string;
      lastName: string;
      checkin: { checkinAt: string };
    };

    showScanSuccess(data);

    // หลัง 3 วินาที → ไปหน้า BIB card
    setTimeout(() => {
      cleanupScanner();
      const regId = Store.getState().currentRoute.params.registrationId;
      if (regId) {
        Store.setRoute('bib-card', { registrationId: regId });
      } else {
        Store.setRoute('my-registrations');
      }
      window.dispatchEvent(new CustomEvent('route-change'));
    }, 3000);

  } catch (err) {
    const msg = (err as Error).message;
    showScanError(msg);

    setTimeout(() => {
      hideScanOverlay();
      showScanLoading(false);
      _isProcessing = false;
      _scanner?.resumeScan();
    }, 3000);
  } finally {
    showScanLoading(false);
    // _isProcessing reset ใน finally หรือใน timeout ด้านบน
    if (!_isProcessing) return;
    setTimeout(() => { _isProcessing = false; }, 3000);
  }
}

// ─────────────────────────────────────────────────────────────
// UI State helpers
// ─────────────────────────────────────────────────────────────
function setCameraStatus(
  type: 'loading' | 'active' | 'scanning' | 'error',
  text: string
): void {
  const dot     = document.getElementById('camera-dot');
  const textEl  = document.getElementById('camera-status-text');
  if (!dot || !textEl) return;

  textEl.textContent = text;

  const colorMap = {
    loading:  'bg-yellow-400 animate-pulse',
    active:   'bg-green-500',
    scanning: 'bg-blue-400 animate-pulse',
    error:    'bg-red-400'
  };

  dot.className = `w-2.5 h-2.5 rounded-full shrink-0 ${colorMap[type]}`;
}

function showScanLoading(show: boolean): void {
  const el = document.getElementById('scan-loading');
  if (el) el.style.display = show ? 'flex' : 'none';
}

function showScanSuccess(data: {
  bibNumber: string;
  firstName: string;
  lastName: string;
}): void {
  const overlay = document.getElementById('scan-result-overlay');
  if (!overlay) return;

  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="text-center px-8 animate-slide-up">
      <div class="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-green-900/50">
        <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <p class="text-green-400 font-black text-2xl mb-2">เช็คอินสำเร็จ!</p>
      <p class="text-white font-bold text-3xl mb-1">${data.bibNumber}</p>
      <p class="text-white/80 text-lg">${data.firstName} ${data.lastName}</p>
      <div class="mt-5 w-16 h-1.5 bg-white/20 rounded-full mx-auto overflow-hidden">
        <div class="h-full bg-green-400 rounded-full animate-[progress_3s_linear_forwards]"></div>
      </div>
    </div>`;

  // Haptic feedback (ถ้า browser รองรับ)
  if ('vibrate' in navigator) {
    navigator.vibrate([100, 50, 100]);
  }
}

function showScanError(message: string): void {
  const overlay = document.getElementById('scan-result-overlay');
  if (!overlay) return;

  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <div class="text-center px-8 animate-slide-up">
      <div class="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-red-900/50">
        <svg class="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </div>
      <p class="text-red-400 font-bold text-xl mb-3">เช็คอินไม่สำเร็จ</p>
      <p class="text-white/80 text-sm leading-relaxed whitespace-pre-line">${message}</p>
    </div>`;

  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200, 100, 400]);
  }
}

function hideScanOverlay(): void {
  const overlay = document.getElementById('scan-result-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.innerHTML = '';
  }
}

// ─────────────────────────────────────────────────────────────
// Torch (Flashlight) Support
// ─────────────────────────────────────────────────────────────
let _torchOn = false;

function checkTorchSupport(): void {
  const torchBtn = document.getElementById('btn-torch');
  if (!torchBtn) return;

  try {
    const videoEl = document.getElementById('qr-video') as HTMLVideoElement;
    const track = (videoEl?.srcObject as MediaStream)?.getVideoTracks()[0];
    const capabilities = track?.getCapabilities?.() as any;

    if (capabilities?.torch) {
      torchBtn.style.display = 'block';
      torchBtn.addEventListener('click', () => toggleTorch(track));
    }
  } catch {
    // Torch ไม่รองรับ
  }
}

async function toggleTorch(track: MediaStreamTrack): Promise<void> {
  _torchOn = !_torchOn;
  try {
    await (track as any).applyConstraints({ advanced: [{ torch: _torchOn }] });
    const btn = document.getElementById('btn-torch');
    if (btn) btn.textContent = _torchOn ? '🔦' : '💡';
  } catch {
    Toast.warning('อุปกรณ์นี้ไม่รองรับไฟฉาย');
    _torchOn = false;
  }
}

// ─────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────
function cleanupScanner(): void {
  if (_scanner) {
    _scanner.stop();
    _scanner = null;
    console.log('[Checkin] scanner cleaned up');
  }
  _isProcessing = false;
  _lastPayload  = '';
}
