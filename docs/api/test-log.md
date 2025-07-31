scs@SOSCSPC1M16:~/projects/Assixx/docker$docker exec assixx-backend pnpm test --verbose --forceExit

> assixx@1.0.0 test /app
> node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js --verbose --forceExit


🧹 Pre-test cleanup: Removing old test data...
✅ No leftover test data found
(node:194) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1672 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1700 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1716 "-" "-"
info: Fetching all teams for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "GET /api/v2/teams HTTP/1.1" 200 585 "-" "-"
info: Fetching all teams for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "GET /api/v2/teams?departmentId=2002 HTTP/1.1" 200 585 "-" "-"
info: Fetching all teams for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "GET /api/v2/teams?search=Team%201 HTTP/1.1" 200 337 "-" "-"
info: Fetching all teams for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "GET /api/v2/teams?includeMembers=true HTTP/1.1" 200 617 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "GET /api/v2/teams HTTP/1.1" 401 190 "-" "-"
info: Fetching all teams for tenant 4090 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 0 teams {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "GET /api/v2/teams HTTP/1.1" 200 90 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 2 members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "GET /api/v2/teams/1487 HTTP/1.1" 200 782 "-" "-"
info: Fetching team with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
warn: Team with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.getTeamById (/app/backend/src/routes/v2/teams/teams.service.ts:112:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getTeamById (/app/backend/src/routes/v2/teams/teams.controller.ts:88:20)","statusCode":404,"timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "GET /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.getTeamById (/app/backend/src/routes/v2/teams/teams.service.ts:117:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getTeamById (/app/backend/src/routes/v2/teams/teams.controller.ts:88:20)","statusCode":404,"timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "GET /api/v2/teams/1487 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 0 members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "GET /api/v2/teams/1487 HTTP/1.1" 200 348 "-" "-"
info: Fetching department with ID 2002 for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Department 2002 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching all teams for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Creating new team: New Team v2 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team created successfully with ID 1489 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching team with ID 1489 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1489 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching members for team 1489 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 0 members for team 1489 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "POST /api/v2/teams HTTP/1.1" 201 360 "-" "-"
info: Fetching all teams for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 3 teams {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
error: Team with this name already exists {"code":"CONFLICT","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team with this name already exists\n    at TeamsService.createTeam (/app/backend/src/routes/v2/teams/teams.service.ts:185:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at createTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:130:20)","statusCode":409,"timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "POST /api/v2/teams HTTP/1.1" 409 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "POST /api/v2/teams HTTP/1.1" 400 309 "-" "-"
info: Fetching department with ID 99999 for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
warn: Department with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
error: Invalid department ID {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Invalid department ID\n    at TeamsService.createTeam (/app/backend/src/routes/v2/teams/teams.service.ts:166:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at createTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:130:20)","statusCode":400,"timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "POST /api/v2/teams HTTP/1.1" 400 181 "-" "-"
error: Invalid leader ID {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Invalid leader ID\n    at TeamsService.createTeam (/app/backend/src/routes/v2/teams/teams.service.ts:174:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at createTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:130:20)","statusCode":400,"timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "POST /api/v2/teams HTTP/1.1" 400 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "POST /api/v2/teams HTTP/1.1" 403 182 "-" "-"
info: Fetching all teams for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 3 teams {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Creating new team: Root Created Team {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team created successfully with ID 1490 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching team with ID 1490 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1490 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching members for team 1490 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 0 members for team 1490 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "POST /api/v2/teams HTTP/1.1" 201 341 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching all teams for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 4 teams {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Updating team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1487 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 0 members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "PUT /api/v2/teams/1487 HTTP/1.1" 200 363 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Updating team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1487 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 0 members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "PUT /api/v2/teams/1487 HTTP/1.1" 200 345 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching all teams for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 4 teams {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
error: Team with this name already exists {"code":"CONFLICT","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team with this name already exists\n    at TeamsService.updateTeam (/app/backend/src/routes/v2/teams/teams.service.ts:255:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at updateTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:173:20)","statusCode":409,"timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "PUT /api/v2/teams/1487 HTTP/1.1" 409 191 "-" "-"
info: Fetching team with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
warn: Team with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.updateTeam (/app/backend/src/routes/v2/teams/teams.service.ts:222:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at updateTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:173:20)","statusCode":404,"timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "PUT /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.updateTeam (/app/backend/src/routes/v2/teams/teams.service.ts:222:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at updateTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:173:20)","statusCode":404,"timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "PUT /api/v2/teams/1487 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "PUT /api/v2/teams/1487 HTTP/1.1" 403 182 "-" "-"
info: Fetching team with ID 1491 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1491 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching members for team 1491 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 0 members for team 1491 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Deleting team 1491 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1491 deleted successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "DELETE /api/v2/teams/1491 HTTP/1.1" 200 127 "-" "-"
info: Fetching team with ID 1491 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
warn: Team with ID 1491 not found {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.getTeamById (/app/backend/src/routes/v2/teams/teams.service.ts:112:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getTeamById (/app/backend/src/routes/v2/teams/teams.controller.ts:88:20)","statusCode":404,"timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "GET /api/v2/teams/1491 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1492 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Team 1492 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Fetching members for team 1492 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
info: Retrieved 1 members for team 1492 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
error: Cannot delete team with members {"code":"BAD_REQUEST","details":{"memberCount":1},"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Cannot delete team with members\n    at TeamsService.deleteTeam (/app/backend/src/routes/v2/teams/teams.service.ts:310:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at deleteTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:212:22)","statusCode":400,"timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "DELETE /api/v2/teams/1492 HTTP/1.1" 400 219 "-" "-"
info: Fetching team with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
warn: Team with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 15:37:13"}
error: Error in deleteTeam: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.deleteTeam (/app/backend/src/routes/v2/teams/teams.service.ts:304:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at deleteTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:212:22)","statusCode":404,"timestamp":"2025-07-31 15:37:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:13 +0000] "DELETE /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1494 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1494 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
error: Error in deleteTeam: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.deleteTeam (/app/backend/src/routes/v2/teams/teams.service.ts:304:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at deleteTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:212:22)","statusCode":404,"timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "DELETE /api/v2/teams/1494 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "DELETE /api/v2/teams/1495 HTTP/1.1" 403 182 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Fetching members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Retrieved 2 members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "GET /api/v2/teams/1487/members HTTP/1.1" 200 524 "-" "-"
info: Fetching team with ID 1488 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1488 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Fetching members for team 1488 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Retrieved 0 members for team 1488 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "GET /api/v2/teams/1488/members HTTP/1.1" 200 90 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Fetching members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Retrieved 0 members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "GET /api/v2/teams/1487/members HTTP/1.1" 200 90 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
error: Error in getTeamMembers: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.getTeamMembers (/app/backend/src/routes/v2/teams/teams.service.ts:341:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getTeamMembers (/app/backend/src/routes/v2/teams/teams.controller.ts:250:23)","statusCode":404,"timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "GET /api/v2/teams/1487/members HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Adding user 23451 to team 1487 for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: User 23451 added to team 1487 successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "POST /api/v2/teams/1487/members HTTP/1.1" 201 132 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Fetching members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Retrieved 1 members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "GET /api/v2/teams/1487/members HTTP/1.1" 200 311 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Adding user 23451 to team 1487 for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
warn: User 23451 is already a member of team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
error: Error adding team member: User is already a member of this team {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
error: Error in addTeamMember: User is already a member of this team {"code":"CONFLICT","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: User is already a member of this team\n    at TeamsService.addTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:401:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at addTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:291:22)","statusCode":409,"timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "POST /api/v2/teams/1487/members HTTP/1.1" 409 194 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
error: Error in addTeamMember: Invalid user ID {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Invalid user ID\n    at TeamsService.addTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:378:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at addTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:291:22)","statusCode":400,"timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "POST /api/v2/teams/1487/members HTTP/1.1" 400 175 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
error: Error in addTeamMember: Invalid user ID {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Invalid user ID\n    at TeamsService.addTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:378:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at addTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:291:22)","statusCode":400,"timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "POST /api/v2/teams/1487/members HTTP/1.1" 400 175 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "POST /api/v2/teams/1487/members HTTP/1.1" 403 182 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Removing user 23451 from team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: User 23451 removed from team 1487 successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "DELETE /api/v2/teams/1487/members/23451 HTTP/1.1" 200 134 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Fetching members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Retrieved 0 members for team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "GET /api/v2/teams/1487/members HTTP/1.1" 200 90 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Removing user 23452 from team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
warn: User 23452 is not a member of team 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
error: Error in removeTeamMember: User is not a member of this team {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: User is not a member of this team\n    at TeamsService.removeTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:425:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at removeTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:335:22)","statusCode":400,"timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "DELETE /api/v2/teams/1487/members/23452 HTTP/1.1" 400 193 "-" "-"
info: Fetching team with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
warn: Team with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
error: Error in removeTeamMember: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.removeTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:420:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at removeTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:335:22)","statusCode":404,"timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "DELETE /api/v2/teams/99999/members/23451 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1487 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1487 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
error: Error in removeTeamMember: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.removeTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:420:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at removeTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:335:22)","statusCode":404,"timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "DELETE /api/v2/teams/1487/members/23451 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "DELETE /api/v2/teams/1487/members/23451 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "POST /api/v2/teams HTTP/1.1" 400 258 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "POST /api/v2/teams HTTP/1.1" 400 271 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "GET /api/v2/teams?search=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa HTTP/1.1" 400 262 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "GET /api/v2/teams/not-a-number HTTP/1.1" 400 256 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "POST /api/v2/teams HTTP/1.1" 400 118 "-" "-"
info: Fetching all teams for tenant 4089 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Retrieved 8 teams {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Creating new team: JSON Team {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team created successfully with ID 1496 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Fetching team with ID 1496 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Team 1496 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Fetching members for team 1496 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
info: Retrieved 0 members for team 1496 {"service":"assixx-backend","timestamp":"2025-07-31 15:37:14"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:14 +0000] "POST /api/v2/teams HTTP/1.1" 201 315 "-" "-"
PASS backend/src/routes/v2/teams/__tests__/teams-v2.test.ts (20.378 s)
  Teams v2 API Endpoints
    GET /api/v2/teams
      ✓ should list all teams for the tenant (22 ms)
      ✓ should filter teams by department (14 ms)
      ✓ should search teams by name (12 ms)
      ✓ should include member count when requested (17 ms)
      ✓ should require authentication (11 ms)
      ✓ should isolate teams by tenant (12 ms)
    GET /api/v2/teams/:id
      ✓ should get team by ID with members (25 ms)
      ✓ should return 404 for non-existent team (36 ms)
      ✓ should prevent access to other tenant's teams (15 ms)
      ✓ should allow employee access to view teams (14 ms)
    POST /api/v2/teams
      ✓ should create a new team (32 ms)
      ✓ should prevent duplicate team names (10 ms)
      ✓ should validate required fields (10 ms)
      ✓ should validate department ID (12 ms)
      ✓ should validate leader ID (15 ms)
      ✓ should require admin or root role (7 ms)
      ✓ should allow root role to create teams (24 ms)
    PUT /api/v2/teams/:id
      ✓ should update team details (26 ms)
      ✓ should allow clearing optional fields (21 ms)
      ✓ should prevent duplicate names on update (12 ms)
      ✓ should return 404 for non-existent team (9 ms)
      ✓ should prevent access to other tenant's teams (9 ms)
      ✓ should require admin or root role (6 ms)
    DELETE /api/v2/teams/:id
      ✓ should delete an empty team (34 ms)
      ✓ should prevent deletion of team with members (20 ms)
      ✓ should return 404 for non-existent team (13 ms)
      ✓ should prevent access to other tenant's teams (17 ms)
      ✓ should require admin or root role (11 ms)
    GET /api/v2/teams/:id/members
      ✓ should list team members (14 ms)
      ✓ should return empty array for team without members (14 ms)
      ✓ should allow employees to view team members (8 ms)
      ✓ should prevent access to other tenant's teams (12 ms)
    POST /api/v2/teams/:id/members
      ✓ should add a member to the team (25 ms)
      ✓ should prevent adding duplicate members (26 ms)
      ✓ should validate user ID (15 ms)
      ✓ should prevent adding users from other tenants (10 ms)
      ✓ should require admin or root role (6 ms)
    DELETE /api/v2/teams/:id/members/:userId
      ✓ should remove a member from the team (30 ms)
      ✓ should handle removing non-member gracefully (14 ms)
      ✓ should return 404 for non-existent team (17 ms)
      ✓ should prevent access to other tenant's teams (18 ms)
      ✓ should require admin or root role (13 ms)
    Input Validation
      ✓ should validate team name length (11 ms)
      ✓ should validate description length (8 ms)
      ✓ should validate search parameter (5 ms)
      ✓ should validate numeric IDs (6 ms)
    Content-Type validation
      ✓ should reject non-JSON content type for POST (2 ms)
      ✓ should accept application/json content type (14 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:37:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
Entries in DB before test: 1 [
  { id: 4557, title: 'Test Entry', org_level: 'company', org_id: null }
]
Employee user info: { id: 23455, role: 'employee', department_id: null, tenant_id: 4091 }
Employee team info: No team assignment
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:16 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 766 "-" "-"
Response data length: 1
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:17 +0000] "GET /api/v2/blackboard/entries?status=archived HTTP/1.1" 200 774 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:20 +0000] "GET /api/v2/blackboard/entries?page=1&limit=5 HTTP/1.1" 200 765 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:21 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:21 +0000] "GET /api/v2/blackboard/entries/4562 HTTP/1.1" 200 716 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
error: Error getting blackboard entry: Entry not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Entry not found\n    at BlackboardService.getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:100:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:111:19)","statusCode":404,"timestamp":"2025-07-31 15:37:21"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:22 +0000] "GET /api/v2/blackboard/entries/99999 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:22 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 752 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
error: Error creating blackboard entry: Organization ID is required for department level entries {"code":"VALIDATION_ERROR","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Organization ID is required for department level entries\n    at BlackboardService.createEntry (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:115:13)\n    at createEntry (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:147:43)\n    at /app/backend/src/utils/routeHandlers.ts:31:12\n    at Layer.handleRequest (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/layer.js:152:17)\n    at next (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/route.js:157:13)\n    at handleValidationErrors (/app/backend/src/middleware/validation.ts:43:3)\n    at Layer.handleRequest (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/layer.js:152:17)\n    at next (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/route.js:157:13)\n    at middleware (/app/node_modules/.pnpm/express-validator@7.2.1/node_modules/express-validator/lib/middlewares/check.js:16:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)","statusCode":400,"timestamp":"2025-07-31 15:37:22"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:22 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 400 221 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:23 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 400 445 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:23 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:24 +0000] "PUT /api/v2/blackboard/entries/4569 HTTP/1.1" 200 719 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:24 +0000] "PUT /api/v2/blackboard/entries/4570 HTTP/1.1" 200 713 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:25 +0000] "DELETE /api/v2/blackboard/entries/4571 HTTP/1.1" 200 128 "-" "-"
error: Error getting blackboard entry: Entry not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Entry not found\n    at BlackboardService.getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:100:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:111:19)","statusCode":404,"timestamp":"2025-07-31 15:37:25"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:25 +0000] "GET /api/v2/blackboard/entries/4571 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:25 +0000] "POST /api/v2/blackboard/entries/4572/archive HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:26 +0000] "POST /api/v2/blackboard/entries/4573/unarchive HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:26 +0000] "POST /api/v2/blackboard/entries/4574/confirm HTTP/1.1" 200 130 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:27 +0000] "POST /api/v2/blackboard/entries/4575/confirm HTTP/1.1" 200 130 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:27 +0000] "GET /api/v2/blackboard/entries/4575/confirmations HTTP/1.1" 200 7266 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:27 +0000] "GET /api/v2/blackboard/dashboard HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:28 +0000] "GET /api/v2/blackboard/dashboard?limit=2 HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:28 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:28 +0000] "GET /api/v2/blackboard/tags HTTP/1.1" 200 382 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:29 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:29 +0000] "GET /api/v2/blackboard/entries/4581 HTTP/1.1" 200 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:29 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 766 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1653 "-" "-"
error: Error getting blackboard entry: Entry not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Entry not found\n    at BlackboardService.getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:100:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:111:19)","statusCode":404,"timestamp":"2025-07-31 15:37:30"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:30 +0000] "GET /api/v2/blackboard/entries/4585 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:31 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 802 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:31 +0000] "POST /api/v2/blackboard/entries/4588/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:32 +0000] "POST /api/v2/blackboard/entries/4589/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:32 +0000] "GET /api/v2/blackboard/entries/4589/attachments HTTP/1.1" 200 418 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:32 +0000] "POST /api/v2/blackboard/entries/4590/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:32 +0000] "GET /api/v2/blackboard/entries/4590/attachments HTTP/1.1" 200 416 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:32 +0000] "DELETE /api/v2/blackboard/attachments/194 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:33 +0000] "POST /api/v2/blackboard/entries/4591/attachments HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:33 +0000] "GET /api/v2/blackboard/entries?priority=high HTTP/1.1" 200 797 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:34 +0000] "GET /api/v2/blackboard/entries?requiresConfirmation=true HTTP/1.1" 200 1399 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:34 +0000] "GET /api/v2/blackboard/entries?sortBy=priority&sortDir=DESC HTTP/1.1" 200 2636 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:35 +0000] "GET /api/v2/blackboard/entries?search=Urgent HTTP/1.1" 200 797 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:35 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 751 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:36 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 737 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:36 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 720 "-" "-"
PASS backend/src/routes/v2/blackboard/__tests__/blackboard-v2.test.ts (22.218 s)
  Blackboard API v2
    GET /api/v2/blackboard/entries
      ✓ should list all entries for authenticated user (518 ms)
      ✓ should filter entries by status (508 ms)
      ✓ should support pagination (3202 ms)
      ✓ should return 401 without authentication (476 ms)
    GET /api/v2/blackboard/entries/:id
      ✓ should get a specific entry (487 ms)
      ✓ should return 404 for non-existent entry (474 ms)
    POST /api/v2/blackboard/entries
      ✓ should create a new entry as admin (499 ms)
      ✓ should require orgId for department level entries (461 ms)
      ✓ should validate required fields (457 ms)
      ✓ should reject creation from non-admin users (470 ms)
    PUT /api/v2/blackboard/entries/:id
      ✓ should update an entry as admin (495 ms)
      ✓ should allow partial updates (483 ms)
    DELETE /api/v2/blackboard/entries/:id
      ✓ should delete an entry as admin (483 ms)
    POST /api/v2/blackboard/entries/:id/archive
      ✓ should archive an entry (476 ms)
    POST /api/v2/blackboard/entries/:id/unarchive
      ✓ should unarchive an entry (458 ms)
    POST /api/v2/blackboard/entries/:id/confirm
      ✓ should confirm reading an entry (488 ms)
      ✓ should track confirmation status (499 ms)
    GET /api/v2/blackboard/dashboard
      ✓ should get dashboard entries (473 ms)
      ✓ should limit dashboard entries (460 ms)
    Tags functionality
      ✓ should get all available tags (513 ms)
      ✓ should filter entries by tag (517 ms)
    Multi-tenant isolation
      ✓ should not see entries from other tenants (656 ms)
      ✓ should not access other tenant's entry directly (679 ms)
      ✓ should allow other tenant to see their own entries (675 ms)
    Attachments functionality
      ✓ should upload an attachment to an entry (504 ms)
      ✓ should get attachments for an entry (469 ms)
      ✓ should delete an attachment (491 ms)
      ✓ should require authentication for attachment operations (476 ms)
    Advanced filtering and sorting
      ✓ should filter by priority (503 ms)
      ✓ should filter by requiresConfirmation (493 ms)
      ✓ should sort entries (501 ms)
      ✓ should search entries by title and content (474 ms)
    Entry expiration
      ✓ should create entry with expiration date (478 ms)
    Department and Team level entries
      ✓ should create department level entry with orgId (492 ms)
      ✓ should create team level entry with orgId (470 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:37:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1669 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1698 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:38 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:38 +0000] "GET /api/v2/calendar/events HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:38 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 1310 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/events?page=1&limit=1 HTTP/1.1" 200 754 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/events?status=cancelled HTTP/1.1" 200 750 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/events?search=Team HTTP/1.1" 200 756 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/events HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "POST /api/v2/calendar/events HTTP/1.1" 201 981 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "POST /api/v2/calendar/events HTTP/1.1" 201 1511 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 641 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 260 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 278 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/events/3984 HTTP/1.1" 200 1184 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/events/99999 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/events/3987 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "PUT /api/v2/calendar/events/3988 HTTP/1.1" 200 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "PUT /api/v2/calendar/events/3989 HTTP/1.1" 200 671 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "PUT /api/v2/calendar/events/3990 HTTP/1.1" 403 153 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "PUT /api/v2/calendar/events/3991 HTTP/1.1" 400 260 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "DELETE /api/v2/calendar/events/3992 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/events/3992 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "DELETE /api/v2/calendar/events/3993 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "DELETE /api/v2/calendar/events/3994 HTTP/1.1" 403 153 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "PUT /api/v2/calendar/events/3995/attendees/response HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/events/3995 HTTP/1.1" 200 1212 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "PUT /api/v2/calendar/events/3996/attendees/response HTTP/1.1" 400 254 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1663 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "PUT /api/v2/calendar/events/3997/attendees/response HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/export?format=ics HTTP/1.1" 200 493 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/export?format=csv HTTP/1.1" 200 261 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/export?format=invalid HTTP/1.1" 400 263 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/export HTTP/1.1" 400 308 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:39 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:40 +0000] "GET /api/v2/calendar/events/4007 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:40 +0000] "PUT /api/v2/calendar/events/4008 HTTP/1.1" 404 122 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:40 +0000] "DELETE /api/v2/calendar/events/4009 HTTP/1.1" 404 122 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2.test.ts
  Calendar v2 API Endpoints
    Response Format Validation
      ✓ should return standardized success response format (20 ms)
      ✓ should return standardized error response format (6 ms)
    GET /api/v2/calendar/events
      ✓ should list all events for admin (27 ms)
      ✓ should support pagination (26 ms)
      ✓ should support filtering by status (36 ms)
      ✓ should support search (31 ms)
      ✓ should require authentication (18 ms)
    POST /api/v2/calendar/events
      ✓ should create a new event (30 ms)
      ✓ should create event with attendees (47 ms)
      ✓ should validate required fields (19 ms)
      ✓ should validate date order (8 ms)
      ✓ should require orgId for department/team events (9 ms)
    GET /api/v2/calendar/events/:id
      ✓ should get event by ID (35 ms)
      ✓ should return 404 for non-existent event (28 ms)
      ✓ should respect access control for employees (31 ms)
    PUT /api/v2/calendar/events/:id
      ✓ should update event (owner) (32 ms)
      ✓ should update event (admin) (29 ms)
      ✓ should not allow non-owner employee to update (21 ms)
      ✓ should validate date updates (15 ms)
    DELETE /api/v2/calendar/events/:id
      ✓ should delete event (owner) (33 ms)
      ✓ should delete event (admin) (19 ms)
      ✓ should not allow non-owner employee to delete (13 ms)
    PUT /api/v2/calendar/events/:id/attendees/response
      ✓ should update attendee response (38 ms)
      ✓ should validate response values (25 ms)
      ✓ should add user as attendee if not already (194 ms)
    GET /api/v2/calendar/export
      ✓ should export events as ICS (25 ms)
      ✓ should export events as CSV (18 ms)
      ✓ should validate format parameter (16 ms)
      ✓ should require format parameter (15 ms)
    Multi-Tenant Isolation
      ✓ should not show events from other tenants (99 ms)
      ✓ should not access specific event from other tenant (94 ms)
      ✓ should not update event from other tenant (99 ms)
      ✓ should not delete event from other tenant (106 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:37:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:42 +0000] "POST /api/v2/shifts HTTP/1.1" 201 712 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:42 +0000] "POST /api/v2/shifts HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:43 +0000] "GET /api/v2/shifts?date=2025-07-31 HTTP/1.1" 200 769 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:43 +0000] "GET /api/v2/shifts/2456 HTTP/1.1" 200 692 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:43 +0000] "PUT /api/v2/shifts/2457 HTTP/1.1" 200 694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:44 +0000] "DELETE /api/v2/shifts/2458 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1707 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:44 +0000] "POST /api/v2/shifts/templates HTTP/1.1" 201 334 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1679 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:44 +0000] "GET /api/v2/shifts/templates HTTP/1.1" 200 327 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:45 +0000] "PUT /api/v2/shifts/templates/339 HTTP/1.1" 200 328 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:45 +0000] "DELETE /api/v2/shifts/templates/340 HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:46 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 201 268 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1707 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:46 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 403 204 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:46 +0000] "GET /api/v2/shifts/swap-requests HTTP/1.1" 200 687 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:47 +0000] "PUT /api/v2/shifts/swap-requests/212/status HTTP/1.1" 200 136 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:47 +0000] "GET /api/v2/shifts/overtime?startDate=2025-01-01&endDate=2025-01-31 HTTP/1.1" 200 460 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:47 +0000] "GET /api/v2/shifts/overtime HTTP/1.1" 400 434 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:48 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31&format=csv HTTP/1.1" 200 215 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:48 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31&format=excel HTTP/1.1" 501 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:49 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31 HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:49 +0000] "POST /api/v2/shifts HTTP/1.1" 400 263 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:49 +0000] "POST /api/v2/shifts HTTP/1.1" 400 258 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:50 +0000] "POST /api/v2/shifts HTTP/1.1" 400 372 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:53 +0000] "GET /api/v2/shifts/2466 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:53 +0000] "GET /api/v2/shifts/templates HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:54 +0000] "POST /api/v2/shifts HTTP/1.1" 201 692 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:54 +0000] "PUT /api/v2/shifts/templates/342 HTTP/1.1" 200 327 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:54 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 201 235 "-" "-"
