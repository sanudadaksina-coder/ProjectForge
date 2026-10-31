const path = require('path');
const http = require('http');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const SupervisionRequest = require('../src/models/SupervisionRequest');
const { generateToken } = require('../src/utils/token');
const { runMigration, TARGET_SUPERVISORS } = require('../scripts/updateSupervisorProfiles');

// Helper to make HTTP requests to the test server
function makeRequest(port, options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);

    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

const STANDARDIZED_DEPARTMENTS = [
  'Department of Civil and Environmental Engineering',
  'Department of Electrical and Information Engineering',
  'Department of Computer Engineering',
  'Department of Mechanical and Manufacturing Engineering',
  'Department of Marine Engineering and Naval Architecture',
  'Department of Interdisciplinary Studies'
];

async function runProfileTests() {
  console.log('===================================================================');
  console.log('ProjectForge: Faculty Department & Supervisor Profile Test Suite');
  console.log('===================================================================\n');

  // STRICT SAFETY & ISOLATION CHECK:
  // Must NEVER touch real 'projectforge_db'
  const TEST_DB_NAME = 'projectforge_profile_test_db';
  console.log(`[ISOLATION] Connecting to isolated test database: "${TEST_DB_NAME}"...`);

  if (process.env.NODE_ENV !== 'production') {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }

  await mongoose.connect(process.env.MONGO_URI, {
    authSource: 'admin',
    dbName: TEST_DB_NAME
  });

  if (mongoose.connection.name !== TEST_DB_NAME) {
    console.error(`[FATAL] Database isolation failed! Connected to: "${mongoose.connection.name}". Aborting tests.`);
    process.exit(1);
  }
  console.log(`[ISOLATION] Verified active database is "${mongoose.connection.name}". Real data is protected.\n`);

  // Clean test database collections
  await Promise.all([
    User.deleteMany({}),
    Project.deleteMany({}),
    SupervisionRequest.deleteMany({})
  ]);

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`[INFO] Test server listening on ephemeral port ${port}\n`);

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

  try {
    const passwordHash = await bcrypt.hash('TestSecret123!', 10);
    const timestamp = Date.now();

    // =========================================================================
    // SUITE 1: Academic Department Standardization & Legacy Backward Compatibility
    // =========================================================================
    console.log('--- Suite 1: Academic Department Standardization & Legacy Compatibility ---');

    for (let i = 0; i < STANDARDIZED_DEPARTMENTS.length; i++) {
      const dept = STANDARDIZED_DEPARTMENTS[i];
      const student = await User.create({
        name: `Student Dept ${i}`,
        email: `student_dept_${i}_${timestamp}@test.edu`,
        passwordHash,
        accountType: 'student',
        department: dept,
        studentId: `EG/2021/${1000 + i}`,
        semester: 7
      });
      assert(
        `1.${i + 1} User model accepts standardized department "${dept}"`,
        student && student.department === dept,
        `Expected ${dept}, got ${student?.department}`
      );
    }

    // Legacy department compatibility
    const legacyStudent = await User.create({
      name: 'Legacy Student',
      email: `legacy_student_${timestamp}@test.edu`,
      passwordHash,
      accountType: 'student',
      department: 'Computer',
      studentId: `EG/2020/0001`,
      semester: 8
    });
    assert(
      '1.7 User model accepts legacy department values (e.g., "Computer") for backward compatibility',
      legacyStudent && legacyStudent.department === 'Computer'
    );

    // Reject empty department
    let emptyDeptFailed = false;
    try {
      await User.create({
        name: 'Empty Dept Student',
        email: `empty_dept_${timestamp}@test.edu`,
        passwordHash,
        accountType: 'student',
        department: '',
        studentId: `EG/2020/0002`
      });
    } catch (err) {
      emptyDeptFailed = true;
    }
    assert('1.8 User model rejects empty string for department', emptyDeptFailed);

    // =========================================================================
    // SUITE 2: User.contactEmail Validation
    // =========================================================================
    console.log('\n--- Suite 2: User.contactEmail Validation ---');

    const validContactEmails = [
      'Darmaweera@ruh.ac.lk',
      'Sujani@ruh.ac.lk',
      'Priyanvada@ruh.ac.lk',
      'Alvitigala@ruh.ac.lk',
      'professor.test@faculty.ac.lk'
    ];

    for (let i = 0; i < validContactEmails.length; i++) {
      const emailVal = validContactEmails[i];
      const sup = await User.create({
        name: `Prof ${i}`,
        email: `sup_contact_${i}_${timestamp}@university.edu`,
        passwordHash,
        accountType: 'supervisor',
        department: STANDARDIZED_DEPARTMENTS[i % STANDARDIZED_DEPARTMENTS.length],
        contactEmail: emailVal,
        designation: 'Senior Lecturer',
        maxCapacity: 5
      });
      assert(
        `2.${i + 1} User model accepts valid contactEmail: ${emailVal}`,
        sup && sup.contactEmail === emailVal
      );
    }

    // contactEmail is optional (null/undefined accepted)
    const supNoContact = await User.create({
      name: 'Supervisor No Contact Email',
      email: `sup_no_contact_${timestamp}@university.edu`,
      passwordHash,
      accountType: 'supervisor',
      department: STANDARDIZED_DEPARTMENTS[0],
      designation: 'Lecturer',
      maxCapacity: 4
    });
    assert(
      '2.6 User model allows contactEmail to be null/undefined',
      supNoContact && (supNoContact.contactEmail === null || supNoContact.contactEmail === undefined)
    );

    // contactEmail rejects invalid email format
    let invalidEmailFailed = false;
    try {
      await User.create({
        name: 'Invalid Email Supervisor',
        email: `sup_invalid_${timestamp}@university.edu`,
        passwordHash,
        accountType: 'supervisor',
        department: STANDARDIZED_DEPARTMENTS[0],
        contactEmail: 'not-an-email',
        designation: 'Lecturer'
      });
    } catch (err) {
      invalidEmailFailed = true;
    }
    assert('2.7 User model rejects malformed contactEmail format', invalidEmailFailed);

    // =========================================================================
    // SUITE 3: Supervisor Directory & Details API Responses
    // =========================================================================
    console.log('\n--- Suite 3: Supervisor Directory & Details API Responses ---');

    // Generate student auth token for directory access
    const studentToken = generateToken(legacyStudent);
    const studentAuthHeader = { Cookie: `token=${studentToken}` };

    // Test GET /api/supervisors
    const dirRes = await makeRequest(port, {
      path: '/api/supervisors',
      method: 'GET',
      headers: studentAuthHeader
    });
    assert(
      '3.1 GET /api/supervisors returns 200 OK',
      dirRes.statusCode === 200
    );
    assert(
      '3.2 GET /api/supervisors returns supervisors list with contactEmail field',
      Array.isArray(dirRes.body?.data?.supervisors) &&
      dirRes.body.data.supervisors.some(s => s.contactEmail === 'Darmaweera@ruh.ac.lk')
    );

    // Test GET /api/supervisors with department filter
    const filterDept = encodeURIComponent('Department of Electrical and Information Engineering');
    const filterRes = await makeRequest(port, {
      path: `/api/supervisors?department=${filterDept}`,
      method: 'GET',
      headers: studentAuthHeader
    });
    assert(
      '3.3 GET /api/supervisors?department=... filters by exact department name',
      filterRes.statusCode === 200 &&
      filterRes.body?.data?.supervisors?.every(s => s.department === 'Department of Electrical and Information Engineering')
    );

    // Test GET /api/supervisors/:id returns contactEmail
    const targetSup = await User.findOne({ contactEmail: 'Darmaweera@ruh.ac.lk' });
    const detailRes = await makeRequest(port, {
      path: `/api/supervisors/${targetSup._id}`,
      method: 'GET',
      headers: studentAuthHeader
    });
    assert(
      '3.4 GET /api/supervisors/:id returns 200 OK',
      detailRes.statusCode === 200
    );
    assert(
      '3.5 GET /api/supervisors/:id includes contactEmail in supervisor detail payload',
      detailRes.body?.data?.supervisor?.contactEmail === 'Darmaweera@ruh.ac.lk'
    );
    assert(
      '3.6 GET /api/supervisors/:id includes officeLocation, designation, and researchInterests',
      detailRes.body?.data?.supervisor?.designation === 'Senior Lecturer'
    );

    // =========================================================================
    // SUITE 4: Project Details & Supervision Requests Contact Email Population
    // =========================================================================
    console.log('\n--- Suite 4: Project Details & Supervision Requests Contact Email Population ---');

    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create a project assigned to targetSup
    const project = await Project.create({
      title: 'Power Grid Monitoring Project',
      abstract: 'High-frequency telemetry for distribution substations.',
      domain: 'Electrical',
      leader: legacyStudent._id,
      members: [legacyStudent._id],
      maxTeamSize: 4,
      targetCompletionDate: futureDate,
      supervisor: targetSup._id,
      status: 'in_progress',
      recruitmentStatus: 'closed'
    });

    // Test GET /api/projects/:id includes supervisor.contactEmail
    const projRes = await makeRequest(port, {
      path: `/api/projects/${project._id}`,
      method: 'GET',
      headers: studentAuthHeader
    });
    assert(
      '4.1 GET /api/projects/:id returns 200 OK',
      projRes.statusCode === 200
    );
    assert(
      '4.2 GET /api/projects/:id populates supervisor.contactEmail correctly',
      projRes.body?.data?.project?.supervisor?.contactEmail === 'Darmaweera@ruh.ac.lk'
    );

    // Create a supervision request
    const secondStudent = await User.create({
      name: 'Leader Two',
      email: `leader_two_${timestamp}@test.edu`,
      passwordHash,
      accountType: 'student',
      department: 'Department of Electrical and Information Engineering',
      studentId: `EG/2021/2000`,
      semester: 6
    });
    const secondProject = await Project.create({
      title: 'Smart Inverter Hardware Prototype',
      abstract: 'Solar micro-inverter control algorithm implementation.',
      domain: 'Electrical',
      leader: secondStudent._id,
      members: [secondStudent._id],
      maxTeamSize: 4,
      targetCompletionDate: futureDate,
      status: 'proposed',
      recruitmentStatus: 'open'
    });
    const supRequest = await SupervisionRequest.create({
      project: secondProject._id,
      supervisor: targetSup._id,
      status: 'pending',
      proposalMessage: 'We would be honored if you would supervise our solar micro-inverter control project.'
    });

    const secondLeaderToken = generateToken(secondStudent);
    const secondAuthHeader = { Cookie: `token=${secondLeaderToken}` };

    const reqListRes = await makeRequest(port, {
      path: `/api/projects/${secondProject._id}/supervision-requests`,
      method: 'GET',
      headers: secondAuthHeader
    });
    assert(
      '4.3 GET /api/projects/:id/supervision-requests returns 200 OK',
      reqListRes.statusCode === 200
    );
    assert(
      '4.4 GET /api/projects/:id/supervision-requests populates supervisor.contactEmail',
      reqListRes.body?.data?.requests?.[0]?.supervisor?.contactEmail === 'Darmaweera@ruh.ac.lk'
    );

    // =========================================================================
    // SUITE 5: Migration Script Dry Run & Confirmed Execution
    // =========================================================================
    console.log('\n--- Suite 5: Migration Script Dry Run & Execution Verification ---');

    // Remove existing test users to set up clean migration scenario with the 4 demonstration accounts
    await User.deleteMany({ email: { $in: TARGET_SUPERVISORS.map(t => t.loginEmail) } });

    // Seed the 4 demonstration accounts with legacy initial data
    const initialDemoUsers = [];
    for (const target of TARGET_SUPERVISORS) {
      const initialUser = await User.create({
        name: target.recoveryData.name,
        email: target.loginEmail,
        passwordHash,
        accountType: 'supervisor',
        department: target.recoveryData.department,
        designation: target.recoveryData.designation,
        officeLocation: target.recoveryData.officeLocation,
        researchInterests: target.recoveryData.researchInterests,
        maxCapacity: 5
      });
      initialDemoUsers.push(initialUser);
    }
    assert(
      '5.1 Cleanly seeded 4 legacy demo supervisor accounts into isolated test DB',
      initialDemoUsers.length === 4
    );

    // Record original hashes and IDs
    const originalIds = initialDemoUsers.map(u => u._id.toString());
    const originalHashes = initialDemoUsers.map(u => u.passwordHash);

    // Step 5A: Run Dry Run mode
    console.log('\n[TESTING DRY RUN]');
    const dryRunResult = await runMigration({
      confirm: false,
      skipDbCheck: true
    });
    assert('5.2 runMigration returns dryRun: true in default dry run mode', dryRunResult.dryRun === true);
    assert('5.3 runMigration returns success: true in dry run mode', dryRunResult.success === true);
    assert('5.4 runMigration reports 4 items in change summary', dryRunResult.changes?.length === 4);

    // Confirm that NO database writes occurred during dry run
    const usersAfterDryRun = await User.find({ email: { $in: TARGET_SUPERVISORS.map(t => t.loginEmail) } });
    const stillLegacy = usersAfterDryRun.every(u => {
      const match = TARGET_SUPERVISORS.find(t => t.loginEmail === u.email);
      return u.name === match.recoveryData.name &&
             u.department === match.recoveryData.department &&
             (u.contactEmail === null || u.contactEmail === undefined);
    });
    assert(
      '5.5 Zero database writes occurred during dry run (all records retain legacy data)',
      stillLegacy
    );

    // Step 5B: Run Confirmed Migration
    console.log('\n[TESTING CONFIRMED MIGRATION]');
    const confirmedResult = await runMigration({
      confirm: true,
      skipDbCheck: true
    });
    assert('5.6 runMigration returns dryRun: false when confirmed', confirmedResult.dryRun === false);
    assert('5.7 runMigration returns success: true when confirmed', confirmedResult.success === true);

    // Verify all 4 profiles were updated to the exact new Faculty profiles
    const updatedUsers = await User.find({ email: { $in: TARGET_SUPERVISORS.map(t => t.loginEmail) } });

    for (const target of TARGET_SUPERVISORS) {
      const u = updatedUsers.find(user => user.email === target.loginEmail);
      const p = target.profileData;
      assert(
        `5.8 Account "${target.loginEmail}" name updated to "${p.name}"`,
        u && u.name === p.name
      );
      assert(
        `5.9 Account "${target.loginEmail}" department updated to "${p.department}"`,
        u && u.department === p.department
      );
      assert(
        `5.10 Account "${target.loginEmail}" designation updated to "${p.designation}"`,
        u && u.designation === p.designation
      );
      assert(
        `5.11 Account "${target.loginEmail}" contactEmail updated to "${p.contactEmail}"`,
        u && u.contactEmail === p.contactEmail
      );
      assert(
        `5.12 Account "${target.loginEmail}" officeLocation updated to "${p.officeLocation}"`,
        u && u.officeLocation === p.officeLocation
      );
      assert(
        `5.13 Account "${target.loginEmail}" researchInterests updated accurately`,
        u && JSON.stringify(u.researchInterests) === JSON.stringify(p.researchInterests)
      );
    }

    // Verify critical fields were strictly preserved
    const preservedIds = updatedUsers.map(u => u._id.toString());
    const preservedHashes = updatedUsers.map(u => u.passwordHash);
    const preservedAccounts = updatedUsers.every(u => u.accountType === 'supervisor');
    const preservedCapacities = updatedUsers.every(u => u.maxCapacity === 5);

    assert(
      '5.14 All User._id values were strictly preserved during migration',
      JSON.stringify(preservedIds.sort()) === JSON.stringify(originalIds.sort())
    );
    assert(
      '5.15 All passwordHash values were strictly preserved during migration',
      JSON.stringify(preservedHashes.sort()) === JSON.stringify(originalHashes.sort())
    );
    assert(
      '5.16 All accountType values remain "supervisor"',
      preservedAccounts
    );
    assert(
      '5.17 All maxCapacity values were preserved without modification',
      preservedCapacities
    );

    // Step 5C: Test Idempotency
    console.log('\n[TESTING IDEMPOTENCY]');
    const idempotentResult = await runMigration({
      confirm: true,
      skipDbCheck: true
    });
    assert('5.18 Re-running confirmed migration returns success: true', idempotentResult.success === true);
    assert(
      '5.19 Idempotent execution detects all 4 accounts are already updated (isAlreadyUpdated: true)',
      idempotentResult.changes?.every(c => c.isAlreadyUpdated === true)
    );

    // Step 5D: Test Pre-Flight Failure on Missing Supervisor
    console.log('\n[TESTING SAFETY PREFLIGHT ON MISSING ACCOUNT]');
    // Temporarily delete one supervisor
    await User.deleteOne({ email: 'alan.tb@university.edu' });
    let missingSupError = null;
    try {
      await runMigration({
        confirm: true,
        skipDbCheck: true
      });
    } catch (err) {
      missingSupError = err;
    }
    assert(
      '5.20 Migration safely aborts and throws error if any supervisor account is missing',
      missingSupError !== null && missingSupError.message.includes('missing supervisor account')
    );

  } catch (error) {
    console.error('[UNCAUGHT ERROR IN TEST SUITE]:', error);
    failed++;
  } finally {
    server.close();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log('\n[CLEANUP] Disconnected and dropped isolated test database.');
  }

  console.log('\n===================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed across ${passed + failed} assertions.`);
  console.log('===================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runProfileTests().catch(err => {
    console.error('Test suite runner crashed:', err);
    process.exit(1);
  });
}

module.exports = runProfileTests;
