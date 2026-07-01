const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authMiddleware, adminMiddleware, logAction } = require('../middleware');

const router = express.Router();

// All admin routes require admin role
router.use(authMiddleware, adminMiddleware);

// Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const db = await getDb();
    const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE role != 'admin'").get().c;
    const totalBookings = db.prepare("SELECT COUNT(*) as c FROM bookings").get().c;
    const todayBookings = db.prepare("SELECT COUNT(*) as c FROM bookings WHERE booking_date = date('now')").get().c;
    const todayRevenue = db.prepare(
      "SELECT COALESCE(SUM(total_amount), 0) as s FROM bookings WHERE booking_date = date('now') AND status = 'confirmed'"
    ).get().s;
    const totalRevenue = db.prepare(
      "SELECT COALESCE(SUM(total_amount), 0) as s FROM bookings WHERE status = 'confirmed'"
    ).get().s;
    const activeMembers = db.prepare(
      "SELECT COUNT(*) as c FROM users WHERE role = 'member' AND member_to >= date('now')"
    ).get().c;
    const pendingRefunds = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as s FROM refunds WHERE status = 'completed'"
    ).get().s;

    res.json({
      total_users: totalUsers, total_bookings: totalBookings,
      today_bookings: todayBookings, today_revenue: todayRevenue,
      total_revenue: totalRevenue, active_members: activeMembers,
      total_refunds: pendingRefunds
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const db = await getDb();
    const users = db.prepare(
      'SELECT id, email, phone, name, role, wallet_balance, member_from, member_to, created_at FROM users ORDER BY created_at DESC'
    ).all();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update user role
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role, member_from, member_to } = req.body;
    if (!['admin', 'user', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const db = await getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updates = { role };
    if (role === 'member') {
      updates.member_from = member_from || new Date().toISOString().split('T')[0];
      updates.member_to = member_to || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    db.prepare(
      'UPDATE users SET role = ?, member_from = COALESCE(?, member_from), member_to = COALESCE(?, member_to), updated_at = datetime("now") WHERE id = ?'
    ).run(role, updates.member_from || null, updates.member_to || null, req.params.id);

    await logAction(req.user.id, 'role_changed', 'user', req.params.id, {
      from_role: user.role, to_role: role, member_from: updates.member_from, member_to: updates.member_to
    }, req.ip);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get all bookings
router.get('/bookings', async (req, res) => {
  try {
    const { date, court_id, status } = req.query;
    let query = 'SELECT b.*, c.name as court_name, u.name as user_name, u.email as user_email FROM bookings b JOIN courts c ON b.court_id = c.id JOIN users u ON b.user_id = u.id WHERE 1=1';
    const params = [];

    if (date) { query += ' AND b.booking_date = ?'; params.push(date); }
    if (court_id) { query += ' AND b.court_id = ?'; params.push(court_id); }
    if (status) { query += ' AND b.status = ?'; params.push(status); }

    query += ' ORDER BY b.booking_date DESC, b.start_hour ASC';
    const db = await getDb();
    const bookings = db.prepare(query).all(...params);
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get all payments
router.get('/payments', async (req, res) => {
  try {
    const db = await getDb();
    const payments = db.prepare(
      'SELECT p.*, u.name as user_name, u.email as user_email, b.booking_date, b.court_id FROM payments p JOIN users u ON p.user_id = u.id LEFT JOIN bookings b ON p.booking_id = b.id ORDER BY p.created_at DESC'
    ).all();
    res.json(payments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get all refunds
router.get('/refunds', async (req, res) => {
  try {
    const db = await getDb();
    const refunds = db.prepare(
      'SELECT r.*, u.name as user_name, u.email as user_email FROM refunds r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC'
    ).all();
    res.json(refunds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get audit logs
router.get('/logs', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const db = await getDb();
    const logs = db.prepare(
      'SELECT l.*, u.name as user_name, u.email as user_email FROM audit_logs l LEFT JOIN users u ON l.user_id = u.id ORDER BY l.created_at DESC LIMIT ? OFFSET ?'
    ).all(parseInt(limit), parseInt(offset));
    const total = db.prepare('SELECT COUNT(*) as c FROM audit_logs').get().c;
    res.json({ logs, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update default pricing
router.put('/pricing/default', async (req, res) => {
  try {
    const { price_per_hour } = req.body;
    if (!price_per_hour || price_per_hour <= 0) return res.status(400).json({ error: 'Invalid price' });

    const db = await getDb();
    const old = db.prepare("SELECT value FROM settings WHERE key = 'default_price_per_hour'").get();
    db.prepare(
      "UPDATE settings SET value = ?, updated_by = ?, updated_at = datetime('now') WHERE key = 'default_price_per_hour'"
    ).run(String(price_per_hour), req.user.id);

    await logAction(req.user.id, 'pricing_updated', 'settings', 'default_price_per_hour', {
      old_price: old?.value, new_price: price_per_hour
    }, req.ip);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Create custom pricing for date range
router.post('/pricing/custom', async (req, res) => {
  try {
    const { from_date, to_date, price_per_hour, reason } = req.body;
    if (!from_date || !to_date || !price_per_hour) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = uuidv4();
    const db = await getDb();
    db.prepare(
      'INSERT INTO custom_pricing (id, from_date, to_date, price_per_hour, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, from_date, to_date, price_per_hour, reason || '', req.user.id);

    await logAction(req.user.id, 'custom_pricing_created', 'custom_pricing', id, {
      from_date, to_date, price_per_hour, reason
    }, req.ip);

    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get custom pricing
router.get('/pricing/custom', async (req, res) => {
  try {
    const db = await getDb();
    const pricing = db.prepare(
      'SELECT cp.*, u.name as created_by_name FROM custom_pricing cp LEFT JOIN users u ON cp.created_by = u.id ORDER BY cp.from_date DESC'
    ).all();
    res.json(pricing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Delete custom pricing
router.delete('/pricing/custom/:id', async (req, res) => {
  try {
    const db = await getDb();
    const pricing = db.prepare('SELECT * FROM custom_pricing WHERE id = ?').get(req.params.id);
    if (!pricing) return res.status(404).json({ error: 'Not found' });

    db.prepare('DELETE FROM custom_pricing WHERE id = ?').run(req.params.id);
    await logAction(req.user.id, 'custom_pricing_deleted', 'custom_pricing', req.params.id, {
      from_date: pricing.from_date, to_date: pricing.to_date, price: pricing.price_per_hour
    }, req.ip);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update operating hours
router.put('/settings/hours', async (req, res) => {
  try {
    const { open_hour, close_hour } = req.body;
    const db = await getDb();
    db.prepare("UPDATE settings SET value = ?, updated_by = ?, updated_at = datetime('now') WHERE key = 'open_hour'")
      .run(String(open_hour), req.user.id);
    db.prepare("UPDATE settings SET value = ?, updated_by = ?, updated_at = datetime('now') WHERE key = 'close_hour'")
      .run(String(close_hour), req.user.id);

    await logAction(req.user.id, 'hours_updated', 'settings', 'hours', { open_hour, close_hour }, req.ip);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Bank details management
router.get('/bank-details', async (req, res) => {
  try {
    const db = await getDb();
    const details = db.prepare("SELECT value FROM settings WHERE key = 'bank_details'").get();
    res.json(details ? JSON.parse(details.value) : null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/bank-details', async (req, res) => {
  try {
    const { account_name, account_number, ifsc_code, bank_name, upi_id } = req.body;
    const details = { account_name, account_number, ifsc_code, bank_name, upi_id };

    const db = await getDb();
    const existing = db.prepare("SELECT value FROM settings WHERE key = 'bank_details'").get();
    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value, updated_by, updated_at) VALUES ('bank_details', ?, ?, datetime('now'))"
    ).run(JSON.stringify(details), req.user.id);

    await logAction(req.user.id, 'bank_details_updated', 'settings', 'bank_details', {
      old: existing ? JSON.parse(existing.value) : null, new: details
    }, req.ip);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Admin emails management
router.get('/admin-emails', async (req, res) => {
  try {
    const db = await getDb();
    const emails = db.prepare(
      'SELECT ae.*, u.name as added_by_name FROM admin_emails ae LEFT JOIN users u ON ae.added_by = u.id ORDER BY ae.created_at DESC'
    ).all();
    res.json(emails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/admin-emails', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const db = await getDb();
    db.prepare('INSERT OR IGNORE INTO admin_emails (email, added_by) VALUES (?, ?)').run(email, req.user.id);
    await logAction(req.user.id, 'admin_email_added', 'admin_email', email, { email }, req.ip);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/admin-emails/:email', async (req, res) => {
  try {
    const db = await getDb();
    db.prepare('DELETE FROM admin_emails WHERE email = ?').run(req.params.email);
    await logAction(req.user.id, 'admin_email_removed', 'admin_email', req.params.email, { email: req.params.email }, req.ip);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Member groups management
router.get('/groups', async (req, res) => {
  try {
    const db = await getDb();
    const groups = db.prepare(
      'SELECT mg.*, GROUP_CONCAT(u.name, ", ") as member_names, COUNT(mgu.user_id) as member_count FROM member_groups mg LEFT JOIN member_group_users mgu ON mg.id = mgu.group_id LEFT JOIN users u ON mgu.user_id = u.id GROUP BY mg.id ORDER BY mg.created_at DESC'
    ).all();
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/groups', async (req, res) => {
  try {
    const { name, max_members, member_ids } = req.body;
    const id = uuidv4();
    const db = await getDb();
    db.prepare('INSERT INTO member_groups (id, name, max_members, created_by) VALUES (?, ?, ?, ?)')
      .run(id, name, max_members || 6, req.user.id);

    if (member_ids && member_ids.length > 0) {
      const insert = db.prepare('INSERT INTO member_group_users (group_id, user_id) VALUES (?, ?)');
      member_ids.forEach(uid => insert.run(id, uid));
    }

    await logAction(req.user.id, 'group_created', 'member_group', id, { name, max_members, member_ids }, req.ip);
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/groups/:id', async (req, res) => {
  try {
    const { name, max_members, member_ids } = req.body;
    const db = await getDb();
    const group = db.prepare('SELECT * FROM member_groups WHERE id = ?').get(req.params.id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (name) db.prepare('UPDATE member_groups SET name = ? WHERE id = ?').run(name, req.params.id);
    if (max_members) db.prepare('UPDATE member_groups SET max_members = ? WHERE id = ?').run(max_members, req.params.id);

    if (member_ids) {
      db.prepare('DELETE FROM member_group_users WHERE group_id = ?').run(req.params.id);
      const insert = db.prepare('INSERT INTO member_group_users (group_id, user_id) VALUES (?, ?)');
      member_ids.forEach(uid => insert.run(req.params.id, uid));
    }

    await logAction(req.user.id, 'group_updated', 'member_group', req.params.id, { name, max_members, member_ids }, req.ip);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/groups/:id', async (req, res) => {
  try {
    const db = await getDb();
    db.prepare('DELETE FROM member_group_users WHERE group_id = ?').run(req.params.id);
    db.prepare('DELETE FROM member_groups WHERE id = ?').run(req.params.id);
    await logAction(req.user.id, 'group_deleted', 'member_group', req.params.id, {}, req.ip);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