PASS backend/src/routes/v2/__tests__/shifts-v2.test.ts (14.741 s)
  Shifts API v2
    Shifts CRUD Operations
      ✓ should create a new shift (435 ms)
      ✓ should fail to create shift without admin role (339 ms)
      ✓ should list shifts with filtering (350 ms)
      ✓ should get shift by ID (378 ms)
      ✓ should update a shift (363 ms)
      ✓ should delete a shift (381 ms)
    Shift Templates
      ✓ should create a shift template (356 ms)
      ✓ should list shift templates (358 ms)
      ✓ should update a template (402 ms)
      ✓ should delete a template (403 ms)
    Shift Swap Requests
      ✓ should create a swap request (375 ms)
      ✓ should not allow swap request for other user's shift (381 ms)
      ✓ should list swap requests (377 ms)
      ✓ should update swap request status (387 ms)
    Overtime Reporting
      ✓ should get overtime report for user (357 ms)
      ✓ should require date range for overtime report (362 ms)
    Shift Export
      ✓ should export shifts as CSV (356 ms)
      ✓ should return 501 for Excel export (350 ms)
      ✓ should require admin role for export (356 ms)
    Input Validation
      ✓ should validate time format (344 ms)
      ✓ should validate date format (335 ms)
      ✓ should validate required fields (349 ms)
    Multi-Tenant Isolation
      ✓ should not access shifts from other tenant (3267 ms)
      ✓ should not see templates from other tenant (531 ms)
    AdminLog Integration
      ✓ should log shift creation (363 ms)
      ✓ should log template updates (389 ms)
      ✓ should log swap request actions (366 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:37:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:57 +0000] "GET /api/v2/kvp/categories HTTP/1.1" 200 252 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1690 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:57 +0000] "GET /api/v2/kvp/categories HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:57 +0000] "POST /api/v2/kvp HTTP/1.1" 201 942 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:58 +0000] "POST /api/v2/kvp HTTP/1.1" 400 572 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:58 +0000] "GET /api/v2/kvp?page=1&limit=10 HTTP/1.1" 200 2323 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:58 +0000] "GET /api/v2/kvp?status=new HTTP/1.1" 200 883 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:59 +0000] "GET /api/v2/kvp HTTP/1.1" 200 1606 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:59 +0000] "GET /api/v2/kvp/3987 HTTP/1.1" 200 824 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:37:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:00 +0000] "GET /api/v2/kvp/99999 HTTP/1.1" 404 178 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:00 +0000] "PUT /api/v2/kvp/3989 HTTP/1.1" 200 841 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:00 +0000] "PUT /api/v2/kvp/3990 HTTP/1.1" 200 843 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:01 +0000] "PUT /api/v2/kvp/3992 HTTP/1.1" 404 178 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:01 +0000] "DELETE /api/v2/kvp/3993 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:01 +0000] "POST /api/v2/kvp/3994/comments HTTP/1.1" 201 227 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:02 +0000] "GET /api/v2/kvp/3995/comments HTTP/1.1" 200 493 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:02 +0000] "GET /api/v2/kvp/3996/comments HTTP/1.1" 200 292 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:03 +0000] "GET /api/v2/kvp/dashboard/stats HTTP/1.1" 200 211 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:03 +0000] "POST /api/v2/kvp/points/award HTTP/1.1" 201 264 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:03 +0000] "POST /api/v2/kvp/points/award HTTP/1.1" 403 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:04 +0000] "GET /api/v2/kvp/points/user/23630 HTTP/1.1" 200 146 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:04 +0000] "GET /api/v2/kvp/points/user/23631 HTTP/1.1" 403 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:04 +0000] "GET /api/v2/kvp/4007/attachments HTTP/1.1" 200 90 "-" "-"
