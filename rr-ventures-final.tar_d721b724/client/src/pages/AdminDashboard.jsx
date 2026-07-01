import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { api } from '../services/api';
import BottomNav from '../components/BottomNav';
import { format } from 'date-fns';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [logs, setLogs] = useState([]);
  const [customPricing, setCustomPricing] = useState([]);
  const [groups, setGroups] = useState([]);
  const [bankDetails, setBankDetails] = useState(null);
  const [adminEmails, setAdminEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => { loadTab(tab); }, [tab]);

  const loadTab = async (t) => {
    setLoading(true);
    try {
      switch (t) {
        case 'overview': setStats(await api.getStats()); break;
        case 'users': setUsers(await api.getUsers()); break;
        case 'bookings': setBookings(await api.getAdminBookings({})); break;
        case 'payments': setPayments(await api.getPayments()); setRefunds(await api.getRefunds()); break;
        case 'pricing': setCustomPricing(await api.getCustomPricing()); break;
        case 'groups': setGroups(await api.getGroups()); break;
        case 'settings':
          setBankDetails(await api.getBankDetails());
          setAdminEmails(await api.getAdminEmails());
          break;
        case 'logs': { const d = await api.getLogs(200, 0); setLogs(d.logs); break; }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'bookings', label: 'Bookings' },
    { id: 'payments', label: 'Payments' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'groups', label: 'Groups' },
    { id: 'settings', label: 'Settings' },
    { id: 'logs', label: 'Logs' },
  ];

  return (
    <div className="page">
      {toast && <div className={`toast toast-success`}>{toast}</div>}

      <div className="page-header">
        <div>
          <div className="page-title">Admin Panel</div>
          <div className="page-subtitle">RR Ventures Management</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 8, marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: tab === t.id ? 'var(--primary)' : 'var(--bg-card)',
              color: tab === t.id ? 'white' : 'var(--text-muted)',
              border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
        <>
          {tab === 'overview' && <OverviewTab stats={stats} />}
          {tab === 'users' && <UsersTab users={users} reload={() => loadTab('users')} showToast={showToast} />}
          {tab === 'bookings' && <BookingsTab bookings={bookings} />}
          {tab === 'payments' && <PaymentsTab payments={payments} refunds={refunds} />}
          {tab === 'pricing' && <PricingTab customPricing={customPricing} reload={() => loadTab('pricing')} showToast={showToast} />}
          {tab === 'groups' && <GroupsTab groups={groups} users={users} reload={() => loadTab('groups')} showToast={showToast} />}
          {tab === 'settings' && <SettingsTab bankDetails={bankDetails} adminEmails={adminEmails} reload={() => loadTab('settings')} showToast={showToast} />}
          {tab === 'logs' && <LogsTab logs={logs} />}
        </>
      )}

      <BottomNav active="admin" />
    </div>
  );
}

function OverviewTab({ stats }) {
  if (!stats) return null;
  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value text-primary">{stats.total_users}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-success">₹{stats.today_revenue}</div>
          <div className="stat-label">Today's Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--secondary)' }}>{stats.today_bookings}</div>
          <div className="stat-label">Today's Bookings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-primary">{stats.total_bookings}</div>
          <div className="stat-label">Total Bookings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value text-success">₹{stats.total_revenue}</div>
          <div className="stat-label">Total Revenue</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--secondary)' }}>{stats.active_members}</div>
          <div className="stat-label">Active Members</div>
        </div>
      </div>
    </div>
  );
}

