import { useState, useEffect } from 'react';

/**
 * TaskModal
 * Reusable modal for Project Leader to create a new task or edit an existing task.
 */
export default function TaskModal({ isOpen, onClose, projectId, members = [], task = null, onSuccess }) {
  const isEditMode = Boolean(task);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [status, setStatus] = useState('todo');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Initialize or reset form when task/isOpen changes
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      // Format dueDate as YYYY-MM-DD for HTML5 date input
      if (task.dueDate) {
        const d = new Date(task.dueDate);
        if (!isNaN(d.getTime())) {
          setDueDate(d.toISOString().split('T')[0]);
        } else {
          setDueDate('');
        }
      } else {
        setDueDate('');
      }
      setPriority(task.priority || 'medium');
      // assignedTo can be an object with _id or string ID
      const assigneeId = typeof task.assignedTo === 'object' ? task.assignedTo?._id : task.assignedTo;
      setAssignedTo(assigneeId || '');
      setStatus(task.status || 'todo');
    } else {
      setTitle('');
      setDescription('');
      // Default to 7 days in the future for new tasks
      const defaultDate = new Date(Date.now() + 7 * 86400000);
      setDueDate(defaultDate.toISOString().split('T')[0]);
      setPriority('medium');
      setAssignedTo('');
      setStatus('todo');
    }
    setError(null);
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();

    if (trimmedTitle.length < 2 || trimmedTitle.length > 100) {
      setError('Task title must be between 2 and 100 characters.');
      return;
    }

    if (!dueDate) {
      setError('Please select a valid task due date.');
      return;
    }

    if (description && description.trim().length > 500) {
      setError('Task description cannot exceed 500 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const url = isEditMode
        ? `/api/tasks/${task._id}`
        : `/api/projects/${projectId}/tasks`;
      const method = isEditMode ? 'PATCH' : 'POST';

      const payload = {
        title: trimmedTitle,
        description: description.trim(),
        dueDate: new Date(dueDate).toISOString(),
        priority,
        assignedTo: assignedTo || null
      };

      if (isEditMode) {
        payload.status = status;
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg = json.errors && json.errors.length > 0
          ? json.errors.map(err => err.message || err.msg).join(' ')
          : (json.message || `Failed to ${isEditMode ? 'update' : 'create'} task.`);
        throw new Error(errorMsg);
      }

      if (onSuccess) {
        onSuccess(json.data);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'An error occurred while saving the task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={() => !submitting && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
        <div className="modal-header">
          <span className="modal-icon">{isEditMode ? '✏️' : '📋'}</span>
          <div>
            <h3 id="task-modal-title" className="modal-title">
              {isEditMode ? 'Edit Project Task' : 'Add New Task'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {isEditMode ? 'Update task action item details.' : 'Create an actionable task item for this engineering project.'}
            </p>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ margin: '0.75rem 0' }}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          {/* Task Title */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" htmlFor="task-title-input">
              Task Title <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="task-title-input"
              type="text"
              className="form-input"
              placeholder="e.g., Calibrate Optical Flow Sensor I2C Register"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              minLength={2}
              maxLength={100}
              required
              disabled={submitting}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
              {title.trim().length} / 100 characters (min 2)
            </span>
          </div>

          {/* Description */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" htmlFor="task-desc-input">
              Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <textarea
              id="task-desc-input"
              className="form-textarea"
              rows={3}
              placeholder="Technical instructions, hardware pinouts, or deliverable criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              disabled={submitting}
              style={{ minHeight: '80px' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
              {description.trim().length} / 500 characters
            </span>
          </div>

          {/* Due Date & Priority Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="task-due-date-input">
                Due Date <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="task-due-date-input"
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="task-priority-select">
                Priority
              </label>
              <select
                id="task-priority-select"
                className="form-input"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={submitting}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>

          {/* Assignee Selection */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label" htmlFor="task-assignee-select">
              Assign Team Member <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
            </label>
            <select
              id="task-assignee-select"
              className="form-input"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              disabled={submitting}
            >
              <option value="">Unassigned (Open to Team)</option>
              {Array.isArray(members) && members.map((m) => {
                const memberId = typeof m === 'object' ? m._id : m;
                const memberName = typeof m === 'object' ? m.name : `Member (${memberId})`;
                const memberDept = typeof m === 'object' && m.department ? ` (${m.department})` : '';
                return (
                  <option key={memberId} value={memberId}>
                    {memberName}{memberDept}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Edit Mode: Task Status selector */}
          {isEditMode && (
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" htmlFor="task-status-select">
                Task Status
              </label>
              <select
                id="task-status-select"
                className="form-input"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={submitting}
              >
                <option value="todo">To Do (Pending)</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done (Completed)</option>
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !title.trim() || !dueDate}
            >
              {submitting ? 'Saving...' : (isEditMode ? 'Save Changes' : '+ Add Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
