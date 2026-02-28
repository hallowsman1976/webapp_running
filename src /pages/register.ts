// src/pages/register.ts
// Registration Form Page

import { Store } from '../store';
import { Api } from '../api';
import { Toast } from '../components/toast';
import { Modal } from '../components/modal';
import { renderInlineSpinner } from '../components/spinner';
import { DateHelper } from '../utils/dateHelper';
import type { Event, EventDistance, RegisterFormData } from '../types';

export async function renderRegister(eventId: string, distanceId: string): Promise<void> {
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <div class="min-h-screen bg-gray-50 pb-24">
      <div class="bg-runner-primary h-14 flex items-center px-4 sticky top-0 z-40">
        <button id="btn-back"
          class="text-white/80 p-2 -ml-2 active:scale-90 transition-transform">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round"
                  stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 class="text-white font-semibold text-base ml-2">สมัครงานวิ่ง</h1>
      </div>
      <div id="register-content">${renderInlineSpinner()}</div>
    </div>`;

  document.getElementById('btn-back')!.addEventListener('click', () => {
    Store.goBack();
    window.dispatchEvent(new CustomEvent('route-change'));
  });

  try {
    const res = await Api.getEvent(eventId);
    if (!res.success || !res.data) throw new Error('ไม่พบงานวิ่ง');

    const { event, distances } = res.data;
    const distance = distances.find(d => d.distanceId === distanceId);
    if (!distance) throw new Error('ไม่พบระยะทางที่เลือก');

    renderForm(event, distance);

  } catch (err) {
    document.getElementById('register-content')!.innerHTML = `
      <div class="text-center py-20 px-6">
        <span class="text-5xl block mb-4">😕</span>
        <p class="text-red-500">${(err as Error).message}</p>
      </div>`;
  }
}

function renderForm(event: Event, distance: EventDistance): void {
  document.getElementById('register-content')!.innerHTML = `
    <div class="px-4 py-5 space-y-5">

      <!-- Event Summary -->
      <div class="bg-runner-primary rounded-2xl p-4 text-white">
        <p class="text-white/60 text-xs mb-1">สมัครงาน</p>
        <p class="font-bold text-lg leading-snug">${event.eventName}</p>
        <div class="flex items-center gap-4 mt-3">
          <span class="bg-white/20 px-3 py-1 rounded-full text-sm font-medium">
            🏃 ${distance.distanceName}
          </span>
          <span class="text-runner-accent font-bold text-lg">
            ${Number(distance.price) > 0 ? `฿${Number(distance.price).toLocaleString()}` : 'ฟรี'}
          </span>
        </div>
      </div>

      <!-- Form -->
      <form id="register-form" class="space-y-5" novalidate>

        <!-- Personal Info -->
        <div class="bg-white rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-runner-primary text-sm flex items-center gap-2">
            <span class="w-6 h-6 bg-blue-100 text-runner-secondary rounded-full
                         flex items-center justify-center text-xs font-bold">1</span>
            ข้อมูลส่วนตัว
          </h3>

          <div class="grid grid-cols-2 gap-3">
            ${renderInput('firstName', 'ชื่อจริง', 'text', true)}
            ${renderInput('lastName', 'นามสกุล', 'text', true)}
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">เพศ <span class="text-red-500">*</span></label>
            <div class="grid grid-cols-3 gap-2">
              ${[['M','ชาย','👨'],['F','หญิง','👩'],['Other','อื่นๆ','🧑']].map(([val, label, icon]) => `
                <label class="flex flex-col items-center gap-1 p-3 rounded-xl border-2
                              border-gray-200 cursor-pointer has-[:checked]:border-runner-secondary
                              has-[:checked]:bg-blue-50 transition-colors">
                  <input type="radio" name="gender" value="${val}" class="sr-only"
                         ${val === 'M' ? 'checked' : ''} />
                  <span class="text-xl">${icon}</span>
                  <span class="text-xs font-medium text-gray-700">${label}</span>
                </label>`).join('')}
            </div>
          </div>

          ${renderInput('birthDate', 'วันเกิด', 'date', true)}

          <div>
            <label class="block text-xs font-medium text-gray-600 mb-1.5">ขนาดเสื้อ <span class="text-red-500">*</span></label>
            <div class="grid grid-cols-6 gap-1.5">
              ${['XS','S','M','L','XL','XXL'].map(size => `
                <label class="flex items-center justify-center p-2.5 rounded-xl border-2
                              border-gray-200 cursor-pointer has-[:checked]:border-runner-secondary
                              has-[:checked]:bg-blue-50 transition-colors">
                  <input type="radio" name="shirtSize" value="${size}" class="sr-only"
                         ${size === 'M' ? 'checked' : ''} />
                  <span class="text-xs font-bold text-gray-700">${size}</span>
                </label>`).join('')}
            </div>
          </div>
        </div>

        <!-- Emergency Contact -->
        <div class="bg-white rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 class="font-bold text-runner-primary text-sm flex items-center gap-2">
            <span class="w-6 h-6 bg-red-100 text-red-500 rounded-full
                         flex items-center justify-center text-xs font-bold">2</span>
            ผู้ติดต่อฉุกเฉิน
          </h3>
          ${renderInput('emergencyContact', 'ชื่อผู้ติดต่อ', 'text', true)}
          ${renderInput('emergencyPhone', 'เบอร์โทร', 'tel', true)}
        </div>

        <!-- Consent reminder -->
        <div class="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <label class="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" id="confirm-agree" required
                   class="w-4 h-4 mt-0.5 accent-runner-secondary" />
            <span class="text-xs text-gray-600 leading-relaxed">
              ฉันยืนยันว่าข้อมูลที่กรอกถูกต้อง และยอมรับ
              <strong>ข้อตกลงการเข้าร่วมงานวิ่ง</strong>
              รวมถึงความเสี่ยงที่อาจเกิดขึ้น
            </span>
          </label>
        </div>

        <!-- Submit -->
        <button type="submit" id="btn-submit"
          class="w-full py-4 bg-line-green text-white font-bold rounded-2xl
                 text-lg shadow-lg shadow-green-200 active:scale-95 transition-transform
                 disabled:opacity-50 disabled:cursor-not-allowed">
          ยืนยันการสมัคร 🏃
        </button>
      </form>
    </div>`;

  document.getElementById('register-form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit(event.eventId, distance.distanceId);
  });
}

function renderInput(name: string, label: string, type: string, required = false): string {
  return `
    <div>
      <label for="${name}"
             class="block text-xs font-medium text-gray-600 mb-1.5">
        ${label} ${required ? '<span class="text-red-500">*</span>' : ''}
      </label>
      <input type="${type}" id="${name}" name="${name}" ${required ? 'required' : ''}
             class="w-full px-4 py-3 rounded-xl border-2 border-gray-200 text-sm
                    focus:border-runner-secondary focus:outline-none transition-colors
                    bg-white placeholder-gray-300"
             placeholder="${label}" />
    </div>`;
}

async function handleSubmit(eventId: string, distanceId: string): Promise<void> {
  const form = document.getElementById('register-form') as HTMLFormElement;
  const btn  = document.getElementById('btn-submit') as HTMLButtonElement;

  // Validate
  if (!document.getElementById('confirm-agree') || !(document.getElementById('confirm-agree') as HTMLInputElement).checked) {
    Toast.warning('กรุณายืนยันข้อตกลงก่อนสมัคร');
    return;
  }

  const data: RegisterFormData = {
    eventId,
    distanceId,
    firstName:        (form.firstName as HTMLInputElement).value.trim(),
    lastName:         (form.lastName as HTMLInputElement).value.trim(),
    gender:           (form.querySelector('[name="gender"]:checked') as HTMLInputElement)?.value as 'M'|'F'|'Other' || 'M',
    birthDate:        (form.birthDate as HTMLInputElement).value,
    shirtSize:        (form.querySelector('[name="shirtSize"]:checked') as HTMLInputElement)?.value as 'M' || 'M',
    emergencyContact: (form.emergencyContact as HTMLInputElement).value.trim(),
    emergencyPhone:   (form.emergencyPhone as HTMLInputElement).value.trim()
  };

  // Basic validation
  if (!data.firstName || !data.lastName || !data.birthDate ||
      !data.emergencyContact || !data.emergencyPhone) {
    Toast.warning('กรุณากรอกข้อมูลให้ครบทุกช่อง');
    return;
  }

  const confirmed = await Modal.confirm(
    'ยืนยันการสมัคร?',
    `${data.firstName} ${data.lastName} — สมัครแล้วไม่สามารถยกเลิกได้`
  );
  if (!confirmed) return;

  // Submit
  btn.disabled = true;
  btn.innerHTML = `<div class="w-6 h-6 border-2 border-white/30 border-t-white
                              rounded-full animate-spin mx-auto"></div>`;
  try {
    const res = await Api.register(data);
    if (!res.success) throw new Error(res.error || 'สมัครไม่สำเร็จ');

    const regId = (res.data as any)?.registration?.registrationId;
    Toast.success('สมัครสำเร็จ! 🎉');

    // ไป BIB Card
    Store.setRoute('bib-card', { registrationId: regId });
    window.dispatchEvent(new CustomEvent('route-change'));

  } catch (err) {
    Toast.error(`${(err as Error).message}`);
    btn.disabled = false;
    btn.innerHTML = 'ยืนยันการสมัคร 🏃';
  }
}
