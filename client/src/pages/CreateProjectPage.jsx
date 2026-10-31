import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DOMAINS = [
  'Computer',
  'Electrical',
  'Mechanical',
  'Civil',
  'Biomedical',
  'Multidisciplinary'
];

function getTomorrowDateString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

export default function CreateProjectPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const minDateString = getTomorrowDateString();

  const [formData, setFormData] = useState({
    title: '',
    abstract: '',
    domain: 'Computer',
    tags: '',
    maxTeamSize: '4',
    targetCompletionDate: '',
    repositoryUrl: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const errors = {};

    const trimmedTitle = formData.title.trim();
    if (!trimmedTitle) {
      errors.title = 'Project title is required.';
    } else if (trimmedTitle.length < 5 || trimmedTitle.length > 120) {
      errors.title = 'Title must be between 5 and 120 characters.';
    }

    const trimmedAbstract = formData.abstract.trim();
    if (!trimmedAbstract) {
      errors.abstract = 'Project abstract is required.';
    } else if (trimmedAbstract.length < 20 || trimmedAbstract.length > 1500) {
      errors.abstract = 'Abstract must be between 20 and 1500 characters.';
    }

    if (!formData.domain || !DOMAINS.includes(formData.domain)) {
      errors.domain = 'Please select a valid engineering domain.';
    }

    const size = Number(formData.maxTeamSize);
    if (!Number.isInteger(size) || size < 2 || size > 6) {
      errors.maxTeamSize = 'Maximum team size must be an integer between 2 and 6.';
    }

    if (!formData.targetCompletionDate) {
      errors.targetCompletionDate = 'Target completion date is required.';
    } else {
      const selectedDate = new Date(formData.targetCompletionDate);
      if (isNaN(selectedDate.getTime()) || selectedDate <= new Date()) {
        errors.targetCompletionDate = 'Target completion date must be in the future.';
      }
    }

    if (formData.repositoryUrl.trim()) {
      if (!/^https?:\/\/.+/i.test(formData.repositoryUrl.trim())) {
        errors.repositoryUrl = 'Repository URL must be a valid web address starting with http:// or https://.';
      }
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

    // Role safeguard
    if (user && user.accountType !== 'student') {
      setError('Supervisors cannot create projects. Only undergraduate student accounts can propose projects.');
      return;
    }

    setLoading(true);
    try {
      const parsedTags = formData.tags
        ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

      // Safe payload: strictly includes only allowed editable metadata.
      // Leader, members, supervisor, pulseScore, status, recruitmentStatus are NEVER passed.
      const payload = {
        title: formData.title.trim(),
        abstract: formData.abstract.trim(),
        domain: formData.domain,
        tags: parsedTags,
        maxTeamSize: Number(formData.maxTeamSize),
        targetCompletionDate: new Date(formData.targetCompletionDate).toISOString(),
        repositoryUrl: formData.repositoryUrl.trim()
      };

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg = json.errors && json.errors.length > 0
          ? json.errors.map(err => err.message).join(' ')
          : (json.message || 'Failed to propose project.');
        throw new Error(errorMsg);
      }

      const createdId = json.data?.project?._id;
      if (createdId) {
        navigate(`/projects/${createdId}`);
      } else {
        navigate('/projects');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while creating project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{ padding: '3rem 1rem' }}>
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <div className="brand-icon auth-logo">PF</div>
          <h2 className="auth-title">Propose Academic Project Workspace</h2>
          <p className="auth-subtitle">
            Define your engineering capstone or mini-project. As the creator, you will become the Project Leader.
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
            <label className="form-label" htmlFor="proj-title">
              Project Title <span className="req">*</span>
            </label>
            <input
              id="proj-title"
              name="title"
              type="text"
              className={`form-input ${validationErrors.title ? 'input-error' : ''}`}
              placeholder="e.g. Smart Campus Energy Monitor with Real-Time Analytics"
              value={formData.title}
              onChange={handleChange}
              required
            />
            {validationErrors.title ? (
              <span className="form-error">{validationErrors.title}</span>
            ) : (
              <span className="form-hint">5 to 120 characters describing your engineering project</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="proj-abstract">
              Project Abstract & Scope <span className="req">*</span>
            </label>
            <textarea
              id="proj-abstract"
              name="abstract"
              rows={4}
              className={`form-input ${validationErrors.abstract ? 'input-error' : ''}`}
              placeholder="Provide a comprehensive technical overview of the problem, proposed methodology, hardware/software stack, and anticipated outcomes (minimum 20 characters)..."
              value={formData.abstract}
              onChange={handleChange}
              required
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {validationErrors.abstract ? (
                <span className="form-error">{validationErrors.abstract}</span>
              ) : (
                <span className="form-hint">20 to 1500 characters</span>
              )}
              <span className="form-hint" style={{ color: formData.abstract.length < 20 ? 'var(--warning)' : 'var(--text-muted)' }}>
                {formData.abstract.length}/1500
              </span>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="proj-domain">
                Engineering Domain <span className="req">*</span>
              </label>
              <select
                id="proj-domain"
                name="domain"
                className={`form-select ${validationErrors.domain ? 'input-error' : ''}`}
                value={formData.domain}
                onChange={handleChange}
                required
              >
                {DOMAINS.map(d => (
                  <option key={d} value={d}>{d} Engineering</option>
                ))}
              </select>
              {validationErrors.domain && (
                <span className="form-error">{validationErrors.domain}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="proj-teamsize">
                Maximum Team Size <span className="req">*</span>
              </label>
              <select
                id="proj-teamsize"
                name="maxTeamSize"
                className={`form-select ${validationErrors.maxTeamSize ? 'input-error' : ''}`}
                value={formData.maxTeamSize}
                onChange={handleChange}
                required
              >
                {[2, 3, 4, 5, 6].map(num => (
                  <option key={num} value={num}>
                    {num} Members (1 Leader + {num - 1} peers)
                  </option>
                ))}
              </select>
              {validationErrors.maxTeamSize ? (
                <span className="form-error">{validationErrors.maxTeamSize}</span>
              ) : (
                <span className="form-hint">Leader is counted toward capacity (Min: 2, Max: 6)</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="proj-date">
                Target Completion Date <span className="req">*</span>
              </label>
              <input
                id="proj-date"
                name="targetCompletionDate"
                type="date"
                min={minDateString}
                className={`form-input ${validationErrors.targetCompletionDate ? 'input-error' : ''}`}
                value={formData.targetCompletionDate}
                onChange={handleChange}
                required
              />
              {validationErrors.targetCompletionDate && (
                <span className="form-error">{validationErrors.targetCompletionDate}</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="proj-tags">
                Technical Tags (Optional)
              </label>
              <input
                id="proj-tags"
                name="tags"
                type="text"
                className="form-input"
                placeholder="e.g. IoT, Embedded, React, Python, MQTT"
                value={formData.tags}
                onChange={handleChange}
              />
              <span className="form-hint">Separate multiple keywords with commas</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="proj-repo">
              External Repository URL (Optional)
            </label>
            <input
              id="proj-repo"
              name="repositoryUrl"
              type="url"
              className={`form-input ${validationErrors.repositoryUrl ? 'input-error' : ''}`}
              placeholder="e.g. https://github.com/organization/project-name"
              value={formData.repositoryUrl}
              onChange={handleChange}
            />
            {validationErrors.repositoryUrl && (
              <span className="form-error">{validationErrors.repositoryUrl}</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <Link to="/projects" className="btn btn-secondary" style={{ flex: 1 }}>
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ flex: 2 }}
            >
              {loading ? 'Creating Project Workspace...' : 'Propose Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
