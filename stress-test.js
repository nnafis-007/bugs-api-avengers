const http = require('http');

// Configuration
const TARGET_HOST = process.env.TARGET_HOST || 'localhost';
const TARGET_PORT = process.env.TARGET_PORT || 80;
const NUM_REQUESTS = parseInt(process.env.NUM_REQUESTS) || 100;
const CONCURRENT_REQUESTS = parseInt(process.env.CONCURRENT_REQUESTS) || 10;

// Store auth tokens for donation testing
let authToken = null;

// Test scenarios
const SCENARIOS = {
  'register': {
    method: 'POST',
    path: '/api/register',
    body: () => ({
      email: `testuser${Math.random().toString(36).substr(2, 9)}@test.com`,
      password: 'Test123!@#'
    })
  },
  'login': {
    method: 'POST',
    path: '/api/login',
    body: () => ({
      email: 'testuser@test.com',
      password: 'Test123!@#'
    }),
    onSuccess: (response) => {
      if (response.token) {
        authToken = response.token;
        console.log('   ✅ Auth token captured for donation testing');
      }
    }
  },
  'campaigns': {
    method: 'GET',
    path: '/api/campaigns',
    body: () => null
  },
  'campaign-detail': {
    method: 'GET',
    path: '/api/campaigns/1',
    body: () => null
  },
  'donate': {
    method: 'POST',
    path: '/api/donate',
    requiresAuth: true,
    body: () => ({
      campaignId: Math.floor(Math.random() * 3) + 1, // Campaign 1, 2, or 3
      amount: (Math.random() * 100 + 5).toFixed(2) // Random amount between $5 and $105
    }),
    headers: () => ({
      'Authorization': `Bearer ${authToken}`,
      'Idempotency-Key': `${Date.now()}-${Math.random().toString(36).substr(2, 16)}`
    })
  },
  'donate-idempotent': {
    method: 'POST',
    path: '/api/donate',
    requiresAuth: true,
    body: () => ({
      campaignId: 1,
      amount: '50.00'
    }),
    headers: () => ({
      'Authorization': `Bearer ${authToken}`,
      'Idempotency-Key': 'SAME-KEY-FOR-ALL-REQUESTS' // Test idempotency with same key
    })
  }
};

// Stats tracking
const stats = {
  total: 0,
  success: 0,
  failed: 0,
  latencies: [],
  errors: {}
};

function makeRequest(scenario) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const body = scenario.body ? JSON.stringify(scenario.body()) : null;
    const customHeaders = scenario.headers ? scenario.headers() : {};
    
    const options = {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: scenario.path,
      method: scenario.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': `stress-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...customHeaders
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const latency = Date.now() - startTime;
        stats.latencies.push(latency);
        stats.total++;
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          stats.success++;
          
          // Call onSuccess callback if provided
          if (scenario.onSuccess) {
            try {
              const parsedData = JSON.parse(data);
              scenario.onSuccess(parsedData);
            } catch (e) {
              // Ignore parse errors
            }
          }
        } else {
          stats.failed++;
          const errorKey = `${res.statusCode}`;
          stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
        }
        
        resolve({ statusCode: res.statusCode, latency, data });
      });
    });
    
    req.on('error', (error) => {
      stats.total++;
      stats.failed++;
      const errorKey = error.code || 'UNKNOWN';
      stats.errors[errorKey] = (stats.errors[errorKey] || 0) + 1;
      resolve({ error: error.message, latency: Date.now() - startTime });
    });
    
    if (body) {
      req.write(body);
    }
    
    req.end();
  });
}

