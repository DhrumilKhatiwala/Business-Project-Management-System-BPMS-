import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI, alertsAPI } from '../services/api';
import {
  HiOutlineUsers, HiOutlineBriefcase, HiOutlineClipboardDocumentList,
  HiOutlineCube, HiOutlineExclamationTriangle, HiOutlineUserGroup,
  HiOutlineCheckCircle, HiOutlineClock,
} from 'react-icons/hi2';

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await dashboardAPI.getOverview();
      setData(res.data);
      if (user.role === 'BUSINESS_OWNER') {
        const alertRes = await alertsAPI.getLowStock({ status: 'ACTIVE' });
        setAlerts(alertRes.data);
      }
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  const stats = data?.stats || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Welcome back, {user.fullName}</h1>
          <p>Here's what's happening with your {user.role === 'BUSINESS_OWNER' ? 'business' : 'work'} today</p>
        </div>
      </div>

      {user.role === 'BUSINESS_OWNER' && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple"><HiOutlineUsers /></div>
              <div className="stat-value">{stats.totalUsers || 0}</div>
              <div className="stat-label">Total Users</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue"><HiOutlineBriefcase /></div>
              <div className="stat-value">{stats.totalProjects || 0}</div>
              <div className="stat-label">Total Projects</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green"><HiOutlineCheckCircle /></div>
              <div className="stat-value">{stats.activeProjects || 0}</div>
              <div className="stat-label">Active Projects</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon yellow"><HiOutlineClipboardDocumentList /></div>
              <div className="stat-value">{stats.pendingTasks || 0}</div>
              <div className="stat-label">Pending Tasks</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue"><HiOutlineUserGroup /></div>
              <div className="stat-value">{stats.totalWorkers || 0}</div>
              <div className="stat-label">Active Workers</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red"><HiOutlineExclamationTriangle /></div>
              <div className="stat-value">{stats.activeAlerts || 0}</div>
              <div className="stat-label">Low Stock Alerts</div>
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="card mt-24">
              <div className="card-header">
                <h3>⚠️ Active Low-Stock Alerts</h3>
              </div>
              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Current Stock</th>
                      <th>Min Level</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.slice(0, 5).map((a) => (
                      <tr key={a.id}>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{a.material.name}</td>
                        <td><span className="badge badge-danger">{a.currentQuantity} {a.material.unit}</span></td>
                        <td>{a.minStockLevel} {a.material.unit}</td>
                        <td><span className="badge badge-warning">Low Stock</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {user.role === 'WORKER' && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon purple"><HiOutlineClipboardDocumentList /></div>
            <div className="stat-value">{stats.totalTasks || 0}</div>
            <div className="stat-label">Total Tasks</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow"><HiOutlineClock /></div>
            <div className="stat-value">{stats.pendingTasks || 0}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><HiOutlineBriefcase /></div>
            <div className="stat-value">{stats.inProgressTasks || 0}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><HiOutlineCheckCircle /></div>
            <div className="stat-value">{stats.completedTasks || 0}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><HiOutlineBriefcase /></div>
            <div className="stat-value">{stats.assignedProjects || 0}</div>
            <div className="stat-label">Assigned Projects</div>
          </div>
        </div>
      )}

      {user.role === 'CLIENT' && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><HiOutlineBriefcase /></div>
            <div className="stat-value">{stats.totalProjects || 0}</div>
            <div className="stat-label">Total Projects</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><HiOutlineCheckCircle /></div>
            <div className="stat-value">{stats.activeProjects || 0}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><HiOutlineCheckCircle /></div>
            <div className="stat-value">{stats.completedProjects || 0}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
      )}
    </div>
  );
}
