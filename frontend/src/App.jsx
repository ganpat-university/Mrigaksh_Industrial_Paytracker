import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminDashboard from './pages/AdminDashboard';
import AccountantDashboard from './pages/AccountantDashboard';
import UserDashboard from './pages/UserDashboard';
import VendorDashboard from './pages/VendorDashboard';

function RoleRouter() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="spinner" style={{ height: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
        <p style={{ color: 'var(--text-muted)' }}>Loading PayTrack…</p>
      </div>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'admin')      return <AdminDashboard />;
  if (user.role === 'accountant') return <AccountantDashboard />;
  if (user.role === 'vendor')     return <VendorDashboard />;
  return <UserDashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/*"        element={<RoleRouter />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
