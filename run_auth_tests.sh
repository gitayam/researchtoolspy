#!/bin/bash

# Run Authentication Tests Script
# 
# This script runs all authentication-related tests for both frontend and backend

set -e  # Exit on error

echo "================================"
echo "Running Authentication Tests"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to run frontend tests
run_frontend_tests() {
    echo -e "\n${YELLOW}Running Frontend Tests...${NC}"
    cd frontend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing frontend dependencies..."
        npm ci
    fi
    
    # Run specific auth tests
    echo -e "\n${GREEN}Testing AuthGuard Component...${NC}"
    npm test -- src/components/auth/__tests__/auth-guard.test.tsx --coverage
    
    echo -e "\n${GREEN}Testing Auth Store...${NC}"
    npm test -- src/stores/__tests__/auth.test.ts --coverage
    
    echo -e "\n${GREEN}Testing API Client...${NC}"
    npm test -- src/lib/__tests__/api.test.ts --coverage
    
    echo -e "\n${GREEN}Testing E2E Auth Persistence...${NC}"
    npm test -- src/__tests__/e2e/auth-persistence.test.tsx --coverage
    
    # Generate coverage report
    echo -e "\n${GREEN}Generating Frontend Coverage Report...${NC}"
    npm run test:coverage -- --testPathPattern="auth|api" || true
    
    cd ..
}

# Function to run backend tests
run_backend_tests() {
    echo -e "\n${YELLOW}Running Backend Tests...${NC}"
    cd api
    
    # Run specific auth tests
    echo -e "\n${GREEN}Testing Hash Authentication...${NC}"
    python -m pytest tests/test_hash_auth.py -v --cov=app.api.v1.endpoints.hash_auth --cov-report=term-missing
    
    echo -e "\n${GREEN}Testing Auth Endpoints...${NC}"
    python -m pytest tests/test_auth.py -v --cov=app.api.v1.endpoints.auth --cov-report=term-missing || true
    
    # Generate coverage report
    echo -e "\n${GREEN}Generating Backend Coverage Report...${NC}"
    python -m pytest tests/ -k "auth" --cov=app --cov-report=html --cov-report=term
    
    cd ..
}

# Function to run integration tests
run_integration_tests() {
    echo -e "\n${YELLOW}Running Integration Tests...${NC}"
    
    # Start services if not running
    if ! docker compose ps | grep -q "Up"; then
        echo "Starting services..."
        docker compose up -d postgres redis
        sleep 5  # Wait for services to be ready
    fi
    
    # Run integration tests
    cd api
    echo -e "\n${GREEN}Testing Full Auth Flow...${NC}"
    python -m pytest tests/test_hash_auth.py::TestHashAuthentication -v
    python -m pytest tests/test_hash_auth.py::TestTokenValidation -v
    cd ..
}

# Function to check test results
check_results() {
    echo -e "\n${YELLOW}================================${NC}"
    echo -e "${YELLOW}Test Results Summary${NC}"
    echo -e "${YELLOW}================================${NC}"
    
    # Check frontend coverage
    if [ -f "frontend/coverage/lcov-report/index.html" ]; then
        echo -e "${GREEN}✓ Frontend coverage report generated${NC}"
        echo "  View at: frontend/coverage/lcov-report/index.html"
    else
        echo -e "${RED}✗ Frontend coverage report not found${NC}"
    fi
    
    # Check backend coverage
    if [ -f "api/htmlcov/index.html" ]; then
        echo -e "${GREEN}✓ Backend coverage report generated${NC}"
        echo "  View at: api/htmlcov/index.html"
    else
        echo -e "${RED}✗ Backend coverage report not found${NC}"
    fi
}

# Main execution
main() {
    echo "Select test suite to run:"
    echo "1) Frontend tests only"
    echo "2) Backend tests only"
    echo "3) Integration tests only"
    echo "4) All tests"
    echo "5) Quick auth check (fast subset)"
    
    read -p "Enter choice [1-5]: " choice
    
    case $choice in
        1)
            run_frontend_tests
            ;;
        2)
            run_backend_tests
            ;;
        3)
            run_integration_tests
            ;;
        4)
            run_frontend_tests
            run_backend_tests
            run_integration_tests
            ;;
        5)
            # Quick subset for CI/CD
            echo -e "\n${YELLOW}Running Quick Auth Check...${NC}"
            cd frontend && npm test -- --testNamePattern="should persist|should maintain" --coverage=false
            cd ../api && python -m pytest tests/test_hash_auth.py::TestHashAuthentication::test_authenticate_with_valid_hash -v
            cd ..
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
    
    check_results
    
    echo -e "\n${GREEN}================================${NC}"
    echo -e "${GREEN}Tests Complete!${NC}"
    echo -e "${GREEN}================================${NC}"
}

# Run main function
main

# Make script executable: chmod +x run_auth_tests.sh
# Run: ./run_auth_tests.sh