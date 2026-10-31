import { useState } from 'react';

export default function RemoveMemberModal({ isOpen, onClose, projectId, member, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !member) return null;

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/members/${member._id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg = json.errors && json.errors.length > 0
          ? json.errors.map(err => err.message || err.msg).join(' ')
          : (json.message || 'Failed to remove member.');
        throw new Error(errorMsg);
      }

      if (onSuccess) {
        onSuccess(member._id);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'An error occurred while removing team member.');
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
      aria-labelledby="remove-modal-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <span className="modal-icon">⚠️</span>
          <div>
            <h3 id="remove-modal-title" className="modal-title">Remove Team Member</h3>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ margin: '0.5rem 0' }}>
            {error}
          </div>
        )}

        <p className="modal-text">
          Are you sure you want to remove <strong>{member.name}</strong> ({member.department?.includes('Engineering') ? member.department : `${member.department} Engineering`}) from the project roster?
        </p>
        <p className="modal-subtext" style={{ color: 'var(--text-muted)' }}>
          This will free up a position on your team. If recruitment was previously closed, it will automatically reopen for new applicants.
        </p>

        <div className="modal-actions">
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
            {loading ? 'Removing Member...' : 'Yes, Remove Member'}
          </button>
        </div>
      </div>
    </div>
  );
}
