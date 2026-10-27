const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Helper to sign JWT token
function generateToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        company: { select: { id: true, name: true, description: true } },
        ownedCompany: { select: { id: true, name: true, description: true } },
        assignedOwner: { select: { id: true, fullName: true, email: true, phone: true } },
        worker: {
          select: { id: true, position: true, skills: true, status: true, companyId: true, ownerId: true },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact the administrator.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Ensure business owner has their company linked
    let companyId = user.companyId;
    let companyName = user.company?.name || user.ownedCompany?.name;
    if (user.role === 'BUSINESS_OWNER') {
      if (!companyId) {
        if (user.ownedCompany) {
          companyId = user.ownedCompany.id;
          companyName = user.ownedCompany.name;
          await prisma.user.update({
            where: { id: user.id },
            data: { companyId },
          });
        } else {
          const comp = await prisma.company.create({
            data: {
              name: `${user.fullName}'s Company`,
              ownerId: user.id,
            },
          });
          companyId = comp.id;
          companyName = comp.name;
          await prisma.user.update({
            where: { id: user.id },
            data: { companyId },
          });
        }
      }
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        status: user.status,
        companyId,
        companyName,
        ownerId: user.ownerId || user.worker?.ownerId || null,
        assignedOwner: user.assignedOwner || null,
        worker: user.worker || null,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/companies - Public list of active companies (for Client registration selection)
router.get('/companies', async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        owner: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json(companies);
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Failed to fetch companies.' });
  }
});

// POST /api/auth/register/owner - Dedicated Business Owner Signup Flow
router.post('/register/owner', async (req, res) => {
  try {
    const { fullName, email, password, companyName, phone } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address format.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }
    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ error: 'Company/Business name is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create User first, then Company, then link companyId
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

    const company = await prisma.company.create({
      data: {
        name: companyName.trim(),
        ownerId: user.id,
      },
    });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { companyId: company.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        status: true,
        companyId: true,
      },
    });

    const token = generateToken(updatedUser);

    res.status(201).json({
      token,
      user: {
        ...updatedUser,
        companyName: company.name,
      },
      message: 'Business Owner account and company registered successfully.',
    });
  } catch (error) {
    console.error('Owner registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/register/client - Dedicated Client Signup Flow
router.post('/register/client', async (req, res) => {
  try {
    const { fullName, email, password, phone, companyId, ownerId } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address format.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Resolve company and owner association
    let targetCompanyId = companyId || null;
    let targetOwnerId = ownerId || null;

    if (targetCompanyId) {
      const company = await prisma.company.findUnique({
        where: { id: targetCompanyId },
        select: { id: true, ownerId: true, name: true },
      });
      if (company) {
        targetOwnerId = company.ownerId;
      } else {
        targetCompanyId = null;
      }
    } else if (targetOwnerId) {
      const owner = await prisma.user.findUnique({
        where: { id: targetOwnerId },
        include: { ownedCompany: true },
      });
      if (owner && owner.role === 'BUSINESS_OWNER') {
        targetCompanyId = owner.ownedCompany?.id || owner.companyId || null;
      } else {
        targetOwnerId = null;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: cleanEmail,
        password: hashedPassword,
        role: 'CLIENT',
        phone: phone ? phone.trim() : null,
        status: 'ACTIVE',
        companyId: targetCompanyId,
        ownerId: targetOwnerId,
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
        company: { select: { id: true, name: true } },
        assignedOwner: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        ...user,
        companyName: user.company?.name || null,
      },
      message: 'Client account registered successfully.',
    });
  } catch (error) {
    console.error('Client registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/register - Unified endpoint rejecting Worker and Admin self-signup
router.post('/register', async (req, res) => {
  const { role } = req.body;
  if (role === 'WORKER') {
    return res.status(403).json({
      error: 'Workers cannot register publicly. Workers must be created or invited directly through their Business Owner account.',
    });
  }
  if (role === 'ADMIN') {
    return res.status(403).json({
      error: 'Administrator accounts cannot be registered publicly.',
    });
  }
  if (role === 'BUSINESS_OWNER') {
    return router.handle({ ...req, url: '/register/owner', method: 'POST' }, res);
  }
  if (role === 'CLIENT') {
    return router.handle({ ...req, url: '/register/client', method: 'POST' }, res);
  }
  return res.status(400).json({ error: 'Invalid role specified. Only Business Owner and Client registration is permitted.' });
});

// GET /api/auth/me - Current authenticated user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        phone: true,
        status: true,
        createdAt: true,
        companyId: true,
        ownerId: true,
        company: {
          select: { id: true, name: true, description: true },
        },
        ownedCompany: {
          select: { id: true, name: true, description: true },
        },
        assignedOwner: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        worker: {
          select: {
            id: true,
            position: true,
            skills: true,
            status: true,
            companyId: true,
            ownerId: true,
            assignments: {
              include: {
                project: {
                  select: { id: true, name: true, status: true, progress: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({
      ...user,
      companyName: user.company?.name || user.ownedCompany?.name || null,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user info.' });
  }
});

// PUT /api/auth/profile - Update profile details
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { fullName, phone, companyName, companyDescription } = req.body;

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        fullName: fullName.trim(),
        phone: phone ? phone.trim() : null,
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

    // If Business Owner updated company information
    let updatedCompany = null;
    if (req.user.role === 'BUSINESS_OWNER' && (companyName || companyDescription !== undefined)) {
      if (req.user.companyId) {
        updatedCompany = await prisma.company.update({
          where: { id: req.user.companyId },
          data: {
            ...(companyName && { name: companyName.trim() }),
            ...(companyDescription !== undefined && { description: companyDescription }),
          },
        });
      }
    }

    res.json({
      message: 'Profile updated successfully.',
      user: {
        ...updated,
        companyName: updatedCompany ? updatedCompany.name : (req.user.company?.name || null),
        company: updatedCompany || req.user.company || null,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// PUT /api/auth/change-password - Change current password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

module.exports = router;
