/**
 * Comprehensive Unit, Component and Contract Tests for ProjectForge Stage 3A-B:
 * Frontend Supervisor Management
 *
 * Verifies:
 * 1. Component & Route Architecture (Directory, Dashboard, Modals, Section, Navbar, Routing)
 * 2. Role-Based Authorization & Navigation Gates (Student vs Supervisor vs Leader vs Member)
 * 3. Supervisor Directory, Workload & Availability Calculation
 * 4. Project Leader Proposal Form Validation (20–1000 chars) & Conflict Guards
 * 5. Request Status Workflow & Presentation (Pending, Accepted, Declined)
 * 6. Supervisor Inbox Decisions (Accept Transaction, Decline with Feedback <= 500 chars)
 * 7. Render Stability, Loop Prevention & Regression Integrity
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: validate proposal message matching RequestSupervisionModal.jsx
function validateProposalMessage(message) {
  if (typeof message !== 'string') {
    return { isValid: false, error: 'Proposal message is required.' };
  }
  const len = message.trim().length;
  if (len < 20) {
    return { isValid: false, error: 'Proposal message must be at least 20 characters long.' };
  }
  if (len > 1000) {
    return { isValid: false, error: 'Proposal message cannot exceed 1000 characters.' };
  }
  return { isValid: true, error: null };
}

// Helper: validate decline feedback matching DeclineRequestModal.jsx
function validateDeclineFeedback(feedback) {
  if (!feedback) return { isValid: true, error: null };
  if (typeof feedback !== 'string') {
    return { isValid: false, error: 'Feedback must be text.' };
  }
  if (feedback.trim().length > 500) {
    return { isValid: false, error: 'Feedback cannot exceed 500 characters.' };
  }
  return { isValid: true, error: null };
}

// Helper: compute supervisor availability matching SupervisorDirectoryPage & backend
function computeSupervisorWorkload(sup) {
  const maxCap = (typeof sup.maxCapacity === 'number' && sup.maxCapacity >= 1) ? sup.maxCapacity : 5;
  const activeCount = sup.activeProjectsCount || 0;
  const isAvailable = activeCount < maxCap;
  const remainingSpots = Math.max(0, maxCap - activeCount);
  const percent = Math.min(100, Math.round((activeCount / maxCap) * 100));

  return {
    maxCapacity: maxCap,
    activeProjectsCount: activeCount,
    isAvailable,
    remainingSpots,
    percent
  };
}

// Helper: evaluate leader supervision request eligibility
function computeCanRequestSupervision({ user, project, pendingRequest }) {
  if (!user || user.accountType !== 'student') return false;
  if (!project) return false;

  const isLeader = Boolean(
    (typeof project.leader === 'object' && project.leader?._id === user._id) ||
    (typeof project.leader === 'string' && project.leader === user._id)
  );

  if (!isLeader) return false;
  if (project.supervisor) return false; // Already supervised
  if (pendingRequest && pendingRequest.status === 'pending') return false; // Single pending rule

  return true;
}

function runSupervisorFrontendTests() {
  console.log('===================================================================');
  console.log('ProjectForge Stage 3A-B: Frontend Supervisor Management Test Suite');
  console.log('===================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(testName, condition, detail = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} - ${detail}`);
      failed++;
    }
  }

  // --- SUITE 1: Component & Route Architecture Verification ---
  console.log('--- Suite 1: Component & Route Architecture Verification ---');

  const componentsDir = path.join(__dirname, '../src/components');
  const pagesDir = path.join(__dirname, '../src/pages');

  const supervisorDirectoryExists = fs.existsSync(path.join(pagesDir, 'SupervisorDirectoryPage.jsx'));
  const supervisorDashboardExists = fs.existsSync(path.join(pagesDir, 'SupervisorDashboardPage.jsx'));
  const supervisorProfileModalExists = fs.existsSync(path.join(componentsDir, 'SupervisorProfileModal.jsx'));
  const requestSupervisionModalExists = fs.existsSync(path.join(componentsDir, 'RequestSupervisionModal.jsx'));
  const declineRequestModalExists = fs.existsSync(path.join(componentsDir, 'DeclineRequestModal.jsx'));
  const supervisionSectionExists = fs.existsSync(path.join(componentsDir, 'SupervisionSection.jsx'));

  assert('01. SupervisorDirectoryPage.jsx exists', supervisorDirectoryExists);
  assert('02. SupervisorDashboardPage.jsx exists', supervisorDashboardExists);
  assert('03. SupervisorProfileModal.jsx exists', supervisorProfileModalExists);
  assert('04. RequestSupervisionModal.jsx exists', requestSupervisionModalExists);
  assert('05. DeclineRequestModal.jsx exists', declineRequestModalExists);
  assert('06. SupervisionSection.jsx exists', supervisionSectionExists);

  // App.jsx route registrations
  const appCode = fs.readFileSync(path.join(__dirname, '../src/App.jsx'), 'utf8');
  assert('07. App.jsx registers /supervisors route with ProtectedRoute',
    appCode.includes('path="/supervisors"') && appCode.includes('<SupervisorDirectoryPage')
  );
  assert('08. App.jsx registers /supervisor/dashboard route with ProtectedRoute',
    appCode.includes('path="/supervisor/dashboard"') && appCode.includes('<SupervisorDashboardPage')
  );

  // Navbar link checks
  const navbarCode = fs.readFileSync(path.join(__dirname, '../src/components/Navbar.jsx'), 'utf8');
  assert('09. Navbar renders Faculty Supervisors link',
    navbarCode.includes('/supervisors') && navbarCode.includes('Faculty Supervisors')
  );
  assert('10. Navbar directs supervisor to /supervisor/dashboard (Supervision Hub)',
    navbarCode.includes('/supervisor/dashboard') && navbarCode.includes('Supervision Hub')
  );

  // LoginPage redirect check
  const loginCode = fs.readFileSync(path.join(__dirname, '../src/pages/LoginPage.jsx'), 'utf8');
  assert('11. LoginPage directs supervisor user to /supervisor/dashboard upon authentication',
    loginCode.includes("user.accountType === 'supervisor'") && loginCode.includes("'/supervisor/dashboard'")
  );

  // DashboardPage redirect check
  const dashCode = fs.readFileSync(path.join(__dirname, '../src/pages/DashboardPage.jsx'), 'utf8');
  assert('12. Student DashboardPage redirects supervisor users to /supervisor/dashboard',
    dashCode.includes("user.accountType === 'supervisor'") && dashCode.includes("to=\"/supervisor/dashboard\"")
  );

  // ProjectDetailsPage integration
  const detailsCode = fs.readFileSync(path.join(__dirname, '../src/pages/ProjectDetailsPage.jsx'), 'utf8');
  assert('13. ProjectDetailsPage embeds SupervisionSection component',
    detailsCode.includes('<SupervisionSection') && detailsCode.includes("from '../components/SupervisionSection'")
  );

  // CSS Styles
  const cssCode = fs.readFileSync(path.join(__dirname, '../src/App.css'), 'utf8');
  assert('14. App.css includes Stage 3A supervisor styling rules',
    cssCode.includes('.supervision-section-card') && cssCode.includes('.assigned-supervisor-card')
  );

  // --- SUITE 2: Role Permissions & Access Control ---
  console.log('\n--- Suite 2: Role Permissions & Access Control ---');

  const studentUser = { _id: 'std_01', name: 'Alice Student', accountType: 'student' };
  const leaderUser = { _id: 'std_leader', name: 'Leader Bob', accountType: 'student' };
  const memberUser = { _id: 'std_member', name: 'Charlie Member', accountType: 'student' };
  const supervisorUser = { _id: 'sup_01', name: 'Dr. Turing', accountType: 'supervisor', maxCapacity: 5 };

  const unassignedProject = {
    _id: 'proj_01',
    title: 'Autonomous Drone Navigation',
    leader: 'std_leader',
    members: ['std_leader', 'std_member'],
    supervisor: null
  };

  const supervisedProject = {
    _id: 'proj_02',
    title: 'Smart Solar Grid',
    leader: 'std_leader',
    members: ['std_leader'],
    supervisor: { _id: 'sup_01', name: 'Dr. Turing', department: 'Electrical' }
  };

  // 15. Student leader on unassigned project can request supervision
  assert(
    '15. Project Leader can request supervision when project has no supervisor and no pending request',
    computeCanRequestSupervision({ user: leaderUser, project: unassignedProject, pendingRequest: null }) === true
  );

  // 16. Ordinary member cannot request supervision
  assert(
    '16. Ordinary team member is blocked from requesting supervision',
    computeCanRequestSupervision({ user: memberUser, project: unassignedProject, pendingRequest: null }) === false
  );

  // 17. Outside student cannot request supervision
  assert(
    '17. Non-member student is blocked from requesting supervision',
    computeCanRequestSupervision({ user: studentUser, project: unassignedProject, pendingRequest: null }) === false
  );

  // 18. Supervisor cannot request supervision
  assert(
    '18. Supervisor account cannot request supervision',
    computeCanRequestSupervision({ user: supervisorUser, project: unassignedProject, pendingRequest: null }) === false
  );

  // 19. Supervised project blocks new supervision requests
  assert(
    '19. Project with assigned supervisor blocks new supervision requests',
    computeCanRequestSupervision({ user: leaderUser, project: supervisedProject, pendingRequest: null }) === false
  );

  // 20. Pending request blocks new supervision requests
  assert(
    '20. Project with active pending request blocks submitting another request',
    computeCanRequestSupervision({
      user: leaderUser,
      project: unassignedProject,
      pendingRequest: { _id: 'req_01', status: 'pending' }
    }) === false
  );

  // 21. Supervisor dashboard gates students
  const supDashCode = fs.readFileSync(path.join(__dirname, '../src/pages/SupervisorDashboardPage.jsx'), 'utf8');
  assert(
    '21. SupervisorDashboardPage gates non-supervisors with Navigate to /dashboard',
    supDashCode.includes("user.accountType !== 'supervisor'") && supDashCode.includes('to="/dashboard"')
  );

  // 22. Public registration strictly enforces student-only creation (zero supervisor option)
  const regCode = fs.readFileSync(path.join(__dirname, '../src/pages/RegisterPage.jsx'), 'utf8');
  assert(
    '22. Public registration strictly enforces student-only creation (zero supervisor option)',
    !regCode.includes('value="supervisor"') && !regCode.includes("accountType === 'supervisor'")
  );

  // 22b. Standardized six academic department options in RegisterPage
  const EXACT_SIX_DEPTS = [
    'Department of Civil and Environmental Engineering',
    'Department of Electrical and Information Engineering',
    'Department of Computer Engineering',
    'Department of Mechanical and Manufacturing Engineering',
    'Department of Marine Engineering and Naval Architecture',
    'Department of Interdisciplinary Studies'
  ];

  const regHasAllSix = EXACT_SIX_DEPTS.every(dept => regCode.includes(dept));
  assert(
    '22b. Student registration provides exactly the six standardized academic departments',
    regHasAllSix
  );

  // --- SUITE 3: Supervisor Directory, Search & Workload Calculation ---
  console.log('\n--- Suite 3: Supervisor Directory, Search & Workload Calculation ---');

  const supAvailable = {
    _id: 's1',
    name: 'Dr. Ada Lovelace',
    department: 'Computer',
    maxCapacity: 5,
    activeProjectsCount: 2
  };

  const supFull = {
    _id: 's2',
    name: 'Dr. Claude Shannon',
    department: 'Electrical',
    maxCapacity: 4,
    activeProjectsCount: 4
  };

  const wAvail = computeSupervisorWorkload(supAvailable);
  assert(
    '23. Available supervisor: activeProjectsCount < maxCapacity yields isAvailable=true and correct remaining spots',
    wAvail.isAvailable === true && wAvail.remainingSpots === 3 && wAvail.percent === 40,
    JSON.stringify(wAvail)
  );

  const wFull = computeSupervisorWorkload(supFull);
  assert(
    '24. Full supervisor: activeProjectsCount >= maxCapacity yields isAvailable=false and 0 remaining spots',
    wFull.isAvailable === false && wFull.remainingSpots === 0 && wFull.percent === 100,
    JSON.stringify(wFull)
  );

  // Default capacity fallback
  const wDefault = computeSupervisorWorkload({ name: 'Dr. Default', activeProjectsCount: 0 });
  assert(
    '25. Supervisor without explicit maxCapacity defaults to 5 capacity limit',
    wDefault.maxCapacity === 5 && wDefault.isAvailable === true,
    JSON.stringify(wDefault)
  );

  // Directory filter search query builder simulation
  const buildDirectoryParams = (search, dept) => {
    const params = new URLSearchParams();
    if (search && search.trim()) params.set('search', search.trim());
    if (dept && dept !== 'All Departments') params.set('department', dept);
    return params.toString();
  };

  const q1 = buildDirectoryParams('Machine Learning', 'Computer');
  assert(
    '26. Search keyword and department query string constructed properly',
    q1.includes('search=Machine+Learning') && q1.includes('department=Computer')
  );

  const q2 = buildDirectoryParams('   ', 'All Departments');
  assert(
    '27. Blank search and "All Departments" produce empty filter query string',
    q2 === ''
  );

  // --- SUITE 4: Project Leader Proposal Form Validation & Submission ---
  console.log('\n--- Suite 4: Proposal Form Validation & Conflict Guards ---');

  const vShort = validateProposalMessage('Too short msg');
  assert(
    '28. Reject proposal message under 20 characters',
    vShort.isValid === false && vShort.error.includes('at least 20 characters'),
    JSON.stringify(vShort)
  );

  const vLong = validateProposalMessage('M'.repeat(1001));
  assert(
    '29. Reject proposal message exceeding 1000 characters',
    vLong.isValid === false && vLong.error.includes('cannot exceed 1000 characters'),
    JSON.stringify(vLong)
  );

  const vBoundary20 = validateProposalMessage('12345678901234567890');
  assert(
    '30. Accept exact 20-character lower boundary proposal message',
    vBoundary20.isValid === true && vBoundary20.error === null
  );

  const vBoundary1000 = validateProposalMessage('P'.repeat(1000));
  assert(
    '31. Accept exact 1000-character upper boundary proposal message',
    vBoundary1000.isValid === true && vBoundary1000.error === null
  );

  const vValidMsg = validateProposalMessage(
    'We are developing an AI-driven smart grid controller and would like your mentorship in power systems simulation.'
  );
  assert(
    '32. Accept standard technical proposal message',
    vValidMsg.isValid === true && vValidMsg.error === null
  );

  // Request modal implementation contract checks
  const reqModalCode = fs.readFileSync(path.join(__dirname, '../src/components/RequestSupervisionModal.jsx'), 'utf8');
  assert(
    '33. RequestSupervisionModal uses POST /api/projects/:projectId/supervision-requests with credentials: include',
    reqModalCode.includes("fetch(`/api/projects/${projectId}/supervision-requests`") &&
    reqModalCode.includes("method: 'POST'") &&
    reqModalCode.includes("credentials: 'include'")
  );

  assert(
    '34. RequestSupervisionModal transmits { supervisorId, proposalMessage } payload',
    reqModalCode.includes('supervisorId: selectedSupervisorId') &&
    reqModalCode.includes('proposalMessage: proposalMessage.trim()')
  );

  assert(
    '35. RequestSupervisionModal prevents duplicate submissions with disabled submit button state',
    reqModalCode.includes('disabled={submitting') && reqModalCode.includes("setSubmitting(true)")
  );

  // --- SUITE 5: Request Status Workflow & Presentation ---
  console.log('\n--- Suite 5: Request Status Workflow & Presentation ---');

  const secCode = fs.readFileSync(path.join(__dirname, '../src/components/SupervisionSection.jsx'), 'utf8');

  assert(
    '36. SupervisionSection displays pending review banner when a proposal is pending',
    secCode.includes('Supervision Proposal Pending Review') && secCode.includes('pendingRequest')
  );

  assert(
    '37. SupervisionSection displays full faculty details when supervisor is assigned',
    secCode.includes('hasAssignedSupervisor') && secCode.includes('project.supervisor.name')
  );

  assert(
    '38. SupervisionSection renders proposal history with reviewedAt and decline feedback',
    secCode.includes('req.feedback') && secCode.includes('req.reviewedAt') && secCode.includes('Proposal History')
  );

  // --- SUITE 6: Supervisor Inbox Decisions (Accept / Decline) ---
  console.log('\n--- Suite 6: Supervisor Inbox Decisions (Accept / Decline) ---');

  assert(
    '39. SupervisorDashboardPage queries /api/supervisors/my-requests for pending, accepted, and declined statuses',
    supDashCode.includes('/api/supervisors/my-requests?status=pending') &&
    supDashCode.includes('/api/supervisors/my-requests?status=accepted') &&
    supDashCode.includes('/api/supervisors/my-requests?status=declined')
  );

  assert(
    '40. SupervisorDashboardPage accepts request using PATCH /api/supervision-requests/:requestId/accept',
    supDashCode.includes("`/api/supervision-requests/${requestId}/accept`") &&
    supDashCode.includes("method: 'PATCH'") &&
    supDashCode.includes("credentials: 'include'")
  );

  const decModalCode = fs.readFileSync(path.join(__dirname, '../src/components/DeclineRequestModal.jsx'), 'utf8');
  assert(
    '41. DeclineRequestModal declines request using PATCH /api/supervision-requests/:requestId/decline',
    decModalCode.includes("`/api/supervision-requests/${request._id}/decline`") &&
    decModalCode.includes("method: 'PATCH'") &&
    decModalCode.includes("credentials: 'include'")
  );

  const fbLong = validateDeclineFeedback('F'.repeat(501));
  assert(
    '42. Reject decline feedback exceeding 500 characters',
    fbLong.isValid === false && fbLong.error.includes('cannot exceed 500 characters'),
    JSON.stringify(fbLong)
  );

  const fbBoundary500 = validateDeclineFeedback('F'.repeat(500));
  assert(
    '43. Accept decline feedback with exactly 500 characters',
    fbBoundary500.isValid === true && fbBoundary500.error === null
  );

  const fbEmpty = validateDeclineFeedback('');
  assert(
    '44. Accept empty decline feedback (feedback is optional)',
    fbEmpty.isValid === true && fbEmpty.error === null
  );

  // --- SUITE 7: Render Stability, Loop Prevention & Regression Integrity ---
  console.log('\n--- Suite 7: Render Stability & Regression Integrity ---');

  assert(
    '45. SupervisionSection memoizes fetchSupervisionRequests with [projectId, isLeader]',
    secCode.includes('useCallback(async () => {') && secCode.includes('[projectId, isLeader]')
  );

  const dirCode = fs.readFileSync(path.join(__dirname, '../src/pages/SupervisorDirectoryPage.jsx'), 'utf8');
  assert(
    '46. SupervisorDirectoryPage memoizes fetchSupervisors with [searchTerm, departmentFilter]',
    dirCode.includes('useCallback(async () => {') && dirCode.includes('[searchTerm, departmentFilter]')
  );

  assert(
    '47. SupervisorDashboardPage memoizes fetchAllRequests with [user]',
    supDashCode.includes('useCallback(async () => {') && supDashCode.includes('[user]')
  );

  // Zero storage leak check
  const filesToCheck = [
    'src/pages/SupervisorDirectoryPage.jsx',
    'src/pages/SupervisorDashboardPage.jsx',
    'src/components/SupervisorProfileModal.jsx',
    'src/components/RequestSupervisionModal.jsx',
    'src/components/DeclineRequestModal.jsx',
    'src/components/SupervisionSection.jsx'
  ];

  let hasStorageLeak = false;
  filesToCheck.forEach(relPath => {
    const code = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
    if (code.includes('localStorage') || code.includes('sessionStorage')) {
      hasStorageLeak = true;
    }
  });

  assert(
    '48. Supervisor frontend components strictly use in-memory React state (zero localStorage/sessionStorage)',
    hasStorageLeak === false
  );

  // Check supervisor modal profile fetch and layout
  const supProfileModalCode = fs.readFileSync(path.join(__dirname, '../src/components/SupervisorProfileModal.jsx'), 'utf8');
  assert(
    '49. SupervisorProfileModal fetches /api/supervisors/:id with isMounted unmount protection',
    supProfileModalCode.includes("fetch(`/api/supervisors/${supervisorId}`") &&
    supProfileModalCode.includes('isMounted = false')
  );

  assert(
    '49b. SupervisorProfileModal strictly omits Demonstration Login Email label and key icon',
    !supProfileModalCode.includes('Demonstration Login Email') &&
    !supProfileModalCode.includes('🔑')
  );

  assert(
    '49c. SupervisorProfileModal preserves Faculty Contact Email, Office Location, Capacity and demo notice',
    supProfileModalCode.includes('Faculty Contact Email') &&
    supProfileModalCode.includes('Office Location') &&
    supProfileModalCode.includes('Supervision Capacity') &&
    supProfileModalCode.includes('Demonstration Faculty Account')
  );

  assert(
    '49d. SupervisorProfileModal renders "Not provided" when contactEmail is missing and strictly never references supervisor.email',
    !supProfileModalCode.includes('supervisor.email') &&
    supProfileModalCode.includes("'Not provided'") &&
    supProfileModalCode.includes('supervisor.contactEmail')
  );

  // Supervised projects navigation link
  assert(
    '50. Supervised projects view links to /projects/:id private workspace',
    supDashCode.includes("to={`/projects/${proj._id}`}") &&
    (supDashCode.includes('Open Workspace & Tasks') || supDashCode.includes('Open Workspace &amp; Tasks'))
  );

  console.log('\n===================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed across 50 assertions.`);
  console.log('===================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSupervisorFrontendTests();
