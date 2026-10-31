const mongoose = require('mongoose');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { recalculateProjectPulse } = require('../utils/pulse');

const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_STATUSES = ['todo', 'in_progress', 'done'];

/**
 * POST /api/projects/:projectId/tasks
 * Creates a new task linked to the specified project.
 * Restricted strictly to the Project Leader.
 */
const createTask = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format.',
        data: null,
        errors: [
          {
            field: 'projectId',
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

    // Authorization: Only the Project Leader can create tasks
    if (!project.leader.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: only the Project Leader can create tasks.',
        data: null,
        errors: [
          {
            message: 'Only the project leader is authorized to create tasks.'
          }
        ]
      });
    }

    const {
      title,
      description,
      dueDate,
      priority,
      status,
      assignedTo
    } = req.body;

    const errors = [];

    // Validation: title
    if (!title || typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 100) {
      errors.push({
        field: 'title',
        message: 'Task title is required and must be between 2 and 100 characters.'
      });
    }

    // Validation: description
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string' || description.trim().length > 500) {
        errors.push({
          field: 'description',
          message: 'Task description cannot exceed 500 characters.'
        });
      }
    }

    // Validation: dueDate
    if (!dueDate) {
      errors.push({
        field: 'dueDate',
        message: 'Task due date is required.'
      });
    } else {
      const parsedDueDate = new Date(dueDate);
      if (isNaN(parsedDueDate.getTime())) {
        errors.push({
          field: 'dueDate',
          message: 'Task due date must be a valid date format.'
        });
      }
    }

    // Validation: priority
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      errors.push({
        field: 'priority',
        message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`
      });
    }

    // Validation: status
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${VALID_STATUSES.join(', ')}.`
      });
    }

    if (errors.length > 0) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        data: null,
        errors
      });
    }

    // Validation: assignedTo (must be valid ObjectId and member of project.members)
    let finalAssignedTo = null;
    if (assignedTo !== undefined && assignedTo !== null && assignedTo !== '') {
      if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid assigned user ID format.',
          data: null,
          errors: [
            {
              field: 'assignedTo',
              message: 'Assigned user ID must be a valid 24-character hexadecimal ObjectId.'
            }
          ]
        });
      }

      const isMember = project.members.some(m => m.equals(assignedTo));
      if (!isMember) {
        return res.status(400).json({
          success: false,
          message: 'Assigned user is not a member of the project team.',
          data: null,
          errors: [
            {
              field: 'assignedTo',
              message: 'The assigned user must be an approved member of this project.'
            }
          ]
        });
      }
      finalAssignedTo = assignedTo;
    }

    const finalStatus = status || 'todo';
    const newTask = new Task({
      project: projectId,
      title: title.trim(),
      description: description ? description.trim() : '',
      assignedTo: finalAssignedTo,
      createdBy: req.user._id,
      dueDate: new Date(dueDate),
      priority: priority || 'medium',
      status: finalStatus,
      completedAt: finalStatus === 'done' ? new Date() : null
    });

    await newTask.save();

    // Recalculate pulse & progress and update Project.pulseScore
    const { progress, pulse } = await recalculateProjectPulse(projectId);

    return res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: {
        task: newTask,
        updatedPulseScore: pulse.pulseScore,
        progress,
        pulse
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error creating task.',
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
 * GET /api/projects/:projectId/tasks
 * Retrieves all tasks for a project, including progress and pulse metrics.
 * Accessible to Project Leader, approved Project Members, and Assigned Supervisor.
 * Outsiders receive 403 Forbidden.
 */
const getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format.',
        data: null,
        errors: [
          {
            field: 'projectId',
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

    // Authorization check
    const isLeader = project.leader.equals(req.user._id);
    const isMember = project.members.some(m => m.equals(req.user._id));
    const isSupervisor = project.supervisor && project.supervisor.equals(req.user._id);

    if (!isLeader && !isMember && !isSupervisor) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: you are not an authorized member of this project.',
        data: null,
        errors: [
          {
            message: 'Only project leaders, approved members, or assigned supervisors can view project tasks.'
          }
        ]
      });
    }

    // Build filter query
    const filter = { project: projectId };
    if (req.query.status && VALID_STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.priority && VALID_PRIORITIES.includes(req.query.priority)) {
      filter.priority = req.query.priority;
    }
    if (req.query.assignedTo && mongoose.Types.ObjectId.isValid(req.query.assignedTo)) {
      filter.assignedTo = req.query.assignedTo;
    }

    const tasks = await Task.find(filter)
      .populate('assignedTo', '_id name email department')
      .populate('createdBy', '_id name email')
      .sort({ dueDate: 1, createdAt: -1 });

    // Request-time recalculation of pulse & progress
    const { progress, pulse } = await recalculateProjectPulse(projectId);

    return res.status(200).json({
      success: true,
      message: 'Tasks retrieved successfully',
      data: {
        tasks,
        progress,
        pulse
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving tasks.',
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
 * GET /api/tasks/:taskId
 * Retrieves details of an individual task.
 * Restricted to Leader, Members, or Assigned Supervisor of the task's project.
 */
const getTaskById = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID format.',
        data: null,
        errors: [
          {
            field: 'taskId',
            message: 'Task ID must be a valid 24-character hexadecimal ObjectId.'
          }
        ]
      });
    }

    const task = await Task.findById(taskId)
      .populate('assignedTo', '_id name email department')
      .populate('createdBy', '_id name email');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
        data: null,
        errors: [
          {
            message: 'No task exists with the specified ID.'
          }
        ]
      });
    }

    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Associated project not found.',
        data: null,
        errors: [
          {
            message: 'Project associated with this task does not exist.'
          }
        ]
      });
    }

    const isLeader = project.leader.equals(req.user._id);
    const isMember = project.members.some(m => m.equals(req.user._id));
    const isSupervisor = project.supervisor && project.supervisor.equals(req.user._id);

    if (!isLeader && !isMember && !isSupervisor) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: you are not an authorized member of this project.',
        data: null,
        errors: [
          {
            message: 'Only project leaders, approved members, or assigned supervisors can view task details.'
          }
        ]
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Task retrieved successfully',
      data: {
        task
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving task.',
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
 * PATCH /api/tasks/:taskId
 * Updates task details and completion status.
 * Restricted strictly to the Project Leader.
 * Supports checkbox toggling (completed: true/false) as well as status ('todo', 'done', 'in_progress').
 */
const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID format.',
        data: null,
        errors: [
          {
            field: 'taskId',
            message: 'Task ID must be a valid 24-character hexadecimal ObjectId.'
          }
        ]
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
        data: null,
        errors: [
          {
            message: 'No task exists with the specified ID.'
          }
        ]
      });
    }

    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Associated project not found.',
        data: null,
        errors: [
          {
            message: 'Project associated with this task does not exist.'
          }
        ]
      });
    }

    // Authorization: Only the Project Leader can modify, complete, or reopen tasks
    if (!project.leader.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: only the Project Leader can edit or complete tasks.',
        data: null,
        errors: [
          {
            message: 'Only the project leader is authorized to modify or complete tasks.'
          }
        ]
      });
    }

    // Enforce Protected Fields Rule:
    // Prevent ordinary task updates from altering server-controlled structural fields.
    const PROTECTED_FIELDS = ['project', 'createdBy', 'createdAt', 'updatedAt', '_id'];
    const forbiddenProvided = PROTECTED_FIELDS.filter(field => req.body[field] !== undefined);

    if (forbiddenProvided.length > 0) {
      return res.status(422).json({
        success: false,
        message: `Protected fields cannot be modified via task update: ${forbiddenProvided.join(', ')}`,
        data: null,
        errors: forbiddenProvided.map(field => ({
          field,
          message: `Field '${field}' is protected and cannot be altered through task updates.`
        }))
      });
    }

    const {
      title,
      description,
      dueDate,
      priority,
      status,
      completed,
      assignedTo
    } = req.body;

    const errors = [];

    // Validate title if supplied
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 100) {
        errors.push({
          field: 'title',
          message: 'Title must be between 2 and 100 characters.'
        });
      } else {
        task.title = title.trim();
      }
    }

    // Validate description if supplied
    if (description !== undefined) {
      if (typeof description !== 'string' || description.trim().length > 500) {
        errors.push({
          field: 'description',
          message: 'Description cannot exceed 500 characters.'
        });
      } else {
        task.description = description.trim();
      }
    }

    // Validate dueDate if supplied
    if (dueDate !== undefined) {
      const parsedDueDate = new Date(dueDate);
      if (isNaN(parsedDueDate.getTime())) {
        errors.push({
          field: 'dueDate',
          message: 'Due date must be a valid date format.'
        });
      } else {
        task.dueDate = parsedDueDate;
      }
    }

    // Validate priority if supplied
    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        errors.push({
          field: 'priority',
          message: `Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`
        });
      } else {
        task.priority = priority;
      }
    }

    // Validate completed checkbox if supplied
    if (completed !== undefined) {
      if (typeof completed !== 'boolean') {
        errors.push({
          field: 'completed',
          message: 'Completed flag must be a boolean (true or false).'
        });
      } else {
        task.status = completed ? 'done' : 'todo';
      }
    } else if (status !== undefined) {
      // Validate status if supplied directly
      if (!VALID_STATUSES.includes(status)) {
        errors.push({
          field: 'status',
          message: `Status must be one of: ${VALID_STATUSES.join(', ')}.`
        });
      } else {
        task.status = status;
      }
    }

    // Update completedAt timestamp depending on final status
    if (task.status === 'done') {
      task.completedAt = task.completedAt || new Date();
    } else {
      task.completedAt = null;
    }

    if (errors.length > 0) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed.',
        data: null,
        errors
      });
    }

    // Validate assignedTo if supplied
    if (assignedTo !== undefined) {
      if (assignedTo === null || assignedTo === '') {
        task.assignedTo = null;
      } else {
        if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid assigned user ID format.',
            data: null,
            errors: [
              {
                field: 'assignedTo',
                message: 'Assigned user ID must be a valid 24-character hexadecimal ObjectId.'
              }
            ]
          });
        }

        const isMember = project.members.some(m => m.equals(assignedTo));
        if (!isMember) {
          return res.status(400).json({
            success: false,
            message: 'Assigned user is not a member of the project team.',
            data: null,
            errors: [
              {
                field: 'assignedTo',
                message: 'The assigned user must be an approved member of this project.'
              }
            ]
          });
        }
        task.assignedTo = assignedTo;
      }
    }

    await task.save();

    // Recalculate pulse & progress and update Project.pulseScore
    const { progress, pulse } = await recalculateProjectPulse(project._id);

    return res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: {
        task,
        updatedPulseScore: pulse.pulseScore,
        progress,
        pulse
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error updating task.',
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
 * DELETE /api/tasks/:taskId
 * Removes an individual task.
 * Restricted strictly to the Project Leader.
 */
const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid task ID format.',
        data: null,
        errors: [
          {
            field: 'taskId',
            message: 'Task ID must be a valid 24-character hexadecimal ObjectId.'
          }
        ]
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found.',
        data: null,
        errors: [
          {
            message: 'No task exists with the specified ID.'
          }
        ]
      });
    }

    const project = await Project.findById(task.project);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Associated project not found.',
        data: null,
        errors: [
          {
            message: 'Project associated with this task does not exist.'
          }
        ]
      });
    }

    // Authorization: Only the Project Leader can delete tasks
    if (!project.leader.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: only the Project Leader can delete tasks.',
        data: null,
        errors: [
          {
            message: 'Only the project leader is authorized to delete tasks.'
          }
        ]
      });
    }

    await Task.findByIdAndDelete(taskId);

    // Recalculate pulse & progress and update Project.pulseScore
    const { progress, pulse } = await recalculateProjectPulse(project._id);

    return res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
      data: {
        deletedTaskId: taskId,
        updatedPulseScore: pulse.pulseScore,
        progress,
        pulse
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error deleting task.',
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
 * GET /api/projects/:projectId/pulse
 * Retrieves the full Project Pulse calculation breakdown and progress metric.
 * Accessible to any authenticated user as per API_CONTRACT.md.
 */
const getProjectPulse = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format.',
        data: null,
        errors: [
          {
            field: 'projectId',
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

    // Authorization: Only leader, approved members, or assigned supervisor can view pulse
    const isLeader = project.leader.equals(req.user._id);
    const isMember = project.members.some(m => m.equals(req.user._id));
    const isSupervisor = project.supervisor && project.supervisor.equals(req.user._id);

    if (!isLeader && !isMember && !isSupervisor) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: you are not an authorized member of this project.',
        data: null,
        errors: [
          {
            message: 'Only project leaders, approved members, or assigned supervisors can view project pulse.'
          }
        ]
      });
    }

    const { progress, pulse } = await recalculateProjectPulse(projectId);

    return res.status(200).json({
      success: true,
      message: 'Project pulse retrieved successfully',
      data: {
        pulseScore: pulse.pulseScore,
        statusLabel: pulse.statusLabel,
        badgeColor: pulse.badgeColor,
        metrics: pulse.metrics,
        explanation: pulse.explanation,
        progress
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving project pulse.',
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
 * GET /api/projects/:projectId/progress
 * Minimal dedicated read-only endpoint returning task completion progress.
 * Restricted to Project Leader, approved Project Members, and Assigned Supervisor.
 */
const getProjectProgress = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format.',
        data: null,
        errors: [
          {
            field: 'projectId',
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

    // Authorization: Only leader, approved members, or assigned supervisor can view progress
    const isLeader = project.leader.equals(req.user._id);
    const isMember = project.members.some(m => m.equals(req.user._id));
    const isSupervisor = project.supervisor && project.supervisor.equals(req.user._id);

    if (!isLeader && !isMember && !isSupervisor) {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden: you are not an authorized member of this project.',
        data: null,
        errors: [
          {
            message: 'Only project leaders, approved members, or assigned supervisors can view project progress.'
          }
        ]
      });
    }

    const { progress } = await recalculateProjectPulse(projectId);

    return res.status(200).json({
      success: true,
      message: 'Project task completion progress retrieved successfully',
      data: {
        progress
      },
      errors: null
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error retrieving project progress.',
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
  createTask,
  getProjectTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getProjectPulse,
  getProjectProgress
};
