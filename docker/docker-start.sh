#!/bin/bash

# Convenience script to start Docker containers from root directory

# Change to docker directory
cd docker

# Start Docker containers with env file from root
docker-compose --env-file ../.env up -d

echo "✅ Docker containers started!"
echo "Frontend: http://localhost:3000"
echo "Backend API: http://localhost:3000/api"
echo "PostgreSQL: localhost:5432"

# Show container status
docker-compose --env-file ../.env ps