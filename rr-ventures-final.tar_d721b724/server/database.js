const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'rr-ventures.db');

let db = null;

async function getDb() {
  if (db) return db;
  
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  
  return db;
}

function saveDb() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Wrapper to mimic better-sqlite3 API
class DatabaseWrapper {
  constructor(sqlDb) {
    this.sqlDb = sqlDb;
  }

  exec(sql) {
    this.sqlDb.run(sql);
    saveDb();
  }

  prepare(sql) {
    const self = this;
    return {
      run(...params) {
        self.sqlDb.run(sql, params);
        saveDb();
        return { changes: self.sqlDb.getRowsModified() };
      },
      get(...params) {
        const stmt = self.sqlDb.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return null;
      },
      all(...params) {
        const results = [];
        const stmt = self.sqlDb.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }

  pragma(pragmaStr) {
    this.sqlDb.run(`PRAGMA ${pragmaStr}`);
  }
}

async function initializeDatabase() {
  const sqlDb = await getDb();
  const dbWrapper = new DatabaseWrapper(sqlDb);

  // Enable WAL mode for better performance
  dbWrapper.pragma('journal_mode = WAL');

  dbWrapper.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone TEXT,
      name TEXT NOT NULL,
      password_hash TEXT,
      role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user', 'member')),
      member_from TEXT,
      member_to TEXT,
      wallet_balance REAL DEFAULT 0,
      fcm_token TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Courts table
    CREATE TABLE IF NOT EXISTS courts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Default pricing
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Custom pricing for date ranges
    CREATE TABLE IF NOT EXISTS custom_pricing (
      id TEXT PRIMARY KEY,
      from_date TEXT NOT NULL,
      to_date TEXT NOT NULL,
      price_per_hour REAL NOT NULL,
      reason TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Bookings
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      court_id TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'confirmed' CHECK(status IN ('confirmed', 'cancelled', 'completed')),
      cancelled_at TEXT,
      cancellation_reason TEXT,
      cancellation_fee REAL DEFAULT 0,
      refund_amount REAL DEFAULT 0,
      refund_method TEXT CHECK(refund_method IN ('razorpay', 'wallet', NULL)),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (court_id) REFERENCES courts(id)
    );

    -- Payments
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      booking_id TEXT,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      method TEXT DEFAULT 'razorpay' CHECK(method IN ('razorpay', 'wallet', 'free')),
      status TEXT DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'refunded', 'partial_refund')),
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      refund_amount REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (booking_id) REFERENCES bookings(id)
    );

    -- Member groups
    CREATE TABLE IF NOT EXISTS member_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      max_members INTEGER DEFAULT 6,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Member group memberships
    CREATE TABLE IF NOT EXISTS member_group_users (
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES member_groups(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Audit logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Admin emails (whitelist for admin registration)
    CREATE TABLE IF NOT EXISTS admin_emails (
      email TEXT PRIMARY KEY,
      added_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Refunds
    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      payment_id TEXT NOT NULL,
      booking_id TEXT,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('razorpay', 'wallet')),
      status TEXT DEFAULT 'completed' CHECK(status IN ('pending', 'completed', 'failed')),
      razorpay_refund_id TEXT,
      reason TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (payment_id) REFERENCES payments(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Insert default settings
  const insertSetting = dbWrapper.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('default_price_per_hour', '300');
  insertSetting.run('open_hour', '5');
  insertSetting.run('close_hour', '22');
  insertSetting.run('cancellation_policy', JSON.stringify({
    less_than_6_hours: { refund_percent: 0 },
    between_6_and_12_hours: { refund_percent: 50 },
    between_12_and_24_hours: { refund_percent: 20 },
    more_than_24_hours: { refund_percent: 100 }
  }));

  // Insert default courts
  const insertCourt = dbWrapper.prepare('INSERT OR IGNORE INTO courts (id, name) VALUES (?, ?)');
  insertCourt.run('court-1', 'Court 1');
  insertCourt.run('court-2', 'Court 2');
  insertCourt.run('court-3', 'Court 3');

  // Create default admin if no admins exist
  const adminCount = dbWrapper.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
  if (adminCount.count === 0) {
    const { v4: uuidv4 } = require('uuid');
    const hash = bcrypt.hashSync('admin123', 10);
    const adminId = uuidv4();
    dbWrapper.prepare(
      'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)'
    ).run(adminId, 'admin@rrventures.com', 'Admin', hash, 'admin');
  }

  return dbWrapper;
}

module.exports = { getDb, initializeDatabase, saveDb };
