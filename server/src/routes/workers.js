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
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
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

// POST /api/workers - Create new worker (creates user + worker profile)
router.post('/', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { fullName, email, password, phone, position, skills } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: 'WORKER',
        phone: phone ? phone.trim() : null,
      },
    });

    let formattedSkills = '[]';
    if (skills) {
      if (Array.isArray(skills)) {
        formattedSkills = JSON.stringify(skills);
      } else if (typeof skills === 'string') {
        const split = skills.split(',').map((s) => s.trim()).filter(Boolean);
        formattedSkills = JSON.stringify(split);
      }
    }

    const worker = await prisma.worker.create({
      data: {
        userId: user.id,
        position: position ? position.trim() : null,
        skills: formattedSkills,
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true },
        },
      },
    });

    res.status(201).json(formatWorker(worker));
  } catch (error) {
    console.error('Create worker error:', error);
    res.status(500).json({ error: 'Failed to create worker.' });
  }
});

// DELETE /api/workers/:id - Delete worker
router.delete('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { id } = req.params;

    const worker = await prisma.worker.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!worker) {
      return res.status(404).json({ error: 'Worker not found.' });
    }

    // 1. Unassign tasks assigned to this worker
    await prisma.task.updateMany({
      where: { assignedToId: worker.id },
      data: { assignedToId: null },
    });

    // 2. Delete project assignments
    await prisma.projectAssignment.deleteMany({
      where: { workerId: worker.id },
    });

    // 3. Delete worker record
    await prisma.worker.delete({
      where: { id: worker.id },
    });

    // 4. Delete user account
    if (worker.userId) {
      await prisma.user.delete({
        where: { id: worker.userId },
      });
    }

    res.json({ message: 'Worker deleted successfully.' });
  } catch (error) {
    console.error('Delete worker error:', error);
    res.status(500).json({ error: 'Failed to delete worker.' });
  }
});

module.exports = router;
