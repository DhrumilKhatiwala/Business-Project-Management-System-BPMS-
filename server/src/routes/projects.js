const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper: Check and manage low-stock alerts
async function syncLowStockAlert(materialId, companyId) {
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) return;

  const compId = companyId || material.companyId;

  if (material.quantity <= material.minStockLevel) {
    const existing = await prisma.lowStockAlert.findFirst({
      where: { materialId, status: 'ACTIVE' },
    });
    if (!existing) {
      await prisma.lowStockAlert.create({
        data: {
          materialId,
          currentQuantity: material.quantity,
          minStockLevel: material.minStockLevel,
          companyId: compId,
        },
      });
    } else {
      await prisma.lowStockAlert.update({
        where: { id: existing.id },
        data: { currentQuantity: material.quantity },
      });
    }
  } else {
    await prisma.lowStockAlert.updateMany({
      where: { materialId, status: 'ACTIVE' },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }
}

// GET /api/projects - List projects scoped by role and company
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, status } = req.query;
    const where = {};

    if (req.user.role === 'ADMIN') {
      // Platform-wide view
    } else if (req.user.role === 'BUSINESS_OWNER') {
      // Strictly scoped to Business Owner's company
      where.companyId = req.user.companyId || '__NO_COMPANY__';
    } else if (req.user.role === 'WORKER') {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user.id } });
      if (!worker) return res.json([]);
      where.companyId = req.user.companyId || worker.companyId || '__NO_COMPANY__';
      where.assignments = { some: { workerId: worker.id } };
    } else if (req.user.role === 'CLIENT') {
      where.clientId = req.user.id;
      if (req.user.companyId) {
        where.companyId = req.user.companyId;
      }
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (status) where.status = status;

    const projects = await prisma.project.findMany({
      where,
      include: {
        createdBy: { select: { fullName: true, email: true } },
        client: { select: { id: true, fullName: true, email: true } },
        _count: { select: { tasks: true, milestones: true, assignments: true, invoices: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(projects);
  } catch (error) {
    console.error('List projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// GET /api/projects/:id - Get project details with authorization check
router.get('/:id', authenticate, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { fullName: true, email: true } },
        client: { select: { id: true, fullName: true, email: true, phone: true } },
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
        materials: {
          include: { material: true },
          orderBy: { allocatedAt: 'desc' },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Role-based authorization
    if (req.user.role === 'BUSINESS_OWNER') {
      if (project.companyId !== req.user.companyId && project.createdById !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. Project belongs to another company.' });
      }
    } else if (req.user.role === 'WORKER') {
      const worker = await prisma.worker.findUnique({ where: { userId: req.user.id } });
      const isAssigned = project.assignments.some((a) => a.workerId === worker?.id);
      if (!isAssigned) {
        return res.status(403).json({ error: 'Access denied. You are not assigned to this project.' });
      }
    } else if (req.user.role === 'CLIENT') {
      if (project.clientId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. This project is not contracted to you.' });
      }
    }

    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to fetch project.' });
  }
});

// POST /api/projects - Create project for current Business Owner's company
router.post('/', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { name, description, startDate, endDate, clientId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'End date must be after start date.' });
    }

    // If client is specified, verify client belongs to this company
    if (clientId) {
      const client = await prisma.user.findUnique({ where: { id: clientId } });
      if (!client || (client.companyId !== req.user.companyId && client.ownerId !== req.user.id)) {
        return res.status(400).json({ error: 'Specified client does not belong to your company.' });
      }
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description: description || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        clientId: clientId || null,
        companyId: req.user.companyId,
        createdById: req.user.id,
      },
      include: {
        createdBy: { select: { fullName: true } },
        client: { select: { id: true, fullName: true, email: true } },
        _count: { select: { tasks: true, milestones: true, assignments: true } },
      },
    });

    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// PUT /api/projects/:id - Update project
router.put('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { name, description, status, startDate, endDate, progress, clientId } = req.body;

    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (existing.companyId !== req.user.companyId && existing.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You cannot edit projects from another company.' });
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'End date must be after start date.' });
    }

    if (progress !== undefined && (progress < 0 || progress > 100)) {
      return res.status(400).json({ error: 'Progress must be between 0 and 100.' });
    }

    if (clientId) {
      const client = await prisma.user.findUnique({ where: { id: clientId } });
      if (!client || (client.companyId !== req.user.companyId && client.ownerId !== req.user.id)) {
        return res.status(400).json({ error: 'Specified client does not belong to your company.' });
      }
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
        ...(clientId !== undefined && { clientId: clientId || null }),
      },
      include: {
        createdBy: { select: { fullName: true } },
        client: { select: { id: true, fullName: true, email: true } },
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

    if (project.companyId !== req.user.companyId && project.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Project belongs to another company.' });
    }

    const worker = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found.' });
    }

    // Ensure worker belongs to caller's company
    if (worker.companyId !== req.user.companyId && worker.ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Cannot assign a worker belonging to another company.' });
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

// DELETE /api/projects/:id/assignments/:assignmentId - Remove assignment
router.delete('/:id/assignments/:assignmentId', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project || (project.companyId !== req.user.companyId && project.createdById !== req.user.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await prisma.projectAssignment.delete({ where: { id: req.params.assignmentId } });
    res.json({ message: 'Assignment removed.' });
  } catch (error) {
    console.error('Remove assignment error:', error);
    res.status(500).json({ error: 'Failed to remove assignment.' });
  }
});

// GET /api/projects/:id/materials - List allocated materials
router.get('/:id/materials', authenticate, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Role verification
    if (req.user.role === 'BUSINESS_OWNER' && project.companyId !== req.user.companyId && project.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const allocations = await prisma.projectMaterial.findMany({
      where: { projectId: req.params.id },
      include: { material: true },
      orderBy: { allocatedAt: 'desc' },
    });

    const totalCost = allocations.reduce((sum, item) => {
      return sum + item.quantity * (item.material?.costPerUnit || 0);
    }, 0);

    const totalQuantity = allocations.reduce((sum, item) => sum + item.quantity, 0);

    res.json({
      allocations,
      stats: {
        totalItems: allocations.length,
        totalQuantity,
        totalCost: parseFloat(totalCost.toFixed(2)),
      },
    });
  } catch (error) {
    console.error('List project materials error:', error);
    res.status(500).json({ error: 'Failed to fetch project materials.' });
  }
});

