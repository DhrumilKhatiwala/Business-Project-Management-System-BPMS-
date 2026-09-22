const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper: recalculate project progress based on tasks
async function recalculateProjectProgress(projectId) {
  const tasks = await prisma.task.findMany({ where: { projectId } });
  if (tasks.length === 0) return;

  const completed = tasks.filter(t => t.status === 'COMPLETED').length;
  const progress = Math.round((completed / tasks.length) * 100);

  await prisma.project.update({
    where: { id: projectId },
    data: { progress },
  });
}

// GET /api/tasks?projectId=
router.get('/', authenticate, async (req, res) => {
  try {
    const { projectId, status, assignedToId } = req.query;
    const where = {};

    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;

    // Workers only see their own tasks
    if (req.user.role === 'WORKER') {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user.id } });
      if (!worker) return res.json([]);
      where.assignedToId = worker.id;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: {
          include: { user: { select: { fullName: true } } },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    res.json(tasks);
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

// POST /api/tasks
router.post('/', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { title, description, priority, dueDate, projectId, assignedToId } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required.' });
    }
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (assignedToId) {
      const worker = await prisma.worker.findUnique({ where: { id: assignedToId } });
      if (!worker) {
        return res.status(404).json({ error: 'Assigned worker not found.' });
      }
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description || null,
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId,
        assignedToId: assignedToId || null,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: {
          include: { user: { select: { fullName: true } } },
        },
      },
    });

    await recalculateProjectProgress(projectId);
    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// GET /api/tasks/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: {
          include: { user: { select: { fullName: true, email: true } } },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Workers can only view their own tasks
    if (req.user.role === 'WORKER') {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user.id } });
      if (!worker || task.assignedToId !== worker.id) {
        return res.status(403).json({ error: 'Access denied.' });
      }
    }

    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to fetch task.' });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Workers can only update status of their own tasks
    if (req.user.role === 'WORKER') {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user.id } });
      if (!worker || task.assignedToId !== worker.id) {
        return res.status(403).json({ error: 'Access denied. This task is not assigned to you.' });
      }
      // Workers can only update status
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Status is required.' });
      }

      const updatedTask = await prisma.task.update({
        where: { id: req.params.id },
        data: { status },
        include: {
          project: { select: { id: true, name: true } },
          assignedTo: { include: { user: { select: { fullName: true } } } },
        },
      });

      await recalculateProjectProgress(task.projectId);
      return res.json(updatedTask);
    }

    // Business Owner can update everything
    const { title, description, status, priority, dueDate, assignedToId } = req.body;

    if (assignedToId) {
      const worker = await prisma.worker.findUnique({ where: { id: assignedToId } });
      if (!worker) {
        return res.status(404).json({ error: 'Assigned worker not found.' });
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(assignedToId !== undefined && { assignedToId: assignedToId || null }),
      },
      include: {
        project: { select: { id: true, name: true } },
        assignedTo: { include: { user: { select: { fullName: true } } } },
      },
    });

    await recalculateProjectProgress(task.projectId);
    res.json(updatedTask);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    await prisma.task.delete({ where: { id: req.params.id } });
    await recalculateProjectProgress(task.projectId);
    res.json({ message: 'Task deleted.' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

module.exports = router;
