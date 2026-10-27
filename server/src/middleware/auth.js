const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');

// Authenticate JWT token and hydrate tenant context
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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
          select: { id: true, name: true, description: true, ownerId: true },
        },
        ownedCompany: {
          select: { id: true, name: true, description: true, ownerId: true },
        },
        assignedOwner: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        worker: {
          select: { id: true, position: true, skills: true, status: true, companyId: true, ownerId: true },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    // Ensure Business Owner has a guaranteed company record
    if (user.role === 'BUSINESS_OWNER') {
      if (!user.companyId) {
        if (user.ownedCompany) {
          user.companyId = user.ownedCompany.id;
          await prisma.user.update({
            where: { id: user.id },
            data: { companyId: user.ownedCompany.id },
          });
        } else {
          const comp = await prisma.company.create({
            data: {
              name: `${user.fullName}'s Company`,
              ownerId: user.id,
            },
          });
          user.companyId = comp.id;
          user.ownedCompany = comp;
          await prisma.user.update({
            where: { id: user.id },
            data: { companyId: comp.id },
          });
        }
      }
    } else if (user.role === 'WORKER') {
      if (!user.companyId && user.worker?.companyId) {
        user.companyId = user.worker.companyId;
      }
      if (!user.ownerId && user.worker?.ownerId) {
        user.ownerId = user.worker.ownerId;
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed.' });
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

// Helper: Scoping filter for database queries based on tenant / company
function getTenantFilter(user) {
  if (!user) return { companyId: '__NONE__' };
  if (user.role === 'ADMIN') return {};
  if (!user.companyId) return { companyId: '__UNASSIGNED__' };
  return { companyId: user.companyId };
}

module.exports = { authenticate, authorize, getTenantFilter };
