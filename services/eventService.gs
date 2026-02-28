// services/eventService.gs

const EventService = {

  /**
   * List published events (cached 5 min)
   */
  listEvents(req) {
    const cacheKey = CacheHelper.keys.eventList();
    const events = CacheHelper.getOrSet(cacheKey, () => {
      return SheetHelper.findRows('Events', r =>
        r.status === 'published' &&
        new Date(r.registrationCloseAt) >= new Date()
      ).map(e => this._formatEvent(e));
    }, 300);

    return successResponse(events);
  },

  /**
   * Get event detail + distances (cached 5 min)
   */
  getEvent(req) {
    const { resourceId: eventId } = req;
    if (!eventId) return errorResponse('eventId required', 400);

    const cacheKey = CacheHelper.keys.event(eventId);
    const result = CacheHelper.getOrSet(cacheKey, () => {
      const event = SheetHelper.findOneRow('Events', r => r.eventId === eventId);
      if (!event) return null;

      const distances = SheetHelper.findRows('Event_Distances',
        r => r.eventId === eventId && r.status === 'active'
      ).sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));

      return { event: this._formatEvent(event), distances };
    }, 300);

    if (!result) return errorResponse('Event not found', 404);
    return successResponse(result);
  },

  /**
   * [Admin] Create event
   */
  createEvent(req) {
    const { body, adminUser } = req;
    const now = new Date();

    const event = {
      eventId: Validator.uuid(),
      eventName: Validator.string(body.eventName, 'eventName', 200),
      eventDate: Validator.date(body.eventDate, 'eventDate'),
      eventLocation: Validator.string(body.eventLocation, 'eventLocation', 300),
      coverImageUrl: Validator.optional(body.coverImageUrl, ''),
      description: Validator.optional(body.description, '').substring(0, 2000),
      registrationOpenAt: Validator.date(body.registrationOpenAt, 'registrationOpenAt'),
      registrationCloseAt: Validator.date(body.registrationCloseAt, 'registrationCloseAt'),
      maxParticipants: Validator.number(body.maxParticipants, 'maxParticipants', 1),
      status: Validator.enum(body.status || 'draft', 'status',
        ['draft', 'published', 'closed', 'cancelled']),
      requireApproval: body.requireApproval === true || body.requireApproval === 'true',
      createdAt: now,
      updatedAt: now,
      createdBy: adminUser.userId,
      updatedBy: adminUser.userId
    };

    SheetHelper.appendRow('Events', event);
    CacheHelper.remove(CacheHelper.keys.eventList());

    AuditService.log({
      actorId: adminUser.userId, actorRole: adminUser.role,
      action: 'CREATE_EVENT', targetType: 'event',
      targetId: event.eventId, eventId: event.eventId, after: event, req
    });

    return successResponse(event);
  },

  /**
   * [Admin] Update event
   */
  updateEvent(req) {
    const { body, resourceId: eventId, adminUser } = req;
    if (!eventId) return errorResponse('eventId required', 400);

    const existing = SheetHelper.findOneRow('Events', r => r.eventId === eventId);
    if (!existing) return errorResponse('Event not found', 404);

    const updates = {
      eventName: body.eventName ? Validator.string(body.eventName, 'eventName', 200) : existing.eventName,
      eventDate: body.eventDate ? Validator.date(body.eventDate, 'eventDate') : existing.eventDate,
      eventLocation: body.eventLocation || existing.eventLocation,
      coverImageUrl: body.coverImageUrl !== undefined ? body.coverImageUrl : existing.coverImageUrl,
      description: body.description !== undefined ? body.description.substring(0, 2000) : existing.description,
      registrationOpenAt: body.registrationOpenAt ? Validator.date(body.registrationOpenAt, 'registrationOpenAt') : existing.registrationOpenAt,
      registrationCloseAt: body.registrationCloseAt ? Validator.date(body.registrationCloseAt, 'registrationCloseAt') : existing.registrationCloseAt,
      maxParticipants: body.maxParticipants ? Validator.number(body.maxParticipants, 'maxParticipants', 1) : existing.maxParticipants,
      status: body.status ? Validator.enum(body.status, 'status', ['draft', 'published', 'closed', 'cancelled']) : existing.status,
      requireApproval: body.requireApproval !== undefined ? (body.requireApproval === true || body.requireApproval === 'true') : existing.requireApproval,
      updatedAt: new Date(),
      updatedBy: adminUser.userId
    };

    SheetHelper.updateRow('Events', r => r.eventId === eventId, updates);

    // Invalidate cache
    CacheHelper.removeAll([CacheHelper.keys.eventList(), CacheHelper.keys.event(eventId)]);

    AuditService.editEvent(existing, updates, adminUser.userId, req);

    return successResponse({ eventId, ...updates });
  },

  /**
   * [Admin] Delete event (soft)
   */
  deleteEvent(req) {
    const { resourceId: eventId, adminUser } = req;
    if (!eventId) return errorResponse('eventId required', 400);

    const existing = SheetHelper.findOneRow('Events', r => r.eventId === eventId);
    if (!existing) return errorResponse('Event not found', 404);

    SheetHelper.updateRow('Events', r => r.eventId === eventId, {
      status: 'cancelled',
      updatedAt: new Date(),
      updatedBy: adminUser.userId
    });

    CacheHelper.removeAll([CacheHelper.keys.eventList(), CacheHelper.keys.event(eventId)]);
    AuditService.deleteEvent(existing, adminUser.userId, req);

    return successResponse({ deleted: true, eventId });
  },

  /**
   * [Admin] Upsert distance
   * body: { eventId, distanceId(optional), distanceName, distanceKm, quota, price, sortOrder }
   */
  upsertDistance(req) {
    const { body, adminUser } = req;
    const eventId = Validator.string(body.eventId, 'eventId');

    const event = SheetHelper.findOneRow('Events', r => r.eventId === eventId);
    if (!event) return errorResponse('Event not found', 404);

    const now = new Date();
    const existing = body.distanceId
      ? SheetHelper.findOneRow('Event_Distances', r => r.distanceId === body.distanceId)
      : null;

    if (existing) {
      const updates = {
        distanceName: Validator.string(body.distanceName, 'distanceName', 100),
        distanceKm: Validator.number(body.distanceKm, 'distanceKm', 0),
        quota: Validator.number(body.quota, 'quota', 1),
        price: Validator.number(body.price, 'price', 0),
        sortOrder: Validator.optional(body.sortOrder, existing.sortOrder),
        status: Validator.optional(body.status, existing.status),
        updatedAt: now
      };
      SheetHelper.updateRow('Event_Distances', r => r.distanceId === body.distanceId, updates);
      CacheHelper.remove(CacheHelper.keys.eventDistances(eventId));
      return successResponse({ distanceId: body.distanceId, ...updates });
    }

    const distance = {
      distanceId: Validator.uuid(),
      eventId,
      distanceName: Validator.string(body.distanceName, 'distanceName', 100),
      distanceKm: Validator.number(body.distanceKm, 'distanceKm', 0),
      quota: Validator.number(body.quota, 'quota', 1),
      price: Validator.number(body.price, 'price', 0),
      registeredCount: 0,
      status: 'active',
      sortOrder: Validator.optional(body.sortOrder, 99),
      createdAt: now,
      updatedAt: now
    };
    SheetHelper.appendRow('Event_Distances', distance);
    CacheHelper.removeAll([CacheHelper.keys.event(eventId), CacheHelper.keys.eventDistances(eventId)]);
    return successResponse(distance);
  },

  _formatEvent(e) {
    return {
      eventId: e.eventId,
      eventName: e.eventName,
      eventDate: e.eventDate,
      eventLocation: e.eventLocation,
      coverImageUrl: e.coverImageUrl,
      description: e.description,
      registrationOpenAt: e.registrationOpenAt,
      registrationCloseAt: e.registrationCloseAt,
      maxParticipants: Number(e.maxParticipants),
      status: e.status,
      requireApproval: e.requireApproval === true || e.requireApproval === 'true'
    };
  }
};
