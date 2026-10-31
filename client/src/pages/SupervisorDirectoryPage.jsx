import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import SupervisorProfileModal from '../components/SupervisorProfileModal';

const DEPARTMENTS = [
  'All Departments',
  'Department of Civil and Environmental Engineering',
  'Department of Electrical and Information Engineering',
  'Department of Computer Engineering',
  'Department of Mechanical and Manufacturing Engineering',
  'Department of Marine Engineering and Naval Architecture',
  'Department of Interdisciplinary Studies'
];

export default function SupervisorDirectoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get('department') || '');

  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected supervisor for detail modal
  const [selectedSupervisorId, setSelectedSupervisorId] = useState(null);

  const fetchSupervisors = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (departmentFilter && departmentFilter !== 'All Departments') {
        params.set('department', departmentFilter);
      }

      const res = await fetch(`/api/supervisors?${params.toString()}`, {
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to fetch supervisors (HTTP ${res.status})`);
      }

      setSupervisors(json.data?.supervisors || []);
    } catch (err) {
      setError(err.message || 'Could not load supervisor directory.');
      setSupervisors([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, departmentFilter]);

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const newParams = new URLSearchParams();
    if (searchTerm.trim()) newParams.set('search', searchTerm.trim());
    if (departmentFilter && departmentFilter !== 'All Departments') {
      newParams.set('department', departmentFilter);
    }
    setSearchParams(newParams);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('');
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters = Boolean(searchTerm.trim() || (departmentFilter && departmentFilter !== 'All Departments'));

  return (
    <div className="discovery-page">
      <div className="container" style={{ padding: '2.5rem 1.5rem' }}>
        {/* Header */}
        <div className="discovery-header">
          <div className="discovery-eyebrow">Academic Mentorship &amp; Faculty Advising</div>
          <h1 className="discovery-title">Faculty Supervisor Directory</h1>
          <p className="discovery-subtitle">
            Explore engineering faculty members, inspect current supervision capacities, and identify supervisors whose research specializations align with your project goals.
          </p>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="filter-toolbar">
          <form onSubmit={handleSearchSubmit} className="search-form">
            <div className="search-input-wrap">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="form-input search-input"
                placeholder="Search by faculty name or research specialization (e.g. AI, Robotics, Power Systems)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchTerm('')}
                  title="Clear search text"
                >
                  ✕
                </button>
              )}
            </div>
            <button type="submit" className="btn btn-primary search-submit-btn">
              Search
            </button>
          </form>

          {/* Department Filter */}
          <div className="filter-select-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label htmlFor="dept-filter" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Department:
            </label>
            <select
              id="dept-filter"
              className="form-input"
              style={{ width: 'auto', minWidth: '180px' }}
              value={departmentFilter || 'All Departments'}
              onChange={(e) => {
                const val = e.target.value === 'All Departments' ? '' : e.target.value;
                setDepartmentFilter(val);
                const newParams = new URLSearchParams(searchParams);
                if (val) newParams.set('department', val);
                else newParams.delete('department');
                setSearchParams(newParams);
              }}
            >
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleClearFilters}
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="discovery-loading" style={{ minHeight: '40vh' }}>
            <div className="dot dot-yellow" style={{ width: '1.25rem', height: '1.25rem' }}></div>
            <p>Searching faculty supervisor directory...</p>
          </div>
        ) : supervisors.length === 0 ? (
          /* Empty State */
          <div className="empty-state-card" style={{ marginTop: '2rem' }}>
            <div className="empty-icon">🎓</div>
            <h3 className="empty-title">No Faculty Supervisors Found</h3>
            <p className="empty-desc">
              {hasActiveFilters
                ? 'No faculty members match your active search terms or department filters.'
                : 'No faculty supervisors have been registered in the directory yet.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClearFilters}
              >
                Clear Search &amp; Filters
              </button>
            )}
          </div>
        ) : (
          /* Supervisors Grid */
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              color: 'var(--text-secondary)',
              fontSize: '0.875rem'
            }}>
              <span>
                Showing <strong>{supervisors.length}</strong> faculty supervisor{supervisors.length === 1 ? '' : 's'}
              </span>
              <span>
                🟢 Available: {supervisors.filter(s => s.isAvailable).length} | 🔴 Full: {supervisors.filter(s => !s.isAvailable).length}
              </span>
            </div>

            <div className="projects-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
              {supervisors.map(sup => {
                const remaining = sup.maxCapacity - sup.activeProjectsCount;
                return (
                  <div key={sup._id} className="project-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      {/* Top Row: Department & Availability Pill */}
                      <div className="card-top-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span className="domain-pill" style={{ fontSize: '0.8rem' }}>
                          {sup.department}
                        </span>
                        <span className={`status-pill ${sup.isAvailable ? 'recruitment-open' : 'recruitment-closed'}`} style={{ fontSize: '0.75rem' }}>
                          {sup.isAvailable ? '🟢 Available' : '🔴 Full'}
                        </span>
                      </div>

                      {/* Supervisor Name & Designation */}
                      <h3 className="card-title" style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>
                        {sup.name}
                      </h3>
                      <div style={{ color: 'var(--accent-secondary)', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.75rem' }}>
                        {sup.designation || 'Faculty Member'}
                      </div>

                      {/* Workload Metric */}
                      <div style={{
                        backgroundColor: 'rgba(15, 23, 42, 0.4)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.375rem',
                        padding: '0.65rem 0.85rem',
                        marginBottom: '0.75rem',
                        fontSize: '0.825rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Supervision Workload:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>
                            {sup.activeProjectsCount} / {sup.maxCapacity} Active Projects
                          </strong>
                        </div>
                        {/* Progress meter bar */}
                        <div style={{
                          width: '100%',
                          height: '6px',
                          backgroundColor: 'rgba(51, 65, 85, 0.5)',
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${Math.min(100, Math.round((sup.activeProjectsCount / sup.maxCapacity) * 100))}%`,
                            height: '100%',
                            backgroundColor: sup.isAvailable ? 'var(--accent-primary)' : '#f87171',
                            borderRadius: '3px'
                          }} />
                        </div>
                        <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: sup.isAvailable ? 'var(--accent-green)' : '#f87171' }}>
                          {sup.isAvailable ? `${remaining} slot${remaining === 1 ? '' : 's'} available` : 'Capacity limit reached'}
                        </div>
                      </div>

                      {/* Research Interests Chips */}
                      {Array.isArray(sup.researchInterests) && sup.researchInterests.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                            Research Specializations:
                          </div>
                          <div className="skills-chips">
                            {sup.researchInterests.slice(0, 4).map((interest, idx) => (
                              <span key={idx} className="skill-chip" style={{ fontSize: '0.75rem' }}>
                                #{interest}
                              </span>
                            ))}
                            {sup.researchInterests.length > 4 && (
                              <span className="skill-chip" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                +{sup.researchInterests.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action */}
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                        {sup.contactEmail ? `📧 ${sup.contactEmail}` : (sup.officeLocation ? `📍 ${sup.officeLocation}` : `📧 ${sup.email}`)}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedSupervisorId(sup._id)}
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Supervisor Profile Modal */}
        {selectedSupervisorId && (
          <SupervisorProfileModal
            supervisorId={selectedSupervisorId}
            isOpen={Boolean(selectedSupervisorId)}
            onClose={() => setSelectedSupervisorId(null)}
          />
        )}
      </div>
    </div>
  );
}