PASS backend/src/routes/v2/__tests__/kvp-v2.test.ts (10.051 s)
  KVP API v2
    Categories
      ✓ should get all categories (428 ms)
      ✓ should require authentication (345 ms)
    Suggestions CRUD
      Create Suggestion
        ✓ should create a new suggestion (387 ms)
        ✓ should validate required fields (353 ms)
      List Suggestions
        ✓ should list suggestions with pagination (381 ms)
        ✓ should filter by status (379 ms)
        ✓ should respect employee visibility rules (379 ms)
      Get Suggestion by ID
        ✓ should get suggestion details (374 ms)
        ✓ should return 404 for non-existent suggestion (382 ms)
      Update Suggestion
        ✓ should update own suggestion (390 ms)
        ✓ should allow admin to update status (381 ms)
        ✓ should prevent employee from updating others suggestions (368 ms)
      Delete Suggestion
        ✓ should delete own suggestion (369 ms)
    Comments
      ✓ should add comment to suggestion (391 ms)
      ✓ should get comments for suggestion (383 ms)
      ✓ should hide internal comments from employees (360 ms)
    Dashboard Statistics
      ✓ should get dashboard statistics (360 ms)
    Points System
      ✓ should award points to user (admin only) (379 ms)
      ✓ should prevent employees from awarding points (364 ms)
      ✓ should get user points summary (470 ms)
      ✓ should allow users to see only their own points (382 ms)
    Attachments
      ✓ should get attachments for suggestion (363 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1723 "-" "-"
info: Creating new document in category general for user 23636 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document created successfully with ID 1256 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1256 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1256 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 635 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 500 35 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 401 190 "-" "-"
info: Fetching team with ID 1498 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Team 1498 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Creating new document in category work for team 1498 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document created successfully with ID 1257 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1257 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1257 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 658 "-" "-"
info: Creating new document in category salary for user 23636 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document created successfully with ID 1258 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1258 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1258 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 666 "-" "-"
info: Creating new document in category personal for user 23636 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document created successfully with ID 1259 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1259 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1259 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 626 "-" "-"
info: Fetching team with ID 1498 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Team 1498 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Creating new document in category work for team 1498 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document created successfully with ID 1260 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1260 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1260 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 636 "-" "-"
info: Creating new document in category general for entire company (tenant 4101) {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document created successfully with ID 1261 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1261 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1261 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 641 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":4101,"timestamp":"2025-07-31 15:38:07","userId":23635}
info: Finding documents with filters {"isArchived":false,"limit":20,"offset":0,"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Found 6 documents (total: 6) with filters {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents HTTP/1.1" 200 4128 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":4101,"timestamp":"2025-07-31 15:38:07","userId":23635}
info: Finding documents with filters {"category":"personal","isArchived":false,"limit":20,"offset":0,"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Found 1 documents (total: 1) with filters {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents?category=personal HTTP/1.1" 200 801 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":4101,"timestamp":"2025-07-31 15:38:07","userId":23635}
info: Finding documents with filters {"isArchived":false,"limit":20,"offset":0,"recipientType":"team","service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Found 2 documents (total: 2) with filters {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents?recipientType=team HTTP/1.1" 200 1490 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":4101,"timestamp":"2025-07-31 15:38:07","userId":23636}
info: Fetching all accessible documents for employee 23636 in tenant 4101 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Retrieved 6 accessible documents (total: 6) for employee 23636 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents HTTP/1.1" 200 4638 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":4101,"timestamp":"2025-07-31 15:38:07","userId":23635}
info: Finding documents with filters {"isArchived":false,"limit":2,"offset":0,"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Found 2 documents (total: 6) with filters {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents?page=1&limit=2 HTTP/1.1" 200 1460 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":4101,"timestamp":"2025-07-31 15:38:07","userId":23635}
info: Finding documents with filters {"isArchived":false,"limit":20,"offset":0,"searchTerm":"team","service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Found 2 documents (total: 2) with filters {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents?search=team HTTP/1.1" 200 1490 "-" "-"
info: Creating new document in category training for user 23636 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document created successfully with ID 1262 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1262 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1262 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 673 "-" "-"
info: Fetching document with ID 1262 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1262 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents/1262 HTTP/1.1" 200 673 "-" "-"
info: Fetching document with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
warn: Document with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
error: Get document error: Document not found {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents/99999 HTTP/1.1" 404 176 "-" "-"
info: Creating new document in category personal for user 23637 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document created successfully with ID 1263 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1263 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1263 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 631 "-" "-"
info: Fetching document with ID 1263 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1263 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
error: Get document error: You don't have access to this document {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents/1263 HTTP/1.1" 403 196 "-" "-"
info: Creating new document in category general for entire company (tenant 4101) {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document created successfully with ID 1264 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1264 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1264 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 656 "-" "-"
info: Fetching document with ID 1264 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1264 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Updating document 1264 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1264 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1264 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1264 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "PUT /api/v2/documents/1264 HTTP/1.1" 200 667 "-" "-"
info: Fetching document with ID 1264 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1264 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Updating document 1264 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1264 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1264 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1264 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "PUT /api/v2/documents/1264 HTTP/1.1" 200 636 "-" "-"
info: Fetching document with ID 1264 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1264 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
error: Update document error: You don't have permission to update this document {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "PUT /api/v2/documents/1264 HTTP/1.1" 403 207 "-" "-"
info: Creating new document in category general for entire company (tenant 4101) {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document created successfully with ID 1265 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1265 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1265 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 638 "-" "-"
info: Fetching document with ID 1265 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1265 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Deleting document 1265 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1265 deleted successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "DELETE /api/v2/documents/1265 HTTP/1.1" 200 131 "-" "-"
info: Fetching document with ID 1265 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
warn: Document with ID 1265 not found {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
error: Get document error: Document not found {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents/1265 HTTP/1.1" 404 176 "-" "-"
info: Creating new document in category general for entire company (tenant 4101) {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document created successfully with ID 1266 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1266 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1266 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 638 "-" "-"
info: Fetching document with ID 1266 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1266 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
error: Delete document error: Only administrators can delete documents {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "DELETE /api/v2/documents/1266 HTTP/1.1" 403 198 "-" "-"
info: Creating new document in category general for entire company (tenant 4101) {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document created successfully with ID 1267 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1267 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1267 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 643 "-" "-"
info: Archiving document 1267 for user 23635 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1267 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1267 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Updating document 1267 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1267 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents/1267/archive HTTP/1.1" 200 132 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":4101,"timestamp":"2025-07-31 15:38:07","userId":23635}
info: Finding documents with filters {"isArchived":true,"limit":20,"offset":0,"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Found 1 documents (total: 1) with filters {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents?isArchived=true HTTP/1.1" 200 820 "-" "-"
info: Fetching document with ID 1267 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1267 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Updating document 1267 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1267 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents/1267/unarchive HTTP/1.1" 200 134 "-" "-"
info: Creating new document in category general for entire company (tenant 4101) {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document created successfully with ID 1268 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Fetching document with ID 1268 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1268 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 647 "-" "-"
info: Fetching document with ID 1268 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1268 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Incrementing download count for document 1268 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Download tracked for document 1268 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents/1268/download HTTP/1.1" 200 11 "-" "-"
info: Fetching document with ID 1268 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Document 1268 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Incrementing download count for document 1268 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Download tracked for document 1268 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents/1268/preview HTTP/1.1" 200 11 "-" "-"
info: Calculating total storage used by tenant 4101 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
info: Tenant 4101 is using 143 bytes of storage {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents/stats HTTP/1.1" 200 200 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "GET /api/v2/documents/stats HTTP/1.1" 200 199 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 400 424 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 400 244 "-" "-"
error: Create document error: User ID is required for user recipient type {"service":"assixx-backend","timestamp":"2025-07-31 15:38:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:07 +0000] "POST /api/v2/documents HTTP/1.1" 400 203 "-" "-"
PASS backend/src/routes/v2/documents/__tests__/documents-v2.test.ts
  Documents API v2
    POST /api/v2/documents
      ✓ should upload a PDF document (40 ms)
      ✓ should reject non-PDF files (13 ms)
      ✓ should require authentication (4 ms)
      ✓ should upload document for team (27 ms)
      ✓ should upload salary document with year/month (31 ms)
    GET /api/v2/documents
      ✓ should list all documents for admin (40 ms)
      ✓ should filter documents by category (16 ms)
      ✓ should filter documents by recipient type (14 ms)
      ✓ should show only accessible documents for regular user (20 ms)
      ✓ should support pagination (12 ms)
      ✓ should support search (12 ms)
    GET /api/v2/documents/:id
      ✓ should get document by ID (18 ms)
      ✓ should return 404 for non-existent document (12 ms)
      ✓ should deny access to unauthorized user (111 ms)
    PUT /api/v2/documents/:id
      ✓ should update document metadata (26 ms)
      ✓ should allow clearing optional fields (22 ms)
      ✓ should require admin role for update (8 ms)
    DELETE /api/v2/documents/:id
      ✓ should delete document (39 ms)
      ✓ should require admin role for delete (32 ms)
    Archive/Unarchive
      ✓ should archive document (30 ms)
      ✓ should unarchive document (17 ms)
    Download/Preview
      ✓ should download document (12 ms)
      ✓ should preview document inline (13 ms)
    GET /api/v2/documents/stats
      ✓ should get document statistics (11 ms)
      ✓ should not show storage for regular users (8 ms)
    Validation
      ✓ should validate required fields (7 ms)
      ✓ should validate category values (6 ms)
      ✓ should validate recipient requirements (6 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1652 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1106 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "GET /api/v2/users/me HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1106 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "GET /api/v2/users?page=1&limit=10 HTTP/1.1" 200 1294 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "GET /api/v2/users?role=admin HTTP/1.1" 200 723 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "GET /api/v2/users?search=Admin HTTP/1.1" 200 723 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "GET /api/v2/users HTTP/1.1" 403 182 "-" "-"
info: User created successfully with ID: 23640 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "POST /api/v2/users HTTP/1.1" 201 1152 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "POST /api/v2/users HTTP/1.1" 400 463 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "POST /api/v2/users HTTP/1.1" 409 177 "-" "-"
info: Updating field first_name to value: Updated {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: Updating field last_name to value: Name {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: Updating field position to value: Senior Developer {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: Special handling for is_active field - received value: false, type: boolean {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: is_active will be set to: 0 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: Executing update query: UPDATE users SET `first_name` = ?, `last_name` = ?, `position` = ?, `is_active` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: With values: ["Updated","Name","Senior Developer",0,23641,4102] {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "PUT /api/v2/users/23641 HTTP/1.1" 200 1129 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "PUT /api/v2/users/23642 HTTP/1.1" 200 1115 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1720 "-" "-"
info: Archiving user 23643 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: Special handling for is_archived field - received value: true, type: boolean {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: is_archived will be set to: 1 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: Executing update query: UPDATE users SET `is_archived` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: With values: [1,23643,4102] {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "POST /api/v2/users/23643/archive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "GET /api/v2/users/23643 HTTP/1.1" 200 1116 "-" "-"
info: Archiving user 23644 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: Special handling for is_archived field - received value: true, type: boolean {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: is_archived will be set to: 1 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: Executing update query: UPDATE users SET `is_archived` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: With values: [1,23644,4102] {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "POST /api/v2/users/23644/archive HTTP/1.1" 200 92 "-" "-"
info: Unarchiving user 23644 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: Special handling for is_archived field - received value: false, type: boolean {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: is_archived will be set to: 0 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: Executing update query: UPDATE users SET `is_archived` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
info: With values: [0,23644,4102] {"service":"assixx-backend","timestamp":"2025-07-31 15:38:10"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "POST /api/v2/users/23644/unarchive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:10 +0000] "GET /api/v2/users/23644 HTTP/1.1" 200 1117 "-" "-"
info: Password changed successfully for user 23639 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:11"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 400 253 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "GET /api/v2/users/me/profile-picture HTTP/1.1" 200 15 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "DELETE /api/v2/users/me/profile-picture HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "GET /api/v2/users/me/profile-picture HTTP/1.1" 404 183 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "PUT /api/v2/users/23645/availability HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "PUT /api/v2/users/23646/availability HTTP/1.1" 400 261 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "GET /api/v2/users/23638 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:11 +0000] "GET /api/v2/users HTTP/1.1" 200 721 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2.test.ts
  Users v2 API Endpoints
    Response Format Validation
      ✓ should return standardized success response format (15 ms)
      ✓ should return standardized error response format (5 ms)
    Field Mapping (camelCase)
      ✓ should return user data with camelCase fields (9 ms)
    GET /api/v2/users
      ✓ should list users with pagination (admin only) (13 ms)
      ✓ should filter users by role (9 ms)
      ✓ should search users by name or email (10 ms)
      ✓ should deny access to non-admin users (9 ms)
    POST /api/v2/users
      ✓ should create a new user with camelCase input (182 ms)
      ✓ should validate required fields (6 ms)
      ✓ should prevent duplicate emails (8 ms)
    PUT /api/v2/users/:id
      ✓ should update user with camelCase fields (110 ms)
      ✓ should not allow password updates via this endpoint (180 ms)
    POST /api/v2/users/:id/archive & /unarchive
      ✓ should archive a user (104 ms)
      ✓ should unarchive a user (143 ms)
    PUT /api/v2/users/me/password
      ✓ should change password with correct current password (254 ms)
      ✓ should reject incorrect current password (80 ms)
      ✓ should validate password confirmation (7 ms)
    Profile Picture Endpoints
      ✓ should upload profile picture (19 ms)
      ✓ should download profile picture (20 ms)
      ✓ should delete profile picture (29 ms)
    PUT /api/v2/users/:id/availability
      ✓ should update user availability (96 ms)
      ✓ should validate availability status enum (86 ms)
    Multi-Tenant Isolation
      ✓ should not allow cross-tenant user access (11 ms)
      ✓ should not list users from other tenants (10 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1633 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1634 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:13 +0000] "POST /api/v2/notifications HTTP/1.1" 201 111 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "POST /api/v2/notifications HTTP/1.1" 201 111 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "POST /api/v2/notifications HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "POST /api/v2/notifications HTTP/1.1" 400 495 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "POST /api/v2/notifications HTTP/1.1" 201 111 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "GET /api/v2/notifications HTTP/1.1" 200 1442 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "GET /api/v2/notifications?type=task HTTP/1.1" 200 602 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "GET /api/v2/notifications?priority=high HTTP/1.1" 200 605 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "GET /api/v2/notifications?page=1&limit=2 HTTP/1.1" 200 1023 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "GET /api/v2/notifications HTTP/1.1" 200 184 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "PUT /api/v2/notifications/1394/read HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "PUT /api/v2/notifications/1395/read HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "PUT /api/v2/notifications/1395/read HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "PUT /api/v2/notifications/1396/read HTTP/1.1" 404 180 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "PUT /api/v2/notifications/mark-all-read HTTP/1.1" 200 105 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "DELETE /api/v2/notifications/1402 HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "DELETE /api/v2/notifications/1403 HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "DELETE /api/v2/notifications/1404 HTTP/1.1" 404 180 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "GET /api/v2/notifications/preferences HTTP/1.1" 200 405 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "PUT /api/v2/notifications/preferences HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "GET /api/v2/notifications/preferences HTTP/1.1" 200 354 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "PUT /api/v2/notifications/preferences HTTP/1.1" 400 276 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "GET /api/v2/notifications/stats HTTP/1.1" 200 285 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "GET /api/v2/notifications/stats HTTP/1.1" 403 189 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "GET /api/v2/notifications/stats/me HTTP/1.1" 200 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "POST /api/v2/notifications/subscribe HTTP/1.1" 200 136 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "DELETE /api/v2/notifications/subscribe/sub_123 HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "GET /api/v2/notifications/templates HTTP/1.1" 200 104 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:14 +0000] "POST /api/v2/notifications/from-template HTTP/1.1" 404 176 "-" "-"
PASS backend/src/routes/v2/notifications/__tests__/notifications-v2.test.ts
  Notifications API v2
    POST /api/v2/notifications
      ✓ should create notification as admin (31 ms)
      ✓ should create targeted notification (31 ms)
      ✓ should deny notification creation by employees (12 ms)
      ✓ should validate required fields (8 ms)
      ✓ should create notification with metadata (17 ms)
    GET /api/v2/notifications
      ✓ should list notifications for user (31 ms)
      ✓ should filter by type (30 ms)
      ✓ should filter by priority (29 ms)
      ✓ should paginate results (28 ms)
      ✓ should enforce tenant isolation (32 ms)
    PUT /api/v2/notifications/:id/read
      ✓ should mark notification as read (28 ms)
      ✓ should handle already read notifications (35 ms)
      ✓ should return 404 for notifications from other tenants (22 ms)
    PUT /api/v2/notifications/mark-all-read
      ✓ should mark all notifications as read (54 ms)
    DELETE /api/v2/notifications/:id
      ✓ should delete notification as admin (30 ms)
      ✓ should allow users to delete their own notifications (22 ms)
      ✓ should enforce tenant isolation on delete (13 ms)
    Notification Preferences
      GET /api/v2/notifications/preferences
        ✓ should get default preferences (12 ms)
      PUT /api/v2/notifications/preferences
        ✓ should update notification preferences (28 ms)
        ✓ should validate preference structure (6 ms)
    Notification Statistics
      ✓ should get notification statistics for admin (56 ms)
      ✓ should deny stats access to employees (58 ms)
      ✓ should get personal notification stats (59 ms)
    Real-time Notifications
      ✓ should subscribe to notification updates (10 ms)
      ✓ should unsubscribe from notifications (8 ms)
    Notification Templates
      ✓ should list notification templates for admin (9 ms)
      ✓ should return 404 for non-existent template (9 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1655 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
Created conversation 1 with ID: 374
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "GET /api/v2/chat/users HTTP/1.1" 200 664 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "GET /api/v2/chat/users?search=chat_employee_test HTTP/1.1" 200 385 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "GET /api/v2/chat/users HTTP/1.1" 401 190 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 4106,
  creatorId: 23651,
  data: {
    participantIds: [ 23653 ],
    name: 'New Test 1:1 Chat',
    isGroup: undefined
  }
}
[Chat Service] Creating new conversation with isGroup: false
[Chat Service] Created conversation with ID: 376
[Chat Service] getConversations called with: { tenantId: 4106, userId: 23651, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 4106
        AND cp.user_id = 23651
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 676 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 4106,
  creatorId: 23651,
  data: {
    participantIds: [ 23652, 23653 ],
    name: 'Test Group Chat',
    isGroup: undefined
  }
}
[Chat Service] Creating new conversation with isGroup: true
[Chat Service] Created conversation with ID: 377
[Chat Service] getConversations called with: { tenantId: 4106, userId: 23651, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 4106
        AND cp.user_id = 23651
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 869 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 4106,
  creatorId: 23651,
  data: {
    participantIds: [ 23652 ],
    name: 'Another attempt',
    isGroup: undefined
  }
}
[Chat Service] getConversations called with: { tenantId: 4106, userId: 23651, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 4106
        AND cp.user_id = 23651
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 400 270 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 4106,
  userId: 23651,
  filters: {
    search: undefined,
    isGroup: undefined,
    hasUnread: false,
    page: NaN,
    limit: NaN
  }
}
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 4106
        AND cp.user_id = 23651
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "GET /api/v2/chat/conversations HTTP/1.1" 200 2889 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 4106,
  userId: 23651,
  filters: {
    search: undefined,
    isGroup: undefined,
    hasUnread: false,
    page: 1,
    limit: 5
  }
}
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 4106
        AND cp.user_id = 23651
        ORDER BY c.created_at DESC
        LIMIT 5 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "GET /api/v2/chat/conversations?page=1&limit=5 HTTP/1.1" 200 2888 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 4106,
  userId: 23651,
  filters: {
    search: 'Test Group',
    isGroup: undefined,
    hasUnread: false,
    page: NaN,
    limit: NaN
  }
}
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 4106
        AND cp.user_id = 23651
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "GET /api/v2/chat/conversations?search=Test%20Group HTTP/1.1" 200 2889 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations/374/messages HTTP/1.1" 201 421 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations/374/messages HTTP/1.1" 400 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations/378/messages HTTP/1.1" 403 170 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations/374/messages HTTP/1.1" 201 414 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations/374/messages HTTP/1.1" 201 420 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "GET /api/v2/chat/conversations/374/messages HTTP/1.1" 200 1486 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations/374/messages HTTP/1.1" 201 414 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations/374/messages HTTP/1.1" 201 420 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "GET /api/v2/chat/conversations/374/messages?page=1&limit=1 HTTP/1.1" 200 524 "-" "-"
Test conversationId: 374
Test authToken2: exists
[Chat Controller] markAsRead called
[Chat Controller] markAsRead - conversationId: 374 userId: 23652
[Chat Service] markConversationAsRead: { conversationId: 374, userId: 23652 }
[Chat Service] User is participant, getting unread messages
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations/374/read HTTP/1.1" 200 105 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations/374/messages HTTP/1.1" 201 419 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "GET /api/v2/chat/unread-count HTTP/1.1" 200 250 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 4106,
  creatorId: 23651,
  data: {
    participantIds: [ 23653 ],
    name: 'To be deleted',
    isGroup: undefined
  }
}
[Chat Service] getConversations called with: { tenantId: 4106, userId: 23651, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 4106
        AND cp.user_id = 23651
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 676 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "DELETE /api/v2/chat/conversations/376 HTTP/1.1" 200 135 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 4106,
  userId: 23651,
  filters: {
    search: undefined,
    isGroup: undefined,
    hasUnread: false,
    page: NaN,
    limit: NaN
  }
}
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 4106
        AND cp.user_id = 23651
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "GET /api/v2/chat/conversations HTTP/1.1" 200 2892 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "GET /api/v2/chat/conversations/374 HTTP/1.1" 200 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "GET /api/v2/chat/conversations/99999 HTTP/1.1" 404 180 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "PUT /api/v2/chat/conversations/374 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "PUT /api/v2/chat/messages/1 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "DELETE /api/v2/chat/messages/1 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:17 +0000] "GET /api/v2/chat/search?q=test HTTP/1.1" 501 191 "-" "-"
PASS backend/src/routes/v2/chat/__tests__/chat-v2.test.ts
  Chat API v2
    GET /api/v2/chat/users
      ✓ should get available chat users (24 ms)
      ✓ should filter users by search term (8 ms)
      ✓ should return 401 without auth (5 ms)
    POST /api/v2/chat/conversations
      ✓ should create a new conversation (39 ms)
      ✓ should create a group conversation (33 ms)
      ✓ should return existing conversation for 1:1 chats (21 ms)
      ✓ should validate participant IDs (11 ms)
    GET /api/v2/chat/conversations
      ✓ should get user conversations (18 ms)
      ✓ should support pagination (14 ms)
      ✓ should filter by search (16 ms)
    POST /api/v2/chat/conversations/:id/messages
      ✓ should send a message (25 ms)
      ✓ should validate message content (7 ms)
      ✓ should prevent access to conversations user is not part of (17 ms)
    GET /api/v2/chat/conversations/:id/messages
      ✓ should get conversation messages (42 ms)
      ✓ should support pagination (39 ms)
    POST /api/v2/chat/conversations/:id/read
      ✓ should mark conversation as read (27 ms)
    GET /api/v2/chat/unread-count
      ✓ should get unread message count (30 ms)
    DELETE /api/v2/chat/conversations/:id
      ✓ should delete a conversation (45 ms)
    GET /api/v2/chat/conversations/:id
      ✓ should get conversation details (11 ms)
      ✓ should return 404 for non-existent conversation (9 ms)
    Not Implemented Endpoints
      ✓ PUT /api/v2/chat/conversations/:id should return 501 (5 ms)
      ✓ PUT /api/v2/chat/messages/:id should return 501 (4 ms)
      ✓ DELETE /api/v2/chat/messages/:id should return 501 (6 ms)
      ✓ GET /api/v2/chat/search should return 501 (5 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
info: Fetching all departments for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:19"}
info: Retrieved 2 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 15:38:19"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:19 +0000] "GET /api/v2/departments HTTP/1.1" 200 672 "-" "-"
info: Fetching all departments for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 2 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "GET /api/v2/departments?includeExtended=false HTTP/1.1" 200 522 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "GET /api/v2/departments HTTP/1.1" 401 190 "-" "-"
info: Fetching all departments for tenant 4108 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 0 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "GET /api/v2/departments HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "GET /api/v2/departments/stats HTTP/1.1" 200 125 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "GET /api/v2/departments/stats HTTP/1.1" 200 125 "-" "-"
info: Fetching all departments for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 2 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "GET /api/v2/departments/2008 HTTP/1.1" 200 406 "-" "-"
info: Fetching all departments for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 2 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
error: Error in getDepartmentById: Department not found {"code":404,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Department not found\n    at DepartmentService.getDepartmentById (/app/backend/src/routes/v2/departments/departments.service.ts:109:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.getDepartmentById (/app/backend/src/routes/v2/departments/departments.controller.ts:72:26)\n    at /app/backend/src/routes/v2/departments/index.ts:120:5","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "GET /api/v2/departments/99999 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "GET /api/v2/departments/invalid HTTP/1.1" 400 178 "-" "-"
info: Fetching all departments for tenant 4108 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 0 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
error: Error in getDepartmentById: Department not found {"code":404,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Department not found\n    at DepartmentService.getDepartmentById (/app/backend/src/routes/v2/departments/departments.service.ts:109:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.getDepartmentById (/app/backend/src/routes/v2/departments/departments.controller.ts:72:26)\n    at /app/backend/src/routes/v2/departments/index.ts:120:5","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "GET /api/v2/departments/2008 HTTP/1.1" 404 177 "-" "-"
info: Creating new department: Marketing {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Department created successfully with ID 2011 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Fetching all departments for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 3 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "POST /api/v2/departments HTTP/1.1" 201 422 "-" "-"
info: Fetching department with ID 2008 for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Department 2008 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Creating new department: Frontend Team {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Department created successfully with ID 2012 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Fetching all departments for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 3 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "POST /api/v2/departments HTTP/1.1" 201 359 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "POST /api/v2/departments HTTP/1.1" 403 201 "-" "-"
error: Error in createDepartment: Department name is required {"code":400,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Department name is required\n    at DepartmentService.createDepartment (/app/backend/src/routes/v2/departments/departments.service.ts:145:15)\n    at DepartmentController.createDepartment (/app/backend/src/routes/v2/departments/departments.controller.ts:136:50)\n    at /app/backend/src/routes/v2/departments/index.ts:159:32\n    at /app/backend/src/utils/routeHandlers.ts:31:12\n    at Layer.handleRequest (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/layer.js:152:17)\n    at next (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/route.js:157:13)\n    at middleware (/app/node_modules/.pnpm/express-validator@7.2.1/node_modules/express-validator/lib/middlewares/check.js:16:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "POST /api/v2/departments HTTP/1.1" 400 192 "-" "-"
info: Creating new department: Engineering {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
error: Error creating department: Duplicate entry '4107-Engineering' for key 'departments.unique_dept_name_per_tenant' {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
error: Error in createDepartment: Department name already exists {"code":400,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Department name already exists\n    at DepartmentService.createDepartment (/app/backend/src/routes/v2/departments/departments.service.ts:176:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.createDepartment (/app/backend/src/routes/v2/departments/departments.controller.ts:136:26)\n    at /app/backend/src/routes/v2/departments/index.ts:159:5","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "POST /api/v2/departments HTTP/1.1" 400 187 "-" "-"
info: Fetching department with ID 2009 for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Department 2009 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Updating department 2009 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Department 2009 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Fetching all departments for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 2 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "PUT /api/v2/departments/2009 HTTP/1.1" 200 427 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "PUT /api/v2/departments/2008 HTTP/1.1" 403 201 "-" "-"
info: Fetching department with ID 2008 for tenant 4108 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
warn: Department with ID 2008 not found {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
error: Error in updateDepartment: Department not found {"code":404,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Department not found\n    at DepartmentService.updateDepartment (/app/backend/src/routes/v2/departments/departments.service.ts:196:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.updateDepartment (/app/backend/src/routes/v2/departments/departments.controller.ts:222:26)\n    at /app/backend/src/routes/v2/departments/index.ts:207:5","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "PUT /api/v2/departments/2008 HTTP/1.1" 404 177 "-" "-"
info: Fetching department with ID 2008 for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Department 2008 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
error: Error in updateDepartment: Manager not found {"code":400,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Manager not found\n    at DepartmentService.updateDepartment (/app/backend/src/routes/v2/departments/departments.service.ts:218:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.updateDepartment (/app/backend/src/routes/v2/departments/departments.controller.ts:222:26)\n    at /app/backend/src/routes/v2/departments/index.ts:207:5","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "PUT /api/v2/departments/2008 HTTP/1.1" 400 174 "-" "-"
info: Creating new department: ToDelete {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Department created successfully with ID 2014 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Fetching all departments for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 3 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "POST /api/v2/departments HTTP/1.1" 201 354 "-" "-"
info: Fetching department with ID 2014 for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Department 2014 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Fetching users for department 2014 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 0 users for department 2014 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Deleting department 2014 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Department 2014 deleted successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "DELETE /api/v2/departments/2014 HTTP/1.1" 200 133 "-" "-"
info: Fetching department with ID 2008 for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Department 2008 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Fetching users for department 2008 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 1 users for department 2008 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
error: Error in deleteDepartment: Cannot delete department with assigned users {"code":400,"details":{"userCount":1},"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Cannot delete department with assigned users\n    at DepartmentService.deleteDepartment (/app/backend/src/routes/v2/departments/departments.service.ts:267:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.deleteDepartment (/app/backend/src/routes/v2/departments/departments.controller.ts:294:7)\n    at /app/backend/src/routes/v2/departments/index.ts:249:5","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "DELETE /api/v2/departments/2008 HTTP/1.1" 400 227 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "DELETE /api/v2/departments/2009 HTTP/1.1" 403 201 "-" "-"
info: Fetching department with ID 2008 for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Department 2008 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Fetching users for department 2008 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 2 users for department 2008 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "GET /api/v2/departments/2008/members HTTP/1.1" 200 589 "-" "-"
info: Fetching department with ID 2009 for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Department 2009 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Fetching users for department 2009 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 0 users for department 2009 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "GET /api/v2/departments/2009/members HTTP/1.1" 200 90 "-" "-"
info: Fetching department with ID 2008 for tenant 4108 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
warn: Department with ID 2008 not found {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
error: Error in getDepartmentMembers: Department not found {"code":404,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Department not found\n    at DepartmentService.getDepartmentMembers (/app/backend/src/routes/v2/departments/departments.service.ts:297:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.getDepartmentMembers (/app/backend/src/routes/v2/departments/departments.controller.ts:350:23)\n    at /app/backend/src/routes/v2/departments/index.ts:289:5","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "GET /api/v2/departments/2008/members HTTP/1.1" 404 177 "-" "-"
info: Fetching all departments for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
info: Retrieved 2 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "GET /api/v2/departments HTTP/1.1" 200 748 "-" "-"
info: Fetching department with ID 2016 for tenant 4107 {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
warn: Department with ID 2016 not found {"service":"assixx-backend","timestamp":"2025-07-31 15:38:20"}
error: Error in createDepartment: Parent department not found {"code":400,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Parent department not found\n    at DepartmentService.createDepartment (/app/backend/src/routes/v2/departments/departments.service.ts:152:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.createDepartment (/app/backend/src/routes/v2/departments/departments.controller.ts:136:26)\n    at /app/backend/src/routes/v2/departments/index.ts:159:5","timestamp":"2025-07-31 15:38:20"}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:20 +0000] "POST /api/v2/departments HTTP/1.1" 400 184 "-" "-"
PASS backend/src/routes/v2/departments/__tests__/departments-v2.test.ts
  Departments v2 API Endpoints
    GET /api/v2/departments
      ✓ should return all departments for authenticated user (22 ms)
      ✓ should return departments without extended fields when includeExtended=false (11 ms)
      ✓ should require authentication (4 ms)
      ✓ should not return departments from other tenants (10 ms)
    GET /api/v2/departments/stats
      ✓ should return department statistics (19 ms)
      ✓ should return stats only for user's tenant (14 ms)
    GET /api/v2/departments/:id
      ✓ should return a specific department (17 ms)
      ✓ should return 404 for non-existent department (21 ms)
      ✓ should return 400 for invalid department ID (8 ms)
      ✓ should not return department from other tenant (12 ms)
    POST /api/v2/departments
      ✓ should create a new department as admin (57 ms)
      ✓ should create a department with parent (25 ms)
      ✓ should require admin or root role (12 ms)
      ✓ should validate required fields (10 ms)
      ✓ should not allow duplicate department names (15 ms)
    PUT /api/v2/departments/:id
      ✓ should update a department (19 ms)
      ✓ should require admin or root role for update (9 ms)
      ✓ should not update department from other tenant (9 ms)
      ✓ should validate manager exists in same tenant (11 ms)
    DELETE /api/v2/departments/:id
      ✓ should delete a department without users (37 ms)
      ✓ should not delete department with assigned users (25 ms)
      ✓ should require admin or root role for deletion (8 ms)
    GET /api/v2/departments/:id/members
      ✓ should return department members (27 ms)
      ✓ should return empty array for department without members (13 ms)
      ✓ should not return members from other tenant's department (14 ms)
    Multi-tenant isolation
      ✓ should completely isolate department data between tenants (28 ms)
      ✓ should not allow cross-tenant parent department assignment (29 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getOverviewReport called with: { tenantId: 4109, dateFrom: undefined, dateTo: undefined }
[Reports Service] Getting employee metrics...
[Reports Service] Getting department metrics...
[Reports Service] Getting shift metrics...
[Reports Service] Getting KVP metrics...
[Reports Service] Getting survey metrics...
[Reports Service] Overview report generated successfully
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:22 +0000] "GET /api/v2/reports/overview HTTP/1.1" 200 421 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getOverviewReport called with: { tenantId: 4109, dateFrom: undefined, dateTo: undefined }
[Reports Service] Getting employee metrics...
[Reports Service] Getting department metrics...
[Reports Service] Getting shift metrics...
[Reports Service] Getting KVP metrics...
[Reports Service] Getting survey metrics...
[Reports Service] Overview report generated successfully
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:23 +0000] "GET /api/v2/reports/overview HTTP/1.1" 200 421 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getOverviewReport called with: { tenantId: 4109, dateFrom: '2025-01-01', dateTo: '2025-01-31' }
[Reports Service] Getting employee metrics...
[Reports Service] Getting department metrics...
[Reports Service] Getting shift metrics...
[Reports Service] Getting KVP metrics...
[Reports Service] Getting survey metrics...
[Reports Service] Overview report generated successfully
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:26 +0000] "GET /api/v2/reports/overview?dateFrom=2025-01-01&dateTo=2025-01-31 HTTP/1.1" 200 421 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:26 +0000] "GET /api/v2/reports/overview HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:27 +0000] "GET /api/v2/reports/employees HTTP/1.1" 200 297 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:27 +0000] "GET /api/v2/reports/employees?departmentId=2017 HTTP/1.1" 200 316 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:27 +0000] "GET /api/v2/reports/employees?teamId=1500 HTTP/1.1" 200 309 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1712 "-" "-"
[Reports Service] getDepartmentReport called with: { tenantId: 4109, dateFrom: undefined, dateTo: undefined }
[Reports Service] Department data query result: [
  [
    {
      department_id: 2017,
      department_name: 'Engineering',
      employees: 8,
      teams: 1,
      kvp_suggestions: 0,
      shift_coverage: '1.0000',
      avg_overtime: 0
    }
  ],
  [
    `department_id` INT NOT NULL,
    `department_name` VARCHAR(100) NOT NULL,
    `employees` BIGINT(21) NOT NULL,
    `teams` BIGINT(21) NOT NULL,
    `kvp_suggestions` BIGINT(21) NOT NULL,
    `shift_coverage` DECIMAL(14,4) NOT NULL,
    `avg_overtime` BIGINT(2) NOT NULL
  ]
]
[Reports Service] Mapped department result: [
  {
    departmentId: 2017,
    departmentName: 'Engineering',
    metrics: {
      employees: 8,
      teams: 1,
      kvpSuggestions: 0,
      shiftCoverage: 1,
      avgOvertime: 0
    }
  }
]
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:28 +0000] "GET /api/v2/reports/departments HTTP/1.1" 200 231 "-" "-"
Department report data: [
  {
    "departmentId": 2017,
    "departmentName": "Engineering",
    "metrics": {
      "employees": 8,
      "teams": 1,
      "kvpSuggestions": 0,
      "shiftCoverage": 1,
      "avgOvertime": 0
    }
  }
]
Department ID: 2017
Tenant ID: 4109
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:28 +0000] "GET /api/v2/reports/shifts HTTP/1.1" 200 497 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:29 +0000] "GET /api/v2/reports/shifts HTTP/1.1" 200 497 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getKvpReport called with: {
  tenantId: 4109,
  dateFrom: undefined,
  dateTo: undefined,
  categoryId: undefined
}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:29 +0000] "GET /api/v2/reports/kvp HTTP/1.1" 200 375 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getKvpReport called with: {
  tenantId: 4109,
  dateFrom: undefined,
  dateTo: undefined,
  categoryId: undefined
}
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:29 +0000] "GET /api/v2/reports/kvp HTTP/1.1" 200 375 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:30 +0000] "GET /api/v2/reports/attendance?dateFrom=2025-01-01&dateTo=2025-01-31 HTTP/1.1" 200 2729 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:30 +0000] "GET /api/v2/reports/attendance HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:31 +0000] "GET /api/v2/reports/attendance?dateFrom=2025-01-01&dateTo=2025-05-01 HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:31 +0000] "GET /api/v2/reports/compliance?dateFrom=2025-01-01&dateTo=2025-01-31 HTTP/1.1" 200 449 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:31 +0000] "GET /api/v2/reports/compliance?dateFrom=2025-01-01&dateTo=2025-01-31 HTTP/1.1" 200 740 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:32 +0000] "POST /api/v2/reports/custom HTTP/1.1" 201 544 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:32 +0000] "POST /api/v2/reports/custom HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:33 +0000] "POST /api/v2/reports/custom HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getOverviewReport called with: { tenantId: 4109, dateFrom: undefined, dateTo: undefined }
[Reports Service] Getting employee metrics...
[Reports Service] Getting department metrics...
[Reports Service] Getting shift metrics...
[Reports Service] Getting KVP metrics...
[Reports Service] Getting survey metrics...
[Reports Service] Overview report generated successfully
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:33 +0000] "GET /api/v2/reports/export/overview?format=pdf HTTP/1.1" 200 476 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:33 +0000] "GET /api/v2/reports/export/shifts?format=excel&dateFrom=2025-01-01&dateTo=2025-01-31 HTTP/1.1" 200 317 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getKvpReport called with: { tenantId: 4109, dateFrom: undefined, dateTo: undefined }
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:34 +0000] "GET /api/v2/reports/export/kvp?format=csv HTTP/1.1" 200 284 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1712 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:34 +0000] "GET /api/v2/reports/export/invalid_type?format=pdf HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:35 +0000] "GET /api/v2/reports/export/overview?format=invalid_format HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:35 +0000] "GET /api/v2/reports/export/overview HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getOverviewReport called with: { tenantId: 4109, dateFrom: undefined, dateTo: undefined }
[Reports Service] Getting employee metrics...
[Reports Service] Getting department metrics...
[Reports Service] Getting shift metrics...
[Reports Service] Getting KVP metrics...
[Reports Service] Getting survey metrics...
[Reports Service] Overview report generated successfully
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:35 +0000] "GET /api/v2/reports/overview HTTP/1.1" 200 425 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1706 "-" "-"
[Reports Service] getOverviewReport called with: { tenantId: 4110, dateFrom: undefined, dateTo: undefined }
[Reports Service] Getting employee metrics...
[Reports Service] Getting department metrics...
[Reports Service] Getting shift metrics...
[Reports Service] Getting KVP metrics...
[Reports Service] Getting survey metrics...
[Reports Service] Overview report generated successfully
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:36 +0000] "GET /api/v2/reports/overview HTTP/1.1" 200 421 "-" "-"
PASS backend/src/routes/v2/reports/__tests__/reports-v2.test.ts (15.936 s)
  Reports API v2
    GET /api/v2/reports/overview
      ✓ should get company overview report as admin (487 ms)
      ✓ should get overview report as employee (3151 ms)
      ✓ should accept date range parameters (411 ms)
      ✓ should require authentication (388 ms)
    GET /api/v2/reports/employees
      ✓ should get employee analytics report (391 ms)
      ✓ should filter by department (406 ms)
      ✓ should filter by team (372 ms)
    GET /api/v2/reports/departments
      ✓ should get department performance report (403 ms)
    GET /api/v2/reports/shifts
      ✓ should get shift analytics report (430 ms)
      ✓ should include overtime breakdown (397 ms)
    GET /api/v2/reports/kvp
      ✓ should get KVP ROI report (400 ms)
      ✓ should calculate ROI correctly (398 ms)
    GET /api/v2/reports/attendance
      ✓ should get attendance report with required dates (403 ms)
      ✓ should require date parameters (442 ms)
      ✓ should validate date range (max 90 days) (391 ms)
    GET /api/v2/reports/compliance
      ✓ should get compliance report (429 ms)
      ✓ should include violation breakdown (377 ms)
    POST /api/v2/reports/custom
      ✓ should generate custom report (400 ms)
      ✓ should validate required fields (390 ms)
      ✓ should validate metrics array (406 ms)
    GET /api/v2/reports/export/:type
      ✓ should export overview report as PDF (409 ms)
      ✓ should export shifts report as Excel (384 ms)
      ✓ should export kvp report as CSV (408 ms)
      ✓ should validate report type (373 ms)
      ✓ should validate export format (414 ms)
      ✓ should require format parameter (394 ms)
    Authorization Tests
      ✓ should allow employees to access reports (385 ms)
      ✓ should isolate data by tenant (568 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1613 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1614 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1635 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 200 726 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 736 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 736 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/role-switch/to-original HTTP/1.1" 200 730 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 403 158 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/role-switch/to-original HTTP/1.1" 200 741 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 403 161 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 403 158 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 179 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:38 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 181 "-" "-"
PASS backend/src/routes/v2/role-switch/__tests__/role-switch-v2.test.ts
  Role Switch API v2 - CRITICAL SECURITY TESTS
    ROOT USER TESTS
      ✓ Root can switch to admin view (20 ms)
      ✓ Root can switch to employee view (22 ms)
      ✓ Root can switch back to original role (25 ms)
    ADMIN USER TESTS
      ✓ Admin can switch to employee view (11 ms)
      ✓ Admin cannot use root-to-admin endpoint (8 ms)
      ✓ Admin can switch back to original role (24 ms)
    EMPLOYEE USER TESTS
      ✓ Employee cannot switch to employee view (6 ms)
      ✓ Employee cannot use root-to-admin endpoint (8 ms)
      ✓ Employee status shows cannot switch (6 ms)
    CRITICAL SECURITY TESTS
      ✓ CRITICAL: Admin logs have correct tenant_id (16 ms)
      ✓ GET /api/v2/role-switch/status returns correct information (8 ms)
      ✓ Switched token preserves all security properties (19 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1695 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:40 +0000] "GET /api/v2/settings/system HTTP/1.1" 403 171 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1695 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:40 +0000] "GET /api/v2/settings/system HTTP/1.1" 403 171 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1695 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:41 +0000] "GET /api/v2/settings/system HTTP/1.1" 403 171 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1695 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:41 +0000] "GET /api/v2/settings/system?category=appearance HTTP/1.1" 403 171 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1695 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1690 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:41 +0000] "GET /api/v2/settings/tenant HTTP/1.1" 200 306 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1695 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:42 +0000] "POST /api/v2/settings/tenant HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1695 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:42 +0000] "POST /api/v2/settings/tenant HTTP/1.1" 403 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1695 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:43 +0000] "PUT /api/v2/settings/tenant/update.test HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1695 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:43 +0000] "GET /api/v2/settings/user HTTP/1.1" 200 103 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1695 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1690 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:43 +0000] "POST /api/v2/settings/user HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1690 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:44 +0000] "POST /api/v2/settings/user HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:44 +0000] "POST /api/v2/settings/user HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:44 +0000] "POST /api/v2/settings/user HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:44 +0000] "GET /api/v2/settings/user HTTP/1.1" 200 707 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1690 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:44 +0000] "POST /api/v2/settings/user HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:44 +0000] "DELETE /api/v2/settings/user/delete.me HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:44 +0000] "GET /api/v2/settings/user/delete.me HTTP/1.1" 404 175 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1690 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:44 +0000] "GET /api/v2/settings/categories HTTP/1.1" 200 681 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1695 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:45 +0000] "PUT /api/v2/settings/bulk HTTP/1.1" 200 163 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1695 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:45 +0000] "PUT /api/v2/settings/bulk HTTP/1.1" 200 177 "-" "-"
FAIL backend/src/routes/v2/settings/__tests__/settings-v2.test.ts (7.348 s)
  Settings API v2
    System Settings
      ✓ should deny employees access to system settings (388 ms)
      ✕ should allow admin to get system settings (341 ms)
      ✕ should create and get system setting (366 ms)
      ✕ should filter system settings by category (357 ms)
    Tenant Settings
      ✓ should get tenant settings (382 ms)
      ✓ should allow admin to create tenant setting (365 ms)
      ✓ should deny employee from creating tenant settings (378 ms)
      ✓ should update tenant setting (375 ms)
    User Settings
      ✓ should get user settings (359 ms)
      ✓ should create user setting (381 ms)
      ✓ should handle different value types (423 ms)
      ✓ should delete user setting (376 ms)
    Common Endpoints
      ✓ should get categories (361 ms)
      ✓ should bulk update user settings (380 ms)
      ✓ should bulk update tenant settings as admin (390 ms)

  ● Settings API v2 › System Settings › should allow admin to get system settings

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 403

       99 |         .set("Authorization", `Bearer ${adminToken}`);
      100 |
    > 101 |       expect(response.status).toBe(200);
          |                               ^
      102 |       expect(response.body.success).toBe(true);
      103 |       expect(response.body.data.settings).toBeInstanceOf(Array);
      104 |     });

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-v2.test.ts:101:31)

  ● Settings API v2 › System Settings › should create and get system setting

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 403

      117 |         .set("Authorization", `Bearer ${adminToken}`);
      118 |
    > 119 |       expect(response.status).toBe(200);
          |                               ^
      120 |       expect(response.body.data.settings).toHaveLength(1);
      121 |       expect(response.body.data.settings[0]).toMatchObject({
      122 |         settingKey: "app.name",

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-v2.test.ts:119:31)

  ● Settings API v2 › System Settings › should filter system settings by category

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 403

      138 |         .set("Authorization", `Bearer ${adminToken}`);
      139 |
    > 140 |       expect(response.status).toBe(200);
          |                               ^
      141 |       expect(response.body.data.settings).toHaveLength(1);
      142 |       expect(response.body.data.settings[0].settingKey).toBe("app.theme");
      143 |     });

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-v2.test.ts:140:31)

PASS backend/src/routes/v2/calendar/calendar.service.logic.test.ts
  Calendar Service Business Logic
    Date Validation Logic
      ✓ should validate that end time is after start time (2 ms)
      ✓ should detect invalid date order
      ✓ should handle all-day events (1 ms)
    Organization Level Validation
      ✓ should require orgId for department events
      ✓ should require orgId for team events
      ✓ should not require orgId for personal events
      ✓ should not require orgId for company events
    Pagination Logic
      ✓ should calculate correct page values
      ✓ should handle invalid page numbers (1 ms)
      ✓ should limit maximum page size
      ✓ should calculate offset correctly (1 ms)
      ✓ should calculate total pages
      ✓ should determine hasNext correctly (1 ms)
      ✓ should determine hasPrev correctly
    Color Validation
      ✓ should validate hex color format (1 ms)
      ✓ should reject invalid color formats (1 ms)
    Recurrence Rule Logic
      ✓ should parse recurrence pattern
      ✓ should calculate interval days for patterns (1 ms)
      ✓ should parse COUNT option
      ✓ should parse UNTIL option (1 ms)
    Sort Field Mapping
      ✓ should map API field names to DB field names (8 ms)
      ✓ should default to start_date for invalid sort field
    Attendee Response Validation
      ✓ should validate attendee response values
      ✓ should reject invalid response values
    Permission Logic
      ✓ should allow owner to manage event
      ✓ should allow admin to manage any event
      ✓ should allow manager to manage any event (1 ms)
      ✓ should not allow non-owner employee to manage
    Export Format Logic
      ✓ should format CSV row correctly
      ✓ should escape CSV fields with quotes
      ✓ should format ICS date correctly
      ✓ should generate unique UID for ICS
    Time Calculation Logic
      ✓ should calculate event duration
      ✓ should handle weekday recurrence
      ✓ should calculate monthly recurrence
      ✓ should calculate yearly recurrence (1 ms)
    Filter Logic
      ✓ should map filter to event type
      ✓ should handle date range filtering
      ✓ should handle search term matching

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:48 +0000] "POST /api/v2/surveys HTTP/1.1" 201 601 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:48 +0000] "POST /api/v2/surveys HTTP/1.1" 403 188 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:48 +0000] "POST /api/v2/surveys HTTP/1.1" 400 315 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:49 +0000] "GET /api/v2/surveys HTTP/1.1" 200 658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:49 +0000] "GET /api/v2/surveys/1005 HTTP/1.1" 200 734 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:50 +0000] "GET /api/v2/surveys/99999 HTTP/1.1" 404 174 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:50 +0000] "PUT /api/v2/surveys/1007 HTTP/1.1" 200 582 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:50 +0000] "PUT /api/v2/surveys/1008 HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:51 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:51 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1712 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:51 +0000] "DELETE /api/v2/surveys/1009 HTTP/1.1" 200 129 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:51 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:51 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:51 +0000] "DELETE /api/v2/surveys/1010 HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:51 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:51 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:52 +0000] "GET /api/v2/surveys/1011 HTTP/1.1" 404 174 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:52 +0000] "GET /api/v2/surveys HTTP/1.1" 200 165 "-" "-"
PASS backend/src/routes/v2/__tests__/surveys-v2.test.ts (6.412 s)
  Surveys API v2
    Survey CRUD Operations
      ✓ should create a new survey (416 ms)
      ✓ should fail to create survey without admin role (357 ms)
      ✓ should validate required fields (377 ms)
    Survey List and Get Operations
      ✓ should list surveys (389 ms)
      ✓ should get survey by ID (382 ms)
      ✓ should return 404 for non-existent survey (368 ms)
    Survey Update and Delete Operations
      ✓ should update survey fields (404 ms)
      ✓ employee should not be able to update survey (358 ms)
      ✓ should delete survey without responses (370 ms)
      ✓ employee should not be able to delete survey (367 ms)
    Multi-Tenant Isolation
      ✓ should not access surveys from other tenants (448 ms)
      ✓ should not list surveys from other tenants (440 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1712 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1693 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "GET /api/v2/settings/system HTTP/1.1" 403 171 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "GET /api/v2/settings/system HTTP/1.1" 403 171 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "GET /api/v2/settings/system HTTP/1.1" 200 103 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "PUT /api/v2/settings/system/test_setting HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "GET /api/v2/settings/system/test_setting HTTP/1.1" 200 319 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "GET /api/v2/settings/tenant HTTP/1.1" 200 103 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "PUT /api/v2/settings/tenant/company_name HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "PUT /api/v2/settings/tenant/test_tenant_setting HTTP/1.1" 403 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "GET /api/v2/settings/user HTTP/1.1" 200 103 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "PUT /api/v2/settings/user/theme HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "PUT /api/v2/settings/user/notifications_enabled HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "PUT /api/v2/settings/user/items_per_page HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "PUT /api/v2/settings/user/preferences HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "GET /api/v2/settings/user HTTP/1.1" 200 724 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "GET /api/v2/settings/categories HTTP/1.1" 200 681 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:54 +0000] "PUT /api/v2/settings/bulk HTTP/1.1" 200 175 "-" "-"
PASS backend/src/routes/v2/settings/__tests__/settings-v2-fixed.test.ts
  Settings API v2 - Fixed
    System Settings
      ✓ should deny employees access to system settings (14 ms)
      ✓ should deny admin access to system settings (8 ms)
      ✓ should allow root to get system settings (9 ms)
      ✓ should create and get system setting as root (27 ms)
    Tenant Settings
      ✓ should get tenant settings (14 ms)
      ✓ should allow admin to create tenant setting (19 ms)
      ✓ should deny employee from creating tenant settings (12 ms)
    User Settings
      ✓ should get user settings (10 ms)
      ✓ should create user setting (15 ms)
      ✓ should handle different value types (48 ms)
    Common Endpoints
      ✓ should get categories (13 ms)
      ✓ should bulk update user settings (21 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:38:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1632 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 400 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:59 +0000] "GET /api/v2/auth/verify HTTP/1.1" 200 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:59 +0000] "GET /api/v2/auth/verify HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:59 +0000] "GET /api/v2/auth/verify HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:59 +0000] "POST /api/v2/auth/refresh HTTP/1.1" 200 343 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:59 +0000] "POST /api/v2/auth/refresh HTTP/1.1" 401 183 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:59 +0000] "GET /api/v2/auth/me HTTP/1.1" 200 1146 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:59 +0000] "POST /api/auth/login HTTP/1.1" 401 107 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:38:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