async function runStressTest(scenarioName, numRequests, concurrent) {
  const scenario = SCENARIOS[scenarioName];
  if (!scenario) {
    console.error(`Unknown scenario: ${scenarioName}`);
    process.exit(1);
  }

  // Check if scenario requires authentication
  if (scenario.requiresAuth && !authToken) {
    console.log(`\n⚠️  Scenario '${scenarioName}' requires authentication. Running login first...\n`);
    const loginResult = await makeRequest(SCENARIOS['login']);
    if (loginResult.statusCode !== 200) {
      console.error(`   ❌ Login failed with status ${loginResult.statusCode}`);
      process.exit(1);
    }
    console.log(`   ✅ Login successful, proceeding with ${scenarioName}\n`);
  }

  console.log(`\n🚀 Starting stress test: ${scenarioName}`);
  console.log(`   Target: http://${TARGET_HOST}:${TARGET_PORT}${scenario.path}`);
  console.log(`   Requests: ${numRequests}`);
  console.log(`   Concurrency: ${concurrent}`);
  if (scenario.requiresAuth) {
    console.log(`   Auth: Using Bearer token`);
  }
  console.log(`   Started at: ${new Date().toISOString()}\n`);

  const startTime = Date.now();
  const batches = Math.ceil(numRequests / concurrent);

  for (let i = 0; i < batches; i++) {
    const batchSize = Math.min(concurrent, numRequests - i * concurrent);
    const requests = Array(batchSize).fill().map(() => makeRequest(scenario));
    await Promise.all(requests);
    
    // Progress indicator
    const progress = Math.min(((i + 1) * concurrent / numRequests) * 100, 100);
    process.stdout.write(`\r   Progress: ${progress.toFixed(1)}% (${stats.total}/${numRequests})`);
  }

  const totalTime = Date.now() - startTime;
  
  // Calculate statistics
  stats.latencies.sort((a, b) => a - b);
  const p50 = stats.latencies[Math.floor(stats.latencies.length * 0.5)];
  const p95 = stats.latencies[Math.floor(stats.latencies.length * 0.95)];
  const p99 = stats.latencies[Math.floor(stats.latencies.length * 0.99)];
  const avgLatency = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
  const minLatency = stats.latencies[0];
  const maxLatency = stats.latencies[stats.latencies.length - 1];
  const rps = (stats.total / totalTime * 1000).toFixed(2);

  console.log(`\n\n📊 Results Summary:`);
  console.log(`   ─────────────────────────────────────────`);
  console.log(`   Total Time:        ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`   Total Requests:    ${stats.total}`);
  console.log(`   Successful:        ${stats.success} (${(stats.success / stats.total * 100).toFixed(1)}%)`);
  console.log(`   Failed:            ${stats.failed} (${(stats.failed / stats.total * 100).toFixed(1)}%)`);
  console.log(`   Requests/sec:      ${rps}`);
  console.log(`\n   Latency (ms):`);
  console.log(`   ─────────────────────────────────────────`);
  console.log(`   Min:               ${minLatency}ms`);
  console.log(`   Average:           ${avgLatency.toFixed(2)}ms`);
  console.log(`   P50 (median):      ${p50}ms`);
  console.log(`   P95:               ${p95}ms`);
  console.log(`   P99:               ${p99}ms`);
  console.log(`   Max:               ${maxLatency}ms`);

  if (Object.keys(stats.errors).length > 0) {
    console.log(`\n   Errors:`);
    console.log(`   ─────────────────────────────────────────`);
    Object.entries(stats.errors).forEach(([code, count]) => {
      console.log(`   ${code}: ${count}`);
    });
  }

  console.log(`\n   ✅ Test completed at: ${new Date().toISOString()}`);
  console.log(`\n   📝 Check monitoring dashboards:`);
  console.log(`      - Grafana: http://localhost/grafana`);
  console.log(`      - Prometheus: http://localhost/prometheus`);
  console.log(`      - Jaeger: http://localhost:16686`);
  console.log(`      - Kibana: http://localhost/kibana\n`);
}

// Parse command line arguments
const scenarioName = process.argv[2] || 'campaigns';
const numRequests = parseInt(process.argv[3]) || NUM_REQUESTS;
const concurrent = parseInt(process.argv[4]) || CONCURRENT_REQUESTS;

// Run the test
runStressTest(scenarioName, numRequests, concurrent)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
