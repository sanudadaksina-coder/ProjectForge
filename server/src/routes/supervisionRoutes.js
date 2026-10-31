const express = require('express');
const router = express.Router();
const {
  acceptSupervisionRequest,
  declineSupervisionRequest
} = require('../controllers/supervisorController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Targeted supervisor action routes
router.patch('/:requestId/accept', requireAuth, requireRole('supervisor'), acceptSupervisionRequest);
router.patch('/:requestId/decline', requireAuth, requireRole('supervisor'), declineSupervisionRequest);

module.exports = router;

