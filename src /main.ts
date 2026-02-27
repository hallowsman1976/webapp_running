import { CONFIG } from './config';
import { callApi } from './api';
import { Store } from './store';
import { renderApp } from './pages/RunnerApp';
import { renderAdminApp } from './pages/AdminApp';

let isInitialized = false;

async function initializeApp() {
  if (isInitialized) return;
  try {
    await window.liff.init({ liffId: CONFIG.LIFF_ID });
    isInitialized = true;

    if (!window.liff.isLoggedIn()) { window.liff.login(); return; }

    const profile = await window.liff.getProfile();
    const loginResult = await callApi('login', { ...profile });

    Store.user = { ...profile, ...loginResult.user, needConsent: loginResult.needConsent };

    // [Android Workaround] คืนค่า State ถ้าเพิ่งสแกน QR 
    if (sessionStorage.getItem('returnToAdmin') === 'true') {
      sessionStorage.removeItem('returnToAdmin');
      Store.currentPage = 'admin';
      renderAdminApp();
      return;
    }

    if (Store.user.role === 'admin') {
      Store.currentPage = 'admin';
      renderAdminApp();
    } else if (Store.user.needConsent) {
      Store.currentPage = 'pdpa';
      renderApp();
    } else {
      Store.currentPage = 'events';
      Store.events = await callApi('getEvents');
      renderApp();
    }
  } catch (err) {
    document.getElementById('app')!.innerHTML = `<p class="p-4 text-red-500">Failed to init app</p>`;
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !isInitialized) initializeApp();
});

initializeApp();
