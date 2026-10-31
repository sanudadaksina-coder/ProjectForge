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
const Task = require('../src/models/Task');
const { generateToken } = require('../src/utils/token');
const { calculatePulseAndProgress } = require('../src/utils/pulse');

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

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTaskAndPulseTests() {
  console.log('===================================================================');
  console.log('ProjectForge Stage 2C-A: Task Management & Project Pulse Test Suite');
  console.log('===================================================================\n');

  // SAFETY & ISOLATION CHECK:
  // Explicitly connect to 'projectforge_task_test_db' so real records in 'projectforge_db'
  // are NEVER touched, modified, or deleted.
  const TEST_DB_NAME = 'projectforge_task_test_db';
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
    MembershipRequest.deleteMany({}),
    Task.deleteMany({})
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
    // -------------------------------------------------------------
    // SETUP SEED USERS & TOKENS
    // -------------------------------------------------------------
    console.log('[SETUP] Seeding test users (Leader, Member, Outsider, Supervisor)...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('SecurePass123!', salt);

    const leaderUser = await User.create({
      name: 'Leader Alice',
      email: 'alice.leader@university.edu',
      passwordHash,
      studentId: 'STU-LEAD-001',
      department: 'Computer',
      semester: 6,
      skills: ['React', 'Node.js', 'System Architecture'],
      accountType: 'student'
    });

    const memberUser = await User.create({
      name: 'Member Bob',
      email: 'bob.member@university.edu',
      passwordHash,
      studentId: 'STU-MEMB-002',
      department: 'Computer',
      semester: 6,
      skills: ['Express', 'MongoDB'],
      accountType: 'student'
    });

    const outsiderUser = await User.create({
      name: 'Outsider Charlie',
      email: 'charlie.outsider@university.edu',
      passwordHash,
      studentId: 'STU-OUT-003',
      department: 'Electrical',
      semester: 6,
      skills: ['Circuits'],
      accountType: 'student'
    });

    const supervisorUser = await User.create({
      name: 'Dr. Evelyn Reed',
      email: 'e.reed@faculty.edu',
      passwordHash,
      department: 'Computer',
      designation: 'Associate Professor',
      researchInterests: ['Distributed Systems', 'Embedded Computing'],
      officeLocation: 'Room 304',
      maxProjectCapacity: 5,
      accountType: 'supervisor'
    });

    const leaderToken = generateToken(leaderUser._id);
    const memberToken = generateToken(memberUser._id);
    const outsiderToken = generateToken(outsiderUser._id);
    const supervisorToken = generateToken(supervisorUser._id);

    const leaderHeaders = { Cookie: `token=${leaderToken}` };
    const memberHeaders = { Cookie: `token=${memberToken}` };
    const outsiderHeaders = { Cookie: `token=${outsiderToken}` };
    const supervisorHeaders = { Cookie: `token=${supervisorToken}` };

    // Create main test project
    const mainProject = await Project.create({
      title: 'Autonomous Drone Navigation System',
      abstract: 'Implementing edge computer vision on autonomous quadcopter platforms with FreeRTOS.',
      domain: 'Computer',
      tags: ['Drones', 'CV', 'Embedded'],
      leader: leaderUser._id,
      members: [leaderUser._id, memberUser._id],
      maxTeamSize: 4,
      targetCompletionDate: new Date(Date.now() + 30 * 86400000),
      status: 'in_progress',
      recruitmentStatus: 'open',
      pulseScore: 0
    });

    const projectId = mainProject._id.toString();
    let createdTaskId = null;

    // -------------------------------------------------------------
    // TEST 1: Leader creates a task
    // -------------------------------------------------------------
    console.log('\n--- Section 1: Task Creation & Persistence ---');
    const createRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/tasks`,
      method: 'POST',
      headers: leaderHeaders
    }, {
      title: 'Configure Edge Optical Flow Sensors',
      description: 'Mount sensor breakboard and calibrate I2C communications register.',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      priority: 'high',
      assignedTo: memberUser._id.toString()
    });

    assert(
      '1. Leader creates a task (201 Created)',
      createRes.statusCode === 201 && createRes.body.success === true,
      `Status: ${createRes.statusCode}, body: ${JSON.stringify(createRes.body)}`
    );

    createdTaskId = createRes.body.data && createRes.body.data.task ? createRes.body.data.task._id : null;

    // -------------------------------------------------------------
    // TEST 2: Task is persisted in MongoDB
    // -------------------------------------------------------------
    const dbTask = await Task.findById(createdTaskId);
    assert(
      '2. Task is persisted in MongoDB Atlas / database',
      dbTask !== null &&
      dbTask.title === 'Configure Edge Optical Flow Sensors' &&
      dbTask.status === 'todo' &&
      dbTask.project.toString() === projectId,
      `dbTask: ${JSON.stringify(dbTask)}`
    );

    // -------------------------------------------------------------
    // TEST 3: Approved members can read tasks
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Authorization & Role Access ---');
    const memberGetRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/tasks`,
      method: 'GET',
      headers: memberHeaders
    });

    assert(
      '3. Approved members can read tasks (200 OK)',
      memberGetRes.statusCode === 200 &&
      memberGetRes.body.success === true &&
      Array.isArray(memberGetRes.body.data.tasks) &&
      memberGetRes.body.data.tasks.length === 1 &&
      memberGetRes.body.data.tasks[0]._id === createdTaskId,
      `Status: ${memberGetRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 4: Outsiders cannot read private tasks, pulse, or progress (403), unauth gets 401
    // -------------------------------------------------------------
    const outsiderGetRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/tasks`,
      method: 'GET',
      headers: outsiderHeaders
    });

    const outsiderGetItemRes = await makeRequest(port, {
      path: `/api/tasks/${createdTaskId}`,
      method: 'GET',
      headers: outsiderHeaders
    });

    const outsiderGetPulseRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/pulse`,
      method: 'GET',
      headers: outsiderHeaders
    });

    const outsiderGetProgressRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/progress`,
      method: 'GET',
      headers: outsiderHeaders
    });

    const unauthGetPulseRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/pulse`,
      method: 'GET'
    });

    const unauthGetProgressRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/progress`,
      method: 'GET'
    });

    assert(
      '4. Outsiders cannot read private tasks, pulse, or progress (403 Forbidden); unauthenticated gets 401',
      outsiderGetRes.statusCode === 403 &&
      outsiderGetRes.body.success === false &&
      outsiderGetItemRes.statusCode === 403 &&
      outsiderGetPulseRes.statusCode === 403 &&
      outsiderGetPulseRes.body.success === false &&
      outsiderGetProgressRes.statusCode === 403 &&
      outsiderGetProgressRes.body.success === false &&
      unauthGetPulseRes.statusCode === 401 &&
      unauthGetProgressRes.statusCode === 401,
      `Tasks: ${outsiderGetRes.statusCode}, Item: ${outsiderGetItemRes.statusCode}, OutsiderPulse: ${outsiderGetPulseRes.statusCode}, OutsiderProg: ${outsiderGetProgressRes.statusCode}, UnauthPulse: ${unauthGetPulseRes.statusCode}, UnauthProg: ${unauthGetProgressRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 5: Non-leaders cannot create, edit, check, uncheck or delete tasks
    // -------------------------------------------------------------
    const memberCreateRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/tasks`,
      method: 'POST',
      headers: memberHeaders
    }, {
      title: 'Member Unauthorized Task',
      dueDate: new Date(Date.now() + 86400000).toISOString()
    });

    const outsiderCreateRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/tasks`,
      method: 'POST',
      headers: outsiderHeaders
    }, {
      title: 'Outsider Unauthorized Task',
      dueDate: new Date(Date.now() + 86400000).toISOString()
    });

    const supervisorCreateRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/tasks`,
      method: 'POST',
      headers: supervisorHeaders
    }, {
      title: 'Supervisor Unauthorized Task',
      dueDate: new Date(Date.now() + 86400000).toISOString()
    });

    const memberEditRes = await makeRequest(port, {
      path: `/api/tasks/${createdTaskId}`,
      method: 'PATCH',
      headers: memberHeaders
    }, { title: 'Modified by Member' });

    const memberCheckRes = await makeRequest(port, {
      path: `/api/tasks/${createdTaskId}`,
      method: 'PATCH',
      headers: memberHeaders
    }, { completed: true });

    const memberUncheckRes = await makeRequest(port, {
      path: `/api/tasks/${createdTaskId}`,
      method: 'PATCH',
      headers: memberHeaders
    }, { completed: false });

    const memberDeleteRes = await makeRequest(port, {
      path: `/api/tasks/${createdTaskId}`,
      method: 'DELETE',
      headers: memberHeaders
    });

    assert(
      '5. Non-leaders cannot create, edit, check, uncheck or delete tasks (403 Forbidden for all)',
      memberCreateRes.statusCode === 403 &&
      outsiderCreateRes.statusCode === 403 &&
      supervisorCreateRes.statusCode === 403 &&
      memberEditRes.statusCode === 403 &&
      memberCheckRes.statusCode === 403 &&
      memberUncheckRes.statusCode === 403 &&
      memberDeleteRes.statusCode === 403,
      `Create: ${memberCreateRes.statusCode}, Edit: ${memberEditRes.statusCode}, Check: ${memberCheckRes.statusCode}, Delete: ${memberDeleteRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 6: Leader completes a task (todo -> done)
    // -------------------------------------------------------------
    console.log('\n--- Section 3: Task Checkbox & Completion Transitions ---');
    const completeRes = await makeRequest(port, {
      path: `/api/tasks/${createdTaskId}`,
      method: 'PATCH',
      headers: leaderHeaders
    }, {
      completed: true
    });

    const completedDbTask = await Task.findById(createdTaskId);
    assert(
      '6. Leader completes a task (todo -> done) and completedAt is stamped',
      completeRes.statusCode === 200 &&
      completeRes.body.data.task.status === 'done' &&
      completedDbTask.status === 'done' &&
      completedDbTask.completedAt !== null,
      `Status: ${completeRes.statusCode}, dbStatus: ${completedDbTask.status}`
    );

    // -------------------------------------------------------------
    // TEST 7: Leader reopens a task (done -> todo)
    // -------------------------------------------------------------
    const reopenRes = await makeRequest(port, {
      path: `/api/tasks/${createdTaskId}`,
      method: 'PATCH',
      headers: leaderHeaders
    }, {
      completed: false
    });

    const reopenedDbTask = await Task.findById(createdTaskId);
    assert(
      '7. Leader reopens a task (done -> todo) and completedAt is reset to null',
      reopenRes.statusCode === 200 &&
      reopenRes.body.data.task.status === 'todo' &&
      reopenedDbTask.status === 'todo' &&
      reopenedDbTask.completedAt === null,
      `Status: ${reopenRes.statusCode}, dbStatus: ${reopenedDbTask.status}`
    );

    // -------------------------------------------------------------
    // TEST 8: Four tasks produce progress values of 0%, 25%, 50%, 75% and 100%
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Progress Progression Verification ---');
    // Create dedicated project for 4-task progression
    const progProject = await Project.create({
      title: 'Four Step Progression Project Workspace',
      abstract: 'Testing exact 0%, 25%, 50%, 75%, 100% completion steps across four checkboxes.',
      domain: 'Electrical',
      leader: leaderUser._id,
      members: [leaderUser._id],
      maxTeamSize: 2,
      targetCompletionDate: new Date(Date.now() + 10 * 86400000),
      status: 'in_progress',
      pulseScore: 0
    });

    const pProgId = progProject._id.toString();

    // Create 4 future tasks
    const futureDue = new Date(Date.now() + 5 * 86400000).toISOString();
    const tRes1 = await makeRequest(port, { path: `/api/projects/${pProgId}/tasks`, method: 'POST', headers: leaderHeaders }, { title: 'Prog Task 1', dueDate: futureDue });
    const tRes2 = await makeRequest(port, { path: `/api/projects/${pProgId}/tasks`, method: 'POST', headers: leaderHeaders }, { title: 'Prog Task 2', dueDate: futureDue });
    const tRes3 = await makeRequest(port, { path: `/api/projects/${pProgId}/tasks`, method: 'POST', headers: leaderHeaders }, { title: 'Prog Task 3', dueDate: futureDue });
    const tRes4 = await makeRequest(port, { path: `/api/projects/${pProgId}/tasks`, method: 'POST', headers: leaderHeaders }, { title: 'Prog Task 4', dueDate: futureDue });

    const id1 = tRes1.body.data.task._id;
    const id2 = tRes2.body.data.task._id;
    const id3 = tRes3.body.data.task._id;
    const id4 = tRes4.body.data.task._id;

    // Step 0: 0/4 completed -> 0%
    const get0 = await makeRequest(port, { path: `/api/projects/${pProgId}/tasks`, method: 'GET', headers: leaderHeaders });
    const p0 = get0.body.data.progress;

    // Step 1: Check 1 -> 1/4 completed -> 25%
    const chk1 = await makeRequest(port, { path: `/api/tasks/${id1}`, method: 'PATCH', headers: leaderHeaders }, { completed: true });
    const p25 = chk1.body.data.progress;

    // Step 2: Check 2 -> 2/4 completed -> 50%
    const chk2 = await makeRequest(port, { path: `/api/tasks/${id2}`, method: 'PATCH', headers: leaderHeaders }, { completed: true });
    const p50 = chk2.body.data.progress;

    // Step 3: Check 3 -> 3/4 completed -> 75%
    const chk3 = await makeRequest(port, { path: `/api/tasks/${id3}`, method: 'PATCH', headers: leaderHeaders }, { completed: true });
    const p75 = chk3.body.data.progress;

    // Step 4: Check 4 -> 4/4 completed -> 100%
    const chk4 = await makeRequest(port, { path: `/api/tasks/${id4}`, method: 'PATCH', headers: leaderHeaders }, { completed: true });
    const p100 = chk4.body.data.progress;

    assert(
      '8. Four tasks produce progress values of 0%, 25%, 50%, 75% and 100% as checkboxes are completed',
      p0.totalTasks === 4 && p0.completedTasks === 0 && p0.completionPercent === 0 &&
      p25.totalTasks === 4 && p25.completedTasks === 1 && p25.completionPercent === 25 &&
      p50.totalTasks === 4 && p50.completedTasks === 2 && p50.completionPercent === 50 &&
      p75.totalTasks === 4 && p75.completedTasks === 3 && p75.completionPercent === 75 &&
      p100.totalTasks === 4 && p100.completedTasks === 4 && p100.completionPercent === 100,
      `Got: ${p0.completionPercent}%, ${p25.completionPercent}%, ${p50.completionPercent}%, ${p75.completionPercent}%, ${p100.completionPercent}%`
    );

    // -------------------------------------------------------------
    // TEST 9: Progress remains correct after fetching records again
    // -------------------------------------------------------------
    const reGetTasks = await makeRequest(port, { path: `/api/projects/${pProgId}/tasks`, method: 'GET', headers: leaderHeaders });
    const reGetProg = await makeRequest(port, { path: `/api/projects/${pProgId}/progress`, method: 'GET', headers: leaderHeaders });

    assert(
      '9. Progress remains correct after fetching records again from MongoDB',
      reGetTasks.statusCode === 200 &&
      reGetTasks.body.data.progress.completionPercent === 100 &&
      reGetProg.statusCode === 200 &&
      reGetProg.body.data.progress.completedTasks === 4 &&
      reGetProg.body.data.progress.completionPercent === 100,
      `reGetTasks: ${JSON.stringify(reGetTasks.body.data.progress)}, reGetProg: ${JSON.stringify(reGetProg.body.data.progress)}`
    );

    // -------------------------------------------------------------
    // TEST 10: Leader can edit and delete tasks
    // -------------------------------------------------------------
    console.log('\n--- Section 5: Task Edit, Delete, & Validation Constraints ---');
    const editRes = await makeRequest(port, {
      path: `/api/tasks/${id1}`,
      method: 'PATCH',
      headers: leaderHeaders
    }, {
      title: 'Updated Optical Sensor Task Title',
      priority: 'low',
      description: 'Updated description for optical flow sensor configuration.'
    });

    const deleteRes = await makeRequest(port, {
      path: `/api/tasks/${id4}`,
      method: 'DELETE',
      headers: leaderHeaders
    });

    const deletedTaskCheck = await Task.findById(id4);
    assert(
      '10. Leader can edit and delete tasks',
      editRes.statusCode === 200 &&
      editRes.body.data.task.title === 'Updated Optical Sensor Task Title' &&
      editRes.body.data.task.priority === 'low' &&
      deleteRes.statusCode === 200 &&
      deleteRes.body.data.deletedTaskId === id4 &&
      deletedTaskCheck === null,
      `Edit: ${editRes.statusCode}, Delete: ${deleteRes.statusCode}, DbExists: ${!!deletedTaskCheck}`
    );

    // -------------------------------------------------------------
    // TEST 11: Invalid inputs and unauthorized operations are rejected
    // -------------------------------------------------------------
    const badTitleRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/tasks`,
      method: 'POST',
      headers: leaderHeaders
    }, {
      title: 'x', // Too short (min 2)
      dueDate: futureDue
    });

    const badDateRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/tasks`,
      method: 'POST',
      headers: leaderHeaders
    }, {
      title: 'Valid Task Title',
      dueDate: 'not-a-valid-date'
    });

    const badPriorityRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/tasks`,
      method: 'POST',
      headers: leaderHeaders
    }, {
      title: 'Valid Task Title',
      dueDate: futureDue,
      priority: 'extreme'
    });

    const badAssigneeRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/tasks`,
      method: 'POST',
      headers: leaderHeaders
    }, {
      title: 'Valid Task Title',
      dueDate: futureDue,
      assignedTo: outsiderUser._id.toString() // Outsider is not in project.members
    });

    const noAuthRes = await makeRequest(port, {
      path: `/api/projects/${projectId}/tasks`,
      method: 'POST'
    }, {
      title: 'Valid Task Title',
      dueDate: futureDue
    });

    assert(
      '11. Invalid inputs and unauthorized operations are rejected (422/400/401)',
      badTitleRes.statusCode === 422 &&
      badDateRes.statusCode === 422 &&
      badPriorityRes.statusCode === 422 &&
      badAssigneeRes.statusCode === 400 &&
      noAuthRes.statusCode === 401,
      `badTitle: ${badTitleRes.statusCode}, badDate: ${badDateRes.statusCode}, badPriority: ${badPriorityRes.statusCode}, badAssignee: ${badAssigneeRes.statusCode}, noAuth: ${noAuthRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 12: Protected fields cannot be changed
    // -------------------------------------------------------------
    const protectProjRes = await makeRequest(port, {
      path: `/api/tasks/${id1}`,
      method: 'PATCH',
      headers: leaderHeaders
    }, {
      project: outsiderUser._id.toString()
    });

    const protectCreatorRes = await makeRequest(port, {
      path: `/api/tasks/${id1}`,
      method: 'PATCH',
      headers: leaderHeaders
    }, {
      createdBy: outsiderUser._id.toString()
    });

    const protectPulseRes = await makeRequest(port, {
      path: `/api/projects/${projectId}`,
      method: 'PATCH',
      headers: leaderHeaders
    }, {
      pulseScore: 99
    });

    assert(
      '12. Protected fields cannot be changed via task update or project update (422 Unprocessable Entity)',
      protectProjRes.statusCode === 422 &&
      protectCreatorRes.statusCode === 422 &&
      protectPulseRes.statusCode === 422,
      `Task.project: ${protectProjRes.statusCode}, Task.createdBy: ${protectCreatorRes.statusCode}, Project.pulseScore: ${protectPulseRes.statusCode}`
    );

    // -------------------------------------------------------------
    // TEST 13: Zero-task Pulse returns 0 and "No Tasks Yet"
    // -------------------------------------------------------------
    console.log('\n--- Section 6: Project Pulse Metric & Boundaries ---');
    const emptyProj = await Project.create({
      title: 'Zero Tasks Project Workspace Empty',
      abstract: 'Project created with zero tasks to verify zero-task pulse status and gray label.',
      domain: 'Biomedical',
      leader: leaderUser._id,
      members: [leaderUser._id],
      maxTeamSize: 3,
      targetCompletionDate: new Date(Date.now() + 20 * 86400000),
      status: 'proposed',
      pulseScore: 0
    });

    const zeroPulseRes = await makeRequest(port, {
      path: `/api/projects/${emptyProj._id}/pulse`,
      method: 'GET',
      headers: leaderHeaders
    });

    assert(
      '13. Zero-task Pulse returns score 0, badgeColor "gray" and label "No Tasks Yet"',
      zeroPulseRes.statusCode === 200 &&
      zeroPulseRes.body.data.pulseScore === 0 &&
      zeroPulseRes.body.data.statusLabel === 'No Tasks Yet' &&
      zeroPulseRes.body.data.badgeColor === 'gray' &&
      zeroPulseRes.body.data.metrics.totalTasks === 0,
      `Pulse body: ${JSON.stringify(zeroPulseRes.body.data)}`
    );

    // -------------------------------------------------------------
    // TEST 14: Overdue incomplete tasks reduce Pulse
    // -------------------------------------------------------------
    const pulseProj = await Project.create({
      title: 'Pulse Metric Penalty Calculation Workspace',
      abstract: 'Testing overdue incomplete tasks applying 10-point penalties to completion rate.',
      domain: 'Mechanical',
      leader: leaderUser._id,
      members: [leaderUser._id],
      maxTeamSize: 3,
      targetCompletionDate: new Date(Date.now() + 20 * 86400000),
      status: 'in_progress',
      pulseScore: 0
    });

    const pPulseId = pulseProj._id.toString();

    // Create 4 tasks:
    // 3 completed with future dueDate: completionRate = (3/4)*100 = 75%
    // 1 incomplete with PAST dueDate: overdueIncomplete = 1 -> penalty = 10
    // Expected pulse = 75 - 10 = 65% ('In Progress')
    const pastDue = new Date(Date.now() - 3 * 86400000).toISOString();
    await Task.create({ project: pPulseId, title: 'Task Done 1', dueDate: futureDue, status: 'done', completedAt: new Date(), createdBy: leaderUser._id });
    await Task.create({ project: pPulseId, title: 'Task Done 2', dueDate: futureDue, status: 'done', completedAt: new Date(), createdBy: leaderUser._id });
    await Task.create({ project: pPulseId, title: 'Task Done 3', dueDate: futureDue, status: 'done', completedAt: new Date(), createdBy: leaderUser._id });
    const overdueTask = await Task.create({ project: pPulseId, title: 'Overdue Incomplete Task', dueDate: pastDue, status: 'todo', createdBy: leaderUser._id });

    const penaltyPulseRes = await makeRequest(port, {
      path: `/api/projects/${pPulseId}/pulse`,
      method: 'GET',
      headers: leaderHeaders
    });

    assert(
      '14. Overdue incomplete tasks reduce Pulse (75% completion - 10 penalty = 65 score)',
      penaltyPulseRes.statusCode === 200 &&
      penaltyPulseRes.body.data.pulseScore === 65 &&
      penaltyPulseRes.body.data.statusLabel === 'In Progress' &&
      penaltyPulseRes.body.data.metrics.overdueIncompleteTasks === 1 &&
      penaltyPulseRes.body.data.metrics.overduePenalty === 10,
      `Got pulse: ${JSON.stringify(penaltyPulseRes.body.data)}`
    );

    // -------------------------------------------------------------
    // TEST 15: Completed overdue tasks do not reduce Pulse
    // -------------------------------------------------------------
    // Mark the overdue task as 'done'
    const completeOverdueRes = await makeRequest(port, {
      path: `/api/tasks/${overdueTask._id}`,
      method: 'PATCH',
      headers: leaderHeaders
    }, {
      completed: true
    });

    assert(
      '15. Completed overdue tasks do not reduce Pulse (100% completion, 0 penalty = 100 score)',
      completeOverdueRes.statusCode === 200 &&
      completeOverdueRes.body.data.updatedPulseScore === 100 &&
      completeOverdueRes.body.data.pulse.statusLabel === 'On Track' &&
      completeOverdueRes.body.data.pulse.metrics.overdueIncompleteTasks === 0 &&
      completeOverdueRes.body.data.pulse.metrics.overduePenalty === 0,
      `Got: ${JSON.stringify(completeOverdueRes.body.data.pulse)}`
    );

    // -------------------------------------------------------------
    // TEST 16: Pulse labels correctly handle boundaries 39, 40, 74 and 75
    // -------------------------------------------------------------
    // Pure calculation boundary checks:
    // 39 -> At Risk (red)
    // 40 -> In Progress (yellow)
    // 74 -> In Progress (yellow)
    // 75 -> On Track (green)
    const calc39 = calculatePulseAndProgress([
      { status: 'done', dueDate: new Date(Date.now() + 86400000) },
      ...Array(9).fill(null).map(() => ({ status: 'todo', dueDate: new Date(Date.now() + 86400000) }))
    ]); // 1/10 = 10% -> At Risk
    const boundary39 = calculatePulseAndProgress([
      // 49 completed out of 100 with 1 overdue incomplete = 49 - 10 = 39%
      ...Array(49).fill(null).map(() => ({ status: 'done', dueDate: new Date(Date.now() + 86400000) })),
      { status: 'todo', dueDate: new Date(Date.now() - 86400000) }, // 1 overdue = 10 penalty
      ...Array(50).fill(null).map(() => ({ status: 'todo', dueDate: new Date(Date.now() + 86400000) }))
    ]);
    const boundary40 = calculatePulseAndProgress([
      // 50 completed out of 100 with 1 overdue incomplete = 50 - 10 = 40%
      ...Array(50).fill(null).map(() => ({ status: 'done', dueDate: new Date(Date.now() + 86400000) })),
      { status: 'todo', dueDate: new Date(Date.now() - 86400000) }, // 1 overdue = 10 penalty
      ...Array(49).fill(null).map(() => ({ status: 'todo', dueDate: new Date(Date.now() + 86400000) }))
    ]);
    const boundary74 = calculatePulseAndProgress([
      // 74 completed out of 100 with 0 overdue = 74%
      ...Array(74).fill(null).map(() => ({ status: 'done', dueDate: new Date(Date.now() + 86400000) })),
      ...Array(26).fill(null).map(() => ({ status: 'todo', dueDate: new Date(Date.now() + 86400000) }))
    ]);
    const boundary75 = calculatePulseAndProgress([
      // 75 completed out of 100 with 0 overdue = 75%
      ...Array(75).fill(null).map(() => ({ status: 'done', dueDate: new Date(Date.now() + 86400000) })),
      ...Array(25).fill(null).map(() => ({ status: 'todo', dueDate: new Date(Date.now() + 86400000) }))
    ]);

    assert(
      '16. Pulse labels correctly handle boundaries: 39 (At Risk), 40 (In Progress), 74 (In Progress), 75 (On Track)',
      boundary39.pulse.pulseScore === 39 && boundary39.pulse.statusLabel === 'At Risk' && boundary39.pulse.badgeColor === 'red' &&
      boundary40.pulse.pulseScore === 40 && boundary40.pulse.statusLabel === 'In Progress' && boundary40.pulse.badgeColor === 'yellow' &&
      boundary74.pulse.pulseScore === 74 && boundary74.pulse.statusLabel === 'In Progress' && boundary74.pulse.badgeColor === 'yellow' &&
      boundary75.pulse.pulseScore === 75 && boundary75.pulse.statusLabel === 'On Track' && boundary75.pulse.badgeColor === 'green',
      `39: ${boundary39.pulse.statusLabel}, 40: ${boundary40.pulse.statusLabel}, 74: ${boundary74.pulse.statusLabel}, 75: ${boundary75.pulse.statusLabel}`
    );

    // -------------------------------------------------------------
    // TEST 17: Pulse is clamped between 0 and 100
    // -------------------------------------------------------------
    // Negative raw score clamp: 1 completed out of 10 (10%), 5 overdue (50 penalty) -> 10 - 50 = -40 -> clamps to 0
    const clampedZero = calculatePulseAndProgress([
      { status: 'done', dueDate: new Date(Date.now() + 86400000) },
      ...Array(5).fill(null).map(() => ({ status: 'todo', dueDate: new Date(Date.now() - 86400000) })), // 5 overdue
      ...Array(4).fill(null).map(() => ({ status: 'todo', dueDate: new Date(Date.now() + 86400000) }))
    ]);

    // All done: 100%
    const clampedHundred = calculatePulseAndProgress([
      ...Array(5).fill(null).map(() => ({ status: 'done', dueDate: new Date(Date.now() + 86400000) }))
    ]);

    assert(
      '17. Pulse is clamped between 0 and 100 (Negative raw scores clamp to 0 and "At Risk")',
      clampedZero.pulse.pulseScore === 0 &&
      clampedZero.pulse.statusLabel === 'At Risk' &&
      clampedZero.pulse.badgeColor === 'red' &&
      clampedHundred.pulse.pulseScore === 100 &&
      clampedHundred.pulse.statusLabel === 'On Track',
      `Zero clamped: ${clampedZero.pulse.pulseScore} (${clampedZero.pulse.statusLabel}), Hundred: ${clampedHundred.pulse.pulseScore}`
    );

    // -------------------------------------------------------------
    // TEST 18: Deadline passage affects Pulse without a task edit
    // -------------------------------------------------------------
    console.log('\n--- Section 7: Request-Time Dynamic Recalculation ---');
    const dynamicProj = await Project.create({
      title: 'Dynamic Deadline Expiration Project',
      abstract: 'Testing that passing a deadline recalculates Project Pulse at request-time without task edits.',
      domain: 'Civil',
      leader: leaderUser._id,
      members: [leaderUser._id],
      maxTeamSize: 2,
      targetCompletionDate: new Date(Date.now() + 20 * 86400000),
      status: 'in_progress',
      pulseScore: 0
    });

    const pDynId = dynamicProj._id.toString();

    // 1 completed task (+5 days)
    await Task.create({ project: pDynId, title: 'Finished Foundation', dueDate: futureDue, status: 'done', completedAt: new Date(), createdBy: leaderUser._id });
    // 1 pending task due in exactly 1.2 seconds!
    const soonDue = new Date(Date.now() + 1200);
    await Task.create({ project: pDynId, title: 'Temporary Shoring', dueDate: soonDue, status: 'todo', createdBy: leaderUser._id });

    // Initial check before deadline: 1/2 done = 50%, 0 overdue = 50 score
    const initialPulseRes = await makeRequest(port, {
      path: `/api/projects/${pDynId}/pulse`,
      method: 'GET',
      headers: leaderHeaders
    });
    const initialScore = initialPulseRes.body.data.pulseScore;

    console.log(`  [INFO] Waiting 1.8 seconds for task deadline to pass naturally...`);
    await delay(1800);

    // Check pulse AGAIN without any task edits
    const expiredPulseRes = await makeRequest(port, {
      path: `/api/projects/${pDynId}/pulse`,
      method: 'GET',
      headers: leaderHeaders
    });
    const expiredScore = expiredPulseRes.body.data.pulseScore;

    // Verify DB sync as well
    const updatedDynProjectInDb = await Project.findById(pDynId);

    assert(
      '18. Deadline passage affects Pulse without a task edit (Score drops from 50 to 40 at request-time)',
      initialScore === 50 &&
      expiredScore === 40 &&
      expiredPulseRes.body.data.statusLabel === 'In Progress' &&
      expiredPulseRes.body.data.metrics.overdueIncompleteTasks === 1 &&
      updatedDynProjectInDb.pulseScore === 40,
      `Initial: ${initialScore}, Expired: ${expiredScore}, DB stored: ${updatedDynProjectInDb.pulseScore}`
    );

    // -------------------------------------------------------------
    // TEST 19: Project deletion cleans up related Task documents
    // -------------------------------------------------------------
    console.log('\n--- Section 8: Cascade Deletion & Cleanup ---');
    const delProj = await Project.create({
      title: 'Cascade Task Cleanup Project Demo',
      abstract: 'Testing that deleting a project document also removes all child tasks and membership requests.',
      domain: 'Multidisciplinary',
      leader: leaderUser._id,
      members: [leaderUser._id],
      maxTeamSize: 3,
      targetCompletionDate: new Date(Date.now() + 15 * 86400000),
      status: 'in_progress',
      pulseScore: 0
    });

    const pDelId = delProj._id.toString();
    await Task.create({ project: pDelId, title: 'Child Task 1', dueDate: futureDue, createdBy: leaderUser._id });
    await Task.create({ project: pDelId, title: 'Child Task 2', dueDate: futureDue, createdBy: leaderUser._id });

    const tasksBeforeCount = await Task.countDocuments({ project: pDelId });

    // Leader deletes project
    const delProjRes = await makeRequest(port, {
      path: `/api/projects/${pDelId}`,
      method: 'DELETE',
      headers: leaderHeaders
    });

    const tasksAfterCount = await Task.countDocuments({ project: pDelId });
    const projectAfter = await Project.findById(pDelId);

    assert(
      '19. Project deletion cleans up related Task documents (0 remaining child tasks)',
      delProjRes.statusCode === 200 &&
      tasksBeforeCount === 2 &&
      tasksAfterCount === 0 &&
      projectAfter === null,
      `Tasks before: ${tasksBeforeCount}, after: ${tasksAfterCount}, project: ${projectAfter}`
    );

    // -------------------------------------------------------------
    // TEST 20: Member removal unassigns tasks safely
    // -------------------------------------------------------------
    const memberAssignProj = await Project.create({
      title: 'Member Unassignment Project Test',
      abstract: 'Testing that removing an approved team member sets assignedTo: null on their tasks.',
      domain: 'Computer',
      leader: leaderUser._id,
      members: [leaderUser._id, memberUser._id],
      maxTeamSize: 4,
      targetCompletionDate: new Date(Date.now() + 20 * 86400000),
      status: 'in_progress',
      recruitmentStatus: 'open',
      pulseScore: 0
    });

    const pRemId = memberAssignProj._id.toString();
    const assignedTask = await Task.create({
      project: pRemId,
      title: 'Task Assigned to Member Bob',
      dueDate: futureDue,
      assignedTo: memberUser._id,
      createdBy: leaderUser._id
    });

    // Leader removes member Bob
    const remMemberRes = await makeRequest(port, {
      path: `/api/projects/${pRemId}/members/${memberUser._id}`,
      method: 'DELETE',
      headers: leaderHeaders
    });

    const refreshedAssignedTask = await Task.findById(assignedTask._id);

    assert(
      '20. Removing an approved member safely unassigns their tasks (assignedTo becomes null)',
      remMemberRes.statusCode === 200 &&
      refreshedAssignedTask.assignedTo === null,
      `remMemberRes: ${remMemberRes.statusCode}, task assignedTo: ${refreshedAssignedTask.assignedTo}`
    );

  } catch (err) {
    console.error('[UNEXPECTED TEST ERROR]:', err);
    failed++;
  } finally {
    if (mongoose.connection.name === TEST_DB_NAME) {
      try {
        console.log(`\n[CLEANUP] Dropping isolated test database "${TEST_DB_NAME}"...`);
        await mongoose.connection.db.dropDatabase();
        console.log(`[CLEANUP] Test database "${TEST_DB_NAME}" dropped successfully.`);
      } catch (cleanErr) {
        console.warn('[CLEANUP WARNING] Failed to drop test database:', cleanErr.message);
      }
    }
    server.close();
    await mongoose.connection.close();
  }

  console.log('\n===================================================================');
  console.log(`Test Execution Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log('===================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  runTaskAndPulseTests();
}

module.exports = runTaskAndPulseTests;
