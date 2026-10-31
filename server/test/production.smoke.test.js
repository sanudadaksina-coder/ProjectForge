const http = require('http');
const path = require('path');
const fs = require('fs');

// Ensure NODE_ENV is set to production for smoke tests
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'test_production_jwt_secret_12345';

const app = require('../src/app');
const { setTokenCookie } = require('../src/utils/token');

function makeRequest(port, options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port,
      path: options.path,
      method: options.method || 'GET',
      headers: {
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
          json = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json,
          rawBody: data
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

async function runProductionSmokeTests() {
  console.log('===================================================================');
  console.log('ProjectForge: Stage 4A Production Deployment Smoke Test Suite');
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

  // 1. Verify client/dist exists before testing
  const clientDist = path.join(__dirname, '../../client/dist');
  const indexHtmlPath = path.join(clientDist, 'index.html');
  assert('01. client/dist directory exists', fs.existsSync(clientDist));
  assert('02. client/dist/index.html compiled bundle exists', fs.existsSync(indexHtmlPath));

  const server = app.listen(0);
  const port = server.address().port;
  console.log(`[INFO] Ephemeral production test server running on port ${port}\n`);

  try {
    // 2. Test Root Route (/) serves compiled React index.html
    const rootRes = await makeRequest(port, { path: '/' });
    assert(
      '03. GET / returns HTTP 200 OK',
      rootRes.statusCode === 200,
      `Status: ${rootRes.statusCode}`
    );
    assert(
      '04. GET / Content-Type is text/html',
      (rootRes.headers['content-type'] || '').includes('text/html')
    );
    assert(
      '05. GET / serves compiled index.html containing root div and Vite assets',
      rootRes.rawBody.includes('<div id="root">') && rootRes.rawBody.includes('ProjectForge')
    );

    // 3. Test React Router Direct Browser Refresh (SPA Fallback)
    const routesToTest = ['/projects', '/dashboard', '/supervisors', '/register', '/login', '/projects/660000000000000000000001'];
    for (let i = 0; i < routesToTest.length; i++) {
      const r = routesToTest[i];
      const res = await makeRequest(port, { path: r });
      assert(
        `06.${i + 1} Direct browser refresh on "${r}" serves index.html with HTTP 200`,
        res.statusCode === 200 &&
        (res.headers['content-type'] || '').includes('text/html') &&
        res.rawBody.includes('<div id="root">')
      );
    }

    // 4. Test API Health Endpoint
    const healthRes = await makeRequest(port, { path: '/api/health' });
    assert(
      '07. GET /api/health returns HTTP 200 OK JSON in production',
      healthRes.statusCode === 200 &&
      healthRes.body?.success === true &&
      healthRes.body?.data?.status === 'up'
    );
    assert(
      '08. GET /api/health reports environment as production',
      healthRes.body?.data?.environment === 'production'
    );

    // 5. Test Unknown /api Route strictly returns 404 JSON, NOT HTML
    const unknownApiRes = await makeRequest(port, { path: '/api/nonexistent-endpoint' });
    assert(
      '09. GET /api/nonexistent-endpoint returns HTTP 404',
      unknownApiRes.statusCode === 404
    );
    assert(
      '10. GET /api/nonexistent-endpoint returns application/json (STRICTLY NOT HTML)',
      (unknownApiRes.headers['content-type'] || '').includes('application/json')
    );
    assert(
      '11. GET /api/nonexistent-endpoint preserves standardized API error envelope',
      unknownApiRes.body?.success === false &&
      unknownApiRes.body?.errors?.[0]?.message === 'The requested API route was not found.'
    );

    // Test POST to unknown /api route
    const unknownApiPost = await makeRequest(port, { path: '/api/unknown-action', method: 'POST' }, { foo: 'bar' });
    assert(
      '12. POST /api/unknown-action returns HTTP 404 JSON error',
      unknownApiPost.statusCode === 404 &&
      unknownApiPost.body?.success === false
    );

    // 6. Test Static Asset Serving
    const distFiles = fs.readdirSync(path.join(clientDist, 'assets'));
    const cssFile = distFiles.find(f => f.endsWith('.css'));
    const jsFile = distFiles.find(f => f.endsWith('.js'));

    if (cssFile) {
      const cssRes = await makeRequest(port, { path: `/assets/${cssFile}` });
      assert(
        `13. Static CSS (/assets/${cssFile}) served with HTTP 200 text/css`,
        cssRes.statusCode === 200 && (cssRes.headers['content-type'] || '').includes('text/css')
      );
    }

    if (jsFile) {
      const jsRes = await makeRequest(port, { path: `/assets/${jsFile}` });
      assert(
        `14. Static JS (/assets/${jsFile}) served with HTTP 200 javascript`,
        jsRes.statusCode === 200 &&
        ((jsRes.headers['content-type'] || '').includes('javascript') ||
         (jsRes.headers['content-type'] || '').includes('application/javascript'))
      );
    }

    // 7. Verify Trust Proxy Configuration
    assert(
      '15. Express trust proxy is enabled in production (value: 1)',
      app.get('trust proxy') === 1
    );

    // 8. Verify Authentication Cookie Configuration for Production
    const mockRes = {
      cookieCalls: [],
      cookie(name, val, opts) {
        this.cookieCalls.push({ name, val, opts });
      }
    };
    setTokenCookie(mockRes, 'dummy_token_production');
    const cookieCall = mockRes.cookieCalls[0];
    assert(
      '16. Production cookie has httpOnly: true',
      cookieCall?.opts?.httpOnly === true
    );
    assert(
      '17. Production cookie has secure: true (strictly enforced over HTTPS)',
      cookieCall?.opts?.secure === true
    );
    assert(
      '18. Production cookie has sameSite: "strict" for single-origin deployment',
      cookieCall?.opts?.sameSite === 'strict'
    );

    // 9. Verify Non-GET Unknown Route outside /api returns 404 JSON
    const postUnknown = await makeRequest(port, { path: '/unknown-path', method: 'POST' });
    assert(
      '19. POST /unknown-path returns HTTP 404 JSON',
      postUnknown.statusCode === 404 &&
      postUnknown.body?.success === false
    );

  } finally {
    server.close();
  }

  console.log('\n===================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed across ${passed + failed} assertions.`);
  console.log('===================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runProductionSmokeTests().catch(err => {
    console.error('Smoke tests crashed:', err);
    process.exit(1);
  });
}

module.exports = runProductionSmokeTests;

