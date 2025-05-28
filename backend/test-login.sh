#!/bin/bash

echo "Testing login endpoints..."
echo

# Test /login endpoint
echo "1. Testing POST /login"
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}' \
  -v

echo
echo

# Test /api/auth/login endpoint
echo "2. Testing POST /api/auth/login"
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test123"}' \
  -v