// src/utils/dateHelper.ts

const MONTHS_TH = [
  'ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'
];

export const DateHelper = {
  formatThai(date: string | Date): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    return `${d.getDate()} ${MONTHS_TH[d.getMonth()]} ${d.getFullYear() + 543}`;
  },

  formatThaiDateTime(date: string | Date): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    const time = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    return `${this.formatThai(d)} ${time} น.`;
  },

  formatTime(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  },

  isRegistrationOpen(openAt: string, closeAt: string): boolean {
    const now = Date.now();
    return new Date(openAt).getTime() <= now &&
           new Date(closeAt).getTime() >= now;
  },

  daysUntil(date: string): number {
    const diff = new Date(date).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  },

  relativeTime(date: string): string {
    const diff = Date.now() - new Date(date).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days  = Math.floor(hours / 24);
    if (mins < 1)   return 'เมื่อกี้';
    if (mins < 60)  return `${mins} นาทีที่แล้ว`;
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    return `${days} วันที่แล้ว`;
  }
};
