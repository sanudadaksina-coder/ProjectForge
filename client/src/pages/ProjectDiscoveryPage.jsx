import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const DOMAINS = [
  'All Domains',
  'Computer',
  'Electrical',
  'Mechanical',
  'Civil',
  'Biomedical',
  'Multidisciplinary'
];

const STATUSES = [
  { label: 'All Statuses', value: '' },
  { label: 'Proposed', value: 'proposed' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' }
];

const RECRUITMENT = [
  { label: 'All Recruitment', value: '' },
  { label: 'Open (Recruiting)', value: 'open' },
  { label: 'Closed (Full)', value: 'closed' }
];

const SORTS = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Oldest First', value: 'oldest' },
  { label: 'Nearest Deadline', value: 'deadline' },
  { label: 'Project Pulse', value: 'pulse' }
];

export default function ProjectDiscoveryPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search and filter states initialized from URL query params
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [domainFilter, setDomainFilter] = useState(searchParams.get('domain') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [recruitmentFilter, setRecruitmentFilter] = useState(searchParams.get('recruitment') || '');
  const [sortOption, setSortOption] = useState(searchParams.get('sort') || 'newest');
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);

  const [projects, setProjects] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (domainFilter && domainFilter !== 'All Domains') params.set('domain', domainFilter);
      if (statusFilter) params.set('status', statusFilter);
      if (recruitmentFilter) params.set('recruitment', recruitmentFilter);
      if (sortOption) params.set('sort', sortOption);
      params.set('page', String(currentPage));
      params.set('limit', '9'); // 9 projects per page for 3x3 grid

      const res = await fetch(`/api/projects?${params.toString()}`, {
        headers: { 'Accept': 'application/json' }
      });

      if (!res.ok) {
        throw new Error(`Failed to load projects (HTTP ${res.status})`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setProjects(json.data.projects || []);
        setPagination(json.data.pagination || { page: 1, limit: 9, total: 0, pages: 1 });
      } else {
        throw new Error(json.message || 'Failed to parse projects response');
      }
    } catch (err) {
      setError(err.message || 'Could not fetch projects. Please check connection.');
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, domainFilter, statusFilter, recruitmentFilter, sortOption, currentPage]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    const newParams = new URLSearchParams();
    if (searchTerm.trim()) newParams.set('search', searchTerm.trim());
    if (domainFilter && domainFilter !== 'All Domains') newParams.set('domain', domainFilter);
    if (statusFilter) newParams.set('status', statusFilter);
    if (recruitmentFilter) newParams.set('recruitment', recruitmentFilter);
    if (sortOption) newParams.set('sort', sortOption);
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setDomainFilter('');
    setStatusFilter('');
    setRecruitmentFilter('');
    setSortOption('newest');
    setCurrentPage(1);
    setSearchParams({});
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not specified';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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

  return (
    <div className="discovery-page">
      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        {/* Header & Propose Button */}
        <div className="discovery-header">
          <div>
            <div className="dashboard-eyebrow">Project Registry</div>
            <h1 className="dashboard-title">Explore Academic Engineering Projects</h1>
            <p className="dashboard-subtitle">
              Discover active student projects, inspect team occupancy, and explore faculty-supervised domains.
            </p>
          </div>
          {user && user.accountType === 'student' && (
            <Link to="/projects/new" className="btn btn-primary">
              + Propose New Project
            </Link>
          )}
        </div>

        {/* Filter & Search Bar */}
        <div className="discovery-controls-card">
          <form onSubmit={handleSearchSubmit} className="search-form">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="form-input search-input"
                placeholder="Search by title, abstract keyword, or technical tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchTerm('')}
                  title="Clear search term"
                >
                  ✕
                </button>
              )}
            </div>
            <button type="submit" className="btn btn-secondary">
              Search
            </button>
          </form>

          <div className="filters-row">
            <div className="filter-group">
              <label className="filter-label">Domain</label>
              <select
                className="form-select filter-select"
                value={domainFilter}
                onChange={(e) => {
                  setDomainFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                {DOMAINS.map(d => (
                  <option key={d} value={d === 'All Domains' ? '' : d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Status</label>
              <select
                className="form-select filter-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                {STATUSES.map(s => (
                  <option key={s.label} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Recruitment</label>
              <select
                className="form-select filter-select"
                value={recruitmentFilter}
                onChange={(e) => {
                  setRecruitmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                {RECRUITMENT.map(r => (
                  <option key={r.label} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">Sort By</label>
              <select
                className="form-select filter-select"
                value={sortOption}
                onChange={(e) => {
                  setSortOption(e.target.value);
                  setCurrentPage(1);
                }}
              >
                {SORTS.map(s => (
                  <option key={s.label} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {(searchTerm || domainFilter || statusFilter || recruitmentFilter || sortOption !== 'newest') && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClearFilters}
                style={{ alignSelf: 'flex-end', height: '2.6rem' }}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Results Metadata Summary */}
        <div className="results-summary">
          <span>
            Showing {projects.length} of {pagination.total} project{pagination.total === 1 ? '' : 's'}
          </span>
          {loading && <span className="loading-tag">Updating...</span>}
        </div>

        {/* Error State */}
        {error && (
          <div className="alert alert-danger" role="alert">
            <span className="alert-icon">⚠️</span>
            <div style={{ flex: 1 }}>
              <strong>Notice:</strong> {error}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={fetchProjects}
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && projects.length === 0 && (
          <div className="discovery-loading">
            <div className="dot dot-yellow" style={{ width: '1.25rem', height: '1.25rem' }}></div>
            <p>Loading project registry...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && projects.length === 0 && !error && (
          <div className="empty-state-card" style={{ margin: '2rem 0' }}>
            <div className="empty-icon">🔍</div>
            <h3 className="empty-title">No Projects Found</h3>
            <p className="empty-desc">
              No academic projects match your current search and filter settings. Try relaxing your filters or search keywords.
            </p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClearFilters}
            >
              Clear All Filters
            </button>
          </div>
        )}

        {/* Project Cards Grid */}
        <div className="projects-grid">
          {projects.map((project) => (
            <div key={project._id} className="project-card">
              <div className="project-card-header">
                <span className="domain-pill">{project.domain}</span>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <span className={`status-pill ${getStatusBadgeClass(project.status)}`}>
                    {project.status.replace('_', ' ')}
                  </span>
                  <span className={`status-pill ${project.recruitmentStatus === 'open' ? 'recruitment-open' : 'recruitment-closed'}`}>
                    {project.recruitmentStatus}
                  </span>
                </div>
              </div>

              <h3 className="project-title">
                <Link to={`/projects/${project._id}`} className="project-title-link">
                  {project.title}
                </Link>
              </h3>

              <p className="project-abstract-excerpt">
                {project.abstract && project.abstract.length > 130
                  ? `${project.abstract.substring(0, 130)}...`
                  : project.abstract}
              </p>

              {/* Tags */}
              <div className="project-tags">
                {Array.isArray(project.tags) && project.tags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="project-tag-pill">#{tag}</span>
                ))}
                {project.tags && project.tags.length > 3 && (
                  <span className="project-tag-pill">+{project.tags.length - 3}</span>
                )}
              </div>

              {/* Card Meta Footer */}
              <div className="project-card-meta">
                <div className="meta-row">
                  <span className="meta-label">Leader:</span>
                  <span className="meta-value">
                    {project.leader?.name || 'Unassigned'} ({project.leader?.department || 'Eng'})
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
              </div>

              <div className="project-card-action">
                <Link to={`/projects/${project._id}`} className="btn btn-secondary btn-block btn-sm">
                  View Workspace Details →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="pagination-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              ← Previous
            </button>
            <span className="pagination-indicator">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={currentPage >= pagination.pages || loading}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
