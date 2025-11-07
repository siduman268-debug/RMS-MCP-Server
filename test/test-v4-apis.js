/**
 * V4 API Test Script
 * Run with: node test/test-v4-apis.js
 * 
 * Prerequisites:
 * - Set API_BASE_URL, JWT_TOKEN, TENANT_ID environment variables
 * - Or modify the constants below
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const JWT_TOKEN = process.env.JWT_TOKEN || 'YOUR_TOKEN_HERE';
const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001';

const headers = {
  'Authorization': `Bearer ${JWT_TOKEN}`,
  'x-tenant-id': TENANT_ID,
  'Content-Type': 'application/json'
};

async function testAPI(name, endpoint, method, body) {
  console.log(`\n🧪 Testing: ${name}`);
  console.log(`   ${method} ${endpoint}`);
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`   ✅ SUCCESS (${response.status})`);
      console.log(`   Response keys: ${Object.keys(data).join(', ')}`);
      return { success: true, data };
    } else {
      console.log(`   ❌ FAILED (${response.status})`);
      console.log(`   Error: ${JSON.stringify(data, null, 2)}`);
      return { success: false, error: data };
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('V4 API TEST SUITE');
  console.log('='.repeat(60));
  console.log(`Base URL: ${API_BASE_URL}`);
  console.log(`Tenant ID: ${TENANT_ID}`);

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: V4 Search Rates - Basic
  const test1 = await testAPI(
    'V4 Search Rates - Basic',
    '/api/v4/search-rates',
    'POST',
    {
      origin: 'INNSA',
      destination: 'NLRTM',
      container_type: '40HC'
    }
  );
  results.tests.push({ name: 'V4 Search Rates - Basic', ...test1 });
  if (test1.success) results.passed++; else results.failed++;

  // Test 2: V4 Search Rates - With Earliest Departure
  const test2 = await testAPI(
    'V4 Search Rates - With Earliest Departure',
    '/api/v4/search-rates',
    'POST',
    {
      origin: 'INNSA',
      destination: 'NLRTM',
      container_type: '40HC',
      include_earliest_departure: true
    }
  );
  results.tests.push({ name: 'V4 Search Rates - Earliest Departure', ...test2 });
  if (test2.success) results.passed++; else results.failed++;

  // Test 3: V4 Prepare Quote - Basic
  const test3 = await testAPI(
    'V4 Prepare Quote - Basic',
    '/api/v4/prepare-quote',
    'POST',
    {
      salesforce_org_id: '00DBE000002eBzh',
      origin: 'INNSA',
      destination: 'NLRTM',
      container_type: '40HC',
      container_count: 1
    }
  );
  results.tests.push({ name: 'V4 Prepare Quote - Basic', ...test3 });
  if (test3.success) results.passed++; else results.failed++;

  // Test 4: V4 Prepare Quote - With Earliest Departure
  const test4 = await testAPI(
    'V4 Prepare Quote - With Earliest Departure',
    '/api/v4/prepare-quote',
    'POST',
    {
      salesforce_org_id: '00DBE000002eBzh',
      origin: 'INNSA',
      destination: 'NLRTM',
      container_type: '40HC',
      container_count: 1,
      include_earliest_departure: true
    }
  );
  results.tests.push({ name: 'V4 Prepare Quote - Earliest Departure', ...test4 });
  if (test4.success) results.passed++; else results.failed++;

  // Test 5: V1 Search Rates - Backward Compatibility
  const test5 = await testAPI(
    'V1 Search Rates - Backward Compatibility',
    '/api/search-rates',
    'POST',
    {
      pol_code: 'INNSA',
      pod_code: 'NLRTM',
      container_type: '40HC'
    }
  );
  results.tests.push({ name: 'V1 Search Rates - Backward Compatibility', ...test5 });
  if (test5.success) results.passed++; else results.failed++;

  // Test 6: V1 Prepare Quote - Backward Compatibility
  const test6 = await testAPI(
    'V1 Prepare Quote - Backward Compatibility',
    '/api/prepare-quote',
    'POST',
    {
      salesforce_org_id: '00DBE000002eBzh',
      pol_code: 'INNSA',
      pod_code: 'NLRTM',
      container_type: '40HC',
      container_count: 1
    }
  );
  results.tests.push({ name: 'V1 Prepare Quote - Backward Compatibility', ...test6 });
  if (test6.success) results.passed++; else results.failed++;

  // Test 7: Error Case - Missing Destination
  const test7 = await testAPI(
    'Error Case - Missing Destination',
    '/api/v4/search-rates',
    'POST',
    {
      origin: 'INNSA',
      container_type: '40HC'
      // Missing destination
    }
  );
  results.tests.push({ name: 'Error Case - Missing Destination', ...test7 });
  // This should fail, so we check if it returns 400
  if (!test7.success && test7.error?.error?.includes('destination')) {
    results.passed++;
    console.log('   ✅ Correctly returned error for missing destination');
  } else {
    results.failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📊 Total:  ${results.passed + results.failed}`);
  
  console.log('\nDetailed Results:');
  results.tests.forEach((test, index) => {
    const icon = test.success ? '✅' : '❌';
    console.log(`${icon} ${index + 1}. ${test.name}`);
  });

  return results;
}

// Run tests if executed directly
if (require.main === module) {
  runTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = { runTests, testAPI };

