const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/client-portal/overview - Client cockpit overview
router.get('/overview', authenticate, authorize('CLIENT'), async (req, res) => {
  try {
    const clientId = req.user.id;
    const where = { clientId };
    if (req.user.companyId) {
      where.companyId = req.user.companyId;
    }

    // Fetch ONLY client's contracted projects
    const projects = await prisma.project.findMany({
      where,
      include: {
        createdBy: { select: { fullName: true, email: true, phone: true } },
        milestones: { orderBy: { dueDate: 'asc' } },
        tasks: { select: { id: true, title: true, status: true, priority: true } },
        invoices: {
          include: { payments: { orderBy: { paymentDate: 'desc' } } },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Financial calculations strictly for this client's projects
    const allInvoices = projects.flatMap((p) => p.invoices || []);
    const totalInvoiced = allInvoices.reduce((s, inv) => s + (inv.amount || 0), 0);
    const totalPaid = allInvoices.reduce((s, inv) => s + (inv.paidAmount || 0), 0);
    const totalPending = totalInvoiced - totalPaid;

    const inExecution = projects.filter((p) => p.status === 'IN_PROGRESS').length;
    const delivered = projects.filter((p) => p.status === 'COMPLETED').length;

    // Synthesize notifications from milestones and invoices
    const notifications = [];
    projects.forEach((p) => {
      p.milestones.forEach((m) => {
        if (m.status === 'COMPLETED') {
          notifications.push({
            id: `notif-m-${m.id}`,
            type: 'complete',
            message: `Milestone "${m.title}" was completed in ${p.name}.`,
            date: m.updatedAt,
          });
        } else if (m.status === 'IN_PROGRESS') {
          notifications.push({
            id: `notif-m-${m.id}`,
            type: 'progress',
            message: `Milestone "${m.title}" is in progress in ${p.name}.`,
            date: m.updatedAt,
          });
        }
      });

      p.invoices.forEach((inv) => {
        if (inv.status === 'PAID') {
          notifications.push({
            id: `notif-inv-${inv.id}`,
            type: 'invoice',
            message: `Invoice ${inv.invoiceNumber} (₹${inv.amount.toLocaleString()}) has been fully paid.`,
            date: inv.updatedAt,
          });
        }
      });
    });

    notifications.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Fetch assigned owner details
    let assignedOwner = req.user.assignedOwner;
    if (!assignedOwner && req.user.ownerId) {
      assignedOwner = await prisma.user.findUnique({
        where: { id: req.user.ownerId },
        select: { id: true, fullName: true, email: true, phone: true },
      });
    }

    res.json({
      client: {
        id: req.user.id,
        fullName: req.user.fullName,
        email: req.user.email,
        phone: req.user.phone,
        companyName: req.user.company?.name || null,
        assignedOwner: assignedOwner || null,
      },
      stats: {
        totalProjects: projects.length,
        inExecution,
        delivered,
        totalInvoiced: parseFloat(totalInvoiced.toFixed(2)),
        totalPaid: parseFloat(totalPaid.toFixed(2)),
        totalPending: parseFloat(totalPending.toFixed(2)),
      },
      projects,
      notifications: notifications.slice(0, 8),
    });
  } catch (error) {
    console.error('Client portal overview error:', error);
    res.status(500).json({ error: 'Failed to fetch client portal data.' });
  }
});

// GET /api/client-portal/projects/:id - Client specific project deep dive
router.get('/projects/:id', authenticate, authorize('CLIENT'), async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: { select: { fullName: true, email: true, phone: true } },
        milestones: { orderBy: { dueDate: 'asc' } },
        tasks: {
          select: { id: true, title: true, status: true, priority: true, dueDate: true },
        },
        materials: {
          include: { material: { select: { name: true, unit: true, category: true } } },
        },
        invoices: {
          include: { payments: { orderBy: { paymentDate: 'desc' } } },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Enforce that client can ONLY view projects contracted to themselves
    if (project.clientId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. You are not authorized to view this project.' });
    }

    res.json(project);
  } catch (error) {
    console.error('Client portal project detail error:', error);
    res.status(500).json({ error: 'Failed to fetch project details.' });
  }
});

module.exports = router;
