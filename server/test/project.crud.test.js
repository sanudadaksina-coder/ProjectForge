const path = require('path');
const http = require('http');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
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

async function runProjectCrudTests() {
  console.log('====================================================');
  console.log('ProjectForge Stage 1 Project CRUD Automated Tests');
  console.log('====================================================\n');

  // SAFETY & ISOLATION CHECK:
  // We connect explicitly to 'projectforge_crud_test_db' so real accounts/projects
  // in 'projectforge_db' are NEVER modified or deleted.
  const TEST_DB_NAME = 'projectforge_crud_test_db';
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

  let studentLeader, otherStudent, supervisorUser;
  let leaderToken, otherStudentToken, supervisorToken;
  let createdProjectId;

  try {
    // Setup isolated test users in test DB
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    const timestamp = Date.now();

    studentLeader = await User.create({
      name: 'Leader Alex',
      email: `leader_${timestamp}@univ.edu`,
      passwordHash,
      accountType: 'student',
      department: 'Computer',
      studentId: `CS-${timestamp}-1`,
      semester: 6,
      skills: ['React', 'Node.js']
    });

    otherStudent = await User.create({
      name: 'Student Bob',
      email: `bob_${timestamp}@univ.edu`,
      passwordHash,
      accountType: 'student',
      department: 'Electrical',
      studentId: `EE-${timestamp}-2`,
      semester: 4,
      skills: ['Circuit Design']
    });

    supervisorUser = await User.create({
      name: 'Dr. Evelyn Clark',
      email: `prof_clark_${timestamp}@univ.edu`,
      passwordHash,
      accountType: 'supervisor',
      department: 'Computer',
      designation: 'Associate Professor',
      maxCapacity: 5
    });

    leaderToken = generateToken(studentLeader);
    otherStudentToken = generateToken(otherStudent);
    supervisorToken = generateToken(supervisorUser);

    // TEST 1: POST /api/projects - Successful project creation by student
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const createPayload = {
      title: 'Autonomous Campus Delivery Drone',
      abstract: 'A self-navigating quadcopter system designed to transport laboratory samples between academic engineering blocks safely.',
      domain: 'Multidisciplinary',
      tags: ['Robotics', 'IoT', 'Embedded C', 'React'],
      maxTeamSize: 4,
      targetCompletionDate: futureDate.toISOString(),
      repositoryUrl: 'https://github.com/alex-j/delivery-drone'
    };

    const createRes = await makeRequest(port, {
      path: '/api/projects',
      method: 'POST',
      headers: { Cookie: `token=${leaderToken}` }
    }, createPayload);

    assert(
      '1. Student creates project successfully (HTTP 201 Created)',
      createRes.statusCode === 201 && createRes.body?.success === true,
      `Status was ${createRes.statusCode}, body: ${JSON.stringify(createRes.body)}`
    );

    const projectData = createRes.body?.data?.project;
    createdProjectId = projectData?._id;

    assert(
      '2. Leader is set from authenticated session, not client input',
      projectData?.leader === studentLeader._id.toString(),
      `Leader was: ${projectData?.leader}`
    );

    assert(
      '3. Members array is initialized containing leader ID (leader counts toward team capacity)',
      Array.isArray(projectData?.members) &&
      projectData.members.length === 1 &&
      projectData.members[0] === studentLeader._id.toString(),
      `Members was: ${JSON.stringify(projectData?.members)}`
    );

    assert(
      '4. Initial status="proposed", recruitmentStatus="open", pulseScore=0, supervisor=null',
      projectData?.status === 'proposed' &&
      projectData?.recruitmentStatus === 'open' &&
      projectData?.pulseScore === 0 &&
      projectData?.supervisor === null,
      `Status/Recruitment/Pulse/Supervisor mismatch: ${JSON.stringify(projectData)}`
    );

    // TEST 2: MongoDB Persistence Check
    const dbProject = await Project.findById(createdProjectId);
    assert(
      '5. Project persists correctly in MongoDB database',
      Boolean(dbProject && dbProject.title === createPayload.title),
      `dbProject was: ${dbProject}`
    );

    // TEST 3: Unauthorized & Forbidden Creation
    const unauthCreateRes = await makeRequest(port, {
      path: '/api/projects',
      method: 'POST'
    }, createPayload);
    assert(
      '6. Unauthenticated project creation is rejected (HTTP 401 Unauthorized)',
      unauthCreateRes.statusCode === 401 && unauthCreateRes.body?.success === false,
      `Status was ${unauthCreateRes.statusCode}`
    );

    const supCreateRes = await makeRequest(port, {
      path: '/api/projects',
      method: 'POST',
      headers: { Cookie: `token=${supervisorToken}` }
    }, createPayload);
    assert(
      '7. Supervisor project creation is forbidden (HTTP 403 Forbidden)',
      supCreateRes.statusCode === 403 && supCreateRes.body?.success === false,
      `Status was ${supCreateRes.statusCode}`
    );

    // TEST 4: Creation Validation Failures
    const shortTitleRes = await makeRequest(port, {
      path: '/api/projects',
      method: 'POST',
      headers: { Cookie: `token=${leaderToken}` }
    }, { ...createPayload, title: 'Tiny' });
    assert(
      '8. Title < 5 characters rejected (HTTP 422 Unprocessable Entity)',
      shortTitleRes.statusCode === 422,
      `Status was ${shortTitleRes.statusCode}`
    );

    const pastDateRes = await makeRequest(port, {
      path: '/api/projects',
      method: 'POST',
      headers: { Cookie: `token=${leaderToken}` }
    }, { ...createPayload, targetCompletionDate: '2020-01-01T00:00:00.000Z' });
    assert(
      '9. Past targetCompletionDate rejected (HTTP 422 Unprocessable Entity)',
      pastDateRes.statusCode === 422,
      `Status was ${pastDateRes.statusCode}`
    );

    const badDomainRes = await makeRequest(port, {
      path: '/api/projects',
      method: 'POST',
      headers: { Cookie: `token=${leaderToken}` }
    }, { ...createPayload, domain: 'Astrophysics' });
    assert(
      '10. Invalid domain enum rejected (HTTP 422 Unprocessable Entity)',
      badDomainRes.statusCode === 422,
      `Status was ${badDomainRes.statusCode}`
    );

    const badTeamSizeRes = await makeRequest(port, {
      path: '/api/projects',
      method: 'POST',
      headers: { Cookie: `token=${leaderToken}` }
    }, { ...createPayload, maxTeamSize: 10 });
    assert(
      '11. Team size > 6 rejected (HTTP 422 Unprocessable Entity)',
      badTeamSizeRes.statusCode === 422,
      `Status was ${badTeamSizeRes.statusCode}`
    );

    // TEST 5: Public Discovery & Pagination (GET /api/projects)
    const listRes = await makeRequest(port, {
      path: '/api/projects?page=1&limit=10',
      method: 'GET'
    });
    assert(
      '12. Public GET /api/projects returns HTTP 200 OK with pagination',
      listRes.statusCode === 200 &&
      Array.isArray(listRes.body?.data?.projects) &&
      listRes.body?.data?.pagination?.total >= 1,
      `Body was: ${JSON.stringify(listRes.body)}`
    );

    const firstListItem = listRes.body?.data?.projects?.[0];
    assert(
      '13. Public list item sanitizes private student emails and IDs',
      firstListItem?.leader?.email === undefined && firstListItem?.leader?.studentId === undefined,
      `Found private data in public list item: ${JSON.stringify(firstListItem?.leader)}`
    );

    // TEST 6: Search & Filtering
    const searchRes = await makeRequest(port, {
      path: '/api/projects?search=Quadcopter',
      method: 'GET'
    });
    assert(
      '14. Keyword search matches projects in abstract/title/tags',
      searchRes.statusCode === 200 && searchRes.body?.data?.projects?.length >= 1,
      `Search count was: ${searchRes.body?.data?.projects?.length}`
    );

    const filterDomainRes = await makeRequest(port, {
      path: '/api/projects?domain=Multidisciplinary',
      method: 'GET'
    });
    assert(
      '15. Domain filtering matches domain correctly',
      filterDomainRes.statusCode === 200 && filterDomainRes.body?.data?.projects?.length >= 1,
      `Domain filter count was: ${filterDomainRes.body?.data?.projects?.length}`
    );

    const badPageRes = await makeRequest(port, {
      path: '/api/projects?page=0',
      method: 'GET'
    });
    assert(
      '16. Invalid pagination parameters rejected (HTTP 400 Bad Request)',
      badPageRes.statusCode === 400,
      `Status was ${badPageRes.statusCode}`
    );

    // TEST 7: Single Project View (Public vs Private)
    const publicGetRes = await makeRequest(port, {
      path: `/api/projects/${createdProjectId}`,
      method: 'GET'
    });
    assert(
      '17. Public GET /api/projects/:id returns 200 and sanitizes contact info',
      publicGetRes.statusCode === 200 &&
      publicGetRes.body?.data?.project?.leader?.email === undefined,
      `Leader in public view was: ${JSON.stringify(publicGetRes.body?.data?.project?.leader)}`
    );

    const privateGetRes = await makeRequest(port, {
      path: `/api/projects/${createdProjectId}`,
      method: 'GET',
      headers: { Cookie: `token=${leaderToken}` }
    });
    assert(
      '18. Private workspace view returns full contact details to authorized leader',
      privateGetRes.statusCode === 200 &&
      privateGetRes.body?.data?.project?.leader?.email === studentLeader.email,
      `Private view email was: ${privateGetRes.body?.data?.project?.leader?.email}`
    );

    // TEST 8: Malformed & Nonexistent ID Handling
    const malformedIdRes = await makeRequest(port, {
      path: '/api/projects/not-a-valid-id-123',
      method: 'GET'
    });
    assert(
      '19. Malformed ObjectId returns HTTP 400 Bad Request',
      malformedIdRes.statusCode === 400,
      `Status was ${malformedIdRes.statusCode}`
    );

    const fakeId = new mongoose.Types.ObjectId();
    const notFoundRes = await makeRequest(port, {
      path: `/api/projects/${fakeId}`,
      method: 'GET'
    });
    assert(
      '20. Nonexistent ObjectId returns HTTP 404 Not Found',
      notFoundRes.statusCode === 404,
      `Status was ${notFoundRes.statusCode}`
    );

    // TEST 9: Protected Field Injection via PATCH
    const injectionRes = await makeRequest(port, {
      path: `/api/projects/${createdProjectId}`,
      method: 'PATCH',
      headers: { Cookie: `token=${leaderToken}` }
    }, {
      title: 'Valid Updated Title Here',
      pulseScore: 99, // Injection attempt!
      members: []     // Injection attempt!
    });
    assert(
      '21. Protected-field injection (pulseScore, members) rejected with HTTP 422',
      injectionRes.statusCode === 422 && injectionRes.body?.success === false,
      `Status was ${injectionRes.statusCode}, body: ${JSON.stringify(injectionRes.body)}`
    );

    // TEST 10: Unauthorized & Non-Leader Update
    const nonLeaderUpdateRes = await makeRequest(port, {
      path: `/api/projects/${createdProjectId}`,
      method: 'PATCH',
      headers: { Cookie: `token=${otherStudentToken}` }
    }, { title: 'Hacked Project Title' });
    assert(
      '22. Non-leader update attempt rejected with HTTP 403 Forbidden',
      nonLeaderUpdateRes.statusCode === 403,
      `Status was ${nonLeaderUpdateRes.statusCode}`
    );

    // TEST 11: Valid Update by Leader
    const validUpdateRes = await makeRequest(port, {
      path: `/api/projects/${createdProjectId}`,
      method: 'PATCH',
      headers: { Cookie: `token=${leaderToken}` }
    }, {
      title: 'Autonomous Campus Delivery Drone v2',
      maxTeamSize: 5
    });
    assert(
      '23. Project Leader successfully updates project metadata (HTTP 200 OK)',
      validUpdateRes.statusCode === 200 &&
      validUpdateRes.body?.data?.project?.title === 'Autonomous Campus Delivery Drone v2' &&
      validUpdateRes.body?.data?.project?.maxTeamSize === 5,
      `Body was: ${JSON.stringify(validUpdateRes.body)}`
    );

    // TEST 12: Delete by Non-Leader (Forbidden)
    const nonLeaderDeleteRes = await makeRequest(port, {
      path: `/api/projects/${createdProjectId}`,
      method: 'DELETE',
      headers: { Cookie: `token=${otherStudentToken}` }
    });
    assert(
      '24. Non-leader delete attempt rejected with HTTP 403 Forbidden',
      nonLeaderDeleteRes.statusCode === 403,
      `Status was ${nonLeaderDeleteRes.statusCode}`
    );

    // TEST 13: Delete by Leader (Success)
    const leaderDeleteRes = await makeRequest(port, {
      path: `/api/projects/${createdProjectId}`,
      method: 'DELETE',
      headers: { Cookie: `token=${leaderToken}` }
    });
    assert(
      '25. Project Leader deletes project successfully (HTTP 200 OK)',
      leaderDeleteRes.statusCode === 200 && leaderDeleteRes.body?.success === true,
      `Status was ${leaderDeleteRes.statusCode}`
    );

    // Verify deletion in database
    const deletedDbProject = await Project.findById(createdProjectId);
    assert(
      '26. Project document is permanently removed from MongoDB',
      deletedDbProject === null,
      `Project still found in DB: ${deletedDbProject}`
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
    console.log(`Total CRUD Tests Passed: ${passed}`);
    console.log(`Total CRUD Tests Failed: ${failed}`);
    console.log('----------------------------------------------------\n');

    if (failed > 0) process.exit(1);
    else process.exit(0);
  }
}

runProjectCrudTests().catch(err => {
  console.error('[FATAL TEST SUITE ERROR]:', err);
  process.exit(1);
});
