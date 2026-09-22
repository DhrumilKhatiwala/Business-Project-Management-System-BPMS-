const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper to ensure skills is an array
function formatWorker(worker) {
  if (!worker) return worker;
  let skills = [];
  if (Array.isArray(worker.skills)) {
    skills = worker.skills;
  } else if (typeof worker.skills === 'string') {
    try {
      skills = JSON.parse(worker.skills);
      if (!Array.isArray(skills)) skills = [worker.skills];
    } catch {
      skills = worker.skills ? worker.skills.split(',').map(s => s.trim()).filter(Boolean) : [];
    }
  }
  return { ...worker, skills };
}

// GET /api/workers
router.get('/', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { search, status } = req.query;
    const where = {};

    if (status) where.status = status;
    if (search) {
      where.user = {
        OR: [
          { fullName: { contains: search } },
          { email: { contains: search } },
        ],
      };
    }

    const workers = await prisma.worker.findMany({
      where,
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, status: true },
        },
        assignments: {
          include: {
            project: {
              select: { id: true, name: true, status: true },
            },
          },
        },
        _count: { select: { tasks: true } },
      },
      orderBy: { user: { fullName: 'asc' } },
    });

    res.json(workers.map(formatWorker));
  } catch (error) {
    console.error('List workers error:', error);
    res.status(500).json({ error: 'Failed to fetch workers.' });
  }
});

// GET /api/workers/me - Current worker's profile
router.get('/me', authenticate, authorize('WORKER'), async (req, res) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, status: true },
        },
        assignments: {
          include: {
            project: {
              select: { id: true, name: true, status: true, progress: true },
            },
          },
        },
        tasks: {
          include: {
            project: { select: { id: true, name: true } },
          },
          orderBy: { dueDate: 'asc' },
        },
      },
    });

    if (!worker) {
      return res.status(404).json({ error: 'Worker profile not found.' });
    }

    res.json(formatWorker(worker));
  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

// GET /api/workers/me/tasks - Worker's assigned tasks
router.get('/me/tasks', authenticate, authorize('WORKER'), async (req, res) => {
  try {
    const worker = await prisma.worker.findUnique({ where: { userId: req.user.id } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker profile not found.' });
    }

    const { status, projectId } = req.query;
    const where = { assignedToId: worker.id };
    if (status) where.status = status;
    if (projectId) where.projectId = projectId;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    res.json(tasks);
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

// GET /api/workers/:id
router.get('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true },
        },
        assignments: {
          include: {
            project: { select: { id: true, name: true, status: true, progress: true } },
          },
        },
        tasks: {
          include: {
            project: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!worker) {
      return res.status(404).json({ error: 'Worker not found.' });
    }

    res.json(formatWorker(worker));
  } catch (error) {
    console.error('Get worker error:', error);
    res.status(500).json({ error: 'Failed to fetch worker.' });
  }
});

// PUT /api/workers/:id
router.put('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { position, skills } = req.body;

    const data = {};
    if (position !== undefined) data.position = position;
    if (skills !== undefined) {
      data.skills = Array.isArray(skills) ? JSON.stringify(skills) : String(skills || '[]');
    }

    const worker = await prisma.worker.update({
      where: { id: req.params.id },
      data,
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, status: true },
        },
      },
    });

    res.json(formatWorker(worker));
  } catch (error) {
    console.error('Update worker error:', error);
    res.status(500).json({ error: 'Failed to update worker.' });
  }
});

// PATCH /api/workers/:id/status
router.patch('/:id/status', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE.' });
    }

    const worker = await prisma.worker.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        user: { select: { fullName: true, email: true } },
      },
    });

    res.json(formatWorker(worker));
  } catch (error) {
    console.error('Update worker status error:', error);
    res.status(500).json({ error: 'Failed to update worker status.' });
  }
});

module.exports = router;
