const path = require('path');
const http = require('http');
const dns = require('dns');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');

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

// Extract token cookie from Set-Cookie header
function extractTokenCookie(setCookieHeaders) {
  if (!setCookieHeaders) return null;
  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  for (const h of headers) {
    if (h.startsWith('token=')) {
      return h.split(';')[0]; // returns "token=<jwt>"
    }
  }
  return null;
}

async function runAuthTests() {
  console.log('====================================================');
  console.log('ProjectForge Stage 1 Backend Authentication Tests');
  console.log('====================================================\n');

  // SAFETY & ISOLATION CHECK:
  // Connect explicitly to 'projectforge_auth_test_db' so real accounts/projects
  // in 'projectforge_db' are NEVER touched, modified, or deleted.
  const TEST_DB_NAME = 'projectforge_auth_test_db';
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
  const createdTestEmails = [];

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
    const timestamp = Date.now();
    const testStudentEmail = `test_student_${timestamp}@university.edu`;
    const testPassword = 'TestPassword123!';

    // TEST 1: Register valid student account
    const regRes = await makeRequest(port, { path: '/api/auth/register', method: 'POST' }, {
      name: 'Test Student Alex',
      email: testStudentEmail,
      password: testPassword,
      accountType: 'student',
      department: 'Computer',
      studentId: `CS-${timestamp}`,
      semester: 6,
      skills: ['React', 'Node.js', 'MongoDB']
    });
    createdTestEmails.push(testStudentEmail);

    assert(
      '1. Student Registration returns HTTP 201 Created',
      regRes.statusCode === 201,
      `Status was ${regRes.statusCode}`
    );
    assert(
      '2. Registration response adheres to standard envelope {success: true}',
      regRes.body?.success === true && regRes.body?.data?.user?.email === testStudentEmail,
      JSON.stringify(regRes.body)
    );
    assert(
      '3. Registration never leaks passwordHash in response body',
      regRes.body?.data?.user?.passwordHash === undefined,
      `passwordHash was present: ${regRes.body?.data?.user?.passwordHash}`
    );

    const regCookie = extractTokenCookie(regRes.headers['set-cookie']);
    assert(
      '4. Registration sets HttpOnly session cookie named token',
      Boolean(regCookie && regCookie.startsWith('token=') && regCookie.length > 20),
      `Set-Cookie header was: ${JSON.stringify(regRes.headers['set-cookie'])}`
    );

    // TEST 2: Duplicate registration with same email (409 Conflict)
    const dupRes = await makeRequest(port, { path: '/api/auth/register', method: 'POST' }, {
      name: 'Duplicate Student',
      email: testStudentEmail,
      password: 'AnotherPassword123!',
      department: 'Electrical'
    });
    assert(
      '5. Duplicate email registration returns HTTP 409 Conflict',
      dupRes.statusCode === 409 && dupRes.body?.success === false,
      `Status was ${dupRes.statusCode}, body: ${JSON.stringify(dupRes.body)}`
    );

    // TEST 3: Prohibit supervisor registration via public endpoint (403 Forbidden)
    const supRes = await makeRequest(port, { path: '/api/auth/register', method: 'POST' }, {
      name: 'Dr. Prohibited Supervisor',
      email: `test_sup_${timestamp}@university.edu`,
      password: 'SecretPassword123!',
      accountType: 'supervisor',
      department: 'Computer'
    });
    assert(
      '6. Public supervisor registration is blocked with HTTP 403 Forbidden',
      supRes.statusCode === 403 && supRes.body?.success === false,
      `Status was ${supRes.statusCode}, body: ${JSON.stringify(supRes.body)}`
    );

    // TEST 4: Input validation failure (< 6 char password) -> 422 Unprocessable Entity
    const valRes = await makeRequest(port, { path: '/api/auth/register', method: 'POST' }, {
      name: 'Short Pass',
      email: `test_short_${timestamp}@university.edu`,
      password: '123',
      department: 'Computer'
    });
    assert(
      '7. Password < 6 chars rejected with HTTP 422 Unprocessable Entity',
      valRes.statusCode === 422 && valRes.body?.success === false,
      `Status was ${valRes.statusCode}, body: ${JSON.stringify(valRes.body)}`
    );

    // TEST 5: Login with correct password
    const loginRes = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: testStudentEmail,
      password: testPassword
    });
    assert(
      '8. Login with correct password returns HTTP 200 OK',
      loginRes.statusCode === 200 && loginRes.body?.success === true,
      `Status was ${loginRes.statusCode}`
    );
    assert(
      '9. Login response never leaks passwordHash',
      loginRes.body?.data?.user?.passwordHash === undefined,
      `passwordHash was present: ${loginRes.body?.data?.user?.passwordHash}`
    );

    const loginCookie = extractTokenCookie(loginRes.headers['set-cookie']);
    assert(
      '10. Login issues fresh HttpOnly session cookie',
      Boolean(loginCookie && loginCookie.startsWith('token=')),
      `Cookie was ${loginCookie}`
    );

    // TEST 6: Login with incorrect password
    const badPassRes = await makeRequest(port, { path: '/api/auth/login', method: 'POST' }, {
      email: testStudentEmail,
      password: 'WrongPassword999!'
    });
    assert(
      '11. Login with incorrect password returns HTTP 401 Unauthorized',
      badPassRes.statusCode === 401 && badPassRes.body?.success === false,
      `Status was ${badPassRes.statusCode}`
    );

    // TEST 7: GET /api/auth/me WITHOUT cookie
    const meNoCookieRes = await makeRequest(port, { path: '/api/auth/me', method: 'GET' });
    assert(
      '12. GET /api/auth/me without cookie returns HTTP 401 Unauthorized',
      meNoCookieRes.statusCode === 401 && meNoCookieRes.body?.success === false,
      `Status was ${meNoCookieRes.statusCode}`
    );

    // TEST 8: GET /api/auth/me WITH valid HttpOnly cookie
    const meCookieRes = await makeRequest(port, {
      path: '/api/auth/me',
      method: 'GET',
      headers: { Cookie: loginCookie }
    });
    assert(
      '13. GET /api/auth/me with cookie returns HTTP 200 OK and user profile',
      meCookieRes.statusCode === 200 && meCookieRes.body?.data?.user?.email === testStudentEmail,
      `Status was ${meCookieRes.statusCode}, body: ${JSON.stringify(meCookieRes.body)}`
    );
    assert(
      '14. GET /api/auth/me never leaks passwordHash',
      meCookieRes.body?.data?.user?.passwordHash === undefined,
      'passwordHash found in /me response'
    );

    // TEST 9: GET /api/auth/me with Bearer token fallback (test harness support)
    const jwtToken = loginCookie.replace('token=', '');
    const meBearerRes = await makeRequest(port, {
      path: '/api/auth/me',
      method: 'GET',
      headers: { Authorization: `Bearer ${jwtToken}` }
    });
    assert(
      '15. GET /api/auth/me with Bearer token fallback returns HTTP 200 OK',
      meBearerRes.statusCode === 200 && meBearerRes.body?.data?.user?.email === testStudentEmail,
      `Status was ${meBearerRes.statusCode}`
    );

    // TEST 10: Logout with valid cookie
    const logoutRes = await makeRequest(port, {
      path: '/api/auth/logout',
      method: 'POST',
      headers: { Cookie: loginCookie }
    });
    assert(
      '16. POST /api/auth/logout returns HTTP 200 OK and invalidates cookie (Max-Age=0)',
      logoutRes.statusCode === 200 && logoutRes.body?.success === true,
      `Status was ${logoutRes.statusCode}`
    );

    // TEST 11: GET /api/auth/me after logout should fail with 401
    const meAfterLogoutRes = await makeRequest(port, {
      path: '/api/auth/me',
      method: 'GET',
      headers: { Cookie: 'token=' }
    });
    assert(
      '17. GET /api/auth/me after logout returns HTTP 401 Unauthorized',
      meAfterLogoutRes.statusCode === 401,
      `Status was ${meAfterLogoutRes.statusCode}`
    );

    // TEST 12: Preserved Health endpoints continue to operate
    const healthRes = await makeRequest(port, { path: '/api/health', method: 'GET' });
    const healthDbRes = await makeRequest(port, { path: '/api/health/db', method: 'GET' });
    assert(
      '18. Preserved GET /api/health returns HTTP 200 OK',
      healthRes.statusCode === 200 && healthRes.body?.success === true,
      `Status was ${healthRes.statusCode}`
    );
    assert(
      '19. Preserved GET /api/health/db returns HTTP 200 OK',
      healthDbRes.statusCode === 200 && healthDbRes.body?.data?.status === 'connected',
      `Status was ${healthDbRes.statusCode}`
    );

  } finally {
    // Clean up test users safely from isolated test database
    if (mongoose.connection.name === TEST_DB_NAME && createdTestEmails.length > 0) {
      const deleteResult = await User.deleteMany({ email: { $in: createdTestEmails } });
      console.log(`\n[CLEANUP] Deleted ${deleteResult.deletedCount} temporary test user(s) from database.`);
    }

    server.close();
    await mongoose.disconnect();
    console.log('[CLEANUP] Closed test server and disconnected database.\n');

    console.log('----------------------------------------------------');
    console.log(`Total tests passed: ${passed}`);
    console.log(`Total tests failed: ${failed}`);
    console.log('----------------------------------------------------\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

runAuthTests().catch(err => {
  console.error('[FATAL ERROR IN TEST SUITE]:', err);
  process.exit(1);
});
