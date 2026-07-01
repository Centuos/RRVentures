import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import { api } from '../services/api';

function AnimatedBackground() {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 0 }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: `${80 + i * 40}px`, height: `${80 + i * 40}px`,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${i % 2 === 0 ? 'rgba(108,92,231,0.15)' : 'rgba(0,206,201,0.1)'}, transparent)`,
          top: `${10 + i * 15}%`, left: `${-10 + i * 20}%`,
          animation: `float${i} ${6 + i * 2}s ease-in-out infinite`,
        }} />
      ))}
      <style>{`
        @keyframes float0 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-30px) scale(1.1)} }
        @keyframes float1 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(20px) scale(0.9)} }
        @keyframes float2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,-20px)} }
        @keyframes float3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-15px,15px)} }
        @keyframes float4 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-25px)} }
        @keyframes float5 { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }
      `}</style>
    </div>
  );
}

function ShuttlecockAnimation() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 32, position: 'relative', zIndex: 1 }}>
      <div style={{
        width: 100, height: 100, margin: '0 auto 16px',
        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
        borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 10px 40px rgba(108,92,231,0.4)',
        animation: 'logoEntry 0.8s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2C12 2 14 8 12 12C10 8 12 2 12 2Z" />
          <path d="M2 12C2 12 8 10 12 12C8 14 2 12 2 12Z" />
          <path d="M22 12C22 12 16 14 12 12C16 10 22 12 22 12Z" />
          <path d="M12 22C12 22 10 16 12 12C14 16 12 22 12 22Z" />
        </svg>
      </div>
      <h1 style={{
        fontSize: 28, fontWeight: 900, letterSpacing: -0.5,
        background: 'linear-gradient(135deg, #fff, var(--primary-light))',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        animation: 'textEntry 0.6s ease 0.3s both',
      }}>RR Ventures</h1>
      <p style={{
        color: 'var(--text-secondary)', fontSize: 14, marginTop: 6,
        animation: 'textEntry 0.6s ease 0.5s both',
      }}>Badminton Court Booking</p>
      <style>{`
        @keyframes logoEntry { from{transform:scale(0) rotate(-180deg);opacity:0} to{transform:scale(1) rotate(0);opacity:1} }
        @keyframes textEntry { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // login, register, otp
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api.login(email, password);
      login(data.token, data.user);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await api.register({ email, name, phone, password });
      login(data.token, data.user);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const handleSendOtp = async () => {
    if (!phone) { setError('Enter phone number'); return; }
    setLoading(true); setError('');
    try {
      await api.sendOtp(phone);
      setMode('otp');
      showToast('OTP sent! (Mock: 123456)');
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    setLoading(true); setError('');
    try {
      const data = await api.verifyOtp(phone, otp, name);
      login(data.token, data.user);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true); setError('');
    try {
      // Mock Google OAuth - in production, use real Google Sign-In
      const mockEmail = prompt('Enter your Gmail address (mock Google OAuth):');
      if (!mockEmail) { setLoading(false); return; }
      const mockName = prompt('Enter your name:') || mockEmail.split('@')[0];
      const data = await api.googleLogin({ email: mockEmail, name: mockName });
      login(data.token, data.user);
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  const formStyle = { animation: 'formSlide 0.4s ease', position: 'relative', zIndex: 1 };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 24px', position: 'relative' }}>
      <AnimatedBackground />

      {toast && <div className={`toast toast-success`}>{toast}</div>}

      <ShuttlecockAnimation />

      <div style={formStyle}>
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Email</label>
              <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input type="password" placeholder="Enter password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button className="btn btn-primary btn-block" disabled={loading} type="submit">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="input-group">
              <label>Full Name</label>
              <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Email</label>
              <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Phone (optional)</label>
              <input type="tel" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button className="btn btn-primary btn-block" disabled={loading} type="submit">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        {mode === 'otp' && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>
              Enter OTP sent to {phone}
            </p>
            <div className="input-group">
              <label>OTP Code</label>
              <input type="text" placeholder="123456" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button className="btn btn-primary btn-block" disabled={loading} onClick={handleVerifyOtp}>
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          {mode === 'login' && (
            <>
              <button className="btn btn-secondary btn-block mb-8" onClick={handleGoogle} style={{ marginBottom: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>
              <button className="btn btn-secondary btn-block" onClick={() => { setMode('otp'); setError(''); }} style={{ marginBottom: 16 }}>
                Sign in with Phone OTP
              </button>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Don't have an account?{' '}
                <span style={{ color: 'var(--primary-light)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setMode('register'); setError(''); }}>
                  Register
                </span>
              </p>
            </>
          )}
          {(mode === 'register' || mode === 'otp') && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              Already have an account?{' '}
              <span style={{ color: 'var(--primary-light)', cursor: 'pointer', fontWeight: 600 }} onClick={() => { setMode('login'); setError(''); }}>
                Sign In
              </span>
            </p>
          )}
        </div>
      </div>

      <style>{`@keyframes formSlide { from{transform:translateY(30px);opacity:0} to{transform:translateY(0);opacity:1} }`}</style>
    </div>
  );
}
