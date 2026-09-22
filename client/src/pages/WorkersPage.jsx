import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { workersAPI } from '../services/api';
import toast from 'react-hot-toast';
import { HiOutlineMagnifyingGlass, HiOutlineEye, HiOutlineArrowPath } from 'react-icons/hi2';

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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

  const toggleStatus = async (w) => {
    const newStatus = w.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await workersAPI.updateStatus(w.id, newStatus);
      toast.success(`Worker ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
      loadWorkers();
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Workers</h1>
          <p>Manage your workforce and assignments</p>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-bar">
          <HiOutlineMagnifyingGlass className="search-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Search workers..."
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
          <div className="empty-icon">👷</div>
          <h3>No workers found</h3>
          <p>Workers are created when you add a user with the Worker role.</p>
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
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/workforce/workers/${w.id}`)} title="View">
                        <HiOutlineEye />
                      </button>
                      <button
                        className={`btn btn-sm ${w.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => toggleStatus(w)}
                      >
                        <HiOutlineArrowPath />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
