// src/config.ts
// ค่า config ทั้งหมด — เปลี่ยนค่าตาม environment ของคุณ
// ⚠️ ห้ามใส่ SECRET ที่นี่ เก็บไว้ใน GAS PropertiesService เท่านั้น

export const CONFIG = {
  LIFF_ID:        import.meta.env.VITE_LIFF_ID        || 'YOUR_LIFF_ID',
  GAS_WEBAPP_URL: import.meta.env.VITE_GAS_WEBAPP_URL || 'YOUR_GAS_WEBAPP_URL',
  APP_NAME:       import.meta.env.VITE_APP_NAME        || 'RUNNER EVENT',
  PDPA_VERSION:   '1.0',

  // Admin config (เก็บ userId + token สำหรับ admin session)
  ADMIN_STORAGE_KEY: 'runner_admin_session',

  // Polling interval สำหรับ dashboard (ms)
  DASHBOARD_POLL_INTERVAL: 30_000,  // 30 วินาที

  // Debounce search (ms)
  SEARCH_DEBOUNCE: 400,

  // Default pagination
  DEFAULT_PAGE_SIZE: 20,
} as const;

// .env.local (สร้างไฟล์นี้ local และอย่า commit)
// VITE_LIFF_ID=1234567890-xxxxxxxx
// VITE_GAS_WEBAPP_URL=https://script.google.com/macros/s/xxx/exec
// VITE_APP_NAME=RUNNER EVENT MINI APP