PASS backend/src/routes/v2/auth/__tests__/auth-v2.test.ts (5.018 s)
  Authentication API v2 Endpoints
    POST /api/v2/auth/login
      ✓ should return standardized success response with tokens (110 ms)
      ✓ should return standardized error for invalid credentials (84 ms)
      ✓ should validate required fields (6 ms)
    GET /api/v2/auth/verify
      ✓ should verify valid token (12 ms)
      ✓ should reject invalid token (5 ms)
      ✓ should reject missing token (11 ms)
    POST /api/v2/auth/refresh
      ✓ should refresh access token with valid refresh token (8 ms)
      ✓ should reject access token as refresh token (7 ms)
    GET /api/v2/auth/me
      ✓ should return current user with camelCase fields (9 ms)
    Deprecation Headers
      ✓ should include deprecation headers on v1 endpoints (19 ms)
      ✓ should NOT include deprecation headers on v2 endpoints (4 ms)

PASS backend/src/routes/v2/users/users.service.logic.test.ts
  UsersService Logic Tests
    ServiceError
      ✓ should create ServiceError with correct properties (2 ms)
      ✓ should use default status code 500
      ✓ should include details when provided (1 ms)
    Error Code Constants
      ✓ should have proper error codes
    Business Logic Validation
      ✓ should validate pagination parameters
      ✓ should validate limit parameters (1 ms)
      ✓ should calculate pagination metadata
      ✓ should validate sort parameters (1 ms)
      ✓ should validate sort order (1 ms)
    Field Mapping Logic
      ✓ should map database fields to API fields (1 ms)
      ✓ should map API fields to database fields (1 ms)
    Password Validation
      ✓ should validate password requirements
    Email Validation
      ✓ should validate email format (1 ms)
    Employee Number Generation
      ✓ should generate employee number in correct format (1 ms)

