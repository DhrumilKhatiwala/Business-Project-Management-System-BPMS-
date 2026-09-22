import { useState, useEffect } from 'react';
import { workersAPI, tasksAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function MyTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => { loadTasks(); }, [statusFilter]);

  const loadTasks = async () => {
    try {
      const res = await workersAPI.getMyTasks({ status: statusFilter || undefined });
      setTasks(res.data);
    } catch (err) {
      toast.error('Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (taskId, status) => {
    try {
      await tasksAPI.update(taskId, { status });
      toast.success('Task status updated!');
      loadTasks();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update.');
    }
  };

  const priorityBadge = (p) => {
    const map = { LOW: 'badge-neutral', MEDIUM: 'badge-info', HIGH: 'badge-warning', URGENT: 'badge-danger' };
    return <span className={`badge ${map[p] || 'badge-neutral'}`}>{p}</span>;
  };

  const statusBadge = (s) => {
    const map = { PENDING: 'badge-warning', IN_PROGRESS: 'badge-info', COMPLETED: 'badge-success' };
    return <span className={`badge ${map[s] || 'badge-neutral'}`}>{s.replace('_', ' ')}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My Tasks</h1>
          <p>View and manage your assigned tasks</p>
        </div>
      </div>

      <div className="filters-bar">
        <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : tasks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No tasks assigned</h3>
          <p>You don't have any tasks assigned to you yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tasks.map((t) => (
            <div key={t.id} className="card" style={{ padding: 20 }}>
              <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div className="flex items-center gap-12 mb-8">
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{t.title}</span>
                    {priorityBadge(t.priority)}
                  </div>
                  {t.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginBottom: 8 }}>{t.description}</p>}
                  <div className="flex items-center gap-16" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>📁 {t.project?.name || '—'}</span>
                    {t.dueDate && <span>📅 {new Date(t.dueDate).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-12">
                  {statusBadge(t.status)}
                  <select
                    className="form-select"
                    value={t.status}
                    onChange={(e) => updateStatus(t.id, e.target.value)}
                    style={{ width: 'auto', minWidth: 140, padding: '8px 32px 8px 12px', fontSize: '0.85rem' }}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
