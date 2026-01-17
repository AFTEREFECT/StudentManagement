#!/bin/bash

# ============================================
# Supabase Connection Test Script
# ============================================
# This script tests the connection to Supabase
# from AWS EC2 instance
# ============================================

echo "=========================================="
echo "Supabase Connection Test"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Connection details
PROJECT_ID="benjzaxxkcjwnrfllvel"
PASSWORD="PgSbx2025Secure987"
POOLER_HOST="aws-0-eu-central-1.pooler.supabase.com"
POOLER_PORT="6543"
DIRECT_HOST="db.benjzaxxkcjwnrfllvel.supabase.co"
DIRECT_PORT="5432"

echo "1️⃣ Testing network connectivity..."
echo "-------------------------------------------"

# Test Pooler host
echo -n "Testing Pooler host ($POOLER_HOST:$POOLER_PORT)... "
if nc -zv $POOLER_HOST $POOLER_PORT 2>&1 | grep -q "succeeded"; then
    echo -e "${GREEN}✓ Reachable${NC}"
else
    echo -e "${RED}✗ Not reachable${NC}"
fi

# Test Direct host
echo -n "Testing Direct host ($DIRECT_HOST:$DIRECT_PORT)... "
if nc -zv $DIRECT_HOST $DIRECT_PORT 2>&1 | grep -q "succeeded"; then
    echo -e "${GREEN}✓ Reachable${NC}"
else
    echo -e "${RED}✗ Not reachable${NC}"
fi

echo ""
echo "2️⃣ Testing Pooler connection (Transaction Mode)..."
echo "-------------------------------------------"

# Correct format for Pooler: postgres.PROJECT_REF
POOLER_URI="postgresql://postgres.${PROJECT_ID}:${PASSWORD}@${POOLER_HOST}:${POOLER_PORT}/postgres?pgbouncer=true"

echo "Connection string: postgresql://postgres.${PROJECT_ID}:***@${POOLER_HOST}:${POOLER_PORT}/postgres?pgbouncer=true"
echo ""

if command -v psql &> /dev/null; then
    if psql "$POOLER_URI" -c "SELECT version();" 2>&1 | grep -q "PostgreSQL"; then
        echo -e "${GREEN}✓ Pooler connection successful!${NC}"
        psql "$POOLER_URI" -c "SELECT version();"
    else
        echo -e "${RED}✗ Pooler connection failed${NC}"
        echo "Error details:"
        psql "$POOLER_URI" -c "SELECT version();" 2>&1 | head -5
    fi
else
    echo -e "${YELLOW}⚠ psql not installed. Installing...${NC}"
    sudo apt-get update && sudo apt-get install -y postgresql-client
fi

echo ""
echo "3️⃣ Testing Direct connection (with SSL)..."
echo "-------------------------------------------"

DIRECT_URI="postgresql://postgres:${PASSWORD}@${DIRECT_HOST}:${DIRECT_PORT}/postgres?sslmode=require"

echo "Connection string: postgresql://postgres:***@${DIRECT_HOST}:${DIRECT_PORT}/postgres?sslmode=require"
echo ""

if command -v psql &> /dev/null; then
    if psql "$DIRECT_URI" -c "SELECT version();" 2>&1 | grep -q "PostgreSQL"; then
        echo -e "${GREEN}✓ Direct connection successful!${NC}"
        psql "$DIRECT_URI" -c "SELECT version();"
    else
        echo -e "${RED}✗ Direct connection failed${NC}"
        echo "Error details:"
        psql "$DIRECT_URI" -c "SELECT version();" 2>&1 | head -5
    fi
fi

echo ""
echo "4️⃣ Server Information..."
echo "-------------------------------------------"
echo "Public IP: $(curl -4 -s ifconfig.me)"
echo "Region: eu-central-1"
echo "OS: $(lsb_release -d | cut -f2)"
echo ""

echo "=========================================="
echo "Test Complete"
echo "=========================================="
echo ""
echo "📋 Next Steps:"
echo "1. If Pooler connection succeeded, use the Pooler URI in .env.evolution"
echo "2. If Direct connection succeeded, use the Direct URI in .env.evolution"
echo "3. Restart Evolution API: docker-compose down && docker-compose up -d"
echo "4. Check logs: docker-compose logs -f evolution-api"