// POST /api/projects/:id/materials - Allocate material from inventory to project
router.post('/:id/materials', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { materialId, quantity } = req.body;
    const qty = parseInt(quantity, 10);

    if (!materialId || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Valid material and positive quantity are required.' });
    }

    const project = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.companyId !== req.user.companyId && project.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Project belongs to another company.' });
    }

    const material = await prisma.material.findUnique({ where: { id: materialId } });
    if (!material) {
      return res.status(404).json({ error: 'Material not found.' });
    }

    // Prevent cross-company material allocation
    if (material.companyId !== req.user.companyId && material.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Cannot allocate material belonging to another company.' });
    }

    if (material.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Cannot allocate inactive material.' });
    }

    if (material.quantity < qty) {
      return res.status(400).json({
        error: `Insufficient stock. Only ${material.quantity} ${material.unit} available in inventory.`,
      });
    }

    const previousQty = material.quantity;
    const newQty = previousQty - qty;

    const result = await prisma.$transaction(async (tx) => {
      await tx.material.update({
        where: { id: materialId },
        data: { quantity: newQty },
      });

      await tx.stockUpdate.create({
        data: {
          materialId,
          type: 'DEDUCT',
          quantity: qty,
          previousQty,
          newQty,
          note: `Allocated to Project: ${project.name}`,
          createdById: req.user.id,
        },
      });

      const existing = await tx.projectMaterial.findUnique({
        where: { projectId_materialId: { projectId: req.params.id, materialId } },
      });

      let allocation;
      if (existing) {
        allocation = await tx.projectMaterial.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + qty },
          include: { material: true },
        });
      } else {
        allocation = await tx.projectMaterial.create({
          data: {
            projectId: req.params.id,
            materialId,
            quantity: qty,
          },
          include: { material: true },
        });
      }

      return allocation;
    });

    await syncLowStockAlert(materialId, req.user.companyId);

    res.status(201).json(result);
  } catch (error) {
    console.error('Allocate material error:', error);
    res.status(500).json({ error: 'Failed to allocate material to project.' });
  }
});

// DELETE /api/projects/:id/materials/:allocationId - Return material to inventory
router.delete('/:id/materials/:allocationId', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const allocation = await prisma.projectMaterial.findUnique({
      where: { id: req.params.allocationId },
      include: { material: true, project: true },
    });

    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found.' });
    }

    if (allocation.project.companyId !== req.user.companyId && allocation.project.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const returnQty = allocation.quantity;
    const previousQty = allocation.material.quantity;
    const newQty = previousQty + returnQty;

    await prisma.$transaction(async (tx) => {
      await tx.projectMaterial.delete({ where: { id: req.params.allocationId } });

      await tx.material.update({
        where: { id: allocation.materialId },
        data: { quantity: newQty },
      });

      await tx.stockUpdate.create({
        data: {
          materialId: allocation.materialId,
          type: 'ADD',
          quantity: returnQty,
          previousQty,
          newQty,
          note: `Deallocated & returned from Project: ${allocation.project.name}`,
          createdById: req.user.id,
        },
      });
    });

    await syncLowStockAlert(allocation.materialId, req.user.companyId);

    res.json({ message: 'Material deallocated and returned to inventory.' });
  } catch (error) {
    console.error('Deallocate material error:', error);
    res.status(500).json({ error: 'Failed to deallocate material.' });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.companyId !== req.user.companyId && project.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You cannot delete projects from another company.' });
    }

    await prisma.$transaction([
      prisma.projectMaterial.deleteMany({ where: { projectId: id } }),
      prisma.projectAssignment.deleteMany({ where: { projectId: id } }),
      prisma.task.deleteMany({ where: { projectId: id } }),
      prisma.milestone.deleteMany({ where: { projectId: id } }),
      prisma.invoice.deleteMany({ where: { projectId: id } }),
      prisma.expense.deleteMany({ where: { projectId: id } }),
      prisma.project.delete({ where: { id } }),
    ]);

    res.json({ message: 'Project deleted successfully.' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

module.exports = router;
