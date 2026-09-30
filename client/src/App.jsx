import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import WorkersPage from './pages/WorkersPage';
import WorkerDetailPage from './pages/WorkerDetailPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import MyTasksPage from './pages/MyTasksPage';
import InventoryPage from './pages/InventoryPage';
import MaterialDetailPage from './pages/MaterialDetailPage';
import AlertsPage from './pages/AlertsPage';
import ProfilePage from './pages/ProfilePage';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        {/* Module 1 — Accounts */}
        <Route path="/accounts/users" element={
          <ProtectedRoute roles={['ADMIN', 'BUSINESS_OWNER', 'CLIENT', 'WORKER']}><UsersPage /></ProtectedRoute>
        } />

        {/* Module 2 — Workforce */}
        <Route path="/workforce/workers" element={
          <ProtectedRoute roles={['BUSINESS_OWNER']}><WorkersPage /></ProtectedRoute>
        } />
        <Route path="/workforce/workers/:id" element={
          <ProtectedRoute roles={['BUSINESS_OWNER']}><WorkerDetailPage /></ProtectedRoute>
        } />

        {/* Module 2 — Projects */}
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />

        {/* Worker Tasks */}
        <Route path="/my-tasks" element={
          <ProtectedRoute roles={['WORKER']}><MyTasksPage /></ProtectedRoute>
        } />

        {/* Module 3 — Inventory */}
        <Route path="/inventory" element={
          <ProtectedRoute roles={['BUSINESS_OWNER']}><InventoryPage /></ProtectedRoute>
        } />
        <Route path="/inventory/materials/:id" element={
          <ProtectedRoute roles={['BUSINESS_OWNER']}><MaterialDetailPage /></ProtectedRoute>
        } />
        <Route path="/inventory/alerts" element={
          <ProtectedRoute roles={['BUSINESS_OWNER']}><AlertsPage /></ProtectedRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '10px',
              fontSize: '0.9rem',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
