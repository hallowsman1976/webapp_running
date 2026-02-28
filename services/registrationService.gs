// services/registrationService.gs

const RegistrationService = {

  /**
   * สมัครงานวิ่ง — ใช้ LockService กัน race
   * body: { eventId, distanceId, firstName, lastName, gender, birthDate,
   *         shirtSize, emergencyContact, emergencyPhone }
   */
  register(req) {
    const { body, userId, lineProfile } = req;

    // Validate input ก่อน lock
    const eventId    = Validator.string(body.eventId, 'eventId');
    const distanceId = Validator.string(body.distanceId, 'distanceId');
    const firstName  = Validator.string(body.firstName, 'firstName', 100);
    const lastName   = Validator.string(body.lastName, 'lastName', 100);
    const gender     = Validator.enum(body.gender, 'gender', ['M', 'F', 'Other']);
    const birthDate  = Validator.date(body.birthDate, 'birthDate');
    const shirtSize  = Validator.enum(body.shirtSize, 'shirtSize', ['XS','S','M','L','XL','XXL']);
    const emergencyContact = Validator.string(body.emergencyContact, 'emergencyContact', 200);
    const emergencyPhone   = Validator.string(body.emergencyPhone, 'emergencyPhone', 20);

    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);

      // ── 1. เช็ค event ──────────────────────────────────────
      const event = SheetHelper.findOneRow('Events', r => r.eventId === eventId);
      if (!event) return errorResponse('Event not found', 404);
      if (event.status !== 'published') return errorResponse('Event is not open', 400);
      const now = new Date();
      if (new Date(event.registrationOpenAt) > now)
        return errorResponse('Registration not yet open', 400);
      if (new Date(event.registrationCloseAt) < now)
        return errorResponse('Registration is closed', 400);

      // ── 2. เช็ค distance ───────────────────────────────────
      const distance = SheetHelper.findOneRow('Event_Distances',
        r => r.distanceId === distanceId && r.eventId === eventId && r.status === 'active');
      if (!distance) return errorResponse('Distance not found or not available', 404);

      // ── 3. เช็ค quota ──────────────────────────────────────
      const regCount = SheetHelper.findRows('Registrations',
        r => r.distanceId === distanceId && ['pending','approved'].includes(r.status)
      ).length;
      if (regCount >= Number(distance.quota)) {
        return errorResponse('This distance is full', 400);
      }

      // ── 4. เช็ค duplicate ──────────────────────────────────
      const duplicate = SheetHelper.findOneRow('Registrations',
        r => r.userId === userId && r.eventId === eventId && r.distanceId === distanceId
          && r.status !== 'cancelled' && r.status !== 'rejected'
      );
      if (duplicate) {
        return errorResponse('You have already registered for this distance', 409);
      }

      // ── 5. ออก BIB ─────────────────────────────────────────
      const bibNumber = BibGenerator.nextBib(eventId, distanceId);

      // ── 6. สร้าง Registration ──────────────────────────────
      const requireApproval = event.requireApproval === true || event.requireApproval === 'true';
      const registration = {
        registrationId: Validator.uuid(),
        eventId,
        distanceId,
        userId,
        bibNumber,
        firstName: Validator.sanitize(firstName),
        lastName: Validator.sanitize(lastName),
        gender,
        birthDate,
        shirtSize,
        emergencyContact: Validator.sanitize(emergencyContact),
        emergencyPhone: Validator.sanitize(emergencyPhone),
        status: requireApproval ? 'pending' : 'approved',
        approvedAt: requireApproval ? '' : now,
        approvedBy: requireApproval ? '' : 'auto',
        paymentStatus: 'unpaid',
        paymentRef: '',
        createdAt: now,
        updatedAt: now,
        checkinStatus: 'not_checked',
        checkinAt: ''
      };

      SheetHelper.appendRow('Registrations', registration);

      // อัปเดต registeredCount ใน Event_Distances
      SheetHelper.updateRow('Event_Distances', r => r.distanceId === distanceId, {
        registeredCount: regCount + 1,
        updatedAt: now
      });

      // Invalidate cache
      CacheHelper.removeAll([
        CacheHelper.keys.event(eventId),
        CacheHelper.keys.dashboardStats(eventId)
      ]);

      // ── 7. Audit log ───────────────────────────────────────
      AuditService.register(registration, req);

      // ── 8. Push LINE notification ──────────────────────────
      try {
        const msg = requireApproval
          ? `✅ รับใบสมัครแล้ว!\n🎽 ${event.eventName}\n📏 ${distance.distanceName}\n🔢 BIB: ${bibNumber}\n⏳ รอการอนุมัติจากผู้จัดงาน`
          : `✅ สมัครสำเร็จ!\n🎽 ${event.eventName}\n📏 ${distance.distanceName}\n🔢 BIB: ${bibNumber}`;
        LineHelper.pushMessage(userId, msg);
      } catch {}

      return successResponse({
        registration,
        requireApproval,
        message: requireApproval ? 'รับใบสมัครแล้ว รอการอนุมัติ' : 'สมัครสำเร็จ'
      });

    } finally {
      lock.releaseLock();
    }
  },

  /**
   * ดูรายละเอียด registration (เจ้าของเท่านั้น)
   */
  getRegistration(req) {
    const { resourceId: registrationId, userId } = req;

    const reg = SheetHelper.findOneRow('Registrations',
      r => r.registrationId === registrationId);
    if (!reg) return errorResponse('Registration not found', 404);
    if (reg.userId !== userId) return errorResponse('Forbidden', 403);

    const event = SheetHelper.findOneRow('Events', r => r.eventId === reg.eventId);
    const distance = SheetHelper.findOneRow('Event_Distances', r => r.distanceId === reg.distanceId);
    const user = SheetHelper.findOneRow('Users', r => r.userId === userId);

    return successResponse({ registration: reg, event, distance, user });
  },

  /**
   * รายการสมัครทั้งหมดของ user
   */
  getMyRegistrations(req) {
    const { resourceId: userId } = req;
    if (req.userId !== userId) return errorResponse('Forbidden', 403);

    const regs = SheetHelper.findRows('Registrations',
      r => r.userId === userId && r.status !== 'cancelled'
    );

    // Enrich กับ event/distance
    const enriched = regs.map(r => {
      const event = SheetHelper.findOneRow('Events', e => e.eventId === r.eventId);
      const distance = SheetHelper.findOneRow('Event_Distances', d => d.distanceId === r.distanceId);
      return { ...r, event, distance };
    });

    return successResponse(enriched);
  }
};
