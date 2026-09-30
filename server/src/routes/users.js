const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/users - List users with role-scoped access control
// Admin -> accesses Business Owners only
// Business Owner -> accesses Clients & Workers
// Client & Worker -> accesses Business Owner contact info
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, role, status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) where.status = status;

    // Enforce strict Role Access Scoping
    if (req.user.role === 'ADMIN') {
      // Admin can ONLY access Business Owner accounts
      where.role = 'BUSINESS_OWNER';
    } else if (req.user.role === 'BUSINESS_OWNER') {
      // Business Owner can access Client & Worker accounts
      if (role && ['CLIENT', 'WORKER'].includes(role)) {
        where.role = role;
      } else {
        where.role = { in: ['CLIENT', 'WORKER'] };
      }
    } else {
      // Client & Worker can only view Business Owner(s) contact info
      where.role = 'BUSINESS_OWNER';
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
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Role-based view check
    if (req.user.role === 'ADMIN' && user.role !== 'BUSINESS_OWNER' && user.id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Admins can only view Business Owners.' });
    }

    if (req.user.role === 'BUSINESS_OWNER' && !['CLIENT', 'WORKER'].includes(user.role) && user.id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Business Owners can only view Clients and Workers.' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

// POST /api/users - Create user
router.post('/', authenticate, authorize('ADMIN', 'BUSINESS_OWNER'), async (req, res) => {
  try {
    const { fullName, email, password, role, phone } = req.body;

    // Validation
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

    // Role Access Enforcements for user creation
    if (req.user.role === 'ADMIN') {
      if (role !== 'BUSINESS_OWNER') {
        return res.status(403).json({ error: 'Admin can only create Business Owner accounts.' });
      }
    } else if (req.user.role === 'BUSINESS_OWNER') {
      if (!['CLIENT', 'WORKER'].includes(role)) {
        return res.status(403).json({ error: 'Business Owner can only create Client and Worker accounts.' });
      }
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName,
        email: email.toLowerCase(),
        password: hashedPassword,
        role,
        phone: phone || null,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    });

    // If role is WORKER, auto-create worker profile with position and skills if provided
    if (role === 'WORKER') {
      let formattedSkills = '[]';
      if (req.body.skills) {
        if (Array.isArray(req.body.skills)) {
          formattedSkills = JSON.stringify(req.body.skills);
        } else if (typeof req.body.skills === 'string') {
          const split = req.body.skills.split(',').map(s => s.trim()).filter(Boolean);
          formattedSkills = JSON.stringify(split);
        }
      }

      await prisma.worker.create({
        data: {
          userId: user.id,
          position: req.body.position ? String(req.body.position).trim() : null,
          skills: formattedSkills,
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
    const { fullName, email, role, phone, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check permissions on target user
    if (req.user.role === 'ADMIN' && existing.role !== 'BUSINESS_OWNER' && existing.id !== req.user.id) {
      return res.status(403).json({ error: 'Admin can only modify Business Owner accounts.' });
    }
    if (req.user.role === 'BUSINESS_OWNER' && !['CLIENT', 'WORKER'].includes(existing.role) && existing.id !== req.user.id) {
      return res.status(403).json({ error: 'Business Owners can only modify Client and Worker accounts.' });
    }

    // Check email uniqueness if changed
    if (email && email.toLowerCase() !== existing.email) {
      const emailExists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (emailExists) {
        return res.status(409).json({ error: 'A user with this email already exists.' });
      }
    }

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (email) updateData.email = email.toLowerCase();
    if (role) updateData.role = role;
    if (phone !== undefined) updateData.phone = phone || null;
    if (password && password.length >= 6) {
      updateData.password = await bcrypt.hash(password, 12);
    }

    // Handle role change: WORKER -> non-WORKER or non-WORKER -> WORKER
    if (role && role !== existing.role) {
      if (existing.role === 'WORKER' && role !== 'WORKER') {
        await prisma.worker.deleteMany({ where: { userId: existing.id } });
      } else if (role === 'WORKER' && existing.role !== 'WORKER') {
        const workerExists = await prisma.worker.findUnique({ where: { userId: existing.id } });
        if (!workerExists) {
          await prisma.worker.create({ data: { userId: existing.id } });
        }
      }
    }

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
        createdAt: true,
        updatedAt: true,
      },
    });

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

    // Prevent deactivating self
    if (req.params.id === req.user.id && status === 'INACTIVE') {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }

    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (req.user.role === 'ADMIN' && existing.role !== 'BUSINESS_OWNER') {
      return res.status(403).json({ error: 'Admin can only modify status for Business Owners.' });
    }
    if (req.user.role === 'BUSINESS_OWNER' && !['CLIENT', 'WORKER'].includes(existing.role)) {
      return res.status(403).json({ error: 'Business Owner can only modify status for Clients and Workers.' });
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
// Admin can delete Business Owners
// Business Owner can delete Workers and Clients
router.delete('/:id', authenticate, authorize('ADMIN', 'BUSINESS_OWNER'), async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deleting self
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

    // Role-based deletion constraints
    if (req.user.role === 'ADMIN') {
      if (existing.role !== 'BUSINESS_OWNER') {
        return res.status(403).json({ error: 'Admin can only delete Business Owner accounts.' });
      }
    } else if (req.user.role === 'BUSINESS_OWNER') {
      if (!['WORKER', 'CLIENT'].includes(existing.role)) {
        return res.status(403).json({ error: 'Business Owners can only delete Worker and Client accounts.' });
      }
    }

    // Cascade cleanup
    if (existing.role === 'WORKER') {
      if (existing.worker) {
        const workerId = existing.worker.id;
        // 1. Unassign tasks assigned to this worker
        await prisma.task.updateMany({
          where: { assignedToId: workerId },
          data: { assignedToId: null },
        });
        // 2. Delete project assignments
        await prisma.projectAssignment.deleteMany({
          where: { workerId },
        });
      }
      // 3. Delete worker record
      await prisma.worker.deleteMany({
        where: { userId: id },
      });
    } else if (existing.role === 'BUSINESS_OWNER') {
      // Find all projects created by this Business Owner
      const projects = await prisma.project.findMany({
        where: { createdById: id },
        select: { id: true },
      });
      const projectIds = projects.map((p) => p.id);

      if (projectIds.length > 0) {
        // Delete project materials
        await prisma.projectMaterial.deleteMany({
          where: { projectId: { in: projectIds } },
        });
        // Delete project assignments
        await prisma.projectAssignment.deleteMany({
          where: { projectId: { in: projectIds } },
        });
        // Delete milestones
        await prisma.milestone.deleteMany({
          where: { projectId: { in: projectIds } },
        });
        // Delete tasks
        await prisma.task.deleteMany({
          where: { projectId: { in: projectIds } },
        });
        // Delete projects
        await prisma.project.deleteMany({
          where: { id: { in: projectIds } },
        });
      }

      // Delete stock updates created by this Business Owner
      await prisma.stockUpdate.deleteMany({
        where: { createdById: id },
      });
    }

    // Delete user
    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

module.exports = router;
