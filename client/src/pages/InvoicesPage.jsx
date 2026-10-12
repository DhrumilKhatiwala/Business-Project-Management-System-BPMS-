import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoicesAPI, projectsAPI, usersAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  HiOutlineDocumentText, HiOutlinePlus, HiOutlineMagnifyingGlass,
  HiOutlineCheckCircle, HiOutlineClock, HiOutlineExclamationCircle,
  HiOutlineEye, HiOutlineCurrencyDollar, HiOutlineArrowDownTray,
  HiOutlineTrash
} from 'react-icons/hi2';

const STATUS_CONFIG = {
  PAID:           { label: 'Paid',           cls: 'badge-success', icon: <HiOutlineCheckCircle /> },
  PARTIALLY_PAID: { label: 'Partial',        cls: 'badge-info',    icon: <HiOutlineClock /> },
  PENDING:        { label: 'Pending',         cls: 'badge-warning', icon: <HiOutlineClock /> },
  OVERDUE:        { label: 'Overdue',         cls: 'badge-danger',  icon: <HiOutlineExclamationCircle /> },
  CANCELLED:      { label: 'Cancelled',       cls: 'badge-neutral', icon: <HiOutlineExclamationCircle /> },
};

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState({ totalInvoiced: 0, totalCollected: 0, totalPending: 0, overdueCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dropdown lists for creation
  const [availableProjects, setAvailableProjects] = useState([]);
  const [availableClients, setAvailableClients] = useState([]);

  // Modals
  const [selected, setSelected] = useState(null);        // detail modal
  const [payModal, setPayModal] = useState(null);        // record payment modal
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
  const [payRef, setPayRef] = useState('');
  const [payNote, setPayNote] = useState('');
  const [paying, setPaying] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    invoiceNumber: '', projectId: '', clientId: '',
    amount: '', dueDate: '', notes: '',
  });

  useEffect(() => {
    loadInvoices();
    loadStats();
  }, [search, statusFilter]);

  useEffect(() => {
    // Preload projects and clients for creation form
    projectsAPI.list().then(res => setAvailableProjects(res.data || [])).catch(() => {});
    usersAPI.list({ role: 'CLIENT' }).then(res => setAvailableClients(res.data?.users || [])).catch(() => {});
  }, []);

  const loadInvoices = async () => {
    try {
      const res = await invoicesAPI.list({
        search: search || undefined,
        status: statusFilter || undefined,
      });
      setInvoices(res.data || []);
    } catch (err) {
      toast.error('Failed to load invoices from database.');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await invoicesAPI.getOverviewStats();
      setStats(res.data || {});
    } catch (err) {
      console.error('Stats error:', err);
    }
  };

  // ── Record Payment ───────────────────────────────────────────────────────
  const handlePaySubmit = async () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount.'); return; }
    const remaining = (payModal.amount || 0) - (payModal.paidAmount || 0);
    if (amt > remaining) {
      toast.error(`Cannot exceed remaining balance of ${fmt(remaining)}`);
      return;
    }

    setPaying(true);
    try {
      await invoicesAPI.recordPayment(payModal.id, {
        amount: amt,
        paymentMethod: payMethod,
        reference: payRef || undefined,
        notes: payNote || undefined,
      });
      toast.success(`Payment of ${fmt(amt)} recorded in database!`);
      setPayModal(null);
      setPayAmount('');
      setPayRef('');
      setPayNote('');
      loadInvoices();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to record payment.');
    } finally {
      setPaying(false);
    }
  };

  // ── Create Invoice ───────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.projectId || !form.amount) {
      toast.error('Project and Amount are required.'); return;
    }

    setCreating(true);
    try {
      await invoicesAPI.create({
        invoiceNumber: form.invoiceNumber || undefined,
        projectId: form.projectId,
        clientId: form.clientId || undefined,
        amount: parseFloat(form.amount),
        dueDate: form.dueDate || undefined,
        notes: form.notes || undefined,
      });
      toast.success('Invoice created in database!');
      setShowCreate(false);
      setForm({ invoiceNumber: '', projectId: '', clientId: '', amount: '', dueDate: '', notes: '' });
      loadInvoices();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create invoice.');
    } finally {
      setCreating(false);
    }
  };

  // ── Delete Invoice ───────────────────────────────────────────────────────
  const handleDelete = async (id, invNum) => {
    if (!window.confirm(`Delete invoice ${invNum}? This cannot be undone.`)) return;
    try {
      await invoicesAPI.delete(id);
      toast.success(`Invoice ${invNum} deleted.`);
      loadInvoices();
      loadStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete invoice.');
    }
  };

  return (
    <div>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1>Invoices &amp; Payments</h1>
          <p>Real-time financial cockpit, billing, and MongoDB payment records</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <HiOutlinePlus /> New Invoice
        </button>
      </div>

      {/* ── KPI Stats ── */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon blue"><HiOutlineCurrencyDollar /></div>
          <div className="stat-value">{fmt(stats.totalInvoiced)}</div>
          <div className="stat-label">Total Invoiced</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><HiOutlineCheckCircle /></div>
          <div className="stat-value">{fmt(stats.totalCollected)}</div>
          <div className="stat-label">Total Collected</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><HiOutlineClock /></div>
          <div className="stat-value">{fmt(stats.totalPending)}</div>
          <div className="stat-label">Pending Receivables</div>
        </div>
        <div className="stat-card" style={stats.overdueCount > 0 ? { borderColor: 'rgba(239,68,68,0.4)' } : {}}>
          <div className="stat-icon red"><HiOutlineExclamationCircle /></div>
          <div className="stat-value" style={stats.overdueCount > 0 ? { color: 'var(--danger)' } : {}}>{stats.overdueCount || 0}</div>
          <div className="stat-label">Overdue Invoices</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="filters-bar">
        <div className="search-bar">
          <HiOutlineMagnifyingGlass className="search-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Search by invoice #, project, client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>
        <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="PAID">Paid</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PENDING">Pending</option>
          <option value="OVERDUE">Overdue</option>
        </select>
      </div>

      {/* ── Invoice Table ── */}
      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : invoices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><HiOutlineDocumentText /></div>
          <h3>No invoices in database</h3>
          <p>Create your first invoice to generate billing for clients.</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <HiOutlinePlus /> New Invoice
          </button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Project</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Collected</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.PENDING;
                  const pct = inv.amount > 0 ? Math.round((inv.paidAmount / inv.amount) * 100) : 0;
                  const isOverdue = inv.status === 'OVERDUE';
                  return (
                    <tr key={inv.id} style={isOverdue ? { background: 'rgba(239,68,68,0.04)' } : {}}>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                          {inv.invoiceNumber}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: 180 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inv.project?.name || '—'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{inv.client?.fullName || '—'}</td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(inv.amount)}</td>
                      <td>
                        <div style={{ fontSize: '0.82rem' }}>
                          <span style={{ color: inv.paidAmount >= inv.amount ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                            {fmt(inv.paidAmount)}
                          </span>
                          <div className="progress-bar-wrap" style={{ height: 4, marginTop: 4 }}>
                            <div className="progress-bar-fill" style={{ width: `${pct}%`, background: inv.paidAmount >= inv.amount ? 'var(--success)' : 'var(--warning)' }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ color: isOverdue ? 'var(--danger)' : 'var(--text-tertiary)', fontSize: '0.85rem', fontWeight: isOverdue ? 600 : 400 }}>
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}
                      </td>
                      <td>
                        <span className={`badge ${cfg.cls}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="flex gap-8 justify-end">
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            onClick={() => setSelected(inv)}
                          >
                            <HiOutlineEye /> View
                          </button>
                          {inv.status !== 'PAID' && (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                              onClick={() => { setPayModal(inv); setPayAmount(''); }}
                            >
                              <HiOutlineCurrencyDollar /> Pay
                            </button>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}
                            onClick={() => handleDelete(inv.id, inv.invoiceNumber)}
                            title="Delete invoice"
                          >
                            <HiOutlineTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Invoice Detail Modal ── */}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Invoice: ${selected.invoiceNumber}` : ''}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            <button className="btn btn-primary" onClick={() => { toast.success('PDF export prepared!'); }}>
              <HiOutlineArrowDownTray /> Export PDF
            </button>
          </>
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Header Info */}
            <div className="grid-2-col" style={{ gap: 12, fontSize: '0.88rem' }}>
              <div>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>Project</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selected.project?.name || '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>Client</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selected.client?.fullName || '—'}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>Issue Date</div>
                <div style={{ color: 'var(--text-primary)' }}>{new Date(selected.issuedDate).toLocaleDateString()}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)', marginBottom: 4 }}>Due Date</div>
                <div style={{ color: selected.status === 'OVERDUE' ? 'var(--danger)' : 'var(--text-primary)', fontWeight: selected.status === 'OVERDUE' ? 700 : 400 }}>
                  {selected.dueDate ? new Date(selected.dueDate).toLocaleDateString() : '—'}
                </div>
              </div>
            </div>

            {/* Line Items */}
            {selected.items && selected.items.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--text-muted)' }}>Description</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>Qty</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>Unit Price</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-muted)' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{item.description}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>{item.quantity}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmt(item.unitPrice)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {fmt(item.total || (item.quantity * item.unitPrice))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '14px 16px', fontSize: '0.9rem' }}>
              <div className="flex justify-between mb-8">
                <span style={{ color: 'var(--text-tertiary)' }}>Total Amount</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.05rem' }}>{fmt(selected.amount)}</span>
              </div>
              <div className="flex justify-between mb-8">
                <span style={{ color: 'var(--text-tertiary)' }}>Amount Paid</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(selected.paidAmount)}</span>
              </div>
              <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Balance Due</span>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: selected.amount - selected.paidAmount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  {fmt(selected.amount - selected.paidAmount)}
                </span>
              </div>
            </div>

            {/* Payment History if any */}
            {selected.payments && selected.payments.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Payment Audit Log</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {selected.payments.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
                      <span>{new Date(p.paymentDate).toLocaleDateString()} • {p.paymentMethod} {p.reference ? `(${p.reference})` : ''}</span>
                      <strong style={{ color: 'var(--success)' }}>+{fmt(p.amount)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.notes && (
              <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '10px 14px' }}>
                📝 {selected.notes}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Record Payment Modal ── */}
      <Modal
        isOpen={!!payModal}
        onClose={() => setPayModal(null)}
        title={payModal ? `Record Payment — ${payModal.invoiceNumber}` : ''}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPayModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handlePaySubmit} disabled={paying}>
              <HiOutlineCheckCircle /> {paying ? 'Recording...' : 'Confirm Payment'}
            </button>
          </>
        }
      >
        {payModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '14px 16px', fontSize: '0.88rem' }}>
              <div className="flex justify-between mb-8">
                <span style={{ color: 'var(--text-tertiary)' }}>Invoice Total</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(payModal.amount)}</span>
              </div>
              <div className="flex justify-between mb-8">
                <span style={{ color: 'var(--text-tertiary)' }}>Already Paid</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>{fmt(payModal.paidAmount)}</span>
              </div>
              <div className="flex justify-between" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Remaining</span>
                <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{fmt(payModal.amount - payModal.paidAmount)}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Amount (₹) *</label>
              <input
                type="number"
                className="form-input"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
                placeholder="Enter amount received"
                min={1}
                max={payModal.amount - payModal.paidAmount}
                autoFocus
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select className="form-select" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                  <option value="ONLINE">Online / UPI</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Transaction Reference #</label>
                <input
                  type="text"
                  className="form-input"
                  value={payRef}
                  onChange={e => setPayRef(e.target.value)}
                  placeholder="e.g. TXN-129384"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Note</label>
              <input
                type="text"
                className="form-input"
                value={payNote}
                onChange={e => setPayNote(e.target.value)}
                placeholder="e.g. Received via verified account"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create Invoice Modal ── */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New Invoice"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
              <HiOutlinePlus /> {creating ? 'Saving...' : 'Create Invoice'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Invoice Number (Auto if blank)</label>
              <input className="form-input" placeholder="e.g. INV-2026-004" value={form.invoiceNumber}
                onChange={e => setForm({ ...form, invoiceNumber: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Total Amount (₹) *</label>
              <input type="number" className="form-input" placeholder="100000" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Select Project *</label>
            <select
              className="form-select"
              value={form.projectId}
              onChange={e => setForm({ ...form, projectId: e.target.value })}
              required
            >
              <option value="">Select a project...</option>
              {availableProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.status})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Client (Optional)</label>
            <select
              className="form-select"
              value={form.clientId}
              onChange={e => setForm({ ...form, clientId: e.target.value })}
            >
              <option value="">Inherit from project / Select client...</option>
              {availableClients.map(c => (
                <option key={c.id} value={c.id}>{c.fullName} ({c.email})</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Due Date</label>
            <input type="date" className="form-input" value={form.dueDate}
              onChange={e => setForm({ ...form, dueDate: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={2} placeholder="Payment terms, milestone references..." value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
