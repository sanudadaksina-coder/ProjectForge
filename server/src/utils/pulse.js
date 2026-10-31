const Task = require('../models/Task');
const Project = require('../models/Project');

/**
 * Pure calculation function for Task Completion Progress and Project Pulse metrics.
 * 
 * Progress:
 * - totalTasks = count of all tasks in project
 * - completedTasks = count of tasks with status === 'done'
 * - completionPercent = totalTasks === 0 ? 0 : Math.round(completedTasks / totalTasks * 100)
 * 
 * Project Pulse:
 * - completionRate = totalTasks === 0 ? 0 : (completedTasks / totalTasks) * 100
 * - overdueIncompleteTasks = count of tasks where status !== 'done' and dueDate < now
 * - penalty = overdueIncompleteTasks * 10
 * - pulseScore = Math.max(0, Math.min(100, Math.round(completionRate - penalty)))
 * 
 * Status Labels & Badges:
 * - Zero tasks: 'No Tasks Yet' (badgeColor: 'gray')
 * - 0–39 with tasks: 'At Risk' (badgeColor: 'red')
 * - 40–74: 'In Progress' (badgeColor: 'yellow')
 * - 75–100: 'On Track' (badgeColor: 'green')
 * 
 * @param {Array} tasks - List of task objects or documents
 * @param {Date} [now=new Date()] - Reference timestamp for overdue checks
 * @returns {{ progress: Object, pulse: Object }}
 */
function calculatePulseAndProgress(tasks = [], now = new Date()) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const completionPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const progress = {
    totalTasks,
    completedTasks,
    completionPercent
  };

  // Zero tasks case
  if (totalTasks === 0) {
    return {
      progress,
      pulse: {
        pulseScore: 0,
        statusLabel: 'No Tasks Yet',
        badgeColor: 'gray',
        metrics: {
          totalTasks: 0,
          completedTasks: 0,
          completionRate: 0,
          overdueIncompleteTasks: 0,
          overduePenalty: 0
        },
        explanation: 'No tasks created yet. Create tasks with deadlines to track Project Pulse.'
      }
    };
  }

  const completionRate = (completedTasks / totalTasks) * 100;

  // Overdue incomplete tasks: status !== 'done' AND dueDate < now
  const nowMs = new Date(now).getTime();
  const overdueIncompleteTasks = tasks.filter(t => {
    if (t.status === 'done') return false;
    if (!t.dueDate) return false;
    const dueMs = new Date(t.dueDate).getTime();
    return dueMs < nowMs;
  }).length;

  const overduePenalty = overdueIncompleteTasks * 10;
  const rawScore = Math.round(completionRate - overduePenalty);
  const pulseScore = Math.max(0, Math.min(100, rawScore));

  let statusLabel = 'On Track';
  let badgeColor = 'green';

  if (pulseScore <= 39) {
    statusLabel = 'At Risk';
    badgeColor = 'red';
  } else if (pulseScore <= 74) {
    statusLabel = 'In Progress';
    badgeColor = 'yellow';
  } else {
    statusLabel = 'On Track';
    badgeColor = 'green';
  }

  return {
    progress,
    pulse: {
      pulseScore,
      statusLabel,
      badgeColor,
      metrics: {
        totalTasks,
        completedTasks,
        completionRate: Math.round(completionRate * 100) / 100,
        overdueIncompleteTasks,
        overduePenalty
      },
      explanation: 'Calculated as max(0, min(100, round(completionRate - overduePenalty)))'
    }
  };
}

/**
 * Recomputes Project Pulse and Task Completion Progress from MongoDB records
 * and keeps Project.pulseScore synchronized in the database.
 * 
 * @param {string|mongoose.Types.ObjectId} projectId
 * @param {Date} [now=new Date()]
 * @returns {Promise<{ progress: Object, pulse: Object, tasks: Array }>}
 */
async function recalculateProjectPulse(projectId, now = new Date()) {
  const tasks = await Task.find({ project: projectId }).sort({ createdAt: -1 });
  const { progress, pulse } = calculatePulseAndProgress(tasks, now);

  await Project.findByIdAndUpdate(projectId, { pulseScore: pulse.pulseScore });

  return { progress, pulse, tasks };
}

module.exports = {
  calculatePulseAndProgress,
  recalculateProjectPulse
};
