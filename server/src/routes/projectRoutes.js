const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject
} = require('../controllers/projectController');
const {
  createJoinRequest,
  getProjectJoinRequests,
  removeMember
} = require('../controllers/membershipController');
const {
  createTask,
  getProjectTasks,
  getProjectPulse,
  getProjectProgress
} = require('../controllers/taskController');
const {
  createSupervisionRequest,
  getProjectSupervisionRequests
} = require('../controllers/supervisorController');
const { requireAuth, requireProjectLeader } = require('../middleware/auth');

// Public project discovery routes
router.get('/', getProjects);
router.get('/:id', getProjectById);

// Protected project management routes
router.post('/', requireAuth, createProject);
router.patch('/:id', requireAuth, requireProjectLeader, updateProject);
router.delete('/:id', requireAuth, requireProjectLeader, deleteProject);

// Stage 2: Team membership & recruitment routes
router.post('/:projectId/join-requests', requireAuth, createJoinRequest);
router.get('/:projectId/join-requests', requireAuth, requireProjectLeader, getProjectJoinRequests);
router.delete('/:projectId/members/:userId', requireAuth, requireProjectLeader, removeMember);

// Stage 2C: Task management & Project Pulse routes
router.post('/:projectId/tasks', requireAuth, createTask);
router.get('/:projectId/tasks', requireAuth, getProjectTasks);
router.get('/:projectId/pulse', requireAuth, getProjectPulse);
router.get('/:projectId/progress', requireAuth, getProjectProgress);

// Stage 3A: Supervision requests routes
router.post('/:projectId/supervision-requests', requireAuth, createSupervisionRequest);
router.get('/:projectId/supervision-requests', requireAuth, getProjectSupervisionRequests);

module.exports = router;
