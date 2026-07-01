const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { JWT_SECRET, logAction } = require('../middleware');

const router = express.Router();

// Register with email/password
router.post('/register', async (req, res) => {
  try {
    const { email, phone, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Email, name and password are required' });
    }

    const db = await getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);

    // Check if email is in admin whitelist
    const adminEmail = db.prepare('SELECT email FROM admin_emails WHERE email = ?').get(email);
    const role = adminEmail ? 'admin' : 'user';

    db.prepare(
      'INSERT INTO users (id, email, phone, name, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, email, phone || null, name, hash, role);

    const token = jwt.sign({ userId: id }, JWT_SECRET, { expiresIn: '30d' });
    await logAction(id, 'register', 'user', id, { email, name, role }, req.ip);

    res.json({ token, user: { id, email, phone, name, role, wallet_balance: 0 } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Login with email/password
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const db = await getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check member expiry
    let role = user.role;
    if (role === 'member' && user.member_to) {
      const expiry = new Date(user.member_to);
      if (expiry < new Date()) {
        role = 'user';
        db.prepare('UPDATE users SET role = ?, updated_at = datetime("now") WHERE id = ?').run(role, user.id);
      }
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    await logAction(user.id, 'login', 'user', user.id, { email }, req.ip);

    res.json({
      token,
      user: {
        id: user.id, email: user.email, phone: user.phone,
        name: user.name, role, wallet_balance: user.wallet_balance,
        member_from: user.member_from, member_to: user.member_to
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Mock Google OAuth (in production, verify Google token)
router.post('/google', async (req, res) => {
  try {
    const { googleToken, email, name, picture } = req.body;
    if (!email || !name) return res.status(400).json({ error: 'Email and name required' });

    const db = await getDb();
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      const id = uuidv4();
      const adminEmail = db.prepare('SELECT email FROM admin_emails WHERE email = ?').get(email);
      const role = adminEmail ? 'admin' : 'user';
      db.prepare(
        'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)'
      ).run(id, email, name, role);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      await logAction(id, 'google_register', 'user', id, { email, name }, req.ip);
    } else {
      await logAction(user.id, 'google_login', 'user', user.id, { email }, req.ip);
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: {
        id: user.id, email: user.email, phone: user.phone,
        name: user.name, role: user.role, wallet_balance: user.wallet_balance
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Mock OTP send
router.post('/otp/send', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });

    // In production, use Firebase Auth or Twilio
    const otp = '123456'; // Mock OTP - in production, generate random
    // Store OTP temporarily
    const db = await getDb();
    db.prepare(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
    ).run(`otp:${phone}`, otp);

    console.log(`[MOCK OTP] Phone: ${phone}, OTP: ${otp}`);
    res.json({ success: true, message: 'OTP sent successfully (mock: 123456)' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Mock OTP verify + login/register
router.post('/otp/verify', async (req, res) => {
  try {
    const { phone, otp, name } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP required' });

    const db = await getDb();
    const stored = db.prepare('SELECT value FROM settings WHERE key = ?').get(`otp:${phone}`);
    if (!stored || stored.value !== otp) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // Clean up OTP
    db.prepare('DELETE FROM settings WHERE key = ?').run(`otp:${phone}`);

    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    if (!user) {
      const id = uuidv4();
      const userName = name || `User-${phone.slice(-4)}`;
      db.prepare(
        'INSERT INTO users (id, phone, name, role) VALUES (?, ?, ?, ?)'
      ).run(id, phone, userName, 'user');
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      await logAction(id, 'otp_register', 'user', id, { phone }, req.ip);
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      token,
      user: {
        id: user.id, email: user.email, phone: user.phone,
        name: user.name, role: user.role, wallet_balance: user.wallet_balance
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update FCM token
router.post('/fcm-token', async (req, res) => {
  try {
    const { token: fcmToken } = req.body;
    const db = await getDb();
    db.prepare('UPDATE users SET fcm_token = ?, updated_at = datetime("now") WHERE id = ?')
      .run(fcmToken, req.user.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const user = req.user;
    let role = user.role;
    if (role === 'member' && user.member_to && new Date(user.member_to) < new Date()) {
      role = 'user';
    }
    res.json({
      id: user.id, email: user.email, phone: user.phone,
      name: user.name, role, wallet_balance: user.wallet_balance,
      member_from: user.member_from, member_to: user.member_to
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
