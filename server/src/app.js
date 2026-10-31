const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');

const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const membershipRoutes = require('./routes/membershipRoutes');
const taskRoutes = require('./routes/taskRoutes');
const supervisorRoutes = require('./routes/supervisorRoutes');
const supervisionRoutes = require('./routes/supervisionRoutes');

const app = express();

// Global Middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/membership-requests', membershipRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/supervisors', supervisorRoutes);
app.use('/api/supervision-requests', supervisionRoutes);

// GET /api/health - Health check endpoint as specified in docs/API_CONTRACT.md
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ProjectForge API is healthy and operational',
    data: {
      status: 'up',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    },
    errors: null
  });
});

// GET /api/health/db - MongoDB connection health endpoint
app.get('/api/health/db', (req, res) => {
  const state = mongoose.connection.readyState;
  const isConnected = state === 1;

  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  if (isConnected) {
    return res.status(200).json({
      success: true,
      message: 'MongoDB connection is healthy and active',
      data: {
        status: 'connected',
        database: mongoose.connection.name || 'projectforge_db',
        readyState: state,
        timestamp: new Date().toISOString()
      },
      errors: null
    });
  }

  return res.status(503).json({
    success: false,
    message: 'MongoDB connection is not healthy',
    data: {
      status: stateMap[state] || 'unknown',
      readyState: state,
      timestamp: new Date().toISOString()
    },
    errors: [
      {
        message: 'Database is not currently connected.'
      }
    ]
  });
});

// 404 handler for undefined API routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    data: null,
    errors: [
      {
        message: 'The requested API route was not found.'
      }
    ]
  });
});

module.exports = app;
