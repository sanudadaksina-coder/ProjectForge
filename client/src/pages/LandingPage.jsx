import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section id="overview" className="hero-section">
        <div className="container">
          <div className="hero-pill">
            Academic Engineering Collaboration Platform
          </div>
          <h1 className="hero-title" style={{ marginBottom: '2.5rem' }}>
            Centralized Workspaces for Undergraduate Projects
          </h1>

          <div className="hero-actions">
            <Link to="/projects" className="btn btn-secondary">
              🔍 Explore Projects
            </Link>
            {user ? (
              <Link to="/dashboard" className="btn btn-primary">
                Go to Student Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary">
                  Register as Student
                </Link>
                <Link to="/login" className="btn btn-secondary">
                  Sign In to Account
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section id="features" className="section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Core Collaboration Pillars</h2>
            <p className="section-subtitle">
              Designed to solve scattered coordination, subjective progress reporting, and unstructured faculty feedback.
            </p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">👥</div>
              <h3 className="feature-title">Team Formation &amp; Rosters</h3>
              <p className="feature-desc">
                Students propose projects, review peer join requests, and manage membership rosters with automated capacity controls.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3 className="feature-title">Project Pulse Metric</h3>
              <p className="feature-desc">
                An objective 0% to 100% progress score calculated automatically from real task completion rates and overdue deadline penalties.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🎓</div>
              <h3 className="feature-title">Faculty Supervision</h3>
              <p className="feature-desc">
                Supervisors publish research domains, receive formal mentorship proposals, and evaluate milestone deliverable submissions.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔗</div>
              <h3 className="feature-title">Resource Registry</h3>
              <p className="feature-desc">
                Securely index external web links to Google Docs, GitHub repositories, Overleaf research papers, and Figma designs.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
