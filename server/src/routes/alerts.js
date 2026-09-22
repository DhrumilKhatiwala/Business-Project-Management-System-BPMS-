const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/alerts/low-stock
router.get('/low-stock', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const alerts = await prisma.lowStockAlert.findMany({
      where,
      include: {
        material: { select: { id: true, name: true, unit: true, category: true } },
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
