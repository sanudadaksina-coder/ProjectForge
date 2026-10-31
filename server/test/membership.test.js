const path = require('path');
const http = require('http');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const MembershipRequest = require('../src/models/MembershipRequest');
const { generateToken } = require('../src/utils/token');

// Helper to make HTTP requests
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

    const req = http.request(reqOptions, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
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

async function runMembershipTests() {
  console.log('====================================================');
  console.log('ProjectForge Stage 2A Membership & Recruitment Tests');
  console.log('====================================================\n');

  // SAFETY & ISOLATION CHECK:
  // We connect explicitly to 'projectforge_membership_test_db' so real accounts/projects
  // in 'projectforge_db' are NEVER touched, modified, or deleted.
  const TEST_DB_NAME = 'projectforge_membership_test_db';
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

  let leaderUser, studentA, studentB, studentC, supervisorUser;
  let leaderToken, studentAToken, studentBToken, studentCToken, supervisorToken;
  let mainProject, concurrencyProject;

  try {
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    const ts = Date.now();

    leaderUser = await User.create({
      name: 'Leader Alice',
      email: `leader_${ts}@univ.edu`,
      passwordHash,
      accountType: 'student',
      department: 'Computer',
      studentId: `CS-${ts}-01`,
      semester: 6,
      skills: ['React', 'Node.js']
    });

    studentA = await User.create({
      name: 'Student Bob',
      email: `bob_${ts}@univ.edu`,
      passwordHash,
      accountType: 'student',
      department: 'Electrical',
      studentId: `EE-${ts}-02`,
      semester: 6,
      skills: ['Embedded C', 'IoT']
    });

    studentB = await User.create({
      name: 'Student Charlie',
      email: `charlie_${ts}@univ.edu`,
      passwordHash,
      accountType: 'student',
      department: 'Computer',
      studentId: `CS-${ts}-03`,
      semester: 6,
      skills: ['MongoDB', 'Express']
    });

    studentC = await User.create({
      name: 'Student Dana',
      email: `dana_${ts}@univ.edu`,
      passwordHash,
      accountType: 'student',
      department: 'Mechanical',
      studentId: `ME-${ts}-04`,
      semester: 8,
      skills: ['CAD', 'Robotics']
    });

    supervisorUser = await User.create({
      name: 'Prof Supervisor',
      email: `prof_${ts}@univ.edu`,
      passwordHash,
      accountType: 'supervisor',
      department: 'Computer',
      facultyTitle: 'Associate Professor',
      officeLocation: 'Room 401',
      maxSupervisions: 5
    });

    leaderToken = generateToken(leaderUser);
    studentAToken = generateToken(studentA);
    studentBToken = generateToken(studentB);
    studentCToken = generateToken(studentC);
    supervisorToken = generateToken(supervisorUser);

    mainProject = await Project.create({
      title: 'Smart Microgrid Testbed',
      abstract: 'An experimental testbed for evaluating intelligent renewable power distribution.',
      domain: 'Electrical',
      tags: ['SmartGrid', 'IoT'],
      leader: leaderUser._id,
      members: [leaderUser._id],
      maxTeamSize: 3,
      targetCompletionDate: new Date(Date.now() + 86400000 * 90),
      status: 'proposed',
      recruitmentStatus: 'open'
    });

    concurrencyProject = await Project.create({
      title: 'Autonomous Drone Swarm',
      abstract: 'Cooperative multi-agent quadcopter control algorithms for search and rescue operations.',
      domain: 'Computer',
      tags: ['Drones', 'Robotics'],
      leader: leaderUser._id,
      members: [leaderUser._id],
      maxTeamSize: 2, // 1 slot open
      targetCompletionDate: new Date(Date.now() + 86400000 * 90),
      status: 'proposed',
      recruitmentStatus: 'open'
    });

    console.log('[SETUP] Seeded isolated test users and projects.\n');

    // TEST 1: Unauthenticated join request rejected with 401
    const unauthRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'POST'
    }, { statement: 'I would love to contribute to this microgrid project!' });

    assert(
      '01. Unauthenticated join request rejected with HTTP 401 Unauthorized',
      unauthRes.statusCode === 401 && unauthRes.body?.success === false,
      `Status: ${unauthRes.statusCode}`
    );

    // TEST 2: Supervisor join request rejected with 403
    const supervisorRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'POST',
      headers: { Cookie: `token=${supervisorToken}` }
    }, { statement: 'I would love to contribute to this microgrid project!' });

    assert(
      '02. Supervisor join request rejected with HTTP 403 Forbidden',
      supervisorRes.statusCode === 403 && supervisorRes.body?.success === false,
      `Status: ${supervisorRes.statusCode}`
    );

    // TEST 3: Leader applying to own project rejected with 400
    const ownProjectRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'POST',
      headers: { Cookie: `token=${leaderToken}` }
    }, { statement: 'I would love to contribute to this microgrid project!' });

    assert(
      '03. Project leader applying to own project rejected with HTTP 400 Bad Request',
      ownProjectRes.statusCode === 400 && ownProjectRes.body?.success === false,
      `Status: ${ownProjectRes.statusCode}`
    );

    // TEST 4: Statement too short (< 10 chars) rejected with 422
    const shortStmtRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'POST',
      headers: { Cookie: `token=${studentAToken}` }
    }, { statement: 'Too short' });

    assert(
      '04. Statement < 10 characters rejected with HTTP 422 Unprocessable Entity',
      shortStmtRes.statusCode === 422 && shortStmtRes.body?.success === false,
      `Status: ${shortStmtRes.statusCode}`
    );

    // TEST 5: Statement too long (> 300 chars) rejected with 422
    const longStmtRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'POST',
      headers: { Cookie: `token=${studentAToken}` }
    }, { statement: 'A'.repeat(301) });

    assert(
      '05. Statement > 300 characters rejected with HTTP 422 Unprocessable Entity',
      longStmtRes.statusCode === 422 && longStmtRes.body?.success === false,
      `Status: ${longStmtRes.statusCode}`
    );

    // TEST 6: Valid join request by studentA succeeds with 201
    const validStmt = 'I have completed coursework in Embedded Systems and built IoT sensor nodes.';
    const validJoinRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'POST',
      headers: { Cookie: `token=${studentAToken}` }
    }, { statement: validStmt });

    assert(
      '06. Valid join request creates pending MembershipRequest with HTTP 201 Created',
      validJoinRes.statusCode === 201 &&
        validJoinRes.body?.success === true &&
        validJoinRes.body?.data?.request?.status === 'pending' &&
        validJoinRes.body?.data?.request?.statement === validStmt,
      `Status: ${validJoinRes.statusCode}, body: ${JSON.stringify(validJoinRes.body)}`
    );

    const firstRequestId = validJoinRes.body?.data?.request?._id;

    // TEST 7: Duplicate pending request rejected with 409 Conflict
    const dupRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'POST',
      headers: { Cookie: `token=${studentAToken}` }
    }, { statement: 'Submitting duplicate request for the same project.' });

    assert(
      '07. Duplicate pending request rejected with HTTP 409 Conflict',
      dupRes.statusCode === 409 && dupRes.body?.success === false,
      `Status: ${dupRes.statusCode}`
    );

    // TEST 8: Non-applicant student cancelling another student's request rejected with 403
    const unauthorizedCancelRes = await makeRequest(port, {
      path: `/api/membership-requests/${firstRequestId}/cancel`,
      method: 'PATCH',
      headers: { Cookie: `token=${studentBToken}` }
    });

    assert(
      '08. Non-applicant cancelling another student request rejected with HTTP 403 Forbidden',
      unauthorizedCancelRes.statusCode === 403 && unauthorizedCancelRes.body?.success === false,
      `Status: ${unauthorizedCancelRes.statusCode}`
    );

    // TEST 9: Student cancels their own pending request successfully with 200
    const cancelRes = await makeRequest(port, {
      path: `/api/membership-requests/${firstRequestId}/cancel`,
      method: 'PATCH',
      headers: { Cookie: `token=${studentAToken}` }
    });

    assert(
      '09. Student successfully cancels their own pending request (HTTP 200 OK)',
      cancelRes.statusCode === 200 &&
        cancelRes.body?.success === true &&
        cancelRes.body?.data?.status === 'cancelled',
      `Status: ${cancelRes.statusCode}`
    );

    // TEST 10: Student re-submits join request after cancellation (201 Created)
    const reSubmitRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'POST',
      headers: { Cookie: `token=${studentAToken}` }
    }, { statement: 'Re-applying with updated hardware portfolio details.' });

    assert(
      '10. Student successfully re-applies after cancellation with HTTP 201 Created',
      reSubmitRes.statusCode === 201 && reSubmitRes.body?.data?.request?.status === 'pending',
      `Status: ${reSubmitRes.statusCode}`
    );

    const activeRequestId = reSubmitRes.body?.data?.request?._id;

    // TEST 10b: Unauthenticated GET /api/membership-requests/mine rejected with 401
    const unauthMineRes = await makeRequest(port, {
      path: '/api/membership-requests/mine',
      method: 'GET'
    });
    assert(
      '10b. Unauthenticated GET /api/membership-requests/mine rejected with HTTP 401 Unauthorized',
      unauthMineRes.statusCode === 401 && unauthMineRes.body?.success === false,
      `Status: ${unauthMineRes.statusCode}`
    );

    // TEST 10c: StudentA retrieves their own join requests via GET /api/membership-requests/mine
    const studentAMineRes = await makeRequest(port, {
      path: `/api/membership-requests/mine?projectId=${mainProject._id}`,
      method: 'GET',
      headers: { Cookie: `token=${studentAToken}` }
    });
    assert(
      '10c. Authenticated student retrieves their own requests (HTTP 200 OK)',
      studentAMineRes.statusCode === 200 &&
        Array.isArray(studentAMineRes.body?.data?.requests) &&
        studentAMineRes.body.data.requests.some(r => r._id === activeRequestId && r.status === 'pending'),
      `Status: ${studentAMineRes.statusCode}, requests count: ${studentAMineRes.body?.data?.requests?.length}`
    );

    // TEST 10d: Privacy isolation: StudentB calling /mine cannot see StudentA's pending request
    const studentBMineRes = await makeRequest(port, {
      path: `/api/membership-requests/mine?projectId=${mainProject._id}`,
      method: 'GET',
      headers: { Cookie: `token=${studentBToken}` }
    });
    assert(
      '10d. Privacy isolation: StudentB calling /mine never sees StudentA requests',
      studentBMineRes.statusCode === 200 &&
        Array.isArray(studentBMineRes.body?.data?.requests) &&
        studentBMineRes.body.data.requests.length === 0,
      `StudentB found ${studentBMineRes.body?.data?.requests?.length} requests`
    );

    // TEST 11: Non-leader listing project join requests rejected with 403
    const nonLeaderListRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'GET',
      headers: { Cookie: `token=${studentBToken}` }
    });

    assert(
      '11. Non-leader viewing join requests rejected with HTTP 403 Forbidden',
      nonLeaderListRes.statusCode === 403 && nonLeaderListRes.body?.success === false,
      `Status: ${nonLeaderListRes.statusCode}`
    );

    // TEST 12: Leader listing join requests succeeds with 200 and populated student info
    const leaderListRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'GET',
      headers: { Cookie: `token=${leaderToken}` }
    });

    const requestsList = leaderListRes.body?.data?.requests;
    assert(
      '12. Project Leader lists join requests with populated student details (HTTP 200 OK)',
      leaderListRes.statusCode === 200 &&
        Array.isArray(requestsList) &&
        requestsList.length >= 1 &&
        requestsList[0].student?.email === studentA.email,
      `Status: ${leaderListRes.statusCode}, list count: ${requestsList?.length}`
    );

    // TEST 13: Non-leader approval rejected with 403
    const nonLeaderApproveRes = await makeRequest(port, {
      path: `/api/membership-requests/${activeRequestId}/approve`,
      method: 'PATCH',
      headers: { Cookie: `token=${studentBToken}` }
    });

    assert(
      '13. Non-leader approval attempt rejected with HTTP 403 Forbidden',
      nonLeaderApproveRes.statusCode === 403 && nonLeaderApproveRes.body?.success === false,
      `Status: ${nonLeaderApproveRes.statusCode}`
    );

    // TEST 14: Non-leader rejection rejected with 403
    const nonLeaderRejectRes = await makeRequest(port, {
      path: `/api/membership-requests/${activeRequestId}/reject`,
      method: 'PATCH',
      headers: { Cookie: `token=${studentBToken}` }
    });

    assert(
      '14. Non-leader rejection attempt rejected with HTTP 403 Forbidden',
      nonLeaderRejectRes.statusCode === 403 && nonLeaderRejectRes.body?.success === false,
      `Status: ${nonLeaderRejectRes.statusCode}`
    );

    // TEST 15: Leader rejects join request with 200
    const leaderRejectRes = await makeRequest(port, {
      path: `/api/membership-requests/${activeRequestId}/reject`,
      method: 'PATCH',
      headers: { Cookie: `token=${leaderToken}` }
    });

    assert(
      '15. Project Leader rejects join request successfully (HTTP 200 OK)',
      leaderRejectRes.statusCode === 200 &&
        leaderRejectRes.body?.success === true &&
        leaderRejectRes.body?.data?.status === 'rejected',
      `Status: ${leaderRejectRes.statusCode}`
    );

    // TEST 16: Attempting to approve an already-rejected request fails with 400
    const approveRejectedRes = await makeRequest(port, {
      path: `/api/membership-requests/${activeRequestId}/approve`,
      method: 'PATCH',
      headers: { Cookie: `token=${leaderToken}` }
    });

    assert(
      '16. Attempting to approve a non-pending request rejected with HTTP 400 Bad Request',
      approveRejectedRes.statusCode === 400 && approveRejectedRes.body?.success === false,
      `Status: ${approveRejectedRes.statusCode}`
    );

    // TEST 17: StudentA applies again, Leader approves -> StudentA added to members
    const thirdApplyRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'POST',
      headers: { Cookie: `token=${studentAToken}` }
    }, { statement: 'Third application with updated schedule and commitment.' });

    const approvedRequestId = thirdApplyRes.body?.data?.request?._id;

    const leaderApproveRes = await makeRequest(port, {
      path: `/api/membership-requests/${approvedRequestId}/approve`,
      method: 'PATCH',
      headers: { Cookie: `token=${leaderToken}` }
    });

    assert(
      '17. Project Leader approves join request (HTTP 200 OK, member added)',
      leaderApproveRes.statusCode === 200 &&
        leaderApproveRes.body?.success === true &&
        leaderApproveRes.body?.data?.status === 'approved' &&
        leaderApproveRes.body?.data?.project?.membersCount === 2 &&
        leaderApproveRes.body?.data?.project?.recruitmentStatus === 'open',
      `Status: ${leaderApproveRes.statusCode}, body: ${JSON.stringify(leaderApproveRes.body)}`
    );

    // TEST 18: StudentA (now an approved member) applying again rejected with 409
    const memberApplyRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'POST',
      headers: { Cookie: `token=${studentAToken}` }
    }, { statement: 'Trying to apply even though I am already a team member.' });

    assert(
      '18. Already-member join application rejected with HTTP 409 Conflict',
      memberApplyRes.statusCode === 409 && memberApplyRes.body?.success === false,
      `Status: ${memberApplyRes.statusCode}`
    );

    // TEST 19: Full-team automatic closure:
    // Add StudentB to mainProject (capacity 3). Leader + StudentA + StudentB = 3 (maxTeamSize = 3)
    const studentBJoinRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'POST',
      headers: { Cookie: `token=${studentBToken}` }
    }, { statement: 'I am a backend specialist with MongoDB and Express experience.' });

    const studentBReqId = studentBJoinRes.body?.data?.request?._id;

    const fillTeamRes = await makeRequest(port, {
      path: `/api/membership-requests/${studentBReqId}/approve`,
      method: 'PATCH',
      headers: { Cookie: `token=${leaderToken}` }
    });

    assert(
      '19. Team reaching maxTeamSize automatically sets recruitmentStatus to closed',
      fillTeamRes.statusCode === 200 &&
        fillTeamRes.body?.data?.project?.membersCount === 3 &&
        fillTeamRes.body?.data?.project?.recruitmentStatus === 'closed',
      `Status: ${fillTeamRes.statusCode}, body: ${JSON.stringify(fillTeamRes.body)}`
    );

    // TEST 20: Application to closed/full project rejected with 400
    const fullApplyRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/join-requests`,
      method: 'POST',
      headers: { Cookie: `token=${studentCToken}` }
    }, { statement: 'Applying to a project that is already full and closed.' });

    assert(
      '20. Application to closed/full project rejected with HTTP 400 Bad Request',
      fullApplyRes.statusCode === 400 && fullApplyRes.body?.success === false,
      `Status: ${fullApplyRes.statusCode}`
    );

    // TEST 21: Prevention of overcapacity under simultaneous approvals (CONCURRENCY SAFETY)
    // On concurrencyProject (maxTeamSize = 2, leader = 1 member, 1 slot left):
    // StudentB and StudentC apply concurrently
    const concApplyB = await makeRequest(port, {
      path: `/api/projects/${concurrencyProject._id}/join-requests`,
      method: 'POST',
      headers: { Cookie: `token=${studentBToken}` }
    }, { statement: 'Applying for the single open spot on the Drone Swarm project.' });

    const concApplyC = await makeRequest(port, {
      path: `/api/projects/${concurrencyProject._id}/join-requests`,
      method: 'POST',
      headers: { Cookie: `token=${studentCToken}` }
    }, { statement: 'Also applying for the single open spot on the Drone Swarm project.' });

    const reqBId = concApplyB.body?.data?.request?._id;
    const reqCId = concApplyC.body?.data?.request?._id;

    // Execute simultaneous approval requests in parallel
    const [concApprove1, concApprove2] = await Promise.all([
      makeRequest(port, {
        path: `/api/membership-requests/${reqBId}/approve`,
        method: 'PATCH',
        headers: { Cookie: `token=${leaderToken}` }
      }),
      makeRequest(port, {
        path: `/api/membership-requests/${reqCId}/approve`,
        method: 'PATCH',
        headers: { Cookie: `token=${leaderToken}` }
      })
    ]);

    const statusCodes = [concApprove1.statusCode, concApprove2.statusCode].sort();
    const exactlyOneSuccess = statusCodes[0] === 200 && statusCodes[1] === 400;

    assert(
      '21. Simultaneous approvals safely prevent overcapacity (1 succeeded, 1 rejected)',
      exactlyOneSuccess,
      `StatusCodes: ${concApprove1.statusCode}, ${concApprove2.statusCode}`
    );

    // Verify in database that members.length is strictly 2 and recruitmentStatus is closed
    const verifyConcProj = await Project.findById(concurrencyProject._id);
    assert(
      '22. Database verification: concurrencyProject membersCount is exactly 2 (never exceeded)',
      verifyConcProj.members.length === 2 && verifyConcProj.recruitmentStatus === 'closed',
      `Members count: ${verifyConcProj.members.length}, recruitment: ${verifyConcProj.recruitmentStatus}`
    );

    // TEST 22: Non-leader member removal attempt rejected with 403
    const nonLeaderRemoveRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/members/${studentB._id}`,
      method: 'DELETE',
      headers: { Cookie: `token=${studentAToken}` }
    });

    assert(
      '23. Non-leader member removal rejected with HTTP 403 Forbidden',
      nonLeaderRemoveRes.statusCode === 403 && nonLeaderRemoveRes.body?.success === false,
      `Status: ${nonLeaderRemoveRes.statusCode}`
    );

    // TEST 23: Leader attempting to remove themselves rejected with 400
    const leaderSelfRemoveRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/members/${leaderUser._id}`,
      method: 'DELETE',
      headers: { Cookie: `token=${leaderToken}` }
    });

    assert(
      '24. Leader attempting to remove themselves rejected with HTTP 400 Bad Request',
      leaderSelfRemoveRes.statusCode === 400 &&
        leaderSelfRemoveRes.body?.message === 'Leader cannot be removed from project.',
      `Status: ${leaderSelfRemoveRes.statusCode}, message: ${leaderSelfRemoveRes.body?.message}`
    );

    // TEST 24: Removing non-member returns 404
    const removeNonMemberRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/members/${studentC._id}`,
      method: 'DELETE',
      headers: { Cookie: `token=${leaderToken}` }
    });

    assert(
      '25. Removing user not in members roster returns HTTP 404 Not Found',
      removeNonMemberRes.statusCode === 404 && removeNonMemberRes.body?.success === false,
      `Status: ${removeNonMemberRes.statusCode}`
    );

    // TEST 25: Leader removes approved member (StudentB) -> recruitment automatically re-opens!
    const leaderRemoveRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}/members/${studentB._id}`,
      method: 'DELETE',
      headers: { Cookie: `token=${leaderToken}` }
    });

    assert(
      '26. Leader removes member successfully; recruitment automatically re-opens (HTTP 200 OK)',
      leaderRemoveRes.statusCode === 200 &&
        leaderRemoveRes.body?.success === true &&
        leaderRemoveRes.body?.data?.membersCount === 2 &&
        leaderRemoveRes.body?.data?.recruitmentStatus === 'open',
      `Status: ${leaderRemoveRes.statusCode}, body: ${JSON.stringify(leaderRemoveRes.body)}`
    );

    // TEST 26: Protected fields remain protected on project PATCH
    const patchProtectedRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}`,
      method: 'PATCH',
      headers: { Cookie: `token=${leaderToken}` }
    }, { members: [studentC._id] });

    assert(
      '27. Project PATCH cannot directly modify members field (HTTP 422 Unprocessable Entity)',
      patchProtectedRes.statusCode === 422 && patchProtectedRes.body?.success === false,
      `Status: ${patchProtectedRes.statusCode}`
    );

    // TEST 27: Project deletion cascades and cleans up child membership requests
    const deleteProjRes = await makeRequest(port, {
      path: `/api/projects/${mainProject._id}`,
      method: 'DELETE',
      headers: { Cookie: `token=${leaderToken}` }
    });

    const remainingRequests = await MembershipRequest.find({ project: mainProject._id });
    assert(
      '28. Project deletion cascades and removes child MembershipRequest documents from MongoDB',
      deleteProjRes.statusCode === 200 && remainingRequests.length === 0,
      `Remaining requests count: ${remainingRequests.length}`
    );

  } finally {
    // CLEANUP: Drop isolated test database to leave zero footprint
    try {
      if (mongoose.connection.name === TEST_DB_NAME) {
        console.log(`\n[CLEANUP] Dropping isolated test database "${TEST_DB_NAME}"...`);
        await mongoose.connection.db.dropDatabase();
        console.log(`[CLEANUP] Test database "${TEST_DB_NAME}" dropped successfully.`);
      }
    } catch (cleanErr) {
      console.warn('[CLEANUP WARNING] Failed to drop test database:', cleanErr.message);
    }

    server.close();
    await mongoose.disconnect();
    console.log('[CLEANUP] Closed test server and disconnected database.\n');

    console.log('----------------------------------------------------');
    console.log(`Total Membership Tests Passed: ${passed}`);
    console.log(`Total Membership Tests Failed: ${failed}`);
    console.log('----------------------------------------------------\n');

    if (failed > 0) process.exit(1);
    else process.exit(0);
  }
}

runMembershipTests().catch(err => {
  console.error('[FATAL TEST SUITE ERROR]:', err);
  process.exit(1);
});
