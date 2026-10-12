import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI, alertsAPI } from '../services/api';
import {
  HiOutlineUsers, HiOutlineBriefcase, HiOutlineClipboardDocumentList,
  HiOutlineCube, HiOutlineExclamationTriangle, HiOutlineUserGroup,
  HiOutlineCheckCircle, HiOutlineClock, HiOutlinePlus, HiOutlineArrowRight,
  HiOutlineShieldCheck, HiOutlineCalendar, HiOutlineBuildingOffice2,
  HiOutlineDocumentText, HiOutlineCurrencyDollar
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
            <span>{user.role === 'ADMIN' ? 'System Administrator Console' : 'System Operational'}</span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <HiOutlineCalendar style={{ verticalAlign: 'middle' }} />
            <span>{todayStr}</span>
          </p>
        </div>
        <div className="welcome-hero-actions">
          {user.role === 'ADMIN' && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/accounts/users')}>
              <HiOutlinePlus />
              <span>Add Business Owner</span>
            </button>
          )}
          {user.role === 'BUSINESS_OWNER' && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/invoices')}>
                <HiOutlineDocumentText />
                <span>Invoices</span>
              </button>
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
          {user.role === 'CLIENT' && (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/client-portal')}>
              <HiOutlineDocumentText />
              <span>Project Progress & Portal</span>
            </button>
          )}
        </div>
      </div>

      {user.role === 'ADMIN' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Admin Platform Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple"><HiOutlineBuildingOffice2 /></div>
              <div className="stat-value">{stats.totalBusinessOwners || 0}</div>
              <div className="stat-label">Business Owners</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green"><HiOutlineCheckCircle /></div>
              <div className="stat-value">{stats.activeBusinessOwners || 0}</div>
              <div className="stat-label">Active Business Accounts</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue"><HiOutlineUsers /></div>
              <div className="stat-value">{stats.totalClients || 0}</div>
              <div className="stat-label">Platform Clients</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon yellow"><HiOutlineUserGroup /></div>
              <div className="stat-value">{stats.totalWorkers || 0}</div>
              <div className="stat-label">Platform Workers</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue"><HiOutlineBriefcase /></div>
              <div className="stat-value">{stats.totalProjects || 0}</div>
              <div className="stat-label">Total Projects</div>
            </div>
          </div>

          {/* Business Owners List */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <div>
                <h3>System Business Owners</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Registered Business Owner accounts under platform administration
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/accounts/users')}>
                <span>Manage All Business Owners</span>
                <HiOutlineArrowRight />
              </button>
            </div>

            {(!data?.recentBusinessOwners || data.recentBusinessOwners.length === 0) ? (
              <div className="empty-state" style={{ padding: '36px 20px' }}>
                <div className="empty-icon"><HiOutlineBuildingOffice2 /></div>
                <h3>No Business Owners Registered</h3>
                <p>Click below to create the first Business Owner account.</p>
                <button className="btn btn-primary" onClick={() => navigate('/accounts/users')}>
                  <HiOutlinePlus /> Add Business Owner
                </button>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Created Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentBusinessOwners.map((owner) => (
                      <tr key={owner.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{owner.fullName}</td>
                        <td>{owner.email}</td>
                        <td>{owner.phone || '—'}</td>
                        <td>
                          <span className={`badge ${owner.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                            {owner.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                          {new Date(owner.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {user.role === 'BUSINESS_OWNER' && (
        <>
          {/* ── KPI Stat Cards ── */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple"><HiOutlineUsers /></div>
              <div className="stat-value">{stats.totalUsers || 0}</div>
              <div className="stat-label">Clients & Workers</div>
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
          <div className="dashboard-distribution-grid">
            {/* Project Portfolio Distribution */}
            <div className="distribution-card">
              <div className="distribution-header">
                <span className="distribution-title flex items-center gap-8">
                  <HiOutlineBriefcase style={{ color: '#38bdf8' }} />
                  <span>Project Portfolio Status</span>
                </span>
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
                <span className="distribution-title flex items-center gap-8">
                  <HiOutlineCube style={{ color: '#10b981' }} />
                  <span>Inventory Stock Health</span>
                </span>
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
                            onClick={() => navigate(`/inventory/materials/${a.material.id}`)}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Worker Stats */}
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

          {/* Active Tasks Queue */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <div>
                <h3>My Active & Pending Tasks</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  High-priority work requiring your attention
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/my-tasks')}>
                <span>View Full Queue</span>
                <HiOutlineArrowRight />
              </button>
            </div>

            {(!data?.myRecentTasks || data.myRecentTasks.length === 0) ? (
              <div className="empty-state" style={{ padding: '36px 20px' }}>
                <div className="empty-icon"><HiOutlineCheckCircle /></div>
                <h3>All caught up!</h3>
                <p>You have no pending or in-progress tasks assigned.</p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Task Title</th>
                      <th>Priority</th>
                      <th>Project</th>
                      <th>Due Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.myRecentTasks.map((t) => (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.title}</td>
                        <td>
                          <span className={`badge ${t.priority === 'URGENT' ? 'badge-danger' : t.priority === 'HIGH' ? 'badge-warning' : 'badge-info'}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-neutral">{t.project?.name || '—'}</span>
                        </td>
                        <td style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                          {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          <span className={`badge ${t.status === 'IN_PROGRESS' ? 'badge-info' : 'badge-warning'}`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Assigned Projects */}
          {data?.myProjects && data.myProjects.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3>My Assigned Projects</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Projects you are currently deployed on
                </p>
              </div>
              <div className="cards-grid" style={{ gap: 16 }}>
                {data.myProjects.map((p) => (
                  <div
                    key={p.id}
                    className="card"
                    style={{ background: 'var(--bg-tertiary)', cursor: 'pointer', padding: 18 }}
                    onClick={() => navigate(`/projects/${p.id}`)}
                  >
                    <div className="flex justify-between items-center mb-10">
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</span>
                      <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>{p.status}</span>
                    </div>
                    <div style={{ marginBottom: 6 }} className="flex justify-between text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>Progress</span>
                      <strong style={{ color: '#38bdf8' }}>{p.progress}%</strong>
                    </div>
                    <div className="progress-bar-wrap" style={{ height: 6 }}>
                      <div className="progress-bar-fill" style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {user.role === 'CLIENT' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Client Stats */}
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

          {/* Contracted Projects Overview */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <div>
                <h3>Contracted Project Portfolio</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                  Real-time status, milestone achievement, and delivery progress
                </p>
              </div>
              <div className="flex gap-8">
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/client-portal')}>
                  <HiOutlineDocumentText />
                  <span>My Portal & Live Progress</span>
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/projects')}>
                  <span>All Projects</span>
                  <HiOutlineArrowRight />
                </button>
              </div>
            </div>

            {(!data?.projects || data.projects.length === 0) ? (
              <div className="empty-state" style={{ padding: '36px 20px' }}>
                <div className="empty-icon"><HiOutlineBriefcase /></div>
                <h3>No active contracts</h3>
                <p>You have no active projects under contract at this time.</p>
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Progress</th>
                      <th>Stage-Gate Milestones</th>
                      <th>Managed By</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.projects.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
                          {p.description && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.description.slice(0, 60)}...</div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${p.status === 'COMPLETED' ? 'badge-success' : p.status === 'IN_PROGRESS' ? 'badge-info' : 'badge-warning'}`}>
                            {p.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ minWidth: 140 }}>
                          <div className="flex items-center gap-8">
                            <div className="progress-bar-wrap" style={{ flex: 1, height: 6 }}>
                              <div className="progress-bar-fill" style={{ width: `${p.progress}%` }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{p.progress}%</span>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-neutral">
                            {p._count?.milestones || 0} Milestones
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                          {p.createdBy?.fullName || 'BPMS Operations'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => navigate(`/projects/${p.id}`)}
                          >
                            View Cockpit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
