#!/usr/bin/env node

/**
 * Test script for Settings API v2
 * This is a workaround for the known Jest/Supertest hanging issue with Settings v2 tests
 * See docs/api/API-V2-KNOWN-ISSUES.md for details
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/v2';
const TEST_TIMEOUT = 5000; // 5 seconds timeout

// Test user credentials
const ADMIN_USER = {
  email: 'adminzwei@scs.de',
  password: '1234Dummy!%',
};

const ROOT_USER = {
  email: 'rooteins@testfirma.de',
  password: '1234Dummy!',
};

// Store tokens
let adminToken = null;
let rootToken = null;

// Color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

// Helper to print test results
function printResult(testName, passed, message = '') {
  const symbol = passed ? '✅' : '❌';
  const color = passed ? colors.green : colors.red;
  console.info(`${symbol} ${color}${testName}${colors.reset}${message ? ` - ${message}` : ''}`);
}

// Helper to create axios instance with timeout
function createAxiosInstance(token = null) {
  const config = {
    baseURL: API_BASE,
    timeout: TEST_TIMEOUT,
    headers: {},
  };

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return axios.create(config);
}

// Login function
async function login(credentials) {
  try {
    const response = await createAxiosInstance().post('/auth/login', credentials);
    return response.data.data.accessToken;
  } catch (error) {
    console.error(`Login failed for ${credentials.email}:`, error.message);
    return null;
  }
}

// Test functions
async function testSystemSettingsAccess() {
  console.info('\n🧪 Testing System Settings Access...');

  // Test 1: Admin should be denied access to system settings (only root can access)
  try {
    const api = createAxiosInstance(adminToken);
    await api.get('/settings/system');
    printResult('Admin denied system settings access', false, 'Expected 403 but got success');
  } catch (error) {
    const passed = error.response && error.response.status === 403;
    printResult(
      'Admin denied system settings access',
      passed,
      passed ? '' : `Got ${error.response?.status || 'error'} instead of 403`,
    );
  }

  // Test 2: Root should have access
  try {
    const api = createAxiosInstance(rootToken);
    const response = await api.get('/settings/system');
    const passed = response.status === 200 && response.data.success === true;
    printResult('Root can access system settings', passed);
  } catch (error) {
    printResult(
      'Root can access system settings',
      false,
      `Error: ${error.response?.data?.error?.message || error.message}`,
    );
  }
}

async function testTenantSettings() {
  console.info('\n🧪 Testing Tenant Settings...');

  // Test 1: Admin can view tenant settings
  try {
    const api = createAxiosInstance(adminToken);
    const response = await api.get('/settings/tenant');
    const passed = response.status === 200 && response.data.success === true;
    printResult('Admin can view tenant settings', passed);
  } catch (error) {
    printResult(
      'Admin can view tenant settings',
      false,
      `Error: ${error.response?.data?.error?.message || error.message}`,
    );
  }

  // Test 2: Admin can create tenant setting
  try {
    const api = createAxiosInstance(adminToken);
    const settingData = {
      setting_key: 'test_tenant_setting',
      setting_value: 'test_value',
      value_type: 'string',
      category: 'general',
    };

    const response = await api.put(`/settings/tenant/${settingData.setting_key}`, settingData);
    const passed = response.status === 200 && response.data.success === true;
    printResult('Admin can create tenant setting', passed);

    // Clean up
    await api.delete(`/settings/tenant/${settingData.setting_key}`);
  } catch (error) {
    printResult(
      'Admin can create tenant setting',
      false,
      `Error: ${error.response?.data?.error?.message || error.message}`,
    );
  }
}

async function testUserSettings() {
  console.info('\n🧪 Testing User Settings...');

  // Test 1: Admin can create their own setting
  try {
    const api = createAxiosInstance(adminToken);
    const settingData = {
      setting_key: 'test_user_pref',
      setting_value: 'dark_mode',
      value_type: 'string',
      category: 'appearance',
    };

    const response = await api.put(`/settings/user/${settingData.setting_key}`, settingData);
    const passed = response.status === 200 && response.data.success === true;
    printResult('User can create own setting', passed);

    // Clean up
    await api.delete(`/settings/user/${settingData.setting_key}`);
  } catch (error) {
    printResult(
      'User can create own setting',
      false,
      `Error: ${error.response?.data?.error?.message || error.message}`,
    );
  }
}

async function testCategories() {
  console.info('\n🧪 Testing Categories Endpoint...');

  try {
    const api = createAxiosInstance(adminToken);
    const response = await api.get('/settings/categories');
    const passed =
      response.status === 200 &&
      response.data.success === true &&
      Array.isArray(response.data.data.categories);
    printResult('Get categories endpoint', passed);
  } catch (error) {
    printResult(
      'Get categories endpoint',
      false,
      `Error: ${error.response?.data?.error?.message || error.message}`,
    );
  }
}

// Main test runner
async function runTests() {
  console.info('🚀 Starting Settings API v2 Tests...\n');

  // Login first
  console.info('🔐 Logging in test users...');
  adminToken = await login(ADMIN_USER);
  rootToken = await login(ROOT_USER);

  if (!adminToken || !rootToken) {
    console.error(
      '\n❌ Failed to login test users. Make sure the server is running and users exist.',
    );
    process.exit(1);
  }

  console.info('✅ Login successful');

  // Run tests
  await testSystemSettingsAccess();
  await testTenantSettings();
  await testUserSettings();
  await testCategories();

  console.info('\n✨ All tests completed!\n');
}

// Run the tests
runTests().catch((error) => {
  console.error('\n❌ Test runner failed:', error.message);
  process.exit(1);
});
