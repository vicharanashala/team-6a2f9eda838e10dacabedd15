const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check account status
    if (user.status === 'blocked') {
      return res.status(403).json({ blocked: true, message: 'Account restricted' });
    }
    if (user.status === 'suspended') {
      if (user.suspendedUntil && user.suspendedUntil > new Date()) {
        return res.status(403).json({ suspended: true, retryAfter: user.suspendedUntil.getTime() });
      } else {
        // Auto-restore expired suspension
        user.status = 'active';
        await user.save();
      }
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.id).select('-password');
      if (user) {
        if (user.status === 'blocked') {
          return res.status(403).json({ blocked: true, message: 'Account restricted' });
        }
        if (user.status === 'suspended') {
          if (user.suspendedUntil && user.suspendedUntil > new Date()) {
            return res.status(403).json({ suspended: true, retryAfter: user.suspendedUntil.getTime() });
          } else {
            user.status = 'active';
            await user.save();
          }
        }
        req.user = user;
      }
    }
  } catch (_) {
    // ignore
  }
  next();
};

const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

const moderatorOrAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
    return res.status(403).json({ error: 'Moderator or admin access required' });
  }
  next();
};

module.exports = { auth, optionalAuth, adminOnly, moderatorOrAdmin };
