// src/utils/qrPayloadValidator.ts
// ตรวจสอบ QR payload format ทั้งฝั่ง frontend

export const QrPayloadValidator = {

  // Format: CHKPT:{eventId}:{checkpointId}:{random8}
  PATTERN: /^CHKPT:[a-f0-9-]{36}:[a-f0-9-]{36}:[a-f0-9]{8}$/i,

  isValid(payload: string): boolean {
    if (!payload || typeof payload !== 'string') return false;
    if (payload.length > 200) return false;
    return this.PATTERN.test(payload.trim());
  },

  parse(payload: string): {
    eventId:      string;
    checkpointId: string;
    random:       string;
  } | null {
    if (!this.isValid(payload)) return null;
    const parts = payload.split(':');
    return {
      eventId:      parts[1],
      checkpointId: parts[2],
      random:       parts[3]
    };
  },

  // Sanitize: ป้องกัน injection
  sanitize(payload: string): string {
    return payload.replace(/[^a-zA-Z0-9:-]/g, '').substring(0, 200);
  }
};
