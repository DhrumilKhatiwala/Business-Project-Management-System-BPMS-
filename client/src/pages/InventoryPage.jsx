import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { materialsAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineMagnifyingGlass, HiOutlineEye, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi2';

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
    setForm({ name: m.name, description: m.description || '', category: m.category || '', unit: m.unit, quantity: m.quantity, minStockLevel: m.minStockLevel, costPerUnit: m.costPerUnit, supplier: m.supplier || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    try {
      const data = { ...form, quantity: Number(form.quantity), minStockLevel: Number(form.minStockLevel), costPerUnit: Number(form.costPerUnit) };
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
      toast.error(err.response?.data?.error || 'Failed.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this material?')) return;
    try {
      await materialsAPI.delete(id);
      toast.success('Material deleted.');
      loadMaterials();
    } catch (err) {
      toast.error('Failed to delete.');
    }
  };

  const availBadge = (a) => {
    const map = { IN_STOCK: 'badge-success', LOW_STOCK: 'badge-warning', OUT_OF_STOCK: 'badge-danger' };
    return <span className={`badge ${map[a] || 'badge-neutral'}`}>{a.replace(/_/g, ' ')}</span>;
  };

  const categories = [...new Set(materials.filter(m => m.category).map(m => m.category))];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inventory</h1>
          <p>Manage materials and stock levels</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}><HiOutlinePlus /> Add Material</button>
      </div>

      {/* Quick Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-value">{materials.length}</div>
          <div className="stat-label">Total Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green" style={{ display: 'none' }}></div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{materials.filter(m => m.availability === 'IN_STOCK').length}</div>
          <div className="stat-label">In Stock</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{materials.filter(m => m.availability === 'LOW_STOCK').length}</div>
          <div className="stat-label">Low Stock</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{materials.filter(m => m.availability === 'OUT_OF_STOCK').length}</div>
          <div className="stat-label">Out of Stock</div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-bar">
          <HiOutlineMagnifyingGlass className="search-icon" />
          <input type="text" className="form-input" placeholder="Search materials..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 40 }} />
        </div>
        {categories.length > 0 && (
          <select className="form-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : materials.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📦</div><h3>No materials found</h3><p>Add your first material to get started.</p><button className="btn btn-primary" onClick={openCreate}><HiOutlinePlus /> Add Material</button></div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Min Level</th>
                <th>Cost/Unit</th>
                <th>Availability</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</td>
                  <td>{m.category || '—'}</td>
                  <td><span style={{ fontWeight: 600 }}>{m.quantity}</span> {m.unit}</td>
                  <td>{m.minStockLevel} {m.unit}</td>
                  <td>${m.costPerUnit.toFixed(2)}</td>
                  <td>{availBadge(m.availability)}</td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/inventory/materials/${m.id}`)} title="View"><HiOutlineEye /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(m)} title="Edit"><HiOutlinePencil /></button>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(m.id)} title="Delete"><HiOutlineTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editMaterial ? 'Edit Material' : 'Add Material'}
        footer={<><button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleSubmit}>{editMaterial ? 'Update' : 'Create'}</button></>}>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Category</label><input className="form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g., Building Materials" /></div>
            <div className="form-group"><label className="form-label">Unit</label><input className="form-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g., kg, pcs, m" /></div>
          </div>
          <div className="form-row">
            {!editMaterial && (
              <div className="form-group"><label className="form-label">Initial Quantity</label><input type="number" className="form-input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} min={0} /></div>
            )}
            <div className="form-group"><label className="form-label">Min Stock Level</label><input type="number" className="form-input" value={form.minStockLevel} onChange={(e) => setForm({ ...form, minStockLevel: e.target.value })} min={0} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Cost Per Unit ($)</label><input type="number" step="0.01" className="form-input" value={form.costPerUnit} onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })} min={0} /></div>
            <div className="form-group"><label className="form-label">Supplier</label><input className="form-input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
