import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { workersAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  HiOutlineMagnifyingGlass,
  HiOutlineEye,
  HiOutlineArrowPath,
  HiOutlineTrash,
  HiOutlinePlus,
  HiOutlineWrenchScrewdriver,
  HiOutlineShieldCheck,
} from 'react-icons/hi2';

export default function WorkersPage() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    position: '',
    skills: '',
  });

  const navigate = useNavigate();

  useEffect(() => { loadWorkers(); }, [search]);

  const loadWorkers = async () => {
    try {
      const res = await workersAPI.list({ search: search || undefined });
      setWorkers(res.data);
    } catch (err) {
      toast.error('Failed to load workers.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddWorker = async (e) => {
    e.preventDefault();
    try {
      await workersAPI.create(form);
      toast.success('Worker added successfully!');
      setShowAddModal(false);
      setForm({ fullName: '', email: '', password: '', phone: '', position: '', skills: '' });
      loadWorkers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create worker.');
    }
  };

  const toggleStatus = async (w) => {
    const newStatus = w.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await workersAPI.updateStatus(w.id, newStatus);
      toast.success(`Worker ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
      loadWorkers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status.');
    }
  };

  const handleDelete = async (w) => {
    if (!window.confirm(`Are you sure you want to delete worker "${w.user.fullName}"? This will unassign their tasks and remove their profile.`)) {
      return;
    }
    try {
      await workersAPI.delete(w.id);
      toast.success('Worker deleted successfully.');
      loadWorkers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete worker.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Workforce & Workers</h1>
          <p>Deploy field workers for {user?.companyName || user?.company?.name || 'your company'}, manage skillsets, and track project tasks</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <HiOutlinePlus /> Add Worker
        </button>
      </div>

      <div className="filters-bar">
        <div className="search-bar">
          <HiOutlineMagnifyingGlass className="search-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Search workers by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : workers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><HiOutlineWrenchScrewdriver /></div>
          <h3>No workers found</h3>
          <p>Add your first worker to start assigning projects and tasks.</p>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <HiOutlinePlus /> Add Worker
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Position</th>
                <th>Skills</th>
                <th>Projects</th>
                <th>Tasks</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((w) => (
                <tr key={w.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{w.user.fullName}</td>
                  <td>{w.user.email}</td>
                  <td>{w.position || '—'}</td>
                  <td>
                    <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                      {(w.skills || []).slice(0, 2).map((s, i) => (
                        <span key={i} className="badge badge-neutral">{s}</span>
                      ))}
                      {(w.skills || []).length > 2 && <span className="badge badge-neutral">+{w.skills.length - 2}</span>}
                      {(!w.skills || w.skills.length === 0) && '—'}
                    </div>
                  </td>
                  <td>{w.assignments?.length || 0}</td>
                  <td>{w._count?.tasks || 0}</td>
                  <td>
                    <span className={`badge ${w.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                      {w.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/workforce/workers/${w.id}`)} title="View Details">
                        <HiOutlineEye />
                      </button>
                      <button
                        className={`btn btn-sm ${w.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => toggleStatus(w)}
                        title={w.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      >
                        <HiOutlineArrowPath />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(w)}
                        title="Delete Worker"
                        style={{ color: '#ef4444' }}
                      >
                        <HiOutlineTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Worker Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Worker"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddWorker}>Create Worker</button>
          </>
        }
      >
        <div style={{
          padding: '10px 14px',
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '0.82rem',
          color: '#cbd5e1',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <HiOutlineShieldCheck style={{ color: '#818cf8', fontSize: '1.2rem', flexShrink: 0 }} />
          <span>
            This worker will be permanently bound to <strong>{user?.companyName || user?.company?.name || 'your company'}</strong>. They will only see tasks and projects within your organization.
          </span>
        </div>

        <form onSubmit={handleAddWorker}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              className="form-input"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="e.g. John Miller"
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input
                type="email"
                className="form-input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="worker@domain.com"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (555) 019-2832"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Initial Password *</label>
            <input
              type="password"
              className="form-input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min 6 characters"
              required
              minLength={6}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Position / Trade Title</label>
              <input
                className="form-input"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="e.g. Master Electrician"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Skills (comma-separated)</label>
              <input
                className="form-input"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                placeholder="e.g. Wiring, HVAC, Safety"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
