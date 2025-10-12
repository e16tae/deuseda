#!/bin/bash

# Test script for SSH-based authentication
# This script tests the login endpoint with SSH credentials

# Configuration
API_URL="http://localhost:8080/api/auth/login"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "  DeusEda Console - SSH Authentication Test"
echo "================================================"
echo ""

# Check if backend is running
if ! curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Backend server is not running on localhost:8080${NC}"
    echo "Please start the backend server first:"
    echo "  cd backend && cargo run"
    exit 1
fi

echo -e "${GREEN}✓ Backend server is running${NC}"
echo ""

# Prompt for credentials
read -p "Enter username: " USERNAME
read -s -p "Enter password: " PASSWORD
echo ""
echo ""

# Test login
echo "Testing SSH authentication..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Authentication successful!${NC}"
    echo ""
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""

    # Extract token
    TOKEN=$(echo "$BODY" | jq -r '.token' 2>/dev/null)
    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        echo -e "${GREEN}JWT Token:${NC}"
        echo "$TOKEN"
    fi
else
    echo -e "${RED}❌ Authentication failed${NC}"
    echo ""
    echo "Error:"
    echo "$BODY"
    echo ""

    if [ "$HTTP_CODE" = "401" ]; then
        echo -e "${YELLOW}This could mean:${NC}"
        echo "  1. Invalid username or password"
        echo "  2. SSH server is not reachable"
        echo "  3. User account doesn't exist on the SSH server"
        echo ""
        echo "Check backend logs for more details"
    fi
fi

echo ""
echo "================================================"