PASS backend/src/routes/v2/calendar/calendar.service.simple.test.ts
  Calendar ServiceError
    Error Creation
      ✓ should create ServiceError with correct properties (2 ms)
      ✓ should create ServiceError with details (1 ms)
      ✓ should handle different error codes (1 ms)
    Error Type Checking
      ✓ should identify ServiceError correctly
      ✓ should handle null and undefined
      ✓ should handle other types
    Calendar-Specific Errors
      ✓ should create date validation error (1 ms)
      ✓ should create permission error
      ✓ should create conflict error
      ✓ should create attendee error
    Error Serialization
      ✓ should convert to JSON properly
      ✓ should handle error without details (1 ms)
    Calendar Data Validation
      ✓ should validate ISO date format (1 ms)
      ✓ should detect invalid dates (1 ms)
      ✓ should validate organization levels (7 ms)
      ✓ should validate event status

PASS backend/src/routes/v2/users/users.service.integration.test.ts
  UsersService Integration Tests
    createUser
      ✓ should create user successfully (199 ms)
      ✓ should throw error for duplicate email (24 ms)
    getUserById
      ✓ should return user when found (1 ms)
      ✓ should throw error when user not found (4 ms)
    updateUser
      ✓ should update user fields (12 ms)
    listUsers
      ✓ should return paginated users (4 ms)
      ✓ should filter by search term (3 ms)
    deleteUser
      ✓ should prevent self-deletion (4 ms)
      ✓ should delete user successfully (12 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:39:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:39:03 +0000] "POST /api/v2/users/23781/archive HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:39:03 +0000] "POST /api/v2/users/23781/archive HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:39:03 +0000] "GET /api/v2/users/23782 HTTP/1.1" 200 1101 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:39:03 +0000] "OPTIONS /api/v2/users/23783/archive HTTP/1.1" 204 0 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2-debug-archive.test.ts
  DEBUG: Users v2 Archive API
    ✓ should check archive endpoint validation (96 ms)
    ✓ should check if user exists before archive (92 ms)
    ✓ should check if route is registered (89 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:39:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1659 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:39:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2-debug.test.ts
  DEBUG Calendar v2 Test User Creation
    ✓ should debug user creation and login (221 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:39:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1676 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:39:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1676 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:39:07 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2-simple.test.ts
  Calendar v2 API - Simple Debug Test
    ✓ should login admin user (109 ms)
    ✓ should access calendar endpoint with token (111 ms)

PASS backend/src/utils/__tests__/errorHandler.test.ts
  errorHandler
    getErrorMessage
      ✓ should extract message from Error object (2 ms)
      ✓ should extract message from object with message property
      ✓ should convert string error to message
      ✓ should handle number error
      ✓ should handle null error
      ✓ should handle undefined error
      ✓ should handle MySQL error format
      ✓ should handle empty object (1 ms)
      ✓ should handle array error
      ✓ should handle boolean error (1 ms)
      ✓ should handle Error with empty message
      ✓ should NOT trim whitespace from error messages (1 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:15:39:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1700 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:39:09 +0000] "GET /api/v2/settings/system HTTP/1.1" 403 171 "-" "-"
FAIL backend/src/routes/v2/settings/__tests__/settings-v2-minimal.test.ts
  Settings API v2 - Minimal Test
    ✕ should get system settings (19 ms)

  ● Settings API v2 - Minimal Test › should get system settings

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 403

      77 |
      78 |     console.log("Test response:", response.status);
    > 79 |     expect(response.status).toBe(200);
         |                             ^
      80 |   });
      81 | });
      82 |

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-v2-minimal.test.ts:79:29)

