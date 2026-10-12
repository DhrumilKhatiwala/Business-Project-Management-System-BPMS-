import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import BrandLogo from '../components/BrandLogo';
import { HiOutlineBars3 } from 'react-icons/hi2';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-layout">
      {/* Mobile / Tablet Top Navigation Header */}
      <header className="mobile-topbar">
        <button
          className="mobile-menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open Navigation"
        >
          <HiOutlineBars3 />
        </button>

        <div className="mobile-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
          <BrandLogo size={28} showText={true} />
        </div>

        <div
          className="mobile-user-avatar"
          onClick={() => navigate('/profile')}
          title={user?.fullName || 'Profile'}
        >
          {user?.fullName?.charAt(0)?.toUpperCase()}
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Responsive Sidebar Drawer */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Viewport */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
