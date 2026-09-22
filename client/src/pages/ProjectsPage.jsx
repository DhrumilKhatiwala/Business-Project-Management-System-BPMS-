import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { projectsAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineMagnifyingGlass, HiOutlineEye } from 'react-icons/hi2';

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', startDate: '', endDate: '' });
  const navigate = useNavigate();

  useEffect(() => { loadProjects(); }, [search, statusFilter]);

  const loadProjects = async () => {
    try {
      const res = await projectsAPI.list({ search: search || undefined, status: statusFilter || undefined });
      setProjects(res.data);
    } catch (err) {
      toast.error('Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Project name is required.'); return; }
    try {
      await projectsAPI.create(form);
      toast.success('Project created!');
      setShowModal(false);
      setForm({ name: '', description: '', startDate: '', endDate: '' });
      loadProjects();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create project.');
    }
  };

  const statusBadge = (s) => {
    const map = { NOT_STARTED: 'badge-neutral', IN_PROGRESS: 'badge-info', ON_HOLD: 'badge-warning', COMPLETED: 'badge-success' };
    return <span className={`badge ${map[s] || 'badge-neutral'}`}>{s.replace(/_/g, ' ')}</span>;
  };

  const isOwner = user?.role === 'BUSINESS_OWNER';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p>{isOwner ? 'Create and manage your projects' : 'View your assigned projects'}</p>
        </div>
        {isOwner && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <HiOutlinePlus /> New Project
          </button>
        )}
      </div>

      <div className="filters-bar">
        <div className="search-bar">
          <HiOutlineMagnifyingGlass className="search-icon" />
          <input type="text" className="form-input" placeholder="Search projects..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
        </div>
        <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="NOT_STARTED">Not Started</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="ON_HOLD">On Hold</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <h3>No projects found</h3>
          <p>Create your first project to get started.</p>
          {isOwner && <button className="btn btn-primary" onClick={() => setShowModal(true)}><HiOutlinePlus /> New Project</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {projects.map((p) => (
            <div key={p.id} className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
              <div className="flex items-center justify-between mb-16">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</h3>
                {statusBadge(p.status)}
              </div>
              {p.description && <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginBottom: 16, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>}
              <div className="progress-label">
                <span>Progress</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.progress}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${p.progress}%` }} />
              </div>
              <div className="flex items-center justify-between mt-16" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>{p._count?.tasks || 0} tasks</span>
                <span>{p._count?.milestones || 0} milestones</span>
                <span>{p._count?.assignments || 0} workers</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Project"
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreate}>Create</button></>}>
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input type="date" className="form-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">End Date</label>
              <input type="date" className="form-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
