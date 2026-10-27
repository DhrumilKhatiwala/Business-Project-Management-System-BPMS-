require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const workerRoutes = require('./routes/workers');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const milestoneRoutes = require('./routes/milestones');
const materialRoutes = require('./routes/materials');
const alertRoutes = require('./routes/alerts');
const dashboardRoutes = require('./routes/dashboard');
const invoiceRoutes = require('./routes/invoices');
const clientPortalRoutes = require('./routes/clientPortal');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/milestones', milestoneRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/client-portal', clientPortalRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend build if present (for single-service full-stack deployment)
const path = require('path');
const fs = require('fs');
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  // Friendly API status route when running as pure backend service
  app.get('/', (req, res) => {
    res.json({
      name: 'Business Project Management System (BPMS) API',
      status: 'online',
      message: 'BPMS backend service is running successfully on Render.',
      health: '/api/health',
      timestamp: new Date().toISOString()
    });
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 BPMS Server running on port ${PORT}`);
  });
}

module.exports = app;
