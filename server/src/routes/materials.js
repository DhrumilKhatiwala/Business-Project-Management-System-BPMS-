const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper: Check and create low-stock alert scoped to company
async function checkLowStock(materialId, companyId) {
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) return;

  const compId = companyId || material.companyId;

  if (material.quantity <= material.minStockLevel) {
    const existingAlert = await prisma.lowStockAlert.findFirst({
      where: { materialId, status: 'ACTIVE' },
    });

    if (!existingAlert) {
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
        where: { id: existingAlert.id },
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

// GET /api/materials - List materials scoped to current Business Owner's company
router.get('/', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { search, category, status } = req.query;
    const companyId = req.user.companyId || '__NO_COMPANY__';

    const where = { companyId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = category;
    if (status) where.status = status;

    const materials = await prisma.material.findMany({
      where,
      include: {
        _count: { select: { lowStockAlerts: { where: { status: 'ACTIVE' } } } },
      },
      orderBy: { name: 'asc' },
    });

    const materialsWithAvailability = materials.map((m) => ({
      ...m,
      availability:
        m.quantity === 0
          ? 'OUT_OF_STOCK'
          : m.quantity <= m.minStockLevel
          ? 'LOW_STOCK'
          : 'IN_STOCK',
    }));

    res.json(materialsWithAvailability);
  } catch (error) {
    console.error('List materials error:', error);
    res.status(500).json({ error: 'Failed to fetch materials.' });
  }
});

// GET /api/materials/categories - Distinct categories for current company
router.get('/categories', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const companyId = req.user.companyId || '__NO_COMPANY__';
    const categories = await prisma.material.findMany({
      where: {
        companyId,
        category: { not: null },
      },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    res.json(categories.map((c) => c.category));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

// GET /api/materials/:id
router.get('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const material = await prisma.material.findUnique({
      where: { id: req.params.id },
      include: {
        stockUpdates: {
          include: { createdBy: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        lowStockAlerts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!material) {
      return res.status(404).json({ error: 'Material not found.' });
    }

    if (material.companyId !== req.user.companyId && material.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Material belongs to another company.' });
    }

    const availability =
      material.quantity === 0
        ? 'OUT_OF_STOCK'
        : material.quantity <= material.minStockLevel
        ? 'LOW_STOCK'
        : 'IN_STOCK';

    res.json({ ...material, availability });
  } catch (error) {
    console.error('Get material error:', error);
    res.status(500).json({ error: 'Failed to fetch material.' });
  }
});

// POST /api/materials - Create material for current Business Owner's company
router.post('/', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { name, description, category, unit, quantity, minStockLevel, costPerUnit, supplier } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Material name is required.' });
    }
    if (quantity !== undefined && quantity < 0) {
      return res.status(400).json({ error: 'Quantity cannot be negative.' });
    }
    if (costPerUnit !== undefined && costPerUnit < 0) {
      return res.status(400).json({ error: 'Cost per unit cannot be negative.' });
    }
    if (minStockLevel !== undefined && minStockLevel < 0) {
      return res.status(400).json({ error: 'Minimum stock level cannot be negative.' });
    }

    const material = await prisma.material.create({
      data: {
        name: name.trim(),
        description: description || null,
        category: category || null,
        unit: unit || 'pcs',
        quantity: quantity || 0,
        minStockLevel: minStockLevel || 10,
        costPerUnit: costPerUnit || 0,
        supplier: supplier || null,
        companyId: req.user.companyId,
        createdById: req.user.id,
      },
    });

    // Initial stock update record if quantity > 0
    if (quantity && quantity > 0) {
      await prisma.stockUpdate.create({
        data: {
          materialId: material.id,
          type: 'ADD',
          quantity,
          previousQty: 0,
          newQty: quantity,
          note: 'Initial inventory stocking',
          createdById: req.user.id,
        },
      });
    }

    // Check low stock on creation
    await checkLowStock(material.id, req.user.companyId);

    res.status(201).json(material);
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ error: 'Failed to create material.' });
  }
});

// PUT /api/materials/:id
router.put('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { name, description, category, unit, minStockLevel, costPerUnit, supplier, status } = req.body;

    const existing = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Material not found.' });
    }

    if (existing.companyId !== req.user.companyId && existing.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You cannot modify materials from another company.' });
    }

    if (costPerUnit !== undefined && costPerUnit < 0) {
      return res.status(400).json({ error: 'Cost per unit cannot be negative.' });
    }
    if (minStockLevel !== undefined && minStockLevel < 0) {
      return res.status(400).json({ error: 'Minimum stock level cannot be negative.' });
    }

    const material = await prisma.material.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(unit && { unit }),
        ...(minStockLevel !== undefined && { minStockLevel }),
        ...(costPerUnit !== undefined && { costPerUnit }),
        ...(supplier !== undefined && { supplier }),
        ...(status && { status }),
      },
    });

    await checkLowStock(material.id, req.user.companyId);

    res.json(material);
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ error: 'Failed to update material.' });
  }
});

// DELETE /api/materials/:id
router.delete('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const existing = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Material not found.' });
    }

    if (existing.companyId !== req.user.companyId && existing.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You cannot delete materials from another company.' });
    }

    await prisma.material.delete({ where: { id: req.params.id } });
    res.json({ message: 'Material deleted.' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Failed to delete material.' });
  }
});

// POST /api/materials/:id/stock - Add/Deduct stock
router.post('/:id/stock', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { type, quantity, note } = req.body;

    if (!type || !['ADD', 'DEDUCT'].includes(type)) {
      return res.status(400).json({ error: 'Type must be ADD or DEDUCT.' });
    }
    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive number.' });
    }

    const material = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!material) {
      return res.status(404).json({ error: 'Material not found.' });
    }

    if (material.companyId !== req.user.companyId && material.createdById !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const previousQty = material.quantity;
    let newQty;

    if (type === 'ADD') {
      newQty = previousQty + quantity;
    } else {
      if (quantity > previousQty) {
        return res.status(400).json({
          error: `Cannot deduct ${quantity}. Current stock is ${previousQty}.`,
        });
      }
      newQty = previousQty - quantity;
    }

    const [updatedMaterial, stockUpdate] = await prisma.$transaction([
      prisma.material.update({
        where: { id: req.params.id },
        data: { quantity: newQty },
      }),
      prisma.stockUpdate.create({
        data: {
          materialId: req.params.id,
          type,
          quantity,
          previousQty,
          newQty,
          note: note || null,
          createdById: req.user.id,
        },
        include: { createdBy: { select: { fullName: true } } },
      }),
    ]);

    await checkLowStock(req.params.id, req.user.companyId);

    res.json({ material: updatedMaterial, stockUpdate });
  } catch (error) {
    console.error('Stock update error:', error);
    res.status(500).json({ error: 'Failed to update stock.' });
  }
});

// GET /api/materials/:id/stock-history
router.get('/:id/stock-history', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const material = await prisma.material.findUnique({ where: { id: req.params.id } });
    if (!material || (material.companyId !== req.user.companyId && material.createdById !== req.user.id)) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const history = await prisma.stockUpdate.findMany({
      where: { materialId: req.params.id },
      include: { createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(history);
  } catch (error) {
    console.error('Stock history error:', error);
    res.status(500).json({ error: 'Failed to fetch stock history.' });
  }
});

module.exports = router;