Created user: {
  id: 23787,
  username: '__AUTOTEST__settings_auth_admin_1753976351567_612',
  email: '__AUTOTEST__settings_auth_admin_1753976351567_612@test.com'
}
::ffff:127.0.0.1 - - [31/Jul/2025:15:39:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1706 "-" "-"
Login response status: 200
Login response body: {
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjM3ODcsImVtYWlsIjoiX19BVVRPVEVTVF9fc2V0dGluZ3NfYXV0aF9hZG1pbl8xNzUzOTc2MzUxNTY3XzYxMkB0ZXN0LmNvbSIsInJvbGUiOiJhZG1pbiIsInRlbmFudElkIjo0MTIzLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzUzOTc2MzUxLCJleHAiOjE3NTM5NzcyNTF9.lXITMvoGZwaUTINWDxCVoijscZabeLX9lWal6HTWb9g",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjM3ODcsImVtYWlsIjoiX19BVVRPVEVTVF9fc2V0dGluZ3NfYXV0aF9hZG1pbl8xNzUzOTc2MzUxNTY3XzYxMkB0ZXN0LmNvbSIsInJvbGUiOiJhZG1pbiIsInRlbmFudElkIjo0MTIzLCJ0eXBlIjoicmVmcmVzaCIsImlhdCI6MTc1Mzk3NjM1MSwiZXhwIjoxNzU0NTgxMTUxfQ.I_NhRCh57KQAwvF8iD2wQK7-2Y5NmXXKLqn9ciFnpPo",
    "user": {
      "id": 23787,
      "tenantId": 4123,
      "username": "__AUTOTEST__settings_auth_admin_1753976351567_612",
      "email": "__AUTOTEST__settings_auth_admin_1753976351567_612@test.com",
      "profilePictureUrl": null,
      "role": "admin",
      "firstName": "settings_auth_admin",
      "lastName": "User",
      "age": null,
      "employeeId": null,
      "employeeNumber": "393574",
      "iban": null,
      "company": null,
      "notes": null,
      "departmentId": null,
      "position": null,
      "phone": null,
      "landline": null,
      "mobile": null,
      "profilePicture": null,
      "address": null,
      "birthday": null,
      "dateOfBirth": null,
      "hireDate": null,
      "emergencyContact": null,
      "editableFields": null,
      "notificationPreferences": null,
      "isActive": true,
      "isArchived": false,
      "status": "active",
      "lastLogin": null,
      "passwordResetToken": null,
      "passwordResetExpires": null,
      "twoFactorSecret": null,
      "twoFactorEnabled": 0,
      "createdAt": "2025-07-31T15:39:11.000Z",
      "updatedAt": "2025-07-31T15:39:11.000Z",
      "archivedAt": null,
      "createdBy": null,
      "availabilityStatus": "available",
      "availabilityStart": null,
      "availabilityEnd": null,
      "availabilityNotes": null
    }
  },
  "meta": {
    "timestamp": "2025-07-31T15:39:11.688Z",
    "version": "2.0"
  }
}
Got token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjM3ODcsImVtYWlsIjoiX19BVVRPVEVTVF9fc2V0dGluZ3NfYXV0aF9hZG1pbl8xNzUzOTc2MzUxNTY3XzYxMkB0ZXN0LmNvbSIsInJvbGUiOiJhZG1pbiIsInRlbmFudElkIjo0MTIzLCJ0eXBlIjoiYWNjZXNzIiwiaWF0IjoxNzUzOTc2MzUxLCJleHAiOjE3NTM5NzcyNTF9.lXITMvoGZwaUTINWDxCVoijscZabeLX9lWal6HTWb9g
Making settings request...
::ffff:127.0.0.1 - - [31/Jul/2025:15:39:11 +0000] "GET /api/v2/settings/system HTTP/1.1" 403 171 "-" "-"
Settings response status: 403
Settings response body: {
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied"
  },
  "meta": {
    "timestamp": "2025-07-31T15:39:11.710Z",
    "requestId": "2778d2e6-f6ec-4e3d-ac7f-4f1c78086ca9"
  }
}
FAIL backend/src/routes/v2/settings/__tests__/settings-v2-auth-test.ts
  Settings API v2 - Auth Debug
    ✕ should login successfully (237 ms)

  ● Settings API v2 - Auth Debug › should login successfully

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 403

      75 |     log("Settings response body:", JSON.stringify(settingsRes.body, null, 2));
      76 |
    > 77 |     expect(settingsRes.status).toBe(200);
         |                                ^
      78 |   });
      79 | });
      80 |

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-v2-auth-test.ts:77:32)

