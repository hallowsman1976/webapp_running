// utils/sheetHelper.gs
// Abstraction layer สำหรับ Google Sheets operations

const SheetHelper = {

  /**
   * ดึง sheet object
   */
  getSheet(sheetName) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Sheet '${sheetName}' not found`);
    return sheet;
  },

  /**
   * ดึง header row (row 1) → array of column names
   */
  getHeaders(sheetName) {
    const sheet = this.getSheet(sheetName);
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) return [];
    return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  },

  /**
   * ดึงข้อมูลทั้งชีตเป็น array of objects
   */
  getAllRows(sheetName) {
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    return data.map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] ?? ''; });
      return obj;
    });
  },

  /**
   * ดึงข้อมูลโดย filter function (batch read แล้ว filter)
   */
  findRows(sheetName, filterFn) {
    return this.getAllRows(sheetName).filter(filterFn);
  },

  /**
   * ค้นหาแถวแรกที่ตรงกัน
   */
  findOneRow(sheetName, filterFn) {
    const rows = this.getAllRows(sheetName);
    return rows.find(filterFn) || null;
  },

  /**
   * ค้นหา row index (1-based, รวม header) ที่ตรงกัน
   */
  findRowIndex(sheetName, filterFn) {
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return -1;

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    for (let i = 0; i < data.length; i++) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = data[i][idx] ?? ''; });
      if (filterFn(obj)) return i + 2; // +2 เพราะ row 1 = header, data เริ่ม row 2
    }
    return -1;
  },

  /**
   * เพิ่มแถวใหม่ (append)
   * data = object { columnName: value, ... }
   */
  appendRow(sheetName, data) {
    const sheet = this.getSheet(sheetName);
    const headers = this.getHeaders(sheetName);
    const row = headers.map(h => {
      const val = data[h];
      if (val instanceof Date) return val;
      return val !== undefined ? val : '';
    });
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    return data;
  },

  /**
   * อัปเดตแถวที่ตรงกัน (batch read → find → write)
   */
  updateRow(sheetName, filterFn, updates) {
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    for (let i = 0; i < data.length; i++) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = data[i][idx] ?? ''; });

      if (filterFn(obj)) {
        // Merge updates
        Object.keys(updates).forEach(key => {
          const colIdx = headers.indexOf(key);
          if (colIdx !== -1) {
            data[i][colIdx] = updates[key];
          }
        });
        // Write back single row
        sheet.getRange(i + 2, 1, 1, lastCol).setValues([data[i]]);
        SpreadsheetApp.flush();
        return true;
      }
    }
    return false;
  },

  /**
   * อัปเดตหลายแถวพร้อมกัน (batch)
   */
  batchUpdateRows(sheetName, updates) {
    // updates = [{ filterFn, data }]
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return 0;

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    let updatedCount = 0;

    allData.forEach((row, i) => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = row[idx] ?? ''; });

      updates.forEach(({ filterFn, data }) => {
        if (filterFn(obj)) {
          Object.keys(data).forEach(key => {
            const colIdx = headers.indexOf(key);
            if (colIdx !== -1) allData[i][colIdx] = data[key];
          });
          updatedCount++;
        }
      });
    });

    if (updatedCount > 0) {
      sheet.getRange(2, 1, allData.length, lastCol).setValues(allData);
      SpreadsheetApp.flush();
    }
    return updatedCount;
  },

  /**
   * ลบแถวที่ตรงกัน (soft delete = update status, หรือ hard delete)
   */
  deleteRow(sheetName, filterFn, soft = true, statusField = 'status') {
    if (soft) {
      return this.updateRow(sheetName, filterFn, {
        [statusField]: 'deleted',
        updatedAt: new Date()
      });
    }

    const rowIndex = this.findRowIndex(sheetName, filterFn);
    if (rowIndex === -1) return false;

    const sheet = this.getSheet(sheetName);
    sheet.deleteRow(rowIndex);
    SpreadsheetApp.flush();
    return true;
  },

  /**
   * Pagination query
   */
  paginateRows(sheetName, filterFn, page = 1, limit = 20) {
    const all = this.findRows(sheetName, filterFn);
    const total = all.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const items = all.slice(start, start + limit);

    return { items, total, page, limit, totalPages };
  },

  /**
   * Get setting value
   */
  getSetting(key) {
    const row = this.findOneRow('Settings', r => r.key === key);
    return row ? row.value : null;
  },

  /**
   * Set setting value
   */
  setSetting(key, value, updatedBy = 'system') {
    const exists = this.findRowIndex('Settings', r => r.key === key);
    if (exists !== -1) {
      this.updateRow('Settings', r => r.key === key, {
        value,
        updatedAt: new Date(),
        updatedBy
      });
    } else {
      this.appendRow('Settings', { key, value, updatedAt: new Date(), updatedBy });
    }
  }
};
