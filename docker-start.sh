#!/bin/bash

# Convenience script to start Docker containers from root directory

# Change to docker directory
cd docker

# Start Docker containers
docker-compose up -d

echo "✅ Docker containers started!"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:3000/api"
echo "MySQL: localhost:3307"

# Show container status
docker-compose ps