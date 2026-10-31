import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="navbar">
      <div className="container nav-content">
        <Link to="/" className="brand">
          <div className="brand-icon">PF</div>
          <span>ProjectForge</span>
        </Link>

        <nav className="nav-links">
          <Link to="/">Overview</Link>
          <Link to="/projects">Explore Projects</Link>

          {user ? (
            <>
              <Link to="/supervisors">Faculty Supervisors</Link>

              {user.accountType === 'supervisor' ? (
                <Link to="/supervisor/dashboard" className="nav-highlight">
                  Supervision Hub
                </Link>
              ) : (
                <Link to="/dashboard" className="nav-highlight">
                  My Projects
                </Link>
              )}

              {user.accountType === 'student' && (
                <Link to="/projects/new" className="btn btn-primary btn-sm" style={{ padding: '0.35rem 0.75rem' }}>
                  + Propose
                </Link>
              )}

              <div className="user-badge">
                <span className="user-name">{user.name}</span>
                <span className="user-dept">
                  {user.accountType === 'supervisor' ? (user.designation || 'Supervisor') : user.department}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
              >
                Sign Out
              </button>
            </>
          ) : (
            <div className="auth-nav-buttons">
              <Link to="/login" className="btn btn-secondary btn-sm">
                Sign In
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Register
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
