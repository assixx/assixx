#!/bin/bash

# Convenience script to stop Docker containers from root directory

# Change to docker directory
cd docker

# Stop Docker containers
docker-compose down

echo "✅ Docker containers stopped!"