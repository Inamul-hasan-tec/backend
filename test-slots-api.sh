#!/bin/bash

# Slot API Testing Script
# This script tests all slot endpoints

echo "🧪 Testing Slot API Endpoints"
echo "================================"
echo ""

# Base URL
BASE_URL="https://hallsyncbackend.onrender.com/api"
# For local testing, use:
# BASE_URL="http://localhost:5000/api"

echo "📝 Step 1: Login to get token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed. Please check credentials."
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login successful!"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Test 1: Get slots for current month
echo "📅 Test 1: Get slots for December 2025..."
curl -s -X GET "$BASE_URL/slots/2025/12" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 2: Get available slots
echo "📅 Test 2: Get available slots..."
curl -s -X GET "$BASE_URL/slots/available?hall_id=1&date_from=2025-12-01&date_to=2025-12-31" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
echo ""

# Test 3: Generate slots for next 3 months
echo "🔧 Test 3: Generate slots for next 3 months..."
curl -s -X POST "$BASE_URL/slots/generate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "months": 3
  }' | jq '.'
echo ""

# Test 4: Update slot status (if slot exists)
echo "✏️ Test 4: Update slot status (skipped - requires existing slot ID)..."
echo "To test manually, use:"
echo "curl -X PUT \"$BASE_URL/slots/SLOT_ID\" \\"
echo "  -H \"Authorization: Bearer $TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"status\": \"booked\", \"booking_id\": 123}'"
echo ""

# Test 5: Block slot (if slot exists)
echo "🚫 Test 5: Block slot (skipped - requires existing slot ID)..."
echo "To test manually, use:"
echo "curl -X POST \"$BASE_URL/slots/SLOT_ID/block\" \\"
echo "  -H \"Authorization: Bearer $TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"block\": true, \"notes\": \"Maintenance\"}'"
echo ""

echo "================================"
echo "✅ All tests completed!"
echo ""
echo "💡 Tips:"
echo "  - Make sure your backend is running"
echo "  - Update credentials if needed"
echo "  - Check SLOT_API_DOCUMENTATION.md for more details"
