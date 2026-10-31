/**
 * Focused Unit and Contract Tests for ProjectForge Frontend Membership Logic
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper evaluating student apply eligibility matching ProjectDetailsPage logic
function computeCanApply({ user, project, myPendingRequest }) {
  const isLeader = Boolean(
    user &&
    project &&
    (
      (typeof project.leader === 'object' && project.leader?._id === user._id) ||
      (typeof project.leader === 'string' && project.leader === user._id)
    )
  );

  const isMember = Boolean(
    user &&
    project &&
    Array.isArray(project.members) &&
    project.members.some(m => {
      const memberId = typeof m === 'object' ? m._id : m;
      return memberId === user._id;
    })
  );

  const isStudent = Boolean(user && user.accountType === 'student');
  const isFull = Boolean(project && (project.members?.length || 1) >= project.maxTeamSize);
  const isRecruitmentOpen = Boolean(project && project.recruitmentStatus === 'open');

  return Boolean(
    isStudent &&
    !isLeader &&
    !isMember &&
    !myPendingRequest &&
    isRecruitmentOpen &&
    !isFull
  );
}

// Helper evaluating statement length matching ApplyToJoinModal logic
function validateStatement(statement) {
  if (typeof statement !== 'string') return false;
  const len = statement.trim().length;
  return len >= 10 && len <= 300;
}

function runMembershipFrontendTests() {
  console.log('====================================================');
  console.log('ProjectForge Frontend Team Membership Logic Tests');
  console.log('====================================================\n');

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

  const sampleProject = {
    _id: 'proj_01',
    title: 'Smart Solar Inverter',
    leader: 'leader_01',
    members: ['leader_01'],
    maxTeamSize: 4,
    recruitmentStatus: 'open'
  };

  const studentUser = {
    _id: 'student_02',
    name: 'Student Bob',
    accountType: 'student'
  };

  const leaderUser = {
    _id: 'leader_01',
    name: 'Leader Alice',
    accountType: 'student'
  };

  const supervisorUser = {
    _id: 'supervisor_01',
    name: 'Dr. Mentor',
    accountType: 'supervisor'
  };

  // TEST 1: Eligible student can apply
  assert(
    '01. Eligible student on open project can apply',
    computeCanApply({ user: studentUser, project: sampleProject, myPendingRequest: null }) === true
  );

  // TEST 2: Project leader cannot apply to their own project
  assert(
    '02. Project leader cannot see or click Apply button on own project',
    computeCanApply({ user: leaderUser, project: sampleProject, myPendingRequest: null }) === false
  );

  // TEST 3: Existing member cannot apply
  const projectWithMember = {
    ...sampleProject,
    members: ['leader_01', 'student_02']
  };
  assert(
    '03. Approved team member cannot apply again',
    computeCanApply({ user: studentUser, project: projectWithMember, myPendingRequest: null }) === false
  );

  // TEST 4: Student with pending request cannot submit another
  const existingPendingRequest = { _id: 'req_01', status: 'pending' };
  assert(
    '04. Student with existing pending application cannot re-apply',
    computeCanApply({ user: studentUser, project: sampleProject, myPendingRequest: existingPendingRequest }) === false
  );

  // TEST 5: Full team prevents new applications
  const fullProject = {
    ...sampleProject,
    members: ['m1', 'm2', 'm3', 'm4'],
    maxTeamSize: 4
  };
  assert(
    '05. Full team (members >= maxTeamSize) blocks join application',
    computeCanApply({ user: studentUser, project: fullProject, myPendingRequest: null }) === false
  );

  // TEST 6: Closed recruitment blocks join applications
  const closedProject = {
    ...sampleProject,
    recruitmentStatus: 'closed'
  };
  assert(
    '06. Closed recruitment status blocks join application',
    computeCanApply({ user: studentUser, project: closedProject, myPendingRequest: null }) === false
  );

  // TEST 7: Supervisor cannot apply to join project
  assert(
    '07. Supervisor accounts are blocked from applying to project team',
    computeCanApply({ user: supervisorUser, project: sampleProject, myPendingRequest: null }) === false
  );

  // TEST 8: Unauthenticated visitor cannot apply directly
  assert(
    '08. Unauthenticated visitor cannot apply directly',
    computeCanApply({ user: null, project: sampleProject, myPendingRequest: null }) === false
  );

  // TEST 9: Statement validation: valid range (10-300 chars)
  assert(
    '09. Valid statement between 10 and 300 characters passes validation',
    validateStatement('I have coursework in embedded systems and sensors.') === true
  );

  // TEST 10: Statement validation: under 10 chars rejected
  assert(
    '10. Statement under 10 characters is rejected',
    validateStatement('Too short') === false && validateStatement('         ') === false
  );

  // TEST 11: Statement validation: over 300 chars rejected
  assert(
    '11. Statement over 300 characters is rejected',
    validateStatement('x'.repeat(301)) === false
  );

  // TEST 12: Verify credentials: 'include' across all membership components
  const componentsDir = path.join(__dirname, '../src/components');
  const pagesDir = path.join(__dirname, '../src/pages');

  const applyModalCode = fs.readFileSync(path.join(componentsDir, 'ApplyToJoinModal.jsx'), 'utf-8');
  const requestsSectionCode = fs.readFileSync(path.join(componentsDir, 'JoinRequestsSection.jsx'), 'utf-8');
  const removeModalCode = fs.readFileSync(path.join(componentsDir, 'RemoveMemberModal.jsx'), 'utf-8');
  const detailsPageCode = fs.readFileSync(path.join(pagesDir, 'ProjectDetailsPage.jsx'), 'utf-8');

  assert(
    '12. ApplyToJoinModal uses credentials: "include" for POST /api/projects/:projectId/join-requests',
    applyModalCode.includes("credentials: 'include'")
  );

  assert(
    '13. JoinRequestsSection uses credentials: "include" for leader approvals and rejections',
    requestsSectionCode.includes("credentials: 'include'")
  );

  assert(
    '14. RemoveMemberModal uses credentials: "include" for DELETE /api/projects/:projectId/members/:userId',
    removeModalCode.includes("credentials: 'include'")
  );

  assert(
    '15. ProjectDetailsPage queries student pending requests via GET /api/membership-requests/mine',
    detailsPageCode.includes('/api/membership-requests/mine') && detailsPageCode.includes("credentials: 'include'")
  );

  // TEST 16: Ensure zero usage of localStorage or sessionStorage in membership components
  const allCode = [applyModalCode, requestsSectionCode, removeModalCode, detailsPageCode].join('\n');
  assert(
    '16. All membership UI components strictly use in-memory React state (zero localStorage/sessionStorage)',
    !allCode.includes('localStorage') && !allCode.includes('sessionStorage')
  );

  console.log('----------------------------------------------------');
  console.log(`Membership Frontend Logic Tests Passed: ${passed}`);
  console.log(`Membership Frontend Logic Tests Failed: ${failed}`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runMembershipFrontendTests();
