// utils/cacheHelper.gs
// Wrapper รอบ CacheService สำหรับ GAS

const CacheHelper = {
  _cache: null,

  getCache() {
    if (!this._cache) this._cache = CacheService.getScriptCache();
    return this._cache;
  },

  /**
   * ดึงค่า cache (parse JSON อัตโนมัติ)
   */
  get(key) {
    try {
      const val = this.getCache().get(key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },

  /**
   * เซ็ตค่า cache (stringify JSON อัตโนมัติ)
   * ttl = seconds (max 21600 = 6 ชั่วโมง)
   */
  set(key, value, ttl = 300) {
    try {
      const str = JSON.stringify(value);
      if (str.length > 100000) {
        console.warn(`CacheHelper: value for '${key}' too large (${str.length} chars), skipping cache`);
        return false;
      }
      this.getCache().put(key, str, Math.min(ttl, 21600));
      return true;
    } catch (err) {
      console.warn('CacheHelper.set error:', err.message);
      return false;
    }
  },

  /**
   * ลบ cache key
   */
  remove(key) {
    try {
      this.getCache().remove(key);
    } catch {}
  },

  /**
   * ลบหลาย keys พร้อมกัน
   */
  removeAll(keys) {
    try {
      this.getCache().removeAll(keys);
    } catch {}
  },

  /**
   * Cache-aside pattern: ถ้ามีใน cache คืนเลย ไม่มีดึงจาก fetchFn แล้วเก็บ
   */
  getOrSet(key, fetchFn, ttl = 300) {
    const cached = this.get(key);
    if (cached !== null) {
      console.log(`Cache HIT: ${key}`);
      return cached;
    }
    console.log(`Cache MISS: ${key}`);
    const value = fetchFn();
    this.set(key, value, ttl);
    return value;
  },

  // Key builders
  keys: {
    eventList: () => 'events:list:published',
    event: (id) => `events:${id}`,
    eventDistances: (id) => `events:${id}:distances`,
    dashboardStats: (eventId) => `dashboard:stats:${eventId}`,
    settings: () => 'settings:all'
  }
};
