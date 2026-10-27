const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper to format worker skills as array
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
      skills = worker.skills ? worker.skills.split(',').map((s) => s.trim()).filter(Boolean) : [];
    }
  }
  return { ...worker, skills };
}

// GET /api/workers - List workers for current Business Owner's company ONLY
router.get('/', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { search, status } = req.query;
    const companyId = req.user.companyId || '__NO_COMPANY__';

    const where = {
      OR: [
        { companyId },
        { ownerId: req.user.id },
      ],
    };

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
          select: { id: true, fullName: true, email: true, phone: true, status: true, companyId: true, ownerId: true },
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

// GET /api/workers/me - Current worker's profile with verified Owner and Company details
router.get('/me', authenticate, authorize('WORKER'), async (req, res) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, status: true, companyId: true, ownerId: true },
        },
        owner: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        company: {
          select: { id: true, name: true, description: true },
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

    // Hydrate owner details if needed
    let ownerDetails = worker.owner;
    if (!ownerDetails && worker.ownerId) {
      ownerDetails = await prisma.user.findUnique({
        where: { id: worker.ownerId },
        select: { id: true, fullName: true, email: true, phone: true },
      });
    }

    const formatted = formatWorker(worker);
    res.json({
      ...formatted,
      assignedOwner: ownerDetails || null,
      company: worker.company || null,
    });
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

// GET /api/workers/:id - Get worker by ID (scoped to business owner's company)
router.get('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const worker = await prisma.worker.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true, companyId: true, ownerId: true },
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

    // Enforce tenant boundary
    if (worker.companyId !== req.user.companyId && worker.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Worker belongs to another company.' });
    }

    res.json(formatWorker(worker));
  } catch (error) {
    console.error('Get worker error:', error);
    res.status(500).json({ error: 'Failed to fetch worker.' });
  }
});

// PUT /api/workers/:id - Update worker
router.put('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const existing = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Worker not found.' });
    }

    if (existing.companyId !== req.user.companyId && existing.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You cannot modify workers from another company.' });
    }

    const { position, skills } = req.body;
    const data = {};
    if (position !== undefined) data.position = position ? position.trim() : null;
    if (skills !== undefined) {
      data.skills = Array.isArray(skills)
        ? JSON.stringify(skills)
        : JSON.stringify(String(skills).split(',').map((s) => s.trim()).filter(Boolean));
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

// PATCH /api/workers/:id/status - Toggle worker status
router.patch('/:id/status', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE.' });
    }

    const existing = await prisma.worker.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Worker not found.' });
    }

    if (existing.companyId !== req.user.companyId && existing.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You cannot modify workers from another company.' });
    }

    const worker = await prisma.worker.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        user: { select: { fullName: true, email: true } },
      },
    });

    // Also sync User status
    if (worker.userId) {
      await prisma.user.update({
        where: { id: worker.userId },
        data: { status },
      });
    }

    res.json(formatWorker(worker));
  } catch (error) {
    console.error('Update worker status error:', error);
    res.status(500).json({ error: 'Failed to update worker status.' });
  }
});

// POST /api/workers - Create new worker (permanently bound to Business Owner's company)
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

    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const companyId = req.user.companyId;
    const ownerId = req.user.id;

    // Create user permanently associated with the business owner and company
    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role: 'WORKER',
        phone: phone ? phone.trim() : null,
        companyId,
        ownerId,
        status: 'ACTIVE',
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

    // Create worker profile with verified permanent relationship
    const worker = await prisma.worker.create({
      data: {
        userId: user.id,
        position: position ? position.trim() : null,
        skills: formattedSkills,
        status: 'ACTIVE',
        companyId,
        ownerId,
      },
      include: {
        user: {
          select: { id: true, fullName: true, email: true, phone: true, status: true, createdAt: true, companyId: true, ownerId: true },
        },
        owner: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        company: {
          select: { id: true, name: true },
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

    if (worker.companyId !== req.user.companyId && worker.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You cannot delete workers from another company.' });
    }

    // 1. Unassign tasks
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
