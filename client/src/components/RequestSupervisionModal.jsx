import { useState, useEffect } from 'react';

export default function RequestSupervisionModal({
  projectId,
  projectTitle,
  isOpen,
  onClose,
  onRequestSubmitted
}) {
  const [supervisors, setSupervisors] = useState([]);
  const [loadingSupervisors, setLoadingSupervisors] = useState(false);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [proposalMessage, setProposalMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Fetch list of supervisors when modal opens
  useEffect(() => {
    if (!isOpen) {
      setSelectedSupervisorId('');
      setProposalMessage('');
      setError(null);
      setFieldErrors({});
      return;
    }

    let isMounted = true;
    setLoadingSupervisors(true);
    setError(null);

    const fetchSupervisors = async () => {
      try {
        const res = await fetch('/api/supervisors', {
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        });

        const json = await res.json();

        if (!isMounted) return;

        if (res.ok && json.success && Array.isArray(json.data?.supervisors)) {
          setSupervisors(json.data.supervisors);
          // If available supervisors exist, default to the first available one
          const available = json.data.supervisors.find(s => s.isAvailable);
          if (available) {
            setSelectedSupervisorId(available._id);
          } else if (json.data.supervisors.length > 0) {
            setSelectedSupervisorId(json.data.supervisors[0]._id);
          }
        } else {
          throw new Error(json.message || 'Failed to load faculty supervisors');
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Could not load supervisor list.');
      } finally {
        if (isMounted) setLoadingSupervisors(false);
      }
    };

    fetchSupervisors();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmedMessage = proposalMessage.trim();
  const charCount = trimmedMessage.length;
  const isMessageValid = charCount >= 20 && charCount <= 1000;

  const validate = () => {
    const errors = {};

    if (!selectedSupervisorId) {
      errors.supervisorId = 'Please select a faculty supervisor from the directory.';
    }

    if (!proposalMessage.trim()) {
      errors.proposalMessage = 'Proposal message is required.';
    } else if (proposalMessage.trim().length < 20) {
      errors.proposalMessage = 'Proposal message must be at least 20 characters long.';
    } else if (proposalMessage.trim().length > 1000) {
      errors.proposalMessage = 'Proposal message cannot exceed 1000 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/supervision-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          supervisorId: selectedSupervisorId,
          proposalMessage: proposalMessage.trim()
        })
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg = json.errors && json.errors.length > 0
          ? json.errors.map(err => err.message).join(' ')
          : (json.message || `Submission failed with HTTP ${res.status}`);
        throw new Error(errorMsg);
      }

      if (onRequestSubmitted) {
        onRequestSubmitted(json.data?.request);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Error submitting supervision request.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSupervisor = supervisors.find(s => s._id === selectedSupervisorId);

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        <div className="modal-header">
          <div className="modal-icon">📨</div>
          <div>
            <h3 className="modal-title">Request Faculty Supervision</h3>
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
          {/* Supervisor Selection */}
          <div className="form-group">
            <label className="form-label" htmlFor="select-supervisor">
              Select Faculty Supervisor <span className="req">*</span>
            </label>

            {loadingSupervisors ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0.5rem 0' }}>
                Loading faculty directory...
              </div>
            ) : supervisors.length === 0 ? (
              <div className="alert alert-warning" style={{ fontSize: '0.875rem' }}>
                No supervisor accounts found in the directory.
              </div>
            ) : (
              <>
                <select
                  id="select-supervisor"
                  className={`form-input ${fieldErrors.supervisorId ? 'input-error' : ''}`}
                  value={selectedSupervisorId}
                  onChange={(e) => {
                    setSelectedSupervisorId(e.target.value);
                    if (fieldErrors.supervisorId) setFieldErrors(prev => ({ ...prev, supervisorId: null }));
                  }}
                  disabled={submitting}
                  required
                >
                  <option value="" disabled>-- Select a faculty supervisor --</option>
                  {supervisors.map(sup => (
                    <option key={sup._id} value={sup._id}>
                      {sup.name} — {sup.department} ({sup.activeProjectsCount}/{sup.maxCapacity} active){!sup.isAvailable ? ' [FULL]' : ''}
                    </option>
                  ))}
                </select>
                {fieldErrors.supervisorId && (
                  <span className="form-error">{fieldErrors.supervisorId}</span>
                )}
              </>
            )}

            {/* Selected supervisor info card */}
            {selectedSupervisor && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.375rem',
                fontSize: '0.825rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    {selectedSupervisor.name} ({selectedSupervisor.designation || 'Faculty'})
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {selectedSupervisor.department?.includes('Engineering') ? selectedSupervisor.department : `${selectedSupervisor.department} Engineering`} • 📧 {selectedSupervisor.contactEmail || selectedSupervisor.email}
                  </div>
                </div>
                <span className={`status-pill ${selectedSupervisor.isAvailable ? 'recruitment-open' : 'recruitment-closed'}`} style={{ fontSize: '0.75rem' }}>
                  {selectedSupervisor.isAvailable
                    ? `🟢 Available (${selectedSupervisor.maxCapacity - selectedSupervisor.activeProjectsCount} spots open)`
                    : '🔴 Capacity Full (5/5)'}
                </span>
              </div>
            )}
          </div>

          {/* Proposal Message */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" htmlFor="proposal-message">
                Proposal &amp; Supervision Motivation <span className="req">*</span>
              </label>
              <span style={{
                fontSize: '0.75rem',
                color: charCount < 20 ? '#fbbf24' : charCount > 1000 ? '#f87171' : 'var(--text-muted)'
              }}>
                {charCount} / 1000 chars (min 20)
              </span>
            </div>

            <textarea
              id="proposal-message"
              rows={5}
              className={`form-input ${fieldErrors.proposalMessage ? 'input-error' : ''}`}
              placeholder="Describe your project's scope, methodology, why you are seeking this faculty member's supervision, and how their research specialization aligns with your work..."
              value={proposalMessage}
              onChange={(e) => {
                setProposalMessage(e.target.value);
                if (fieldErrors.proposalMessage) setFieldErrors(prev => ({ ...prev, proposalMessage: null }));
              }}
              disabled={submitting}
              required
            />
            {fieldErrors.proposalMessage && (
              <span className="form-error">{fieldErrors.proposalMessage}</span>
            )}
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
              Provide a professional overview between 20 and 1000 characters. The supervisor will review this message when deciding to accept or decline.
            </p>
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
              className="btn btn-primary"
              disabled={submitting || !selectedSupervisorId || !isMessageValid}
            >
              {submitting ? 'Submitting Request...' : 'Send Supervision Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

