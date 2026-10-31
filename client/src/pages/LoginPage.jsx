import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // If already logged in, redirect to dashboard or intended destination
  useEffect(() => {
    if (user) {
      const defaultDest = user.accountType === 'supervisor' ? '/supervisor/dashboard' : '/dashboard';
      const destination = location.state?.from?.pathname || defaultDest;
      navigate(destination, { replace: true });
    }
  }, [user, navigate, location]);

  const validate = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const loggedInUser = await login(email.trim(), password);
      const defaultDest = loggedInUser?.accountType === 'supervisor' ? '/supervisor/dashboard' : '/dashboard';
      const destination = location.state?.from?.pathname || defaultDest;
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="brand-icon auth-logo">PF</div>
          <h2 className="auth-title">Sign In to ProjectForge</h2>
          <p className="auth-subtitle">
            Enter your university credentials to access your academic workspace.
          </p>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              University Email Address <span className="req">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              className={`form-input ${validationErrors.email ? 'input-error' : ''}`}
              placeholder="alex.j@ruh.ac.lk"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (validationErrors.email) setValidationErrors(prev => ({ ...prev, email: null }));
              }}
              autoComplete="email"
              required
            />
            {validationErrors.email && (
              <span className="form-error">{validationErrors.email}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password <span className="req">*</span>
            </label>
            <input
              id="login-password"
              type="password"
              className={`form-input ${validationErrors.password ? 'input-error' : ''}`}
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (validationErrors.password) setValidationErrors(prev => ({ ...prev, password: null }));
              }}
              autoComplete="current-password"
              required
            />
            {validationErrors.password && (
              <span className="form-error">{validationErrors.password}</span>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            New undergraduate student?{' '}
            <Link to="/register" className="auth-link">
              Create student account
            </Link>
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <Link to="/" className="auth-back-link">
              ← Return to Landing Page
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
