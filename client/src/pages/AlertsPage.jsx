import { useState, useEffect } from 'react';
import { alertsAPI } from '../services/api';
import toast from 'react-hot-toast';
import { HiOutlineCheckCircle } from 'react-icons/hi2';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  useEffect(() => { loadAlerts(); }, [statusFilter]);

  const loadAlerts = async () => {
    try {
      const res = await alertsAPI.getLowStock({ status: statusFilter || undefined });
      setAlerts(res.data);
    } catch (err) {
      toast.error('Failed to load alerts.');
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (id) => {
    try {
      await alertsAPI.resolve(id);
      toast.success('Alert resolved.');
      loadAlerts();
    } catch (err) {
      toast.error('Failed to resolve alert.');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Low-Stock Alerts</h1>
          <p>Monitor and manage inventory alerts</p>
        </div>
      </div>

      <div className="filters-bar">
        <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          <option value="ACTIVE">Active</option>
          <option value="RESOLVED">Resolved</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : alerts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🔔</div>
          <h3>No alerts</h3>
          <p>{statusFilter === 'ACTIVE' ? 'No active low-stock alerts. All materials are well stocked!' : 'No alerts found.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {alerts.map((a) => (
            <div key={a.id} className="card" style={{ padding: 20, borderLeft: `4px solid ${a.status === 'ACTIVE' ? 'var(--warning)' : 'var(--success)'}` }}>
              <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <div className="flex items-center gap-12 mb-8">
                    <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.05rem' }}>LOW STOCK</span>
                    <span className={`badge ${a.status === 'ACTIVE' ? 'badge-warning' : 'badge-success'}`}>{a.status}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '8px 24px', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>Material:</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500, gridColumn: 'span 2' }}>{a.material.name}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>Current Stock:</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{a.currentQuantity} {a.material.unit}</span>
                    <span></span>
                    <span style={{ color: 'var(--text-tertiary)' }}>Min Level:</span>
                    <span style={{ color: 'var(--text-primary)' }}>{a.minStockLevel} {a.material.unit}</span>
                    <span></span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
                    Created: {new Date(a.createdAt).toLocaleString()}
                    {a.resolvedAt && ` • Resolved: ${new Date(a.resolvedAt).toLocaleString()}`}
                  </p>
                </div>
                {a.status === 'ACTIVE' && (
                  <button className="btn btn-success" onClick={() => resolveAlert(a.id)}>
                    <HiOutlineCheckCircle /> Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
