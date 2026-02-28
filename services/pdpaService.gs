// services/pdpaService.gs

const PdpaService = {

  /**
   * เช็ค consent status ของ user
   * คืน { consented: bool, currentVersion: str, userVersion: str, needReconsent: bool }
   */
  getConsentStatus(req) {
    const userId = req.userId;
    const currentVersion = SheetHelper.getSetting('pdpa_version') || '1.0';

    const user = SheetHelper.findOneRow('Users', r => r.userId === userId);
    if (!user) {
      return successResponse({
        consented: false,
        currentVersion,
        userVersion: null,
        needReconsent: true
      });
    }

    const needReconsent = !user.pdpaConsented ||
      String(user.pdpaVersion) !== String(currentVersion);

    return successResponse({
      consented: String(user.pdpaConsented) === 'true' || user.pdpaConsented === true,
      currentVersion,
      userVersion: user.pdpaVersion || null,
      needReconsent,
      pdpaText: SheetHelper.getSetting('pdpa_text_th') || DEFAULT_PDPA_TEXT
    });
  },

  /**
   * บันทึก PDPA consent
   * body: { action: 'accepted'|'declined', userAgent, consentVersion }
   */
  recordConsent(req) {
    const { body, userId, lineProfile } = req;

    const action = Validator.enum(body.action, 'action', ['accepted', 'declined']);
    const currentVersion = SheetHelper.getSetting('pdpa_version') || '1.0';
    const consentVersion = Validator.optional(body.consentVersion, currentVersion);
    const userAgent = Validator.optional(body.userAgent, '');

    // บันทึก consent log ทุกครั้ง (ไม่ลบเก่า)
    SheetHelper.appendRow('PDPA_Consents', {
      consentId: Validator.uuid(),
      userId,
      consentVersion,
      action,
      timestamp: new Date(),
      userAgent: userAgent.substring(0, 500),
      ipAddress: req.params._ip || ''
    });

    // อัปเดต Users sheet
    const pdpaConsented = action === 'accepted';
    const userExists = SheetHelper.findRowIndex('Users', r => r.userId === userId) !== -1;

    if (userExists) {
      SheetHelper.updateRow('Users', r => r.userId === userId, {
        pdpaConsented,
        pdpaVersion: consentVersion,
        updatedAt: new Date()
      });
    } else {
      // สร้าง user ใหม่ถ้ายังไม่มี
      SheetHelper.appendRow('Users', {
        userId,
        displayName: lineProfile?.displayName || '',
        pictureUrl: lineProfile?.pictureUrl || '',
        email: lineProfile?.email || '',
        pdpaConsented,
        pdpaVersion: consentVersion,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return successResponse({
      recorded: true,
      action,
      consentVersion,
      ...(action === 'declined' ? { message: 'คุณปฏิเสธ PDPA กรุณาปิดแอปหากไม่ต้องการใช้งาน' } : {})
    });
  }
};

const DEFAULT_PDPA_TEXT = `แอปนี้เก็บรวบรวมข้อมูลส่วนบุคคลของคุณ ได้แก่ ชื่อ, LINE User ID, รูปโปรไฟล์ เพื่อใช้ในการสมัครงานวิ่งและยืนยันตัวตน ข้อมูลจะถูกเก็บอย่างปลอดภัยและไม่เปิดเผยแก่บุคคลที่สาม`;
