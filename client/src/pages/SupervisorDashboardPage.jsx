import { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DeclineRequestModal from '../components/DeclineRequestModal';

export default function SupervisorDashboardPage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'accepted' | 'declined'

  const [pendingRequests, setPendingRequests] = useState([]);
  const [acceptedRequests, setAcceptedRequests] = useState([]);
  const [declinedRequests, setDeclinedRequests] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  // In-flight accept action state
  const [acceptingId, setAcceptingId] = useState(null);

  // Decline modal state
  const [requestToDecline, setRequestToDecline] = useState(null);

  // Fetch requests for all statuses or active status
  const fetchAllRequests = useCallback(async () => {
    if (!user || user.accountType !== 'supervisor') return;

    setLoading(true);
    setError(null);

    try {
      const [pendingRes, acceptedRes, declinedRes] = await Promise.all([
        fetch('/api/supervisors/my-requests?status=pending', {
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        }),
        fetch('/api/supervisors/my-requests?status=accepted', {
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        }),
        fetch('/api/supervisors/my-requests?status=declined', {
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        })
      ]);

      const [pendingJson, acceptedJson, declinedJson] = await Promise.all([
        pendingRes.json(),
        acceptedRes.json(),
        declinedRes.json()
      ]);

      if (!pendingRes.ok || !pendingJson.success) {
        throw new Error(pendingJson.message || 'Failed to fetch pending requests');
      }
      if (!acceptedRes.ok || !acceptedJson.success) {
        throw new Error(acceptedJson.message || 'Failed to fetch accepted requests');
      }
      if (!declinedRes.ok || !declinedJson.success) {
        throw new Error(declinedJson.message || 'Failed to fetch declined requests');
      }

      setPendingRequests(pendingJson.data?.requests || []);
      setAcceptedRequests(acceptedJson.data?.requests || []);
      setDeclinedRequests(declinedJson.data?.requests || []);
    } catch (err) {
      setError(err.message || 'Could not load supervision requests.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAllRequests();
  }, [fetchAllRequests]);

  // Authorization check: only supervisors
  if (user && user.accountType !== 'supervisor') {
    return <Navigate to="/dashboard" replace />;
  }

  // Handle Accept
  const handleAcceptRequest = async (requestId) => {
    if (!window.confirm('Accept this supervision proposal? This project will be linked to your supervision roster.')) {
      return;
    }

    setAcceptingId(requestId);
    setError(null);
    setNotice(null);

    try {
      const res = await fetch(`/api/supervision-requests/${requestId}/accept`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include'
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg = json.errors && json.errors.length > 0
          ? json.errors.map(err => err.message).join(' ')
          : (json.message || `Failed to accept proposal (HTTP ${res.status})`);
        throw new Error(errorMsg);
      }

      setNotice({
        type: 'success',
        message: 'Supervision request accepted successfully! Project is now under your mentorship.'
      });

      // Refresh inbox
      await fetchAllRequests();
    } catch (err) {
      setError(err.message || 'Error accepting supervision request.');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeclineCompleted = async () => {
    setNotice({
      type: 'info',
      message: 'Supervision request was declined.'
    });
    setRequestToDecline(null);
    await fetchAllRequests();
  };

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

  const maxCap = user?.maxCapacity || 5;
  const activeCount = acceptedRequests.length;
  const isAvailable = activeCount < maxCap;
  const remainingSpots = Math.max(0, maxCap - activeCount);

  return (
    <div className="dashboard-page">
      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        {/* Supervisor Welcome & Workload Header */}
        <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
          <div>
            <div className="dashboard-eyebrow">Faculty Supervision Hub</div>
            <h1 className="dashboard-title">
              Welcome, {user?.name}
            </h1>
            <p className="dashboard-subtitle">
              Review student supervision requests, manage your active capstone project roster, and guide engineering teams.
            </p>
          </div>

          {/* Workload Metric Box */}
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid var(--border-color)',
            borderRadius: '0.5rem',
            padding: '1rem 1.25rem',
            minWidth: '260px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>Supervision Capacity</span>
              <span className={`status-pill ${isAvailable ? 'recruitment-open' : 'recruitment-closed'}`} style={{ fontSize: '0.75rem' }}>
                {isAvailable ? '🟢 Available' : '🔴 Full'}
              </span>
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
              {activeCount} / {maxCap} Active Projects
            </div>
            {/* Progress bar */}
            <div style={{
              width: '100%',
              height: '6px',
              backgroundColor: 'rgba(51, 65, 85, 0.5)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.min(100, Math.round((activeCount / maxCap) * 100))}%`,
                height: '100%',
                backgroundColor: isAvailable ? 'var(--accent-primary)' : '#f87171',
                borderRadius: '3px'
              }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: isAvailable ? 'var(--accent-green)' : '#f87171', marginTop: '0.35rem' }}>
              {isAvailable ? `${remainingSpots} supervision slot${remainingSpots === 1 ? '' : 's'} available` : 'Active capacity limit reached (5/5)'}
            </div>
          </div>
        </div>

        {/* Alerts */}
        {notice && (
          <div className={`alert ${notice.type === 'success' ? 'alert-success' : 'alert-info'}`} style={{ marginBottom: '1.25rem' }}>
            <span className="alert-icon">{notice.type === 'success' ? '✓' : 'ℹ️'}</span>
            <span>{notice.message}</span>
          </div>
        )}

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }} role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.75rem',
          marginBottom: '1.75rem',
          flexWrap: 'wrap'
        }}>
          <button
            type="button"
            className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('pending')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>Pending Requests</span>
            <span className="tag-badge" style={{
              backgroundColor: activeTab === 'pending' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(56, 189, 248, 0.1)',
              color: activeTab === 'pending' ? '#fff' : 'var(--accent-primary)'
            }}>
              {pendingRequests.length}
            </span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'accepted' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('accepted')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>Supervised Projects</span>
            <span className="tag-badge" style={{
              backgroundColor: activeTab === 'accepted' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(52, 211, 153, 0.1)',
              color: activeTab === 'accepted' ? '#fff' : 'var(--accent-green)'
            }}>
              {acceptedRequests.length}
            </span>
          </button>

          <button
            type="button"
            className={`btn ${activeTab === 'declined' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('declined')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <span>Declined History</span>
            <span className="tag-badge" style={{
              backgroundColor: activeTab === 'declined' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(148, 163, 184, 0.1)',
              color: activeTab === 'declined' ? '#fff' : 'var(--text-muted)'
            }}>
              {declinedRequests.length}
            </span>
          </button>
        </div>

        {/* Loading Spinner */}
        {loading ? (
          <div className="discovery-loading" style={{ minHeight: '35vh' }}>
            <div className="dot dot-yellow" style={{ width: '1.25rem', height: '1.25rem' }}></div>
            <p>Loading supervision proposals...</p>
          </div>
        ) : (
          <div>
            {/* TAB 1: PENDING REQUESTS */}
            {activeTab === 'pending' && (
              <div>
                {pendingRequests.length === 0 ? (
                  <div className="empty-state-card" style={{ marginTop: '1rem' }}>
                    <div className="empty-icon">📭</div>
                    <h3 className="empty-title">No Pending Requests</h3>
                    <p className="empty-desc">
                      You have no incoming supervision proposals awaiting review. When project leaders request your guidance, they will appear here.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {pendingRequests.map(req => {
                      const proj = req.project || {};
                      const leader = proj.leader || {};
                      const isAccepting = acceptingId === req._id;

                      return (
                        <div
                          key={req._id}
                          className="dashboard-card"
                          style={{
                            borderLeft: '4px solid #fbbf24',
                            backgroundColor: 'rgba(30, 41, 59, 0.5)'
                          }}
                        >
                          {/* Header row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <span className="domain-pill" style={{ fontSize: '0.75rem' }}>
                                  {proj.domain} Engineering
                                </span>
                                <span className="status-pill status-in-progress" style={{ fontSize: '0.725rem' }}>
                                  Pending Proposal
                                </span>
                              </div>
                              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                                {proj.title}
                              </h3>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Submitted {formatDate(req.createdAt)}
                            </span>
                          </div>

                          {/* Leader info */}
                          <div style={{
                            backgroundColor: 'rgba(15, 23, 42, 0.4)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '0.375rem',
                            padding: '0.75rem 1rem',
                            marginBottom: '1rem',
                            fontSize: '0.85rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '0.5rem'
                          }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Project Leader: </span>
                              <strong style={{ color: 'var(--text-primary)' }}>{leader.name || 'Student Leader'}</strong>
                              <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                                ({leader.department?.includes('Engineering') ? leader.department : `${leader.department} Engineering`})
                              </span>
                            </div>
                            {leader.email && (
                              <span style={{ color: 'var(--text-secondary)' }}>
                                📧 {leader.email}
                              </span>
                            )}
                          </div>

                          {/* Proposal Message */}
                          <div style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                              Proposal &amp; Statement of Motivation:
                            </div>
                            <div style={{
                              backgroundColor: 'rgba(15, 23, 42, 0.6)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '0.375rem',
                              padding: '1rem',
                              color: 'var(--text-primary)',
                              fontSize: '0.9rem',
                              lineHeight: 1.5,
                              whiteSpace: 'pre-wrap'
                            }}>
                              {req.proposalMessage}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                            <Link
                              to={`/projects/${proj._id}`}
                              className="btn btn-secondary btn-sm"
                              style={{ marginRight: 'auto' }}
                            >
                              Inspect Project Overview ↗
                            </Link>

                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setRequestToDecline(req)}
                              disabled={isAccepting}
                              style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                            >
                              Decline...
                            </button>

                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleAcceptRequest(req._id)}
                              disabled={isAccepting || !isAvailable}
                              title={!isAvailable ? 'Capacity full (5/5)' : 'Accept this supervision proposal'}
                            >
                              {isAccepting ? 'Accepting...' : 'Accept Proposal'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SUPERVISED PROJECTS */}
            {activeTab === 'accepted' && (
              <div>
                {acceptedRequests.length === 0 ? (
                  <div className="empty-state-card" style={{ marginTop: '1rem' }}>
                    <div className="empty-icon">📁</div>
                    <h3 className="empty-title">No Supervised Projects Yet</h3>
                    <p className="empty-desc">
                      You are not currently supervising any active projects. Accepted supervision requests will appear here with links to access the private project workspace.
                    </p>
                  </div>
                ) : (
                  <div className="projects-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
                    {acceptedRequests.map(req => {
                      const proj = req.project || {};
                      const leader = proj.leader || {};

                      return (
                        <div key={req._id} className="project-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div className="card-top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                              <span className="domain-pill" style={{ fontSize: '0.8rem' }}>
                                {proj.domain} Engineering
                              </span>
                              <span className="status-pill badge-completed" style={{ fontSize: '0.75rem' }}>
                                Status: {proj.status?.replace('_', ' ') || 'Active'}
                              </span>
                            </div>

                            <h3 className="card-title" style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                              {proj.title}
                            </h3>

                            {proj.abstract && (
                              <p className="card-abstract" style={{ WebkitLineClamp: 3, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: '1rem' }}>
                                {proj.abstract}
                              </p>
                            )}

                            <div style={{
                              backgroundColor: 'rgba(15, 23, 42, 0.4)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '0.375rem',
                              padding: '0.65rem 0.85rem',
                              fontSize: '0.825rem',
                              marginBottom: '0.75rem'
                            }}>
                              <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Student Leader:</div>
                              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{leader.name}</div>
                              {leader.email && (
                                <div style={{ color: 'var(--text-secondary)' }}>📧 {leader.email}</div>
                              )}
                            </div>

                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Assigned on {formatDate(req.reviewedAt || req.updatedAt)}
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <Link
                              to={`/projects/${proj._id}`}
                              className="btn btn-primary btn-sm"
                            >
                              Open Workspace &amp; Tasks ↗
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DECLINED REQUESTS HISTORY */}
            {activeTab === 'declined' && (
              <div>
                {declinedRequests.length === 0 ? (
                  <div className="empty-state-card" style={{ marginTop: '1rem' }}>
                    <div className="empty-icon">✓</div>
                    <h3 className="empty-title">No Declined Requests</h3>
                    <p className="empty-desc">
                      You have not declined any supervision requests.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {declinedRequests.map(req => {
                      const proj = req.project || {};
                      const leader = proj.leader || {};

                      return (
                        <div
                          key={req._id}
                          className="dashboard-card"
                          style={{
                            borderLeft: '4px solid #f87171',
                            backgroundColor: 'rgba(30, 41, 59, 0.4)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <span className="domain-pill" style={{ fontSize: '0.75rem' }}>
                                  {proj.domain} Engineering
                                </span>
                                <span className="status-pill recruitment-closed" style={{ fontSize: '0.725rem' }}>
                                  Declined
                                </span>
                              </div>
                              <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                                {proj.title}
                              </h4>
                            </div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              Reviewed {formatDate(req.reviewedAt || req.updatedAt)}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            Leader: <strong style={{ color: 'var(--text-primary)' }}>{leader.name}</strong> ({leader.department?.includes('Engineering') ? leader.department : `${leader.department} Engineering`}) • 📧 {leader.email}
                          </div>

                          <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                            Proposal: &ldquo;{req.proposalMessage}&rdquo;
                          </div>

                          {req.feedback && (
                            <div style={{
                              padding: '0.5rem 0.75rem',
                              backgroundColor: 'rgba(239, 68, 68, 0.08)',
                              borderLeft: '3px solid #f87171',
                              borderRadius: '0.25rem',
                              color: '#f87171',
                              fontSize: '0.825rem'
                            }}>
                              <strong>Your Feedback:</strong> {req.feedback}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal: Decline Request with Feedback */}
        {requestToDecline && (
          <DeclineRequestModal
            request={requestToDecline}
            isOpen={Boolean(requestToDecline)}
            onClose={() => setRequestToDecline(null)}
            onDeclined={handleDeclineCompleted}
          />
        )}
      </div>
    </div>
  );
}

