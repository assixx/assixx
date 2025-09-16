#!/bin/bash

echo "=== Testing v2 API Migration ==="
echo "1. Testing Signup with v2 API"
echo ""

# Test signup
echo "Creating new test user..."
curl -X POST http://localhost:3000/api/v2/signup \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Company v2",
    "subdomain": "test-company-v2",
    "email": "contact@testcompany.com",
    "phone": "+491234567890",
    "adminEmail": "admin-v2@test.com",
    "adminPassword": "Test123!",
    "adminFirstName": "Test",
    "adminLastName": "Admin",
    "planId": 1
  }' | jq '.'

echo ""
echo "2. Testing Login with v2 API"
echo ""

# Test login
echo "Logging in with test user..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin-v2@test.com",
    "password": "Test123!"
  }')

echo "$LOGIN_RESPONSE" | jq '.'

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken // empty')

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Login failed - no access token received"
  exit 1
fi

echo ""
echo "✅ Login successful, access token received"
echo ""
echo "3. Testing protected endpoint with v2 API"
echo ""

# Test protected endpoint
curl -X GET http://localhost:3000/api/v2/users/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

echo ""
echo "4. Testing logout with v2 API"
echo ""

# Test logout
curl -X POST http://localhost:3000/api/v2/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'

echo ""
echo "=== Test completed ==="