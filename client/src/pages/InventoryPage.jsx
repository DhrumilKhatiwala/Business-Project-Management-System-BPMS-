import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { materialsAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus, HiOutlineMagnifyingGlass, HiOutlineEye,
  HiOutlinePencil, HiOutlineTrash, HiOutlineCube, HiOutlineArrowPath
} from 'react-icons/hi2';

export default function InventoryPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editMaterial, setEditMaterial] = useState(null);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '', description: '', category: '', unit: 'pcs', quantity: 0,
    minStockLevel: 10, costPerUnit: 0, supplier: '',
  });

  useEffect(() => { loadMaterials(); }, [search, categoryFilter]);

  const loadMaterials = async () => {
    try {
      const res = await materialsAPI.list({ search: search || undefined, category: categoryFilter || undefined });
      setMaterials(res.data);
    } catch (err) {
      toast.error('Failed to load materials.');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditMaterial(null);
    setForm({ name: '', description: '', category: '', unit: 'pcs', quantity: 0, minStockLevel: 10, costPerUnit: 0, supplier: '' });
    setShowModal(true);
  };

  const openEdit = (m) => {
    setEditMaterial(m);
    setForm({
      name: m.name,
      description: m.description || '',
      category: m.category || '',
      unit: m.unit,
      quantity: m.quantity,
      minStockLevel: m.minStockLevel,
      costPerUnit: m.costPerUnit,
      supplier: m.supplier || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    try {
      const data = {
        ...form,
        quantity: Number(form.quantity),
        minStockLevel: Number(form.minStockLevel),
        costPerUnit: Number(form.costPerUnit)
      };
      if (editMaterial) {
        const { quantity, ...updateData } = data;
        await materialsAPI.update(editMaterial.id, updateData);
        toast.success('Material updated!');
      } else {
        await materialsAPI.create(data);
        toast.success('Material created!');
      }
      setShowModal(false);
      loadMaterials();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save material.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this material?')) return;
    try {
      await materialsAPI.delete(id);
      toast.success('Material deleted.');
      loadMaterials();
    } catch (err) {
      toast.error('Failed to delete.');
    }
  };

  const availBadge = (a) => {
    const map = {
      IN_STOCK: { cls: 'badge-success', label: 'In Stock' },
      LOW_STOCK: { cls: 'badge-warning', label: 'Low Stock' },
      OUT_OF_STOCK: { cls: 'badge-danger', label: 'Out of Stock' }
    };
    const item = map[a] || { cls: 'badge-neutral', label: a };
    return <span className={`badge ${item.cls}`}>{item.label}</span>;
  };

  const categories = [...new Set(materials.filter(m => m.category).map(m => m.category))];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inventory & Materials</h1>
          <p>Track warehouse stock levels, unit costs, and automated replenishment thresholds</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <HiOutlinePlus /> Add New Material
        </button>
      </div>

      {/* ── Quick KPI Counters ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-value">{materials.length}</div>
          <div className="stat-label">Catalog Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {materials.filter(m => m.availability === 'IN_STOCK').length}
          </div>
          <div className="stat-label">Adequate Stock</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {materials.filter(m => m.availability === 'LOW_STOCK').length}
          </div>
          <div className="stat-label">Below Safety Level</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {materials.filter(m => m.availability === 'OUT_OF_STOCK').length}
          </div>
          <div className="stat-label">Depleted / Stockout</div>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="filters-bar" style={{ marginTop: 20 }}>
        <div className="search-bar">
          <HiOutlineMagnifyingGlass className="search-icon" />
          <input
            type="text"
            className="form-input"
            placeholder="Search materials by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 40 }}
          />
        </div>
        {categories.length > 0 && (
          <select
            className="form-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ minWidth: 180 }}
          >
            <option value="">All Categories ({categories.length})</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : materials.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><HiOutlineCube /></div>
          <h3>No materials match criteria</h3>
          <p>Try adjusting your search query or category filter.</p>
          <button className="btn btn-primary" onClick={openCreate} style={{ marginTop: 12 }}>
            <HiOutlinePlus /> Add Material
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Material Details</th>
                <th>Category</th>
                <th>Stock Level & Gauge</th>
                <th>Safety Threshold</th>
                <th>Unit Cost</th>
                <th>Availability</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const targetCapacity = Math.max(m.minStockLevel * 2, m.quantity, 20);
                const percent = Math.min(100, Math.round((m.quantity / targetCapacity) * 100));
                const meterClass = m.quantity === 0 ? 'out-stock' : m.quantity <= m.minStockLevel ? 'low-stock' : 'in-stock';

                return (
                  <tr key={m.id}>
                    <td>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{m.name}</div>
                      {m.supplier && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                          Supplier: {m.supplier}
                        </div>
                      )}
                    </td>
                    <td><span className="badge badge-neutral">{m.category || 'General'}</span></td>
                    <td>
                      <div className="stock-meter-wrap">
                        <span style={{ fontWeight: 700, minWidth: 50 }}>{m.quantity} {m.unit}</span>
                        <div className="stock-meter-bar">
                          <div className={`stock-meter-fill ${meterClass}`} style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>{m.minStockLevel} {m.unit}</td>
                    <td>${m.costPerUnit.toFixed(2)}</td>
                    <td>{availBadge(m.availability)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex gap-8 justify-end">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => navigate(`/inventory/materials/${m.id}`)}
                          title="View Details & Adjust Stock"
                        >
                          <HiOutlineEye />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(m)}
                          title="Edit Details"
                        >
                          <HiOutlinePencil />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDelete(m.id)}
                          title="Delete Material"
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
      )}

      {/* ── Add / Edit Material Modal ── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editMaterial ? 'Edit Material Details' : 'Add New Material'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              {editMaterial ? 'Update Details' : 'Create Material'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Material Name *</label>
            <input
              className="form-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Portland Cement (50kg Bag)"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Specification / Description</label>
            <textarea
              className="form-textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Grade, dimensions, or technical notes..."
              rows={2}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Category</label>
              <input
                className="form-input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Masonry & Concrete"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Unit of Measure</label>
              <input
                className="form-input"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                placeholder="e.g. pcs, bags, spools"
              />
            </div>
          </div>
          <div className="form-row">
            {!editMaterial && (
              <div className="form-group">
                <label className="form-label">Opening Stock Quantity</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  min={0}
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Minimum Safety Threshold (Reorder Point)</label>
              <input
                type="number"
                className="form-input"
                value={form.minStockLevel}
                onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })}
                min={0}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cost Per Unit ($)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={form.costPerUnit}
                onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
                min={0}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Supplier</label>
              <input
                className="form-input"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="Supplier name..."
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
