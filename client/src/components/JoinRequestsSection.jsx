import { useState, useEffect, useCallback } from 'react';

export default function JoinRequestsSection({ projectId, isLeader, onMemberAdded, projectFull }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchRequests = useCallback(async () => {
    if (!isLeader) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/join-requests?status=pending`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to fetch join requests.');
      }

      setRequests(json.data?.requests || []);
    } catch (err) {
      setError(err.message || 'Error loading join requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, isLeader]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleApprove = async (requestId, studentName) => {
    setActionLoadingId(requestId);
    setFeedback(null);
    setError(null);

    try {
      const res = await fetch(`/api/membership-requests/${requestId}/approve`, {
        method: 'PATCH',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg = json.errors && json.errors.length > 0
          ? json.errors.map(e => e.message || e.msg).join(' ')
          : (json.message || 'Failed to approve join request.');
        throw new Error(errorMsg);
      }

      setFeedback({ type: 'success', message: `${studentName} was approved and added to your team roster!` });
      await fetchRequests();
      if (onMemberAdded) {
        onMemberAdded();
      }
    } catch (err) {
      setError(err.message || 'Error approving request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (requestId, studentName) => {
    setActionLoadingId(requestId);
    setFeedback(null);
    setError(null);

    try {
      const res = await fetch(`/api/membership-requests/${requestId}/reject`, {
        method: 'PATCH',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg = json.errors && json.errors.length > 0
          ? json.errors.map(e => e.message || e.msg).join(' ')
          : (json.message || 'Failed to reject join request.');
        throw new Error(errorMsg);
      }

      setFeedback({ type: 'info', message: `Join request from ${studentName} was rejected.` });
      await fetchRequests();
    } catch (err) {
      setError(err.message || 'Error rejecting request.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  if (!isLeader) return null;

  return (
    <div className="dashboard-card join-requests-card" style={{ marginTop: '2rem' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Team Join Requests</h2>
          <span className="tag-badge" style={{ backgroundColor: requests.length > 0 ? 'rgba(56, 189, 248, 0.2)' : undefined }}>
            {requests.length} Pending
          </span>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={fetchRequests}
          disabled={loading}
          style={{ fontSize: '0.8rem', padding: '0.25rem 0.6rem' }}
        >
          {loading ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      {projectFull && (
        <div className="alert alert-warning" style={{ margin: '1rem 0 0.5rem', fontSize: '0.875rem' }}>
          ⚠️ <strong>Team is at maximum capacity.</strong> To approve a new applicant, you must first remove a current member.
        </div>
      )}

      {feedback && (
        <div
          className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-info'}`}
          style={{ margin: '1rem 0 0.5rem' }}
        >
          {feedback.message}
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ margin: '1rem 0 0.5rem' }}>
          {error}
        </div>
      )}

      {loading && requests.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div className="dot dot-yellow" style={{ width: '1rem', height: '1rem', display: 'inline-block', marginRight: '0.5rem' }}></div>
          Loading applicant join requests...
        </div>
      ) : requests.length === 0 ? (
        <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📬</div>
          <p style={{ margin: 0, fontWeight: 500 }}>No pending join requests</p>
          <small style={{ color: 'var(--text-muted)' }}>
            When students submit applications to join your team, they will appear here for your review.
          </small>
        </div>
      ) : (
        <div className="requests-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
          {requests.map((req) => {
            const student = req.student || {};
            const isProcessing = actionLoadingId === req._id;

            return (
              <div
                key={req._id}
                className="request-item-card"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}
              >
                {/* Applicant Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div
                      className="roster-avatar"
                      style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-primary)' }}
                    >
                      🎓
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                          {student.name || 'Applicant'}
                        </span>
                        {student.semester && (
                          <span className="tag-badge" style={{ fontSize: '0.7rem' }}>
                            Sem {student.semester}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        <span>{student.department?.includes('Engineering') ? student.department : `${student.department} Engineering`}</span>
                        {student.studentId && <span> • Roll: {student.studentId}</span>}
                        {student.email && <span> • 📧 {student.email}</span>}
                      </div>
                    </div>
                  </div>

                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Applied: {formatTimestamp(req.createdAt)}
                  </span>
                </div>

                {/* Skills tags */}
                {Array.isArray(student.skills) && student.skills.length > 0 && (
                  <div className="skills-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {student.skills.map((skill, idx) => (
                      <span key={idx} className="skill-chip" style={{ fontSize: '0.75rem' }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* Statement Quote */}
                <div
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                    borderLeft: '3px solid var(--accent-primary)',
                    padding: '0.85rem 1rem',
                    borderRadius: '0 0.5rem 0.5rem 0',
                    fontSize: '0.925rem',
                    lineHeight: '1.5',
                    color: 'var(--text-primary)'
                  }}
                >
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 700, marginRight: '0.35rem' }}>&ldquo;</span>
                  {req.statement}
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 700, marginLeft: '0.35rem' }}>&rdquo;</span>
                </div>

                {/* Actions row */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleReject(req._id, student.name || 'Applicant')}
                    disabled={isProcessing}
                    style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: 'var(--danger)' }}
                  >
                    {isProcessing ? 'Processing...' : '✕ Reject'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleApprove(req._id, student.name || 'Applicant')}
                    disabled={isProcessing || projectFull}
                    title={projectFull ? 'Team is at maximum capacity' : 'Approve and add to team'}
                  >
                    {isProcessing ? 'Processing...' : '✓ Approve & Add to Team'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
