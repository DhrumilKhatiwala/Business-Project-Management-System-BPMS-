const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/projects - Project dashboard stats
router.get('/projects', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const [
      totalProjects,
      activeProjects,
      completedProjects,
      onHoldProjects,
      totalTasks,
      pendingTasks,
      inProgressTasks,
      completedTasks,
      upcomingMilestones,
      recentProjects,
    ] = await Promise.all([
      prisma.project.count(),
      prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.project.count({ where: { status: 'COMPLETED' } }),
      prisma.project.count({ where: { status: 'ON_HOLD' } }),
      prisma.task.count(),
      prisma.task.count({ where: { status: 'PENDING' } }),
      prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { status: 'COMPLETED' } }),
      prisma.milestone.findMany({
        where: {
          status: { not: 'COMPLETED' },
          dueDate: { gte: new Date() },
        },
        include: { project: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      prisma.project.findMany({
        include: {
          _count: { select: { tasks: true, milestones: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    res.json({
      stats: {
        totalProjects,
        activeProjects,
        completedProjects,
        onHoldProjects,
        totalTasks,
        pendingTasks,
        inProgressTasks,
        completedTasks,
      },
      upcomingMilestones,
      recentProjects,
    });
  } catch (error) {
    console.error('Project dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});

// GET /api/dashboard/inventory - Inventory dashboard stats
router.get('/inventory', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const materials = await prisma.material.findMany({ where: { status: 'ACTIVE' } });

    const totalMaterials = materials.length;
    const inStock = materials.filter(m => m.quantity > m.minStockLevel).length;
    const lowStock = materials.filter(m => m.quantity > 0 && m.quantity <= m.minStockLevel).length;
    const outOfStock = materials.filter(m => m.quantity === 0).length;
    const totalValue = materials.reduce((sum, m) => sum + (m.quantity * m.costPerUnit), 0);

    const activeAlerts = await prisma.lowStockAlert.count({ where: { status: 'ACTIVE' } });

    const recentUpdates = await prisma.stockUpdate.findMany({
      include: {
        material: { select: { name: true, unit: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });


    res.json({
      stats: {
        totalMaterials,
        inStock,
        lowStock,
        outOfStock,
        totalValue,
        activeAlerts,
      },
      recentUpdates,
    });
  } catch (error) {
    console.error('Inventory dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory dashboard.' });
  }
});

// GET /api/dashboard/overview - Main dashboard for Business Owner
router.get('/overview', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'BUSINESS_OWNER') {
      const [totalUsers, totalProjects, activeProjects, totalTasks, pendingTasks, activeAlerts, totalWorkers] = await Promise.all([
        prisma.user.count(),
        prisma.project.count(),
        prisma.project.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.task.count(),
        prisma.task.count({ where: { status: { not: 'COMPLETED' } } }),
        prisma.lowStockAlert.count({ where: { status: 'ACTIVE' } }),
        prisma.worker.count({ where: { status: 'ACTIVE' } }),
      ]);

      return res.json({
        role: 'BUSINESS_OWNER',
        stats: { totalUsers, totalProjects, activeProjects, totalTasks, pendingTasks, activeAlerts, totalWorkers },
      });
    }

    if (req.user.role === 'WORKER') {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user.id } });
      if (!worker) return res.json({ role: 'WORKER', stats: {} });

      const [totalTasks, pendingTasks, inProgressTasks, completedTasks, assignedProjects] = await Promise.all([
        prisma.task.count({ where: { assignedToId: worker.id } }),
        prisma.task.count({ where: { assignedToId: worker.id, status: 'PENDING' } }),
        prisma.task.count({ where: { assignedToId: worker.id, status: 'IN_PROGRESS' } }),
        prisma.task.count({ where: { assignedToId: worker.id, status: 'COMPLETED' } }),
        prisma.projectAssignment.count({ where: { workerId: worker.id } }),
      ]);

      return res.json({
        role: 'WORKER',
        stats: { totalTasks, pendingTasks, inProgressTasks, completedTasks, assignedProjects },
      });
    }

    if (req.user.role === 'CLIENT') {
      const totalProjects = await prisma.project.count();
      const activeProjects = await prisma.project.count({ where: { status: 'IN_PROGRESS' } });
      const completedProjects = await prisma.project.count({ where: { status: 'COMPLETED' } });

      return res.json({
        role: 'CLIENT',
        stats: { totalProjects, activeProjects, completedProjects },
      });
    }

    res.json({ role: req.user.role, stats: {} });
  } catch (error) {
    console.error('Overview dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview.' });
  }
});

module.exports = router;
