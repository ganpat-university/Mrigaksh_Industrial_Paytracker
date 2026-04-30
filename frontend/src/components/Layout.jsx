import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Layout({ title, navItems, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavClick = (item) => {
    item.onClick();
    setSidebarOpen(false);
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  // Role-based avatar colour
  const roleColors = {
    admin:      '#6366f1',
    accountant: '#06b6d4',
    user:       '#818cf8',
    vendor:     '#f59e0b',
  };
  const avatarColor = roleColors[user?.role] || '#6366f1';

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="sidebar-logo-icon">💳</div>
            <span className="sidebar-logo-text">PayTrack</span>
          </div>
          {/* Hamburger — shown on mobile via CSS */}
          <button
            className="sidebar-hamburger"
            style={{ display: 'none' }}
            onClick={() => setSidebarOpen(v => !v)}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
        </div>

        <div className={`sidebar-section${sidebarOpen ? ' open' : ''}`}>
          <div className="sidebar-section-label">Navigation</div>
          {navItems.map(item => (
            <div
              key={item.label}
              className={`nav-item ${item.active ? 'active' : ''}`}
              onClick={() => handleNavClick(item)}
            >
              <span className="nav-item-icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>

        {/* Sidebar footer — user info card, no logout click */}
        <div className={`sidebar-footer${sidebarOpen ? ' open' : ''}`}>
          <div className="sidebar-user-card">
            <div className="sidebar-user-avatar" style={{ background: avatarColor }}>
              {initials}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name?.split(' ')[0]}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="main-area">
        <div className="topbar">
          <h1 className="topbar-title">{title}</h1>
          <div className="topbar-actions">
            {/* Logout icon button — top right */}
            <button
              className="topbar-logout-btn"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span className="topbar-logout-label">Logout</span>
            </button>
          </div>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}