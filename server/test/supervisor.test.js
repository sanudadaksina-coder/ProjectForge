const path = require('path');
const http = require('http');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const Task = require('../src/models/Task');
const MembershipRequest = require('../src/models/MembershipRequest');
const SupervisionRequest = require('../src/models/SupervisionRequest');
const { generateToken } = require('../src/utils/token');

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

async function runSupervisorTests() {
  console.log('===================================================================');
  console.log('ProjectForge Stage 3A-A: Supervisor Management Backend Test Suite');
  console.log('===================================================================\n');

  // SAFETY & ISOLATION CHECK:
  // Explicitly connect to 'projectforge_supervisor_test_db' so real records in 'projectforge_db'
  // are NEVER touched, modified, or deleted.
  const TEST_DB_NAME = 'projectforge_supervisor_test_db';
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
    Task.deleteMany({}),
    MembershipRequest.deleteMany({}),
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
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const timestamp = Date.now();

    // 1. Seed test users
    console.log('[SETUP] Seeding test users (Leader, Student2, SupervisorA, SupervisorB)...');

    const leaderUser = await User.create({
      name: 'Leader Alex',
      email: `leader_${timestamp}@university.edu`,
      passwordHash,
      accountType: 'student',
      department: 'Computer',
      studentId: `CS-${timestamp}-1`,
      semester: 6,
      skills: ['React', 'Node.js']
    });

    const otherStudent = await User.create({
      name: 'Student Bob',
      email: `bob_${timestamp}@university.edu`,
      passwordHash,
      accountType: 'student',
      department: 'Computer',
      studentId: `CS-${timestamp}-2`,
      semester: 6
    });

    const supervisorA = await User.create({
      name: 'Dr. Sarah Chen',
      email: `sarah.chen_${timestamp}@university.edu`,
      passwordHash,
      accountType: 'supervisor',
      department: 'Computer',
      designation: 'Associate Professor',
      researchInterests: ['Embedded Systems', 'IoT', 'Edge AI'],
      officeLocation: 'Tech Tower 402',
      maxCapacity: 2 // Low capacity to test limits easily
    });

    const supervisorB = await User.create({
      name: 'Prof. Marcus Vance',
      email: `marcus.vance_${timestamp}@university.edu`,
      passwordHash,
      accountType: 'supervisor',
      department: 'Electrical',
      designation: 'Professor',
      researchInterests: ['Power Electronics', 'Smart Grids'],
      officeLocation: 'Energy Sciences 210',
      maxCapacity: 4
    });

    const leaderToken = generateToken(leaderUser);
    const otherStudentToken = generateToken(otherStudent);
    const supervisorAToken = generateToken(supervisorA);
    const supervisorBToken = generateToken(supervisorB);

    const leaderHeaders = { Cookie: `token=${leaderToken}` };
    const otherStudentHeaders = { Cookie: `token=${otherStudentToken}` };
    const supervisorAHeaders = { Cookie: `token=${supervisorAToken}` };
    const supervisorBHeaders = { Cookie: `token=${supervisorBToken}` };

    // 2. Seed projects
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const testProject1 = await Project.create({
      title: 'IoT Smart Campus Grid',
      abstract: 'An experimental sensor mesh to track and optimize power consumption across campus.',
      domain: 'Computer',
      leader: leaderUser._id,
      members: [leaderUser._id],
      maxTeamSize: 4,
      targetCompletionDate: futureDate,
      status: 'proposed',
      recruitmentStatus: 'open'
    });

    const testProject2 = await Project.create({
      title: 'Solar Inverter Monitoring',
      abstract: 'Telemetry data logger for rooftop photovoltaic arrays on university facilities.',
      domain: 'Electrical',
      leader: leaderUser._id,
      members: [leaderUser._id],
      maxTeamSize: 4,
      targetCompletionDate: futureDate,
      status: 'proposed',
      recruitmentStatus: 'open'
    });

    console.log('[SETUP] Seed completed successfully.\n');

    // -------------------------------------------------------------
    // TEST 1: Directory listing
    // -------------------------------------------------------------
    const listRes = await makeRequest(port, {
      path: '/api/supervisors',
      method: 'GET',
      headers: leaderHeaders
    });

    assert(
      '01. GET /api/supervisors returns 200 and list of faculty supervisors',
      listRes.statusCode === 200 &&
      listRes.body?.success === true &&
      Array.isArray(listRes.body?.data?.supervisors) &&
      listRes.body.data.supervisors.length >= 2,
      `Status: ${listRes.statusCode}, body: ${JSON.stringify(listRes.body)}`
    );

    // -------------------------------------------------------------
    // TEST 2: Search by research interest
    // -------------------------------------------------------------
    const searchRes = await makeRequest(port, {
      path: '/api/supervisors?search=IoT',
      method: 'GET',
      headers: leaderHeaders
    });

    assert(
      '02. Search by research interest returns matching supervisors',
      searchRes.statusCode === 200 &&
      searchRes.body?.data?.supervisors.some(s => s.name === 'Dr. Sarah Chen') &&
      !searchRes.body?.data?.supervisors.some(s => s.name === 'Prof. Marcus Vance'),
      `Status: ${searchRes.statusCode}, result: ${JSON.stringify(searchRes.body?.data)}`
    );

    // -------------------------------------------------------------
    // TEST 3: Department filtering
    // -------------------------------------------------------------
    const deptRes = await makeRequest(port, {
      path: '/api/supervisors?department=Electrical',
      method: 'GET',
      headers: leaderHeaders
    });

    assert(
      '03. Department filtering returns only supervisors matching requested department',
      deptRes.statusCode === 200 &&
      deptRes.body?.data?.supervisors.every(s => s.department === 'Electrical') &&
      deptRes.body?.data?.supervisors.some(s => s.name === 'Prof. Marcus Vance'),
      `Status: ${deptRes.statusCode}, result: ${JSON.stringify(deptRes.body?.data)}`
    );

    // -------------------------------------------------------------
    // TEST 4: Supervisor detail retrieval
    // -------------------------------------------------------------
    const detailRes = await makeRequest(port, {
      path: `/api/supervisors/${supervisorA._id}`,
      method: 'GET',
      headers: leaderHeaders
    });

    assert(
      '04. GET /api/supervisors/:id returns detailed profile and active project workload',
      detailRes.statusCode === 200 &&
      detailRes.body?.data?.supervisor?.name === 'Dr. Sarah Chen' &&
      detailRes.body?.data?.supervisor?.activeProjectsCount === 0 &&
      detailRes.body?.data?.supervisor?.maxCapacity === 2,
      `Status: ${detailRes.statusCode}, body: ${JSON.stringify(detailRes.body)}`
    );

    // -------------------------------------------------------------
    // TEST 5: Password hashes omitted from supervisor responses
    // -------------------------------------------------------------
    const supList = listRes.body?.data?.supervisors || [];
    const supDetail = detailRes.body?.data?.supervisor || {};
    const noHashInList = supList.every(s => s.passwordHash === undefined && s.password === undefined);
    const noHashInDetail = supDetail.passwordHash === undefined && supDetail.password === undefined;

    assert(
      '05. Password hashes are strictly omitted from supervisor directory and profile endpoints',
      noHashInList && noHashInDetail,
      `noHashInList=${noHashInList}, noHashInDetail=${noHashInDetail}`
    );

    // -------------------------------------------------------------
    // TEST 6: Public supervisor registration is forbidden
    // -------------------------------------------------------------
    const regRes = await makeRequest(port, {
      path: '/api/auth/register',
      method: 'POST'
    }, {
      name: 'Dr. Public Hacker',
      email: `hacker_${timestamp}@university.edu`,
      password: 'HackerPassword123!',
      accountType: 'supervisor',
      department: 'Computer'
    });

    assert(
      '06. Public registration with accountType="supervisor" is blocked with HTTP 403 Forbidden',
      regRes.statusCode === 403 && regRes.body?.success === false,
      `Status: ${regRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 7: Leader creates supervision request
    // -------------------------------------------------------------
    const createReqRes = await makeRequest(port, {
      path: `/api/projects/${testProject1._id}/supervision-requests`,
      method: 'POST',
      headers: leaderHeaders
    }, {
      supervisorId: supervisorA._id.toString(),
      proposalMessage: 'We are developing low-power mesh nodes and would appreciate your technical guidance on hardware design.'
    });

    const createdRequestId = createReqRes.body?.data?.request?._id;

    assert(
      '07. Project Leader successfully submits supervision request (HTTP 201 Created)',
      createReqRes.statusCode === 201 &&
      createReqRes.body?.success === true &&
      createReqRes.body?.data?.request?.status === 'pending' &&
      Boolean(createdRequestId),
      `Status: ${createReqRes.statusCode}, body: ${JSON.stringify(createReqRes.body)}`
    );

    // -------------------------------------------------------------
    // TEST 8: Non-leader request creation is forbidden
    // -------------------------------------------------------------
    const nonLeaderReqRes = await makeRequest(port, {
      path: `/api/projects/${testProject1._id}/supervision-requests`,
      method: 'POST',
      headers: otherStudentHeaders
    }, {
      supervisorId: supervisorA._id.toString(),
      proposalMessage: 'Non-leader trying to send an unauthorized request for another project.'
    });

    assert(
      '08. Non-leader student request creation is blocked with HTTP 403 Forbidden',
      nonLeaderReqRes.statusCode === 403 && nonLeaderReqRes.body?.success === false,
      `Status: ${nonLeaderReqRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 9: Duplicate pending request rejected (409 Conflict)
    // -------------------------------------------------------------
    const dupReqRes = await makeRequest(port, {
      path: `/api/projects/${testProject1._id}/supervision-requests`,
      method: 'POST',
      headers: leaderHeaders
    }, {
      supervisorId: supervisorB._id.toString(),
      proposalMessage: 'Attempting to send a second request while the first request is pending.'
    });

    assert(
      '09. Duplicate pending request rejected with HTTP 409 Conflict',
      dupReqRes.statusCode === 409 && dupReqRes.body?.success === false,
      `Status: ${dupReqRes.statusCode}, body: ${JSON.stringify(dupReqRes.body)}`
    );

    // -------------------------------------------------------------
    // TEST 10: Invalid supervisor rejected
    // -------------------------------------------------------------
    const invalidSupRes = await makeRequest(port, {
      path: `/api/projects/${testProject2._id}/supervision-requests`,
      method: 'POST',
      headers: leaderHeaders
    }, {
      supervisorId: otherStudent._id.toString(), // Student, not supervisor
      proposalMessage: 'Valid proposal length message sent to a user who is not a faculty supervisor.'
    });

    assert(
      '10. Supervision request to non-supervisor rejected with HTTP 400 Bad Request',
      invalidSupRes.statusCode === 400 && invalidSupRes.body?.success === false,
      `Status: ${invalidSupRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 11: Already supervised project rejected
    // -------------------------------------------------------------
    const alreadySupervisedProject = await Project.create({
      title: 'Already Supervised Project',
      abstract: 'This project already has an assigned faculty advisor attached to it.',
      domain: 'Computer',
      leader: leaderUser._id,
      members: [leaderUser._id],
      supervisor: supervisorA._id,
      maxTeamSize: 4,
      targetCompletionDate: futureDate,
      status: 'in_progress',
      recruitmentStatus: 'closed'
    });

    const alreadySupervisedRes = await makeRequest(port, {
      path: `/api/projects/${alreadySupervisedProject._id}/supervision-requests`,
      method: 'POST',
      headers: leaderHeaders
    }, {
      supervisorId: supervisorB._id.toString(),
      proposalMessage: 'Attempting to request second supervisor for an already supervised project.'
    });

    assert(
      '11. Request for project that already has an assigned supervisor rejected with HTTP 400',
      alreadySupervisedRes.statusCode === 400 && alreadySupervisedRes.body?.success === false,
      `Status: ${alreadySupervisedRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 12: Supervisor sees only their own requests
    // -------------------------------------------------------------
    const supAInboxRes = await makeRequest(port, {
      path: '/api/supervisors/my-requests?status=pending',
      method: 'GET',
      headers: supervisorAHeaders
    });

    const supBInboxRes = await makeRequest(port, {
      path: '/api/supervisors/my-requests?status=pending',
      method: 'GET',
      headers: supervisorBHeaders
    });

    const supAReqs = supAInboxRes.body?.data?.requests || [];
    const supBReqs = supBInboxRes.body?.data?.requests || [];

    assert(
      '12. Supervisor sees only requests addressed to them in /api/supervisors/my-requests',
      supAInboxRes.statusCode === 200 &&
      supAReqs.some(r => r._id === createdRequestId) &&
      supBReqs.length === 0,
      `SupA count: ${supAReqs.length}, SupB count: ${supBReqs.length}`
    );

    // -------------------------------------------------------------
    // TEST 13: Student cannot access supervisor inbox
    // -------------------------------------------------------------
    const studentInboxRes = await makeRequest(port, {
      path: '/api/supervisors/my-requests',
      method: 'GET',
      headers: leaderHeaders
    });

    assert(
      '13. Student attempting to access supervisor inbox receives HTTP 403 Forbidden',
      studentInboxRes.statusCode === 403 && studentInboxRes.body?.success === false,
      `Status: ${studentInboxRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 14: Wrong supervisor cannot accept or decline
    // -------------------------------------------------------------
    const wrongSupAcceptRes = await makeRequest(port, {
      path: `/api/supervision-requests/${createdRequestId}/accept`,
      method: 'PATCH',
      headers: supervisorBHeaders // Request was sent to supervisorA
    });

    assert(
      '14. Supervisor B attempting to accept request addressed to Supervisor A receives HTTP 403',
      wrongSupAcceptRes.statusCode === 403 && wrongSupAcceptRes.body?.success === false,
      `Status: ${wrongSupAcceptRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 15: Valid acceptance assigns supervisor
    // -------------------------------------------------------------
    const validAcceptRes = await makeRequest(port, {
      path: `/api/supervision-requests/${createdRequestId}/accept`,
      method: 'PATCH',
      headers: supervisorAHeaders
    });

    const updatedProject1 = await Project.findById(testProject1._id);
    const updatedRequest1 = await SupervisionRequest.findById(createdRequestId);

    assert(
      '15. Targeted supervisor accepts request (HTTP 200), assigns project.supervisor, sets reviewedAt',
      validAcceptRes.statusCode === 200 &&
      validAcceptRes.body?.success === true &&
      updatedProject1.supervisor.equals(supervisorA._id) &&
      updatedRequest1.status === 'accepted' &&
      Boolean(updatedRequest1.reviewedAt),
      `Status: ${validAcceptRes.statusCode}, projSup: ${updatedProject1.supervisor}`
    );

    // -------------------------------------------------------------
    // TEST 16: Accepted request cannot be accepted again
    // -------------------------------------------------------------
    const reAcceptRes = await makeRequest(port, {
      path: `/api/supervision-requests/${createdRequestId}/accept`,
      method: 'PATCH',
      headers: supervisorAHeaders
    });

    assert(
      '16. Attempting to accept an already accepted request returns HTTP 400 Bad Request',
      reAcceptRes.statusCode === 400 && reAcceptRes.body?.success === false,
      `Status: ${reAcceptRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 17: Valid decline records feedback
    // -------------------------------------------------------------
    // Create new request on testProject2 for supervisorB
    const createReq2 = await makeRequest(port, {
      path: `/api/projects/${testProject2._id}/supervision-requests`,
      method: 'POST',
      headers: leaderHeaders
    }, {
      supervisorId: supervisorB._id.toString(),
      proposalMessage: 'Solar PV telemetry inverter proposal looking for advising on renewable power.'
    });

    const req2Id = createReq2.body?.data?.request?._id;

    const declineRes = await makeRequest(port, {
      path: `/api/supervision-requests/${req2Id}/decline`,
      method: 'PATCH',
      headers: supervisorBHeaders
    }, {
      feedback: 'I am overcommitted on departmental power projects this semester.'
    });

    const updatedRequest2 = await SupervisionRequest.findById(req2Id);
    const unassignedProject2 = await Project.findById(testProject2._id);

    assert(
      '17. Targeted supervisor declines request (HTTP 200), records feedback, project unassigned',
      declineRes.statusCode === 200 &&
      declineRes.body?.success === true &&
      updatedRequest2.status === 'declined' &&
      updatedRequest2.feedback === 'I am overcommitted on departmental power projects this semester.' &&
      unassignedProject2.supervisor === null,
      `Status: ${declineRes.statusCode}, feedback: ${updatedRequest2.feedback}`
    );

    // -------------------------------------------------------------
    // TEST 18: Decline permits a new request
    // -------------------------------------------------------------
    const newReqAfterDecline = await makeRequest(port, {
      path: `/api/projects/${testProject2._id}/supervision-requests`,
      method: 'POST',
      headers: leaderHeaders
    }, {
      supervisorId: supervisorA._id.toString(),
      proposalMessage: 'Sending a new proposal to Supervisor A after previous request was declined.'
    });

    const req3Id = newReqAfterDecline.body?.data?.request?._id;

    assert(
      '18. Project Leader can submit a new supervision request after prior request was declined',
      newReqAfterDecline.statusCode === 201 &&
      newReqAfterDecline.body?.success === true &&
      Boolean(req3Id),
      `Status: ${newReqAfterDecline.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 19: Capacity limit enforced
    // -------------------------------------------------------------
    // Note: supervisorA maxCapacity is 2.
    // supervisorA is currently supervising:
    // 1. testProject1 (proposed)
    // 2. alreadySupervisedProject (in_progress)
    // Total active = 2. Capacity reached!
    // Now supervisorA attempts to accept req3Id:
    const capacityExceededRes = await makeRequest(port, {
      path: `/api/supervision-requests/${req3Id}/accept`,
      method: 'PATCH',
      headers: supervisorAHeaders
    });

    assert(
      '19. Supervisor at maxCapacity cannot accept proposal (HTTP 400 Bad Request)',
      capacityExceededRes.statusCode === 400 &&
      capacityExceededRes.body?.success === false &&
      capacityExceededRes.body?.message?.toLowerCase().includes('capacity'),
      `Status: ${capacityExceededRes.statusCode}, msg: ${capacityExceededRes.body?.message}`
    );

    // -------------------------------------------------------------
    // TEST 20: Concurrent accept attempts cannot assign multiple supervisors to one project
    // -------------------------------------------------------------
    // Setup a fresh project without supervisor
    const testProjectConcurrent = await Project.create({
      title: 'Concurrency Test Project',
      abstract: 'Testing race conditions when multiple accepts or assignments happen simultaneously.',
      domain: 'Computer',
      leader: leaderUser._id,
      members: [leaderUser._id],
      maxTeamSize: 4,
      targetCompletionDate: futureDate,
      status: 'proposed',
      recruitmentStatus: 'open'
    });

    // Create a request for supervisorB
    const concurrentReq = await SupervisionRequest.create({
      project: testProjectConcurrent._id,
      supervisor: supervisorB._id,
      proposalMessage: 'Concurrent request to test double acceptance and assignment races.',
      status: 'pending'
    });

    // Execute two concurrent accept calls for the same request
    const [cRes1, cRes2] = await Promise.all([
      makeRequest(port, {
        path: `/api/supervision-requests/${concurrentReq._id}/accept`,
        method: 'PATCH',
        headers: supervisorBHeaders
      }),
      makeRequest(port, {
        path: `/api/supervision-requests/${concurrentReq._id}/accept`,
        method: 'PATCH',
        headers: supervisorBHeaders
      })
    ]);

    const statusCodes = [cRes1.statusCode, cRes2.statusCode].sort();
    const finalProjConcurrent = await Project.findById(testProjectConcurrent._id);

    assert(
      '20. Concurrent accept requests serialize: exactly one succeeds (200) and the other fails (400)',
      statusCodes[0] === 200 && statusCodes[1] === 400 &&
      finalProjConcurrent.supervisor.equals(supervisorB._id),
      `StatusCodes: ${statusCodes.join(', ')}`
    );

    // -------------------------------------------------------------
    // TEST 21: Concurrent assignments cannot exceed supervisor capacity
    // -------------------------------------------------------------
    // Create a new supervisor with capacity of exactly 1
    const singleCapacitySupervisor = await User.create({
      name: 'Dr. Strict Capacity',
      email: `strict.capacity_${timestamp}@university.edu`,
      passwordHash,
      accountType: 'supervisor',
      department: 'Computer',
      maxCapacity: 1
    });
    const strictToken = generateToken(singleCapacitySupervisor);
    const strictHeaders = { Cookie: `token=${strictToken}` };

    // Create two separate projects
    const projA = await Project.create({
      title: 'Project A for Capacity Race',
      abstract: 'Testing capacity limits under concurrent requests to the same single-capacity supervisor.',
      domain: 'Computer',
      leader: leaderUser._id,
      members: [leaderUser._id],
      maxTeamSize: 4,
      targetCompletionDate: futureDate,
      status: 'proposed'
    });

    const projB = await Project.create({
      title: 'Project B for Capacity Race',
      abstract: 'Testing capacity limits under concurrent requests to the same single-capacity supervisor.',
      domain: 'Computer',
      leader: leaderUser._id,
      members: [leaderUser._id],
      maxTeamSize: 4,
      targetCompletionDate: futureDate,
      status: 'proposed'
    });

    const reqA = await SupervisionRequest.create({
      project: projA._id,
      supervisor: singleCapacitySupervisor._id,
      proposalMessage: 'Proposal A for single-capacity supervisor.',
      status: 'pending'
    });

    const reqB = await SupervisionRequest.create({
      project: projB._id,
      supervisor: singleCapacitySupervisor._id,
      proposalMessage: 'Proposal B for single-capacity supervisor.',
      status: 'pending'
    });

    // Fire concurrent accepts
    const [capResA, capResB] = await Promise.all([
      makeRequest(port, {
        path: `/api/supervision-requests/${reqA._id}/accept`,
        method: 'PATCH',
        headers: strictHeaders
      }),
      makeRequest(port, {
        path: `/api/supervision-requests/${reqB._id}/accept`,
        method: 'PATCH',
        headers: strictHeaders
      })
    ]);

    const capStatuses = [capResA.statusCode, capResB.statusCode].sort();
    const supervisedCount = await Project.countDocuments({
      supervisor: singleCapacitySupervisor._id,
      status: { $in: ['proposed', 'in_progress'] }
    });

    assert(
      '21. Concurrent accept attempts strictly respect maxCapacity limit (exactly 1 succeeds, supervised count = 1)',
      capStatuses[0] === 200 && capStatuses[1] === 400 && supervisedCount === 1,
      `StatusCodes: ${capStatuses.join(', ')}, supervisedCount: ${supervisedCount}`
    );

    // -------------------------------------------------------------
    // TEST 22: Project deletion cleans up supervision requests
    // -------------------------------------------------------------
    const projToDelete = await Project.create({
      title: 'Project to be Deleted',
      abstract: 'Project created specifically to verify child-before-parent cascade deletion.',
      domain: 'Computer',
      leader: leaderUser._id,
      members: [leaderUser._id],
      maxTeamSize: 4,
      targetCompletionDate: futureDate,
      status: 'proposed'
    });

    const reqToDelete = await SupervisionRequest.create({
      project: projToDelete._id,
      supervisor: supervisorB._id,
      proposalMessage: 'This request should be deleted when the parent project is deleted.',
      status: 'pending'
    });

    const deleteProjRes = await makeRequest(port, {
      path: `/api/projects/${projToDelete._id}`,
      method: 'DELETE',
      headers: leaderHeaders
    });

    const foundReqAfterDelete = await SupervisionRequest.findById(reqToDelete._id);
    const foundProjAfterDelete = await Project.findById(projToDelete._id);

    assert(
      '22. Project deletion cleans up associated SupervisionRequest records',
      deleteProjRes.statusCode === 200 &&
      foundProjAfterDelete === null &&
      foundReqAfterDelete === null,
      `Delete status: ${deleteProjRes.statusCode}, reqFound: ${Boolean(foundReqAfterDelete)}`
    );

    // -------------------------------------------------------------
    // TEST 23: Existing Task CRUD and Pulse behavior unaffected
    // -------------------------------------------------------------
    // Create task by leader on testProject1
    const createTaskRes = await makeRequest(port, {
      path: `/api/projects/${testProject1._id}/tasks`,
      method: 'POST',
      headers: leaderHeaders
    }, {
      title: 'Calibrate Current Sensors',
      description: 'Run 10 ADC samples to check drift.',
      dueDate: futureDate.toISOString(),
      priority: 'high'
    });

    const taskId = createTaskRes.body?.data?.task?._id;

    // Assigned supervisor views tasks
    const supGetTasksRes = await makeRequest(port, {
      path: `/api/projects/${testProject1._id}/tasks`,
      method: 'GET',
      headers: supervisorAHeaders
    });

    // Assigned supervisor views pulse
    const supGetPulseRes = await makeRequest(port, {
      path: `/api/projects/${testProject1._id}/pulse`,
      method: 'GET',
      headers: supervisorAHeaders
    });

    // Assigned supervisor tries to modify task (Forbidden)
    const supModifyTaskRes = await makeRequest(port, {
      path: `/api/tasks/${taskId}`,
      method: 'PATCH',
      headers: supervisorAHeaders
    }, {
      status: 'done'
    });

    assert(
      '23. Assigned supervisor can view tasks & pulse (200), but cannot modify tasks (403)',
      createTaskRes.statusCode === 201 &&
      supGetTasksRes.statusCode === 200 &&
      supGetPulseRes.statusCode === 200 &&
      supModifyTaskRes.statusCode === 403,
      `create: ${createTaskRes.statusCode}, getTasks: ${supGetTasksRes.statusCode}, getPulse: ${supGetPulseRes.statusCode}, mod: ${supModifyTaskRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 24: Project Leader request history endpoint
    // -------------------------------------------------------------
    const leaderHistoryRes = await makeRequest(port, {
      path: `/api/projects/${testProject1._id}/supervision-requests`,
      method: 'GET',
      headers: leaderHeaders
    });

    const nonLeaderHistoryRes = await makeRequest(port, {
      path: `/api/projects/${testProject1._id}/supervision-requests`,
      method: 'GET',
      headers: otherStudentHeaders
    });

    assert(
      '24. Project Leader can view supervision request history (200), non-leader is forbidden (403)',
      leaderHistoryRes.statusCode === 200 &&
      Array.isArray(leaderHistoryRes.body?.data?.requests) &&
      leaderHistoryRes.body.data.requests.length >= 1 &&
      nonLeaderHistoryRes.statusCode === 403,
      `Leader status: ${leaderHistoryRes.statusCode}, Non-leader: ${nonLeaderHistoryRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 25: Transaction rollback integrity on failure
    // -------------------------------------------------------------
    // In Test 21, between reqA and reqB, one failed due to capacity limit abort inside the transaction.
    // Verify that the transaction rollback was complete with zero partial writes:
    // 1. The failed request was NOT updated to 'accepted' and reviewedAt remains null.
    // 2. The project of the failed request remains unassigned (supervisor === null).
    const [finalReqA, finalReqB, finalProjA, finalProjB] = await Promise.all([
      SupervisionRequest.findById(reqA._id),
      SupervisionRequest.findById(reqB._id),
      Project.findById(projA._id),
      Project.findById(projB._id)
    ]);

    const failedReq = (finalReqA.status === 'pending') ? finalReqA : finalReqB;
    const failedProj = (finalReqA.status === 'pending') ? finalProjA : finalProjB;
    const acceptedReq = (finalReqA.status === 'accepted') ? finalReqA : finalReqB;
    const acceptedProj = (finalReqA.status === 'accepted') ? finalProjA : finalProjB;

    assert(
      '25. Transaction failure guarantees zero partial updates: rejected request remains pending and project unassigned',
      failedReq.status === 'pending' &&
      failedReq.reviewedAt === null &&
      failedProj.supervisor === null &&
      acceptedReq.status === 'accepted' &&
      acceptedProj.supervisor.equals(singleCapacitySupervisor._id),
      `failedReqStatus=${failedReq.status}, failedProjSup=${failedProj.supervisor}, acceptedReqStatus=${acceptedReq.status}`
    );

    console.log('\n===================================================================');
    console.log(`Supervisor Backend Test Suite Results: ${passed} passed, ${failed} failed`);
    console.log('===================================================================\n');
  } catch (err) {
    console.error('[FATAL] Unexpected test runner exception:', err);
    failed++;
  } finally {
    // Drop test database only if isolated
    if (mongoose.connection.name === TEST_DB_NAME) {
      console.log(`[CLEANUP] Dropping isolated test database "${TEST_DB_NAME}"...`);
      await mongoose.connection.dropDatabase();
      console.log(`[CLEANUP] Test database "${TEST_DB_NAME}" dropped successfully.`);
    }
    await mongoose.disconnect();
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

if (require.main === module) {
  runSupervisorTests();
}

module.exports = { runSupervisorTests };
