import { useState, useEffect, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  // Projects led by current student
  const [myProjects, setMyProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState(null);

  const fetchMyProjects = useCallback(async () => {
    if (!user) return;
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const res = await fetch('/api/projects?limit=50', {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error(`Failed to load projects (HTTP ${res.status})`);
      }

      const json = await res.json();
      if (json.success && Array.isArray(json.data?.projects)) {
        // Filter strictly for projects where the authenticated student is the leader
        const userProjects = json.data.projects.filter(p => {
          if (!p.leader) return false;
          const leaderId = typeof p.leader === 'object' ? p.leader._id : p.leader;
          return leaderId === user._id;
        });
        setMyProjects(userProjects);
      }
    } catch (err) {
      setProjectsError(err.message || 'Could not fetch your projects.');
    } finally {
      setProjectsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyProjects();
  }, [fetchMyProjects]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not specified';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // If user is a supervisor, redirect to supervisor dashboard
  if (user && user.accountType === 'supervisor') {
    return <Navigate to="/supervisor/dashboard" replace />;
  }

  return (
    <div className="dashboard-page">
      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        {/* Welcome Header */}
        <div className="dashboard-header">
          <div>
            <div className="dashboard-eyebrow">Student Academic Workspace</div>
            <h1 className="dashboard-title">
              Welcome back, {user?.name}
            </h1>
            <p className="dashboard-subtitle">
              Manage your engineering project workspaces, monitor team rosters, and track milestone deadlines.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Link to="/projects/new" className="btn btn-primary">
              + Propose New Project
            </Link>
            <div className="dashboard-status-pill">
              <span className="dot dot-green"></span>
              <span>Session Active (HttpOnly Cookie)</span>
            </div>
          </div>
        </div>

        {/* Student Profile Card */}
        <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
          <div className="dashboard-card profile-card">
            <div className="card-header">
              <h2 className="card-title">Student Profile</h2>
              <span className="tag-badge">Undergraduate</span>
            </div>

            <div className="profile-details" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              <div className="profile-item">
                <span className="profile-label">Full Name</span>
                <span className="profile-value">{user?.name}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Email Address</span>
                <span className="profile-value">{user?.email}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Department</span>
                <span className="profile-value">{user?.department?.includes('Engineering') ? user.department : `${user?.department} Engineering`}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Student ID</span>
                <span className="profile-value">{user?.studentId || 'Not specified'}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Semester</span>
                <span className="profile-value">
                  {user?.semester ? `Semester ${user?.semester}` : 'Not specified'}
                </span>
              </div>
              <div className="profile-item" style={{ gridColumn: '1 / -1' }}>
                <span className="profile-label">Registered Skills</span>
                <div className="skills-chips">
                  {user?.skills && user.skills.length > 0 ? (
                    user.skills.map((skill, idx) => (
                      <span key={idx} className="skill-chip">{skill}</span>
                    ))
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      No skills listed
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Projects Section - Real Student Projects */}
        <div className="projects-section" style={{ marginTop: '2.5rem' }}>
          <div className="section-title-row">
            <div>
              <h2 className="card-title" style={{ fontSize: '1.4rem' }}>My Project Workspaces</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Engineering projects where you are registered as the designated Project Leader.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Link to="/projects" className="btn btn-secondary btn-sm">
                Explore All Projects →
              </Link>
              <Link to="/projects/new" className="btn btn-primary btn-sm">
                + Propose Project
              </Link>
            </div>
          </div>

          {projectsError && (
            <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
              <span>{projectsError}</span>
            </div>
          )}

          {projectsLoading ? (
            <div className="discovery-loading" style={{ padding: '2rem' }}>
              <div className="dot dot-yellow"></div>
              <p>Loading your project workspaces...</p>
            </div>
          ) : myProjects.length > 0 ? (
            <div className="projects-grid">
              {myProjects.map((project) => (
                <div key={project._id} className="project-card">
                  <div className="project-card-header">
                    <span className="domain-pill">{project.domain}</span>
                    <span className="status-pill status-info">Leader</span>
                  </div>

                  <h3 className="project-title">
                    <Link to={`/projects/${project._id}`} className="project-title-link">
                      {project.title}
                    </Link>
                  </h3>

                  <p className="project-abstract-excerpt">
                    {project.abstract && project.abstract.length > 120
                      ? `${project.abstract.substring(0, 120)}...`
                      : project.abstract}
                  </p>

                  <div className="project-card-meta">
                    <div className="meta-row">
                      <span className="meta-label">Status:</span>
                      <span className="meta-value" style={{ textTransform: 'capitalize' }}>
                        {project.status.replace('_', ' ')} ({project.recruitmentStatus})
                      </span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Team Capacity:</span>
                      <span className="meta-value">
                        {project.membersCount || 1} / {project.maxTeamSize} Members
                      </span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Target Deadline:</span>
                      <span className="meta-value">{formatDate(project.targetCompletionDate)}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Project Pulse:</span>
                      <span className="meta-value" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                        ⚡ {project.pulseScore ?? 0}%
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <Link to={`/projects/${project._id}`} className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'center' }}>
                      Workspace Details
                    </Link>
                    <Link to={`/projects/${project._id}/edit`} className="btn btn-secondary btn-sm" style={{ padding: '0.45rem 0.75rem' }} title="Edit metadata">
                      ✏️ Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-card">
              <div className="empty-icon">📁</div>
              <h3 className="empty-title">You Haven&rsquo;t Proposed Any Projects Yet</h3>
              <p className="empty-desc">
                As an engineering student, you can propose a new academic workspace, set target milestones, recruit team members, and request faculty supervision.
              </p>
              <Link to="/projects/new" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                + Propose Your First Project
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
