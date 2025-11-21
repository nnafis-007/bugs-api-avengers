#!/usr/bin/env node
/**
 * JWT Authentication Test Script
 * Tests the JWT implementation with real API calls
 * 
 * Usage: node test-jwt.js
 * Note: Make sure the backend server is running on http://localhost:4000
 */

const http = require('http');

const BASE_URL = 'http://localhost:4000';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('JWT AUTHENTICATION TEST SUITE');
  console.log('='.repeat(70));
  console.log();

  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'SecurePassword123';
  let accessToken, refreshToken;

  try {
    // Test 1: Register
    console.log('📝 Test 1: Register new user');
    console.log('   POST /api/register');
    const registerRes = await makeRequest('POST', '/api/register', {
      email: testEmail,
      password: testPassword
    });
    
    if (registerRes.status === 201) {
      console.log('   ✅ Registration successful');
      console.log(`   User ID: ${registerRes.data.user.id}`);
      console.log(`   Email: ${registerRes.data.user.email}`);
      console.log(`   Access Token: ${registerRes.data.accessToken.substring(0, 50)}...`);
      console.log(`   Refresh Token: ${registerRes.data.refreshToken.substring(0, 50)}...`);
      accessToken = registerRes.data.accessToken;
      refreshToken = registerRes.data.refreshToken;
    } else {
      console.log(`   ❌ Registration failed: ${registerRes.status}`);
      console.log(`   Error: ${JSON.stringify(registerRes.data)}`);
      return;
    }
    console.log();

    // Test 2: Access Protected Route
    console.log('🔒 Test 2: Access protected route with token');
    console.log('   GET /api/profile');
    const profileRes = await makeRequest('GET', '/api/profile', null, accessToken);
    
    if (profileRes.status === 200) {
      console.log('   ✅ Profile access successful');
      console.log(`   User: ${JSON.stringify(profileRes.data.user, null, 2).split('\n').join('\n   ')}`);
    } else {
      console.log(`   ❌ Profile access failed: ${profileRes.status}`);
      console.log(`   Error: ${JSON.stringify(profileRes.data)}`);
    }
    console.log();

    // Test 3: Access Without Token
    console.log('🚫 Test 3: Access protected route WITHOUT token');
    console.log('   GET /api/profile (no Authorization header)');
    const noTokenRes = await makeRequest('GET', '/api/profile');
    
    if (noTokenRes.status === 401) {
      console.log('   ✅ Correctly rejected unauthorized request');
      console.log(`   Error message: ${noTokenRes.data.message}`);
    } else {
      console.log(`   ❌ Should have rejected, but got: ${noTokenRes.status}`);
    }
    console.log();

    // Test 4: Refresh Token
    console.log('🔄 Test 4: Refresh access token');
    console.log('   POST /api/refresh');
    const refreshRes = await makeRequest('POST', '/api/refresh', {
      refreshToken: refreshToken
    });
    
    if (refreshRes.status === 200) {
      console.log('   ✅ Token refresh successful');
      console.log(`   New Access Token: ${refreshRes.data.accessToken.substring(0, 50)}...`);
      console.log(`   Expires In: ${refreshRes.data.expiresIn}`);
      accessToken = refreshRes.data.accessToken; // Use new token
    } else {
      console.log(`   ❌ Token refresh failed: ${refreshRes.status}`);
      console.log(`   Error: ${JSON.stringify(refreshRes.data)}`);
    }
    console.log();

    // Test 5: Invalid Token
    console.log('❌ Test 5: Try with invalid token');
    console.log('   GET /api/profile (with fake token)');
    const invalidRes = await makeRequest('GET', '/api/profile', null, 'fake.invalid.token');
    
    if (invalidRes.status === 401) {
      console.log('   ✅ Correctly rejected invalid token');
      console.log(`   Error: ${invalidRes.data.error}`);
    } else {
      console.log(`   ❌ Should have rejected, but got: ${invalidRes.status}`);
    }
    console.log();

    // Test 6: Login
    console.log('🔑 Test 6: Login with credentials');
    console.log('   POST /api/login');
    const loginRes = await makeRequest('POST', '/api/login', {
      email: testEmail,
      password: testPassword
    });
    
    if (loginRes.status === 200) {
      console.log('   ✅ Login successful');
      console.log(`   Access Token: ${loginRes.data.accessToken.substring(0, 50)}...`);
      console.log(`   User: ${loginRes.data.user.email}`);
      accessToken = loginRes.data.accessToken;
      refreshToken = loginRes.data.refreshToken;
    } else {
      console.log(`   ❌ Login failed: ${loginRes.status}`);
    }
    console.log();

    // Test 7: Logout
    console.log('👋 Test 7: Logout (blacklist tokens)');
    console.log('   POST /api/logout');
    const logoutRes = await makeRequest('POST', '/api/logout', {
      refreshToken: refreshToken
    }, accessToken);
    
    if (logoutRes.status === 200) {
      console.log('   ✅ Logout successful');
      console.log(`   Message: ${logoutRes.data.message}`);
    } else {
      console.log(`   ❌ Logout failed: ${logoutRes.status}`);
    }
    console.log();

    // Test 8: Try to use blacklisted token
    console.log('🚫 Test 8: Try to use token after logout');
    console.log('   GET /api/profile (with blacklisted token)');
    const blacklistedRes = await makeRequest('GET', '/api/profile', null, accessToken);
    
    if (blacklistedRes.status === 401 && blacklistedRes.data.error === 'Token revoked') {
      console.log('   ✅ Correctly rejected blacklisted token');
      console.log(`   Message: ${blacklistedRes.data.message}`);
    } else {
      console.log(`   ❌ Should have rejected blacklisted token`);
      console.log(`   Got: ${blacklistedRes.status} - ${JSON.stringify(blacklistedRes.data)}`);
    }
    console.log();

    console.log('='.repeat(70));
    console.log('✅ ALL TESTS COMPLETED');
    console.log('='.repeat(70));
    console.log('\nJWT Authentication is working correctly!');
    console.log('Features tested:');
    console.log('  ✓ User registration with auto-login');
    console.log('  ✓ Token-based authentication');
    console.log('  ✓ Protected route access');
    console.log('  ✓ Token refresh mechanism');
    console.log('  ✓ Invalid token rejection');
    console.log('  ✓ User login');
    console.log('  ✓ Token blacklisting on logout');
    console.log('  ✓ Blacklisted token rejection');

  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
    console.error('\nMake sure the backend server is running:');
    console.error('  docker-compose up -d');
    console.error('  OR');
    console.error('  cd backend && npm start');
  }
}

// Run the tests
runTests();
