// src/pages/bibCard.ts
// BIB Card / Runner Card Page — สมบูรณ์ทั้งไฟล์
// รวม: display, share Flex Message, share Event Promo, print, QR checkin

import { Store } from '../store';
import { Api } from '../api';
import { LiffHelper } from '../utils/liffHelper';
import { FlexBuilder } from '../utils/flexMessage';
import { BibCardRenderer } from '../components/bibCardRenderer';
import { Toast } from '../components/toast';
import { Modal } from '../components/modal';
import { renderInlineSpinner } from '../components/spinner';
import { DateHelper } from '../utils/dateHelper';
import { CONFIG } from '../config';
import type { Registration, Event, EventDistance } from '../types';

// ─────────────────────────────────────────────────────────────
// Page Entry Point
// ─────────────────────────────────────────────────────────────

export async function renderBibCard(registrationId: string): Promise<void> {
  if (!registrationId) {
    renderError('ไม่พบข้อมูลการสมัคร');
    return;
  }

  const app = document.getElementById('app')!;

  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-runner-primary via-[#16213e] to-[#0f3460]">

      <!-- Top Bar -->
      <div class="flex items-center justify-between px-4 py-3 pt-safe-top sticky top-0 z-40
                  bg-runner-primary/80 backdrop-blur-md">
        <button id="btn-back"
          class="text-white/80 hover:text-white p-2 -ml-2
                 active:scale-90 transition-transform rounded-xl">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>

        <h1 class="text-white font-bold text-base">🎫 BIB Card</h1>

        <button id="btn-refresh"
          class="text-white/70 hover:text-white p-2 -mr-2
                 active:scale-90 transition-transform rounded-xl"
          title="รีเฟรช">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0
                     004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003
                     8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div id="bib-content" class="px-4 pb-10">
        ${renderLoadingSkeleton()}
      </div>
    </div>`;

  // ── Event Listeners ──────────────────────────────────────
  document.getElementById('btn-back')!.addEventListener('click', handleBack);
  document.getElementById('btn-refresh')!.addEventListener('click', () => {
    loadBibCard(registrationId);
  });

  // ── Load Data ────────────────────────────────────────────
  await loadBibCard(registrationId);
}

// ─────────────────────────────────────────────────────────────
// Load & Render
// ─────────────────────────────────────────────────────────────

async function loadBibCard(registrationId: string): Promise<void> {
  const content = document.getElementById('bib-content');
  if (!content) return;

  // แสดง skeleton ระหว่างโหลด (ถ้าเนื้อหามีอยู่แล้วให้ fade)
  content.style.opacity = '0.5';

  try {
    const res = await Api.getRegistration(registrationId);

    if (!res.success || !res.data) {
      throw new Error(res.error || 'ไม่พบข้อมูลการสมัคร');
    }

    const { registration, event, distance } = res.data as {
      registration: Registration;
      event: Event;
      distance: EventDistance;
    };

    if (!registration || !event || !distance) {
      throw new Error('ข้อมูลไม่ครบถ้วน');
    }

    content.style.opacity = '1';
    content.innerHTML = renderPageContent(registration, event, distance);

    bindAllActions(registration, event, distance);

  } catch (err) {
    content.style.opacity = '1';
    content.innerHTML = renderErrorContent((err as Error).message);
    Toast.error(`โหลด BIB Card ไม่สำเร็จ: ${(err as Error).message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Render Page Content
// ─────────────────────────────────────────────────────────────

function renderPageContent(
  reg: Registration,
  event: Event,
  distance: EventDistance
): string {
  const pictureUrl = Store.getState().liffProfile?.pictureUrl || '';

  return `
    <!-- BIB Card Visual -->
    <div class="mt-4 mb-6">
      ${renderBibCardVisual(reg, event, distance, pictureUrl)}
    </div>

    <!-- Event Info Strip -->
    ${renderEventInfoStrip(event)}

    <!-- Runner Details -->
    ${renderRunnerDetails(reg, distance)}

    <!-- Status Card -->
    ${renderStatusCard(reg)}

    <!-- Action Buttons -->
    ${renderActionButtons(reg)}

    <!-- Footer Note -->
    <p class="text-center text-white/30 text-xs mt-6 pb-2">
      Runner Event Mini App • ${CONFIG.APP_NAME}
    </p>`;
}

// ─────────────────────────────────────────────────────────────
// BIB Card Visual (หัวใจของหน้า)
// ─────────────────────────────────────────────────────────────

function renderBibCardVisual(
  reg: Registration,
  event: Event,
  distance: EventDistance,
  pictureUrl: string
): string {
  const isChecked  = reg.checkinStatus === 'checked';
  const isApproved = reg.status === 'approved';
  const isPending  = reg.status === 'pending';

  const bibColor   = isChecked ? '#00C851' : '#4A90D9';
  const glowClass  = isChecked
    ? 'shadow-2xl shadow-green-900/40'
    : 'shadow-2xl shadow-blue-900/40';

  return `
    <div class="bg-white rounded-3xl overflow-hidden ${glowClass}
                animate-fade-in" id="bib-card-visual">

      <!-- ─── Cover Image ─── -->
      <div class="relative h-44 overflow-hidden
                  bg-gradient-to-br from-runner-primary to-runner-secondary">
        ${event.coverImageUrl
          ? `<img
               src="${event.coverImageUrl}"
               alt="${escapeHtml(event.eventName)}"
               class="w-full h-full object-cover"
               loading="eager"
               onerror="this.style.display='none'" />`
          : `<div class="w-full h-full flex items-center justify-center">
               <span class="text-7xl">🏃</span>
             </div>`}
        <!-- Gradient overlay -->
        <div class="absolute inset-0 bg-gradient-to-t
                    from-black/70 via-black/20 to-transparent"></div>

        <!-- Event info on image -->
        <div class="absolute bottom-0 left-0 right-0 px-5 pb-4">
          <p class="text-white font-bold text-base leading-snug line-clamp-2 mb-1">
            ${escapeHtml(event.eventName)}
          </p>
          <div class="flex items-center gap-3 text-white/70 text-xs">
            <span>📅 ${DateHelper.formatThai(event.eventDate)}</span>
            <span>📍 ${escapeHtml(event.eventLocation)}</span>
          </div>
        </div>
      </div>

      <!-- ─── BIB Number Section ─── -->
      <div class="bg-runner-primary px-6 py-5
                  flex items-center justify-between gap-4">
        <div class="flex-1 min-w-0">
          <p class="text-white/40 text-[10px] font-bold tracking-[4px] uppercase mb-1">
            BIB NUMBER
          </p>
          <p class="text-white font-black leading-none mb-2"
             style="font-size: clamp(36px, 12vw, 56px); letter-spacing: 2px;">
            ${escapeHtml(reg.bibNumber)}
          </p>
          <div class="flex items-center gap-2">
            <span class="px-3 py-1 bg-runner-secondary/30 text-runner-secondary
                         text-sm font-bold rounded-full border border-runner-secondary/30">
              ${escapeHtml(distance.distanceName)}
            </span>
            <span class="text-white/40 text-xs">
              ${distance.distanceKm} km
            </span>
          </div>
        </div>

        <!-- Profile Photo -->
        <div class="shrink-0">
          ${pictureUrl
            ? `<img
                 src="${pictureUrl}"
                 alt="profile"
                 class="w-20 h-20 rounded-2xl object-cover
                        ring-4 ring-white/20 shadow-xl" />`
            : `<div class="w-20 h-20 rounded-2xl bg-white/10
                           flex items-center justify-center
                           ring-4 ring-white/20">
                 <span class="text-3xl">👤</span>
               </div>`}
        </div>
      </div>

      <!-- ─── Runner Info Grid ─── -->
      <div class="px-5 py-4 grid grid-cols-2 gap-x-4 gap-y-3">
        ${[
          ['ชื่อ-นามสกุล', `${escapeHtml(reg.firstName)} ${escapeHtml(reg.lastName)}`],
          ['ขนาดเสื้อ',    reg.shirtSize],
          ['เพศ',          reg.gender === 'M' ? 'ชาย 👨' : reg.gender === 'F' ? 'หญิง 👩' : 'อื่นๆ 🧑'],
          ['วันเกิด',      DateHelper.formatThai(reg.birthDate)]
        ].map(([label, value]) => `
          <div>
            <p class="text-xs text-gray-400 mb-0.5">${label}</p>
            <p class="font-semibold text-runner-primary text-sm leading-snug">
              ${value}
            </p>
          </div>`).join('')}
      </div>

      <!-- ─── Check-in Status Bar ─── -->
      <div class="mx-4 mb-4 rounded-2xl overflow-hidden">
        <div class="flex items-center gap-3 px-4 py-3
          ${isChecked
            ? 'bg-green-50 border border-green-200'
            : isPending
            ? 'bg-yellow-50 border border-yellow-200'
            : 'bg-blue-50 border border-blue-200'}">
          <div class="w-3 h-3 rounded-full shrink-0
            ${isChecked ? 'bg-green-500' : isPending ? 'bg-yellow-400 animate-pulse' : 'bg-blue-400'}">
          </div>
          <div class="flex-1">
            <p class="text-sm font-bold
              ${isChecked ? 'text-green-700' : isPending ? 'text-yellow-700' : 'text-blue-700'}">
              ${isChecked
                ? '✅ เช็คอินแล้ว'
                : isPending
                ? '⏳ รอการอนุมัติจากผู้จัด'
                : '🎫 อนุมัติแล้ว รอเช็คอิน'}
            </p>
            ${isChecked && reg.checkinAt
              ? `<p class="text-xs text-green-500 mt-0.5">
                   เมื่อ ${DateHelper.formatThaiDateTime(reg.checkinAt)}
                 </p>`
              : isPending
              ? `<p class="text-xs text-yellow-500 mt-0.5">
                   ผู้จัดงานจะแจ้งผลทาง LINE
                 </p>`
              : `<p class="text-xs text-blue-500 mt-0.5">
                   แสดงบัตรนี้ที่จุดเช็คอินในวันงาน
                 </p>`}
          </div>
          ${isApproved && !isChecked
            ? `<span class="shrink-0 px-3 py-1.5 bg-blue-500 text-white
                           text-xs font-bold rounded-xl active:scale-95
                           transition-transform cursor-pointer" id="btn-checkin-inline">
                 เช็คอิน
               </span>`
            : ''}
        </div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Sub-sections
// ─────────────────────────────────────────────────────────────

function renderEventInfoStrip(event: Event): string {
  const daysUntil = DateHelper.daysUntil(event.eventDate);
  const isUpcoming = daysUntil > 0;
  const isToday    = daysUntil === 0;

  return `
    <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4
                border border-white/10">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-white/50 text-xs mb-1">วันแข่งขัน</p>
          <p class="text-white font-bold text-base">
            ${DateHelper.formatThai(event.eventDate)}
          </p>
        </div>
        <div class="text-right">
          ${isToday
            ? `<span class="px-3 py-1.5 bg-line-green text-white text-sm
                           font-bold rounded-full animate-pulse">
                 🏃 วันนี้เลย!
               </span>`
            : isUpcoming
            ? `<div>
                 <p class="text-white/50 text-xs mb-0.5">อีกกี่วัน</p>
                 <p class="text-white font-black text-2xl">${daysUntil}</p>
                 <p class="text-white/50 text-xs">วัน</p>
               </div>`
            : `<span class="px-3 py-1 bg-gray-500/30 text-gray-300
                          text-xs font-medium rounded-full">
                 จบงานแล้ว
               </span>`}
        </div>
      </div>
      <div class="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
        <span class="text-lg">📍</span>
        <p class="text-white/70 text-sm">${escapeHtml(event.eventLocation)}</p>
      </div>
    </div>`;
}

function renderRunnerDetails(
  reg: Registration,
  distance: EventDistance
): string {
  return `
    <div class="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4
                border border-white/10">
      <h3 class="text-white/60 text-xs font-semibold uppercase tracking-widest mb-3">
        ข้อมูลผู้สมัคร
      </h3>
      <div class="space-y-2.5">
        ${[
          ['ราคา',             distance.price > 0 ? `฿${Number(distance.price).toLocaleString()}` : 'ฟรี'],
          ['สถานะการชำระ',    reg.paymentStatus === 'paid' ? '✅ ชำระแล้ว' : reg.paymentStatus === 'waived' ? '✅ ยกเว้น' : '⏳ ยังไม่ชำระ'],
          ['ผู้ติดต่อฉุกเฉิน', `${escapeHtml(reg.emergencyContact)} (${escapeHtml(reg.emergencyPhone)})`],
          ['วันที่สมัคร',      DateHelper.formatThaiDateTime(reg.createdAt)]
        ].map(([label, value]) => `
          <div class="flex items-start justify-between gap-3">
            <span class="text-white/50 text-xs shrink-0 mt-0.5">${label}</span>
            <span class="text-white text-xs font-medium text-right">${value}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderStatusCard(reg: Registration): string {
  const statusMap: Record<string, { icon: string; label: string; desc: string; color: string }> = {
    pending: {
      icon: '⏳', label: 'รอการอนุมัติ',
      desc: 'ผู้จัดงานจะตรวจสอบและอนุมัติภายใน 1-3 วันทำการ',
      color: 'bg-yellow-900/30 border-yellow-600/30'
    },
    approved: {
      icon: '✅', label: 'อนุมัติแล้ว',
      desc: 'การสมัครได้รับการอนุมัติแล้ว พร้อมเช็คอินในวันงาน',
      color: 'bg-green-900/30 border-green-600/30'
    },
    rejected: {
      icon: '❌', label: 'ไม่ผ่านการอนุมัติ',
      desc: 'กรุณาติดต่อผู้จัดงานเพื่อสอบถามรายละเอียด',
      color: 'bg-red-900/30 border-red-600/30'
    },
    cancelled: {
      icon: '🚫', label: 'ยกเลิกการสมัคร',
      desc: 'การสมัครนี้ถูกยกเลิกแล้ว',
      color: 'bg-gray-800/50 border-gray-600/30'
    }
  };

  const s = statusMap[reg.status] || statusMap.pending;

  return `
    <div class="rounded-2xl p-4 mb-4 border ${s.color}">
      <div class="flex items-center gap-3">
        <span class="text-2xl">${s.icon}</span>
        <div class="flex-1">
          <p class="text-white font-bold text-sm">${s.label}</p>
          <p class="text-white/50 text-xs mt-0.5">${s.desc}</p>
        </div>
      </div>
      ${reg.approvedAt && reg.status === 'approved'
        ? `<p class="text-white/30 text-xs mt-2 pl-9">
             อนุมัติเมื่อ ${DateHelper.formatThaiDateTime(reg.approvedAt)}
           </p>`
        : ''}
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Action Buttons
// ─────────────────────────────────────────────────────────────

function renderActionButtons(reg: Registration): string {
  const isApproved = reg.status === 'approved';
  const isChecked  = reg.checkinStatus === 'checked';
  const isPending  = reg.status === 'pending';

  return `
    <div class="space-y-3">

      <!-- ── Share BIB Card (LINE) ── -->
      <button id="btn-share-bib"
        class="w-full py-4 rounded-2xl font-bold text-base
               flex items-center justify-center gap-3
               active:scale-[0.97] transition-transform
               bg-line-green text-white shadow-lg shadow-green-900/40">
        <span class="text-xl">📤</span>
        <span>แชร์บัตรผ่าน LINE</span>
      </button>

      <!-- ── Row: Share Event + Print ── -->
      <div class="grid grid-cols-2 gap-3">
        <button id="btn-share-event"
          class="py-3.5 rounded-2xl font-semibold text-sm
                 flex items-center justify-center gap-2
                 active:scale-[0.97] transition-transform
                 bg-white/10 text-white border border-white/20
                 backdrop-blur-sm">
          <span>📣</span>
          <span>ชวนเพื่อน</span>
        </button>

        <button id="btn-print-bib"
          class="py-3.5 rounded-2xl font-semibold text-sm
                 flex items-center justify-center gap-2
                 active:scale-[0.97] transition-transform
                 bg-white/10 text-white border border-white/20
                 backdrop-blur-sm">
          <span>🖨️</span>
          <span>พิมพ์บัตร</span>
        </button>
      </div>

      <!-- ── QR Self Check-in (เฉพาะ approved + ยังไม่เช็คอิน) ── -->
      ${isApproved && !isChecked
        ? `<button id="btn-checkin-qr"
             class="w-full py-4 rounded-2xl font-bold text-base
                    flex items-center justify-center gap-3
                    active:scale-[0.97] transition-transform
                    bg-runner-secondary text-white
                    shadow-lg shadow-blue-900/40">
             <span class="text-xl">📷</span>
             <span>สแกน QR เช็คอิน</span>
           </button>`
        : ''}

      <!-- ── Already Checked In ── -->
      ${isChecked
        ? `<div class="w-full py-4 rounded-2xl text-center
                       bg-green-900/30 border border-green-500/30">
             <p class="text-green-400 font-bold">✅ เช็คอินสำเร็จแล้ว</p>
             <p class="text-green-500/60 text-xs mt-0.5">
               ${DateHelper.formatThaiDateTime(reg.checkinAt)}
             </p>
           </div>`
        : ''}

      <!-- ── Pending Notice ── -->
      ${isPending
        ? `<div class="w-full py-3 px-4 rounded-2xl text-center
                       bg-yellow-900/20 border border-yellow-500/20">
             <p class="text-yellow-400/80 text-sm font-medium">
               ⏳ รอผู้จัดงานอนุมัติก่อนเช็คอินได้
             </p>
           </div>`
        : ''}

      <!-- ── Divider ── -->
      <div class="border-t border-white/10 pt-3">

        <!-- My Registrations -->
        <button id="btn-my-regs"
          class="w-full py-3 rounded-2xl font-medium text-sm
                 flex items-center justify-center gap-2
                 active:scale-[0.97] transition-transform
                 text-white/60 hover:text-white/80
                 border border-white/10 hover:border-white/20
                 transition-colors">
          <span>📋</span>
          <span>รายการสมัครทั้งหมดของฉัน</span>
        </button>

        <!-- Back to Events -->
        <button id="btn-back-events"
          class="w-full py-3 rounded-2xl font-medium text-sm
                 flex items-center justify-center gap-2
                 active:scale-[0.97] transition-transform
                 text-white/40 hover:text-white/60
                 mt-2 transition-colors">
          <span>🏠</span>
          <span>กลับหน้าหลัก</span>
        </button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Bind All Actions
// ─────────────────────────────────────────────────────────────

function bindAllActions(
  reg: Registration,
  event: Event,
  distance: EventDistance
): void {
  const state       = Store.getState();
  const pictureUrl  = state.liffProfile?.pictureUrl || '';
  const liffUrl     = `https://liff.line.me/${CONFIG.LIFF_ID}`;

  // ── Share BIB Card Flex ────────────────────────────────
  document.getElementById('btn-share-bib')
    ?.addEventListener('click', () =>
      handleShareBib(reg, event, distance, liffUrl)
    );

  // ── Share Event Promo Flex ─────────────────────────────
  document.getElementById('btn-share-event')
    ?.addEventListener('click', () =>
      handleShareEvent(event, distance, liffUrl)
    );

  // ── Print BIB Card ─────────────────────────────────────
  document.getElementById('btn-print-bib')
    ?.addEventListener('click', () =>
      handlePrint(reg, event, distance, pictureUrl)
    );

  // ── QR Check-in ────────────────────────────────────────
  document.getElementById('btn-checkin-qr')
    ?.addEventListener('click', () =>
      handleOpenCheckin(reg.registrationId)
    );

  // ── Inline Check-in (จากบัตร) ──────────────────────────
  document.getElementById('btn-checkin-inline')
    ?.addEventListener('click', () =>
      handleOpenCheckin(reg.registrationId)
    );

  // ── My Registrations ───────────────────────────────────
  document.getElementById('btn-my-regs')
    ?.addEventListener('click', () => {
      Store.setRoute('my-registrations');
      window.dispatchEvent(new CustomEvent('route-change'));
    });

  // ── Back to Events ─────────────────────────────────────
  document.getElementById('btn-back-events')
    ?.addEventListener('click', () => {
      Store.setRoute('events');
      window.dispatchEvent(new CustomEvent('route-change'));
    });
}

// ─────────────────────────────────────────────────────────────
// Action Handlers
// ─────────────────────────────────────────────────────────────

async function handleShareBib(
  reg: Registration,
  event: Event,
  distance: EventDistance,
  liffUrl: string
): Promise<void> {
  const btn = document.getElementById('btn-share-bib') as HTMLButtonElement;

  // Optimistic UI
  btn.disabled = true;
  btn.innerHTML = `
    <div class="w-5 h-5 border-2 border-white/30 border-t-white
                rounded-full animate-spin"></div>
    <span>กำลังเปิด LINE Share...</span>`;

  try {
    const flexContents = FlexBuilder.bibCard(reg, event, distance, liffUrl);
    const altText = `🎫 BIB Card: ${reg.bibNumber} — ${event.eventName}`;

    const success = await LiffHelper.shareFlexMessage(altText, flexContents);

    if (success) {
      Toast.success('แชร์บัตรสำเร็จ! 🎉');
    } else {
      Toast.info('ยกเลิกการแชร์');
    }
  } catch (err) {
    Toast.error(`แชร์ไม่สำเร็จ: ${(err as Error).message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="text-xl">📤</span><span>แชร์บัตรผ่าน LINE</span>`;
  }
}

async function handleShareEvent(
  event: Event,
  distance: EventDistance,
  liffUrl: string
): Promise<void> {
  const btn = document.getElementById('btn-share-event') as HTMLButtonElement;

  btn.disabled = true;
  btn.innerHTML = `
    <div class="w-4 h-4 border-2 border-white/30 border-t-white
                rounded-full animate-spin"></div>`;

  try {
    const flexContents = FlexBuilder.eventPromo(event, [distance], liffUrl);
    const altText = `🏃 ${event.eventName} — ชวนเพื่อนสมัครวิ่ง!`;

    const success = await LiffHelper.shareFlexMessage(altText, flexContents);
    if (success) Toast.success('ชวนเพื่อนสำเร็จ!');
    else Toast.info('ยกเลิกการแชร์');
  } catch (err) {
    Toast.error(`แชร์ไม่สำเร็จ: ${(err as Error).message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span>📣</span><span>ชวนเพื่อน</span>`;
  }
}

async function handlePrint(
  reg: Registration,
  event: Event,
  distance: EventDistance,
  pictureUrl: string
): Promise<void> {
  const btn = document.getElementById('btn-print-bib') as HTMLButtonElement;

  // confirm ก่อน print บน mobile
  if (window.innerWidth < 768) {
    const ok = await Modal.confirm(
      'พิมพ์ BIB Card?',
      'จะเปิดหน้าต่างใหม่เพื่อพิมพ์ กรุณาอนุญาต popup'
    );
    if (!ok) return;
  }

  btn.disabled = true;
  btn.innerHTML = `<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>`;

  try {
    BibCardRenderer.print(reg, event, distance, pictureUrl);
    Toast.info('เปิดหน้าต่างพิมพ์แล้ว');
  } catch (err) {
    Toast.error(`เปิดหน้าพิมพ์ไม่สำเร็จ: ${(err as Error).message}`);
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = `<span>🖨️</span><span>พิมพ์บัตร</span>`;
    }, 1500);
  }
}

function handleOpenCheckin(registrationId: string): void {
  Store.setRoute('checkin', { registrationId });
  window.dispatchEvent(new CustomEvent('route-change'));
}

function handleBack(): void {
  Store.goBack();
  window.dispatchEvent(new CustomEvent('route-change'));
}

// ─────────────────────────────────────────────────────────────
// Loading Skeleton
// ─────────────────────────────────────────────────────────────

function renderLoadingSkeleton(): string {
  return `
    <div class="mt-4 space-y-4 animate-pulse">
      <!-- Card skeleton -->
      <div class="bg-white rounded-3xl overflow-hidden shadow-2xl">
        <!-- Cover -->
        <div class="h-44 bg-gray-300"></div>
        <!-- BIB section -->
        <div class="bg-gray-800 px-6 py-5 flex items-center justify-between gap-4">
          <div class="space-y-2 flex-1">
            <div class="h-3 bg-gray-700 rounded w-24"></div>
            <div class="h-12 bg-gray-600 rounded w-40"></div>
            <div class="h-5 bg-gray-700 rounded w-20"></div>
          </div>
          <div class="w-20 h-20 bg-gray-600 rounded-2xl"></div>
        </div>
        <!-- Info grid -->
        <div class="px-5 py-4 grid grid-cols-2 gap-3">
          ${Array(4).fill(0).map(() => `
            <div class="space-y-1">
              <div class="h-3 bg-gray-200 rounded w-16"></div>
              <div class="h-4 bg-gray-300 rounded w-24"></div>
            </div>`).join('')}
        </div>
        <!-- Status bar -->
        <div class="mx-4 mb-4 h-12 bg-gray-100 rounded-2xl"></div>
      </div>

      <!-- Info strips -->
      <div class="h-20 bg-white/10 rounded-2xl"></div>
      <div class="h-28 bg-white/10 rounded-2xl"></div>
      <div class="h-16 bg-white/10 rounded-2xl"></div>

      <!-- Buttons -->
      <div class="space-y-3">
        <div class="h-14 bg-green-500/20 rounded-2xl"></div>
        <div class="grid grid-cols-2 gap-3">
          <div class="h-12 bg-white/10 rounded-2xl"></div>
          <div class="h-12 bg-white/10 rounded-2xl"></div>
        </div>
        <div class="h-14 bg-blue-500/20 rounded-2xl"></div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────
// Error States
// ─────────────────────────────────────────────────────────────

function renderErrorContent(message: string): string {
  return `
    <div class="flex flex-col items-center justify-center
                min-h-[60vh] text-center px-6 py-12">
      <div class="w-24 h-24 bg-red-500/20 rounded-full
                  flex items-center justify-center mb-6">
        <span class="text-5xl">😕</span>
      </div>
      <h3 class="text-white font-bold text-xl mb-2">โหลดไม่สำเร็จ</h3>
      <p class="text-white/50 text-sm leading-relaxed mb-8">
        ${escapeHtml(message)}
      </p>
      <div class="space-y-3 w-full max-w-xs">
        <button onclick="window.location.reload()"
          class="w-full py-3.5 bg-white text-runner-primary font-bold
                 rounded-2xl active:scale-95 transition-transform text-sm">
          🔄 ลองใหม่อีกครั้ง
        </button>
        <button id="btn-go-home"
          class="w-full py-3 border border-white/20 text-white/70
                 rounded-2xl text-sm active:scale-95 transition-transform">
          🏠 กลับหน้าหลัก
        </button>
      </div>
    </div>`;
}

function renderError(message: string): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div class="min-h-screen bg-runner-primary flex flex-col">
      <div class="px-4 py-3">
        <button onclick="history.back()"
          class="text-white/80 p-2 -ml-2">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
      </div>
      <div class="flex-1 flex items-center justify-center px-6">
        ${renderErrorContent(message)}
      </div>
    </div>`;

  document.getElementById('btn-go-home')?.addEventListener('click', () => {
    Store.setRoute('events');
    window.dispatchEvent(new CustomEvent('route-change'));
  });
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
