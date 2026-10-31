import { useState, useEffect } from 'react';

export default function DeclineRequestModal({ request, isOpen, onClose, onDeclined }) {
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setFeedback('');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || !request) return null;

  const charCount = feedback.trim().length;
  const isFeedbackValid = charCount <= 500;

  const handleDecline = async (e) => {
    e.preventDefault();
    if (!isFeedbackValid) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/supervision-requests/${request._id}/decline`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          feedback: feedback.trim() ? feedback.trim() : undefined
        })
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg = json.errors && json.errors.length > 0
          ? json.errors.map(err => err.message).join(' ')
          : (json.message || `Failed to decline request (HTTP ${res.status})`);
        throw new Error(errorMsg);
      }

      if (onDeclined) {
        onDeclined(request._id);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Error declining supervision request.');
    } finally {
      setSubmitting(false);
    }
  };

  const projectTitle = request.project?.title || 'Unknown Project';
  const leaderName = request.project?.leader?.name || 'Student Leader';

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div className="modal-icon" style={{ color: '#f87171' }}>✕</div>
          <div>
            <h3 className="modal-title">Decline Supervision Proposal</h3>
            <p className="modal-text" style={{ margin: 0, fontSize: '0.85rem' }}>
              Project: <strong style={{ color: 'var(--text-primary)' }}>{projectTitle}</strong>
            </p>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginTop: '1rem' }} role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleDecline} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Are you sure you want to decline this supervision request from <strong style={{ color: 'var(--text-primary)' }}>{leaderName}</strong>? You may provide constructive feedback or reasoning for the student team.
          </p>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="decline-feedback">
                Reason / Guidance for Students (Optional)
              </label>
              <span style={{
                fontSize: '0.75rem',
                color: charCount > 500 ? '#f87171' : 'var(--text-muted)'
              }}>
                {charCount} / 500 chars
              </span>
            </div>

            <textarea
              id="decline-feedback"
              rows={4}
              className={`form-input ${charCount > 500 ? 'input-error' : ''}`}
              placeholder="e.g. Current research laboratory is at full capacity this semester, or suggest an alternative faculty member with closer specialization..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              disabled={submitting}
              maxLength={550}
            />
            {charCount > 500 && (
              <span className="form-error">Feedback cannot exceed 500 characters.</span>
            )}
          </div>

          <div className="modal-actions">
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
              className="btn btn-secondary"
              style={{
                color: '#f87171',
                borderColor: 'rgba(239, 68, 68, 0.4)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)'
              }}
              disabled={submitting || !isFeedbackValid}
            >
              {submitting ? 'Declining...' : 'Decline Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

