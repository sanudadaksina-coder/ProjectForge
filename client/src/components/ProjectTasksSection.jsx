import { useState, useEffect, useCallback, useRef } from 'react';
import TaskModal from './TaskModal';
import DeleteTaskModal from './DeleteTaskModal';

/**
 * ProjectTasksSection
 * Renders the clean checkbox checklist, Task Completion Progress bar, and Project Pulse metrics.
 * Enforces leader-only mutation controls while providing read-only visibility to approved members.
 */
export default function ProjectTasksSection({ projectId, isLeader, members = [], onPulseUpdated }) {
  const [tasks, setTasks] = useState([]);
  const [progress, setProgress] = useState({
    totalTasks: 0,
    completedTasks: 0,
    completionPercent: 0
  });
  const [pulse, setPulse] = useState({
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
    explanation: ''
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Filter state: 'all' | 'todo' | 'done'
  const [filter, setFilter] = useState('all');

  // Interactive toggle loading tracker
  const [togglingTaskId, setTogglingTaskId] = useState(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);

  // Keep callback reference updated without triggering refetches
  const onPulseUpdatedRef = useRef(onPulseUpdated);
  useEffect(() => {
    onPulseUpdatedRef.current = onPulseUpdated;
  }, [onPulseUpdated]);

  const fetchTasks = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to fetch project tasks (HTTP ${res.status})`);
      }

      const fetchedTasks = json.data?.tasks || [];
      const fetchedProgress = json.data?.progress || {
        totalTasks: fetchedTasks.length,
        completedTasks: fetchedTasks.filter(t => t.status === 'done').length,
        completionPercent: fetchedTasks.length === 0 ? 0 : Math.round((fetchedTasks.filter(t => t.status === 'done').length / fetchedTasks.length) * 100)
      };
      const fetchedPulse = json.data?.pulse || {
        pulseScore: 0,
        statusLabel: 'No Tasks Yet',
        badgeColor: 'gray',
        metrics: { totalTasks: 0, completedTasks: 0, completionRate: 0, overdueIncompleteTasks: 0, overduePenalty: 0 }
      };

      setTasks(fetchedTasks);
      setProgress(fetchedProgress);
      setPulse(fetchedPulse);

      if (onPulseUpdatedRef.current) {
        onPulseUpdatedRef.current(fetchedPulse);
      }
    } catch (err) {
      setError(err.message || 'Could not load project tasks.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks(true);
  }, [fetchTasks]);

  // Checkbox toggle handler (Project Leader only)
  const handleToggleTask = async (task) => {
    if (!isLeader) return;
    if (togglingTaskId === task._id) return;

    const isCurrentlyDone = task.status === 'done';
    const nextCompleted = !isCurrentlyDone;

    setTogglingTaskId(task._id);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${task._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ completed: nextCompleted })
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to update task completion state.');
      }

      // Update state immediately with server-confirmed data
      const updatedTask = json.data?.task;
      const updatedProgress = json.data?.progress;
      const updatedPulse = json.data?.pulse;

      setTasks(prevTasks =>
        prevTasks.map(t => (t._id === task._id ? { ...t, ...updatedTask } : t))
      );

      if (updatedProgress) setProgress(updatedProgress);
      if (updatedPulse) {
        setPulse(updatedPulse);
        if (onPulseUpdatedRef.current) onPulseUpdatedRef.current(updatedPulse);
      }

      setFeedback({
        type: 'success',
        message: nextCompleted
          ? `✓ Marked "${task.title}" as completed.`
          : `Reopened "${task.title}" as pending.`
      });
    } catch (err) {
      setError(err.message || 'Failed to toggle task completion.');
    } finally {
      setTogglingTaskId(null);
    }
  };

  const handleTaskCreated = (data) => {
    const newTask = data?.task;
    const updatedProgress = data?.progress;
    const updatedPulse = data?.pulse;

    if (newTask) {
      setTasks(prev => [newTask, ...prev]);
    } else {
      fetchTasks();
    }

    if (updatedProgress) setProgress(updatedProgress);
    if (updatedPulse) {
      setPulse(updatedPulse);
      if (onPulseUpdatedRef.current) onPulseUpdatedRef.current(updatedPulse);
    }

    setFeedback({ type: 'success', message: 'Task created successfully!' });
  };

  const handleTaskEdited = (data) => {
    const updatedTask = data?.task;
    const updatedProgress = data?.progress;
    const updatedPulse = data?.pulse;

    if (updatedTask) {
      setTasks(prev => prev.map(t => (t._id === updatedTask._id ? { ...t, ...updatedTask } : t)));
    } else {
      fetchTasks();
    }

    if (updatedProgress) setProgress(updatedProgress);
    if (updatedPulse) {
      setPulse(updatedPulse);
      if (onPulseUpdatedRef.current) onPulseUpdatedRef.current(updatedPulse);
    }

    setFeedback({ type: 'success', message: 'Task updated successfully!' });
  };

  const handleTaskDeleted = (data) => {
    const deletedId = data?.deletedTaskId;
    const updatedProgress = data?.progress;
    const updatedPulse = data?.pulse;

    if (deletedId) {
      setTasks(prev => prev.filter(t => t._id !== deletedId));
    } else {
      fetchTasks();
    }

    if (updatedProgress) setProgress(updatedProgress);
    if (updatedPulse) {
      setPulse(updatedPulse);
      if (onPulseUpdatedRef.current) onPulseUpdatedRef.current(updatedPulse);
    }

    setFeedback({ type: 'info', message: 'Task deleted successfully.' });
  };

  // Format date helper
  const formatDueDate = (dateStr) => {
    if (!dateStr) return 'No deadline';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Snapshot current time to evaluate overdue dates without impure function calls during render
  const [now] = useState(() => Date.now());

  // Helper to resolve assignee display name safely
  const getAssigneeName = (assignedTo) => {
    if (!assignedTo) return 'Unassigned';
    if (typeof assignedTo === 'object' && assignedTo.name) return assignedTo.name;
    const memberId = typeof assignedTo === 'object' ? assignedTo._id : assignedTo;
    const found = members.find(m => {
      const mId = typeof m === 'object' ? m._id : m;
      return mId === memberId;
    });
    return found?.name || 'Assigned Member';
  };

  // Check if a task is overdue
  const isTaskOverdue = (task) => {
    if (task.status === 'done') return false;
    if (!task.dueDate) return false;
    return new Date(task.dueDate).getTime() < now;
  };

  // Pulse badge styling helper
  const getPulseBadgeStyle = (badgeColor) => {
    switch (badgeColor) {
      case 'green':
        return { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.35)' };
      case 'yellow':
        return { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.35)' };
      case 'red':
        return { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.35)' };
      case 'gray':
      default:
        return { backgroundColor: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', borderColor: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  // Priority badge styling helper
  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'high':
        return <span className="priority-pill priority-high">High Priority</span>;
      case 'low':
        return <span className="priority-pill priority-low">Low Priority</span>;
      case 'medium':
      default:
        return <span className="priority-pill priority-medium">Medium</span>;
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filter === 'todo') return task.status !== 'done';
    if (filter === 'done') return task.status === 'done';
    return true;
  });

  return (
    <div className="tasks-section dashboard-card" style={{ marginTop: '2rem' }}>
      {/* Header Row */}
      <div className="tasks-header-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 className="card-title" style={{ fontSize: '1.35rem', margin: 0 }}>
              Project Tasks &amp; Execution Checklist
            </h2>
            {!isLeader && (
              <span className="tag-badge" style={{ backgroundColor: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-secondary)' }}>
                Read-Only Member View
              </span>
            )}
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Track milestones, manage assignments, and maintain active Project Pulse health.
          </p>
        </div>

        {/* Project Leader Add Task Button */}
        {isLeader && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddModal(true)}
            id="add-task-btn"
          >
            + Add Task
          </button>
        )}
      </div>

      {/* Dismissible Feedback Alert */}
      {feedback && (
        <div
          className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-info'}`}
          style={{ margin: '1rem 0 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', fontSize: '1.1rem', padding: '0 0.25rem' }}
            title="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="alert alert-danger" style={{ margin: '1rem 0 0.5rem' }}>
          <span>{error}</span>
        </div>
      )}

      {/* DUAL METRICS PANEL: Task Completion Progress (Left) & Project Pulse (Right) */}
      <div className="tasks-metrics-grid" style={{ marginTop: '1.25rem' }}>
        {/* Metric 1: Task Completion Progress Card */}
        <div className="task-metric-card">
          <div className="metric-header-row">
            <span className="metric-label">Task Completion Progress</span>
            <span className="metric-value-large" id="completion-percent-display">
              {progress.completionPercent}%
            </span>
          </div>

          <p className="metric-subtext">
            {progress.totalTasks === 0 ? (
              <span>No tasks yet (0% completed)</span>
            ) : (
              <span>{progress.completedTasks} of {progress.totalTasks} tasks completed</span>
            )}
          </p>

          {/* Animated Progress Bar */}
          <div className="task-progress-track" aria-hidden="true">
            <div
              className="task-progress-fill"
              style={{ width: `${progress.completionPercent}%` }}
              role="progressbar"
              aria-valuenow={progress.completionPercent}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
        </div>

        {/* Metric 2: Project Pulse Card */}
        <div className="task-metric-card pulse-metric-card">
          <div className="metric-header-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="metric-label">Project Pulse</span>
              <span
                className="status-pill"
                id="pulse-status-badge"
                style={{ ...getPulseBadgeStyle(pulse.badgeColor), fontSize: '0.75rem', padding: '0.15rem 0.6rem' }}
              >
                {pulse.statusLabel}
              </span>
            </div>
            <span className="metric-value-large" id="pulse-score-display" style={{ color: pulse.badgeColor === 'green' ? '#34d399' : pulse.badgeColor === 'yellow' ? '#fbbf24' : pulse.badgeColor === 'red' ? '#f87171' : '#cbd5e1' }}>
              {pulse.pulseScore}<span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/100</span>
            </span>
          </div>

          <div className="pulse-breakdown-row" style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>Completion Rate: <strong>{pulse.metrics?.completionRate ?? 0}%</strong></span>
            {pulse.metrics?.overdueIncompleteTasks > 0 ? (
              <span style={{ color: '#f87171', fontWeight: 600 }}>
                ⚠️ {pulse.metrics.overdueIncompleteTasks} overdue task(s) (-{pulse.metrics.overduePenalty} penalty)
              </span>
            ) : (
              <span style={{ color: '#34d399' }}>✓ 0 overdue tasks</span>
            )}
          </div>

          <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Calculated as completion rate minus overdue incomplete task penalties.
          </p>
        </div>
      </div>

      {/* FILTER TABS & TASK COUNT */}
      <div className="task-controls-bar" style={{ marginTop: '1.5rem' }}>
        <div className="task-filter-pills">
          <button
            type="button"
            className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Tasks ({tasks.length})
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === 'todo' ? 'active' : ''}`}
            onClick={() => setFilter('todo')}
          >
            To Do ({tasks.filter(t => t.status !== 'done').length})
          </button>
          <button
            type="button"
            className={`filter-pill ${filter === 'done' ? 'active' : ''}`}
            onClick={() => setFilter('done')}
          >
            Done ({tasks.filter(t => t.status === 'done').length})
          </button>
        </div>
      </div>

      {/* TASK LIST CONTENT */}
      {loading ? (
        <div style={{ padding: '2.5rem', textAlign: 'center' }}>
          <div className="dot dot-yellow"></div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.75rem' }}>Loading project tasks...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="empty-tasks-card">
          <div className="empty-icon">📋</div>
          {tasks.length === 0 ? (
            <>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.35rem' }}>No Tasks Yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1rem' }}>
                {isLeader
                  ? 'No tasks created yet. Click "+ Add Task" to set up work items, assign team members, and track Project Pulse.'
                  : 'No tasks have been assigned by the Project Leader yet.'}
              </p>
              {isLeader && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddModal(true)}
                >
                  + Add First Task
                </button>
              )}
            </>
          ) : (
            <>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.35rem' }}>No Tasks Matching Filter</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                No tasks found with status &quot;{filter}&quot;.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="task-checklist" role="list" style={{ marginTop: '1rem' }}>
          {filteredTasks.map((task) => {
            const isDone = task.status === 'done';
            const overdue = isTaskOverdue(task);
            const isSaving = togglingTaskId === task._id;

            return (
              <div
                key={task._id}
                className={`task-row ${isDone ? 'task-row-done' : ''}`}
                role="listitem"
              >
                {/* Checkbox Column */}
                <div className="task-checkbox-col">
                  <label
                    className={`custom-checkbox-wrapper ${isSaving ? 'saving' : ''}`}
                    title={
                      isLeader
                        ? (isDone ? 'Click to mark as incomplete' : 'Click to mark as done')
                        : 'Only the Project Leader can toggle task completion'
                    }
                  >
                    <input
                      type="checkbox"
                      checked={isDone}
                      onChange={() => handleToggleTask(task)}
                      disabled={!isLeader || isSaving}
                      className="task-checkbox-input"
                      aria-label={`Toggle completion for task ${task.title}`}
                    />
                    <span className="checkbox-custom-box">
                      {isDone && '✓'}
                    </span>
                  </label>
                </div>

                {/* Task Details Column */}
                <div className="task-details-col">
                  <div className="task-title-row">
                    <span className={`task-title-text ${isDone ? 'done-strike' : ''}`}>
                      {task.title}
                    </span>
                    <span className={`task-state-badge ${isDone ? 'badge-done' : 'badge-todo'}`}>
                      {isDone ? 'Done' : 'To Do'}
                    </span>
                  </div>

                  {/* Optional Description */}
                  {task.description && (
                    <p className="task-description-text">
                      {task.description}
                    </p>
                  )}

                  {/* Metadata Badges Row */}
                  <div className="task-meta-row">
                    {/* Priority */}
                    {getPriorityBadge(task.priority)}

                    {/* Due Date & Overdue Indicator */}
                    <span className={`meta-pill ${overdue ? 'overdue-pill' : ''}`}>
                      📅 {overdue ? '⚠️ Overdue: ' : 'Due: '}
                      {formatDueDate(task.dueDate)}
                    </span>

                    {/* Assignee */}
                    <span className="meta-pill">
                      👤 {getAssigneeName(task.assignedTo)}
                    </span>

                    {/* CompletedAt Timestamp if available */}
                    {isDone && task.completedAt && (
                      <span className="meta-pill" style={{ color: 'var(--success)' }}>
                        ✓ Completed {new Date(task.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Project Leader Actions Column */}
                {isLeader && (
                  <div className="task-actions-col">
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setTaskToEdit(task)}
                      title="Edit task details"
                      aria-label={`Edit task ${task.title}`}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-icon-danger"
                      onClick={() => setTaskToDelete(task)}
                      title="Delete task"
                      aria-label={`Delete task ${task.title}`}
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Create Task */}
      <TaskModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        projectId={projectId}
        members={members}
        task={null}
        onSuccess={handleTaskCreated}
      />

      {/* Modal: Edit Task */}
      <TaskModal
        isOpen={Boolean(taskToEdit)}
        onClose={() => setTaskToEdit(null)}
        projectId={projectId}
        members={members}
        task={taskToEdit}
        onSuccess={handleTaskEdited}
      />

      {/* Modal: Delete Task Confirmation */}
      <DeleteTaskModal
        isOpen={Boolean(taskToDelete)}
        onClose={() => setTaskToDelete(null)}
        task={taskToDelete}
        onSuccess={handleTaskDeleted}
      />
    </div>
  );
}
