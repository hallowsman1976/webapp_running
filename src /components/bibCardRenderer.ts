// เพิ่ม import ที่ด้านบน bibCard.ts (แทนที่ buildBibFlex function เดิม)

import { FlexBuilder } from '../utils/flexMessage';
import { BibCardRenderer } from '../components/bibCardRenderer';
import { CONFIG } from '../config';

// ── แทนที่ bindActions function เดิม ───────────────────────
function bindActions(reg: Registration, event: Event, distance: EventDistance): void {
  const pictureUrl = Store.getState().liffProfile?.pictureUrl || '';
  const liffBaseUrl = CONFIG.GAS_WEBAPP_URL.replace('/exec', '');
  // ใช้ LIFF URL จริง: https://liff.line.me/{LIFF_ID}
  const liffUrl = `https://liff.line.me/${CONFIG.LIFF_ID}`;

  // ── Share Flex Message ─────────────────────────────────
  document.getElementById('btn-share')?.addEventListener('click', async () => {
    const flexContents = FlexBuilder.bibCard(reg, event, distance, liffUrl);
    const success = await LiffHelper.shareFlexMessage(
      `🎫 BIB Card: ${reg.bibNumber} — ${event.eventName}`,
      flexContents
    );
    if (success) Toast.success('แชร์บัตรสำเร็จ! 🎉');
    else Toast.warning('ไม่สามารถแชร์ได้ในขณะนี้');
  });

  // ── Share Event Promo ──────────────────────────────────
  document.getElementById('btn-share-event')?.addEventListener('click', async () => {
    const flexContents = FlexBuilder.eventPromo(event, [distance], liffUrl);
    const success = await LiffHelper.shareFlexMessage(
      `🏃 ${event.eventName} — ชวนเพื่อนสมัครวิ่ง!`,
      flexContents
    );
    if (success) Toast.success('แชร์งานวิ่งสำเร็จ!');
  });

  // ── Print BIB Card ─────────────────────────────────────
  document.getElementById('btn-print')?.addEventListener('click', () => {
    BibCardRenderer.print(reg, event, distance, pictureUrl);
  });

  // ── QR Checkin ─────────────────────────────────────────
  document.getElementById('btn-checkin-qr')?.addEventListener('click', () => {
    Store.setRoute('checkin', { registrationId: reg.registrationId });
    window.dispatchEvent(new CustomEvent('route-change'));
  });

  // ── My registrations ───────────────────────────────────
  document.getElementById('btn-my-regs')?.addEventListener('click', () => {
    Store.setRoute('my-registrations');
    window.dispatchEvent(new CustomEvent('route-change'));
  });
}

// ── อัปเดต Action Buttons HTML ใน renderCard() ─────────────
// แทนที่ส่วน "Action Buttons" ใน renderCard function
function renderActionButtons(reg: Registration): string {
  return `
    <!-- Action Buttons -->
    <div class="space-y-3">
      <!-- Share BIB -->
      <button id="btn-share"
        class="w-full py-4 bg-line-green text-white font-bold rounded-2xl
               text-base shadow-lg shadow-green-900/30 active:scale-95 transition-transform
               flex items-center justify-center gap-2">
        <span class="text-xl">📤</span> แชร์บัตรผ่าน LINE
      </button>

      <div class="grid grid-cols-2 gap-3">
        <!-- Share Event (ชวนเพื่อน) -->
        <button id="btn-share-event"
          class="py-3.5 bg-white/10 backdrop-blur-sm text-white font-semibold
                 rounded-2xl text-sm active:scale-95 transition-transform
                 flex items-center justify-center gap-2 border border-white/20">
          <span>📣</span> ชวนเพื่อน
        </button>

        <!-- Print -->
        <button id="btn-print"
          class="py-3.5 bg-white/10 backdrop-blur-sm text-white font-semibold
                 rounded-2xl text-sm active:scale-95 transition-transform
                 flex items-center justify-center gap-2 border border-white/20">
          <span>🖨️</span> พิมพ์บัตร
        </button>
      </div>

      ${reg.status === 'approved' && reg.checkinStatus !== 'checked'
        ? `<button id="btn-checkin-qr"
             class="w-full py-4 bg-runner-secondary text-white font-bold rounded-2xl
                    text-base shadow-md shadow-blue-900/30 active:scale-95 transition-transform
                    flex items-center justify-center gap-2">
             <span class="text-xl">📷</span> สแกน QR เช็คอิน
           </button>`
        : reg.checkinStatus === 'checked'
        ? `<div class="w-full py-3 text-center text-green-400 font-semibold text-sm">
             ✅ เช็คอินสำเร็จแล้ว
           </div>`
        : ''}

      <button id="btn-my-regs"
        class="w-full py-3 border-2 border-white/20 text-white/80 font-medium
               rounded-2xl text-sm active:scale-95 transition-transform">
        📋 รายการสมัครทั้งหมด
      </button>
    </div>`;
}
