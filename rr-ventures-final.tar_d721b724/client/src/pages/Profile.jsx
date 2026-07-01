import React from 'react';
import { useAuth } from '../App';
import BottomNav from '../components/BottomNav';

export default function Profile() {
  const { user, logout } = useAuth();

  const roleColors = {
    admin: 'var(--danger)',
    member: 'var(--secondary)',
    user: 'var(--primary-light)',
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">Profile</div>
      </div>

      {/* Profile Card */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
        borderRadius: 20, padding: 24, marginBottom: 20, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: -20, right: -20, width: 120, height: 120,
          borderRadius: '50%', background: 'rgba(255,255,255,0.1)',
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: 'rgba(255,255,255,0.2)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800,
          }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{user?.name}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{user?.email || user?.phone}</div>
            <span style={{
              display: 'inline-block', marginTop: 6, padding: '3px 10px',
              borderRadius: 12, fontSize: 11, fontWeight: 700,
              background: 'rgba(255,255,255,0.2)', textTransform: 'uppercase',
            }}>
              {user?.role}
            </span>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="card">
        <div className="card-title mb-16">Account Details</div>
        {user?.email && (
          <div className="flex-between mb-8">
            <span className="text-muted text-sm">Email</span>
            <span className="text-sm">{user.email}</span>
          </div>
        )}
        {user?.phone && (
          <div className="flex-between mb-8">
            <span className="text-muted text-sm">Phone</span>
            <span className="text-sm">{user.phone}</span>
          </div>
        )}
        <div className="flex-between mb-8">
          <span className="text-muted text-sm">Role</span>
          <span className="badge badge-primary">{user?.role}</span>
        </div>
        {user?.role === 'member' && (
          <>
            <div className="flex-between mb-8">
              <span className="text-muted text-sm">Member From</span>
              <span className="text-sm">{user?.member_from}</span>
            </div>
            <div className="flex-between">
              <span className="text-muted text-sm">Member Until</span>
              <span className="text-sm">{user?.member_to}</span>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title mb-16">Wallet</div>
        <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--secondary)' }}>
          ₹{user?.wallet_balance?.toFixed(2) || '0.00'}
        </div>
        <p className="text-muted text-sm mt-8">Wallet balance from refunds</p>
      </div>

      <button className="btn btn-danger btn-block mt-20" onClick={logout}>
        Sign Out
      </button>

      <BottomNav active="profile" />
    </div>
  );
}
