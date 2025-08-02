#\!/bin/bash
# Export schema with proper view definitions
docker exec assixx-mysql mysqldump -u assixx_user -pAssixxP@ss2025\! \
  --no-data \
  --routines \
  --triggers \
  --events \
  main > /home/scs/projects/Assixx/database/current-schema-$(date +%Y%m%d_%H%M%S)-with-views.sql
