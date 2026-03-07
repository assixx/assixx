---
'assixx-backend': patch
---

Partition Health: /health/partitions Endpoint + API-Test

- Neuer Endpoint `/health/partitions` zur Verifizierung der pg_partman-Konfiguration (Extension, part_config, Partitionen, Defaults)
- HTTP 200 bei gesundem Zustand, HTTP 503 bei Problemen
- 9 API-Integrationstests (`partitions.api.test.ts`) verifizieren Partition-Coverage automatisch
- GRANT für `app_user` auf `partman`-Schema (read-only, Monitoring)
