// src/main.ts
// Bootstrap: LIFF init + Router

import { LiffHelper } from './utils/liffHelper';
import { Store } from './store';
import { Api } from './api';
import { Toast } from './components/toast';
import { renderConsent } from './pages/consent';
import { renderEvents } from './pages/events';
import { renderEventDetail } from './pages/eventDetail';
import { renderRegister } from './pages/register';
import { renderBibCard } from './pages/bibCard';
import { renderMyRegistrations } from './pages/myRegistrations';
import type { PdpaStatus, User } from './types';

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  try {
    // เพิ่มใน bootstrap() function ใน main.ts
// วางก่อน LiffHelper.init()

import { AndroidWorkaround } from './utils/liffHelper';

async function bootstrap(): Promise<void> {
  try {
    // ── 0. Install Android workaround handlers ────────────
    AndroidWorkaround.installErrorHandler();

    // ตรวจสอบ stale session (Android เปิดรอบสอง)
    if (AndroidWorkaround.isAndroidLineWebView()) {
      console.log('[Bootstrap] Android LINE WebView detected');

      if (AndroidWorkaround.detectStaleSession()) {
        console.log('[Bootstrap] Stale session detected, proceeding with fresh init');
      }
    }
    // 1. Init LIFF (พร้อม Android workaround)
    const profile = await LiffHelper.init();
    // ── Save session (Android tracking) ──────────────────
    AndroidWorkaround.saveSession(profile.userId);

    // 2. Save idToken in-memory (never localStorage)
    Store.setState({
      liffProfile: profile,
      lineToken:   LiffHelper.getIdToken()
    });

    // 3. Sync profile → GAS
    const syncRes = await Api.syncProfile({
      displayName: profile.displayName,
      pictureUrl:  profile.pictureUrl
    });

    if (!syncRes.success) {
      throw new Error(syncRes.error || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }

    // 4. Check banned
    const userData = syncRes.data as User;
    if ((userData as any)?.status === 'banned') {
      showError('บัญชีถูกระงับการใช้งาน กรุณาติดต่อผู้จัดงาน');
      return;
    }

    Store.setState({ user: userData });

    // 5. Check PDPA
    const pdpaRes = await Api.getPdpaStatus(profile.userId);
    const pdpaStatus = pdpaRes.data as PdpaStatus;
    Store.setState({ pdpaStatus });

    if (pdpaStatus?.needReconsent) {
      Store.setRoute('consent');
    } else {
      // 6. Check URL params for deep link
      const urlParams = new URLSearchParams(window.location.search);
      const page      = urlParams.get('page');
      const regId     = urlParams.get('regId');
      const eventId   = urlParams.get('eventId');

      if (page === 'bib' && regId) {
        Store.setRoute('bib-card', { registrationId: regId });
      } else if (page === 'event' && eventId) {
        Store.setRoute('event-detail', { eventId });
      } else if (page === 'checkin') {
        Store.setRoute('checkin');
      } else {
        Store.setRoute('events');
      }
    }

    // 7. Hide initial loader + show app
    hideInitialLoader();

    // 8. Start router
    render();

  } catch (err) {
    console.error('[Bootstrap]', err);
    showError((err as Error).message);
  }
}

// ─────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────
function render(): void {
  const { currentRoute } = Store.getState();
  const { name, params } = currentRoute;

  console.log('[Router]', name, params);

  switch (name) {
    case 'consent':
      renderConsent(Store.getState().pdpaStatus!);
      break;

    case 'events':
      renderEvents();
      break;

    case 'event-detail':
      renderEventDetail(params.eventId);
      break;

    case 'register':
      renderRegister(params.eventId, params.distanceId);
      break;

    case 'bib-card':
      renderBibCard(params.registrationId);
      break;

    case 'my-registrations':
      renderMyRegistrations();
      break;

    case 'checkin':
      // Phase 5 จะ implement QR Scanner
      import('./pages/checkin').then(m => m.renderCheckin(params));
      break;

    case 'admin-dashboard':
    case 'admin-events':
    case 'admin-registrations':
    case 'admin-checkin':
    case 'admin-qr-print':
      // Phase 4 Admin pages
      import('./pages/admin/adminLayout').then(m => m.renderAdmin(name, params));
      break;

    case 'error':
      showError(params.message || 'เกิดข้อผิดพลาด');
      break;

    default:
      renderEvents();
  }
}

// ─────────────────────────────────────────────────────────────
// Subscribe to route changes
// ─────────────────────────────────────────────────────────────
window.addEventListener('route-change', () => {
  render();
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function hideInitialLoader(): void {
  const loader = document.getElementById('initial-loader');
  const app    = document.getElementById('app');
  if (loader) loader.style.display = 'none';
  if (app)    app.style.display    = 'block';
}

function showError(message: string): void {
  hideInitialLoader();
  const app = document.getElementById('app')!;
  app.style.display = 'block';
  app.innerHTML = `
    <div class="min-h-screen bg-runner-primary flex flex-col
                items-center justify-center px-6 text-center">
      <span class="text-6xl mb-6">⚠️</span>
      <h2 class="text-white text-xl font-bold mb-3">เกิดข้อผิดพลาด</h2>
      <p class="text-white/60 text-sm leading-relaxed mb-8">${message}</p>
      <button onclick="window.location.reload()"
        class="px-8 py-3 bg-white text-runner-primary font-bold
               rounded-2xl active:scale-95 transition-transform">
        ลองใหม่อีกครั้ง
      </button>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────
bootstrap();
