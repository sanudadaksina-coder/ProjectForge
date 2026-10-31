const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getJwtSecret } = require('../utils/token');

/**
 * Middleware: requireAuth
 * Verifies JWT token from HttpOnly cookie 'token' (or fallback Authorization Bearer header).
 * Attaches authenticated user object to req.user (excluding passwordHash).
 */
const requireAuth = async (req, res, next) => {
  try {
    let token = null;

    // 1. Primary auth source: HttpOnly cookie named 'token'
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Secondary fallback for automated test harnesses
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No session token provided.',
        data: null,
        errors: [
          {
            message: 'Missing session cookie or Bearer token.'
          }
        ]
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (jwtErr) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session token.',
        data: null,
        errors: [
          {
            message: jwtErr.message || 'Token verification failed.'
          }
        ]
      });
    }

    // Fetch user profile from database
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account associated with this session no longer exists.',
        data: null,
        errors: [
          {
            message: 'User not found in system.'
          }
        ]
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal authentication error.',
      data: null,
      errors: [
        {
          message: error.message
        }
      ]
    });
  }
};

/**
 * Middleware: requireRole
 * Authorizes request based on user accountType.
 * @param  {...string} allowedRoles - e.g. 'student', 'supervisor'
 */
const requireRole = (...allowedRoles) => {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        data: null,
        errors: [
          {
            message: 'User session not found.'
          }
        ]
      });
    }

    if (!roles.includes(req.user.accountType)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: insufficient account privileges.',
        data: null,
        errors: [
          {
            message: `Account type '${req.user.accountType}' is not authorized to perform this action.`
          }
        ]
      });
    }

    next();
  };
};

const mongoose = require('mongoose');
const Project = require('../models/Project');

/**
 * Middleware: requireProjectLeader
 * Verifies that the authenticated user is the designated Project Leader.
 * Expects project ID in req.params.id or req.params.projectId.
 */
const requireProjectLeader = async (req, res, next) => {
  try {
    const projectId = req.params.id || req.params.projectId;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format.',
        data: null,
        errors: [
          {
            field: 'id',
            message: 'Project ID must be a valid 24-character hexadecimal ObjectId.'
          }
        ]
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found.',
        data: null,
        errors: [
          {
            message: 'No project exists with the specified ID.'
          }
        ]
      });
    }

    if (!project.leader.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: only the Project Leader can manage this project.',
        data: null,
        errors: [
          {
            message: 'You are not the authorized leader of this project.'
          }
        ]
      });
    }

    req.project = project;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error verifying project leader authorization.',
      data: null,
      errors: [
        {
          message: error.message
        }
      ]
    });
  }
};

module.exports = {
  requireAuth,
  requireRole,
  requireProjectLeader
};
