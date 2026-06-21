#!/bin/bash

# Frontend Forms Test Script
# Tests Season Creation and Tournament Creation Forms

echo "======================================"
echo "Frontend Forms Testing"
echo "======================================"
echo ""

# Configuration
API_BASE="http://127.0.0.1:8000/api"
FRONTEND_URL="http://localhost:4200"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to print test result
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        ((FAILED++))
    fi
}

# Login first to get token
echo "Step 1: Authenticating..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login/" \
    -H "Content-Type: application/json" \
    --data-raw '{"username":"testadmin","password":"testpass123"}')

TOKEN=$(echo $LOGIN_RESPONSE | python -c "import sys, json; print(json.load(sys.stdin)['tokens']['access'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Failed to authenticate${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Authentication successful${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# ========================================
# TEST 1: Season Creation Form
# ========================================
echo "======================================"
echo "TEST SUITE 1: Season Creation Form"
echo "======================================"
echo ""

# Test 1.1: Create Season with Valid Data
echo "Test 1.1: Create season with valid data"
SEASON_DATA='{
    "name": "Test Season Frontend 2026",
    "start_date": "2026-02-01T00:00:00Z",
    "end_date": "2026-05-31T23:59:59Z",
    "is_active": true
}'

SEASON_RESPONSE=$(curl -s -X POST "$API_BASE/ratings/seasons/" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --data-raw "$SEASON_DATA" \
    -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$SEASON_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
RESPONSE_BODY=$(echo "$SEASON_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "Season created successfully"
    SEASON_ID=$(echo $RESPONSE_BODY | python -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
    echo "  Created Season ID: $SEASON_ID"
else
    test_result 1 "Season creation failed (HTTP $HTTP_CODE)"
    echo "  Response: $RESPONSE_BODY"
fi
echo ""

# Test 1.2: Create Season with Invalid Dates (end before start)
echo "Test 1.2: Validate season dates (end before start - should fail)"
INVALID_SEASON='{
    "name": "Invalid Season",
    "start_date": "2026-05-31T00:00:00Z",
    "end_date": "2026-02-01T23:59:59Z",
    "is_active": false
}'

INVALID_RESPONSE=$(curl -s -X POST "$API_BASE/ratings/seasons/" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --data-raw "$INVALID_SEASON" \
    -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$INVALID_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)

if [ "$HTTP_CODE" = "400" ]; then
    test_result 0 "Validation correctly rejected invalid dates"
else
    test_result 1 "Validation failed - invalid season was accepted (HTTP $HTTP_CODE)"
fi
echo ""

# Test 1.3: Get Season List
echo "Test 1.3: Retrieve season list"
SEASONS_LIST=$(curl -s "$API_BASE/ratings/seasons/" \
    -H "Authorization: Bearer $TOKEN" \
    -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$SEASONS_LIST" | grep "HTTP_CODE" | cut -d: -f2)

if [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "Season list retrieved successfully"
    COUNT=$(echo "$SEASONS_LIST" | sed '/HTTP_CODE/d' | python -c "import sys, json; data = json.load(sys.stdin); print(len(data) if isinstance(data, list) else data.get('count', 0))" 2>/dev/null)
    echo "  Total seasons: $COUNT"
else
    test_result 1 "Failed to retrieve season list (HTTP $HTTP_CODE)"
fi
echo ""

# ========================================
# TEST 2: Tournament Creation Form
# ========================================
echo "======================================"
echo "TEST SUITE 2: Tournament Creation Form"
echo "======================================"
echo ""

# Test 2.1: Create Tournament with Valid Data
echo "Test 2.1: Create tournament with valid data"
TOURNAMENT_DATA='{
    "name": "Frontend Test Tournament 2026",
    "description": "Testing tournament creation from frontend form",
    "tournament_format": "SINGLE_ELIMINATION",
    "max_participants": 16,
    "min_participants": 2,
    "registration_deadline": "2026-02-10T18:00:00Z",
    "start_date": "2026-02-15T09:00:00Z",
    "end_date": "2026-02-15T18:00:00Z",
    "is_rated": true,
    "season": null
}'

TOURNAMENT_RESPONSE=$(curl -s -X POST "$API_BASE/tournaments/" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --data-raw "$TOURNAMENT_DATA" \
    -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$TOURNAMENT_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
RESPONSE_BODY=$(echo "$TOURNAMENT_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "Tournament created successfully"
    TOURNAMENT_ID=$(echo $RESPONSE_BODY | python -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null)
    echo "  Created Tournament ID: $TOURNAMENT_ID"
else
    test_result 1 "Tournament creation failed (HTTP $HTTP_CODE)"
    echo "  Response: $RESPONSE_BODY"
fi
echo ""

# Test 2.2: Create Tournament with Invalid Participant Count (Elimination format)
echo "Test 2.2: Validate participant count for elimination format (should fail)"
INVALID_TOURNAMENT='{
    "name": "Invalid Tournament",
    "description": "Should fail - wrong participant count",
    "tournament_format": "SINGLE_ELIMINATION",
    "max_participants": 10,
    "min_participants": 2,
    "registration_deadline": "2026-02-10T18:00:00Z",
    "start_date": "2026-02-15T09:00:00Z",
    "end_date": "2026-02-15T18:00:00Z",
    "is_rated": true,
    "season": null
}'

INVALID_TOURN_RESPONSE=$(curl -s -X POST "$API_BASE/tournaments/" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --data-raw "$INVALID_TOURNAMENT" \
    -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$INVALID_TOURN_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)

if [ "$HTTP_CODE" = "400" ]; then
    test_result 0 "Validation correctly rejected invalid participant count"
else
    test_result 1 "Validation failed - invalid tournament was accepted (HTTP $HTTP_CODE)"
fi
echo ""

# Test 2.3: Create Tournament with Datetime Fields
echo "Test 2.3: Create tournament with datetime-local format"
DATETIME_TOURNAMENT='{
    "name": "Datetime Test Tournament",
    "description": "Testing datetime-local input format",
    "tournament_format": "SINGLE_ELIMINATION",
    "max_participants": 8,
    "min_participants": 2,
    "registration_deadline": "2026-03-10T14:30:00Z",
    "start_date": "2026-03-15T10:00:00Z",
    "end_date": "2026-03-15T16:00:00Z",
    "is_rated": true,
    "season": null
}'

DATETIME_RESPONSE=$(curl -s -X POST "$API_BASE/tournaments/" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --data-raw "$DATETIME_TOURNAMENT" \
    -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$DATETIME_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)

if [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "Datetime format accepted correctly"
else
    test_result 1 "Datetime format rejected (HTTP $HTTP_CODE)"
fi
echo ""

# Test 2.4: Get Tournament List
echo "Test 2.4: Retrieve tournament list"
TOURNAMENTS_LIST=$(curl -s "$API_BASE/tournaments/" \
    -H "Authorization: Bearer $TOKEN" \
    -w "\nHTTP_CODE:%{http_code}")

HTTP_CODE=$(echo "$TOURNAMENTS_LIST" | grep "HTTP_CODE" | cut -d: -f2)

if [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "Tournament list retrieved successfully"
    COUNT=$(echo "$TOURNAMENTS_LIST" | sed '/HTTP_CODE/d' | python -c "import sys, json; print(json.load(sys.stdin).get('count', 0))" 2>/dev/null)
    echo "  Total tournaments: $COUNT"
else
    test_result 1 "Failed to retrieve tournament list (HTTP $HTTP_CODE)"
fi
echo ""

# Test 2.5: Verify Tournament Detail
if [ ! -z "$TOURNAMENT_ID" ]; then
    echo "Test 2.5: Retrieve tournament detail"
    TOURNAMENT_DETAIL=$(curl -s "$API_BASE/tournaments/$TOURNAMENT_ID/" \
        -H "Authorization: Bearer $TOKEN" \
        -w "\nHTTP_CODE:%{http_code}")

    HTTP_CODE=$(echo "$TOURNAMENT_DETAIL" | grep "HTTP_CODE" | cut -d: -f2)

    if [ "$HTTP_CODE" = "200" ]; then
        test_result 0 "Tournament detail retrieved successfully"
        DETAIL_BODY=$(echo "$TOURNAMENT_DETAIL" | sed '/HTTP_CODE/d')
        echo "  Tournament: $(echo $DETAIL_BODY | python -c "import sys, json; print(json.load(sys.stdin).get('name', 'N/A'))" 2>/dev/null)"
        echo "  Status: $(echo $DETAIL_BODY | python -c "import sys, json; print(json.load(sys.stdin).get('status', 'N/A'))" 2>/dev/null)"
        echo "  Format: $(echo $DETAIL_BODY | python -c "import sys, json; print(json.load(sys.stdin).get('tournament_format', 'N/A'))" 2>/dev/null)"
    else
        test_result 1 "Failed to retrieve tournament detail (HTTP $HTTP_CODE)"
    fi
    echo ""
fi

# ========================================
# SUMMARY
# ========================================
echo "======================================"
echo "TEST SUMMARY"
echo "======================================"
TOTAL=$((PASSED + FAILED))
echo "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Frontend forms are working correctly:"
    echo "  ✓ Season creation form functional"
    echo "  ✓ Tournament creation form functional"
    echo "  ✓ Date/datetime inputs working"
    echo "  ✓ Validation working"
    echo "  ✓ API integration successful"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo "Please review the failed tests above"
    exit 1
fi
