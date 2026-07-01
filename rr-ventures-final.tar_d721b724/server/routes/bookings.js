const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authMiddleware, adminMiddleware, logAction } = require('../middleware');

const router = express.Router();

// Get price for a specific date
async function getPriceForDate(dateStr) {
  const db = await getDb();
  const customPricing = db.prepare(
    'SELECT * FROM custom_pricing WHERE from_date <= ? AND to_date >= ? ORDER BY created_at DESC LIMIT 1'
  ).get(dateStr, dateStr);
  if (customPricing) return customPricing.price_per_hour;
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_price_per_hour');
  return parseFloat(setting?.value || '300');
}

// Get courts with availability for a date
router.get('/availability/:date', authMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    const db = await getDb();
    const courts = db.prepare('SELECT * FROM courts WHERE is_active = 1').all();
    const openHour = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'open_hour'").get()?.value || '5');
    const closeHour = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'close_hour'").get()?.value || '22');
    const pricePerHour = await getPriceForDate(date);

    // Check if user is in a member group and has booking on this date
    const userGroup = db.prepare(
      'SELECT mg.id as group_id FROM member_group_users mgu JOIN member_groups mg ON mgu.group_id = mg.id WHERE mgu.user_id = ?'
    ).get(req.user.id);

    let groupBookingCourt = null;
    if (userGroup) {
      const groupMembers = db.prepare(
        'SELECT user_id FROM member_group_users WHERE group_id = ?'
      ).all(userGroup.group_id).map(m => m.user_id);
      
      if (groupMembers.length > 0) {
        const placeholders = groupMembers.map(() => '?').join(',');
        const groupBooking = db.prepare(
          `SELECT court_id FROM bookings WHERE user_id IN (${placeholders}) AND booking_date = ? AND status = 'confirmed' LIMIT 1`
        ).get(...groupMembers, date);
        if (groupBooking) groupBookingCourt = groupBooking.court_id;
      }
    }

    const result = courts.map(court => {
      const bookings = db.prepare(
        "SELECT start_hour, end_hour, user_id FROM bookings WHERE court_id = ? AND booking_date = ? AND status = 'confirmed'"
      ).all(court.id, date);

      const slots = [];
      for (let h = openHour; h < closeHour; h++) {
        const isBooked = bookings.some(b => h >= b.start_hour && h < b.end_hour);
        slots.push({ hour: h, available: !isBooked });
      }

      return {
        id: court.id,
        name: court.name,
        slots,
        price_per_hour: pricePerHour,
        blocked_for_user: groupBookingCourt && groupBookingCourt !== court.id
      };
    });

    res.json({ courts: result, open_hour: openHour, close_hour: closeHour, price_per_hour: pricePerHour });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Create booking
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { court_id, booking_date, start_hour, end_hour } = req.body;
    if (!court_id || !booking_date || start_hour === undefined || end_hour === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (start_hour >= end_hour) return res.status(400).json({ error: 'Invalid time range' });

    const db = await getDb();
    const openHour = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'open_hour'").get()?.value || '5');
    const closeHour = parseInt(db.prepare("SELECT value FROM settings WHERE key = 'close_hour'").get()?.value || '22');
    if (start_hour < openHour || end_hour > closeHour) {
      return res.status(400).json({ error: 'Outside operating hours (5AM-10PM)' });
    }

    // Check member group restriction
    const userGroup = db.prepare(
      'SELECT mg.id as group_id FROM member_group_users mgu JOIN member_groups mg ON mgu.group_id = mg.id WHERE mgu.user_id = ?'
    ).get(req.user.id);

    if (userGroup) {
      const groupMembers = db.prepare(
        'SELECT user_id FROM member_group_users WHERE group_id = ?'
      ).all(userGroup.group_id).map(m => m.user_id);
      
      if (groupMembers.length > 0) {
        const placeholders = groupMembers.map(() => '?').join(',');
        const existingBooking = db.prepare(
          `SELECT court_id FROM bookings WHERE user_id IN (${placeholders}) AND booking_date = ? AND status = 'confirmed' LIMIT 1`
        ).get(...groupMembers, booking_date);
        if (existingBooking && existingBooking.court_id !== court_id) {
          return res.status(400).json({ error: 'Your group already has a booking on another court for this date' });
        }
      }
    }

    // Check availability
    const conflicting = db.prepare(
      "SELECT id FROM bookings WHERE court_id = ? AND booking_date = ? AND status = 'confirmed' AND start_hour < ? AND end_hour > ?"
    ).get(court_id, booking_date, end_hour, start_hour);
    if (conflicting) return res.status(409).json({ error: 'Slot already booked' });

    const hours = end_hour - start_hour;
    const pricePerHour = await getPriceForDate(booking_date);
    const totalAmount = hours * pricePerHour;

    // Check if user is a member (free booking)
    let method = 'razorpay';
    let status = 'confirmed';
    if (req.user.role === 'member') {
      const memberTo = new Date(req.user.member_to);
      if (memberTo >= new Date() && new Date(booking_date) <= memberTo) {
        method = 'free';
      }
    }

    const bookingId = uuidv4();
    const paymentId = uuidv4();

    db.prepare(
      'INSERT INTO bookings (id, user_id, court_id, booking_date, start_hour, end_hour, total_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(bookingId, req.user.id, court_id, booking_date, start_hour, end_hour, totalAmount, status);

    db.prepare(
      'INSERT INTO payments (id, booking_id, user_id, amount, method, status) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(paymentId, bookingId, req.user.id, totalAmount, method, 'completed');

    await logAction(req.user.id, 'booking_created', 'booking', bookingId, {
      court_id, booking_date, start_hour, end_hour, total_amount: totalAmount, method
    }, req.ip);

    // Mock push notification to group members
    if (userGroup) {
      const groupMembers = db.prepare(
        'SELECT u.fcm_token, u.name FROM member_group_users mgu JOIN users u ON mgu.user_id = u.id WHERE mgu.group_id = ? AND mgu.user_id != ?'
      ).all(userGroup.group_id, req.user.id);
      groupMembers.forEach(m => {
        if (m.fcm_token) {
          console.log(`[MOCK PUSH] To ${m.name}: Group booking confirmed for ${booking_date}`);
        }
      });
    }

    res.json({
      booking: {
        id: bookingId, court_id, booking_date, start_hour, end_hour,
        total_amount: totalAmount, status, payment_method: method
      },
      payment: { id: paymentId, amount: totalAmount, method, status: 'completed' }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Cancel booking
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, refund_method } = req.body;

    const db = await getDb();
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (booking.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    // Calculate cancellation fee based on time until booking
    const bookingStart = new Date(`${booking.booking_date}T${String(booking.start_hour).padStart(2, '0')}:00:00`);
    const now = new Date();
    const hoursUntilBooking = (bookingStart - now) / (1000 * 60 * 60);

    let refundPercent = 0;
    if (hoursUntilBooking > 24) refundPercent = 100;
    else if (hoursUntilBooking >= 12) refundPercent = 20;
    else if (hoursUntilBooking >= 6) refundPercent = 50;
    else refundPercent = 0;

    const refundAmount = booking.total_amount * (refundPercent / 100);
    const cancellationFee = booking.total_amount - refundAmount;

    const method = refund_method || 'razorpay';

    db.prepare(
      "UPDATE bookings SET status = 'cancelled', cancelled_at = datetime('now'), cancellation_reason = ?, cancellation_fee = ?, refund_amount = ?, refund_method = ? WHERE id = ?"
    ).run(reason || '', cancellationFee, refundAmount, method, id);

    // Process refund
    if (refundAmount > 0) {
      const refundId = uuidv4();
      db.prepare(
        'INSERT INTO refunds (id, payment_id, booking_id, user_id, amount, method, status, reason, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(refundId, booking.id, id, booking.user_id, refundAmount, method, 'completed', `Cancellation: ${reason || 'No reason'}`, req.user.id);

      if (method === 'wallet') {
        db.prepare('UPDATE users SET wallet_balance = wallet_balance + ?, updated_at = datetime("now") WHERE id = ?')
          .run(refundAmount, booking.user_id);
      }

      db.prepare(
        "UPDATE payments SET status = CASE WHEN ? < ? THEN 'partial_refund' ELSE 'refunded' END, refund_amount = ? WHERE booking_id = ?"
      ).run(refundAmount, booking.total_amount, refundAmount, id);

      await logAction(req.user.id, 'refund_processed', 'refund', refundId, {
        booking_id: id, amount: refundAmount, method, cancellation_fee: cancellationFee
      }, req.ip);
    }

    await logAction(req.user.id, 'booking_cancelled', 'booking', id, {
      reason, hours_until_booking: hoursUntilBooking, refund_amount: refundAmount,
      cancellation_fee: cancellationFee, refund_method: method
    }, req.ip);

    // Mock push notification
    console.log(`[MOCK PUSH] To user: Booking cancelled. Refund: ₹${refundAmount}`);

    res.json({
      success: true,
      cancellation: {
        hours_until_booking: Math.round(hoursUntilBooking * 10) / 10,
        refund_percent: refundPercent,
        refund_amount: refundAmount,
        cancellation_fee: cancellationFee,
        refund_method: method
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Get user bookings
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const db = await getDb();
    const bookings = db.prepare(
      `SELECT b.*, c.name as court_name FROM bookings b JOIN courts c ON b.court_id = c.id WHERE b.user_id = ? ORDER BY b.booking_date DESC, b.start_hour ASC`
    ).all(req.user.id);
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
