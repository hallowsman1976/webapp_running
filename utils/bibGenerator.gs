// utils/bibGenerator.gs
// สร้าง BIB number แบบ thread-safe ด้วย LockService

const BibGenerator = {

  /**
   * สร้าง BIB number ถัดไปสำหรับ event+distance
   * ใช้ LockService กัน race condition
   * counterId = BIB_{eventId}_{distanceId}
   */
  nextBib(eventId, distanceId) {
    const lock = LockService.getScriptLock();
    let bibNumber = null;

    try {
      // รอ lock สูงสุด 30 วินาที
      lock.waitLock(30000);

      const counterId = `BIB_${eventId}_${distanceId}`;
      let counter = SheetHelper.findOneRow('Counters', r => r.counterId === counterId);

      const prefix = counter ? counter.prefix : SheetHelper.getSetting('bib_prefix') || 'BIB';
      const padLength = counter ? Number(counter.padLength) : 4;
      let currentValue = counter ? Number(counter.currentValue) : 0;
      const nextValue = currentValue + 1;

      // อัปเดต counter
      if (counter) {
        SheetHelper.updateRow('Counters', r => r.counterId === counterId, {
          currentValue: nextValue,
          updatedAt: new Date()
        });
      } else {
        SheetHelper.appendRow('Counters', {
          counterId,
          currentValue: nextValue,
          prefix,
          padLength,
          updatedAt: new Date()
        });
      }

      bibNumber = `${prefix}-${String(nextValue).padStart(padLength, '0')}`;

    } finally {
      lock.releaseLock();
    }

    return bibNumber;
  },

  /**
   * ตรวจสอบว่า BIB ซ้ำในงานหรือไม่
   */
  isBibTaken(eventId, bibNumber) {
    return !!SheetHelper.findOneRow('Registrations', r =>
      r.eventId === eventId && r.bibNumber === bibNumber
    );
  }
};
