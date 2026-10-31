import { useState, useEffect } from 'react';

export default function SupervisorProfileModal({ supervisorId, isOpen, onClose }) {
  const [supervisor, setSupervisor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !supervisorId) {
      setSupervisor(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/supervisors/${supervisorId}`, {
          headers: { 'Accept': 'application/json' },
          credentials: 'include'
        });

        const json = await res.json();

        if (!isMounted) return;

        if (!res.ok || !json.success) {
          throw new Error(json.message || `Failed to fetch supervisor profile (HTTP ${res.status})`);
        }

        setSupervisor(json.data?.supervisor || null);
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Could not load supervisor profile.');
        setSupervisor(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [isOpen, supervisorId]);

  if (!isOpen) return null;

  const isAvailable = supervisor ? supervisor.activeProjectsCount < supervisor.maxCapacity : false;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
        <div className="modal-header">
          <div className="modal-icon">🎓</div>
          <div>
            <h3 className="modal-title">Faculty Supervisor Profile</h3>
            <p className="modal-text" style={{ margin: 0, fontSize: '0.85rem' }}>
              Academic credentials, department affiliation, and research interests.
            </p>
          </div>
        </div>

        {loading && (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div className="dot dot-yellow" style={{ width: '1.25rem', height: '1.25rem', margin: '0 auto 0.75rem auto' }}></div>
            <p>Loading supervisor profile...</p>
          </div>
        )}

        {error && (
          <div className="alert alert-danger" style={{ marginTop: '1rem' }}>
            <span className="alert-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {!loading && supervisor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{supervisor.name}</h4>
                <div style={{ color: 'var(--accent-secondary)', fontSize: '0.9rem', fontWeight: 500, marginTop: '0.2rem' }}>
                  {supervisor.designation || 'Faculty Member'} • {supervisor.department.includes('Engineering') ? supervisor.department : `${supervisor.department} Engineering`}
                </div>
              </div>
              <span className={`status-pill ${isAvailable ? 'recruitment-open' : 'recruitment-closed'}`}>
                {isAvailable ? '🟢 Available for Supervision' : '🔴 Capacity Full'}
              </span>
            </div>

            {/* Demonstration notice */}
            <div style={{
              padding: '0.55rem 0.85rem',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '0.375rem',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)'
            }}>
              ℹ️ <strong>Demonstration Faculty Account:</strong> Provided for academic supervision workflow evaluation.
            </div>

            {/* Profile details grid */}
            <div style={{
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.5rem',
              padding: '1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              fontSize: '0.875rem'
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Faculty Contact Email</span>
                <span style={{ color: supervisor.contactEmail ? 'var(--text-primary)' : 'var(--text-muted)', wordBreak: 'break-all' }}>
                  {supervisor.contactEmail ? `📧 ${supervisor.contactEmail}` : 'Not provided'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Office Location</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {supervisor.officeLocation ? `📍 ${supervisor.officeLocation}` : 'Not listed'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Active Supervised Projects</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {supervisor.activeProjectsCount} / {supervisor.maxCapacity} Projects
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Supervision Capacity</span>
                <span style={{ color: isAvailable ? 'var(--accent-green)' : '#f87171', fontWeight: 600 }}>
                  {supervisor.maxCapacity - supervisor.activeProjectsCount} spot{supervisor.maxCapacity - supervisor.activeProjectsCount === 1 ? '' : 's'} remaining
                </span>
              </div>
            </div>

            {/* Research interests */}
            <div>
              <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Areas of Research &amp; Specialization:
              </span>
              {Array.isArray(supervisor.researchInterests) && supervisor.researchInterests.length > 0 ? (
                <div className="skills-chips">
                  {supervisor.researchInterests.map((interest, idx) => (
                    <span key={idx} className="skill-chip" style={{ backgroundColor: 'rgba(129, 140, 248, 0.12)', color: 'var(--accent-secondary)', borderColor: 'rgba(129, 140, 248, 0.25)' }}>
                      #{interest}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  No research interests listed.
                </span>
              )}
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

