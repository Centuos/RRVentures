import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { api } from '../services/api';
import BottomNav from '../components/BottomNav';
import { format } from 'date-fns';

export default function Bookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('razorpay');
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState('upcoming');

  useEffect(() => { loadBookings(); }, []);

  const loadBookings = async () => {
    try {
      const data = await api.getMyBookings();
      setBookings(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const result = await api.cancelBooking(showCancel.id, { reason: cancelReason, refund_method: refundMethod });
      setToast(`Cancelled! Refund: ₹${result.cancellation.refund_amount}`);
      setTimeout(() => setToast(''), 4000);
      setShowCancel(null);
      setCancelReason('');
      loadBookings();
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(''), 3000);
    }
    setCancelling(false);
  };

  const formatHour = (h) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour} ${ampm}`;
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const upcoming = bookings.filter(b => b.booking_date >= today && b.status === 'confirmed');
  const past = bookings.filter(b => b.booking_date < today || b.status === 'cancelled' || b.status === 'completed');
  const display = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="page">
      {toast && <div className={`toast ${toast.includes('!') ? 'toast-success' : 'toast-error'}`}>{toast}</div>}

      <div className="page-header">
        <div className="page-title">My Bookings</div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Upcoming ({upcoming.length})
        </button>
        <button className={`tab ${tab === 'past' ? 'active' : ''}`} onClick={() => setTab('past')}>
          Past ({past.length})
        </button>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : display.length === 0 ? (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <p>No {tab} bookings</p>
        </div>
      ) : (
        display.map(booking => (
          <div key={booking.id} className="card">
            <div className="flex-between mb-8">
              <div className="flex gap-8" style={{ alignItems: 'center' }}>
                <span style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: booking.status === 'confirmed' ? 'var(--success)' : 'var(--danger)',
                }} />
                <span className="font-bold">{booking.court_name}</span>
              </div>
              <span className={`badge badge-${booking.status === 'confirmed' ? 'success' : 'danger'}`}>
                {booking.status}
              </span>
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8 }}>
              {format(new Date(booking.booking_date), 'EEE, MMM d yyyy')}
            </div>
            <div className="flex-between">
              <span style={{ fontSize: 15, fontWeight: 600 }}>
                {formatHour(booking.start_hour)} - {formatHour(booking.end_hour)}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary-light)' }}>
                ₹{booking.total_amount}
              </span>
            </div>
            {booking.status === 'cancelled' && booking.cancellation_fee > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Cancellation fee: ₹{booking.cancellation_fee} | Refund: ₹{booking.refund_amount}
                {booking.refund_method && ` via ${booking.refund_method}`}
              </div>
            )}
            {booking.status === 'confirmed' && booking.booking_date >= today && (
              <button className="btn btn-danger btn-sm mt-8" onClick={() => setShowCancel(booking)}>
                Cancel Booking
              </button>
            )}
          </div>
        ))
      )}

      {/* Cancel Modal */}
      {showCancel && (
        <div className="modal-overlay" onClick={() => setShowCancel(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Cancel Booking</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
              {showCancel.court_name} on {format(new Date(showCancel.booking_date), 'MMM d')} at {formatHour(showCancel.start_hour)}
            </p>
            <div className="input-group">
              <label>Reason for cancellation</label>
              <textarea rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="Optional" style={{
                  width: '100%', padding: 14, background: 'var(--bg-input)',
                  border: '1px solid var(--border)', borderRadius: 10,
                  color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14, resize: 'none',
                }} />
            </div>
            <div className="input-group">
              <label>Refund Method</label>
              <select value={refundMethod} onChange={e => setRefundMethod(e.target.value)}>
                <option value="razorpay">Original Payment (Razorpay)</option>
                <option value="wallet">Wallet Credit</option>
              </select>
            </div>
            <div style={{ background: 'rgba(253,203,110,0.1)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, color: 'var(--warning)' }}>
              Refund depends on cancellation time:<br />
              {'>'}24h before: 100% | 12-24h: 20% | 6-12h: 50% | {'<'}6h: No refund
            </div>
            <button className="btn btn-danger btn-block" disabled={cancelling} onClick={handleCancel}>
              {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
            <button className="btn btn-secondary btn-block mt-8" onClick={() => setShowCancel(null)}>Keep Booking</button>
          </div>
        </div>
      )}

      <BottomNav active="bookings" />
    </div>
  );
}
