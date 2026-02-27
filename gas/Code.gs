// ==========================================
// Backend API (Google Apps Script)
// ==========================================
const CONFIG = {
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('GOOGLE_SHEET_ID') || "1ktbM1c_QxRAuxR9Jm_YB0iydqf_qmtweE6Yptd57hgI",
  SHEET_USERS: "Users",
  SHEET_CONSENTS: "PDPA_Consents",
  SHEET_EVENTS: "Events",
  SHEET_DISTANCES: "Event_Distances",
  SHEET_REGISTRATIONS: "Registrations",
  SHEET_CHECKINS: "Checkins",
  SHEET_ADMIN_USERS: "Admin_Users"
};

const ResponseHelper = {
  success: (data, message = "Success") => ContentService.createTextOutput(JSON.stringify({ status: "success", message, data })).setMimeType(ContentService.MimeType.JSON),
  error: (message, statusCode = 400) => ContentService.createTextOutput(JSON.stringify({ status: "error", message, code: statusCode })).setMimeType(ContentService.MimeType.JSON)
};

const DB = {
  getSheet: (sheetName) => SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(sheetName),
  getAll: function(sheetName) {
    const sheet = this.getSheet(sheetName);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    const headers = data[0];
    return data.slice(1).map(row => {
      let obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
  },
  insert: function(sheetName, dataObj) {
    const sheet = this.getSheet(sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(h => dataObj[h] !== undefined ? dataObj[h] : "");
    sheet.appendRow(newRow);
    return true;
  }
};

const Services = {
  checkUserStatus: (payload) => {
    // บันทึก/อัปเดต Profile ลง Sheet Users เบื้องต้น (ถ้ายังไม่มี)
    const usersSheet = DB.getSheet(CONFIG.SHEET_USERS);
    const usersData = DB.getAll(CONFIG.SHEET_USERS);
    if(!usersData.find(u => u.userId === payload.userId)) {
      DB.insert(CONFIG.SHEET_USERS, { userId: payload.userId, displayName: payload.displayName, pictureUrl: payload.pictureUrl, createdAt: new Date().toISOString() });
    }
    const hasConsent = DB.getAll(CONFIG.SHEET_CONSENTS).find(c => c.userId === payload.userId && c.consentVersion === "v1.0");
    const isAdmin = DB.getAll(CONFIG.SHEET_ADMIN_USERS).some(a => a.userId === payload.userId && (a.isActive === true || a.isActive === "TRUE"));
    return { isConsented: !!hasConsent, isAdmin: isAdmin };
  },
  saveConsent: (payload) => {
    DB.insert(CONFIG.SHEET_CONSENTS, { consentId: Utilities.getUuid(), userId: payload.userId, consentVersion: "v1.0", userAgent: payload.userAgent || "Unknown", createdAt: new Date().toISOString() });
    return { success: true };
  },
  getActiveEvents: () => {
    const events = DB.getAll(CONFIG.SHEET_EVENTS).filter(e => e.status === "active" || e.status === "ACTIVE");
    const distances = DB.getAll(CONFIG.SHEET_DISTANCES);
    return events.map(e => {
      e.distances = distances.filter(d => d.eventId === e.eventId);
      return e;
    });
  },
  registerEvent: (payload) => {
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const existingRegs = DB.getAll(CONFIG.SHEET_REGISTRATIONS);
      if (existingRegs.some(r => r.userId === payload.userId && r.eventId === payload.eventId)) {
        throw new Error("คุณได้สมัครงานวิ่งนี้ไปแล้ว");
      }
      const distanceInfo = DB.getAll(CONFIG.SHEET_DISTANCES).find(d => d.distanceId === payload.distanceId && d.eventId === payload.eventId);
      if (!distanceInfo) throw new Error("ไม่พบระยะวิ่งที่เลือกระบบ");

      const count = existingRegs.filter(r => r.eventId === payload.eventId && r.distanceId === payload.distanceId).length;
      const prefix = distanceInfo.distanceName.replace(/\s+/g, '').toUpperCase();
      const bibNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;
      const regId = "REG-" + Utilities.getUuid().split('-')[0].toUpperCase();

      DB.insert(CONFIG.SHEET_REGISTRATIONS, { regId, userId: payload.userId, eventId: payload.eventId, distanceId: payload.distanceId, bibNumber, status: "pending", createdAt: new Date().toISOString() });
      return { regId, bibNumber, status: "pending" };
    } finally { lock.releaseLock(); }
  }
};

const CardService = {
  getMyCards: (payload) => {
    const events = DB.getAll(CONFIG.SHEET_EVENTS);
    const distances = DB.getAll(CONFIG.SHEET_DISTANCES);
    const checkins = DB.getAll(CONFIG.SHEET_CHECKINS);
    return DB.getAll(CONFIG.SHEET_REGISTRATIONS).filter(r => r.userId === payload.userId && r.status === 'approved').map(reg => ({
      regId: reg.regId, bibNumber: reg.bibNumber,
      eventTitle: (events.find(e => e.eventId === reg.eventId) || {}).title,
      coverUrl: (events.find(e => e.eventId === reg.eventId) || {}).coverUrl,
      distanceName: (distances.find(d => d.distanceId === reg.distanceId) || {}).distanceName,
      isCheckedIn: checkins.some(c => c.regId === reg.regId)
    })).reverse();
  },
  processQrCheckin: (payload) => {
    AdminService.isAdmin(payload.staffId);
    const regId = payload.qrData.trim();
    if (!regId.startsWith("REG-")) throw new Error("รูปแบบ QR Code ไม่ถูกต้อง");
    const lock = LockService.getScriptLock();
    lock.waitLock(5000);
    try {
      const regInfo = DB.getAll(CONFIG.SHEET_REGISTRATIONS).find(r => r.regId === regId);
      if (!regInfo) throw new Error("ไม่พบข้อมูลในระบบ");
      if (regInfo.status !== 'approved') throw new Error(`สถานะ '${regInfo.status}' ไม่สามารถเช็คอินได้`);
      if (DB.getAll(CONFIG.SHEET_CHECKINS).some(c => c.regId === regId)) throw new Error(`BIB: ${regInfo.bibNumber} ถูก Check-in ไปแล้ว!`);
      DB.insert(CONFIG.SHEET_CHECKINS, { checkinId: "CHK-" + Utilities.getUuid().split('-')[0].toUpperCase(), regId: regId, checkpointName: "QR Scan", checkinTime: new Date().toISOString(), checkinBy: payload.staffId });
      return { success: true, bibNumber: regInfo.bibNumber };
    } finally { lock.releaseLock(); }
  }
};

const AdminService = {
  isAdmin: (userId) => {
    const admin = DB.getAll(CONFIG.SHEET_ADMIN_USERS).find(a => a.userId === userId && (a.isActive === true || a.isActive === "TRUE"));
    if (!admin) throw new Error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");
    return admin;
  },
  getDashboardStats: function(payload) {
    this.isAdmin(payload.adminId);
    const regs = DB.getAll(CONFIG.SHEET_REGISTRATIONS);
    const totalCheckins = DB.getAll(CONFIG.SHEET_CHECKINS).length;
    const approvedRegs = regs.filter(r => r.status === 'approved').length;
    return { totalRegs: regs.length, pendingRegs: regs.filter(r => r.status === 'pending').length, approvedRegs: approvedRegs, totalCheckins: totalCheckins, absentRegs: approvedRegs - totalCheckins };
  },
  getRegistrations: function(payload) {
    this.isAdmin(payload.adminId);
    let regs = DB.getAll(CONFIG.SHEET_REGISTRATIONS).reverse();
    const users = DB.getAll(CONFIG.SHEET_USERS);
    let merged = regs.map(reg => {
      const user = users.find(u => u.userId === reg.userId) || {};
      return { ...reg, displayName: user.displayName || "Unknown", pictureUrl: user.pictureUrl || "" };
    });
    if (payload.search) {
      const s = payload.search.toLowerCase();
      merged = merged.filter(r => (r.bibNumber && r.bibNumber.toLowerCase().includes(s)) || (r.displayName && r.displayName.toLowerCase().includes(s)));
    }
    const startIndex = (payload.page - 1) * payload.limit;
    return { data: merged.slice(startIndex, startIndex + payload.limit), pagination: { page: payload.page, totalPages: Math.ceil(merged.length / payload.limit) || 1 } };
  },
  updateRegStatus: function(payload) {
    const admin = this.isAdmin(payload.adminId);
    const sheet = DB.getSheet(CONFIG.SHEET_REGISTRATIONS);
    const data = sheet.getDataRange().getValues();
    const rowToUpdate = data.findIndex(row => row[data[0].indexOf("regId")] === payload.regId) + 1;
    if (rowToUpdate === 0) throw new Error("ไม่พบข้อมูลการสมัคร");

    if (payload.action === 'approve' || payload.action === 'reject') {
      sheet.getRange(rowToUpdate, data[0].indexOf("status") + 1).setValue(payload.action + 'ed');
    } else if (payload.action === 'checkin') {
      const lock = LockService.getScriptLock();
      lock.waitLock(5000);
      try {
        if (DB.getAll(CONFIG.SHEET_CHECKINS).some(c => c.regId === payload.regId)) throw new Error("ผู้สมัครถูก Check-in ไปแล้ว");
        DB.insert(CONFIG.SHEET_CHECKINS, { checkinId: "CHK-" + Utilities.getUuid().split('-')[0], regId: payload.regId, checkpointName: "Admin Shortcut", checkinTime: new Date().toISOString(), checkinBy: admin.userId });
      } finally { lock.releaseLock(); }
    }
    return { success: true };
  }
};

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Runner Event System')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    switch (payload.action) {
      case "CHECK_USER": return ResponseHelper.success(Services.checkUserStatus(payload));
      case "SAVE_CONSENT": return ResponseHelper.success(Services.saveConsent(payload));
      case "GET_EVENTS": return ResponseHelper.success(Services.getActiveEvents());
      case "REGISTER_EVENT": return ResponseHelper.success(Services.registerEvent(payload));
      case "ADMIN_GET_DASHBOARD": return ResponseHelper.success(AdminService.getDashboardStats(payload));
      case "ADMIN_GET_REGS": return ResponseHelper.success(AdminService.getRegistrations(payload));
      case "ADMIN_UPDATE_REG": return ResponseHelper.success(AdminService.updateRegStatus(payload));
      case "GET_MY_CARDS": return ResponseHelper.success(CardService.getMyCards(payload));
      case "PROCESS_QR_CHECKIN": return ResponseHelper.success(CardService.processQrCheckin(payload));
      default: return ResponseHelper.error("Action not found", 404);
    }
  } catch (err) { return ResponseHelper.error(err.message, 500); }
}
