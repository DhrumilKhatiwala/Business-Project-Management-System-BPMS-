import { useState, useEffect } from 'react';
import { alertsAPI, materialsAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  HiOutlineCheckCircle, HiOutlineExclamationTriangle,
  HiOutlinePlusCircle, HiOutlineArrowRight, HiOutlineShieldCheck
} from 'react-icons/hi2';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  // Quick Restock modal state
  const [restockAlert, setRestockAlert] = useState(null);
  const [restockQty, setRestockQty] = useState(25);
  const [restockNote, setRestockNote] = useState('');
  const [restocking, setRestocking] = useState(false);

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
      window.dispatchEvent(new Event('alerts-updated'));
      loadAlerts();
    } catch (err) {
      toast.error('Failed to resolve alert.');
    }
  };

  const openQuickRestock = (alertItem) => {
    setRestockAlert(alertItem);
    const deficit = Math.max(10, (alertItem.minStockLevel - alertItem.currentQuantity) * 2);
    setRestockQty(deficit);
    setRestockNote(`Restock replenishment for ${alertItem.material.name}`);
  };

  const handleRestockSubmit = async (e) => {
    e?.preventDefault();
    if (!restockAlert || restockQty <= 0) return;
    setRestocking(true);
    try {
      await materialsAPI.updateStock(restockAlert.materialId, {
        type: 'ADD',
        quantity: Number(restockQty),
        note: restockNote || 'Quick replenishment from alert dashboard'
      });
      toast.success(`Successfully added ${restockQty} ${restockAlert.material.unit} to inventory!`);
      setRestockAlert(null);
      window.dispatchEvent(new Event('alerts-updated'));
      loadAlerts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update stock.');
    } finally {
      setRestocking(false);
    }
  };

  const activeCount = alerts.filter(a => a.status === 'ACTIVE').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Low-Stock & Safety Alerts</h1>
          <p>Real-time threshold monitoring and 1-click replenishment workflows</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex justify-between items-center mb-24" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button
            className={`tab ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            <span>Active Alerts</span>
            {activeCount > 0 && <span className="nav-badge-pill" style={{ marginLeft: 6 }}>{activeCount}</span>}
          </button>
          <button
            className={`tab ${statusFilter === 'RESOLVED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('RESOLVED')}
          >
            Resolved History
          </button>
          <button
            className={`tab ${statusFilter === '' ? 'active' : ''}`}
            onClick={() => setStatusFilter('')}
          >
            All Alerts
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : alerts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><HiOutlineShieldCheck /></div>
          <h3>Inventory is Healthy</h3>
          <p>{statusFilter === 'ACTIVE' ? 'No active low-stock alerts. All items are safely stocked.' : 'No alerts found in this view.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {alerts.map((a) => {
            const isActive = a.status === 'ACTIVE';
            return (
              <div
                key={a.id}
                className="card"
                style={{
                  padding: 22,
                  borderLeft: `4px solid ${isActive ? 'var(--danger)' : 'var(--success)'}`,
                  background: isActive ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(17, 24, 39, 0.7) 100%)' : 'var(--bg-card)'
                }}
              >
                <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 18 }}>
                  <div>
                    <div className="flex items-center gap-12 mb-8">
                      {isActive ? (
                        <span className="pulse-dot danger" style={{ width: 10, height: 10 }} />
                      ) : (
                        <span className="pulse-dot" style={{ width: 10, height: 10 }} />
                      )}
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                        {a.material.name}
                      </span>
                      <span className={`badge ${isActive ? 'badge-danger' : 'badge-success'}`}>
                        {isActive ? 'REORDER REQUIRED' : 'RESOLVED'}
                      </span>
                      {a.material.category && (
                        <span className="badge badge-neutral">{a.material.category}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontSize: '0.88rem' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>Current On-Hand:</span>
                        <span style={{ color: isActive ? 'var(--danger)' : 'var(--text-primary)', fontWeight: 700 }}>
                          {a.currentQuantity} {a.material.unit}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>Safety Reorder Level:</span>
                        <span style={{ color: 'var(--text-primary)' }}>
                          {a.minStockLevel} {a.material.unit}
                        </span>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 10 }}>
                      Alert Triggered: {new Date(a.createdAt).toLocaleString()}
                      {a.resolvedAt && ` • Restocked & Resolved: ${new Date(a.resolvedAt).toLocaleString()}`}
                    </p>
                  </div>

                  {isActive && (
                    <div className="flex gap-10 items-center">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openQuickRestock(a)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <HiOutlinePlusCircle />
                        <span>Quick Restock</span>
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => resolveAlert(a.id)}
                        title="Mark alert as manually resolved"
                      >
                        <HiOutlineCheckCircle />
                        <span>Acknowledge</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Quick Restock Modal ── */}
      <Modal
        isOpen={!!restockAlert}
        onClose={() => setRestockAlert(null)}
        title={`Quick Restock: ${restockAlert?.material?.name || ''}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRestockAlert(null)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleRestockSubmit}
              disabled={restocking || restockQty <= 0}
            >
              {restocking ? 'Adding Stock...' : `Add +${restockQty} ${restockAlert?.material?.unit || 'units'}`}
            </button>
          </>
        }
      >
        {restockAlert && (
          <div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: 16,
              fontSize: '0.85rem'
            }}>
              <div className="flex justify-between mb-4">
                <span style={{ color: 'var(--text-secondary)' }}>Current Stock:</span>
                <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                  {restockAlert.currentQuantity} {restockAlert.material.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Target Reorder Point:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {restockAlert.minStockLevel} {restockAlert.material.unit}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Replenishment Quantity ({restockAlert.material.unit}) *</label>
              <input
                type="number"
                className="form-input"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                min={1}
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Transaction Audit Note</label>
              <input
                type="text"
                className="form-input"
                value={restockNote}
                onChange={(e) => setRestockNote(e.target.value)}
                placeholder="e.g. Received emergency restock delivery"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
