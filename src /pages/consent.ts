// src/pages/consent.ts
// PDPA Consent Page

import { Store } from '../store';
import { Api } from '../api';
import { Toast } from '../components/toast';
import { Modal } from '../components/modal';
import type { PdpaStatus } from '../types';

export function renderConsent(pdpaStatus: PdpaStatus): void {
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-runner-primary to-[#16213e]
                flex flex-col">

      <!-- Header -->
      <div class="px-6 pt-12 pb-8 text-center">
        <div class="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center
                    mx-auto mb-4 backdrop-blur-sm">
          <span class="text-4xl">🛡️</span>
        </div>
        <h1 class="text-white text-2xl font-bold mb-2">นโยบายความเป็นส่วนตัว</h1>
        <p class="text-white/60 text-sm">PDPA v${pdpaStatus.currentVersion}</p>
      </div>

      <!-- Content Card -->
      <div class="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-6 overflow-y-auto">

        <div class="max-w-md mx-auto">
          <!-- PDPA Text -->
          <div class="bg-gray-50 rounded-2xl p-5 mb-6 max-h-64 overflow-y-auto
                      border border-gray-100">
            <h2 class="font-semibold text-runner-primary mb-3 text-sm">
              ข้อตกลงการเก็บรวบรวมข้อมูลส่วนบุคคล
            </h2>
            <p class="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              ${pdpaStatus.pdpaText}
            </p>
          </div>

          <!-- Data collected -->
          <div class="mb-6">
            <h3 class="font-semibold text-runner-primary mb-3 text-sm">
              ข้อมูลที่เก็บรวบรวม
            </h3>
            <div class="space-y-2">
              ${[
                ['👤', 'LINE User ID และชื่อที่แสดง', 'สำหรับยืนยันตัวตน'],
                ['📸', 'รูปโปรไฟล์ LINE', 'แสดงบน BIB Card'],
                ['📝', 'ข้อมูลการสมัคร', 'ชื่อ-นามสกุล, วันเกิด, เบอร์ฉุกเฉิน'],
                ['📍', 'ข้อมูลการเช็คอิน', 'เวลาและสถานที่เช็คอิน']
              ].map(([icon, title, desc]) => `
                <div class="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                  <span class="text-lg mt-0.5">${icon}</span>
                  <div>
                    <p class="text-sm font-medium text-runner-primary">${title}</p>
                    <p class="text-xs text-gray-500">${desc}</p>
                  </div>
                </div>`).join('')}
            </div>
          </div>

          <!-- Rights -->
          <div class="bg-green-50 rounded-2xl p-4 mb-8 border border-green-100">
            <p class="text-xs text-green-700 leading-relaxed">
              <strong>สิทธิ์ของคุณ:</strong> คุณมีสิทธิ์ขอดู แก้ไข หรือลบข้อมูลส่วนตัวของคุณ
              โดยติดต่อผู้จัดงานได้ตลอดเวลา
            </p>
          </div>

          <!-- Buttons -->
          <div class="space-y-3">
            <button id="btn-accept"
              class="w-full py-4 bg-line-green text-white font-bold rounded-2xl
                     text-base shadow-lg shadow-green-200 active:scale-95 transition-transform
                     flex items-center justify-center gap-2">
              <span class="text-xl">✅</span>
              ยอมรับและดำเนินการต่อ
            </button>

            <button id="btn-decline"
              class="w-full py-3 border-2 border-gray-200 text-gray-500 font-medium
                     rounded-2xl text-sm active:scale-95 transition-transform">
              ไม่ยอมรับ
            </button>
          </div>

          <p class="text-center text-xs text-gray-400 mt-4">
            การยอมรับ PDPA จำเป็นสำหรับการใช้งานแอป
          </p>
        </div>
      </div>
    </div>`;

  // Event listeners
  document.getElementById('btn-accept')!.addEventListener('click', () => handleConsent('accepted'));
  document.getElementById('btn-decline')!.addEventListener('click', () => handleDecline());
}

async function handleConsent(action: 'accepted' | 'declined'): Promise<void> {
  const btn = document.getElementById('btn-accept') as HTMLButtonElement;
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>'; }

  try {
    const state = Store.getState();
    const res = await Api.recordConsent(action, state.pdpaStatus?.currentVersion || '1.0');

    if (!res.success) throw new Error(res.error || 'บันทึกไม่สำเร็จ');

    // อัปเดต store
    Store.setState({
      user: { ...state.user!, pdpaConsented: true, pdpaVersion: state.pdpaStatus?.currentVersion || '1.0' },
      pdpaStatus: { ...state.pdpaStatus!, consented: true, needReconsent: false }
    });

    Toast.success('ยืนยัน PDPA เรียบร้อยแล้ว');
    // Navigate ไป events
    Store.setRoute('events');
    // Trigger re-render
    window.dispatchEvent(new CustomEvent('route-change'));

  } catch (err) {
    Toast.error(`เกิดข้อผิดพลาด: ${(err as Error).message}`);
    if (btn) { btn.disabled = false; btn.innerHTML = '<span class="text-xl">✅</span> ยอมรับและดำเนินการต่อ'; }
  }
}

async function handleDecline(): Promise<void> {
  const confirmed = await Modal.confirm(
    'ไม่ยอมรับนโยบาย?',
    'หากไม่ยอมรับ PDPA คุณจะไม่สามารถใช้งานแอปนี้ได้'
  );

  if (!confirmed) return;

  await Api.recordConsent('declined', Store.getState().pdpaStatus?.currentVersion || '1.0');
  Toast.info('คุณปฏิเสธ PDPA กรุณาปิดแอป');
}
