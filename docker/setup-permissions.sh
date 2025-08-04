#!/bin/bash
# Setup script for Docker permissions

echo "🔧 Setting up Docker permissions..."

# Get current user and group IDs
USER_ID=$(id -u)
GROUP_ID=$(id -g)

echo "📝 Your User ID: $USER_ID"
echo "📝 Your Group ID: $GROUP_ID"

# Check if .env exists
if [ ! -f .env ]; then
    echo "📄 Creating .env file from .env.example..."
    cp .env.example .env
fi

# Update or add USER_ID and GROUP_ID in .env
if grep -q "^USER_ID=" .env; then
    sed -i "s/^USER_ID=.*/USER_ID=$USER_ID/" .env
else
    echo "USER_ID=$USER_ID" >> .env
fi

if grep -q "^GROUP_ID=" .env; then
    sed -i "s/^GROUP_ID=.*/GROUP_ID=$GROUP_ID/" .env
else
    echo "GROUP_ID=$GROUP_ID" >> .env
fi

echo "✅ Permissions configured!"
echo ""
echo "🚀 You can now run: docker-compose up -d"
echo ""
echo "💡 No more permission issues! The containers will run with your user permissions."