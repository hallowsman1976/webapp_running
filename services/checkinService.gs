// services/checkinService.gs

const CheckinService = {

  /**
   * Self check-in ผ่าน QR (runner สแกนเอง)
   * body: { qrPayload }  — payload มาจาก QR Checkpoint
   */
  checkin(req) {
    const { body, userId } = req;
    const qrPayload = Validator.string(body.qrPayload, 'qrPayload');

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);

      // ── 1. Resolve QR Checkpoint ───────────────────────────
      const checkpoint = SheetHelper.findOneRow('QR_Checkpoints',
        r => r.qrPayload === qrPayload && r.status === 'active');
      if (!checkpoint) return errorResponse('QR Code ไม่ถูกต้องหรือหมดอายุ', 400);

      // ── 2. ค้นหา registration ──────────────────────────────
      const reg = SheetHelper.findOneRow('Registrations',
        r => r.userId === userId && r.eventId === checkpoint.eventId
          && r.status === 'approved');
      if (!reg) return errorResponse('ไม่พบข้อมูลการสมัครหรือยังไม่ได้รับการอนุมัติ', 404);

      return this._doCheckin(reg, checkpoint, userId, 'runner', 'qr_self', req);

    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Staff check-in จาก Admin panel
   * body: { registrationId, checkpointId }
   */
  staffCheckin(req) {
    const { body, adminUser } = req;
    const registrationId = Validator.string(body.registrationId, 'registrationId');
    const checkpointId = Validator.optional(body.checkpointId, '');

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);

      const reg = SheetHelper.findOneRow('Registrations',
        r => r.registrationId === registrationId);
      if (!reg) return errorResponse('Registration not found', 404);
      if (reg.status !== 'approved') return errorResponse('Registration is not approved', 400);

      const checkpoint = checkpointId
        ? SheetHelper.findOneRow('QR_Checkpoints', r => r.checkpointId === checkpointId)
        : null;

      return this._doCheckin(reg, checkpoint, adminUser.userId, adminUser.role, 'staff_manual', req);

    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Core check-in logic (shared)
   */
  _doCheckin(reg, checkpoint, actorId, actorRole, method, req) {
    const now = new Date();

    // เช็คอินซ้ำ
    if (reg.checkinStatus === 'checked') {
      const allowMulti = checkpoint?.allowMultiCheckin === true ||
        checkpoint?.allowMultiCheckin === 'true';
      if (!allowMulti) {
        return errorResponse('เช็คอินไปแล้ว', 409);
      }
    }

    const userAgent = req.params._ua || '';

    // บันทึก Checkins log
    const checkinRecord = {
      checkinId: Validator.uuid(),
      registrationId: reg.registrationId,
      eventId: reg.eventId,
      userId: reg.userId,
      bibNumber: reg.bibNumber,
      checkinAt: now,
      checkinMethod: method,
      checkpointId: checkpoint?.checkpointId || '',
      staffId: actorRole !== 'runner' ? actorId : '',
      deviceInfo: userAgent.substring(0, 500),
      note: ''
    };
    SheetHelper.appendRow('Checkins', checkinRecord);

    // อัปเดต Registration
    SheetHelper.updateRow('Registrations', r => r.registrationId === reg.registrationId, {
      checkinStatus: 'checked',
      checkinAt: now,
      updatedAt: now
    });

    // Invalidate dashboard cache
    CacheHelper.remove(CacheHelper.keys.dashboardStats(reg.eventId));

    // Audit log
    AuditService.checkin(checkinRecord, actorId, actorRole, req);

    // Push notification ให้ runner
    try {
      LineHelper.pushMessage(reg.userId,
        `✅ เช็คอินสำเร็จ!\n🔢 BIB: ${reg.bibNumber}\n📍 ${checkpoint?.checkpointName || 'จุดเช็คอิน'}\n⏰ ${now.toLocaleTimeString('th-TH')}`
      );
    } catch {}

    return successResponse({
      checkin: checkinRecord,
      bibNumber: reg.bibNumber,
      firstName: reg.firstName,
      lastName: reg.lastName,
      distanceId: reg.distanceId
    });
  },

  /**
   * [Admin] Check-in stats ของ event
   */
  getStats(req) {
    const { resourceId: eventId } = req;
    if (!eventId) return errorResponse('eventId required', 400);

    const cacheKey = CacheHelper.keys.dashboardStats(eventId);
    const stats = CacheHelper.getOrSet(cacheKey, () => {
      const regs = SheetHelper.findRows('Registrations',
        r => r.eventId === eventId && r.status === 'approved');
      const checked = regs.filter(r => r.checkinStatus === 'checked');

      const distances = SheetHelper.findRows('Event_Distances', r => r.eventId === eventId);

      const byDistance = distances.map(d => {
        const dRegs = regs.filter(r => r.distanceId === d.distanceId);
        const dChecked = dRegs.filter(r => r.checkinStatus === 'checked');
        return {
          distanceId: d.distanceId,
          distanceName: d.distanceName,
          total: dRegs.length,
          checked: dChecked.length,
          absent: dRegs.length - dChecked.length
        };
      });

      return {
        total: regs.length,
        checked: checked.length,
        absent: regs.length - checked.length,
        checkinRate: regs.length > 0 ? Math.round((checked.length / regs.length) * 100) : 0,
        byDistance,
        updatedAt: new Date().toISOString()
      };
    }, 60); // cache 60 วินาที

    return successResponse(stats);
  }
};
