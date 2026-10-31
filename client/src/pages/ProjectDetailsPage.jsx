import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ApplyToJoinModal from '../components/ApplyToJoinModal';
import RemoveMemberModal from '../components/RemoveMemberModal';
import JoinRequestsSection from '../components/JoinRequestsSection';
import ProjectTasksSection from '../components/ProjectTasksSection';
import SupervisionSection from '../components/SupervisionSection';

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Delete project modal state (Leader)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Apply to join modal state (Student applicant)
  const [showApplyModal, setShowApplyModal] = useState(false);

  // Student's own pending request state
  const [myPendingRequest, setMyPendingRequest] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  // Remove member modal state (Leader)
  const [memberToRemove, setMemberToRemove] = useState(null);

  // Status banner / alert message
  const [statusNotice, setStatusNotice] = useState(null);

  const fetchProjectDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to fetch project (HTTP ${res.status})`);
      }

      setProject(json.data?.project || null);
    } catch (err) {
      setError(err.message || 'Could not load project details.');
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch current student's pending join request for this project if applicable
  const fetchMyPendingRequest = useCallback(async () => {
    if (!user || user.accountType !== 'student' || !id) {
      setMyPendingRequest(null);
      return;
    }
    try {
      const res = await fetch(`/api/membership-requests/mine?projectId=${id}&status=pending`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data?.requests) && json.data.requests.length > 0) {
          setMyPendingRequest(json.data.requests[0]);
        } else {
          setMyPendingRequest(null);
        }
      }
    } catch (err) {
      console.warn('Could not fetch student pending request:', err.message);
    }
  }, [user, id]);

  useEffect(() => {
    fetchProjectDetails();
  }, [fetchProjectDetails]);

  useEffect(() => {
    fetchMyPendingRequest();
  }, [fetchMyPendingRequest]);

  // Authorization checks
  const isLeader = Boolean(
    user &&
    project &&
    (
      (typeof project.leader === 'object' && project.leader?._id === user._id) ||
      (typeof project.leader === 'string' && project.leader === user._id)
    )
  );

  const isMember = Boolean(
    user &&
    project &&
    Array.isArray(project.members) &&
    project.members.some(m => {
      const memberId = typeof m === 'object' ? m._id : m;
      return memberId === user._id;
    })
  );

  const isSupervisor = Boolean(
    user &&
    project &&
    user.accountType === 'supervisor' &&
    (
      (typeof project.supervisor === 'object' && project.supervisor?._id === user._id) ||
      (typeof project.supervisor === 'string' && project.supervisor === user._id)
    )
  );

  const hasTaskAccess = isLeader || isMember || isSupervisor;

  const isStudent = Boolean(user && user.accountType === 'student');
  const isFull = Boolean(project && (project.members?.length || 1) >= project.maxTeamSize);
  const isRecruitmentOpen = Boolean(project && project.recruitmentStatus === 'open');

  const canApply = Boolean(
    isStudent &&
    !isLeader &&
    !isMember &&
    !myPendingRequest &&
    isRecruitmentOpen &&
    !isFull
  );

  const handleDelete = async () => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to delete project.');
      }

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setDeleteError(err.message || 'Error deleting project.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!myPendingRequest) return;
    setCancelLoading(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/membership-requests/${myPendingRequest._id}/cancel`, {
        method: 'PATCH',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to cancel join request.');
      }

      setMyPendingRequest(null);
      setShowCancelConfirm(false);
      setStatusNotice({ type: 'info', message: 'Your join request was withdrawn.' });
    } catch (err) {
      setCancelError(err.message || 'Error withdrawing join request.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleApplySuccess = (newRequest) => {
    setMyPendingRequest(newRequest);
    setStatusNotice({ type: 'success', message: 'Join request submitted successfully! The Project Leader has been notified.' });
  };

  const handleMemberRemoved = async () => {
    await fetchProjectDetails();
    setStatusNotice({ type: 'success', message: 'Team member was removed from the roster.' });
  };

  const handlePulseUpdated = useCallback((pulseData) => {
    if (pulseData?.pulseScore !== undefined) {
      setProject(prev => {
        if (!prev || prev.pulseScore === pulseData.pulseScore) return prev;
        return { ...prev, pulseScore: pulseData.pulseScore };
      });
    }
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not specified';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'in_progress':
        return 'badge-in-progress';
      case 'completed':
        return 'badge-completed';
      default:
        return 'badge-proposed';
    }
  };

  if (loading) {
    return (
      <div className="discovery-loading" style={{ minHeight: '60vh' }}>
        <div className="dot dot-yellow" style={{ width: '1.25rem', height: '1.25rem' }}></div>
        <p>Loading project workspace...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div className="empty-state-card">
          <div className="empty-icon">⚠️</div>
          <h2 className="empty-title">Project Not Found</h2>
          <p className="empty-desc">{error || 'The requested project could not be located in the database.'}</p>
          <Link to="/projects" className="btn btn-secondary">
            ← Return to Project Registry
          </Link>
        </div>
      </div>
    );
  }

  const isPrivateView = Boolean(project.leader?.email);
  const currentMembersCount = project.members?.length || 1;
  const vacantSpots = Math.max(0, project.maxTeamSize - currentMembersCount);

  return (
    <div className="project-details-page">
      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        {/* Navigation & Actions Top Bar */}
        <div className="details-top-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <Link to="/projects" className="back-link">
            ← Back to All Projects
          </Link>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {/* Student "Apply to Join" action button */}
            {canApply && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowApplyModal(true)}
              >
                🤝 Apply to Join Team
              </button>
            )}

            {/* Leader actions */}
            {isLeader && (
              <div className="leader-actions-group" style={{ display: 'flex', gap: '0.5rem' }}>
                <Link to={`/projects/${id}/edit`} className="btn btn-secondary btn-sm">
                  ✏️ Edit Project Metadata
                </Link>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setShowDeleteModal(true)}
                >
                  🗑️ Delete Project
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Global Feedback Banner */}
        {statusNotice && (
          <div
            className={`alert ${statusNotice.type === 'success' ? 'alert-success' : 'alert-info'}`}
            style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <span>{statusNotice.message}</span>
            <button
              type="button"
              onClick={() => setStatusNotice(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Student Pending Application Banner */}
        {myPendingRequest && (
          <div
            className="pending-application-banner"
            style={{
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              borderRadius: '0.75rem',
              padding: '1.25rem 1.5rem',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '1.25rem' }}>⏳</span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                  Your Join Application is Pending Leader Review
                </strong>
                <span
                  className="tag-badge"
                  style={{
                    backgroundColor: 'rgba(234, 179, 8, 0.15)',
                    color: '#facc15',
                    borderColor: 'rgba(234, 179, 8, 0.3)'
                  }}
                >
                  Status: Pending
                </span>
              </div>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Applied on {formatDate(myPendingRequest.createdAt)} &mdash; Statement: &ldquo;{myPendingRequest.statement}&rdquo;
              </p>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowCancelConfirm(true)}
              style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
            >
              Withdraw Application
            </button>
          </div>
        )}

        {/* View Indicator Badge */}
        <div style={{ marginBottom: '1rem' }}>
          {isPrivateView ? (
            <span className="view-mode-pill private-view-pill">
              🔒 Private Workspace View (Authorized Collaborator)
            </span>
          ) : (
            <span className="view-mode-pill public-view-pill">
              🌐 Public Project Overview
            </span>
          )}
        </div>

        {/* Hero Details Card */}
        <div className="details-hero-card">
          <div className="details-header-row">
            <span className="domain-pill" style={{ fontSize: '0.9rem' }}>{project.domain} Engineering</span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className={`status-pill ${getStatusBadgeClass(project.status)}`}>
                Status: {project.status.replace('_', ' ')}
              </span>

              {/* Dynamic Recruitment Badge */}
              {isFull ? (
                <span className="status-pill recruitment-closed" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  Recruitment: Closed (Team Full)
                </span>
              ) : project.recruitmentStatus === 'open' ? (
                <span className="status-pill recruitment-open">
                  Recruitment: Open ({vacantSpots} slot{vacantSpots === 1 ? '' : 's'} available)
                </span>
              ) : (
                <span className="status-pill recruitment-closed">
                  Recruitment: Closed
                </span>
              )}

              <span className="status-pill status-info">
                Project Pulse: ⚡ {project.pulseScore ?? 0}%
              </span>
            </div>
          </div>

          <h1 className="details-title">{project.title}</h1>

          <div className="details-section">
            <h3 className="details-subtitle">Abstract & Technical Scope</h3>
            <p className="details-abstract-text">{project.abstract}</p>
          </div>

          {/* Technical Tags */}
          {Array.isArray(project.tags) && project.tags.length > 0 && (
            <div className="details-section">
              <h3 className="details-subtitle">Keywords & Tech Stack</h3>
              <div className="skills-chips">
                {project.tags.map((tag, i) => (
                  <span key={i} className="skill-chip">#{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Key Specifications Grid */}
          <div className="details-specs-grid">
            <div className="spec-box">
              <span className="spec-label">Target Completion Date</span>
              <span className="spec-value">{formatDate(project.targetCompletionDate)}</span>
            </div>
            <div className="spec-box">
              <span className="spec-label">Team Capacity</span>
              <span className="spec-value">
                {currentMembersCount} / {project.maxTeamSize} Members
              </span>
            </div>
            <div className="spec-box">
              <span className="spec-label">Project Inception</span>
              <span className="spec-value">{formatDate(project.createdAt)}</span>
            </div>
            <div className="spec-box">
              <span className="spec-label">Source Code Repository</span>
              <span className="spec-value">
                {project.repositoryUrl ? (
                  <a
                    href={project.repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="repo-link"
                  >
                    🔗 View Repository ↗
                  </a>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>Not linked</span>
                )}
              </span>
            </div>
          </div>

          {/* Call-to-action for eligible applicant students */}
          {canApply && (
            <div
              className="join-cta-banner"
              style={{
                marginTop: '1.25rem',
                padding: '1rem 1.25rem',
                backgroundColor: 'rgba(56, 189, 248, 0.06)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}
            >
              <div>
                <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
                  Recruiting Team Members!
                </strong>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  This engineering project has {vacantSpots} open spot{vacantSpots === 1 ? '' : 's'}. Submit your statement of interest to join.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setShowApplyModal(true)}
              >
                Apply to Join Team
              </button>
            </div>
          )}

          {/* Informational notice for unauthenticated visitors */}
          {!user && project.recruitmentStatus === 'open' && !isFull && (
            <div
              style={{
                marginTop: '1.25rem',
                padding: '0.85rem 1.25rem',
                backgroundColor: 'rgba(51, 65, 85, 0.25)',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                fontSize: '0.9rem',
                color: 'var(--text-secondary)'
              }}
            >
              💡 <Link to="/login" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Log in with a student account</Link> to apply to join this project team.
            </div>
          )}
        </div>

        {/* Team & Supervision Grid */}
        <div className="dashboard-grid" style={{ marginTop: '2rem' }}>
          {/* Team Roster Card */}
          <div className="dashboard-card">
            <div className="card-header">
              <h2 className="card-title">Team Roster</h2>
              <span className="tag-badge">
                {currentMembersCount} of {project.maxTeamSize} Filled
              </span>
            </div>

            <div className="roster-list">
              {/* Leader Item */}
              <div className="roster-item leader-roster-item">
                <div className="roster-avatar leader-avatar">👑</div>
                <div className="roster-details">
                  <div className="roster-name-row">
                    <span className="roster-name">{project.leader?.name}</span>
                    <span className="roster-role-badge">Project Leader</span>
                  </div>
                  <div className="roster-sub-row">
                    <span>{project.leader?.department?.includes('Engineering') ? project.leader?.department : `${project.leader?.department} Engineering`}</span>
                    {project.leader?.studentId && (
                      <span> • Roll: {project.leader.studentId}</span>
                    )}
                  </div>
                  {project.leader?.email && (
                    <div className="roster-contact">📧 {project.leader.email}</div>
                  )}
                </div>
              </div>

              {/* Approved Members */}
              {Array.isArray(project.members) &&
                project.members
                  .filter(m => {
                    const memberId = typeof m === 'object' ? m._id : m;
                    const leaderId = typeof project.leader === 'object' ? project.leader?._id : project.leader;
                    return memberId !== leaderId;
                  })
                  .map((member) => (
                    <div key={member._id || member} className="roster-item">
                      <div className="roster-avatar">👤</div>
                      <div className="roster-details">
                        <div className="roster-name-row">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className="roster-name">{member.name || 'Team Member'}</span>
                            <span className="tag-badge">Member</span>
                          </div>

                          {/* Leader Removal Action */}
                          {isLeader && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setMemberToRemove(member)}
                              style={{
                                padding: '0.15rem 0.5rem',
                                fontSize: '0.75rem',
                                color: 'var(--danger)',
                                borderColor: 'rgba(239, 68, 68, 0.4)'
                              }}
                              title="Remove member from project roster"
                            >
                              🗑️ Remove
                            </button>
                          )}
                        </div>

                        <div className="roster-sub-row">
                          <span>{member.department?.includes('Engineering') ? member.department : `${member.department} Engineering`}</span>
                          {member.studentId && <span> • Roll: {member.studentId}</span>}
                        </div>
                        {member.email && (
                          <div className="roster-contact">📧 {member.email}</div>
                        )}
                        {Array.isArray(member.skills) && member.skills.length > 0 && (
                          <div className="skills-chips" style={{ marginTop: '0.25rem' }}>
                            {member.skills.map((s, idx) => (
                              <span key={idx} className="skill-chip" style={{ fontSize: '0.75rem' }}>
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

              {/* Vacant Team Slots */}
              {vacantSpots > 0 && Array.from({ length: vacantSpots }).map((_, idx) => (
                <div
                  key={`vacant-${idx}`}
                  className="roster-item"
                  style={{
                    borderStyle: 'dashed',
                    backgroundColor: 'rgba(15, 23, 42, 0.3)',
                    opacity: 0.8
                  }}
                >
                  <div
                    className="roster-avatar"
                    style={{ backgroundColor: 'rgba(51, 65, 85, 0.25)', color: 'var(--text-muted)' }}
                  >
                    ➕
                  </div>
                  <div className="roster-details">
                    <div className="roster-name-row">
                      <span className="roster-name" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        Open Team Spot
                      </span>
                      <span
                        className="tag-badge"
                        style={{
                          backgroundColor: 'rgba(56, 189, 248, 0.05)',
                          color: 'var(--text-muted)',
                          borderColor: 'var(--border-color)'
                        }}
                      >
                        {project.recruitmentStatus === 'open' ? 'Recruiting' : 'Closed'}
                      </span>
                    </div>
                    <div className="roster-sub-row">
                      <span>
                        {project.recruitmentStatus === 'open'
                          ? 'Available for eligible student applicant'
                          : 'Recruitment currently closed'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Faculty Supervision Card (Stage 3A) */}
          <SupervisionSection
            project={project}
            isLeader={isLeader}
            onSupervisionUpdated={fetchProjectDetails}
          />
        </div>

        {/* Project Tasks & Checklist Section (Stage 2C) */}
        {hasTaskAccess ? (
          <ProjectTasksSection
            projectId={id}
            isLeader={isLeader}
            members={project.members}
            onPulseUpdated={handlePulseUpdated}
          />
        ) : (
          <div className="tasks-privacy-card" style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>🔒</span>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>Team Checklist &amp; Project Pulse</h3>
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Action checklist, milestone progress tracking, and Project Pulse calculations are private to approved project team members and assigned supervisor.
            </p>
          </div>
        )}

        {/* Project Leader: Incoming Join Requests Section */}
        {isLeader && (
          <JoinRequestsSection
            projectId={id}
            isLeader={isLeader}
            onMemberAdded={fetchProjectDetails}
            projectFull={isFull}
          />
        )}

        {/* Modal: Apply to Join Team */}
        <ApplyToJoinModal
          isOpen={showApplyModal}
          onClose={() => setShowApplyModal(false)}
          projectId={id}
          projectTitle={project.title}
          onSuccess={handleApplySuccess}
        />

        {/* Modal: Remove Member Confirmation */}
        <RemoveMemberModal
          isOpen={Boolean(memberToRemove)}
          onClose={() => setMemberToRemove(null)}
          projectId={id}
          member={memberToRemove}
          onSuccess={handleMemberRemoved}
        />

        {/* Modal: Withdraw Join Application Confirmation */}
        {showCancelConfirm && (
          <div
            className="modal-overlay"
            onClick={() => !cancelLoading && setShowCancelConfirm(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
              <div className="modal-header">
                <span className="modal-icon">⚠️</span>
                <h3 className="modal-title">Withdraw Application</h3>
              </div>
              <p className="modal-text">
                Are you sure you want to withdraw your pending application to join <strong>{project.title}</strong>?
              </p>
              {cancelError && <div className="alert alert-danger">{cancelError}</div>}
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={cancelLoading}
                >
                  Keep Application
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleCancelRequest}
                  disabled={cancelLoading}
                >
                  {cancelLoading ? 'Withdrawing...' : 'Yes, Withdraw'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Delete Project Confirmation */}
        {showDeleteModal && (
          <div className="modal-overlay" onClick={() => !deleteLoading && setShowDeleteModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-icon">⚠️</span>
                <h3 className="modal-title">Delete Project Workspace</h3>
              </div>

              <p className="modal-text">
                Are you sure you want to permanently delete <strong>&ldquo;{project.title}&rdquo;</strong>?
              </p>
              <p className="modal-subtext">
                This action is permanent and will delete the project document from the database.
              </p>

              {deleteError && (
                <div className="alert alert-danger" style={{ margin: '1rem 0' }}>
                  {deleteError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={deleteLoading}
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={deleteLoading}
                  onClick={handleDelete}
                >
                  {deleteLoading ? 'Deleting...' : 'Yes, Permanently Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
