// services/auditService.gs
// บันทึก audit log สำหรับ action สำคัญ

const AuditService = {

  /**
   * บันทึก audit log
   */
  log({ actorId, actorRole, action, targetType, targetId, eventId = '',
        before = null, after = null, status = 'success', note = '',
        req = null }) {
    try {
      const logEntry = {
        logId: Validator.uuid(),
        timestamp: new Date(),
        actorId: actorId || 'system',
        actorRole: actorRole || 'system',
        action,
        targetType: targetType || '',
        targetId: targetId || '',
        eventId: eventId || '',
        beforeValue: before ? JSON.stringify(before) : '',
        afterValue: after ? JSON.stringify(after) : '',
        ipAddress: req ? (req.params._ip || '') : '',
        userAgent: req ? (req.params._ua || '') : '',
        status,
        note: note || ''
      };

      SheetHelper.appendRow('Audit_Logs', logEntry);
    } catch (err) {
      // Audit log ไม่ควรทำให้ main flow พัง
      console.error('AuditService.log error:', err.message);
    }
  },

  // Shorthand methods
  register: (reg, req) => AuditService.log({
    actorId: reg.userId, actorRole: 'runner', action: 'REGISTER',
    targetType: 'registration', targetId: reg.registrationId,
    eventId: reg.eventId, after: reg, req
  }),

  approve: (reg, adminId, req) => AuditService.log({
    actorId: adminId, actorRole: 'admin', action: 'APPROVE',
    targetType: 'registration', targetId: reg.registrationId,
    eventId: reg.eventId, before: { status: reg.status }, after: { status: 'approved' }, req
  }),

  checkin: (checkin, actorId, actorRole, req) => AuditService.log({
    actorId, actorRole, action: 'CHECKIN',
    targetType: 'checkin', targetId: checkin.checkinId,
    eventId: checkin.eventId, after: checkin, req
  }),

  editEvent: (before, after, adminId, req) => AuditService.log({
    actorId: adminId, actorRole: 'admin', action: 'EDIT_EVENT',
    targetType: 'event', targetId: before.eventId,
    eventId: before.eventId, before, after, req
  }),

  deleteEvent: (event, adminId, req) => AuditService.log({
    actorId: adminId, actorRole: 'admin', action: 'DELETE_EVENT',
    targetType: 'event', targetId: event.eventId,
    eventId: event.eventId, before: event, req
  })
};
