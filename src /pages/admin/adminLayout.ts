// src/pages/admin/adminLayout.ts
// Admin shell: auth guard + navigation + layout wrapper

import { Store } from '../../store';
import { Toast } from '../../components/toast';
import { Modal } from '../../components/modal';
import type { AdminSession, RouteName } from '../../types';

// Nav items
const NAV_ITEMS: Array<{
  id: RouteName;
  label: string;
  icon: string;
  roles: string[];
}> = [
  { id: 'admin-dashboard',      label: 'ภาพรวม',   icon: '📊', roles: ['superadmin','admin','staff'] },
  { id: 'admin-registrations',  label: 'สมัคร',     icon: '📋', roles: ['superadmin','admin','staff'] },
  { id: 'admin-events',         label: 'จัดการงาน', icon: '🏁', roles: ['superadmin','admin'] },
  { id: 'admin-checkin',        label: 'เช็คอิน',   icon: '✅', roles: ['superadmin','admin','staff'] },
  { id: 'admin-qr-print',       label: 'QR/พิมพ์',  icon: '🖨️', roles: ['superadmin','admin'] },
];

export async function renderAdmin(
  routeName: RouteName,
  params: Record<string, string>
): Promise<void> {
  // ── Auth Guard ───────────────────────────────────────────
  let session = Store.getAdminSession();
  if (!session) {
    await renderAdminLogin();
    return;
  }

  // ── Layout Shell ─────────────────────────────────────────
  const app = document.getElementById('app')!;
  const allowedNavs = NAV_ITEMS.filter(n => n.roles.includes(session!.role));

  app.innerHTML = `
    <div class="min-h-screen bg-gray-100 flex flex-col">

      <!-- Top Bar -->
      <header class="bg-runner-primary text-white px-4 py-3 sticky top-0 z-50 shadow-lg">
        <div class="max-w-7xl mx-auto flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-2xl">🏁</span>
            <div>
              <p class="font-bold text-sm leading-none">Runner Admin</p>
              <p class="text-white/50 text-xs">${session.displayName}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="px-2 py-1 bg-white/10 rounded-full text-xs font-medium capitalize">
              ${session.role}
            </span>
            <button id="btn-admin-logout"
              class="text-white/60 hover:text-white text-xs px-3 py-1.5
                     border border-white/20 rounded-full transition-colors">
              ออก
            </button>
          </div>
        </div>
      </header>

      <!-- Content Area -->
      <main class="flex-1 max-w-7xl mx-auto w-full px-4 py-5" id="admin-content">
        <!-- Loaded dynamically -->
      </main>

      <!-- Bottom Nav (Mobile) -->
      <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200
                  flex z-40 safe-area-bottom md:hidden">
        ${allowedNavs.map(nav => `
          <button
            class="admin-nav-btn flex-1 flex flex-col items-center gap-1 py-2.5
                   transition-colors text-gray-400 hover:text-runner-secondary
                   ${routeName === nav.id ? 'text-runner-secondary' : ''}"
            data-route="${nav.id}">
            <span class="text-xl leading-none">${nav.icon}</span>
            <span class="text-[10px] font-medium">${nav.label}</span>
          </button>`).join('')}
      </nav>

      <!-- Desktop Sidebar (hidden on mobile) -->
      <aside class="hidden md:flex fixed left-0 top-[56px] bottom-0 w-56
                    bg-white border-r border-gray-200 flex-col py-4 z-40">
        <nav class="px-3 space-y-1">
          ${allowedNavs.map(nav => `
            <button
              class="admin-nav-btn w-full flex items-center gap-3 px-4 py-3
                     rounded-xl text-sm font-medium transition-colors
                     ${routeName === nav.id
                       ? 'bg-runner-secondary text-white'
                       : 'text-gray-600 hover:bg-gray-100'}"
              data-route="${nav.id}">
              <span class="text-lg">${nav.icon}</span>
              ${nav.label}
            </button>`).join('')}
        </nav>
        <div class="mt-auto px-3">
          <button id="btn-go-runner"
            class="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-gray-400
                   hover:text-gray-600 border border-gray-200 rounded-xl transition-colors">
            <span>↩️</span> กลับหน้าหลัก
          </button>
        </div>
      </aside>
    </div>`;

  // Bind nav clicks
  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const route = (btn as HTMLElement).dataset.route as RouteName;
      Store.setRoute(route, params);
      window.dispatchEvent(new CustomEvent('route-change'));
    });
  });

  // Logout
  document.getElementById('btn-admin-logout')?.addEventListener('click', async () => {
    const ok = await Modal.confirm('ออกจากระบบ Admin?');
    if (!ok) return;
    Store.setAdminSession(null);
    Store.setRoute('events');
    window.dispatchEvent(new CustomEvent('route-change'));
  });

  // Back to runner
  document.getElementById('btn-go-runner')?.addEventListener('click', () => {
    Store.setRoute('events');
    window.dispatchEvent(new CustomEvent('route-change'));
  });

  // Add desktop padding for sidebar
  const content = document.getElementById('admin-content')!;
  if (window.innerWidth >= 768) {
    content.style.marginLeft = '224px';
  }

  // Load page content
  await loadAdminPage(routeName, params);
}

