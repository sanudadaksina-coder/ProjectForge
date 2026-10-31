import { useState } from 'react';

export default function ApplyToJoinModal({ isOpen, onClose, projectId, projectTitle, onSuccess }) {
  const [statement, setStatement] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const trimmedLength = statement.trim().length;
  const isValidLength = trimmedLength >= 10 && trimmedLength <= 300;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidLength) {
      setError('Statement of interest must be between 10 and 300 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/join-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ statement: statement.trim() })
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg = json.errors && json.errors.length > 0
          ? json.errors.map(err => err.message || err.msg).join(' ')
          : (json.message || 'Failed to submit join request.');
        throw new Error(errorMsg);
      }

      setStatement('');
      if (onSuccess) {
        onSuccess(json.data?.request);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'An error occurred while submitting your application.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setError(null);
      setStatement('');
      onClose();
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-modal-title"
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <span className="modal-icon">🤝</span>
          <div>
            <h3 id="apply-modal-title" className="modal-title">Apply to Join Project Team</h3>
            <p className="modal-sub-title" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {projectTitle}
            </p>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ margin: '0.5rem 0' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label htmlFor="statement-input" className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Statement of Interest & Relevant Skills *</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: trimmedLength > 300 ? 'var(--danger)' : trimmedLength >= 10 ? 'var(--accent-primary)' : 'var(--text-muted)'
                }}
              >
                {trimmedLength} / 300 chars {trimmedLength < 10 && `(min 10)`}
              </span>
            </label>
            <textarea
              id="statement-input"
              className="form-control"
              rows={4}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Describe your engineering skills, background, coursework, and how you will contribute to this project..."
              disabled={submitting}
              required
              style={{
                resize: 'vertical',
                minHeight: '110px',
                borderColor: trimmedLength > 0 && !isValidLength ? 'rgba(239, 68, 68, 0.5)' : undefined
              }}
            />
            <small style={{ display: 'block', marginTop: '0.35rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              The Project Leader will review this statement along with your student academic profile.
            </small>
          </div>

          <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !isValidLength}
            >
              {submitting ? 'Submitting Application...' : 'Submit Join Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
