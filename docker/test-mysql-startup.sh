#!/bin/bash

# Test MySQL startup locally to debug GitHub Actions issue
echo "Testing MySQL startup time..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Clean up any existing containers
echo -e "${YELLOW}Cleaning up existing containers...${NC}"
docker compose -f docker-compose.test.yml down -v 2>/dev/null

# Start MySQL only
echo -e "${YELLOW}Starting MySQL container...${NC}"
docker compose -f docker-compose.test.yml up -d mysql

# Track time
START_TIME=$(date +%s)

# Wait for MySQL to be ready
echo -e "${YELLOW}Waiting for MySQL to accept connections...${NC}"
MAX_WAIT=180
SUCCESS=false

for i in $(seq 1 $MAX_WAIT); do
    # Try to connect to MySQL
    if docker exec assixx-mysql mysql -h localhost -u root -pStrongP@ssw0rd!123 -e "SELECT 1" > /dev/null 2>&1; then
        END_TIME=$(date +%s)
        ELAPSED=$((END_TIME - START_TIME))
        echo -e "${GREEN}✓ MySQL is ready after ${ELAPSED} seconds${NC}"
        SUCCESS=true
        break
    fi
    
    # Show status every 10 seconds
    if [ $((i % 10)) -eq 0 ]; then
        echo "Still waiting... ($i/$MAX_WAIT seconds)"
        echo "Container status:"
        docker ps -a | grep mysql
        
        if [ $i -ge 30 ]; then
            echo "Recent MySQL logs:"
            docker logs assixx-mysql --tail 5 2>&1
        fi
    fi
    
    sleep 1
done

if [ "$SUCCESS" = false ]; then
    END_TIME=$(date +%s)
    ELAPSED=$((END_TIME - START_TIME))
    echo -e "${RED}✗ MySQL failed to start after ${ELAPSED} seconds${NC}"
    echo "Full MySQL logs:"
    docker logs assixx-mysql
    exit 1
fi

# Test the healthcheck command
echo -e "${YELLOW}Testing healthcheck command...${NC}"
if docker exec assixx-mysql sh -c "mysql -h localhost -u root -pStrongP@ssw0rd!123 -e 'SELECT 1'" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Healthcheck command works${NC}"
else
    echo -e "${RED}✗ Healthcheck command failed${NC}"
fi

# Check database creation
echo -e "${YELLOW}Checking database...${NC}"
if docker exec assixx-mysql mysql -h localhost -u root -pStrongP@ssw0rd!123 -e "USE main; SHOW TABLES;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database 'main' exists and schema loaded${NC}"
else
    echo -e "${RED}✗ Database issue detected${NC}"
fi

# Clean up
echo -e "${YELLOW}Cleaning up...${NC}"
docker compose -f docker-compose.test.yml down

echo -e "${GREEN}Test complete!${NC}"