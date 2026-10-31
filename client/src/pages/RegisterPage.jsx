import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DEPARTMENTS = [
  'Department of Civil and Environmental Engineering',
  'Department of Electrical and Information Engineering',
  'Department of Computer Engineering',
  'Department of Mechanical and Manufacturing Engineering',
  'Department of Marine Engineering and Naval Architecture',
  'Department of Interdisciplinary Studies'
];

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: 'Department of Computer Engineering',
    studentId: '',
    semester: '6',
    skills: '',
    password: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const errors = {};

    // Name
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      errors.name = 'Full name is required.';
    } else if (trimmedName.length < 2 || trimmedName.length > 80) {
      errors.name = 'Name must be between 2 and 80 characters.';
    }

    // Email
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail) {
      errors.email = 'University email address is required.';
    } else if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      errors.email = 'Please provide a valid email format (e.g., student@university.edu).';
    }

    // Department
    if (!formData.department.trim()) {
      errors.department = 'Please select your academic department.';
    }

    // Semester
    if (formData.semester) {
      const sem = Number(formData.semester);
      if (!Number.isInteger(sem) || sem < 1 || sem > 8) {
        errors.semester = 'Semester must be an integer between 1 and 8.';
      }
    }

    // Password
    if (!formData.password) {
      errors.password = 'Password is required.';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long.';
    }

    // Confirm password
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
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
      // Parse skills comma-separated string into array of strings
      const parsedSkills = formData.skills
        ? formData.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        accountType: 'student', // Fixed student account type
        department: formData.department.trim(),
        studentId: formData.studentId.trim() || null,
        semester: formData.semester ? Number(formData.semester) : null,
        skills: parsedSkills
      });

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <div className="brand-icon auth-logo">PF</div>
          <h2 className="auth-title">Student Account Registration</h2>
          <p className="auth-subtitle">
            Create an undergraduate student profile to join workspaces and collaborate on academic engineering projects.
          </p>
          <div className="info-banner" style={{ marginTop: '0.75rem' }}>
            ℹ️ <strong>Notice:</strong> Public registration is strictly for students. Faculty supervisor accounts are provisioned via academic administration or database seeding.
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">
                Full Name <span className="req">*</span>
              </label>
              <input
                id="reg-name"
                name="name"
                type="text"
                className={`form-input ${validationErrors.name ? 'input-error' : ''}`}
                placeholder="e.g. Alex Johnson"
                value={formData.name}
                onChange={handleChange}
                required
              />
              {validationErrors.name && (
                <span className="form-error">{validationErrors.name}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">
                University Email <span className="req">*</span>
              </label>
              <input
                id="reg-email"
                name="email"
                type="email"
                className={`form-input ${validationErrors.email ? 'input-error' : ''}`}
                placeholder="alex.j@ruh.ac.lk"
                value={formData.email}
                onChange={handleChange}
                required
              />
              {validationErrors.email && (
                <span className="form-error">{validationErrors.email}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-dept">
                Academic Department <span className="req">*</span>
              </label>
              <select
                id="reg-dept"
                name="department"
                className={`form-select ${validationErrors.department ? 'input-error' : ''}`}
                value={formData.department}
                onChange={handleChange}
                required
              >
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept.includes('Engineering') ? dept : `${dept} Engineering`}</option>
                ))}
              </select>
              {validationErrors.department && (
                <span className="form-error">{validationErrors.department}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-studentid">
                Student Reg. NO. (Optional)
              </label>
              <input
                id="reg-studentid"
                name="studentId"
                type="text"
                className="form-input"
                placeholder="EG/20XX/XXXX"
                value={formData.studentId}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-semester">
                Current Semester (Optional)
              </label>
              <select
                id="reg-semester"
                name="semester"
                className="form-select"
                value={formData.semester}
                onChange={handleChange}
              >
                <option value="">Not Specified</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                  <option key={s} value={s}>Semester {s}</option>
                ))}
              </select>
              {validationErrors.semester && (
                <span className="form-error">{validationErrors.semester}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-skills">
                Technical Skills (Optional, comma-separated)
              </label>
              <input
                id="reg-skills"
                name="skills"
                type="text"
                className="form-input"
                placeholder="e.g. React, Node.js, MongoDB, Embedded C"
                value={formData.skills}
                onChange={handleChange}
              />
              <span className="form-hint">Separate multiple skills with commas</span>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">
                Password <span className="req">*</span>
              </label>
              <input
                id="reg-password"
                name="password"
                type="password"
                className={`form-input ${validationErrors.password ? 'input-error' : ''}`}
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
              />
              {validationErrors.password && (
                <span className="form-error">{validationErrors.password}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-confirm">
                Confirm Password <span className="req">*</span>
              </label>
              <input
                id="reg-confirm"
                name="confirmPassword"
                type="password"
                className={`form-input ${validationErrors.confirmPassword ? 'input-error' : ''}`}
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
              {validationErrors.confirmPassword && (
                <span className="form-error">{validationErrors.confirmPassword}</span>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={loading}
            style={{ marginTop: '0.5rem' }}
          >
            {loading ? 'Creating Student Profile...' : 'Complete Student Registration'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have a student account?{' '}
            <Link to="/login" className="auth-link">
              Sign in here
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
