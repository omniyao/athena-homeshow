/**
 * Beyond Soap Daily Redemption Manager
 * Tracks the 100 gifts/day quota per show day, generates redemption vouchers, and verifies redemptions.
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'beyond_soap_ledger.json');

// Ensure data folder exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Initialize ledger if not present
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ counts: {}, vouchers: {} }, null, 2));
}

class BeyondSoapManager {
  constructor() {
    this.maxPerDay = 100;
  }

  _readDB() {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return { counts: {}, vouchers: {} };
    }
  }

  _writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  }

  _getDayKey(showLocation, date = new Date()) {
    // NZ Date formatting (YYYY-MM-DD)
    const nzDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Pacific/Auckland',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);

    const locationPrefix = showLocation.toLowerCase().includes('christchurch') ? 'CHC' : 'AKL';
    return `${locationPrefix}_${nzDateStr}`;
  }

  /**
   * Evaluates eligibility for an Array Design Studio submission
   * @param {string} email 
   * @param {string} showLocation 
   * @returns {Object} { isEligible, voucherCode, dailyNumber }
   */
  processArraySubmission(email, showLocation) {
    const db = this._readDB();
    const dayKey = this._getDayKey(showLocation);
    const cleanEmail = (email || '').toLowerCase().trim();

    // 1. Check if this customer was already issued a voucher today
    if (cleanEmail && db.vouchers) {
      const existingCode = Object.keys(db.vouchers).find(code => {
        const v = db.vouchers[code];
        return v.email === cleanEmail && v.dayKey === dayKey;
      });

      if (existingCode) {
        return {
          isEligible: true,
          voucherCode: existingCode,
          dailyNumber: db.vouchers[existingCode].dailyNumber,
          dayKey,
          alreadyIssued: true
        };
      }
    }

    // 2. Initialize day count if not present
    if (!db.counts[dayKey]) {
      db.counts[dayKey] = 0;
    }

    // Increment count
    db.counts[dayKey] += 1;
    const currentNumber = db.counts[dayKey];

    const isEligible = currentNumber <= this.maxPerDay;
    let voucherCode = null;

    if (isEligible) {
      // Generate guaranteed unique voucher code (e.g. BS-AKL-0904-001-7K9F)
      const randSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const cleanDayKey = dayKey.replace(/_/g, '-');
      voucherCode = `BS-${cleanDayKey}-${String(currentNumber).padStart(3, '0')}-${randSuffix}`;
      
      db.vouchers[voucherCode] = {
        email: cleanEmail,
        showLocation,
        dayKey,
        dailyNumber: currentNumber,
        issuedAt: new Date().toISOString(),
        redeemed: false,
        redeemedAt: null
      };
    }

    this._writeDB(db);

    return {
      isEligible,
      voucherCode,
      dailyNumber: currentNumber,
      dayKey
    };
  }

  /**
   * Staff on-stand voucher redemption
   * @param {string} voucherCode 
   * @returns {Object}
   */
  redeemVoucher(voucherCode) {
    const db = this._readDB();
    const cleanCode = voucherCode.trim().toUpperCase();

    if (!db.vouchers[cleanCode]) {
      return { success: false, message: 'Invalid or unrecognized voucher code.' };
    }

    const voucher = db.vouchers[cleanCode];

    if (voucher.redeemed) {
      return {
        success: false,
        message: `This voucher was already redeemed on ${voucher.redeemedAt}.`,
        voucher
      };
    }

    voucher.redeemed = true;
    voucher.redeemedAt = new Date().toISOString();
    this._writeDB(db);

    return {
      success: true,
      message: 'Beyond Soap gift voucher successfully redeemed!',
      voucher
    };
  }

  /**
   * Get stats for staff dashboard
   */
  getStats() {
    const db = this._readDB();
    return {
      counts: db.counts,
      totalVouchersIssued: Object.keys(db.vouchers).length,
      totalRedeemed: Object.values(db.vouchers).filter(v => v.redeemed).length
    };
  }
}

module.exports = new BeyondSoapManager();
