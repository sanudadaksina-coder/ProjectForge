import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DOMAINS = [
  'Computer',
  'Electrical',
  'Mechanical',
  'Civil',
  'Biomedical',
  'Multidisciplinary'
];

const STATUSES = [
  { label: 'Proposed', value: 'proposed' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' }
];

export default function EditProjectPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    abstract: '',
    domain: 'Computer',
    tags: '',
    maxTeamSize: '4',
    targetCompletionDate: '',
    status: 'proposed',
    repositoryUrl: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  const fetchProjectForEdit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Failed to load project details.');
      }

      const p = json.data?.project;
      if (!p) throw new Error('Project not found.');

      setProject(p);

      // Pre-fill form fields
      const dateFormatted = p.targetCompletionDate
        ? new Date(p.targetCompletionDate).toISOString().split('T')[0]
        : '';

      setFormData({
        title: p.title || '',
        abstract: p.abstract || '',
        domain: p.domain || 'Computer',
        tags: Array.isArray(p.tags) ? p.tags.join(', ') : '',
        maxTeamSize: String(p.maxTeamSize || 4),
        targetCompletionDate: dateFormatted,
        status: p.status || 'proposed',
        repositoryUrl: p.repositoryUrl || ''
      });
    } catch (err) {
      setError(err.message || 'Could not fetch project.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProjectForEdit();
  }, [fetchProjectForEdit]);

  // Check if current user is the leader
  const isLeader = Boolean(
    user &&
    project &&
    (
      (typeof project.leader === 'object' && project.leader?._id === user._id) ||
      (typeof project.leader === 'string' && project.leader === user._id)
    )
  );

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
    const currentMemberCount = project?.members?.length || 1;
    if (!Number.isInteger(size) || size < 2 || size > 6) {
      errors.maxTeamSize = 'Maximum team size must be an integer between 2 and 6.';
    } else if (size < currentMemberCount) {
      errors.maxTeamSize = `Team size cannot be smaller than current member count (${currentMemberCount}).`;
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

    setSaving(true);
    try {
      const parsedTags = formData.tags
        ? formData.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

      // Safe update payload: strictly includes only allowed editable metadata.
      // Leader, members, supervisor, and pulseScore are never sent.
      const payload = {
        title: formData.title.trim(),
        abstract: formData.abstract.trim(),
        domain: formData.domain,
        tags: parsedTags,
        maxTeamSize: Number(formData.maxTeamSize),
        targetCompletionDate: new Date(formData.targetCompletionDate).toISOString(),
        status: formData.status,
        repositoryUrl: formData.repositoryUrl.trim()
      };

      const res = await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
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
          : (json.message || 'Failed to update project.');
        throw new Error(errorMsg);
      }

      // Updated successfully -> Navigate back to project details
      navigate(`/projects/${id}`);
    } catch (err) {
      setError(err.message || 'An error occurred while updating project.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="discovery-loading" style={{ minHeight: '60vh' }}>
        <div className="dot dot-yellow" style={{ width: '1.25rem', height: '1.25rem' }}></div>
        <p>Loading project for editing...</p>
      </div>
    );
  }

  // Non-leader authorization guard
  if (!isLeader) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div className="empty-state-card">
          <div className="empty-icon">🚫</div>
          <h2 className="empty-title">Access Forbidden</h2>
          <p className="empty-desc">
            Only the designated <strong>Project Leader</strong> is authorized to modify project workspace metadata.
          </p>
          <Link to={`/projects/${id}`} className="btn btn-secondary">
            ← Return to Project Details
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container" style={{ padding: '3rem 1rem' }}>
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <div className="brand-icon auth-logo">PF</div>
          <h2 className="auth-title">Edit Project Workspace Metadata</h2>
          <p className="auth-subtitle">
            Update project scope, domain, team capacity, and target completion deadlines.
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
            <label className="form-label" htmlFor="edit-title">
              Project Title <span className="req">*</span>
            </label>
            <input
              id="edit-title"
              name="title"
              type="text"
              className={`form-input ${validationErrors.title ? 'input-error' : ''}`}
              value={formData.title}
              onChange={handleChange}
              required
            />
            {validationErrors.title && (
              <span className="form-error">{validationErrors.title}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-abstract">
              Project Abstract & Scope <span className="req">*</span>
            </label>
            <textarea
              id="edit-abstract"
              name="abstract"
              rows={4}
              className={`form-input ${validationErrors.abstract ? 'input-error' : ''}`}
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
              <label className="form-label" htmlFor="edit-domain">
                Engineering Domain <span className="req">*</span>
              </label>
              <select
                id="edit-domain"
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
              <label className="form-label" htmlFor="edit-status">
                Lifecycle Status <span className="req">*</span>
              </label>
              <select
                id="edit-status"
                name="status"
                className="form-select"
                value={formData.status}
                onChange={handleChange}
                required
              >
                {STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="edit-teamsize">
                Maximum Team Size <span className="req">*</span>
              </label>
              <select
                id="edit-teamsize"
                name="maxTeamSize"
                className={`form-select ${validationErrors.maxTeamSize ? 'input-error' : ''}`}
                value={formData.maxTeamSize}
                onChange={handleChange}
                required
              >
                {[2, 3, 4, 5, 6].map(num => (
                  <option key={num} value={num}>
                    {num} Members (Current count: {project?.members?.length || 1})
                  </option>
                ))}
              </select>
              {validationErrors.maxTeamSize ? (
                <span className="form-error">{validationErrors.maxTeamSize}</span>
              ) : (
                <span className="form-hint">Cannot be lower than current members ({project?.members?.length || 1})</span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-date">
                Target Completion Date <span className="req">*</span>
              </label>
              <input
                id="edit-date"
                name="targetCompletionDate"
                type="date"
                className={`form-input ${validationErrors.targetCompletionDate ? 'input-error' : ''}`}
                value={formData.targetCompletionDate}
                onChange={handleChange}
                required
              />
              {validationErrors.targetCompletionDate && (
                <span className="form-error">{validationErrors.targetCompletionDate}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="edit-tags">
                Technical Tags (Optional)
              </label>
              <input
                id="edit-tags"
                name="tags"
                type="text"
                className="form-input"
                placeholder="e.g. IoT, Embedded, React, Python"
                value={formData.tags}
                onChange={handleChange}
              />
              <span className="form-hint">Separate multiple keywords with commas</span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-repo">
                External Repository URL (Optional)
              </label>
              <input
                id="edit-repo"
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
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <Link to={`/projects/${id}`} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ flex: 2 }}
            >
              {saving ? 'Saving Changes...' : 'Save Metadata Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
