const express = require('express');
const router = express.Router();
const {
  getMyMembershipRequests,
  approveJoinRequest,
  rejectJoinRequest,
  cancelJoinRequest
} = require('../controllers/membershipController');
const { requireAuth } = require('../middleware/auth');

// Student's own membership requests query (minimal authenticated endpoint)
router.get('/mine', requireAuth, getMyMembershipRequests);

// Protected membership request actions
router.patch('/:requestId/approve', requireAuth, approveJoinRequest);
router.patch('/:requestId/reject', requireAuth, rejectJoinRequest);
router.patch('/:requestId/cancel', requireAuth, cancelJoinRequest);

module.exports = router;
