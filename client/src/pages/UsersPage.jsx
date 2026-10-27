import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus,
  HiOutlineMagnifyingGlass,
  HiOutlinePencil,
  HiOutlineArrowPath,
  HiOutlineTrash,
  HiOutlineUsers,
  HiOutlineShieldCheck,
  HiOutlinePhone,
  HiOutlineEnvelope,
} from 'react-icons/hi2';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const defaultRole = currentUser?.role === 'ADMIN' ? 'BUSINESS_OWNER' : 'WORKER';
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: defaultRole,
    phone: '',
    position: '',
    skills: '',
    companyName: '',
  });

  useEffect(() => { loadUsers(); }, [search, roleFilter]);

  const loadUsers = async () => {
    try {
      const res = await usersAPI.list({ search, role: roleFilter || undefined });
      setUsers(res.data.users);
    } catch (err) {
      toast.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditUser(null);
    setForm({
      fullName: '',
      email: '',
      password: '',
      role: defaultRole,
      phone: '',
      position: '',
      skills: '',
      companyName: '',
    });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({
      fullName: u.fullName,
      email: u.email,
      password: '',
      role: u.role,
      phone: u.phone || '',
      position: '',
      skills: '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editUser) {
        const data = { ...form };
        if (!data.password) delete data.password;
        delete data.position;
        delete data.skills;
        await usersAPI.update(editUser.id, data);
        toast.success('User updated!');
      } else {
        await usersAPI.create(form);
        toast.success(
          form.role === 'BUSINESS_OWNER'
            ? 'Business Owner created!'
            : form.role === 'WORKER'
            ? 'Worker created successfully!'
            : 'Client created successfully!'
        );
      }
      setShowModal(false);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed.');
    }
  };

  const toggleStatus = async (u) => {
    const newStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await usersAPI.updateStatus(u.id, newStatus);
      toast.success(`User ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}.`);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status.');
    }
  };

  const handleDelete = async (u) => {
    const confirmMsg = isAdmin
      ? `Are you sure you want to delete Business Owner "${u.fullName}"? This will permanently remove their account and all associated projects.`
      : `Are you sure you want to delete ${u.role === 'WORKER' ? 'Worker' : 'Client'} "${u.fullName}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await usersAPI.delete(u.id);
      toast.success(`${u.role.replace('_', ' ')} deleted successfully.`);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user.');
    }
  };

  const roleBadge = (role) => {
    const map = {
      ADMIN: 'badge-danger',
      BUSINESS_OWNER: 'badge-purple',
      WORKER: 'badge-info',
      CLIENT: 'badge-success',
    };
    return <span className={`badge ${map[role] || 'badge-neutral'}`}>{role.replace('_', ' ')}</span>;
  };

  const isAdmin = currentUser?.role === 'ADMIN';
  const isOwner = currentUser?.role === 'BUSINESS_OWNER';
  const isStaffOrClient = !isAdmin && !isOwner;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>
            {isAdmin ? 'Business Owners Management' : isOwner ? 'Clients & Users Management' : 'My Business Owner'}
          </h1>
          <p>
            {isAdmin
              ? 'System Administrator View — Create, manage, and delete Business Owner accounts'
              : isOwner
              ? 'Manage Client and Worker accounts for your business operations'
              : 'Contact details for your business manager & owner'}
          </p>
        </div>
        {(isAdmin || isOwner) && (
          <button className="btn btn-primary" onClick={openCreate}>
            <HiOutlinePlus /> {isAdmin ? 'Add Business Owner' : 'Add User'}
          </button>
        )}
      </div>

      {!isStaffOrClient && (
        <div className="filters-bar">
          <div className="search-bar">
            <HiOutlineMagnifyingGlass className="search-icon" />
            <input
              type="text"
              className="form-input"
              placeholder={isAdmin ? 'Search business owners...' : 'Search clients & workers...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 40 }}
            />
          </div>
          {isOwner && (
            <select className="form-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">All Roles (Clients & Workers)</option>
              <option value="WORKER">Workers</option>
              <option value="CLIENT">Clients</option>
            </select>
          )}
        </div>
      )}

      {loading ? (
        <div className="loading-container"><div className="spinner" /></div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><HiOutlineUsers /></div>
          <h3>{isAdmin ? 'No Business Owners Found' : 'No Users Found'}</h3>
          <p>{isAdmin ? 'Add a Business Owner account to get started.' : 'Add your first Client or Worker user.'}</p>
          {(isAdmin || isOwner) && (
            <button className="btn btn-primary" onClick={openCreate}><HiOutlinePlus /> Add User</button>
          )}
        </div>
      ) : isStaffOrClient ? (
        <div style={{ maxWidth: 640 }}>
          {users.slice(0, 1).map((u) => (
            <div key={u.id} className="card" style={{ padding: '28px', display: 'flex', gap: '20px', alignItems: 'center', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  color: '#fff',
                }}
              >
                {u.fullName?.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{u.fullName}</h3>
                  <span className="badge badge-purple"><HiOutlineShieldCheck /> Assigned Business Owner</span>
                  <span className="badge badge-success">Verified Permanent Link</span>
                </div>
                {u.ownedCompany?.name && (
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38bdf8', marginBottom: 6 }}>
                    {u.ownedCompany.name}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  <span><HiOutlineEnvelope style={{ verticalAlign: 'middle', marginRight: 6 }} /> {u.email}</span>
                  {u.phone && <span><HiOutlinePhone style={{ verticalAlign: 'middle', marginRight: 6 }} /> {u.phone}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{u.fullName}</td>
                  <td>{u.email}</td>
                  <td>{roleBadge(u.role)}</td>
                  <td>{u.phone || '—'}</td>
                  <td>
                    <span className={`badge ${u.status === 'ACTIVE' ? 'badge-success' : 'badge-danger'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)} title="Edit">
                        <HiOutlinePencil />
                      </button>
                      <button
                        className={`btn btn-sm ${u.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}`}
                        onClick={() => toggleStatus(u)}
                        title={u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      >
                        <HiOutlineArrowPath />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDelete(u)}
                        title="Delete"
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

      {(isAdmin || isOwner) && (
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={editUser ? (isAdmin ? 'Edit Business Owner' : 'Edit User') : (isAdmin ? 'Add Business Owner' : 'Create User')}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                {editUser ? 'Update' : 'Create'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                className="form-input"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. John Doe"
                required
              />
            </div>
            {isAdmin && !editUser && (
              <div className="form-group">
                <label className="form-label">Company / Organization Name</label>
                <input
                  className="form-input"
                  value={form.companyName || ''}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  placeholder="e.g. Acme Construction Co."
                />
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@domain.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  className="form-input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{editUser ? 'New Password (optional)' : 'Password *'}</label>
                <input
                  type="password"
                  className="form-input"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  {...(!editUser && { required: true, minLength: 6 })}
                  placeholder={editUser ? 'Leave blank to keep current' : 'Min 6 characters'}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role *</label>
                <select
                  className="form-select"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  disabled={isAdmin || Boolean(editUser)}
                >
                  {isAdmin ? (
                    <option value="BUSINESS_OWNER">Business Owner</option>
                  ) : (
                    <>
                      <option value="WORKER">Worker</option>
                      <option value="CLIENT">Client</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {!editUser && form.role === 'WORKER' && (
              <div className="form-row" style={{ marginTop: 8, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
                <div className="form-group">
                  <label className="form-label">Worker Position</label>
                  <input
                    className="form-input"
                    value={form.position}
                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                    placeholder="e.g. Senior Site Engineer"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Skills (comma-separated)</label>
                  <input
                    className="form-input"
                    value={form.skills}
                    onChange={(e) => setForm({ ...form, skills: e.target.value })}
                    placeholder="e.g. Electrical, Plumbing, Safety"
                  />
                </div>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
