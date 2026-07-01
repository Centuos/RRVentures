import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { api } from '../services/api';
import BottomNav from '../components/BottomNav';
import { format, addDays, isToday } from 'date-fns';

export default function Home() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [availability, setAvailability] = useState(null);
  const [selectedCourt, setSelectedCourt] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState('');

  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  useEffect(() => { loadAvailability(); }, [selectedDate]);

  const loadAvailability = async () => {
    setLoading(true);
    try {
      const data = await api.getAvailability(selectedDate);
      setAvailability(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const toggleSlot = (courtId, hour) => {
    if (selectedCourt && selectedCourt !== courtId) {
      setToast('Select one court at a time');
      setTimeout(() => setToast(''), 2000);
      return;
    }
    setSelectedCourt(courtId);
    const key = `${courtId}-${hour}`;
    setSelectedSlots(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };

  const getSelectedHours = () => {
    if (!selectedCourt) return [];
    return selectedSlots
      .filter(s => s.startsWith(selectedCourt))
      .map(s => parseInt(s.split('-')[1]))
      .sort((a, b) => a - b);
  };

  const handleBook = async () => {
    const hours = getSelectedHours();
    if (hours.length === 0) return;

    // Find consecutive ranges
    const ranges = [];
    let start = hours[0], end = hours[0] + 1;
    for (let i = 1; i < hours.length; i++) {
      if (hours[i] === end) { end = hours[i] + 1; }
      else { ranges.push([start, end]); start = hours[i]; end = hours[i] + 1; }
    }
    ranges.push([start, end]);

    setBooking(true);
    try {
      for (const [s, e] of ranges) {
        await api.createBooking({ court_id: selectedCourt, booking_date: selectedDate, start_hour: s, end_hour: e });
      }
      setShowConfirm(false);
      setSelectedSlots([]);
      setSelectedCourt(null);
      setToast('Booking confirmed!');
      setTimeout(() => setToast(''), 3000);
      loadAvailability();
    } catch (err) {
      setToast(err.message);
      setTimeout(() => setToast(''), 3000);
    }
    setBooking(false);
  };

  const formatHour = (h) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour} ${ampm}`;
  };

  const hours = getSelectedHours();
  const totalAmount = hours.length * (availability?.price_per_hour || 300);
  const courtName = availability?.courts?.find(c => c.id === selectedCourt)?.name;

  return (
    <div className="page">
      {toast && <div className={`toast ${toast.includes('!') ? 'toast-success' : 'toast-error'}`}>{toast}</div>}

      <div className="page-header">
        <div>
          <div className="page-title">Book Court</div>
          <div className="page-subtitle">Welcome, {user?.name}</div>
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 700
        }}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
      </div>

      {/* Date Selector */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
        {dates.map(d => {
          const dateStr = format(d, 'yyyy-MM-dd');
          const isSelected = dateStr === selectedDate;
          return (
            <button key={dateStr} onClick={() => { setSelectedDate(dateStr); setSelectedSlots([]); setSelectedCourt(null); }}
              style={{
                minWidth: 56, padding: '10px 8px', borderRadius: 12,
                background: isSelected ? 'var(--primary)' : 'var(--bg-card)',
                border: isSelected ? 'none' : '1px solid var(--border)',
                color: isSelected ? 'white' : 'var(--text-primary)',
                cursor: 'pointer', textAlign: 'center', flexShrink: 0,
              }}>
              <div style={{ fontSize: 10, fontWeight: 500, opacity: 0.7 }}>{format(d, 'EEE')}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{format(d, 'd')}</div>
            </button>
          );
        })}
      </div>

      {/* Price Banner */}
      {availability && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(108,92,231,0.15), rgba(0,206,201,0.1))',
          borderRadius: 12, padding: '12px 16px', marginBottom: 16,
          border: '1px solid rgba(108,92,231,0.2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Rate for {format(new Date(selectedDate), 'MMM d')}</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary-light)' }}>
            ₹{availability.price_per_hour}/hr
          </span>
        </div>
      )}

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : (
        availability?.courts?.map(court => (
          <div key={court.id} className={`court-card ${selectedCourt === court.id ? 'selected' : ''} ${court.blocked_for_user ? '' : ''}`}>
            <div className="court-name">
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: court.blocked_for_user ? 'var(--danger)' : 'var(--success)',
              }} />
              {court.name}
              {court.blocked_for_user && <span className="badge badge-danger" style={{ marginLeft: 'auto' }}>Group booked</span>}
            </div>
            {court.blocked_for_user ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Your group has already booked another court today</p>
            ) : (
              <div className="slots-grid">
                {court.slots.map(slot => {
                  const key = `${court.id}-${slot.hour}`;
                  const isSelected = selectedSlots.includes(key);
                  return (
                    <button key={slot.hour}
                      className={`slot ${!slot.available ? 'booked' : isSelected ? 'selected' : 'available'}`}
                      disabled={!slot.available}
                      onClick={() => toggleSlot(court.id, slot.hour)}>
                      {formatHour(slot.hour)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))
      )}

      {/* Booking Summary Bar */}
      {selectedCourt && hours.length > 0 && (
        <div style={{
          position: 'fixed', bottom: 70, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, padding: '0 16px', zIndex: 50,
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 16, padding: '16px 20px',
            border: '1px solid var(--primary)', boxShadow: '0 8px 30px rgba(108,92,231,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {courtName} | {hours.length} hr{hours.length > 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary-light)' }}>₹{totalAmount}</div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowConfirm(true)}>
              Book Now
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Confirm Booking</div>
            <div className="card" style={{ background: 'var(--bg-input)' }}>
              <div className="flex-between mb-8">
                <span className="text-muted text-sm">Court</span>
                <span className="font-bold">{courtName}</span>
              </div>
              <div className="flex-between mb-8">
                <span className="text-muted text-sm">Date</span>
                <span className="font-bold">{format(new Date(selectedDate), 'EEE, MMM d yyyy')}</span>
              </div>
              <div className="flex-between mb-8">
                <span className="text-muted text-sm">Time</span>
                <span className="font-bold">{formatHour(hours[0])} - {formatHour(hours[hours.length - 1] + 1)}</span>
              </div>
              <div className="flex-between mb-8">
                <span className="text-muted text-sm">Duration</span>
                <span className="font-bold">{hours.length} hour{hours.length > 1 ? 's' : ''}</span>
              </div>
              {user?.role === 'member' && (
                <div className="flex-between mb-8">
                  <span className="badge badge-info">Member - Free Booking</span>
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8 }} className="flex-between">
                <span className="font-bold">Total</span>
                <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-light)' }}>
                  {user?.role === 'member' ? 'FREE' : `₹${totalAmount}`}
                </span>
              </div>
            </div>
            <div style={{ background: 'rgba(253,203,110,0.1)', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, color: 'var(--warning)' }}>
              <strong>Cancellation Policy:</strong> {'>'}24h: 100% refund | 12-24h: 20% | 6-12h: 50% | {'<'}6h: No refund
            </div>
            <button className="btn btn-primary btn-block" disabled={booking} onClick={handleBook}>
              {booking ? 'Processing...' : user?.role === 'member' ? 'Confirm Free Booking' : `Pay ₹${totalAmount}`}
            </button>
            <button className="btn btn-secondary btn-block mt-8" onClick={() => setShowConfirm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <BottomNav active="home" />
    </div>
  );
}
