import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../App';

export default function BottomNav({ active }) {
  const { user } = useAuth();

  const items = [
    { id: 'home', label: 'Home', path: '/', icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /> },
    { id: 'bookings', label: 'Bookings', path: '/bookings', icon: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></> },
    { id: 'profile', label: 'Profile', path: '/profile', icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></> },
  ];

  if (user?.role === 'admin') {
    items.push({ id: 'admin', label: 'Admin', path: '/admin', icon: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></> });
  }

  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <NavLink key={item.id} to={item.path} className={`nav-item ${active === item.id ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {item.icon}
          </svg>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
