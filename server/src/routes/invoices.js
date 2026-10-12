const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Helper to format line items
function formatInvoice(invoice) {
  if (!invoice) return invoice;
  let items = [];
  if (Array.isArray(invoice.items)) {
    items = invoice.items;
  } else if (typeof invoice.items === 'string') {
    try {
      items = JSON.parse(invoice.items);
      if (!Array.isArray(items)) items = [];
    } catch {
      items = [];
    }
  }
  return { ...invoice, items };
}

// GET /api/invoices/stats/overview - Financial KPIs & Profit/Debt
router.get('/stats/overview', authenticate, async (req, res) => {
  try {
    const isClient = req.user.role === 'CLIENT';
    const invoiceWhere = isClient ? { clientId: req.user.id } : {};
    const expenseWhere = isClient ? { project: { clientId: req.user.id } } : {};

    const [invoices, expenses] = await Promise.all([
      prisma.invoice.findMany({ where: invoiceWhere }),
      prisma.expense.findMany({ where: expenseWhere }),
    ]);

    const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalCollected = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    const totalPending = totalInvoiced - totalCollected;
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    const overdueCount = invoices.filter(inv => {
      return inv.status === 'OVERDUE' || (inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'PAID');
    }).length;

    // Profit = Total Collected - Expenses; Debt/Pending Receivable = Total Pending
    const netProfit = totalCollected - totalExpenses;

    res.json({
      totalInvoiced: parseFloat(totalInvoiced.toFixed(2)),
      totalCollected: parseFloat(totalCollected.toFixed(2)),
      totalPending: parseFloat(totalPending.toFixed(2)),
      totalExpenses: parseFloat(totalExpenses.toFixed(2)),
      netProfit: parseFloat(netProfit.toFixed(2)),
      overdueCount,
      invoiceCount: invoices.length,
    });
  } catch (error) {
    console.error('Invoice stats error:', error);
    res.status(500).json({ error: 'Failed to fetch financial stats.' });
  }
});

// GET /api/invoices - List invoices
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, status, projectId, clientId } = req.query;
    const where = {};

    // Role Scoping
    if (req.user.role === 'CLIENT') {
      where.clientId = req.user.id;
    } else if (clientId) {
      where.clientId = clientId;
    }

    if (status) where.status = status;
    if (projectId) where.projectId = projectId;

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { project: { name: { contains: search, mode: 'insensitive' } } },
        { client: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, status: true, progress: true } },
        client: { select: { id: true, fullName: true, email: true, phone: true } },
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { payments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(invoices.map(formatInvoice));
  } catch (error) {
    console.error('List invoices error:', error);
    res.status(500).json({ error: 'Failed to fetch invoices.' });
  }
});

// GET /api/invoices/:id - Single invoice with payments
router.get('/:id', authenticate, async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        project: { select: { id: true, name: true, status: true, progress: true } },
        client: { select: { id: true, fullName: true, email: true, phone: true } },
        createdBy: { select: { id: true, fullName: true, email: true } },
        payments: {
          include: { recordedBy: { select: { fullName: true } } },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    if (req.user.role === 'CLIENT' && invoice.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json(formatInvoice(invoice));
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to fetch invoice.' });
  }
});

// POST /api/invoices - Create invoice (Business Owner only)
router.post('/', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { invoiceNumber, projectId, clientId, amount, dueDate, notes, items } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project is required.' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'A positive invoice amount is required.' });
    }

    // Auto-generate invoice number if not provided
    let num = invoiceNumber?.trim();
    if (!num) {
      const count = await prisma.invoice.count();
      num = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;
    }

    // Verify project exists
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Determine client: either from payload or from the project's linked client
    const targetClientId = clientId || project.clientId || null;

    let serializedItems = '[]';
    if (items) {
      serializedItems = Array.isArray(items) ? JSON.stringify(items) : String(items);
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: num,
        projectId,
        clientId: targetClientId,
        amount: parsedAmount,
        paidAmount: 0,
        dueDate: dueDate ? new Date(dueDate) : null,
        notes: notes || null,
        items: serializedItems,
        status: 'PENDING',
        createdById: req.user.id,
      },
      include: {
        project: { select: { id: true, name: true } },
        client: { select: { id: true, fullName: true, email: true } },
      },
    });

    res.status(201).json(formatInvoice(invoice));
  } catch (error) {
    console.error('Create invoice error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Invoice number already exists.' });
    }
    res.status(500).json({ error: 'Failed to create invoice.' });
  }
});

// PUT /api/invoices/:id - Update invoice (Business Owner only)
router.put('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { amount, dueDate, notes, status, items, clientId } = req.body;

    const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const updateData = {};
    if (amount !== undefined) {
      const pAmt = parseFloat(amount);
      if (pAmt < existing.paidAmount) {
        return res.status(400).json({ error: `Amount cannot be less than already collected (${existing.paidAmount}).` });
      }
      updateData.amount = pAmt;
      // Auto-update status based on new amount
      if (existing.paidAmount >= pAmt && pAmt > 0) {
        updateData.status = 'PAID';
      } else if (existing.paidAmount > 0) {
        updateData.status = 'PARTIALLY_PAID';
      }
    }

    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    if (clientId !== undefined) updateData.clientId = clientId || null;
    if (items !== undefined) {
      updateData.items = Array.isArray(items) ? JSON.stringify(items) : String(items);
    }

    const updated = await prisma.invoice.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        project: { select: { id: true, name: true } },
        client: { select: { id: true, fullName: true } },
      },
    });

    res.json(formatInvoice(updated));
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice.' });
  }
});

// POST /api/invoices/:id/payments - Record Payment (Business Owner only)
router.post('/:id/payments', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    const { amount, paymentMethod, reference, notes, paymentDate } = req.body;

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'A positive payment amount is required.' });
    }

    const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const remaining = invoice.amount - invoice.paidAmount;
    if (paymentAmount > remaining) {
      return res.status(400).json({
        error: `Payment amount (${paymentAmount}) exceeds remaining balance of ${remaining.toFixed(2)}.`,
      });
    }

    const newPaidAmount = invoice.paidAmount + paymentAmount;
    const newStatus = newPaidAmount >= invoice.amount ? 'PAID' : 'PARTIALLY_PAID';

    const [payment, updatedInvoice] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          amount: paymentAmount,
          paymentMethod: paymentMethod || 'BANK_TRANSFER',
          reference: reference || null,
          notes: notes || null,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          recordedById: req.user.id,
        },
        include: {
          recordedBy: { select: { fullName: true } },
        },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
        include: {
          project: { select: { id: true, name: true } },
          client: { select: { id: true, fullName: true } },
        },
      }),
    ]);

    res.status(201).json({ payment, invoice: formatInvoice(updatedInvoice) });
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Failed to record payment.' });
  }
});

// DELETE /api/invoices/:id - Delete Invoice (Business Owner only)
router.delete('/:id', authenticate, authorize('BUSINESS_OWNER'), async (req, res) => {
  try {
    await prisma.invoice.delete({ where: { id: req.params.id } });
    res.json({ message: 'Invoice deleted successfully.' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice.' });
  }
});

module.exports = router;