::ffff:127.0.0.1 - - [31/Jul/2025:15:39:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
Testing route without validation...
::ffff:127.0.0.1 - - [31/Jul/2025:15:39:13 +0000] "GET /api/v2/settings/test HTTP/1.1" 404 65 "-" "-"
Response status: 404
Response body: { error: 'API endpoint not found', path: '/api/v2/settings/test' }
Testing route with validation array...
::ffff:127.0.0.1 - - [31/Jul/2025:15:39:13 +0000] "GET /api/v2/settings/test-with-validation HTTP/1.1" 404 81 "-" "-"
Response status: 404
Response body: {
  error: 'API endpoint not found',
  path: '/api/v2/settings/test-with-validation'
}
FAIL backend/src/routes/v2/settings/__tests__/test-route.test.ts
  Test Route Debug
    ✕ should work without validation (13 ms)
    ✕ should work with empty validation array (7 ms)

  ● Test Route Debug › should work without validation

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 404

      60 |     log("Response body:", response.body);
      61 |
    > 62 |     expect(response.status).toBe(200);
         |                             ^
      63 |     expect(response.body.success).toBe(true);
      64 |   });
      65 |

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/test-route.test.ts:62:29)

  ● Test Route Debug › should work with empty validation array

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 404

      75 |     log("Response body:", response.body);
      76 |
    > 77 |     expect(response.status).toBe(200);
         |                             ^
      78 |     expect(response.body.success).toBe(true);
      79 |   });
      80 | });

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/test-route.test.ts:77:29)

