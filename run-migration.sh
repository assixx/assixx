#!/bin/bash
echo "Führe Blackboard Attachments Migration aus..."
docker exec -i assixx-mysql mysql -u root -p assixx < backend/src/database/migrations/add_blackboard_attachments.sql