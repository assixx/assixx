#!/usr/bin/env node

/**
 * Test script for login endpoint
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function testLogin() {
  console.log('Testing login endpoint...');
  console.log(`Base URL: ${BASE_URL}`);
  
  try {
    // Test POST /login
    console.log('\n1. Testing POST /login');
    const response = await axios.post(`${BASE_URL}/login`, {
      username: 'test',
      password: 'test123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✓ Login endpoint accessible');
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    
  } catch (error) {
    if (error.response) {
      console.log('✗ Login failed with status:', error.response.status);
      console.log('Error data:', error.response.data);
    } else {
      console.log('✗ Network error:', error.message);
    }
  }
  
  try {
    // Test /api/auth/login
    console.log('\n2. Testing POST /api/auth/login');
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'test',
      password: 'test123'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✓ API Login endpoint accessible');
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    
  } catch (error) {
    if (error.response) {
      console.log('✗ API Login failed with status:', error.response.status);
      console.log('Error data:', error.response.data);
    } else {
      console.log('✗ Network error:', error.message);
    }
  }
}

testLogin();