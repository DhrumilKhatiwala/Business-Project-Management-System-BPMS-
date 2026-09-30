import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bpms_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('bpms_token');
      localStorage.removeItem('bpms_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ───
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// ─── Users ───
export const usersAPI = {
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  updateStatus: (id, status) => api.patch(`/users/${id}/status`, { status }),
  delete: (id) => api.delete(`/users/${id}`),
};

// ─── Workers ───
export const workersAPI = {
  list: (params) => api.get('/workers', { params }),
  get: (id) => api.get(`/workers/${id}`),
  create: (data) => api.post('/workers', data),
  getMe: () => api.get('/workers/me'),
  getMyTasks: (params) => api.get('/workers/me/tasks', { params }),
  update: (id, data) => api.put(`/workers/${id}`, data),
  updateStatus: (id, status) => api.patch(`/workers/${id}/status`, { status }),
  delete: (id) => api.delete(`/workers/${id}`),
};

// ─── Projects ───
export const projectsAPI = {
  list: (params) => api.get('/projects', { params }),
  get: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  addAssignment: (projectId, workerId) => api.post(`/projects/${projectId}/assignments`, { workerId }),
  removeAssignment: (projectId, assignmentId) => api.delete(`/projects/${projectId}/assignments/${assignmentId}`),
  getMaterials: (projectId) => api.get(`/projects/${projectId}/materials`),
  allocateMaterial: (projectId, data) => api.post(`/projects/${projectId}/materials`, data),
  removeMaterial: (projectId, allocationId) => api.delete(`/projects/${projectId}/materials/${allocationId}`),
};

// ─── Tasks ───
export const tasksAPI = {
  list: (params) => api.get('/tasks', { params }),
  get: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.patch(`/tasks/${id}`, data),
  delete: (id) => api.delete(`/tasks/${id}`),
};

// ─── Milestones ───
export const milestonesAPI = {
  list: (params) => api.get('/milestones', { params }),
  create: (data) => api.post('/milestones', data),
  update: (id, data) => api.patch(`/milestones/${id}`, data),
  delete: (id) => api.delete(`/milestones/${id}`),
};

// ─── Materials ───
export const materialsAPI = {
  list: (params) => api.get('/materials', { params }),
  get: (id) => api.get(`/materials/${id}`),
  create: (data) => api.post('/materials', data),
  update: (id, data) => api.put(`/materials/${id}`, data),
  delete: (id) => api.delete(`/materials/${id}`),
  updateStock: (id, data) => api.post(`/materials/${id}/stock`, data),
  getStockHistory: (id) => api.get(`/materials/${id}/stock-history`),
  getCategories: () => api.get('/materials/categories'),
};

// ─── Alerts ───
export const alertsAPI = {
  getLowStock: (params) => api.get('/alerts/low-stock', { params }),
  getLowStockAlerts: (status) => api.get('/alerts/low-stock', { params: typeof status === 'string' ? { status } : status }),
  resolve: (id) => api.patch(`/alerts/${id}/resolve`),
};

// ─── Dashboard ───
export const dashboardAPI = {
  getOverview: () => api.get('/dashboard/overview'),
  getProjectStats: () => api.get('/dashboard/projects'),
  getInventoryStats: () => api.get('/dashboard/inventory'),
};

export default api;
