// services/qrCheckpointService.gs (ตั้งชื่อ var ว่า QrCheckpointService)

const QrCheckpointService = {

  /**
   * สร้าง QR Checkpoint ใหม่
   * body: { eventId, checkpointName, allowMultiCheckin }
   */
  create(req) {
    const { body, adminUser } = req;
    const eventId = Validator.string(body.eventId, 'eventId');
    const checkpointName = Validator.string(body.checkpointName, 'checkpointName', 200);
    const allowMultiCheckin = body.allowMultiCheckin === true || body.allowMultiCheckin === 'true';

    const event = SheetHelper.findOneRow('Events', r => r.eventId === eventId);
    if (!event) return errorResponse('Event not found', 404);

    // สร้าง payload unique และ random
    const checkpointId = Validator.uuid();
    const qrPayload = `CHKPT:${eventId}:${checkpointId}:${Utilities.getUuid().substring(0, 8)}`;

    const checkpoint = {
      checkpointId,
      eventId,
      checkpointName: Validator.sanitize(checkpointName),
      qrPayload,
      qrImageUrl: '',
      allowMultiCheckin,
      status: 'active',
      printedAt: '',
      createdAt: new Date(),
      createdBy: adminUser.userId
    };

    SheetHelper.appendRow('QR_Checkpoints', checkpoint);

    AuditService.log({
      actorId: adminUser.userId, actorRole: adminUser.role,
      action: 'CREATE_CHECKPOINT', targetType: 'qr_checkpoint',
      targetId: checkpointId, eventId, after: checkpoint, req
    });

    return successResponse(checkpoint);
  },

  /**
   * List checkpoints ของ event
   */
  listByEvent(req) {
    const { resourceId: eventId } = req;
    if (!eventId) return errorResponse('eventId required', 400);

    const checkpoints = SheetHelper.findRows('QR_Checkpoints',
      r => r.eventId === eventId && r.status === 'active'
    );

    return successResponse(checkpoints);
  },

  /**
   * ลบ checkpoint (soft)
   */
  remove(req) {
    const { resourceId: checkpointId, adminUser } = req;
    if (!checkpointId) return errorResponse('checkpointId required', 400);

    const cp = SheetHelper.findOneRow('QR_Checkpoints', r => r.checkpointId === checkpointId);
    if (!cp) return errorResponse('Checkpoint not found', 404);

    SheetHelper.updateRow('QR_Checkpoints', r => r.checkpointId === checkpointId, {
      status: 'inactive',
      updatedAt: new Date()
    });

    AuditService.log({
      actorId: adminUser.userId, actorRole: adminUser.role,
      action: 'DELETE_CHECKPOINT', targetType: 'qr_checkpoint',
      targetId: checkpointId, eventId: cp.eventId, before: cp, req
    });

    return successResponse({ deleted: true, checkpointId });
  }
};
