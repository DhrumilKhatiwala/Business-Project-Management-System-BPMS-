import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { alertsAPI } from '../services/api';
import BrandLogo from './BrandLogo';
import {
  HiOutlineHome,
  HiOutlineUsers,
  HiOutlineBriefcase,
  HiOutlineClipboardDocumentList,
  HiOutlineCube,
  HiOutlineExclamationTriangle,
  HiOutlineArrowRightOnRectangle,
  HiOutlineUserGroup,
  HiOutlineShieldCheck,
  HiOutlineWrenchScrewdriver,
  HiOutlineBuildingOffice2,
  HiOutlineUserCircle,
  HiOutlineDocumentText,
  HiOutlineXMark,
} from 'react-icons/hi2';
import './Sidebar.css';

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);

  const fetchAlertsCount = () => {
    if (user?.role === 'BUSINESS_OWNER') {
      alertsAPI.getLowStock({ status: 'ACTIVE' })
        .then(res => setActiveAlertsCount(res.data?.length || 0))
        .catch(() => {});
    }
  };

  useEffect(() => {
    fetchAlertsCount();
  }, [user?.role, location.pathname]);

  useEffect(() => {
    window.addEventListener('alerts-updated', fetchAlertsCount);
    const timer = setInterval(fetchAlertsCount, 15000);
    return () => {
      window.removeEventListener('alerts-updated', fetchAlertsCount);
      clearInterval(timer);
    };
  }, [user?.role]);

  const handleLogout = () => {
    if (onClose) onClose();
    logout();
    navigate('/login');
  };

  const adminLinks = [
    { to: '/dashboard', icon: <HiOutlineHome />, label: 'Dashboard' },
    { to: '/accounts/users', icon: <HiOutlineUsers />, label: 'Business Owners' },
  ];

  const ownerLinks = [
    { to: '/dashboard', icon: <HiOutlineHome />, label: 'Dashboard' },
    { to: '/accounts/users', icon: <HiOutlineUsers />, label: 'Clients & Users' },
    { to: '/workforce/workers', icon: <HiOutlineUserGroup />, label: 'Workers' },
    { to: '/projects', icon: <HiOutlineBriefcase />, label: 'Projects' },
    { to: '/inventory', icon: <HiOutlineCube />, label: 'Inventory' },
    {
      to: '/inventory/alerts',
      icon: <HiOutlineExclamationTriangle />,
      label: 'Alerts',
      badge: activeAlertsCount > 0 ? activeAlertsCount : null,
    },
    { to: '/invoices', icon: <HiOutlineDocumentText />, label: 'Invoices' },
  ];

  const workerLinks = [
    { to: '/dashboard', icon: <HiOutlineHome />, label: 'Dashboard' },
    { to: '/my-tasks', icon: <HiOutlineClipboardDocumentList />, label: 'My Tasks' },
    { to: '/projects', icon: <HiOutlineBriefcase />, label: 'Projects' },
    { to: '/accounts/users', icon: <HiOutlineShieldCheck />, label: 'Business Owner' },
  ];

  const clientLinks = [
    { to: '/dashboard', icon: <HiOutlineHome />, label: 'Dashboard' },
    { to: '/client-portal', icon: <HiOutlineDocumentText />, label: 'Project Progress' },
    { to: '/projects', icon: <HiOutlineBriefcase />, label: 'Projects' },
    { to: '/accounts/users', icon: <HiOutlineShieldCheck />, label: 'Business Owner' },
  ];

  const links =
    user?.role === 'ADMIN' ? adminLinks :
    user?.role === 'BUSINESS_OWNER' ? ownerLinks :
    user?.role === 'WORKER' ? workerLinks :
    clientLinks;

  const roleIcon =
    user?.role === 'ADMIN' ? <HiOutlineShieldCheck style={{ verticalAlign: 'middle' }} /> :
    user?.role === 'BUSINESS_OWNER' ? <HiOutlineBuildingOffice2 style={{ verticalAlign: 'middle' }} /> :
    user?.role === 'WORKER' ? <HiOutlineWrenchScrewdriver style={{ verticalAlign: 'middle' }} /> :
    <HiOutlineUserCircle style={{ verticalAlign: 'middle' }} />;

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header flex items-center justify-between">
        <BrandLogo size={36} showText={true} />
        {onClose && (
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Close navigation">
            <HiOutlineXMark />
          </button>
        )}
      </div>

      {(user?.companyName || user?.company?.name) && (
        <div style={{
          padding: '8px 12px',
          margin: '12px 14px 0 14px',
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <HiOutlineBuildingOffice2 style={{ color: '#818cf8', fontSize: '1.1rem', flexShrink: 0 }} />
          <div style={{ overflow: 'hidden', lineHeight: 1.2 }}>
            <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 600 }}>
              {user?.role === 'BUSINESS_OWNER' ? 'Organization' : 'Assigned Company'}
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={user?.companyName || user?.company?.name}>
              {user?.companyName || user?.company?.name}
            </div>
          </div>
        </div>
      )}

      <nav className="sidebar-nav">
        <div className="nav-section">
          <span className="nav-section-label">Main Menu</span>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              end={link.to === '/dashboard'}
              onClick={() => { if (onClose) onClose(); }}
            >
              <span className="nav-icon">{link.icon}</span>
              <span className="nav-label">{link.label}</span>
              {link.badge !== null && link.badge !== undefined && (
                <span className="nav-badge-pill">{link.badge}</span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div
          className="user-info"
          onClick={() => { if (onClose) onClose(); navigate('/profile'); }}
          title="Account & Profile Settings"
          style={{ cursor: 'pointer', borderRadius: 'var(--radius-md)', padding: '4px', transition: 'background 0.2s' }}
        >
          <div className="user-avatar">
            {user?.fullName?.charAt(0)?.toUpperCase()}
          </div>
          <div className="user-details">
            <span className="user-name">{user?.fullName}</span>
            <span className="user-role-badge">
              {roleIcon} <span>{user?.role?.replace('_', ' ')}</span>
            </span>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Sign Out">
          <HiOutlineArrowRightOnRectangle />
        </button>
      </div>
    </aside>
  );
}
