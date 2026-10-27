const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/projects - Project dashboard stats scoped to Business Owner's company
router.get('/projects', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const companyId = req.user.companyId || '__NO_COMPANY__';

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
      prisma.project.count({ where: { companyId } }),
      prisma.project.count({ where: { companyId, status: 'IN_PROGRESS' } }),
      prisma.project.count({ where: { companyId, status: 'COMPLETED' } }),
      prisma.project.count({ where: { companyId, status: 'ON_HOLD' } }),
      prisma.task.count({ where: { project: { companyId } } }),
      prisma.task.count({ where: { project: { companyId }, status: 'PENDING' } }),
      prisma.task.count({ where: { project: { companyId }, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { project: { companyId }, status: 'COMPLETED' } }),
      prisma.milestone.findMany({
        where: {
          project: { companyId },
          status: { not: 'COMPLETED' },
          dueDate: { gte: new Date() },
        },
        include: { project: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      prisma.project.findMany({
        where: { companyId },
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

// GET /api/dashboard/inventory - Inventory dashboard stats scoped to Business Owner's company
router.get('/inventory', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const companyId = req.user.companyId || '__NO_COMPANY__';

    const materials = await prisma.material.findMany({
      where: { companyId, status: 'ACTIVE' },
    });

    const totalMaterials = materials.length;
    const inStock = materials.filter((m) => m.quantity > m.minStockLevel).length;
    const lowStock = materials.filter((m) => m.quantity > 0 && m.quantity <= m.minStockLevel).length;
    const outOfStock = materials.filter((m) => m.quantity === 0).length;
    const totalValue = materials.reduce((sum, m) => sum + m.quantity * m.costPerUnit, 0);

    const activeAlerts = await prisma.lowStockAlert.count({
      where: {
        status: 'ACTIVE',
        OR: [{ companyId }, { material: { companyId } }],
      },
    });

    const recentUpdates = await prisma.stockUpdate.findMany({
      where: { material: { companyId } },
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

// GET /api/dashboard/overview - Role-specific dashboard overview with strict data isolation
router.get('/overview', authenticate, async (req, res) => {
  try {
    // ── ADMIN: Platform-wide overview ──
    if (req.user.role === 'ADMIN') {
      const [
        totalCompanies,
        totalBusinessOwners,
        activeBusinessOwners,
        totalClients,
        totalWorkers,
        totalProjects,
        recentBusinessOwners,
      ] = await Promise.all([
        prisma.company.count(),
        prisma.user.count({ where: { role: 'BUSINESS_OWNER' } }),
        prisma.user.count({ where: { role: 'BUSINESS_OWNER', status: 'ACTIVE' } }),
        prisma.user.count({ where: { role: 'CLIENT' } }),
        prisma.user.count({ where: { role: 'WORKER' } }),
        prisma.project.count(),
        prisma.user.findMany({
          where: { role: 'BUSINESS_OWNER' },
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            status: true,
            companyId: true,
            ownedCompany: { select: { id: true, name: true } },
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
      ]);

      return res.json({
        role: 'ADMIN',
        stats: {
          totalCompanies,
          totalBusinessOwners,
          activeBusinessOwners,
          totalClients,
          totalWorkers,
          totalProjects,
        },
        recentBusinessOwners,
      });
    }

    // ── BUSINESS_OWNER: Strictly scoped to their own company ──
    if (req.user.role === 'BUSINESS_OWNER') {
      const companyId = req.user.companyId || '__NO_COMPANY__';

      const [
        totalUsers,
        totalProjects,
        activeProjects,
        totalTasks,
        pendingTasks,
        activeAlerts,
        totalWorkers,
        totalClients,
      ] = await Promise.all([
        prisma.user.count({ where: { companyId, role: { in: ['CLIENT', 'WORKER'] } } }),
        prisma.project.count({ where: { companyId } }),
        prisma.project.count({ where: { companyId, status: 'IN_PROGRESS' } }),
        prisma.task.count({ where: { project: { companyId } } }),
        prisma.task.count({ where: { project: { companyId }, status: { not: 'COMPLETED' } } }),
        prisma.lowStockAlert.count({
          where: {
            status: 'ACTIVE',
            OR: [{ companyId }, { material: { companyId } }],
          },
        }),
        prisma.worker.count({
          where: {
            status: 'ACTIVE',
            OR: [{ companyId }, { ownerId: req.user.id }],
          },
        }),
        prisma.user.count({ where: { companyId, role: 'CLIENT' } }),
      ]);

      return res.json({
        role: 'BUSINESS_OWNER',
        company: req.user.company || req.user.ownedCompany || null,
        stats: {
          totalUsers,
          totalProjects,
          activeProjects,
          totalTasks,
          pendingTasks,
          activeAlerts,
          totalWorkers,
          totalClients,
        },
      });
    }

    // ── WORKER: Scoped to their assigned tasks and ONLY their assigned Business Owner ──
    if (req.user.role === 'WORKER') {
      const worker = await prisma.worker.findUnique({
        where: { userId: req.user.id },
        include: {
          assignments: {
            include: {
              project: {
                select: { id: true, name: true, status: true, progress: true, startDate: true, endDate: true },
              },
            },
          },
        },
      });

      if (!worker) {
        return res.json({
          role: 'WORKER',
          stats: {},
          myRecentTasks: [],
          myProjects: [],
          assignedOwner: null,
          company: null,
        });
      }

      // Fetch assigned owner details
      const ownerId = worker.ownerId || req.user.ownerId;
      let assignedOwner = null;
      if (ownerId) {
        assignedOwner = await prisma.user.findUnique({
          where: { id: ownerId },
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            ownedCompany: { select: { id: true, name: true, description: true } },
          },
        });
      }

      const [totalTasks, pendingTasks, inProgressTasks, completedTasks, assignedProjects, myRecentTasks] =
        await Promise.all([
          prisma.task.count({ where: { assignedToId: worker.id } }),
          prisma.task.count({ where: { assignedToId: worker.id, status: 'PENDING' } }),
          prisma.task.count({ where: { assignedToId: worker.id, status: 'IN_PROGRESS' } }),
          prisma.task.count({ where: { assignedToId: worker.id, status: 'COMPLETED' } }),
          prisma.projectAssignment.count({ where: { workerId: worker.id } }),
          prisma.task.findMany({
            where: { assignedToId: worker.id, status: { not: 'COMPLETED' } },
            include: { project: { select: { id: true, name: true } } },
            orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
            take: 6,
          }),
        ]);

      const myProjects = worker.assignments.map((a) => a.project);

      return res.json({
        role: 'WORKER',
        stats: { totalTasks, pendingTasks, inProgressTasks, completedTasks, assignedProjects },
        myRecentTasks,
        myProjects,
        assignedOwner: assignedOwner || null,
        company: req.user.company || assignedOwner?.ownedCompany || null,
      });
    }

    // ── CLIENT: Strictly their contracted projects and their assigned Business Owner ──
    if (req.user.role === 'CLIENT') {
      const where = { clientId: req.user.id };
      if (req.user.companyId) where.companyId = req.user.companyId;

      const [totalProjects, activeProjects, completedProjects, projects] = await Promise.all([
        prisma.project.count({ where }),
        prisma.project.count({ where: { ...where, status: 'IN_PROGRESS' } }),
        prisma.project.count({ where: { ...where, status: 'COMPLETED' } }),
        prisma.project.findMany({
          where,
          include: {
            createdBy: { select: { fullName: true, email: true, phone: true } },
            _count: { select: { tasks: true, milestones: true, materials: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
      ]);

      const ownerId = req.user.ownerId;
      let assignedOwner = null;
      if (ownerId) {
        assignedOwner = await prisma.user.findUnique({
          where: { id: ownerId },
          select: { id: true, fullName: true, email: true, phone: true },
        });
      }

      return res.json({
        role: 'CLIENT',
        stats: { totalProjects, activeProjects, completedProjects },
        projects,
        assignedOwner: assignedOwner || null,
        company: req.user.company || null,
      });
    }

    res.json({ role: req.user.role, stats: {} });
  } catch (error) {
    console.error('Overview dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview.' });
  }
});

module.exports = router;
