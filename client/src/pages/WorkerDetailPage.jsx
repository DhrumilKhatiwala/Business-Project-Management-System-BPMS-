import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workersAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlinePencil } from 'react-icons/hi2';

export default function WorkerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ position: '', skills: '' });

  useEffect(() => { loadWorker(); }, [id]);

  const loadWorker = async () => {
    try {
      const res = await workersAPI.get(id);
      setWorker(res.data);
      setForm({ position: res.data.position || '', skills: (res.data.skills || []).join(', ') });
    } catch (err) {
      toast.error('Failed to load worker.');
      navigate('/workforce/workers');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      await workersAPI.update(id, {
        position: form.position,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      });
      toast.success('Worker updated!');
      setShowEdit(false);
      loadWorker();
    } catch (err) {
      toast.error('Failed to update worker.');
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!worker) return null;

  const statusBadge = (s) => {
    const map = { PENDING: 'badge-warning', IN_PROGRESS: 'badge-info', COMPLETED: 'badge-success', NOT_STARTED: 'badge-neutral', ON_HOLD: 'badge-warning' };
    return <span className={`badge ${map[s] || 'badge-neutral'}`}>{s.replace('_', ' ')}</span>;
  };

  return (
    <div>
      <div className="detail-header">
        <div className="detail-title">
          <button className="back-btn" onClick={() => navigate('/workforce/workers')}><HiOutlineArrowLeft /></button>
          <div>
            <h1>{worker.user.fullName}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{worker.position || 'No position set'}</p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowEdit(true)}><HiOutlinePencil /> Edit</button>
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-header"><h3>Profile Information</h3></div>
          <div className="detail-field">
            <div className="field-label">Email</div>
            <div className="field-value">{worker.user.email}</div>
          </div>
          <div className="detail-field">
            <div className="field-label">Phone</div>
            <div className="field-value">{worker.user.phone || '—'}</div>
          </div>
          <div className="detail-field">
            <div className="field-label">Position</div>
            <div className="field-value">{worker.position || '—'}</div>
          </div>
          <div className="detail-field">
            <div className="field-label">Skills</div>
            <div className="field-value flex gap-8" style={{ flexWrap: 'wrap' }}>
              {(worker.skills || []).map((s, i) => <span key={i} className="badge badge-purple">{s}</span>)}
              {(!worker.skills || worker.skills.length === 0) && '—'}
            </div>
          </div>
          <div className="detail-field">
            <div className="field-label">Status</div>
            <div className="field-value">
              <span className={`badge ${worker.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>{worker.status}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Assigned Projects ({worker.assignments?.length || 0})</h3></div>
          {(!worker.assignments || worker.assignments.length === 0) ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No projects assigned.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {worker.assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between" style={{ padding: '10px 12px', background: 'var(--glass-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer' }} onClick={() => navigate(`/projects/${a.project.id}`)}>
                    {a.project.name}
                  </span>
                  {statusBadge(a.project.status)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {worker.tasks && worker.tasks.length > 0 && (
        <div className="card mt-24">
          <div className="card-header"><h3>Tasks ({worker.tasks.length})</h3></div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead><tr><th>Task</th><th>Project</th><th>Status</th><th>Priority</th><th>Due Date</th></tr></thead>
              <tbody>
                {worker.tasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{t.title}</td>
                    <td>{t.project?.name || '—'}</td>
                    <td>{statusBadge(t.status)}</td>
                    <td><span className={`badge ${t.priority === 'URGENT' ? 'badge-danger' : t.priority === 'HIGH' ? 'badge-warning' : 'badge-neutral'}`}>{t.priority}</span></td>
                    <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Worker"
        footer={<><button className="btn btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button><button className="btn btn-primary" onClick={handleUpdate}>Update</button></>}>
        <div className="form-group">
          <label className="form-label">Position</label>
          <input className="form-input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="e.g., Site Engineer" />
        </div>
        <div className="form-group">
          <label className="form-label">Skills (comma separated)</label>
          <input className="form-input" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="e.g., Welding, Plumbing, Electrical" />
        </div>
      </Modal>
    </div>
  );
}
