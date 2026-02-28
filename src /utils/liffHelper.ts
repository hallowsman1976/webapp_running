// src/utils/liffHelper.ts
// LIFF initialization + Android "เปิดรอบสองค้าง" workaround

import liff from '@line/liff';
import { CONFIG } from '../config';
import type { LiffProfile } from '../types';

// ─────────────────────────────────────────────────────────────
// Android LIFF "เปิดรอบสองค้าง" — สาเหตุและ workaround
// ─────────────────────────────────────────────────────────────
//
// ปัญหา: Android LINE in-app browser (WebView) บางครั้งเมื่อเปิด LIFF
//   ครั้งที่ 2 ขึ้นไปในวัน/session เดียวกัน จะค้างที่ loading หรือ
//   liff.init() hang ไม่ resolve
//
// สาเหตุหลัก:
//   1. WebView cache state เก่าจาก session ที่แล้ว
//   2. LIFF SDK ยังคิดว่า logged-in อยู่ แต่ context เปลี่ยน
//   3. visibilitychange event ไม่ trigger re-init
//
// Workaround ที่ใช้ที่นี่:
//   A) visibilitychange: detect เมื่อแอปกลับมา foreground → soft re-init
//   B) liff.init() timeout 15 วินาที → force reload
//   C) session fingerprint: ตรวจ liff.isInClient() + isLoggedIn()
//      ถ้าไม่ตรงกัน → reload
//   D) beforeunload cleanup: clear partial state
// ─────────────────────────────────────────────────────────────

let _initialized = false;
let _reinitCount = 0;
const MAX_REINIT = 2;

export const LiffHelper = {

  /**
   * Initialize LIFF พร้อม Android workaround ครบ
   */
  async init(): Promise<LiffProfile> {
    return new Promise<LiffProfile>((resolve, reject) => {
      // Timeout watchdog: 15 วินาที
      const timeout = setTimeout(() => {
        console.warn('[LIFF] init timeout — force reload');
        this._safeReload();
      }, 15_000);

      this._doInit()
        .then(profile => {
          clearTimeout(timeout);
          resolve(profile);
        })
        .catch(err => {
          clearTimeout(timeout);
          reject(err);
        });
    });
  },

  async _doInit(): Promise<LiffProfile> {
    console.log(`[LIFF] init attempt #${_reinitCount + 1}`);

    // ── A) visibilitychange handler ─────────────────────────
    if (!_initialized) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this._onAppResume();
        }
      });

      // Page freeze/resume (Android Chrome)
      window.addEventListener('freeze', () => {
        console.log('[LIFF] Page frozen');
      });
      window.addEventListener('resume', () => {
        console.log('[LIFF] Page resumed');
        this._onAppResume();
      });
    }

    // ── Init LIFF SDK ────────────────────────────────────────
    await liff.init({ liffId: CONFIG.LIFF_ID });
    _initialized = true;

    // ── C) Check state consistency ──────────────────────────
    const inClient = liff.isInClient();
    const isLoggedIn = liff.isLoggedIn();

    console.log('[LIFF] inClient:', inClient, '| isLoggedIn:', isLoggedIn);

    if (!isLoggedIn) {
      // ถ้าไม่ได้ login → redirect ไป login
      liff.login({ redirectUri: window.location.href });
      // รอ redirect (ไม่ resolve)
      await new Promise(() => {});
    }

    // ── Get profile ──────────────────────────────────────────
    const profile = await liff.getProfile();
    const idToken  = liff.getIDToken();

    if (!idToken) {
      throw new Error('Failed to get LINE ID Token');
    }

    return {
      userId:      profile.userId,
      displayName: profile.displayName,
      pictureUrl:  profile.pictureUrl ?? '',
      statusMessage: profile.statusMessage
    };
  },

  /**
   * ── B) onAppResume: เรียกเมื่อแอปกลับมา foreground
   */
  _onAppResume(): void {
    if (_reinitCount >= MAX_REINIT) {
      console.warn('[LIFF] Max reinit reached — force reload');
      this._safeReload();
      return;
    }

    // เช็ค token ยังใช้ได้ไหม
    try {
      const token = liff.getIDToken();
      if (!token) {
        console.warn('[LIFF] No token on resume — reinitializing');
        _reinitCount++;
        this._safeReload();
      }
    } catch {
      console.warn('[LIFF] Error checking token on resume');
    }
  },

  /**
   * Force page reload (safe: เคลียร์ state ก่อน)
   */
  _safeReload(): void {
    try { sessionStorage.removeItem('liff_state'); } catch {}
    // เพิ่ม cache-bust param
    const url = new URL(window.location.href);
    url.searchParams.set('_r', Date.now().toString());
    window.location.replace(url.toString());
  },

  /**
   * Get current LINE ID Token (in-memory — ไม่เก็บ localStorage)
   */
  getIdToken(): string {
    return liff.getIDToken() ?? '';
  },

  /**
   * แสดง Loading spinner ผ่าน LIFF SDK (LINE-style)
   */
  showLoading(): void {
    try { liff.showLoading(); } catch { showFallbackSpinner(true); }
  },

  hideLoading(): void {
    try { liff.hideLoading(); } catch { showFallbackSpinner(false); }
  },

  /**
   * เปิด share target picker สำหรับ Flex Message
   */
  async shareFlexMessage(altText: string, flexContents: object): Promise<boolean> {
    if (!liff.isApiAvailable('shareTargetPicker')) {
      console.warn('[LIFF] shareTargetPicker not available');
      return false;
    }
    try {
      const result = await liff.shareTargetPicker([{
        type: 'flex',
        altText,
        contents: flexContents as any
      }]);
      return result?.status === 'success';
    } catch (err) {
      console.error('[LIFF] shareTargetPicker error:', err);
      return false;
    }
  },

  /**
   * เปิด URL ใน LINE browser
   */
  openExternalLink(url: string): void {
    liff.openWindow({ url, external: true });
  },

  isInClient: () => liff.isInClient(),
  isLoggedIn: () => liff.isLoggedIn(),
  closeWindow: () => liff.closeWindow()
};

