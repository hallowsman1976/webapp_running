// services/userService.gs

const UserService = {

  /**
   * Sync LINE profile → Users sheet (upsert)
   * body: { displayName, pictureUrl, email }
   */
  syncProfile(req) {
    const { userId, lineProfile } = req;
    const now = new Date();

    const existing = SheetHelper.findOneRow('Users', r => r.userId === userId);

    if (existing) {
      // banned user
      if (existing.status === 'banned') {
        return errorResponse('Your account has been suspended', 403);
      }

      SheetHelper.updateRow('Users', r => r.userId === userId, {
        displayName: lineProfile.displayName || existing.displayName,
        pictureUrl: lineProfile.pictureUrl || existing.pictureUrl,
        email: lineProfile.email || existing.email,
        updatedAt: now
      });

      return successResponse({
        userId,
        displayName: lineProfile.displayName,
        pictureUrl: lineProfile.pictureUrl,
        pdpaConsented: String(existing.pdpaConsented) === 'true',
        pdpaVersion: existing.pdpaVersion,
        isNew: false
      });
    }

    // สร้าง user ใหม่
    const newUser = {
      userId,
      displayName: lineProfile.displayName || '',
      pictureUrl: lineProfile.pictureUrl || '',
      email: lineProfile.email || '',
      phone: '',
      pdpaConsented: false,
      pdpaVersion: '',
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
    SheetHelper.appendRow('Users', newUser);

    return successResponse({ ...newUser, isNew: true });
  }
};
