import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('===================================================================');
console.log('ProjectForge: Final Frontend UI Refinement Test Suite');
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

// 1. CHANGE 01 — NAVIGATION BAR
const navbarPath = path.join(__dirname, '../src/components/Navbar.jsx');
const navbarCode = fs.readFileSync(navbarPath, 'utf8');
assert(
  '01. Navbar strictly omits "EE4207 MERN" badge',
  !navbarCode.includes('EE4207 MERN') && !navbarCode.includes('tag-badge')
);
assert(
  '01b. Navbar preserves PF logo, ProjectForge title, and navigation links',
  navbarCode.includes('className="brand-icon">PF</div>') &&
  navbarCode.includes('<span>ProjectForge</span>') &&
  navbarCode.includes('to="/projects"')
);

// 2. CHANGE 02 — OVERVIEW DESCRIPTION
const landingPath = path.join(__dirname, '../src/pages/LandingPage.jsx');
const landingCode = fs.readFileSync(landingPath, 'utf8');
assert(
  '02. LandingPage preserves heading "Centralized Workspaces for Undergraduate Projects"',
  landingCode.includes('Centralized Workspaces for Undergraduate Projects')
);
assert(
  '02b. LandingPage strictly omits descriptive paragraph "ProjectForge unifies student teams..."',
  !landingCode.includes('ProjectForge unifies student teams, milestone deadlines')
);

// 3. CHANGE 03 — SYSTEM HEALTH BUTTON
assert(
  '03. LandingPage strictly omits "Check System Health" button',
  !landingCode.includes('Check System Health') && !landingCode.includes('href="#health"')
);
assert(
  '03b. LandingPage preserves Explore Projects, Register as Student, and Sign In to Account buttons',
  landingCode.includes('Explore Projects') &&
  landingCode.includes('Register as Student') &&
  landingCode.includes('Sign In to Account')
);

// 4. CHANGE 04 — OVERVIEW STATISTICS STRIP
assert(
  '04. LandingPage strictly omits four-item overview statistics strip',
  !landingCode.includes('specs-bar') &&
  !landingCode.includes('spec-item') &&
  !landingCode.includes('Tech Stack') &&
  !landingCode.includes('Development Plan')
);

// 5. CHANGE 05 — IMPLEMENTATION PLAN
assert(
  '05. LandingPage strictly omits "Three-Stage Implementation Plan" section',
  !landingCode.includes('Three-Stage Implementation Plan') &&
  !landingCode.includes('stages-grid') &&
  !landingCode.includes('stage-card')
);

// 6. CHANGE 06 — BACKEND CONNECTIVITY AND SYSTEM HEALTH SECTION
assert(
  '06. LandingPage strictly omits "Backend Connectivity & System Health" section and UI',
  !landingCode.includes('Backend Connectivity & System Health') &&
  !landingCode.includes('health-card') &&
  !landingCode.includes('Ping /api/health') &&
  !landingCode.includes('health-output')
);
assert(
  '06b. LandingPage strictly removes exclusive health check state and effects',
  !landingCode.includes('checkHealth') &&
  !landingCode.includes('healthData') &&
  !landingCode.includes('dbHealthData')
);

// 7. CHANGE 07 — REGISTRATION EMAIL PLACEHOLDER
const registerPath = path.join(__dirname, '../src/pages/RegisterPage.jsx');
const registerCode = fs.readFileSync(registerPath, 'utf8');
assert(
  '07. Student Registration University Email placeholder is exactly "alex.j@ruh.ac.lk"',
  registerCode.includes('placeholder="alex.j@ruh.ac.lk"')
);

// 8. CHANGE 08 — STUDENT REGISTRATION NUMBER
assert(
  '08. Student Registration label is "Student Reg. NO. (Optional)"',
  registerCode.includes('Student Reg. NO. (Optional)') &&
  !registerCode.includes('Student ID / Roll No. (Optional)')
);
assert(
  '08b. Student Registration input placeholder is exactly "EG/20XX/XXXX"',
  registerCode.includes('placeholder="EG/20XX/XXXX"')
);

// 9. CHANGE 09 — LOGIN EMAIL PLACEHOLDER
const loginPath = path.join(__dirname, '../src/pages/LoginPage.jsx');
const loginCode = fs.readFileSync(loginPath, 'utf8');
assert(
  '09. Login University Email Address placeholder is exactly "alex.j@ruh.ac.lk"',
  loginCode.includes('placeholder="alex.j@ruh.ac.lk"')
);

// 10. CHANGE 10 — STUDENT DASHBOARD SYSTEM STATUS CARD
const dashboardPath = path.join(__dirname, '../src/pages/DashboardPage.jsx');
const dashboardCode = fs.readFileSync(dashboardPath, 'utf8');
assert(
  '10. Student Dashboard strictly omits "System Status" card',
  !dashboardCode.includes('status-card') &&
  !dashboardCode.includes('Refresh Health') &&
  !dashboardCode.includes('Express API Health') &&
  !dashboardCode.includes('MongoDB Atlas') &&
  !dashboardCode.includes('Authentication Mode')
);
assert(
  '10b. Student Dashboard strictly removes exclusive health check state and effects',
  !dashboardCode.includes('checkHealth') &&
  !dashboardCode.includes('healthData') &&
  !dashboardCode.includes('dbHealthData')
);
assert(
  '10c. Student Dashboard preserves Student Profile and My Project Workspaces',
  dashboardCode.includes('Student Profile') &&
  dashboardCode.includes('My Project Workspaces') &&
  dashboardCode.includes('+ Propose New Project')
);

// 11. CHANGE 11 — FACULTY SUPERVISOR DIRECTORY BANNER
const dirPath = path.join(__dirname, '../src/pages/SupervisorDirectoryPage.jsx');
const dirCode = fs.readFileSync(dirPath, 'utf8');
assert(
  '11. Faculty Supervisor Directory strictly omits Demonstration Directory banner',
  !dirCode.includes('Demonstration Directory:')
);
assert(
  '11b. Faculty Supervisor Directory preserves heading, search, filters and supervisor cards',
  dirCode.includes('Faculty Supervisor Directory') &&
  dirCode.includes('search-input') &&
  dirCode.includes('Department:') &&
  dirCode.includes('className="project-card"')
);

// Check separate supervisor profile modal notice is preserved
const modalPath = path.join(__dirname, '../src/components/SupervisorProfileModal.jsx');
const modalCode = fs.readFileSync(modalPath, 'utf8');
assert(
  '11c. Separate demonstration account notice within SupervisorProfileModal is preserved',
  modalCode.includes('Demonstration Faculty Account:')
);

// Read-only verification of backend health routes in server
const serverAppPath = path.join(__dirname, '../../server/src/app.js');
const serverAppCode = fs.readFileSync(serverAppPath, 'utf8');
assert(
  'Backend routes verification: GET /api/health and /api/health/db remain mounted',
  serverAppCode.includes("app.get('/api/health'") &&
  serverAppCode.includes("app.get('/api/health/db'")
);

console.log('\n===================================================================');
console.log(`Results: ${passed} passed, ${failed} failed across ${passed + failed} assertions.`);
console.log('===================================================================\n');

if (failed > 0) {
  process.exit(1);
}
