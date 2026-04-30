import { useState, useEffect } from 'react';
import { getVendorNotifications } from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const fmt = (n) => `₹${parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function VendorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getVendorNotifications()
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load notifications'))
      .finally(() => setLoading(false));
  }, []);

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  const totalPaid = (data?.data || []).reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0);
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="vendor-topbar">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, background: 'var(--accent)', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 0 16px var(--accent-glow)'
          }}>💳</div>
          <span style={{
            fontSize: 18, fontWeight: 800,
            background: 'linear-gradient(135deg, #f0f4ff, var(--accent-hover))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>PayTrack</span>
        </div>

        {/* Right side — user pill + logout */}
        <div className="vendor-topbar-right">
          {/* User info pill */}
          <div className="vendor-user-pill">
            <div className="vendor-user-avatar">{initials}</div>
            <div className="vendor-user-info">
              <div className="vendor-user-name">{user?.name?.split(' ')[0]}</div>
              <div className="vendor-user-role">vendor</div>
            </div>
          </div>

          {/* Logout button */}
          <button className="topbar-logout-btn" onClick={handleLogout} title="Logout" aria-label="Logout">
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

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="vendor-content-wrap" style={{ maxWidth: 900, margin: '0 auto' }}>

        <div className="vendor-welcome">
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>
            👋 Hello, {user?.name?.split(' ')[0]}
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Here are your payment notifications from PayTrack.
          </p>
        </div>

        {/* Stats */}
        <div className="stat-grid" style={{ marginBottom: 32 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--success-light)' }}>💸</div>
            <div className="stat-value">{data?.total_notifications || 0}</div>
            <div className="stat-label">Payments Received</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(251,191,36,0.12)' }}>💰</div>
            <div className="stat-value" style={{ fontSize: 18 }}>{fmt(totalPaid)}</div>
            <div className="stat-label">Total Amount Received</div>
          </div>
        </div>

        {loading && <div className="spinner">Loading your notifications…</div>}
        {error   && <div className="alert alert-error">⚠️ {error}</div>}

        {!loading && data?.data?.length === 0 && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">🔔</div>
              <div className="empty-state-text">No payment notifications yet</div>
              <div className="empty-state-sub">
                You'll see them here once a payment has been made and you've been notified.
              </div>
            </div>
          </div>
        )}

        {!loading && (data?.data || []).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)' }}>
              PAYMENT NOTIFICATIONS
            </h2>
            {data.data.map((p, i) => (
              <div key={i} className="card vendor-notif-card">
                {/* Icon */}
                <div className="vendor-notif-icon">💸</div>

                {/* Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="vendor-notif-top">
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{fmt(p.amount_paid)} Received</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 2 }}>
                        {p.po_number} · {p.payment_type}
                      </div>
                    </div>
                    <span className="badge badge-notified">✓ Notified</span>
                  </div>

                  <div style={{
                    marginTop: 12, padding: '10px 14px',
                    background: 'var(--success-light)',
                    borderRadius: 8, border: '1px solid rgba(16,185,129,0.2)',
                    fontSize: 13, color: '#6ee7b7'
                  }}>
                    {p.message}
                  </div>

                  <div className="vendor-notif-meta">
                    <span>🔖 UTR: <strong style={{ color: 'var(--text-secondary)' }}>{p.utr_reference}</strong></span>
                    <span>📅 {p.paid_at
                      ? new Date(p.paid_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}