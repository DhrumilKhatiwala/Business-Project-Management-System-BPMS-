const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - List users with strict multi-tenant access control
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // ── Worker & Client Access: Strictly their assigned Business Owner ONLY ──
    if (req.user.role === 'WORKER' || req.user.role === 'CLIENT') {
      const ownerId = req.user.ownerId || req.user.company?.ownerId;
      if (!ownerId) {
        return res.json({ users: [], total: 0, page: 1, totalPages: 0 });
      }

      const owner = await prisma.user.findUnique({
        where: { id: ownerId },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          phone: true,
          status: true,
          companyId: true,
          ownedCompany: { select: { id: true, name: true, description: true } },
          createdAt: true,
        },
      });

      if (!owner || owner.status !== 'ACTIVE') {
        return res.json({ users: [], total: 0, page: 1, totalPages: 0 });
      }

      return res.json({
        users: [owner],
        total: 1,
        page: 1,
        totalPages: 1,
      });
    }

    // ── Admin and Business Owner Scoping ──
    const where = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;

    if (req.user.role === 'ADMIN') {
      // Admin accesses all Business Owners by default, or filtered role
      if (role) {
        where.role = role;
      } else {
        where.role = 'BUSINESS_OWNER';
      }
    } else if (req.user.role === 'BUSINESS_OWNER') {
      // Business Owner can ONLY access users in their own company
      where.companyId = req.user.companyId || '__NO_COMPANY__';
      if (role && ['CLIENT', 'WORKER'].includes(role)) {
        where.role = role;
      } else {
        where.role = { in: ['CLIENT', 'WORKER'] };
      }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          phone: true,
          status: true,
          companyId: true,
          ownerId: true,
          company: { select: { id: true, name: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// GET /api/users/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        status: true,
        companyId: true,
        ownerId: true,
        company: { select: { id: true, name: true } },
        assignedOwner: { select: { id: true, fullName: true, email: true, phone: true } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Role-based tenant authorization
    if (req.user.role === 'ADMIN') {
      // Super admin can view
      return res.json(user);
    }

    if (req.user.role === 'BUSINESS_OWNER') {
      // Business Owner can view self, or workers/clients within their company
      if (user.id !== req.user.id && user.companyId !== req.user.companyId && user.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. You can only view users belonging to your company.' });
      }
      return res.json(user);
    }

    // Worker or Client can view self or their assigned owner
    if (user.id !== req.user.id && user.id !== req.user.ownerId) {
      return res.status(403).json({ error: 'Access denied. You can only view your own profile or your assigned business owner.' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// POST /api/users - Create user (Admin creates Business Owners, Business Owner creates Workers and Clients)
router.post('/', authenticate, authorize('ADMIN', 'BUSINESS_OWNER'), async (req, res) => {
  try {
    const { fullName, email, password, role, phone, companyName } = req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ error: 'Full name, email, password, and role are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Enforce role permissions
    if (req.user.role === 'ADMIN') {
      if (role !== 'BUSINESS_OWNER') {
        return res.status(403).json({ error: 'Admin can only create Business Owner accounts through this interface.' });
      }
    } else if (req.user.role === 'BUSINESS_OWNER') {
      if (!['CLIENT', 'WORKER'].includes(role)) {
        return res.status(403).json({ error: 'Business Owner can only create Client and Worker accounts.' });
      }
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    if (req.user.role === 'ADMIN') {
      // Admin creating Business Owner
      const user = await prisma.user.create({
        data: {
          fullName: fullName.trim(),
          email: cleanEmail,
          password: hashedPassword,
          role: 'BUSINESS_OWNER',
          phone: phone ? phone.trim() : null,
          status: 'ACTIVE',
        },
      });

      const comp = await prisma.company.create({
        data: {
          name: (companyName && companyName.trim()) || `${fullName.trim()}'s Company`,
          ownerId: user.id,
        },
      });

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { companyId: comp.id },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          phone: true,
          status: true,
          companyId: true,
          createdAt: true,
        },
      });

      return res.status(201).json(updatedUser);
    }

    // Business Owner creating Client or Worker
    // Permanently bound to caller's company and ownerId
    const companyId = req.user.companyId;
    const ownerId = req.user.id;

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role,
        phone: phone ? phone.trim() : null,
        companyId,
        ownerId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        status: true,
        companyId: true,
        ownerId: true,
        createdAt: true,
      },
    });

    if (role === 'WORKER') {
      let formattedSkills = '[]';
      if (req.body.skills) {
        if (Array.isArray(req.body.skills)) {
          formattedSkills = JSON.stringify(req.body.skills);
        } else if (typeof req.body.skills === 'string') {
          const split = req.body.skills.split(',').map((s) => s.trim()).filter(Boolean);
          formattedSkills = JSON.stringify(split);
        }
      }

      await prisma.worker.create({
        data: {
          userId: user.id,
          position: req.body.position ? String(req.body.position).trim() : null,
          skills: formattedSkills,
          companyId,
          ownerId,
          status: 'ACTIVE',
        },
      });
    }

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', authenticate, authorize('ADMIN', 'BUSINESS_OWNER'), async (req, res) => {
  try {
    const { fullName, email, phone, password, position, skills } = req.body;

    const existing = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: { worker: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Enforce tenant boundary
    if (req.user.role === 'BUSINESS_OWNER') {
      if (existing.id !== req.user.id && existing.companyId !== req.user.companyId && existing.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. You can only modify users in your own company.' });
      }
      if (existing.role === 'ADMIN' || (existing.role === 'BUSINESS_OWNER' && existing.id !== req.user.id)) {
        return res.status(403).json({ error: 'Access denied. You cannot modify other business owners.' });
      }
    }

    // Check email uniqueness if changed
    if (email && email.toLowerCase().trim() !== existing.email) {
      const emailExists = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (emailExists) {
        return res.status(409).json({ error: 'A user with this email already exists.' });
      }
    }

    const updateData = {};
    if (fullName) updateData.fullName = fullName.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
    if (password && password.length >= 6) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    // Note: companyId, ownerId, and role CANNOT be tampered with by workers or modified arbitrarily
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        status: true,
        companyId: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Update worker details if present
    if (existing.role === 'WORKER' && existing.worker) {
      const workerUpdate = {};
      if (position !== undefined) workerUpdate.position = position ? position.trim() : null;
      if (skills !== undefined) {
        workerUpdate.skills = Array.isArray(skills)
          ? JSON.stringify(skills)
          : JSON.stringify(String(skills).split(',').map((s) => s.trim()).filter(Boolean));
      }
      if (Object.keys(workerUpdate).length > 0) {
        await prisma.worker.update({
          where: { id: existing.worker.id },
          data: workerUpdate,
        });
      }
    }

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// PATCH /api/users/:id/status - Activate/deactivate
router.patch('/:id/status', authenticate, authorize('ADMIN', 'BUSINESS_OWNER'), async (req, res) => {
  try {
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE.' });
    }

    if (req.params.id === req.user.id && status === 'INACTIVE') {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (req.user.role === 'BUSINESS_OWNER') {
      if (existing.companyId !== req.user.companyId && existing.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. You can only modify users in your company.' });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update user status.' });
  }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', authenticate, authorize('ADMIN', 'BUSINESS_OWNER'), async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      include: { worker: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (req.user.role === 'BUSINESS_OWNER') {
      if (existing.companyId !== req.user.companyId && existing.ownerId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied. You can only delete users in your company.' });
      }
      if (!['WORKER', 'CLIENT'].includes(existing.role)) {
        return res.status(403).json({ error: 'Business Owners can only delete Worker and Client accounts.' });
      }
    }

    // Cascade cleanup for Worker
    if (existing.role === 'WORKER') {
      if (existing.worker) {
        const workerId = existing.worker.id;
        await prisma.task.updateMany({
          where: { assignedToId: workerId },
          data: { assignedToId: null },
        });
        await prisma.projectAssignment.deleteMany({
          where: { workerId },
        });
        await prisma.worker.deleteMany({
          where: { userId: id },
        });
      }
    } else if (existing.role === 'BUSINESS_OWNER') {
      // Find company
      const company = await prisma.company.findUnique({ where: { ownerId: id } });
      if (company) {
        await prisma.lowStockAlert.deleteMany({ where: { companyId: company.id } });
        await prisma.stockUpdate.deleteMany({ where: { createdById: id } });
        await prisma.material.deleteMany({ where: { companyId: company.id } });
        await prisma.payment.deleteMany({ where: { recordedById: id } });
        await prisma.invoice.deleteMany({ where: { companyId: company.id } });
        await prisma.expense.deleteMany({ where: { companyId: company.id } });

        const projects = await prisma.project.findMany({ where: { companyId: company.id }, select: { id: true } });
        const pIds = projects.map((p) => p.id);
        if (pIds.length > 0) {
          await prisma.projectMaterial.deleteMany({ where: { projectId: { in: pIds } } });
          await prisma.projectAssignment.deleteMany({ where: { projectId: { in: pIds } } });
          await prisma.task.deleteMany({ where: { projectId: { in: pIds } } });
          await prisma.milestone.deleteMany({ where: { projectId: { in: pIds } } });
          await prisma.project.deleteMany({ where: { id: { in: pIds } } });
        }
        await prisma.company.delete({ where: { id: company.id } });
      }
    }

    await prisma.user.delete({ where: { id } });

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

module.exports = router;