FAIL backend/src/routes/v2/settings/__tests__/settings-debug.test.ts
  Settings Service - Direct Test
    ✕ should call getSystemSettings directly
    ✓ should handle forbidden access (2 ms)

  ● Settings Service - Direct Test › should call getSystemSettings directly

    ServiceError: Access denied

      91 |   // Only root can access system settings
      92 |   if (userRole !== "root") {
    > 93 |     throw new ServiceError("FORBIDDEN", "Access denied", 403);
         |           ^
      94 |   }
      95 |
      96 |   let query = `SELECT * FROM system_settings WHERE 1=1`;

      at Module.getSystemSettings (backend/src/routes/v2/settings/settings.service.ts:93:11)
      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-debug.test.ts:29:46)

PASS backend/src/routes/v2/users/users.service.simple.test.ts
  UsersService - Simple Test
    ServiceError
      ✓ should create ServiceError with correct properties (2 ms)
      ✓ should use default status code 500 (1 ms)
      ✓ should include details when provided

::ffff:127.0.0.1 - - [31/Jul/2025:15:39:16 +0000] "GET /api/v2/settings/system HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:15:39:16 +0000] "GET /api/v2/settings/system HTTP/1.1" 401 186 "-" "-"
FAIL backend/src/routes/v2/settings/__tests__/settings-v2-basic.test.ts
  Settings API v2 - Basic Test
    ✕ should return 401 without authentication (27 ms)
    ✓ should return 401 with invalid token (12 ms)

  ● Settings API v2 - Basic Test › should return 401 without authentication

    expect(received).toBe(expected) // Object.is equality

    Expected: "NO_TOKEN"
    Received: "UNAUTHORIZED"

      15 |     expect(response.status).toBe(401);
      16 |     expect(response.body.success).toBe(false);
    > 17 |     expect(response.body.error.code).toBe("NO_TOKEN");
         |                                      ^
      18 |   });
      19 |
      20 |   it("should return 401 with invalid token", async () => {

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-v2-basic.test.ts:17:38)

::ffff:127.0.0.1 - - [31/Jul/2025:15:39:18 +0000] "GET /api/v2/users HTTP/1.1" 401 190 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2-simple.test.ts
  Users v2 API - Simple Test
    Basic Endpoint Test
      ✓ should return 401 without authentication (25 ms)

Summary of all failing tests
FAIL backend/src/routes/v2/settings/__tests__/settings-v2.test.ts (7.348 s)
  ● Settings API v2 › System Settings › should allow admin to get system settings

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 403

       99 |         .set("Authorization", `Bearer ${adminToken}`);
      100 |
    > 101 |       expect(response.status).toBe(200);
          |                               ^
      102 |       expect(response.body.success).toBe(true);
      103 |       expect(response.body.data.settings).toBeInstanceOf(Array);
      104 |     });

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-v2.test.ts:101:31)

  ● Settings API v2 › System Settings › should create and get system setting

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 403

      117 |         .set("Authorization", `Bearer ${adminToken}`);
      118 |
    > 119 |       expect(response.status).toBe(200);
          |                               ^
      120 |       expect(response.body.data.settings).toHaveLength(1);
      121 |       expect(response.body.data.settings[0]).toMatchObject({
      122 |         settingKey: "app.name",

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-v2.test.ts:119:31)

  ● Settings API v2 › System Settings › should filter system settings by category

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 403

      138 |         .set("Authorization", `Bearer ${adminToken}`);
      139 |
    > 140 |       expect(response.status).toBe(200);
          |                               ^
      141 |       expect(response.body.data.settings).toHaveLength(1);
      142 |       expect(response.body.data.settings[0].settingKey).toBe("app.theme");
      143 |     });

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-v2.test.ts:140:31)

FAIL backend/src/routes/v2/settings/__tests__/settings-v2-minimal.test.ts
  ● Settings API v2 - Minimal Test › should get system settings

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 403

      77 |
      78 |     console.log("Test response:", response.status);
    > 79 |     expect(response.status).toBe(200);
         |                             ^
      80 |   });
      81 | });
      82 |

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-v2-minimal.test.ts:79:29)

FAIL backend/src/routes/v2/settings/__tests__/settings-v2-auth-test.ts
  ● Settings API v2 - Auth Debug › should login successfully

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 403

      75 |     log("Settings response body:", JSON.stringify(settingsRes.body, null, 2));
      76 |
    > 77 |     expect(settingsRes.status).toBe(200);
         |                                ^
      78 |   });
      79 | });
      80 |

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-v2-auth-test.ts:77:32)

FAIL backend/src/routes/v2/settings/__tests__/test-route.test.ts
  ● Test Route Debug › should work without validation

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 404

      60 |     log("Response body:", response.body);
      61 |
    > 62 |     expect(response.status).toBe(200);
         |                             ^
      63 |     expect(response.body.success).toBe(true);
      64 |   });
      65 |

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/test-route.test.ts:62:29)

  ● Test Route Debug › should work with empty validation array

    expect(received).toBe(expected) // Object.is equality

    Expected: 200
    Received: 404

      75 |     log("Response body:", response.body);
      76 |
    > 77 |     expect(response.status).toBe(200);
         |                             ^
      78 |     expect(response.body.success).toBe(true);
      79 |   });
      80 | });

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/test-route.test.ts:77:29)

FAIL backend/src/routes/v2/settings/__tests__/settings-debug.test.ts
  ● Settings Service - Direct Test › should call getSystemSettings directly

    ServiceError: Access denied

      91 |   // Only root can access system settings
      92 |   if (userRole !== "root") {
    > 93 |     throw new ServiceError("FORBIDDEN", "Access denied", 403);
         |           ^
      94 |   }
      95 |
      96 |   let query = `SELECT * FROM system_settings WHERE 1=1`;

      at Module.getSystemSettings (backend/src/routes/v2/settings/settings.service.ts:93:11)
      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-debug.test.ts:29:46)

FAIL backend/src/routes/v2/settings/__tests__/settings-v2-basic.test.ts
  ● Settings API v2 - Basic Test › should return 401 without authentication

    expect(received).toBe(expected) // Object.is equality

    Expected: "NO_TOKEN"
    Received: "UNAUTHORIZED"

      15 |     expect(response.status).toBe(401);
      16 |     expect(response.body.success).toBe(false);
    > 17 |     expect(response.body.error.code).toBe("NO_TOKEN");
         |                                      ^
      18 |   });
      19 |
      20 |   it("should return 401 with invalid token", async () => {

      at Object.<anonymous> (backend/src/routes/v2/settings/__tests__/settings-v2-basic.test.ts:17:38)


Test Suites: 6 failed, 25 passed, 31 total
Tests:       9 failed, 484 passed, 493 total
Snapshots:   0 total
Time:        144.144 s
Ran all test suites.

🧹 Running global test cleanup...
✅ Global cleanup complete. Remaining test tenants: 0
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
 ELIFECYCLE  Test failed. See above for more details.
scs@SOSCSPC1M16:~/projects/Assixx/docker$ 
