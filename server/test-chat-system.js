const WebSocket = require('ws');
const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001/chat-ws';

// Test user credentials
const testUsers = {
  admin: { email: 'admin@test.com', password: 'password123' },
  employee: { email: 'employee@test.com', password: 'password123' }
};

async function login(email, password) {
  try {
    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email,
      password
    });
    return response.data;
  } catch (error) {
    console.error(`Login failed for ${email}:`, error.response?.data || error.message);
    return null;
  }
}

async function testChatSystem() {
  console.log('🚀 Starting Chat System Tests...\n');
  
  // 1. Test Authentication
  console.log('1️⃣ Testing Authentication...');
  const adminAuth = await login(testUsers.admin.email, testUsers.admin.password);
  const employeeAuth = await login(testUsers.employee.email, testUsers.employee.password);
  
  if (!adminAuth || !employeeAuth) {
    console.log('❌ Authentication failed. Please check user credentials.');
    return;
  }
  
  console.log('✅ Authentication successful');
  console.log(`   Admin token: ${adminAuth.token.substring(0, 20)}...`);
  console.log(`   Employee token: ${employeeAuth.token.substring(0, 20)}...`);
  
  // 2. Test API Endpoints
  console.log('\n2️⃣ Testing API Endpoints...');
  
  // Test getting users
  try {
    const usersResponse = await axios.get(`${BASE_URL}/api/chat/users`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` }
    });
    console.log(`✅ GET /api/chat/users - Found ${usersResponse.data.length} users`);
  } catch (error) {
    console.log('❌ GET /api/chat/users failed:', error.response?.data || error.message);
  }
  
  // Test getting conversations
  try {
    const conversationsResponse = await axios.get(`${BASE_URL}/api/chat/conversations`, {
      headers: { Authorization: `Bearer ${adminAuth.token}` }
    });
    console.log(`✅ GET /api/chat/conversations - Found ${conversationsResponse.data.length} conversations`);
  } catch (error) {
    console.log('❌ GET /api/chat/conversations failed:', error.response?.data || error.message);
  }
  
  // 3. Test WebSocket Connection
  console.log('\n3️⃣ Testing WebSocket Connection...');
  
  const ws = new WebSocket(`${WS_URL}?token=${adminAuth.token}`);
  
  return new Promise((resolve) => {
    ws.on('open', () => {
      console.log('✅ WebSocket connection established');
      
      // Test sending a message
      ws.send(JSON.stringify({
        type: 'ping',
        data: { timestamp: new Date().toISOString() }
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data);
      console.log('📨 Received message:', message);
      
      if (message.type === 'connection_established') {
        console.log('✅ Connection confirmed by server');
      } else if (message.type === 'pong') {
        console.log('✅ Ping/Pong test successful');
        
        // Close connection after successful test
        ws.close();
      }
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket connection closed');
      console.log('\n✅ All tests completed!');
      resolve();
    });
  });
}

// Run tests
testChatSystem().catch(console.error);