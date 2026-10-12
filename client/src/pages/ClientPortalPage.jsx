import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { clientPortalAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  HiOutlineBriefcase, HiOutlineCheckCircle, HiOutlineClock,
  HiOutlineArrowRight, HiOutlineDocumentText, HiOutlineCurrencyDollar,
  HiOutlineExclamationCircle, HiOutlineFlag, HiOutlineBellAlert,
  HiOutlineInformationCircle
} from 'react-icons/hi2';

const STATUS_CONFIG = {
  PAID:           { label: 'Paid',     cls: 'badge-success' },
  PARTIALLY_PAID: { label: 'Partial',  cls: 'badge-info'    },
  PENDING:        { label: 'Pending',  cls: 'badge-warning'  },
  OVERDUE:        { label: 'Overdue',  cls: 'badge-danger'   },
};

const PROJ_STATUS = {
  IN_PROGRESS: 'badge-info',
  COMPLETED:   'badge-success',
  NOT_STARTED: 'badge-neutral',
  ON_HOLD:     'badge-warning',
};

const MILESTONE_STATUS = {
  COMPLETED:   { cls: 'badge-success', icon: <HiOutlineCheckCircle style={{ color: 'var(--success)' }} /> },
  IN_PROGRESS: { cls: 'badge-info',    icon: <HiOutlineClock style={{ color: 'var(--info)' }} /> },
  PENDING:     { cls: 'badge-neutral', icon: <HiOutlineFlag style={{ color: 'var(--text-muted)' }} /> },
};

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function ClientPortalPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState(null);

  useEffect(() => {
    loadPortalData();
  }, []);

  const loadPortalData = async () => {
    try {
      const res = await clientPortalAPI.getOverview();
      setData(res.data);
      if (res.data?.projects && res.data.projects.length > 0) {
        setActiveProjectId(res.data.projects[0].id);
      }
    } catch (err) {
      toast.error('Failed to load project details from database.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /></div>;
  }

  const projects = data?.projects || [];
  const stats = data?.stats || {};
  const notifications = data?.notifications || [];
  const clientName = data?.client?.fullName || user?.fullName || 'Client';

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];
  const activeMilestones = activeProject?.milestones || [];
  const completedMilestones = activeMilestones.filter(m => m.status === 'COMPLETED').length;
  const primaryInvoice = activeProject?.invoices?.[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Welcome Banner ── */}
      <div className="welcome-hero">
        <div className="welcome-hero-content">
          <h2>Welcome, {clientName}!</h2>
          <p>
            <span className="pulse-dot" />
            <span>Client Cockpit — Real-Time Database Progress &amp; Financial Ledger</span>
          </p>
        </div>
        <div className="welcome-hero-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/projects')}>
            <HiOutlineBriefcase /> All Projects
          </button>
        </div>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><HiOutlineBriefcase /></div>
          <div className="stat-value">{stats.totalProjects || 0}</div>
          <div className="stat-label">Contracted Projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><HiOutlineCheckCircle /></div>
          <div className="stat-value">{stats.delivered || 0}</div>
          <div className="stat-label">Delivered Projects</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><HiOutlineClock /></div>
          <div className="stat-value">{stats.inExecution || 0}</div>
          <div className="stat-label">In Execution</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><HiOutlineCurrencyDollar /></div>
          <div className="stat-value">{fmt(stats.totalPaid)}</div>
          <div className="stat-label">Total Amount Paid</div>
        </div>
      </div>

      {/* ── Main Content: Project Selector + Detail ── */}
      {projects.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"><HiOutlineBriefcase /></div>
            <h3>No Contracted Projects Found</h3>
            <p>You have no active projects registered under your client account in MongoDB.</p>
          </div>
        </div>
      ) : (
        <div className="client-portal-layout-grid">

          {/* Left: Project List & Notifications */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: '14px 16px', marginBottom: 0 }}>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
                My Contracted Projects
              </h3>
              {projects.map(p => (
                <div
                  key={p.id}
                  onClick={() => setActiveProjectId(p.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    marginBottom: 8,
                    background: activeProject?.id === p.id ? 'var(--accent-primary-glow)' : 'transparent',
                    border: `1px solid ${activeProject?.id === p.id ? 'rgba(99,102,241,0.4)' : 'transparent'}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: 6 }}>
                    {p.name}
                  </div>
                  <div className="flex items-center gap-8" style={{ fontSize: '0.78rem' }}>
                    <span className={`badge ${PROJ_STATUS[p.status] || 'badge-neutral'}`} style={{ fontSize: '0.72rem' }}>
                      {p.status.replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>{p.progress}%</span>
                  </div>
                  <div className="progress-bar-wrap" style={{ height: 4, marginTop: 8 }}>
                    <div className="progress-bar-fill" style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Notifications Card */}
            <div className="card" style={{ padding: '14px 16px' }}>
              <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 1 }}>
                <HiOutlineBellAlert style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Activity Feed
              </h3>
              {notifications.length === 0 ? (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No recent milestone or invoice notifications.</p>
              ) : (
                notifications.map(n => (
                  <div key={n.id} style={{ display: 'flex', gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ marginTop: 2, flexShrink: 0, color: n.type === 'invoice' ? 'var(--success)' : n.type === 'complete' ? 'var(--info)' : 'var(--warning)' }}>
                      {n.type === 'invoice'  ? <HiOutlineCurrencyDollar /> :
                       n.type === 'complete' ? <HiOutlineCheckCircle />   :
                       <HiOutlineInformationCircle />}
                    </span>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.message}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>
                        {n.date ? new Date(n.date).toLocaleString() : ''}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Active Project Detail */}
          {activeProject && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Project Header */}
              <div className="card">
                <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                      {activeProject.name}
                    </h2>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.87rem' }}>
                      {activeProject.description || 'No detailed description provided.'}
                    </p>
                  </div>
                  <div className="flex gap-10 items-center">
                    <span className={`badge ${PROJ_STATUS[activeProject.status] || 'badge-neutral'}`}>
                      {activeProject.status.replace(/_/g, ' ')}
                    </span>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/projects/${activeProject.id}`)}>
                      <HiOutlineArrowRight /> Project Cockpit
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ marginTop: 20 }}>
                  <div className="progress-label" style={{ marginBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Project Completion</span>
                    <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '1.1rem' }}>{activeProject.progress}%</span>
                  </div>
                  <div className="progress-bar-wrap" style={{ height: 10, borderRadius: 99 }}>
                    <div className="progress-bar-fill" style={{ width: `${activeProject.progress}%`, borderRadius: 99 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span>Start: {activeProject.startDate ? new Date(activeProject.startDate).toLocaleDateString() : '—'}</span>
                    <span>Managed By: {activeProject.createdBy?.fullName || 'BPMS Operations'}</span>
                    <span>Target End: {activeProject.endDate ? new Date(activeProject.endDate).toLocaleDateString() : '—'}</span>
                  </div>
                </div>
              </div>

              {/* Milestones Stage-Gate Timeline */}
              <div className="card">
                <div className="card-header">
                  <h3>Stage-Gate Milestones</h3>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {completedMilestones} of {activeMilestones.length} completed
                  </span>
                </div>
                {activeMilestones.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>No milestones scheduled yet for this project.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {activeMilestones.map((m, idx) => {
                      const cfg = MILESTONE_STATUS[m.status] || MILESTONE_STATUS.PENDING;
                      const isLast = idx === activeMilestones.length - 1;
                      return (
                        <div key={m.id} style={{ display: 'flex', gap: 16, paddingBottom: isLast ? 0 : 16 }}>
                          {/* Timeline dot & line */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                              background: m.status === 'COMPLETED' ? 'var(--success-bg)' : m.status === 'IN_PROGRESS' ? 'var(--info-bg)' : 'rgba(255,255,255,0.04)',
                              border: `2px solid ${m.status === 'COMPLETED' ? 'var(--success)' : m.status === 'IN_PROGRESS' ? 'var(--info)' : 'var(--border-color)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
                            }}>
                              {cfg.icon}
                            </div>
                            {!isLast && <div style={{ width: 2, flex: 1, background: 'var(--border-color)', marginTop: 4 }} />}
                          </div>
                          {/* Content */}
                          <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
                            <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 8 }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.93rem' }}>{m.title}</span>
                              <span className={`badge ${cfg.cls}`}>{m.status.replace(/_/g, ' ')}</span>
                            </div>
                            {m.description && (
                              <p style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginTop: 3 }}>{m.description}</p>
                            )}
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                              Due Date: {m.dueDate ? new Date(m.dueDate).toLocaleDateString() : '—'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Invoice & Payment Status from Database */}
              <div className="card">
                <div className="card-header">
                  <h3><HiOutlineDocumentText style={{ verticalAlign: 'middle', marginRight: 6 }} />Financial &amp; Billing Ledger</h3>
                </div>

                {!primaryInvoice ? (
                  <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    No invoice generated yet for this project.
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginBottom: 16 }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '14px' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 6 }}>Invoice No.</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {primaryInvoice.invoiceNumber}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '14px' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 6 }}>Contract Amount</div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(primaryInvoice.amount)}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '14px' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 6 }}>Settled Payment</div>
                        <div style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(primaryInvoice.paidAmount)}</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '14px' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: 6 }}>Payment Status</div>
                        <span className={`badge ${STATUS_CONFIG[primaryInvoice.status]?.cls || 'badge-neutral'}`}>
                          {STATUS_CONFIG[primaryInvoice.status]?.label || primaryInvoice.status}
                        </span>
                      </div>
                    </div>

                    {/* Payment Progress */}
                    <div>
                      <div className="progress-label" style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Collected: {fmt(primaryInvoice.paidAmount)} of {fmt(primaryInvoice.amount)}
                        </span>
                        <span style={{ fontWeight: 700, color: primaryInvoice.paidAmount >= primaryInvoice.amount ? 'var(--success)' : 'var(--warning)' }}>
                          {primaryInvoice.amount > 0 ? Math.round((primaryInvoice.paidAmount / primaryInvoice.amount) * 100) : 0}%
                        </span>
                      </div>
                      <div className="progress-bar-wrap" style={{ height: 8 }}>
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${primaryInvoice.amount > 0 ? Math.round((primaryInvoice.paidAmount / primaryInvoice.amount) * 100) : 0}%`,
                            background: primaryInvoice.paidAmount >= primaryInvoice.amount ? 'var(--success)' : 'var(--warning)',
                          }}
                        />
                      </div>
                      {primaryInvoice.status !== 'PAID' && (
                        <div style={{ marginTop: 10, fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <HiOutlineExclamationCircle style={{ color: 'var(--warning)' }} />
                          Outstanding Balance: <strong style={{ color: 'var(--warning)' }}>{fmt(primaryInvoice.amount - primaryInvoice.paidAmount)}</strong>
                          {primaryInvoice.dueDate && ` — Due by ${new Date(primaryInvoice.dueDate).toLocaleDateString()}`}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
