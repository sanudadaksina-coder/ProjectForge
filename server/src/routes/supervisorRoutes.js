const express = require('express');
const router = express.Router();
const {
  getSupervisors,
  getSupervisorById,
  getMySupervisionRequests
} = require('../controllers/supervisorController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Public/student-facing directory routes (requires authentication per API_CONTRACT)
router.get('/', requireAuth, getSupervisors);

// Supervisor incoming requests inbox
// NOTE: MUST be registered BEFORE '/:id' so 'my-requests' is not parsed as an :id parameter
router.get('/my-requests', requireAuth, requireRole('supervisor'), getMySupervisionRequests);

// Specific supervisor profile lookup
router.get('/:id', requireAuth, getSupervisorById);

module.exports = router;

