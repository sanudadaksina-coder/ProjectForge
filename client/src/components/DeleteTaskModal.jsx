import { useState } from 'react';

/**
 * DeleteTaskModal
 * Confirmation dialog before removing a task.
 */
export default function DeleteTaskModal({ isOpen, onClose, task, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !task) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${task._id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg = json.errors && json.errors.length > 0
          ? json.errors.map(err => err.message || err.msg).join(' ')
          : (json.message || 'Failed to delete task.');
        throw new Error(errorMsg);
      }

      if (onSuccess) {
        onSuccess(json.data);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'An error occurred while deleting task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={() => !loading && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-task-modal-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <span className="modal-icon">⚠️</span>
          <div>
            <h3 id="delete-task-modal-title" className="modal-title">Delete Task</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              This will remove the action item from this project.
            </p>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ margin: '0.75rem 0' }}>
            <span>{error}</span>
          </div>
        )}

        <p className="modal-text" style={{ marginTop: '0.75rem' }}>
          Are you sure you want to permanently delete task <strong>&ldquo;{task.title}&rdquo;</strong>?
        </p>

        <p className="modal-subtext" style={{ marginTop: '0.5rem' }}>
          This will recalculate the team&apos;s completion progress and Project Pulse score.
        </p>

        <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Yes, Delete Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