function UsersTab({ users, reload, showToast }) {
  const [editUser, setEditUser] = useState(null);
  const [role, setRole] = useState('');
  const [memberFrom, setMemberFrom] = useState('');
  const [memberTo, setMemberTo] = useState('');

  const handleRoleChange = async () => {
    try {
      await api.updateUserRole(editUser.id, { role, member_from: memberFrom, member_to: memberTo });
      showToast('Role updated');
      setEditUser(null);
      reload();
    } catch (e) { showToast(e.message); }
  };

  return (
    <div>
      {users.map(u => (
        <div key={u.id} className="card">
          <div className="flex-between">
            <div>
              <div className="font-bold">{u.name}</div>
              <div className="text-muted text-sm">{u.email || u.phone}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`badge badge-${u.role === 'admin' ? 'danger' : u.role === 'member' ? 'info' : 'primary'}`}>{u.role}</span>
              <div style={{ marginTop: 4 }}>
                <button className="btn btn-sm btn-secondary" onClick={() => { setEditUser(u); setRole(u.role); setMemberFrom(u.member_from || ''); setMemberTo(u.member_to || ''); }}>
                  Edit Role
                </button>
              </div>
            </div>
          </div>
          {u.wallet_balance > 0 && <div className="text-sm text-muted mt-8">Wallet: ₹{u.wallet_balance}</div>}
        </div>
      ))}

      {editUser && (
        <div className="modal-overlay" onClick={() => setEditUser(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Change Role: {editUser.name}</div>
            <div className="input-group">
              <label>Role</label>
              <select value={role} onChange={e => setRole(e.target.value)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="member">Member (Yearly)</option>
              </select>
            </div>
            {role === 'member' && (
              <>
                <div className="input-group">
                  <label>Member From</label>
                  <input type="date" value={memberFrom} onChange={e => setMemberFrom(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Member Until</label>
                  <input type="date" value={memberTo} onChange={e => setMemberTo(e.target.value)} />
                </div>
              </>
            )}
            <button className="btn btn-primary btn-block" onClick={handleRoleChange}>Update Role</button>
            <button className="btn btn-secondary btn-block mt-8" onClick={() => setEditUser(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookingsTab({ bookings }) {
  const formatHour = (h) => { const ampm = h >= 12 ? 'PM' : 'AM'; return `${h > 12 ? h - 12 : h} ${ampm}`; };
  return (
    <div>
      {bookings.length === 0 ? <div className="empty-state"><p>No bookings found</p></div> : (
        bookings.map(b => (
          <div key={b.id} className="card">
            <div className="flex-between mb-8">
              <div>
                <span className="font-bold">{b.user_name}</span>
                <span className="text-muted text-sm" style={{ marginLeft: 8 }}>{b.user_email}</span>
              </div>
              <span className={`badge badge-${b.status === 'confirmed' ? 'success' : 'danger'}`}>{b.status}</span>
            </div>
            <div className="text-sm text-muted mb-8">{b.court_name} | {b.booking_date} | {formatHour(b.start_hour)}-{formatHour(b.end_hour)}</div>
            <div className="flex-between">
              <span className="text-sm">₹{b.total_amount}</span>
              {b.status === 'cancelled' && <span className="text-sm text-danger">Fee: ₹{b.cancellation_fee} | Refund: ₹{b.refund_amount}</span>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PaymentsTab({ payments, refunds }) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Payments</h3>
      {payments.length === 0 ? <p className="text-muted">No payments</p> : (
        payments.map(p => (
          <div key={p.id} className="card">
            <div className="flex-between mb-8">
              <span className="font-bold">{p.user_name}</span>
              <span className={`badge badge-${p.status === 'completed' ? 'success' : p.status === 'refunded' ? 'danger' : 'warning'}`}>{p.status}</span>
            </div>
            <div className="text-sm text-muted">
              {p.method} | ₹{p.amount} {p.refund_amount > 0 && `| Refunded: ₹${p.refund_amount}`}
            </div>
            <div className="text-sm text-muted mt-8">{p.created_at}</div>
          </div>
        ))
      )}

      {refunds.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '20px 0 12px' }}>Refunds</h3>
          {refunds.map(r => (
            <div key={r.id} className="card">
              <div className="flex-between">
                <span className="font-bold">{r.user_name}</span>
                <span className="text-danger font-bold">₹{r.amount}</span>
              </div>
              <div className="text-sm text-muted">{r.method} | {r.reason} | {r.created_at}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function PricingTab({ customPricing, reload, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [price, setPrice] = useState('');
  const [reason, setReason] = useState('');
  const [defaultPrice, setDefaultPrice] = useState(300);

  useEffect(() => {
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${localStorage.getItem('rr_token')}` } })
      .then(() => {});
  }, []);

  const handleCreate = async () => {
    try {
      await api.createCustomPricing({ from_date: fromDate, to_date: toDate, price_per_hour: parseFloat(price), reason });
      showToast('Custom pricing created');
      setShowForm(false);
      setFromDate(''); setToDate(''); setPrice(''); setReason('');
      reload();
    } catch (e) { showToast(e.message); }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteCustomPricing(id);
      showToast('Pricing deleted');
      reload();
    } catch (e) { showToast(e.message); }
  };

  const handleDefaultPrice = async () => {
    try {
      await api.updateDefaultPrice(parseFloat(defaultPrice));
      showToast('Default price updated');
    } catch (e) { showToast(e.message); }
  };

  return (
    <div>
      <div className="card">
        <div className="card-title mb-16">Default Pricing</div>
        <div className="flex gap-8">
          <input type="number" value={defaultPrice} onChange={e => setDefaultPrice(e.target.value)}
            style={{ flex: 1, padding: 12, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'white', fontSize: 16 }} />
          <button className="btn btn-primary btn-sm" onClick={handleDefaultPrice}>Update</button>
        </div>
        <p className="text-muted text-sm mt-8">Per hour rate (applies when no custom pricing)</p>
      </div>

      <div className="flex-between mb-16">
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Custom Pricing (Weekends/Holidays)</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>+ Add</button>
      </div>

      {showForm && (
        <div className="card">
          <div className="input-group">
            <label>From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="input-group">
            <label>To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Price per Hour (₹)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g., 500" />
          </div>
          <div className="input-group">
            <label>Reason (e.g., Weekend, Diwali)</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional" />
          </div>
          <button className="btn btn-primary btn-block" onClick={handleCreate}>Create</button>
        </div>
      )}

      {customPricing.map(p => (
        <div key={p.id} className="card">
          <div className="flex-between">
            <div>
              <div className="font-bold">₹{p.price_per_hour}/hr</div>
              <div className="text-sm text-muted">{p.from_date} to {p.to_date}</div>
              {p.reason && <div className="text-sm" style={{ color: 'var(--warning)' }}>{p.reason}</div>}
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupsTab({ groups, users, reload, showToast }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [maxMembers, setMaxMembers] = useState(6);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const handleCreate = async () => {
    try {
      await api.createGroup({ name, max_members: parseInt(maxMembers), member_ids: selectedUsers });
      showToast('Group created');
      setShowForm(false);
      setName(''); setSelectedUsers([]);
      reload();
    } catch (e) { showToast(e.message); }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteGroup(id);
      showToast('Group deleted');
      reload();
    } catch (e) { showToast(e.message); }
  };

  const toggleUser = (uid) => {
    setSelectedUsers(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]);
  };

  return (
    <div>
      <div className="flex-between mb-16">
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>Member Groups</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>+ New Group</button>
      </div>

      {showForm && (
        <div className="card">
          <div className="input-group">
            <label>Group Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Morning Batch" />
          </div>
          <div className="input-group">
            <label>Max Members</label>
            <input type="number" value={maxMembers} onChange={e => setMaxMembers(e.target.value)} />
          </div>
          <div className="input-group">
            <label>Select Members</label>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {users.filter(u => u.role !== 'admin').map(u => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={() => toggleUser(u.id)} />
                  <span className="text-sm">{u.name} ({u.email || u.phone})</span>
                </label>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-block" onClick={handleCreate}>Create Group</button>
        </div>
      )}

      {groups.map(g => (
        <div key={g.id} className="card">
          <div className="flex-between mb-8">
            <div className="font-bold">{g.name}</div>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(g.id)}>Delete</button>
          </div>
          <div className="text-sm text-muted">
            {g.member_count}/{g.max_members} members
          </div>
          {g.member_names && <div className="text-sm mt-8">{g.member_names}</div>}
        </div>
      ))}
    </div>
  );
}

function SettingsTab({ bankDetails, adminEmails, reload, showToast }) {
  const [bank, setBank] = useState(bankDetails || {});
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const handleBankUpdate = async () => {
    try {
      await api.updateBankDetails(bank);
      showToast('Bank details updated');
      reload();
    } catch (e) { showToast(e.message); }
  };

  const handleAddAdmin = async () => {
    if (!newAdminEmail) return;
    try {
      await api.addAdminEmail(newAdminEmail);
      showToast('Admin email added');
      setNewAdminEmail('');
      reload();
    } catch (e) { showToast(e.message); }
  };

  const handleRemoveAdmin = async (email) => {
    try {
      await api.removeAdminEmail(email);
      showToast('Admin email removed');
      reload();
    } catch (e) { showToast(e.message); }
  };

  return (
    <div>
      <div className="card">
        <div className="card-title mb-16">Bank Account Details</div>
        <div className="input-group">
          <label>Account Name</label>
          <input type="text" value={bank.account_name || ''} onChange={e => setBank({ ...bank, account_name: e.target.value })} />
        </div>
        <div className="input-group">
          <label>Account Number</label>
          <input type="text" value={bank.account_number || ''} onChange={e => setBank({ ...bank, account_number: e.target.value })} />
        </div>
        <div className="input-group">
          <label>IFSC Code</label>
          <input type="text" value={bank.ifsc_code || ''} onChange={e => setBank({ ...bank, ifsc_code: e.target.value })} />
        </div>
        <div className="input-group">
          <label>Bank Name</label>
          <input type="text" value={bank.bank_name || ''} onChange={e => setBank({ ...bank, bank_name: e.target.value })} />
        </div>
        <div className="input-group">
          <label>UPI ID</label>
          <input type="text" value={bank.upi_id || ''} onChange={e => setBank({ ...bank, upi_id: e.target.value })} />
        </div>
        <button className="btn btn-primary btn-block" onClick={handleBankUpdate}>Save Bank Details</button>
      </div>

      <div className="card">
        <div className="card-title mb-16">Admin Emails</div>
        <p className="text-muted text-sm mb-16">Users registering with these emails will automatically get admin role</p>
        {adminEmails.map(ae => (
          <div key={ae.email} className="flex-between mb-8">
            <span className="text-sm">{ae.email}</span>
            <button className="btn btn-danger btn-sm" onClick={() => handleRemoveAdmin(ae.email)}>Remove</button>
          </div>
        ))}
        <div className="flex gap-8 mt-8">
          <input type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)}
            placeholder="admin@email.com"
            style={{ flex: 1, padding: 12, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'white' }} />
          <button className="btn btn-primary btn-sm" onClick={handleAddAdmin}>Add</button>
        </div>
      </div>
    </div>
  );
}

function LogsTab({ logs }) {
  const actionColors = {
    booking_created: 'success', booking_cancelled: 'danger', refund_processed: 'warning',
    role_changed: 'info', pricing_updated: 'info', bank_details_updated: 'warning',
    register: 'primary', login: 'primary', admin_email_added: 'info', admin_email_removed: 'danger',
    custom_pricing_created: 'info', custom_pricing_deleted: 'danger',
    group_created: 'success', group_updated: 'info', group_deleted: 'danger',
    hours_updated: 'info',
  };

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Audit Logs</h3>
      {logs.length === 0 ? <p className="text-muted">No logs</p> : (
        logs.map(log => {
          let details = {};
          try { details = JSON.parse(log.details || '{}'); } catch (e) {}
          return (
            <div key={log.id} className="card" style={{ padding: 14 }}>
              <div className="flex-between mb-8">
                <span className={`badge badge-${actionColors[log.action] || 'primary'}`}>{log.action.replace(/_/g, ' ')}</span>
                <span className="text-sm text-muted">{log.created_at}</span>
              </div>
              <div className="text-sm">
                {log.user_name && <span style={{ color: 'var(--primary-light)' }}>{log.user_name}</span>}
                {log.user_email && <span className="text-muted"> ({log.user_email})</span>}
              </div>
              {Object.keys(details).length > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  {Object.entries(details).map(([k, v]) => (
                    <span key={k} style={{ marginRight: 12 }}>{k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                  ))}
                </div>
              )}
              {log.ip_address && <div className="text-sm text-muted mt-8">IP: {log.ip_address}</div>}
            </div>
          );
        })
      )}
    </div>
  );
}
