#!/bin/bash

# API Performance Testing Script
# Tests the Hall Sync backend API endpoints

API_URL="https://hallsyncbackend.onrender.com"
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=========================================="
echo "  Hall Sync API Performance Test"
echo "=========================================="
echo ""

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local method=${2:-GET}
    local description=$3
    
    echo -e "${YELLOW}Testing:${NC} $description"
    echo "Endpoint: $method $endpoint"
    
    start_time=$(date +%s%3N)
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}\n%{time_total}" "$API_URL$endpoint")
    fi
    
    end_time=$(date +%s%3N)
    duration=$((end_time - start_time))
    
    http_code=$(echo "$response" | tail -n 2 | head -n 1)
    time_total=$(echo "$response" | tail -n 1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✓ Status: $http_code${NC}"
        echo -e "${GREEN}✓ Time: ${time_total}s (${duration}ms)${NC}"
    else
        echo -e "${RED}✗ Status: $http_code${NC}"
        echo -e "${RED}✗ Time: ${time_total}s${NC}"
    fi
    
    echo ""
}

# Test endpoints
echo "1. Testing Health Check"
test_endpoint "/api/health" "GET" "Health Check"

echo "2. Testing Bookings (with pagination)"
test_endpoint "/api/bookings?limit=20&offset=0" "GET" "Get Bookings (20 records)"

echo "3. Testing Bookings (without pagination - should default to 50)"
test_endpoint "/api/bookings" "GET" "Get All Bookings (default limit)"

echo "4. Testing Upcoming Bookings"
test_endpoint "/api/bookings/upcoming?limit=10" "GET" "Get Upcoming Bookings"

echo "5. Testing Today's Bookings"
test_endpoint "/api/bookings/today" "GET" "Get Today's Bookings"

echo "6. Testing Customers"
test_endpoint "/api/customers?limit=20" "GET" "Get Customers (20 records)"

echo "7. Testing Halls"
test_endpoint "/api/halls" "GET" "Get Halls"

echo "8. Testing Packages"
test_endpoint "/api/packages" "GET" "Get Packages"

echo "=========================================="
echo "  Performance Test Complete"
echo "=========================================="
echo ""
echo "Recommendations:"
echo "- Response times < 1s: Excellent ✓"
echo "- Response times 1-3s: Good"
echo "- Response times 3-5s: Needs optimization"
echo "- Response times > 5s: Critical - investigate immediately"
echo ""
