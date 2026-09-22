import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { projectsAPI, tasksAPI, milestonesAPI, workersAPI, materialsAPI } from '../services/api';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import {
  HiOutlineArrowLeft, HiOutlinePencil, HiOutlinePlus, HiOutlineTrash,
  HiOutlineUserPlus, HiOutlineListBullet, HiOutlineSquares2X2,
  HiOutlineCalendar, HiOutlineUser, HiOutlineCheck, HiOutlineArrowRight,
  HiOutlineClipboardDocumentList, HiOutlineClock, HiOutlinePlayCircle,
  HiOutlineCheckCircle, HiOutlineFlag, HiOutlineUserGroup,
  HiOutlineCube, HiOutlineCurrencyDollar, HiOutlineArchiveBox
} from 'react-icons/hi2';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = user?.role === 'BUSINESS_OWNER';

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('tasks');
  const [taskView, setTaskView] = useState('kanban'); // 'kanban' or 'list'
  const [workers, setWorkers] = useState([]);

  // Modals
  const [showEditProject, setShowEditProject] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Materials state
  const [projectMaterials, setProjectMaterials] = useState([]);
  const [projectMaterialsStats, setProjectMaterialsStats] = useState({ totalItems: 0, totalQuantity: 0, totalCost: 0 });
  const [inventoryMaterials, setInventoryMaterials] = useState([]);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [allocateQty, setAllocateQty] = useState('');
  const [allocating, setAllocating] = useState(false);

  const [projectForm, setProjectForm] = useState({});
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assignedToId: '' });
  const [milestoneForm, setMilestoneForm] = useState({ title: '', description: '', dueDate: '' });
  const [selectedWorker, setSelectedWorker] = useState('');

  useEffect(() => {
    loadProject();
    loadProjectMaterials();
  }, [id]);

  const loadProjectMaterials = async () => {
    try {
      const res = await projectsAPI.getMaterials(id);
      setProjectMaterials(res.data.allocations || []);
      setProjectMaterialsStats(res.data.stats || { totalItems: 0, totalQuantity: 0, totalCost: 0 });
    } catch (err) {
      console.error('Failed to load project materials:', err);
    }
  };

  const openAllocateMaterial = async () => {
    try {
      const res = await materialsAPI.list({ status: 'ACTIVE' });
      setInventoryMaterials(res.data.materials || res.data || []);
      setSelectedMaterialId('');
      setAllocateQty('');
      setShowMaterialModal(true);
    } catch (err) {
      toast.error('Failed to load inventory materials.');
    }
  };

  const handleAllocateMaterial = async (e) => {
    e.preventDefault();
    if (!selectedMaterialId || !allocateQty || parseInt(allocateQty, 10) <= 0) {
      return toast.error('Please select a material and enter a valid quantity.');
    }
    setAllocating(true);
    try {
      await projectsAPI.allocateMaterial(id, { materialId: selectedMaterialId, quantity: parseInt(allocateQty, 10) });
      toast.success('Material allocated to project!');
      setShowMaterialModal(false);
      loadProjectMaterials();
      loadProject();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to allocate material.');
    } finally {
      setAllocating(false);
    }
  };

  const handleRemoveMaterial = async (allocationId) => {
    if (!window.confirm('Return this material back to inventory?')) return;
    try {
      await projectsAPI.removeMaterial(id, allocationId);
      toast.success('Material returned to inventory!');
      loadProjectMaterials();
      loadProject();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to return material.');
    }
  };

  const loadProject = async () => {
    try {
      const res = await projectsAPI.get(id);
      setProject(res.data);
      setProjectForm({
        name: res.data.name,
        description: res.data.description || '',
        status: res.data.status,
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
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed.');
    }
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
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.');
    }
  };

  const handleQuickStatusMove = async (taskId, newStatus) => {
    try {
      await tasksAPI.update(taskId, { status: newStatus });
      toast.success(`Task moved to ${newStatus.replace('_', ' ')}!`);
      loadProject();
    } catch (err) {
      toast.error('Failed to update task status.');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    try {
      await tasksAPI.delete(taskId);
      toast.success('Task deleted.');
      loadProject();
    } catch (err) {
      toast.error('Failed to delete task.');
    }
  };

  const handleCreateMilestone = async () => {
    if (!milestoneForm.title.trim()) { toast.error('Title required.'); return; }
    try {
      await milestonesAPI.create({ ...milestoneForm, projectId: id });
      toast.success('Milestone created!');
      setShowMilestoneModal(false);
      setMilestoneForm({ title: '', description: '', dueDate: '' });
      loadProject();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.');
    }
  };

  const handleUpdateMilestone = async (msId, status) => {
    try {
      await milestonesAPI.update(msId, { status });
      toast.success('Milestone updated.');
      loadProject();
    } catch (err) {
      toast.error('Failed to update milestone.');
    }
  };

  const handleDeleteMilestone = async (msId) => {
    if (!confirm('Delete this milestone?')) return;
    try {
      await milestonesAPI.delete(msId);
      toast.success('Milestone deleted.');
      loadProject();
    } catch (err) {
      toast.error('Failed.');
    }
  };

  const handleAssignWorker = async () => {
    if (!selectedWorker) return;
    try {
      await projectsAPI.addAssignment(id, selectedWorker);
      toast.success('Worker assigned!');
      setShowAssignModal(false);
      setSelectedWorker('');
      loadProject();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed.');
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    if (!confirm('Remove this worker?')) return;
    try {
      await projectsAPI.removeAssignment(id, assignmentId);
      toast.success('Worker removed.');
      loadProject();
    } catch (err) {
      toast.error('Failed.');
    }
  };

  const openEditTask = (t) => {
    setEditingTask(t);
    setTaskForm({
      title: t.title,
      description: t.description || '',
      priority: t.priority,
      dueDate: t.dueDate ? t.dueDate.split('T')[0] : '',
      assignedToId: t.assignedToId || '',
      status: t.status
    });
    setShowTaskModal(true);
  };

  const statusBadge = (s) => {
    const map = {
      NOT_STARTED: 'badge-neutral',
      PENDING: 'badge-warning',
      IN_PROGRESS: 'badge-info',
      ON_HOLD: 'badge-warning',
      COMPLETED: 'badge-success'
    };
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
  const allProjectWorkers = workers;

  const pendingTasks = (project.tasks || []).filter(t => t.status === 'PENDING');
  const inProgressTasks = (project.tasks || []).filter(t => t.status === 'IN_PROGRESS');
  const completedTasks = (project.tasks || []).filter(t => t.status === 'COMPLETED');

  return (
    <div>
      {/* ── Header ── */}
      <div className="detail-header">
        <div className="detail-title">
          <button className="back-btn" onClick={() => navigate('/projects')}>
            <HiOutlineArrowLeft />
          </button>
          <div>
            <div className="flex items-center gap-12">
              <h1>{project.name}</h1>
              {statusBadge(project.status)}
            </div>
            {project.description && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
                {project.description}
              </p>
            )}
          </div>
        </div>
        {isOwner && (
          <button className="btn btn-secondary" onClick={() => setShowEditProject(true)}>
            <HiOutlinePencil /> Edit Project
          </button>
        )}
      </div>

      {/* ── KPI Stats & Progress ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <div className="stat-card">
          <div className="flex justify-between items-center">
            <div className="stat-value">{project.progress}%</div>
            <span className="badge badge-success">{completedTasks.length}/{project.tasks?.length || 0} done</span>
          </div>
          <div className="stat-label">Completion Progress</div>
          <div className="progress-bar mt-8">
            <div className="progress-fill" style={{ width: `${project.progress}%` }} />
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{project.tasks?.length || 0}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{project.milestones?.length || 0}</div>
          <div className="stat-label">Milestones</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{project.assignments?.length || 0}</div>
          <div className="stat-label">Team Members</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        <button className={`tab ${tab === 'tasks' ? 'active' : ''}`} onClick={() => setTab('tasks')}>
          Tasks ({project.tasks?.length || 0})
        </button>
        <button className={`tab ${tab === 'milestones' ? 'active' : ''}`} onClick={() => setTab('milestones')}>
          Milestones ({project.milestones?.length || 0})
        </button>
        <button className={`tab ${tab === 'team' ? 'active' : ''}`} onClick={() => setTab('team')}>
          Team Roster ({project.assignments?.length || 0})
        </button>
        <button className={`tab ${tab === 'materials' ? 'active' : ''}`} onClick={() => setTab('materials')}>
          Materials & Resources ({projectMaterials.length})
        </button>
      </div>

      {/* ── Tasks Tab ── */}
      {tab === 'tasks' && (
        <div>
          <div className="flex justify-between items-center mb-16">
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${taskView === 'kanban' ? 'active' : ''}`}
                onClick={() => setTaskView('kanban')}
              >
                <HiOutlineSquares2X2 />
                <span>Kanban Board</span>
              </button>
              <button
                className={`view-toggle-btn ${taskView === 'list' ? 'active' : ''}`}
                onClick={() => setTaskView('list')}
              >
                <HiOutlineListBullet />
                <span>List View</span>
              </button>
            </div>

            {isOwner && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditingTask(null);
                  setTaskForm({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assignedToId: '' });
                  setShowTaskModal(true);
                }}
              >
                <HiOutlinePlus /> Add Task
              </button>
            )}
          </div>

          {(!project.tasks || project.tasks.length === 0) ? (
            <div className="empty-state">
              <div className="empty-icon"><HiOutlineClipboardDocumentList /></div>
              <h3>No tasks created yet</h3>
              <p>Create tasks and assign them to your workforce to track project progress.</p>
            </div>
          ) : taskView === 'kanban' ? (
            /* ── Kanban View ── */
            <div className="kanban-container">
              {/* Column 1: Pending */}
              <div className="kanban-col pending">
                <div className="kanban-col-header">
                  <div className="kanban-col-title">
                    <HiOutlineClock style={{ color: '#f59e0b', fontSize: '1.1rem' }} />
                    <span>Pending Queue</span>
                  </div>
                  <span className="kanban-col-count">{pendingTasks.length}</span>
                </div>
                <div className="kanban-cards-list">
                  {pendingTasks.length === 0 ? (
                    <div className="kanban-empty">No pending tasks</div>
                  ) : (
                    pendingTasks.map(t => (
                      <div key={t.id} className="kanban-card">
                        <div className="kanban-card-title">{t.title}</div>
                        {t.description && <div className="kanban-card-desc">{t.description}</div>}
                        <div className="kanban-card-meta">
                          <span>{priorityBadge(t.priority)}</span>
                          {t.dueDate && (
                            <span>
                              <HiOutlineCalendar style={{ verticalAlign: 'middle', marginRight: 4 }} />
                              {new Date(t.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span>
                            <HiOutlineUser style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            {t.assignedTo?.user?.fullName || 'Unassigned'}
                          </span>
                        </div>
                        <div className="kanban-card-actions">
                          {isOwner && (
                            <>
                              <button className="kanban-move-btn" onClick={() => openEditTask(t)}>Edit</button>
                              <button className="kanban-move-btn" onClick={() => handleDeleteTask(t.id)}><HiOutlineTrash /></button>
                            </>
                          )}
                          <button
                            className="kanban-move-btn"
                            style={{ background: 'var(--info-bg)', borderColor: 'var(--info-border)', color: '#60a5fa' }}
                            onClick={() => handleQuickStatusMove(t.id, 'IN_PROGRESS')}
                          >
                            <span>Start</span>
                            <HiOutlineArrowRight />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 2: In Progress */}
              <div className="kanban-col in-progress">
                <div className="kanban-col-header">
                  <div className="kanban-col-title">
                    <HiOutlinePlayCircle style={{ color: '#60a5fa', fontSize: '1.1rem' }} />
                    <span>In Progress</span>
                  </div>
                  <span className="kanban-col-count">{inProgressTasks.length}</span>
                </div>
                <div className="kanban-cards-list">
                  {inProgressTasks.length === 0 ? (
                    <div className="kanban-empty">No tasks in progress</div>
                  ) : (
                    inProgressTasks.map(t => (
                      <div key={t.id} className="kanban-card">
                        <div className="kanban-card-title">{t.title}</div>
                        {t.description && <div className="kanban-card-desc">{t.description}</div>}
                        <div className="kanban-card-meta">
                          <span>{priorityBadge(t.priority)}</span>
                          {t.dueDate && (
                            <span>
                              <HiOutlineCalendar style={{ verticalAlign: 'middle', marginRight: 4 }} />
                              {new Date(t.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span>
                            <HiOutlineUser style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            {t.assignedTo?.user?.fullName || 'Unassigned'}
                          </span>
                        </div>
                        <div className="kanban-card-actions">
                          <button
                            className="kanban-move-btn"
                            onClick={() => handleQuickStatusMove(t.id, 'PENDING')}
                          >
                            ⬅ Back
                          </button>
                          {isOwner && (
                            <button className="kanban-move-btn" onClick={() => openEditTask(t)}>Edit</button>
                          )}
                          <button
                            className="kanban-move-btn"
                            style={{ background: 'var(--success-bg)', borderColor: 'var(--success-border)', color: '#34d399' }}
                            onClick={() => handleQuickStatusMove(t.id, 'COMPLETED')}
                          >
                            <HiOutlineCheck />
                            <span>Complete</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Column 3: Completed */}
              <div className="kanban-col completed">
                <div className="kanban-col-header">
                  <div className="kanban-col-title">
                    <HiOutlineCheckCircle style={{ color: '#34d399', fontSize: '1.1rem' }} />
                    <span>Completed</span>
                  </div>
                  <span className="kanban-col-count">{completedTasks.length}</span>
                </div>
                <div className="kanban-cards-list">
                  {completedTasks.length === 0 ? (
                    <div className="kanban-empty">No completed tasks</div>
                  ) : (
                    completedTasks.map(t => (
                      <div key={t.id} className="kanban-card" style={{ opacity: 0.85 }}>
                        <div className="kanban-card-title" style={{ textDecoration: 'line-through', color: 'var(--text-secondary)' }}>
                          {t.title}
                        </div>
                        {t.description && <div className="kanban-card-desc">{t.description}</div>}
                        <div className="kanban-card-meta">
                          <span>{priorityBadge(t.priority)}</span>
                          <span className="badge badge-success">Done</span>
                        </div>
                        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                          <span>
                            <HiOutlineUser style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            {t.assignedTo?.user?.fullName || 'Unassigned'}
                          </span>
                        </div>
                        <div className="kanban-card-actions">
                          <button
                            className="kanban-move-btn"
                            onClick={() => handleQuickStatusMove(t.id, 'IN_PROGRESS')}
                          >
                            Reopen
                          </button>
                          {isOwner && (
                            <button className="kanban-move-btn" onClick={() => handleDeleteTask(t.id)}>
                              <HiOutlineTrash />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ── List View ── */
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Assigned To</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Due Date</th>
                    {isOwner && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {project.tasks.map((t) => (
                    <tr key={t.id}>
                      <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{t.title}</td>
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

      {/* ── Milestones Tab (Timeline View) ── */}
      {tab === 'milestones' && (
        <div>
          {isOwner && (
            <div className="flex justify-between items-center mb-16">
              <h3 style={{ color: 'var(--text-secondary)' }}>Stage-Gate Milestones</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowMilestoneModal(true)}>
                <HiOutlinePlus /> Add Milestone
              </button>
            </div>
          )}
          {(!project.milestones || project.milestones.length === 0) ? (
            <div className="empty-state">
              <div className="empty-icon"><HiOutlineFlag /></div>
              <h3>No milestones scheduled</h3>
              <p>Add key stage gates and project deadlines to track critical paths.</p>
            </div>
          ) : (
            <div className="timeline-wrap">
              {project.milestones.map((m) => (
                <div
                  key={m.id}
                  className={`timeline-step ${m.status === 'COMPLETED' ? 'completed' : m.status === 'IN_PROGRESS' ? 'in-progress' : 'pending'}`}
                >
                  <div className="timeline-node">
                    {m.status === 'COMPLETED' ? <HiOutlineCheck style={{ strokeWidth: 3 }} /> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />}
                  </div>
                  <div className="timeline-content flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-12">
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{m.title}</span>
                        {statusBadge(m.status)}
                      </div>
                      {m.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 4 }}>{m.description}</p>}
                      {m.dueDate && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                          <HiOutlineCalendar style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          Target Deadline: {new Date(m.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {isOwner && (
                      <div className="flex gap-8 items-center">
                        <select
                          className="form-select"
                          value={m.status}
                          onChange={(e) => handleUpdateMilestone(m.id, e.target.value)}
                          style={{ width: 'auto', minWidth: 130, padding: '6px 30px 6px 10px', fontSize: '0.8rem' }}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="COMPLETED">Completed</option>
                        </select>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteMilestone(m.id)}>
                          <HiOutlineTrash />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Team Tab ── */}
      {tab === 'team' && (
        <div>
          {isOwner && (
            <div className="flex justify-between items-center mb-16">
              <h3 style={{ color: 'var(--text-secondary)' }}>Assigned Workforce</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAssignModal(true)}>
                <HiOutlineUserPlus /> Assign Worker
              </button>
            </div>
          )}
          {(!project.assignments || project.assignments.length === 0) ? (
            <div className="empty-state">
              <div className="empty-icon"><HiOutlineUserGroup /></div>
              <h3>No team members assigned yet</h3>
              <p>Assign qualified field workers to begin delegating tasks.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {project.assignments.map((a) => (
                <div key={a.id} className="card" style={{ padding: 18 }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-14">
                      <div className="user-avatar" style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--accent-gradient)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1rem' }}>
                        {a.worker.user.fullName.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{a.worker.user.fullName}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{a.worker.position || 'Field Staff'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 2 }}>{a.worker.user.email}</div>
                      </div>
                    </div>
                    {isOwner && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleRemoveAssignment(a.id)} title="Remove from project">
                        <HiOutlineTrash />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Materials Tab ── */}
      {tab === 'materials' && (
        <div>
          <div className="flex justify-between items-center mb-16" style={{ flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ color: 'var(--text-secondary)' }}>Project Materials & Requisitions</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: 2 }}>
                Track inventory resources allocated to this project and monitor material expenditures
              </p>
            </div>
            {isOwner && (
              <button className="btn btn-primary btn-sm" onClick={openAllocateMaterial}>
                <HiOutlinePlus /> Allocate Material
              </button>
            )}
          </div>

          {/* Aggregate Material Cost Stats */}
          {projectMaterials.length > 0 && (
            <div className="stats-grid mb-24" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <div className="stat-card" style={{ padding: '16px 20px' }}>
                <div className="stat-icon blue" style={{ width: 40, height: 40, fontSize: '1.1rem' }}>
                  <HiOutlineCube />
                </div>
                <div className="stat-value" style={{ fontSize: '1.5rem' }}>{projectMaterialsStats.totalItems}</div>
                <div className="stat-label">Allocated Types</div>
              </div>
              <div className="stat-card" style={{ padding: '16px 20px' }}>
                <div className="stat-icon purple" style={{ width: 40, height: 40, fontSize: '1.1rem' }}>
                  <HiOutlineArchiveBox />
                </div>
                <div className="stat-value" style={{ fontSize: '1.5rem' }}>{projectMaterialsStats.totalQuantity}</div>
                <div className="stat-label">Total Units Used</div>
              </div>
              <div className="stat-card" style={{ padding: '16px 20px' }}>
                <div className="stat-icon green" style={{ width: 40, height: 40, fontSize: '1.1rem' }}>
                  <HiOutlineCurrencyDollar />
                </div>
                <div className="stat-value" style={{ fontSize: '1.5rem', color: '#34d399' }}>
                  ${projectMaterialsStats.totalCost.toFixed(2)}
                </div>
                <div className="stat-label">Total Material Expense</div>
              </div>
            </div>
          )}

          {projectMaterials.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><HiOutlineCube /></div>
              <h3>No materials allocated yet</h3>
              <p>Allocate inventory materials such as cement, steel, or equipment to track project costs.</p>
              {isOwner && (
                <button className="btn btn-primary btn-sm" onClick={openAllocateMaterial}>
                  <HiOutlinePlus /> Allocate First Material
                </button>
              )}
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Category</th>
                    <th>Quantity Allocated</th>
                    <th>Unit Cost</th>
                    <th>Total Value</th>
                    <th>Allocated Date</th>
                    {isOwner && <th style={{ textAlign: 'right' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {projectMaterials.map((pm) => {
                    const lineTotal = (pm.quantity * (pm.material?.costPerUnit || 0)).toFixed(2);
                    return (
                      <tr key={pm.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pm.material?.name}</div>
                          {pm.material?.supplier && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Supplier: {pm.material.supplier}</div>
                          )}
                        </td>
                        <td>
                          <span className="badge badge-neutral">{pm.material?.category || 'General'}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {pm.quantity} {pm.material?.unit || 'units'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          ${(pm.material?.costPerUnit || 0).toFixed(2)} / {pm.material?.unit || 'unit'}
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: '#34d399' }}>${lineTotal}</span>
                        </td>
                        <td style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                          {new Date(pm.allocatedAt).toLocaleDateString()}
                        </td>
                        {isOwner && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => handleRemoveMaterial(pm.id)}
                              title="Return material to inventory"
                              style={{ color: 'var(--danger)' }}
                            >
                              <HiOutlineTrash /> Return
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}
      <Modal isOpen={showEditProject} onClose={() => setShowEditProject(false)} title="Edit Project"
        footer={<><button className="btn btn-secondary" onClick={() => setShowEditProject(false)}>Cancel</button><button className="btn btn-primary" onClick={handleUpdateProject}>Save Changes</button></>}>
        <div className="form-group"><label className="form-label">Project Name</label><input className="form-input" value={projectForm.name} onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={projectForm.description} onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Status</label>
          <select className="form-select" value={projectForm.status} onChange={(e) => setProjectForm({ ...projectForm, status: e.target.value })}>
            <option value="NOT_STARTED">Not Started</option><option value="IN_PROGRESS">In Progress</option><option value="ON_HOLD">On Hold</option><option value="COMPLETED">Completed</option>
          </select>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Start Date</label><input type="date" className="form-input" value={projectForm.startDate} onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Target Completion Date</label><input type="date" className="form-input" value={projectForm.endDate} onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })} /></div>
        </div>
      </Modal>

      <Modal isOpen={showTaskModal} onClose={() => { setShowTaskModal(false); setEditingTask(null); }} title={editingTask ? 'Edit Task' : 'Create Task'}
        footer={<><button className="btn btn-secondary" onClick={() => { setShowTaskModal(false); setEditingTask(null); }}>Cancel</button><button className="btn btn-primary" onClick={handleCreateTask}>{editingTask ? 'Update Task' : 'Create Task'}</button></>}>
        <div className="form-group"><label className="form-label">Task Title *</label><input className="form-input" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} placeholder="e.g. Inspect electrical conduits" /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} rows={2} /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Priority</label>
            <select className="form-select" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}>
              <option value="LOW">Low Priority</option><option value="MEDIUM">Medium Priority</option><option value="HIGH">High Priority</option><option value="URGENT">Urgent Priority</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">Due Date</label><input type="date" className="form-input" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></div>
        </div>
        <div className="form-group"><label className="form-label">Assign To</label>
          <select className="form-select" value={taskForm.assignedToId} onChange={(e) => setTaskForm({ ...taskForm, assignedToId: e.target.value })}>
            <option value="">Unassigned</option>
            {allProjectWorkers.map((w) => <option key={w.id} value={w.id}>{w.user.fullName} ({w.position || 'Worker'})</option>)}
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

      <Modal isOpen={showMilestoneModal} onClose={() => setShowMilestoneModal(false)} title="Create Milestone"
        footer={<><button className="btn btn-secondary" onClick={() => setShowMilestoneModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleCreateMilestone}>Create Milestone</button></>}>
        <div className="form-group"><label className="form-label">Milestone Title *</label><input className="form-input" value={milestoneForm.title} onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })} placeholder="e.g. Foundation Sign-off" /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={milestoneForm.description} onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })} rows={2} /></div>
        <div className="form-group"><label className="form-label">Due Date</label><input type="date" className="form-input" value={milestoneForm.dueDate} onChange={(e) => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })} /></div>
      </Modal>

      <Modal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} title="Assign Worker to Project" size="sm"
        footer={<><button className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleAssignWorker} disabled={!selectedWorker}>Confirm Assignment</button></>}>
        {availableWorkers.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)' }}>All available active workers are already assigned to this project.</p>
        ) : (
          <div className="form-group"><label className="form-label">Select Field Worker</label>
            <select className="form-select" value={selectedWorker} onChange={(e) => setSelectedWorker(e.target.value)}>
              <option value="">Choose a worker...</option>
              {availableWorkers.map((w) => <option key={w.id} value={w.id}>{w.user.fullName} — {w.position || 'General Staff'}</option>)}
            </select>
          </div>
        )}
      </Modal>

      {/* ── Allocate Material Modal ── */}
      <Modal
        isOpen={showMaterialModal}
        onClose={() => setShowMaterialModal(false)}
        title="Allocate Material from Inventory"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowMaterialModal(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleAllocateMaterial}
              disabled={allocating || !selectedMaterialId || !allocateQty || parseInt(allocateQty, 10) <= 0}
            >
              {allocating ? 'Allocating...' : 'Confirm Allocation'}
            </button>
          </>
        }
      >
        <div className="form-group mb-16">
          <label className="form-label">Select Inventory Material *</label>
          <select
            className="form-select"
            value={selectedMaterialId}
            onChange={(e) => setSelectedMaterialId(e.target.value)}
            required
          >
            <option value="">-- Choose an active inventory item --</option>
            {inventoryMaterials.map((m) => (
              <option key={m.id} value={m.id} disabled={m.quantity <= 0}>
                {m.name} ({m.quantity} {m.unit} in stock - ${m.costPerUnit.toFixed(2)}/{m.unit}) {m.quantity <= 0 ? '(Out of Stock)' : ''}
              </option>
            ))}
          </select>
        </div>

        {(() => {
          const mat = inventoryMaterials.find(m => m.id === selectedMaterialId);
          if (!mat) return null;
          return (
            <div>
              <div style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: 16,
                fontSize: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Available Stock:</div>
                  <strong style={{ color: mat.quantity <= mat.minStockLevel ? '#f59e0b' : '#34d399' }}>
                    {mat.quantity} {mat.unit}
                  </strong>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Unit Cost:</div>
                  <strong style={{ color: 'var(--text-primary)' }}>${mat.costPerUnit.toFixed(2)}</strong>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Supplier:</div>
                  <span style={{ color: 'var(--text-secondary)' }}>{mat.supplier || '—'}</span>
                </div>
              </div>

              <div className="form-group mb-16">
                <label className="form-label">Allocation Quantity ({mat.unit}) *</label>
                <input
                  type="number"
                  min="1"
                  max={mat.quantity}
                  className="form-input"
                  value={allocateQty}
                  onChange={(e) => setAllocateQty(e.target.value)}
                  placeholder={`Max ${mat.quantity} ${mat.unit}`}
                  required
                />
              </div>

              {allocateQty > 0 && (
                <div style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  background: 'rgba(56, 189, 248, 0.08)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(56, 189, 248, 0.2)'
                }}>
                  Estimated Project Expenditure: <strong style={{ color: '#38bdf8' }}>${(allocateQty * mat.costPerUnit).toFixed(2)}</strong>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
