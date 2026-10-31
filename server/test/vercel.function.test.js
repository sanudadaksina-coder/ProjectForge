const fs = require('fs');
const path = require('path');
const http = require('http');

// Set NODE_ENV to production to test production behaviors
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'test_vercel_jwt_secret_value_12345';

const vercelHandler = require('../../api/index');
const { setTokenCookie } = require('../src/utils/token');

// Helper to make HTTP requests against a local test server wrapping the Vercel handler
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

async function runVercelDeploymentTests() {
  console.log('===================================================================');
  console.log('ProjectForge: Stage 4B Vercel Hobby Serverless Test Suite');
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

  // --- Suite 1: File Architecture & Vercel Configuration Verification ---
  console.log('--- Suite 1: Configuration & Specification Verification ---');

  const vercelJsonPath = path.join(__dirname, '../../vercel.json');
  assert('01. vercel.json configuration file exists at repository root', fs.existsSync(vercelJsonPath));

  let vercelConfig = {};
  try {
    vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
    assert('02. vercel.json is valid JSON', true);
  } catch (err) {
    assert('02. vercel.json is valid JSON', false, err.message);
  }

  assert(
    '03. vercel.json specifies framework as "vite"',
    vercelConfig.framework === 'vite',
    `Framework: ${vercelConfig.framework}`
  );

  assert(
    '04. vercel.json output directory is "client/dist"',
    vercelConfig.outputDirectory === 'client/dist',
    `OutputDirectory: ${vercelConfig.outputDirectory}`
  );

  assert(
    '05. vercel.json regions specifies ["bom1"] (Mumbai - co-located with Atlas ap-south-1)',
    Array.isArray(vercelConfig.regions) && vercelConfig.regions.includes('bom1'),
    `Regions: ${JSON.stringify(vercelConfig.regions)}`
  );

  const rewrites = vercelConfig.rewrites || [];
  const apiWildcardRewrite = rewrites.find(r => r.source === '/api/(.*)' && r.destination === '/api/index.js');
  const apiRootRewrite = rewrites.find(r => r.source === '/api' && r.destination === '/api/index.js');
  const spaFallbackRewrite = rewrites.find(r => r.source === '/(.*)' && r.destination === '/index.html');

  assert(
    '06. vercel.json rewrites route "/api/(.*)" to "/api/index.js"',
    Boolean(apiWildcardRewrite),
    `Rewrites: ${JSON.stringify(rewrites)}`
  );

  assert(
    '07. vercel.json rewrites route "/api" to "/api/index.js"',
    Boolean(apiRootRewrite),
    `Rewrites: ${JSON.stringify(rewrites)}`
  );

  assert(
    '08. vercel.json includes SPA fallback rewrite "/(.*)" to "/index.html"',
    Boolean(spaFallbackRewrite),
    `Rewrites: ${JSON.stringify(rewrites)}`
  );

  const rootPkgPath = path.join(__dirname, '../../package.json');
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
  assert(
    '09. Root package.json defines backend dependencies (express, mongoose, etc.) for Vercel bundling',
    Boolean(rootPkg.dependencies && rootPkg.dependencies.express && rootPkg.dependencies.mongoose),
    `Dependencies: ${JSON.stringify(rootPkg.dependencies)}`
  );

  assert(
    '10. Root package.json build script compiles client',
    rootPkg.scripts && rootPkg.scripts.build && rootPkg.scripts.build.includes('client'),
    `Build script: ${rootPkg.scripts?.build}`
  );

  // --- Suite 2: Vercel Function Entry Point & Adapter Verification ---
  console.log('\n--- Suite 2: Vercel Function Entry Point & Adapter Verification ---');

  const apiIndexPath = path.join(__dirname, '../../api/index.js');
  assert('11. api/index.js serverless entry point exists at root', fs.existsSync(apiIndexPath));

  assert(
    '12. api/index.js exports a callable serverless request handler',
    typeof vercelHandler === 'function',
    `Type: ${typeof vercelHandler}`
  );

  assert(
    '13. api/index.js exposes the underlying Express app instance',
    Boolean(vercelHandler.app && typeof vercelHandler.app === 'function')
  );

  // Pre-warm the database connection to prime the serverless cache
  const connectDB = require('../src/config/db');
  await connectDB();

  // Create an ephemeral HTTP server invoking the vercelHandler directly (simulating Vercel Function runtime)
  const server = http.createServer(async (req, res) => {
    try {
      await vercelHandler(req, res);
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`[INFO] Ephemeral Vercel runtime simulation server running on port ${port}\n`);

  try {
    // --- Suite 3: API Routing & Isolation Verification ---
    console.log('--- Suite 3: API Routing & 404 Isolation Verification ---');

    // 14. GET /api/health
    const healthRes = await makeRequest(port, { path: '/api/health' });
    assert(
      '14. GET /api/health returns HTTP 200 OK via Vercel Function handler',
      healthRes.statusCode === 200,
      `Status: ${healthRes.statusCode}`
    );
    assert(
      '15. GET /api/health returns JSON content-type',
      (healthRes.headers['content-type'] || '').includes('application/json'),
      `Content-Type: ${healthRes.headers['content-type']}`
    );
    assert(
      '16. GET /api/health returns success: true and status: "up"',
      healthRes.body && healthRes.body.success === true && healthRes.body.data?.status === 'up',
      `Body: ${JSON.stringify(healthRes.body)}`
    );

    // 17. GET /api/health/db
    const dbHealthRes = await makeRequest(port, { path: '/api/health/db' });
    assert(
      '17. GET /api/health/db executes without crashing (returns 200 or 503 JSON)',
      dbHealthRes.statusCode === 200 || dbHealthRes.statusCode === 503,
      `Status: ${dbHealthRes.statusCode}`
    );
    assert(
      '18. GET /api/health/db strictly returns JSON content-type',
      (dbHealthRes.headers['content-type'] || '').includes('application/json')
    );

    // 19. GET /api/supervisors (Unauthenticated access check)
    const supervisorsRes = await makeRequest(port, { path: '/api/supervisors' });
    assert(
      '19. GET /api/supervisors routes to supervisorController via Vercel Function (HTTP 401 unauth guard)',
      supervisorsRes.statusCode === 401,
      `Status: ${supervisorsRes.statusCode}`
    );
    assert(
      '20. GET /api/supervisors returns JSON error structure',
      supervisorsRes.body && supervisorsRes.body.success === false
    );

    // 21. Unknown API route isolation (STRICT 404 JSON, NEVER HTML)
    const unknownApiRes = await makeRequest(port, { path: '/api/nonexistent-route-xyz' });
    assert(
      '21. GET /api/nonexistent-route-xyz returns HTTP 404',
      unknownApiRes.statusCode === 404,
      `Status: ${unknownApiRes.statusCode}`
    );
    assert(
      '22. Unknown /api route strictly returns application/json (STRICTLY NOT HTML)',
      (unknownApiRes.headers['content-type'] || '').includes('application/json'),
      `Content-Type: ${unknownApiRes.headers['content-type']}`
    );
    assert(
      '23. Unknown /api route preserves standardized API error envelope',
      unknownApiRes.body && unknownApiRes.body.success === false && Array.isArray(unknownApiRes.body.errors)
    );

    // 24. POST /api/unknown-action
    const postUnknownRes = await makeRequest(port, { path: '/api/unknown-action', method: 'POST' });
    assert(
      '24. POST /api/unknown-action returns HTTP 404 JSON error',
      postUnknownRes.statusCode === 404 && (postUnknownRes.headers['content-type'] || '').includes('application/json')
    );

    // --- Suite 4: MongoDB Connection Caching & Serverless Resilience ---
    console.log('\n--- Suite 4: MongoDB Connection Caching & Resilience ---');

    const connectDB = require('../src/config/db');
    assert(
      '25. connectDB is a callable async function',
      typeof connectDB === 'function'
    );

    // Verify global.mongoose caching structure exists
    assert(
      '26. global.mongoose cache object is initialized',
      Boolean(global.mongoose && typeof global.mongoose === 'object')
    );

    // Test that connectDB handles missing MONGO_URI gracefully by throwing an error rather than calling process.exit()
    const originalMongoUri = process.env.MONGO_URI;
    try {
      delete process.env.MONGO_URI;
      let didThrow = false;
      try {
        // Temporarily reset readyState check for this test
        const mongoose = require('mongoose');
        const origReadyState = mongoose.connection.readyState;
        if (origReadyState === 0) {
          await connectDB();
        } else {
          // If already connected, test that connectDB returns the active connection without reconnecting
          const conn = await connectDB();
          assert(
            '27. connectDB reuses active connection when readyState === 1',
            conn && conn.readyState === 1
          );
        }
      } catch (e) {
        didThrow = true;
        assert(
          '27. connectDB throws an error on missing MONGO_URI without calling process.exit(1)',
          didThrow && e.message.includes('MONGO_URI')
        );
      }
    } finally {
      process.env.MONGO_URI = originalMongoUri;
    }

    // --- Suite 5: Production Cookie Security for Same-Origin Vercel Deployment ---
    console.log('\n--- Suite 5: Production Cookie Security Verification ---');

    const mockRes = {
      cookieCalls: [],
      cookie(name, value, options) {
        this.cookieCalls.push({ name, value, options });
      }
    };

    setTokenCookie(mockRes, 'test_mock_jwt_token_payload');
    const cookieCall = mockRes.cookieCalls[0];

    assert(
      '28. Production token cookie has httpOnly: true (prevents XSS theft)',
      cookieCall && cookieCall.options?.httpOnly === true
    );

    assert(
      '29. Production token cookie has secure: true (strictly enforced over Vercel HTTPS)',
      cookieCall && cookieCall.options?.secure === true
    );

    assert(
      '30. Production token cookie has sameSite: "strict" (protects CSRF on same-origin Vercel domain)',
      cookieCall && cookieCall.options?.sameSite === 'strict'
    );

    assert(
      '31. Production token cookie has maxAge set to 24 hours (86,400,000 ms)',
      cookieCall && cookieCall.options?.maxAge === 86400000
    );

    // --- Suite 6: Compiled Client Bundle Verification ---
    console.log('\n--- Suite 6: Compiled Client Bundle Verification ---');

    const clientDist = path.join(__dirname, '../../client/dist');
    const clientIndexHtml = path.join(clientDist, 'index.html');
    assert('32. client/dist compiled directory exists for Vercel CDN deployment', fs.existsSync(clientDist));
    assert('33. client/dist/index.html compiled bundle exists', fs.existsSync(clientIndexHtml));

    const htmlContent = fs.readFileSync(clientIndexHtml, 'utf8');
    assert(
      '34. client/dist/index.html includes root React container element',
      htmlContent.includes('<div id="root">')
    );
    assert(
      '35. client/dist/index.html references compiled Vite assets',
      htmlContent.includes('/assets/')
    );

  } finally {
    server.close();
    try {
      const mongoose = require('mongoose');
      await mongoose.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  }

  console.log('\n===================================================================');
  console.log(`Results: ${passed} passed, ${failed} failed across ${passed + failed} assertions.`);
  console.log('===================================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runVercelDeploymentTests().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
