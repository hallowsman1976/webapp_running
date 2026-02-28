// services/adminService.gs

const AdminService = {

  /**
   * Verify admin credentials
   * คืน admin object หรือ null
   */
  verifyAdmin(userId, token) {
    const admin = SheetHelper.findOneRow('Admin_Users',
      r => r.userId === userId && r.status === 'active');
    if (!admin) return null;

    // Verify token: HMAC-SHA256(userId + salt)
    const salt = PropertiesService.getScriptProperties()
      .getProperty('ADMIN_TOKEN_SALT') || 'default-salt';
    const expectedToken = Utilities.computeHmacSha256Signature(
      userId + salt,
      salt
    );
    const expectedHex = expectedToken.map(b =>
      ('0' + (b & 0xFF).toString(16)).slice(-2)
    ).join('');

    if (token !== expectedHex) return null;
    return admin;
  },

  /**
   * Generate admin token สำหรับ userId
   * เรียกผ่าน GAS console เท่านั้น ไม่ expose ทาง API
   */
  generateAdminToken(userId) {
    const salt = PropertiesService.getScriptProperties()
      .getProperty('ADMIN_TOKEN_SALT') || 'default-salt';
    const sig = Utilities.computeHmacSha256Signature(userId + salt, salt);
    return sig.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  },

  /**
   * Dashboard summary
   * query: eventId (required)
   */
  getDashboard(req) {
    const eventId = req.params.eventId;
    if (!eventId) return errorResponse('eventId required', 400);

    const event = SheetHelper.findOneRow('Events', r => r.eventId === eventId);
    if (!event) return errorResponse('Event not found', 404);

    const allRegs = SheetHelper.findRows('Registrations', r => r.eventId === eventId);
    const pending  = allRegs.filter(r => r.status === 'pending');
    const approved = allRegs.filter(r => r.status === 'approved');
    const checked  = approved.filter(r => r.checkinStatus === 'checked');
    const absent   = approved.filter(r => r.checkinStatus !== 'checked');

    const distances = SheetHelper.findRows('Event_Distances', r => r.eventId === eventId);
    const byDistance = distances.map(d => {
      const dRegs = allRegs.filter(r => r.distanceId === d.distanceId);
      return {
        distanceId: d.distanceId,
        distanceName: d.distanceName,
        quota: Number(d.quota),
        total: dRegs.length,
        approved: dRegs.filter(r => r.status === 'approved').length,
        pending: dRegs.filter(r => r.status === 'pending').length,
        checked: dRegs.filter(r => r.checkinStatus === 'checked' && r.status === 'approved').length
      };
    });

    return successResponse({
      event,
      summary: {
        totalRegistrations: allRegs.length,
        pending: pending.length,
        approved: approved.length,
        checkedIn: checked.length,
        absent: absent.length,
        checkinRate: approved.length > 0
          ? Math.round((checked.length / approved.length) * 100) : 0
      },
      byDistance,
      updatedAt: new Date().toISOString()
    });
  },

  /**
   * List registrations with pagination + search
   * query: eventId, page, limit, search, status, distanceId
   */
  listRegistrations(req) {
    const { params } = req;
    const eventId    = params.eventId || '';
    const page       = Math.max(1, Number(params.page) || 1);
    const limit      = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const search     = (params.search || '').toLowerCase().trim();
    const status     = params.status || '';
    const distanceId = params.distanceId || '';

    let rows = SheetHelper.findRows('Registrations', r => {
      if (eventId && r.eventId !== eventId) return false;
      if (status && r.status !== status) return false;
      if (distanceId && r.distanceId !== distanceId) return false;
      if (search) {
        const searchable = [
          r.bibNumber, r.firstName, r.lastName, r.userId
        ].join(' ').toLowerCase();
        return searchable.includes(search);
      }
      return true;
    });

    // Sort: ใหม่สุดก่อน
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = rows.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const items = rows.slice(start, start + limit);

    // Enrich กับ distance name
    const distances = SheetHelper.findRows('Event_Distances',
      r => !eventId || r.eventId === eventId);
    const distMap = {};
    distances.forEach(d => { distMap[d.distanceId] = d.distanceName; });

    const enriched = items.map(r => ({
      ...r,
      distanceName: distMap[r.distanceId] || r.distanceId
    }));

    return successResponse(enriched, { total, page, limit, totalPages });
  },

  /**
   * Approve registration
   * body: { registrationId }
   */
  approveRegistration(req) {
    const { body, adminUser } = req;
    const registrationId = Validator.string(body.registrationId, 'registrationId');

    const reg = SheetHelper.findOneRow('Registrations',
      r => r.registrationId === registrationId);
    if (!reg) return errorResponse('Registration not found', 404);
    if (reg.status === 'approved') return errorResponse('Already approved', 400);
    if (reg.status === 'cancelled') return errorResponse('Registration is cancelled', 400);

    const before = { status: reg.status };
    const now = new Date();

    SheetHelper.updateRow('Registrations', r => r.registrationId === registrationId, {
      status: 'approved',
      approvedAt: now,
      approvedBy: adminUser.userId,
      updatedAt: now
    });

    CacheHelper.remove(CacheHelper.keys.dashboardStats(reg.eventId));
    AuditService.approve(reg, adminUser.userId, req);

    // Push notification
    try {
      const event = SheetHelper.findOneRow('Events', e => e.eventId === reg.eventId);
      LineHelper.pushMessage(reg.userId,
        `✅ อนุมัติการสมัครแล้ว!\n🎽 ${event?.eventName || ''}\n🔢 BIB: ${reg.bibNumber}\nพร้อมแสดงบัตรในแอปได้เลย`
      );
    } catch {}

    return successResponse({ approved: true, registrationId });
  },

  /**
   * Bulk approve
   * body: { registrationIds: [id1, id2, ...] }
   */
  bulkApprove(req) {
    const { body, adminUser } = req;
    if (!Array.isArray(body.registrationIds) || !body.registrationIds.length) {
      return errorResponse('registrationIds must be non-empty array', 400);
    }
    if (body.registrationIds.length > 100) {
      return errorResponse('Max 100 per bulk approve', 400);
    }

    const now = new Date();
    let approvedCount = 0;
    const errors = [];

    const allRegs = SheetHelper.findRows('Registrations',
      r => body.registrationIds.includes(r.registrationId));

    const updates = [];
    allRegs.forEach(reg => {
      if (reg.status !== 'pending') {
        errors.push({ registrationId: reg.registrationId, error: `Status is ${reg.status}` });
        return;
      }
      updates.push({
        filterFn: r => r.registrationId === reg.registrationId,
        data: { status: 'approved', approvedAt: now, approvedBy: adminUser.userId, updatedAt: now }
      });
      approvedCount++;

      AuditService.approve(reg, adminUser.userId, req);

      // Push notification (non-blocking)
      try {
        LineHelper.pushMessage(reg.userId, `✅ การสมัครของคุณได้รับการอนุมัติแล้ว! BIB: ${reg.bibNumber}`);
      } catch {}
    });

    if (updates.length) {
      SheetHelper.batchUpdateRows('Registrations', updates);
    }

    // Invalidate caches
    const eventIds = [...new Set(allRegs.map(r => r.eventId))];
    eventIds.forEach(eid => CacheHelper.remove(CacheHelper.keys.dashboardStats(eid)));

    return successResponse({ approvedCount, errors });
  },

  /**
   * [superadmin] List users
   */
  listUsers(req) {
    const { params } = req;
    const page   = Math.max(1, Number(params.page) || 1);
    const limit  = Math.min(100, Number(params.limit) || 20);
    const search = (params.search || '').toLowerCase();

    const result = SheetHelper.paginateRows('Users', r => {
      if (!search) return r.status !== 'deleted';
      return r.status !== 'deleted' && (
        r.userId.toLowerCase().includes(search) ||
        r.displayName.toLowerCase().includes(search)
      );
    }, page, limit);

    return successResponse(result.items, {
      total: result.total, page, limit, totalPages: result.totalPages
    });
  },

  /**
   * [superadmin] Ban user
   */
  banUser(req) {
    const { body, adminUser } = req;
    const userId = Validator.string(body.userId, 'userId');
    const action = Validator.enum(body.action, 'action', ['ban', 'unban']);

    SheetHelper.updateRow('Users', r => r.userId === userId, {
      status: action === 'ban' ? 'banned' : 'active',
      updatedAt: new Date()
    });

    AuditService.log({
      actorId: adminUser.userId, actorRole: adminUser.role,
      action: action.toUpperCase(), targetType: 'user', targetId: userId, req
    });

    return successResponse({ userId, status: action === 'ban' ? 'banned' : 'active' });
  }
};