async function loadAdminPage(
  routeName: RouteName,
  params: Record<string, string>
): Promise<void> {
  const content = document.getElementById('admin-content');
  if (!content) return;

  try {
    switch (routeName) {
      case 'admin-dashboard':
        const { renderDashboard } = await import('./dashboard');
        await renderDashboard(content, params);
        break;

      case 'admin-registrations':
        const { renderRegistrations } = await import('./registrations');
        await renderRegistrations(content, params);
        break;

      case 'admin-events':
        const { renderEventCrud } = await import('./eventCrud');
        await renderEventCrud(content, params);
        break;

      case 'admin-checkin':
        const { renderCheckinDesk } = await import('./checkinDesk');
        await renderCheckinDesk(content, params);
        break;

      case 'admin-qr-print':
        const { renderQrPrint } = await import('./qrPrint');
        await renderQrPrint(content, params);
        break;

      default:
        content.innerHTML = `<div class="text-center py-20 text-gray-400">ไม่พบหน้า</div>`;
    }
  } catch (err) {
    Toast.error(`โหลดหน้าไม่สำเร็จ: ${(err as Error).message}`);
    content.innerHTML = `
      <div class="text-center py-20">
        <span class="text-4xl block mb-4">⚠️</span>
        <p class="text-gray-500">${(err as Error).message}</p>
      </div>`;
  }
}

// ─────────────────────────────────────────────────────────────
// Admin Login Page
// ─────────────────────────────────────────────────────────────
async function renderAdminLogin(): Promise<void> {
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <div class="min-h-screen bg-runner-primary flex flex-col items-center justify-center px-6">
      <div class="w-full max-w-sm">
        <div class="text-center mb-10">
          <span class="text-6xl block mb-4">🔐</span>
          <h1 class="text-white text-2xl font-bold">Admin Login</h1>
          <p class="text-white/50 text-sm mt-2">Runner Event Management</p>
        </div>

        <div class="bg-white rounded-3xl p-6 shadow-2xl shadow-black/30">
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                LINE User ID
              </label>
              <input id="admin-userid" type="text"
                placeholder="Uxxxxxxxxxxxxxxxx"
                class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-sm
                       focus:border-runner-secondary focus:outline-none transition-colors" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Admin Token
              </label>
              <input id="admin-token" type="password"
                placeholder="••••••••••••"
                class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-sm
                       focus:border-runner-secondary focus:outline-none transition-colors" />
            </div>
            <button id="btn-admin-login"
              class="w-full py-4 bg-runner-primary text-white font-bold rounded-2xl
                     text-base mt-2 active:scale-95 transition-transform
                     flex items-center justify-center gap-2">
              <span>🔑</span> เข้าสู่ระบบ
            </button>
          </div>
        </div>

        <button id="btn-back-runner"
          class="mt-4 w-full py-3 text-white/60 text-sm text-center">
          ← กลับหน้าหลัก
        </button>
      </div>
    </div>`;

  document.getElementById('btn-admin-login')!.addEventListener('click', handleAdminLogin);
  document.getElementById('admin-token')!.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') handleAdminLogin();
  });
  document.getElementById('btn-back-runner')!.addEventListener('click', () => {
    Store.setRoute('events');
    window.dispatchEvent(new CustomEvent('route-change'));
  });
}

async function handleAdminLogin(): Promise<void> {
  const userId = (document.getElementById('admin-userid') as HTMLInputElement).value.trim();
  const token  = (document.getElementById('admin-token') as HTMLInputElement).value.trim();
  const btn    = document.getElementById('btn-admin-login') as HTMLButtonElement;

  if (!userId || !token) { Toast.warning('กรุณากรอกข้อมูลให้ครบ'); return; }

  btn.disabled = true;
  btn.innerHTML = `<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>`;

  try {
    // Test admin credentials via getDashboard (ถ้าผ่านแสดงว่า valid)
    // ก่อน set session ใน store ชั่วคราวเพื่อใช้ใน Api.getDashboard
    const tempSession: AdminSession = {
      userId, adminToken: token,
      role: 'admin', displayName: 'Admin'
    };
    Store.setAdminSession(tempSession);

    // Verify โดย call API
    const { Api } = await import('../../api');
    const events = await Api.listAdminEvents();
    if (!events.success) throw new Error('Token ไม่ถูกต้อง');

    // TODO: ถ้าต้องการ role จาก API ให้เพิ่ม endpoint GET /admin/me
    // ตอนนี้ใช้ role จาก sheet ที่ GAS verify แล้ว
    Toast.success('เข้าสู่ระบบสำเร็จ');
    Store.setRoute('admin-dashboard', {});
    window.dispatchEvent(new CustomEvent('route-change'));

  } catch (err) {
    Store.setAdminSession(null);
    Toast.error('Token ไม่ถูกต้องหรือสิทธิ์ไม่เพียงพอ');
    btn.disabled = false;
    btn.innerHTML = '<span>🔑</span> เข้าสู่ระบบ';
  }
}
