const express = require('express');
const router = express.Router();
const {
  getTaskById,
  updateTask,
  deleteTask
} = require('../controllers/taskController');
const { requireAuth } = require('../middleware/auth');

// Protected individual task management routes
router.get('/:taskId', requireAuth, getTaskById);
router.patch('/:taskId', requireAuth, updateTask);
router.delete('/:taskId', requireAuth, deleteTask);

module.exports = router;
