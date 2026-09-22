const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/milestones?projectId=
router.get('/', authenticate, async (req, res) => {
  try {
    const { projectId, status } = req.query;
    const where = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const milestones = await prisma.milestone.findMany({
      where,
      include: {
        project: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    res.json(milestones);
  } catch (error) {
    console.error('List milestones error:', error);
    res.status(500).json({ error: 'Failed to fetch milestones.' });
  }
});

// POST /api/milestones
router.post('/', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { title, description, dueDate, projectId } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Milestone title is required.' });
    }
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const milestone = await prisma.milestone.create({
      data: {
        title: title.trim(),
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        projectId,
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(milestone);
  } catch (error) {
    console.error('Create milestone error:', error);
    res.status(500).json({ error: 'Failed to create milestone.' });
  }
});

// PATCH /api/milestones/:id
router.patch('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { title, description, dueDate, status } = req.body;

    const existing = await prisma.milestone.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Milestone not found.' });
    }

    const milestone = await prisma.milestone.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title: title.trim() }),
        ...(description !== undefined && { description }),
        ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
        ...(status && { status }),
      },
      include: {
        project: { select: { id: true, name: true } },
      },
    });

    res.json(milestone);
  } catch (error) {
    console.error('Update milestone error:', error);
    res.status(500).json({ error: 'Failed to update milestone.' });
  }
});

// DELETE /api/milestones/:id
router.delete('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    await prisma.milestone.delete({ where: { id: req.params.id } });
    res.json({ message: 'Milestone deleted.' });
  } catch (error) {
    console.error('Delete milestone error:', error);
    res.status(500).json({ error: 'Failed to delete milestone.' });
  }
});

module.exports = router;
