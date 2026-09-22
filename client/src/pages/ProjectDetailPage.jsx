import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { projectsAPI, tasksAPI, milestonesAPI, workersAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlinePencil, HiOutlinePlus, HiOutlineTrash, HiOutlineUserPlus } from 'react-icons/hi2';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === 'BUSINESS_OWNER';

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('tasks');
  const [workers, setWorkers] = useState([]);

  // Modals
  const [showEditProject, setShowEditProject] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [projectForm, setProjectForm] = useState({});
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assignedToId: '' });
  const [milestoneForm, setMilestoneForm] = useState({ title: '', description: '', dueDate: '' });
  const [selectedWorker, setSelectedWorker] = useState('');

  useEffect(() => { loadProject(); }, [id]);

  const loadProject = async () => {
    try {
      const res = await projectsAPI.get(id);
      setProject(res.data);
      setProjectForm({
        name: res.data.name, description: res.data.description || '', status: res.data.status,
        startDate: res.data.startDate ? res.data.startDate.split('T')[0] : '',
        endDate: res.data.endDate ? res.data.endDate.split('T')[0] : '',
        progress: res.data.progress,
      });
      if (isOwner) {
        const wRes = await workersAPI.list({ status: 'ACTIVE' });
        setWorkers(wRes.data);
      }
    } catch (err) {
      toast.error('Failed to load project.');
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProject = async () => {
    try {
      await projectsAPI.update(id, projectForm);
      toast.success('Project updated!');
      setShowEditProject(false);
      loadProject();
    } catch (err) { toast.error(err.response?.data?.error || 'Update failed.'); }
  };

  const handleCreateTask = async () => {
    if (!taskForm.title.trim()) { toast.error('Task title required.'); return; }
    try {
      if (editingTask) {
        await tasksAPI.update(editingTask.id, taskForm);
        toast.success('Task updated!');
      } else {
        await tasksAPI.create({ ...taskForm, projectId: id, assignedToId: taskForm.assignedToId || null });
        toast.success('Task created!');
      }
      setShowTaskModal(false);
      setEditingTask(null);
      setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assignedToId: '' });
      loadProject();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed.'); }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await tasksAPI.delete(taskId);
      toast.success('Task deleted.');
      loadProject();
    } catch (err) { toast.error('Failed to delete task.'); }
  };

  const handleCreateMilestone = async () => {
    if (!milestoneForm.title.trim()) { toast.error('Title required.'); return; }
    try {
      await milestonesAPI.create({ ...milestoneForm, projectId: id });
      toast.success('Milestone created!');
      setShowMilestoneModal(false);
      setMilestoneForm({ title: '', description: '', dueDate: '' });
      loadProject();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed.'); }
  };

  const handleUpdateMilestone = async (msId, status) => {
    try {
      await milestonesAPI.update(msId, { status });
      toast.success('Milestone updated.');
      loadProject();
    } catch (err) { toast.error('Failed.'); }
  };

  const handleDeleteMilestone = async (msId) => {
    if (!confirm('Delete this milestone?')) return;
    try {
      await milestonesAPI.delete(msId);
      toast.success('Deleted.');
      loadProject();
    } catch (err) { toast.error('Failed.'); }
  };

  const handleAssignWorker = async () => {
    if (!selectedWorker) return;
    try {
      await projectsAPI.addAssignment(id, selectedWorker);
      toast.success('Worker assigned!');
      setShowAssignModal(false);
      setSelectedWorker('');
      loadProject();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed.'); }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    if (!confirm('Remove this worker?')) return;
    try {
      await projectsAPI.removeAssignment(id, assignmentId);
      toast.success('Removed.');
      loadProject();
    } catch (err) { toast.error('Failed.'); }
  };

  const openEditTask = (t) => {
    setEditingTask(t);
    setTaskForm({ title: t.title, description: t.description || '', priority: t.priority, dueDate: t.dueDate ? t.dueDate.split('T')[0] : '', assignedToId: t.assignedToId || '', status: t.status });
    setShowTaskModal(true);
  };

  const statusBadge = (s) => {
    const map = { NOT_STARTED: 'badge-neutral', PENDING: 'badge-warning', IN_PROGRESS: 'badge-info', ON_HOLD: 'badge-warning', COMPLETED: 'badge-success' };
    return <span className={`badge ${map[s] || 'badge-neutral'}`}>{s.replace(/_/g, ' ')}</span>;
  };

  const priorityBadge = (p) => {
    const map = { LOW: 'badge-neutral', MEDIUM: 'badge-info', HIGH: 'badge-warning', URGENT: 'badge-danger' };
    return <span className={`badge ${map[p] || 'badge-neutral'}`}>{p}</span>;
  };

  if (loading) return <div className="loading-container"><div className="spinner" /></div>;
  if (!project) return null;

  const assignedWorkerIds = (project.assignments || []).map(a => a.workerId);
  const availableWorkers = workers.filter(w => !assignedWorkerIds.includes(w.id));
  // All workers including assigned for task assignment
  const allProjectWorkers = workers;

  return (
    <div>
      <div className="detail-header">
        <div className="detail-title">
          <button className="back-btn" onClick={() => navigate('/projects')}><HiOutlineArrowLeft /></button>
          <div>
            <div className="flex items-center gap-12">
              <h1>{project.name}</h1>
              {statusBadge(project.status)}
            </div>
            {project.description && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>{project.description}</p>}
          </div>
        </div>
        {isOwner && <button className="btn btn-secondary" onClick={() => setShowEditProject(true)}><HiOutlinePencil /> Edit</button>}
      </div>

      {/* Progress & Info */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-value">{project.progress}%</div>
          <div className="stat-label">Progress</div>
          <div className="progress-bar mt-8"><div className="progress-fill" style={{ width: `${project.progress}%` }} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{project.tasks?.length || 0}</div>
          <div className="stat-label">Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{project.milestones?.length || 0}</div>
          <div className="stat-label">Milestones</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{project.assignments?.length || 0}</div>
          <div className="stat-label">Workers</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>Tasks</button>
        <button className={`tab ${tab === 'milestones' ? 'active' : ''}`} onClick={() => setTab('milestones')}>Milestones</button>
        <button className={`tab ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>Team</button>
      </div>

      {/* Tasks Tab */}
      {tab === 'tasks' && (
        <div>
          {isOwner && (
            <div className="flex justify-between items-center mb-16">
              <h3 style={{ color: 'var(--text-secondary)' }}>Tasks ({project.tasks?.length || 0})</h3>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditingTask(null); setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assignedToId: '' }); setShowTaskModal(true); }}>
                <HiOutlinePlus /> Add Task
              </button>
            </div>
          )}
          {(!project.tasks || project.tasks.length === 0) ? (
            <div className="empty-state"><div className="empty-icon">📋</div><h3>No tasks yet</h3></div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Task</th><th>Assigned To</th><th>Status</th><th>Priority</th><th>Due Date</th>{isOwner && <th>Actions</th>}</tr></thead>
                <tbody>
                  {project.tasks.map((t) => (
                    <tr key={t.id}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{t.title}</td>
                      <td>{t.assignedTo?.user?.fullName || '—'}</td>
                      <td>{statusBadge(t.status)}</td>
                      <td>{priorityBadge(t.priority)}</td>
                      <td>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}</td>
                      {isOwner && (
                        <td>
                          <div className="flex gap-8">
                            <button className="btn btn-ghost btn-sm" onClick={() => openEditTask(t)}><HiOutlinePencil /></button>
                            <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteTask(t.id)}><HiOutlineTrash /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Milestones Tab */}
      {tab === 'milestones' && (
        <div>
          {isOwner && (
            <div className="flex justify-between items-center mb-16">
              <h3 style={{ color: 'var(--text-secondary)' }}>Milestones ({project.milestones?.length || 0})</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowMilestoneModal(true)}><HiOutlinePlus /> Add Milestone</button>
            </div>
          )}
          {(!project.milestones || project.milestones.length === 0) ? (
            <div className="empty-state"><div className="empty-icon">🏁</div><h3>No milestones yet</h3></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {project.milestones.map((m) => (
                <div key={m.id} className="card" style={{ padding: 16 }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-12">
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{m.title}</span>
                        {statusBadge(m.status)}
                      </div>
                      {m.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{m.description}</p>}
                      {m.dueDate && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Due: {new Date(m.dueDate).toLocaleDateString()}</p>}
                    </div>
                    {isOwner && (
                      <div className="flex gap-8">
                        <select className="form-select" value={m.status} onChange={(e) => handleUpdateMilestone(m.id, e.target.value)} style={{ width: 'auto', minWidth: 120, padding: '6px 30px 6px 10px', fontSize: '0.8rem' }}>
                          <option value="PENDING">Pending</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteMilestone(m.id)}><HiOutlineTrash /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Team Tab */}
      {tab === 'team' && (
        <div>
          {isOwner && (
            <div className="flex justify-between items-center mb-16">
              <h3 style={{ color: 'var(--text-secondary)' }}>Team ({project.assignments?.length || 0})</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAssignModal(true)}><HiOutlineUserPlus /> Assign Worker</button>
            </div>
          )}
          {(!project.assignments || project.assignments.length === 0) ? (
            <div className="empty-state"><div className="empty-icon">👥</div><h3>No team members</h3></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {project.assignments.map((a) => (
                <div key={a.id} className="card" style={{ padding: 16 }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-12">
                      <div className="user-avatar" style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'var(--accent-gradient)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        {a.worker.user.fullName.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{a.worker.user.fullName}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{a.worker.user.email}</div>
                      </div>
                    </div>
                    {isOwner && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveAssignment(a.id)} title="Remove"><HiOutlineTrash /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Project Modal */}
      <Modal isOpen={showEditProject} onClose={() => setShowEditProject(false)} title="Edit Project"
        footer={<><button className="btn btn-secondary" onClick={() => setShowEditProject(false)}>Cancel</button><button className="btn btn-primary" onClick={handleUpdateProject}>Update</button></>}>
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Status</label>
          <select className="form-select" value={projectForm.status} onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}>
            <option value="NOT_STARTED">Not Started</option><option value="IN_PROGRESS">In Progress</option><option value="ON_HOLD">On Hold</option><option value="COMPLETED">Completed</option>
          </select>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Start Date</label><input type="date" className="form-input" value={projectForm.startDate} onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">End Date</label><input type="date" className="form-input" value={projectForm.endDate} onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })} /></div>
        </div>
      </Modal>

      {/* Task Modal */}
      <Modal isOpen={showTaskModal} onClose={() => { setShowTaskModal(false); setEditingTask(null); }} title={editingTask ? 'Edit Task' : 'Create Task'}
        footer={<><button className="btn btn-secondary" onClick={() => { setShowTaskModal(false); setEditingTask(null); }}>Cancel</button><button className="btn btn-primary" onClick={handleCreateTask}>{editingTask ? 'Update' : 'Create'}</button></>}>
        <div className="form-group"><label className="form-label">Title *</label><input className="form-input" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Priority</label>
            <select className="form-select" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
              <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="URGENT">Urgent</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">Due Date</label><input type="date" className="form-input" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></div>
        </div>
        <div className="form-group"><label className="form-label">Assign To</label>
          <select className="form-select" value={taskForm.assignedToId} onChange={(e) => setTaskForm({ ...taskForm, assignedToId: e.target.value })}>
            <option value="">Unassigned</option>
            {allProjectWorkers.map((w) => <option key={w.id} value={w.id}>{w.user.fullName}</option>)}
          </select>
        </div>
        {editingTask && (
          <div className="form-group"><label className="form-label">Status</label>
            <select className="form-select" value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}>
              <option value="PENDING">Pending</option><option value="IN_PROGRESS">In Progress</option><option value="COMPLETED">Completed</option>
            </select>
          </div>
        )}
      </Modal>

      {/* Milestone Modal */}
      <Modal isOpen={showMilestoneModal} onClose={() => setShowMilestoneModal(false)} title="Create Milestone"
        footer={<><button className="btn btn-secondary" onClick={() => setShowMilestoneModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreateMilestone}>Create</button></>}>
        <div className="form-group"><label className="form-label">Title *</label><input className="form-input" value={milestoneForm.title} onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={milestoneForm.description} onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })} rows={2} /></div>
        <div className="form-group"><label className="form-label">Due Date</label><input type="date" className="form-input" value={milestoneForm.dueDate} onChange={(e) => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })} /></div>
      </Modal>

      {/* Assign Worker Modal */}
      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Worker" size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAssignWorker} disabled={!selectedWorker}>Assign</button></>}>
        {availableWorkers.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)' }}>No available workers to assign. All workers are already on this project.</p>
        ) : (
          <div className="form-group"><label className="form-label">Select Worker</label>
            <select className="form-select" value={selectedWorker} onChange={(e) => setSelectedWorker(e.target.value)}>
              <option value="">Choose a worker...</option>
              {availableWorkers.map((w) => <option key={w.id} value={w.id}>{w.user.fullName} — {w.position || 'No position'}</option>)}
            </select>
          </div>
        )}
      </Modal>
    </div>
  );
}
