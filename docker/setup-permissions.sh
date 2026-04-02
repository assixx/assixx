#!/bin/bash
# Setup script for Docker permissions
# Writes UID/GID to .env so docker-compose.yml can use ${UID:-1000}:${GID:-1000}

echo "Setting up Docker permissions..."

# Get current user and group IDs
CURRENT_UID=$(id -u)
CURRENT_GID=$(id -g)

echo "Your UID: $CURRENT_UID"
echo "Your GID: $CURRENT_GID"

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file from .env.example..."
    cp .env.example .env
fi

# Update or add UID and GID in .env (matches docker-compose.yml: ${UID:-1000}:${GID:-1000})
if grep -q "^UID=" .env; then
    sed -i "s/^UID=.*/UID=$CURRENT_UID/" .env
else
    echo "UID=$CURRENT_UID" >> .env
fi

if grep -q "^GID=" .env; then
    sed -i "s/^GID=.*/GID=$CURRENT_GID/" .env
else
    echo "GID=$CURRENT_GID" >> .env
fi

echo "Permissions configured!"
echo ""
echo "You can now run: doppler run -- docker-compose up -d"
echo ""
echo "The containers will run with your user permissions (UID=$CURRENT_UID, GID=$CURRENT_GID)."