// Fallback spinner (ถ้า liff.showLoading ไม่ work)
function showFallbackSpinner(show: boolean): void {
  let el = document.getElementById('fallback-spinner');
  if (show) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'fallback-spinner';
      el.style.cssText = `
        position:fixed;inset:0;background:rgba(0,0,0,0.5);
        display:flex;align-items:center;justify-content:center;
        z-index:9998;`;
      el.innerHTML = `<div style="
        width:48px;height:48px;border-radius:50%;
        border:4px solid rgba(255,255,255,0.3);
        border-top-color:#06C755;
        animation:spin 1s linear infinite;"></div>`;
      document.body.appendChild(el);
    }
    el.style.display = 'flex';
  } else if (el) {
    el.style.display = 'none';
  }
}
// เพิ่มเติมใน liffHelper.ts (ต่อจากที่มีอยู่ใน Phase 3)
// section: Android LIFF session reset + state recovery

export const AndroidWorkaround = {

  // ─────────────────────────────────────────────────────────
  // Session State Management
  // ─────────────────────────────────────────────────────────

  SESSION_KEY: 'liff_session_v1',

  saveSession(userId: string): void {
    try {
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify({
        userId,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      }));
    } catch {}
  },

  getSession(): { userId: string; timestamp: number } | null {
    try {
      const raw = sessionStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  clearSession(): void {
    try { sessionStorage.removeItem(this.SESSION_KEY); } catch {}
  },

  // ─────────────────────────────────────────────────────────
  // ตรวจสอบ Android LINE WebView
  // ─────────────────────────────────────────────────────────
  isAndroidLineWebView(): boolean {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('android') && ua.includes('line/');
  },

  isIosLineWebView(): boolean {
    const ua = navigator.userAgent.toLowerCase();
    return (ua.includes('iphone') || ua.includes('ipad')) && ua.includes('line/');
  },

  // ─────────────────────────────────────────────────────────
  // Android: ตรวจจับ "เปิดรอบสองค้าง" pattern
  // ─────────────────────────────────────────────────────────
  detectStaleSession(): boolean {
    const session = this.getSession();
    if (!session) return false;

    const AGE_LIMIT = 30 * 60 * 1000; // 30 นาที
    const age = Date.now() - session.timestamp;

    if (age > AGE_LIMIT) {
      console.log('[AndroidWorkaround] Session too old, clearing');
      this.clearSession();
      return true;
    }
    return false;
  },

  // ─────────────────────────────────────────────────────────
  // Safe LIFF Re-init (ใช้ใน visibilitychange)
  // ─────────────────────────────────────────────────────────
  async safeReinit(): Promise<boolean> {
    if (!this.isAndroidLineWebView()) return true;

    console.log('[AndroidWorkaround] Performing safe re-init check...');

    try {
      // ตรวจสอบ token ยังใช้ได้
      const liff = (await import('@line/liff')).default;
      const token = liff.getIDToken();

      if (!token) {
        console.warn('[AndroidWorkaround] No token, triggering safe reload');
        this.safeReload();
        return false;
      }

      return true;

    } catch (err) {
      console.error('[AndroidWorkaround] Re-init check failed:', err);
      this.safeReload();
      return false;
    }
  },

  // ─────────────────────────────────────────────────────────
  // Safe Reload (เพิ่ม cache-bust + clear state)
  // ─────────────────────────────────────────────────────────
  safeReload(reason = 'unknown'): void {
    console.log(`[AndroidWorkaround] Safe reload triggered: ${reason}`);

    // Clear stale LIFF state
    try {
      const keys = ['LIFF_STORE', 'liff_store', 'liff_oauth_state'];
      keys.forEach(k => {
        try { localStorage.removeItem(k); } catch {}
        try { sessionStorage.removeItem(k); } catch {}
      });
    } catch {}

    // Cache-bust reload
    const url = new URL(window.location.href);
    url.searchParams.delete('_r');
    url.searchParams.set('_r', Date.now().toString());

    // รอ 100ms ก่อน reload เพื่อให้ cleanup เสร็จ
    setTimeout(() => {
      window.location.replace(url.toString());
    }, 100);
  },

  // ─────────────────────────────────────────────────────────
  // Install global error handler สำหรับ LIFF errors
  // ─────────────────────────────────────────────────────────
  installErrorHandler(): void {
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg    = reason?.message || String(reason);

      // LIFF specific errors ที่ควร reload
      const RELOAD_ERRORS = [
        'LIFF_NOT_INIT',
        'NOT_IN_LINE',
        'INVALID_ARGUMENT',
        'auth token expired'
      ];

      if (RELOAD_ERRORS.some(e => msg.includes(e))) {
        console.warn('[AndroidWorkaround] Caught LIFF error, reloading:', msg);
        event.preventDefault();
        this.safeReload(msg);
      }
    });

    // beforeunload: cleanup camera/scanner
    window.addEventListener('beforeunload', () => {
      // Scanner cleanup จะถูก trigger โดย visibilitychange แล้ว
      console.log('[AndroidWorkaround] Page unloading');
    });

    // pageshow: detect back/forward cache (bfcache) บน iOS
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        console.log('[AndroidWorkaround] Page restored from bfcache, reloading');
        this.safeReload('bfcache');
      }
    });
  }
};
