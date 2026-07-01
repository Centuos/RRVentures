const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('rr_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  googleLogin: (data) => request('/auth/google', { method: 'POST', body: JSON.stringify(data) }),
  sendOtp: (phone) => request('/auth/otp/send', { method: 'POST', body: JSON.stringify({ phone }) }),
  verifyOtp: (phone, otp, name) => request('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ phone, otp, name }) }),
  getMe: () => request('/auth/me'),
  updateFcmToken: (token) => request('/auth/fcm-token', { method: 'POST', body: JSON.stringify({ token }) }),

  // Bookings
  getAvailability: (date) => request(`/bookings/availability/${date}`),
  createBooking: (data) => request('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  cancelBooking: (id, data) => request(`/bookings/${id}/cancel`, { method: 'POST', body: JSON.stringify(data || {}) }),
  getMyBookings: () => request('/bookings/my'),

  // Admin
  getStats: () => request('/admin/stats'),
  getUsers: () => request('/admin/users'),
  updateUserRole: (id, data) => request(`/admin/users/${id}/role`, { method: 'PUT', body: JSON.stringify(data) }),
  getAdminBookings: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/admin/bookings${qs ? '?' + qs : ''}`);
  },
  getPayments: () => request('/admin/payments'),
  getRefunds: () => request('/admin/refunds'),
  getLogs: (limit, offset) => request(`/admin/logs?limit=${limit || 100}&offset=${offset || 0}`),
  updateDefaultPrice: (price) => request('/admin/pricing/default', { method: 'PUT', body: JSON.stringify({ price_per_hour: price }) }),
  getCustomPricing: () => request('/admin/pricing/custom'),
  createCustomPricing: (data) => request('/admin/pricing/custom', { method: 'POST', body: JSON.stringify(data) }),
  deleteCustomPricing: (id) => request(`/admin/pricing/custom/${id}`, { method: 'DELETE' }),
  updateHours: (data) => request('/admin/settings/hours', { method: 'PUT', body: JSON.stringify(data) }),
  getBankDetails: () => request('/admin/bank-details'),
  updateBankDetails: (data) => request('/admin/bank-details', { method: 'PUT', body: JSON.stringify(data) }),
  getAdminEmails: () => request('/admin/admin-emails'),
  addAdminEmail: (email) => request('/admin/admin-emails', { method: 'POST', body: JSON.stringify({ email }) }),
  removeAdminEmail: (email) => request(`/admin/admin-emails/${email}`, { method: 'DELETE' }),
  getGroups: () => request('/admin/groups'),
  createGroup: (data) => request('/admin/groups', { method: 'POST', body: JSON.stringify(data) }),
  updateGroup: (id, data) => request(`/admin/groups/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGroup: (id) => request(`/admin/groups/${id}`, { method: 'DELETE' }),
};

export function setToken(token) {
  localStorage.setItem('rr_token', token);
}

export function clearToken() {
  localStorage.removeItem('rr_token');
}

export function isLoggedIn() {
  return !!getToken();
}
