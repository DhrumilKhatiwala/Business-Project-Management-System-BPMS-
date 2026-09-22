const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper: Check and create low-stock alert
async function checkLowStock(materialId, userId) {
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) return;

  if (material.quantity <= material.minStockLevel) {
    // Check if there's already an active alert for this material
    const existingAlert = await prisma.lowStockAlert.findFirst({
      where: { materialId, status: 'ACTIVE' },
    });

    if (!existingAlert) {
      await prisma.lowStockAlert.create({
        data: {
          materialId,
          currentQuantity: material.quantity,
          minStockLevel: material.minStockLevel,
        },
      });
    } else {
      // Update existing alert with current quantity
      await prisma.lowStockAlert.update({
        where: { id: existingAlert.id },
        data: { currentQuantity: material.quantity },
      });
    }
  } else {
    // Resolve any active alerts if stock is above threshold
    await prisma.lowStockAlert.updateMany({
      where: { materialId, status: 'ACTIVE' },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    });
  }
}

// GET /api/materials
router.get('/', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { search, category, status } = req.query;
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
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

    // Add availability status
    const materialsWithAvailability = materials.map(m => ({
      ...m,
      availability: m.quantity === 0 ? 'OUT_OF_STOCK'
        : m.quantity <= m.minStockLevel ? 'LOW_STOCK'
        : 'IN_STOCK',
    }));

    res.json(materialsWithAvailability);
  } catch (error) {
    console.error('List materials error:', error);
    res.status(500).json({ error: 'Failed to fetch materials.' });
  }
});

// GET /api/materials/categories
router.get('/categories', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const categories = await prisma.material.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });
    res.json(categories.map(c => c.category));
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

    const availability = material.quantity === 0 ? 'OUT_OF_STOCK'
      : material.quantity <= material.minStockLevel ? 'LOW_STOCK'
      : 'IN_STOCK';

    res.json({ ...material, availability });
  } catch (error) {
    console.error('Get material error:', error);
    res.status(500).json({ error: 'Failed to fetch material.' });
  }
});

// POST /api/materials
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
      },
    });

    // Check low stock on creation
    await checkLowStock(material.id, req.user.id);

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

    // Re-check low stock if min level changed
    await checkLowStock(material.id, req.user.id);

    res.json(material);
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ error: 'Failed to update material.' });
  }
});

// DELETE /api/materials/:id
router.delete('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
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

    // Update stock and create history record in a transaction
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

    // Check low stock after update
    await checkLowStock(req.params.id, req.user.id);

    res.json({ material: updatedMaterial, stockUpdate });
  } catch (error) {
    console.error('Stock update error:', error);
    res.status(500).json({ error: 'Failed to update stock.' });
  }
});

// GET /api/materials/:id/stock-history
router.get('/:id/stock-history', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
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
