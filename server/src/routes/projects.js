const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/projects
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, status } = req.query;
    const where = {};

    // CLIENT can only see projects they're associated with (via assignments through worker)
    // For now, clients can see all projects (business decision)
    if (req.user.role === 'WORKER') {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user.id } });
      if (worker) {
        where.assignments = { some: { workerId: worker.id } };
      } else {
        return res.json([]);
      }
    }

    if (search) {
      where.name = { contains: search };
    }
    if (status) where.status = status;

    const projects = await prisma.project.findMany({
      where,
      include: {
        createdBy: { select: { fullName: true } },
        _count: { select: { tasks: true, milestones: true, assignments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(projects);
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// GET /api/projects/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { fullName: true, email: true } },
        tasks: {
          include: {
            assignedTo: {
              include: { user: { select: { fullName: true } } },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        milestones: { orderBy: { dueDate: 'asc' } },
        assignments: {
          include: {
            worker: {
              include: { user: { select: { fullName: true, email: true } } },
            },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Workers can only see projects they're assigned to
    if (req.user.role === 'WORKER') {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user.id } });
      const isAssigned = project.assignments.some(a => a.workerId === worker?.id);
      if (!isAssigned) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project.' });
  }
});

// POST /api/projects
router.post('/', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { name, description, startDate, endDate } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'End date must be after start date.' });
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        createdById: req.user.id,
      },
      include: {
        createdBy: { select: { fullName: true } },
        _count: { select: { tasks: true, milestones: true, assignments: true } },
      },
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// PUT /api/projects/:id
router.put('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { name, description, status, startDate, endDate, progress } = req.body;

    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'End date must be after start date.' });
    }

    if (progress !== undefined && (progress < 0 || progress > 100)) {
      return res.status(400).json({ error: 'Progress must be between 0 and 100.' });
    }

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(progress !== undefined && { progress }),
      },
      include: {
        createdBy: { select: { fullName: true } },
        _count: { select: { tasks: true, milestones: true, assignments: true } },
      },
    });

    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project.' });
  }
});

// POST /api/projects/:id/assignments - Assign worker to project
router.post('/:id/assignments', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { workerId } = req.body;

    if (!workerId) {
      return res.status(400).json({ error: 'Worker ID is required.' });
    }

    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found.' });
    }

    // Check if already assigned
    const existingAssignment = await prisma.projectAssignment.findUnique({
      where: { projectId_workerId: { projectId: req.params.id, workerId } },
    });
    if (existingAssignment) {
      return res.status(409).json({ error: 'Worker is already assigned to this project.' });
    }

    const assignment = await prisma.projectAssignment.create({
      data: { projectId: req.params.id, workerId },
      include: {
        worker: {
          include: { user: { select: { fullName: true, email: true } } },
        },
        project: { select: { name: true } },
      },
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error('Assign worker error:', error);
    res.status(500).json({ error: 'Failed to assign worker.' });
  }
});

// DELETE /api/projects/:id/assignments/:assignmentId
router.delete('/:id/assignments/:assignmentId', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    await prisma.projectAssignment.delete({ where: { id: req.params.assignmentId } });
    res.json({ message: 'Assignment removed.' });
  } catch (error) {
    console.error('Remove assignment error:', error);
    res.status(500).json({ error: 'Failed to remove assignment.' });
  }
});

module.exports = router;
