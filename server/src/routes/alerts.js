const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/alerts/low-stock - List low stock alerts scoped to Business Owner's company
router.get('/low-stock', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { status } = req.query;
    const companyId = req.user.companyId || '__NO_COMPANY__';

    const where = {
      OR: [
        { companyId },
        { material: { companyId } },
      ],
    };

    if (status) where.status = status;

    const alerts = await prisma.lowStockAlert.findMany({
      where,
      include: {
        material: { select: { id: true, name: true, unit: true, category: true, companyId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(alerts);
  } catch (error) {
    console.error('List alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts.' });
  }
});

// PATCH /api/alerts/:id/resolve
router.patch('/:id/resolve', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const existing = await prisma.lowStockAlert.findUnique({
      where: { id: req.params.id },
      include: { material: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Alert not found.' });
    }

    if (existing.companyId !== req.user.companyId && existing.material?.companyId !== req.user.companyId) {
      return res.status(403).json({ error: 'Access denied. Alert belongs to another company.' });
    }

    const alert = await prisma.lowStockAlert.update({
      where: { id: req.params.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
      include: {
        material: { select: { name: true } },
      },
    });

    res.json(alert);
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ error: 'Failed to resolve alert.' });
  }
});

module.exports = router;
