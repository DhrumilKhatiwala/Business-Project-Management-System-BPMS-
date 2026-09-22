import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { alertsAPI } from '../services/api';
import {
  HiOutlineHome,
  HiOutlineUsers,
  HiOutlineBriefcase,
  HiOutlineClipboardDocumentList,
  HiOutlineCube,
  HiOutlineExclamationTriangle,
  HiOutlineArrowRightOnRectangle,
  HiOutlineUserGroup,
  HiOutlineChartBar,
} from 'react-icons/hi2';
import './Sidebar.css';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeAlertsCount, setActiveAlertsCount] = useState(0);

  useEffect(() => {
    if (user?.role === 'BUSINESS_OWNER') {
      alertsAPI.getLowStock({ status: 'ACTIVE' })
        .then(res => setActiveAlertsCount(res.data?.length || 0))
        .catch(() => {});
    }
  }, [user?.role]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const ownerLinks = [
    { to: '/dashboard', icon: <HiOutlineHome />, label: 'Dashboard' },
    { to: '/accounts/users', icon: <HiOutlineUsers />, label: 'Users' },
    { to: '/workforce/workers', icon: <HiOutlineUserGroup />, label: 'Workers' },
    { to: '/projects', icon: <HiOutlineBriefcase />, label: 'Projects' },
    { to: '/inventory', icon: <HiOutlineCube />, label: 'Inventory' },
    {
      to: '/inventory/alerts',
      icon: <HiOutlineExclamationTriangle />,
      label: 'Alerts',
      badge: activeAlertsCount > 0 ? activeAlertsCount : null,
    },
  ];

  const workerLinks = [
    { to: '/dashboard', icon: <HiOutlineHome />, label: 'Dashboard' },
    { to: '/my-tasks', icon: <HiOutlineClipboardDocumentList />, label: 'My Tasks' },
    { to: '/projects', icon: <HiOutlineBriefcase />, label: 'Projects' },
  ];

  const clientLinks = [
    { to: '/dashboard', icon: <HiOutlineHome />, label: 'Dashboard' },
    { to: '/projects', icon: <HiOutlineBriefcase />, label: 'Projects' },
  ];

  const links =
    user?.role === 'BUSINESS_OWNER' ? ownerLinks :
    user?.role === 'WORKER' ? workerLinks :
    clientLinks;

  const roleEmoji =
    user?.role === 'BUSINESS_OWNER' ? '👑' :
    user?.role === 'WORKER' ? '👷' : '🤝';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <HiOutlineChartBar />
          </div>
          <div className="logo-text">
            <span className="logo-name">BPMS</span>
            <span className="logo-sub">Management System</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <span className="nav-section-label">Main Menu</span>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              end={link.to === '/dashboard'}
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
        <div className="user-info">
          <div className="user-avatar">
            {user?.fullName?.charAt(0)?.toUpperCase()}
          </div>
          <div className="user-details">
            <span className="user-name">{user?.fullName}</span>
            <span className="user-role-badge">
              <span>{roleEmoji}</span> {user?.role?.replace('_', ' ')}
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
