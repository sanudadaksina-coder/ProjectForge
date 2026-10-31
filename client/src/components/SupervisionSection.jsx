import { useState, useEffect, useCallback } from 'react';
import RequestSupervisionModal from './RequestSupervisionModal';

export default function SupervisionSection({ project, isLeader, onSupervisionUpdated }) {
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const projectId = project?._id;

  const fetchSupervisionRequests = useCallback(async () => {
    if (!projectId || !isLeader) return;

    setLoadingRequests(true);
    setRequestError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/supervision-requests`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to fetch supervision requests (HTTP ${res.status})`);
      }

      setRequests(json.data?.requests || []);
    } catch (err) {
      setRequestError(err.message || 'Could not load supervision requests.');
    } finally {
      setLoadingRequests(false);
    }
  }, [projectId, isLeader]);

  useEffect(() => {
    fetchSupervisionRequests();
  }, [fetchSupervisionRequests]);

  const handleRequestSubmitted = (newRequest) => {
    // Add new request to list and refetch
    setRequests(prev => [newRequest, ...prev]);
    fetchSupervisionRequests();
    if (onSupervisionUpdated) {
      onSupervisionUpdated();
    }
  };

  const pendingRequest = requests.find(r => r.status === 'pending');
  const hasAssignedSupervisor = Boolean(project?.supervisor);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not recorded';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="dashboard-card supervision-section-card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Faculty Supervision</h2>
          <span className="tag-badge" style={{
            backgroundColor: hasAssignedSupervisor ? 'rgba(52, 211, 153, 0.15)' : pendingRequest ? 'rgba(251, 191, 36, 0.15)' : 'rgba(148, 163, 184, 0.15)',
            color: hasAssignedSupervisor ? 'var(--accent-green)' : pendingRequest ? 'var(--accent-yellow)' : 'var(--text-muted)'
          }}>
            {hasAssignedSupervisor ? 'Assigned' : pendingRequest ? 'Pending Review' : 'Unassigned'}
          </span>
        </div>

        {isLeader && !hasAssignedSupervisor && !pendingRequest && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowRequestModal(true)}
          >
            + Request Supervision
          </button>
        )}
      </div>

      {requestError && (
        <div className="alert alert-danger" style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>
          <span className="alert-icon">⚠️</span>
          <span>{requestError}</span>
        </div>
      )}

      {loadingRequests && !requests.length && (
        <div style={{ padding: '0.5rem 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          Loading supervision requests...
        </div>
      )}

      {/* Case 1: Project has an assigned supervisor */}
      {hasAssignedSupervisor ? (
        <div className="assigned-supervisor-card" style={{ marginTop: '0.75rem' }}>
          <div className="roster-item" style={{ border: 'none', padding: 0 }}>
            <div className="roster-avatar" style={{ backgroundColor: 'rgba(129, 140, 248, 0.2)', color: 'var(--accent-secondary)' }}>
              🎓
            </div>
            <div className="roster-details" style={{ flex: 1 }}>
              <div className="roster-name-row">
                <span className="roster-name">{project.supervisor.name}</span>
                <span className="tag-badge" style={{ backgroundColor: 'rgba(129, 140, 248, 0.1)', color: 'var(--accent-secondary)' }}>
                  Faculty Advisor
                </span>
              </div>
              <div className="roster-sub-row">
                <span>{project.supervisor.department?.includes('Engineering') ? project.supervisor.department : `${project.supervisor.department} Engineering`}</span>
                {project.supervisor.designation && <span> • {project.supervisor.designation}</span>}
              </div>
              <div className="roster-contact">📧 {project.supervisor.contactEmail || project.supervisor.email}</div>
              {project.supervisor.officeLocation && (
                <div className="roster-contact" style={{ color: 'var(--text-muted)' }}>
                  📍 Office: {project.supervisor.officeLocation}
                </div>
              )}
              {Array.isArray(project.supervisor.researchInterests) && project.supervisor.researchInterests.length > 0 && (
                <div className="skills-chips" style={{ marginTop: '0.5rem' }}>
                  {project.supervisor.researchInterests.map((interest, idx) => (
                    <span key={idx} className="skill-chip" style={{ fontSize: '0.75rem' }}>
                      #{interest}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Case 2: No assigned supervisor */
        <div style={{ marginTop: '0.75rem' }}>
          {/* Active Pending Request Banner for Leader */}
          {pendingRequest ? (
            <div style={{
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '0.5rem',
              padding: '1rem 1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }}>⏳</span>
                  <strong style={{ color: '#fbbf24', fontSize: '0.95rem' }}>
                    Supervision Proposal Pending Review
                  </strong>
                </div>
                <span className="status-pill status-in-progress" style={{ fontSize: '0.75rem' }}>
                  Status: Pending
                </span>
              </div>

              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Invited Faculty: <strong style={{ color: 'var(--text-primary)' }}>{pendingRequest.supervisor?.name || 'Faculty Member'}</strong> ({pendingRequest.supervisor?.department?.includes('Engineering') ? pendingRequest.supervisor?.department : `${pendingRequest.supervisor?.department} Engineering`})
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Submitted on {formatDate(pendingRequest.createdAt)}
              </div>

              <div style={{
                backgroundColor: 'rgba(15, 23, 42, 0.4)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.375rem',
                padding: '0.75rem',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                fontStyle: 'italic',
                whiteSpace: 'pre-wrap'
              }}>
                &ldquo;{pendingRequest.proposalMessage}&rdquo;
              </div>

              <p style={{ margin: '0.65rem 0 0 0', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                ℹ️ The supervisor will review this proposal and decide to accept or decline. Another request cannot be submitted while this proposal is pending.
              </p>
            </div>
          ) : (
            <div className="supervisor-placeholder" style={{ textAlign: 'left', padding: '0.5rem 0' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', margin: '0 0 0.5rem 0' }}>
                No faculty supervisor has been assigned to this project yet.
              </p>
              {isLeader ? (
                <div style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.05)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: '0.5rem',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.75rem'
                }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', fontSize: '0.875rem', display: 'block' }}>
                      Ready to seek academic mentorship?
                    </strong>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      Browse faculty specializations and submit a formal supervision request.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowRequestModal(true)}
                  >
                    Request Faculty Supervision
                  </button>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', margin: 0 }}>
                  The Project Leader can browse the supervisor directory and send an invitation to advise this project.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Leader Request History */}
      {isLeader && requests.length > 0 && (
        <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowHistory(prev => !prev)}
            style={{ fontSize: '0.775rem', padding: '0.25rem 0.6rem' }}
          >
            {showHistory ? '▲ Hide Supervision Proposal History' : `▼ View Proposal History (${requests.length})`}
          </button>

          {showHistory && (
            <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {requests.map(req => {
                const isAccepted = req.status === 'accepted';
                const isDeclined = req.status === 'declined';
                return (
                  <div
                    key={req._id}
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.3)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '0.375rem',
                      padding: '0.75rem',
                      fontSize: '0.825rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {req.supervisor?.name || 'Faculty Member'}
                        </strong>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          ({req.supervisor?.department?.includes('Engineering') ? req.supervisor?.department : `${req.supervisor?.department} Engineering`})
                        </span>
                      </div>
                      <span className={`status-pill ${
                        isAccepted ? 'badge-completed' : isDeclined ? 'recruitment-closed' : 'status-in-progress'
                      }`} style={{ fontSize: '0.725rem' }}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </div>

                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                      Sent on {formatDate(req.createdAt)}
                      {req.reviewedAt && (
                        <span> • Reviewed on {formatDate(req.reviewedAt)}</span>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: req.feedback ? '0.35rem' : 0 }}>
                      Proposal: &ldquo;{req.proposalMessage}&rdquo;
                    </div>

                    {isDeclined && req.feedback && (
                      <div style={{
                        marginTop: '0.35rem',
                        padding: '0.4rem 0.6rem',
                        backgroundColor: 'rgba(239, 68, 68, 0.08)',
                        borderLeft: '3px solid #f87171',
                        borderRadius: '0.25rem',
                        color: '#f87171',
                        fontSize: '0.775rem'
                      }}>
                        <strong>Supervisor Feedback:</strong> {req.feedback}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Leader sends supervision request */}
      {isLeader && (
        <RequestSupervisionModal
          projectId={projectId}
          projectTitle={project.title}
          isOpen={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          onRequestSubmitted={handleRequestSubmitted}
        />
      )}
    </div>
  );
}
