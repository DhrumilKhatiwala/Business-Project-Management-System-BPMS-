import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI, alertsAPI } from '../services/api';
import {
  HiOutlineUsers, HiOutlineBriefcase, HiOutlineClipboardDocumentList,
  HiOutlineCube, HiOutlineExclamationTriangle, HiOutlineUserGroup,
  HiOutlineCheckCircle, HiOutlineClock, HiOutlinePlus, HiOutlineArrowRight,
  HiOutlineArrowTrendingUp, HiOutlineCalendar
} from 'react-icons/hi2';

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [projectData, setProjectData] = useState(null);
  const [inventoryData, setInventoryData] = useState(null);
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
        const [alertRes, projRes, invRes] = await Promise.allSettled([
          alertsAPI.getLowStock({ status: 'ACTIVE' }),
          dashboardAPI.getProjectStats(),
          dashboardAPI.getInventoryStats(),
        ]);
        if (alertRes.status === 'fulfilled') setAlerts(alertRes.value.data);
        if (projRes.status === 'fulfilled') setProjectData(projRes.value.data);
        if (invRes.status === 'fulfilled') setInventoryData(invRes.value.data);
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
  const projStats = projectData?.stats || {};
  const invStats = inventoryData?.stats || {};

  // Calculations for visual gauges
  const totalProj = projStats.totalProjects || 1;
  const inProgressPct = Math.round(((projStats.activeProjects || 0) / totalProj) * 100);
  const completedPct = Math.round(((projStats.completedProjects || 0) / totalProj) * 100);
  const onHoldPct = Math.max(0, 100 - inProgressPct - completedPct);

  const totalMats = invStats.totalMaterials || 1;
  const inStockPct = Math.round(((invStats.inStock || 0) / totalMats) * 100);
  const lowStockPct = Math.round(((invStats.lowStock || 0) / totalMats) * 100);
  const outStockPct = Math.max(0, 100 - inStockPct - lowStockPct);

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <div>
      {/* ── Welcome Hero Banner ── */}
      <div className="welcome-hero">
        <div className="welcome-hero-content">
          <h2>Welcome back, {user.fullName}!</h2>
          <p>
            <span className="pulse-dot" />
            <span>System Operational</span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <HiOutlineCalendar style={{ verticalAlign: 'middle' }} />
            <span>{todayStr}</span>
          </p>
        </div>
        <div className="welcome-hero-actions">
          {user.role === 'BUSINESS_OWNER' && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/inventory')}>
                <HiOutlineCube />
                <span>Inventory</span>
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/projects')}>
                <HiOutlinePlus />
                <span>New Project</span>
              </button>
            </>
          )}
          {user.role === 'WORKER' && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/my-tasks')}>
              <HiOutlineClipboardDocumentList />
              <span>View My Tasks</span>
            </button>
          )}
        </div>
      </div>

      {user.role === 'BUSINESS_OWNER' && (
        <>
          {/* ── KPI Stat Cards ── */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple"><HiOutlineUsers /></div>
              <div className="stat-value">{stats.totalUsers || 0}</div>
              <div className="stat-label">Total Accounts</div>
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
              <div className="stat-label">Field Workers</div>
            </div>
            <div className="stat-card" style={stats.activeAlerts > 0 ? { borderColor: 'rgba(239, 68, 68, 0.4)' } : {}}>
              <div className="stat-icon red"><HiOutlineExclamationTriangle /></div>
              <div className="stat-value" style={stats.activeAlerts > 0 ? { color: 'var(--danger)' } : {}}>
                {stats.activeAlerts || 0}
              </div>
              <div className="stat-label">Low-Stock Alerts</div>
            </div>
          </div>

          {/* ── Visual Distribution Cards (Projects & Inventory) ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Project Portfolio Distribution */}
            <div className="distribution-card">
              <div className="distribution-header">
                <span className="distribution-title">📁 Project Portfolio Status</span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{projStats.totalProjects || 0} total</span>
              </div>
              <div className="distribution-bar">
                <div className="distribution-seg blue" style={{ width: `${inProgressPct}%` }} title={`In Progress: ${inProgressPct}%`} />
                <div className="distribution-seg green" style={{ width: `${completedPct}%` }} title={`Completed: ${completedPct}%`} />
                <div className="distribution-seg yellow" style={{ width: `${onHoldPct}%` }} title={`On Hold: ${onHoldPct}%`} />
              </div>
              <div className="distribution-legend">
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#3b82f6' }} />
                  <span>In Progress ({inProgressPct}%)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#10b981' }} />
                  <span>Completed ({completedPct}%)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#f59e0b' }} />
                  <span>On Hold / Planning ({onHoldPct}%)</span>
                </div>
              </div>
            </div>

            {/* Inventory Health Meter */}
            <div className="distribution-card">
              <div className="distribution-header">
                <span className="distribution-title">📦 Inventory Stock Health</span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{invStats.totalMaterials || 0} items</span>
              </div>
              <div className="distribution-bar">
                <div className="distribution-seg green" style={{ width: `${inStockPct}%` }} title={`In Stock: ${inStockPct}%`} />
                <div className="distribution-seg yellow" style={{ width: `${lowStockPct}%` }} title={`Low Stock: ${lowStockPct}%`} />
                <div className="distribution-seg red" style={{ width: `${outStockPct}%` }} title={`Out of Stock: ${outStockPct}%`} />
              </div>
              <div className="distribution-legend">
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#10b981' }} />
                  <span>In Stock ({inStockPct}%)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#f59e0b' }} />
                  <span>Low Stock ({lowStockPct}%)</span>
                </div>
                <div className="legend-item">
                  <span className="legend-dot" style={{ background: '#ef4444' }} />
                  <span>Out of Stock ({outStockPct}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Active Low-Stock Alerts Card ── */}
          {alerts.length > 0 && (
            <div className="card mt-24">
              <div className="card-header flex justify-between items-center">
                <div className="flex items-center gap-8">
                  <span className="pulse-dot danger" />
                  <h3>Active Low-Stock Alerts ({alerts.length})</h3>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/inventory/alerts')}>
                  <span>Manage Alerts</span>
                  <HiOutlineArrowRight />
                </button>
              </div>
              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Category</th>
                      <th>Current Quantity</th>
                      <th>Safety Level</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts.slice(0, 5).map((a) => (
                      <tr key={a.id}>
                        <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{a.material.name}</td>
                        <td><span className="badge badge-neutral">{a.material.category || 'General'}</span></td>
                        <td>
                          <span className={`badge ${a.currentQuantity === 0 ? 'badge-danger' : 'badge-warning'}`}>
                            {a.currentQuantity} {a.material.unit}
                          </span>
                        </td>
                        <td>{a.minStockLevel} {a.material.unit}</td>
                        <td>
                          <span className="badge badge-warning">
                            <span className="pulse-dot warning" style={{ width: 6, height: 6, marginRight: 4 }} />
                            Reorder Required
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => navigate(`/inventory/${a.material.id}`)}
                          >
                            Restock
                          </button>
                        </td>
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
            <div className="stat-label">Total Assigned Tasks</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow"><HiOutlineClock /></div>
            <div className="stat-value">{stats.pendingTasks || 0}</div>
            <div className="stat-label">Pending Queue</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><HiOutlineBriefcase /></div>
            <div className="stat-value">{stats.inProgressTasks || 0}</div>
            <div className="stat-label">In Progress</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><HiOutlineCheckCircle /></div>
            <div className="stat-value">{stats.completedTasks || 0}</div>
            <div className="stat-label">Completed Tasks</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><HiOutlineBriefcase /></div>
            <div className="stat-value">{stats.assignedProjects || 0}</div>
            <div className="stat-label">Active Projects</div>
          </div>
        </div>
      )}

      {user.role === 'CLIENT' && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><HiOutlineBriefcase /></div>
            <div className="stat-value">{stats.totalProjects || 0}</div>
            <div className="stat-label">Total Contracted Projects</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><HiOutlineCheckCircle /></div>
            <div className="stat-value">{stats.activeProjects || 0}</div>
            <div className="stat-label">In Execution</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple"><HiOutlineCheckCircle /></div>
            <div className="stat-value">{stats.completedProjects || 0}</div>
            <div className="stat-label">Delivered Projects</div>
          </div>
        </div>
      )}
    </div>
  );
}
