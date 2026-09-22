import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { materialsAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  HiOutlineArrowLeft, HiOutlinePencil, HiOutlinePlus,
  HiOutlineMinus, HiOutlineExclamationTriangle
} from 'react-icons/hi2';

export default function MaterialDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockForm, setStockForm] = useState({ type: 'ADD', quantity: '', note: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => { loadMaterial(); }, [id]);

  const loadMaterial = async () => {
    try {
      const res = await materialsAPI.get(id);
      setMaterial(res.data);
      setEditForm({
        name: res.data.name, description: res.data.description || '', category: res.data.category || '',
        unit: res.data.unit, minStockLevel: res.data.minStockLevel, costPerUnit: res.data.costPerUnit,
        supplier: res.data.supplier || '',
      });
    } catch (err) {
      toast.error('Failed to load material.');
      navigate('/inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleStockUpdate = async () => {
    const qty = Number(stockForm.quantity);
    if (!qty || qty <= 0) { toast.error('Enter a valid quantity.'); return; }
    try {
      await materialsAPI.updateStock(id, { type: stockForm.type, quantity: qty, note: stockForm.note });
      toast.success(`Stock ${stockForm.type === 'ADD' ? 'added' : 'deducted'} successfully!`);
      setShowStockModal(false);
      setStockForm({ type: 'ADD', quantity: '', note: '' });
      loadMaterial();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Stock update failed.');
    }
  };

  const handleEdit = async () => {
    try {
      await materialsAPI.update(id, { ...editForm, minStockLevel: Number(editForm.minStockLevel), costPerUnit: Number(editForm.costPerUnit) });
      toast.success('Material updated!');
      setShowEditModal(false);
      loadMaterial();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed.');
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!material) return null;

  const availability = material.quantity === 0 ? 'OUT_OF_STOCK' : material.quantity <= material.minStockLevel ? 'LOW_STOCK' : 'IN_STOCK';
  const availClass = { IN_STOCK: 'badge-success', LOW_STOCK: 'badge-warning', OUT_OF_STOCK: 'badge-danger' };

  return (
    <div>
      <div className="detail-header">
        <div className="detail-title">
          <button className="back-btn" onClick={() => navigate('/inventory')}><HiOutlineArrowLeft /></button>
          <div>
            <div className="flex items-center gap-12">
              <h1>{material.name}</h1>
              <span className={`badge ${availClass[availability]}`}>{availability.replace(/_/g, ' ')}</span>
            </div>
            {material.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>{material.description}</p>}
          </div>
        </div>
        <div className="flex gap-12">
          <button className="btn btn-secondary" onClick={() => setShowEditModal(true)}><HiOutlinePencil /> Edit</button>
          <button className="btn btn-primary" onClick={() => setShowStockModal(true)}>Update Stock</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-value">{material.quantity}</div>
          <div className="stat-label">Current Stock ({material.unit})</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{material.minStockLevel}</div>
          <div className="stat-label">Min Level ({material.unit})</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${material.costPerUnit.toFixed(2)}</div>
          <div className="stat-label">Cost / {material.unit}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${(material.quantity * material.costPerUnit).toFixed(2)}</div>
          <div className="stat-label">Total Value</div>
        </div>
      </div>

      {/* Low stock warning */}
      {availability !== 'IN_STOCK' && (
        <div className={`alert ${availability === 'OUT_OF_STOCK' ? 'alert-danger' : 'alert-warning'}`}>
          <HiOutlineExclamationTriangle style={{ fontSize: '1.4rem', flexShrink: 0 }} />
          <div>
            <strong>{availability === 'OUT_OF_STOCK' ? 'Out of Stock!' : 'Low Stock Warning!'}</strong>
            <br />
            Current stock ({material.quantity} {material.unit}) is {availability === 'OUT_OF_STOCK' ? 'empty' : `at or below minimum level (${material.minStockLevel} ${material.unit})`}.
          </div>
        </div>
      )}

      {/* Details */}
      <div className="detail-grid">
        <div className="card">
          <div className="card-header"><h3>Material Details</h3></div>
          <div className="detail-field"><div className="field-label">Category</div><div className="field-value">{material.category || '—'}</div></div>
          <div className="detail-field"><div className="field-label">Unit</div><div className="field-value">{material.unit}</div></div>
          <div className="detail-field"><div className="field-label">Supplier</div><div className="field-value">{material.supplier || '—'}</div></div>
          <div className="detail-field"><div className="field-label">Status</div><div className="field-value"><span className={`badge ${material.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>{material.status}</span></div></div>
          <div className="detail-field"><div className="field-label">Created</div><div className="field-value">{new Date(material.createdAt).toLocaleDateString()}</div></div>
        </div>

        {/* Stock History */}
        <div className="card">
          <div className="card-header"><h3>Recent Stock History</h3></div>
          {(!material.stockUpdates || material.stockUpdates.length === 0) ? (
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No stock updates yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
              {material.stockUpdates.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--glass-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div>
                    <div className="flex items-center gap-8">
                      <span className={`badge ${s.type === 'ADD' ? 'badge-success' : 'badge-danger'}`}>
                        {s.type === 'ADD' ? '+' : '-'}{s.quantity} {material.unit}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.previousQty} → {s.newQty}</span>
                    </div>
                    {s.note && <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{s.note}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.createdBy?.fullName}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(s.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stock Update Modal */}
      <Modal isOpen={showStockModal} onClose={() => setShowStockModal(false)} title="Update Stock" size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setShowStockModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleStockUpdate}>Update</button></>}>
        <div className="form-group">
          <label className="form-label">Operation</label>
          <div className="flex gap-12">
            <button type="button" className={`btn ${stockForm.type === 'ADD' ? 'btn-success' : 'btn-secondary'}`} onClick={() => setStockForm({ ...stockForm, type: 'ADD' })} style={{ flex: 1 }}>
              <HiOutlinePlus /> Add Stock
            </button>
            <button type="button" className={`btn ${stockForm.type === 'DEDUCT' ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setStockForm({ ...stockForm, type: 'DEDUCT' })} style={{ flex: 1 }}>
              <HiOutlineMinus /> Deduct
            </button>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Quantity ({material.unit}) *</label>
          <input type="number" className="form-input" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} min={1} placeholder="Enter quantity" />
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Current: {material.quantity} {material.unit}</p>
        </div>
        <div className="form-group">
          <label className="form-label">Note (optional)</label>
          <input className="form-input" value={stockForm.note} onChange={(e) => setStockForm({ ...stockForm, note: e.target.value })} placeholder="Reason for update" />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Material"
        footer={<><button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleEdit}>Update</button></>}>
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Category</label><input className="form-input" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Unit</label><input className="form-input" value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Min Stock Level</label><input type="number" className="form-input" value={editForm.minStockLevel} onChange={(e) => setEditForm({ ...editForm, minStockLevel: e.target.value })} min={0} /></div>
          <div className="form-group"><label className="form-label">Cost Per Unit ($)</label><input type="number" step="0.01" className="form-input" value={editForm.costPerUnit} onChange={(e) => setEditForm({ ...editForm, costPerUnit: e.target.value })} min={0} /></div>
        </div>
        <div className="form-group"><label className="form-label">Supplier</label><input className="form-input" value={editForm.supplier} onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })} /></div>
      </Modal>
    </div>
  );
}
