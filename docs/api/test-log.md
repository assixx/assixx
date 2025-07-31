scs@SOSCSPC1M16:~/projects/Assixx/docker$docker exec assixx-backend pnpm test --verbose --forceExit

> assixx@1.0.0 test /app
> node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js --verbose --forceExit


🧹 Pre-test cleanup: Removing old test data...
✅ No leftover test data found
(node:923) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
Entries in DB before test: 1 [
  { id: 3831, title: 'Test Entry', org_level: 'company', org_id: null }
]
Employee user info: { id: 17764, role: 'employee', department_id: null, tenant_id: 3474 }
Employee team info: No team assignment
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:04 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 766 "-" "-"
Response data length: 1
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:05 +0000] "GET /api/v2/blackboard/entries?status=archived HTTP/1.1" 200 773 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:05 +0000] "GET /api/v2/blackboard/entries?page=1&limit=5 HTTP/1.1" 200 765 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:06 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:06 +0000] "GET /api/v2/blackboard/entries/3836 HTTP/1.1" 200 716 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
error: Error getting blackboard entry: Entry not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Entry not found\n    at BlackboardService.getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:100:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:111:19)","statusCode":404,"timestamp":"2025-07-31 08:58:07"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:07 +0000] "GET /api/v2/blackboard/entries/99999 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:07 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 752 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
error: Error creating blackboard entry: Organization ID is required for department level entries {"code":"VALIDATION_ERROR","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Organization ID is required for department level entries\n    at BlackboardService.createEntry (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:115:13)\n    at createEntry (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:147:43)\n    at /app/backend/src/utils/routeHandlers.ts:31:12\n    at Layer.handleRequest (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/layer.js:152:17)\n    at next (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/route.js:157:13)\n    at handleValidationErrors (/app/backend/src/middleware/validation.ts:43:3)\n    at Layer.handleRequest (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/layer.js:152:17)\n    at next (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/route.js:157:13)\n    at middleware (/app/node_modules/.pnpm/express-validator@7.2.1/node_modules/express-validator/lib/middlewares/check.js:16:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)","statusCode":400,"timestamp":"2025-07-31 08:58:10"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:10 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 400 221 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:11 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 400 445 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:11 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:12 +0000] "PUT /api/v2/blackboard/entries/3843 HTTP/1.1" 200 719 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1679 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:12 +0000] "PUT /api/v2/blackboard/entries/3844 HTTP/1.1" 200 713 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:13 +0000] "DELETE /api/v2/blackboard/entries/3845 HTTP/1.1" 200 128 "-" "-"
error: Error getting blackboard entry: Entry not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Entry not found\n    at BlackboardService.getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:100:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:111:19)","statusCode":404,"timestamp":"2025-07-31 08:58:13"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:13 +0000] "GET /api/v2/blackboard/entries/3845 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:13 +0000] "POST /api/v2/blackboard/entries/3846/archive HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1651 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:14 +0000] "POST /api/v2/blackboard/entries/3847/unarchive HTTP/1.1" 200 766 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:14 +0000] "POST /api/v2/blackboard/entries/3848/confirm HTTP/1.1" 200 130 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:15 +0000] "POST /api/v2/blackboard/entries/3849/confirm HTTP/1.1" 200 130 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:15 +0000] "GET /api/v2/blackboard/entries/3849/confirmations HTTP/1.1" 200 7250 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:15 +0000] "GET /api/v2/blackboard/dashboard HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:16 +0000] "GET /api/v2/blackboard/dashboard?limit=2 HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:16 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:16 +0000] "GET /api/v2/blackboard/tags HTTP/1.1" 200 382 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:17 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:17 +0000] "GET /api/v2/blackboard/entries/3855 HTTP/1.1" 200 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1649 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:17 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 766 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
error: Error getting blackboard entry: Entry not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Entry not found\n    at BlackboardService.getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:100:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:111:19)","statusCode":404,"timestamp":"2025-07-31 08:58:18"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:18 +0000] "GET /api/v2/blackboard/entries/3859 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:19 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 802 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:19 +0000] "POST /api/v2/blackboard/entries/3862/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:20 +0000] "POST /api/v2/blackboard/entries/3863/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:20 +0000] "GET /api/v2/blackboard/entries/3863/attachments HTTP/1.1" 200 418 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:20 +0000] "POST /api/v2/blackboard/entries/3864/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:20 +0000] "GET /api/v2/blackboard/entries/3864/attachments HTTP/1.1" 200 418 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:20 +0000] "DELETE /api/v2/blackboard/attachments/158 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:21 +0000] "POST /api/v2/blackboard/entries/3865/attachments HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:21 +0000] "GET /api/v2/blackboard/entries?priority=high HTTP/1.1" 200 796 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:22 +0000] "GET /api/v2/blackboard/entries?requiresConfirmation=true HTTP/1.1" 200 1399 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:22 +0000] "GET /api/v2/blackboard/entries?sortBy=priority&sortDir=DESC HTTP/1.1" 200 2636 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:23 +0000] "GET /api/v2/blackboard/entries?search=Urgent HTTP/1.1" 200 797 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:23 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 751 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:24 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 737 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:24 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 720 "-" "-"
PASS backend/src/routes/v2/blackboard/__tests__/blackboard-v2.test.ts (24.362 s)
  Blackboard API v2
    GET /api/v2/blackboard/entries
      ✓ should list all entries for authenticated user (536 ms)
      ✓ should filter entries by status (493 ms)
      ✓ should support pagination (470 ms)
      ✓ should return 401 without authentication (486 ms)
    GET /api/v2/blackboard/entries/:id
      ✓ should get a specific entry (484 ms)
      ✓ should return 404 for non-existent entry (481 ms)
    POST /api/v2/blackboard/entries
      ✓ should create a new entry as admin (519 ms)
      ✓ should require orgId for department level entries (3184 ms)
      ✓ should validate required fields (477 ms)
      ✓ should reject creation from non-admin users (470 ms)
    PUT /api/v2/blackboard/entries/:id
      ✓ should update an entry as admin (489 ms)
      ✓ should allow partial updates (485 ms)
    DELETE /api/v2/blackboard/entries/:id
      ✓ should delete an entry as admin (458 ms)
    POST /api/v2/blackboard/entries/:id/archive
      ✓ should archive an entry (474 ms)
    POST /api/v2/blackboard/entries/:id/unarchive
      ✓ should unarchive an entry (490 ms)
    POST /api/v2/blackboard/entries/:id/confirm
      ✓ should confirm reading an entry (511 ms)
      ✓ should track confirmation status (484 ms)
    GET /api/v2/blackboard/dashboard
      ✓ should get dashboard entries (485 ms)
      ✓ should limit dashboard entries (474 ms)
    Tags functionality
      ✓ should get all available tags (515 ms)
      ✓ should filter entries by tag (531 ms)
    Multi-tenant isolation
      ✓ should not see entries from other tenants (645 ms)
      ✓ should not access other tenant's entry directly (642 ms)
      ✓ should allow other tenant to see their own entries (674 ms)
    Attachments functionality
      ✓ should upload an attachment to an entry (475 ms)
      ✓ should get attachments for an entry (556 ms)
      ✓ should delete an attachment (500 ms)
      ✓ should require authentication for attachment operations (455 ms)
    Advanced filtering and sorting
      ✓ should filter by priority (480 ms)
      ✓ should filter by requiresConfirmation (465 ms)
      ✓ should sort entries (486 ms)
      ✓ should search entries by title and content (478 ms)
    Entry expiration
      ✓ should create entry with expiration date (480 ms)
    Department and Team level entries
      ✓ should create department level entry with orgId (482 ms)
      ✓ should create team level entry with orgId (474 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:58:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:26 +0000] "GET /api/v2/kvp/categories HTTP/1.1" 200 251 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:26 +0000] "GET /api/v2/kvp/categories HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:27 +0000] "POST /api/v2/kvp HTTP/1.1" 201 941 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:27 +0000] "POST /api/v2/kvp HTTP/1.1" 400 572 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:27 +0000] "GET /api/v2/kvp?page=1&limit=10 HTTP/1.1" 200 2320 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:28 +0000] "GET /api/v2/kvp?status=new HTTP/1.1" 200 882 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:28 +0000] "GET /api/v2/kvp HTTP/1.1" 200 1604 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:28 +0000] "GET /api/v2/kvp/2379 HTTP/1.1" 200 823 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:29 +0000] "GET /api/v2/kvp/99999 HTTP/1.1" 404 178 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:29 +0000] "PUT /api/v2/kvp/2381 HTTP/1.1" 200 840 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:29 +0000] "PUT /api/v2/kvp/2382 HTTP/1.1" 200 842 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:30 +0000] "PUT /api/v2/kvp/2384 HTTP/1.1" 404 178 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:30 +0000] "DELETE /api/v2/kvp/2385 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:31 +0000] "POST /api/v2/kvp/2386/comments HTTP/1.1" 201 227 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:31 +0000] "GET /api/v2/kvp/2387/comments HTTP/1.1" 200 493 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:31 +0000] "GET /api/v2/kvp/2388/comments HTTP/1.1" 200 292 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1690 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:32 +0000] "GET /api/v2/kvp/dashboard/stats HTTP/1.1" 200 211 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:32 +0000] "POST /api/v2/kvp/points/award HTTP/1.1" 201 264 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:32 +0000] "POST /api/v2/kvp/points/award HTTP/1.1" 403 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:33 +0000] "GET /api/v2/kvp/points/user/17875 HTTP/1.1" 200 146 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:33 +0000] "GET /api/v2/kvp/points/user/17876 HTTP/1.1" 403 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:34 +0000] "GET /api/v2/kvp/2399/attachments HTTP/1.1" 200 90 "-" "-"
PASS backend/src/routes/v2/__tests__/kvp-v2.test.ts (9.394 s)
  KVP API v2
    Categories
      ✓ should get all categories (382 ms)
      ✓ should require authentication (346 ms)
    Suggestions CRUD
      Create Suggestion
        ✓ should create a new suggestion (359 ms)
        ✓ should validate required fields (342 ms)
      List Suggestions
        ✓ should list suggestions with pagination (384 ms)
        ✓ should filter by status (409 ms)
        ✓ should respect employee visibility rules (367 ms)
      Get Suggestion by ID
        ✓ should get suggestion details (372 ms)
        ✓ should return 404 for non-existent suggestion (355 ms)
      Update Suggestion
        ✓ should update own suggestion (359 ms)
        ✓ should allow admin to update status (400 ms)
        ✓ should prevent employee from updating others suggestions (354 ms)
      Delete Suggestion
        ✓ should delete own suggestion (380 ms)
    Comments
      ✓ should add comment to suggestion (379 ms)
      ✓ should get comments for suggestion (368 ms)
      ✓ should hide internal comments from employees (367 ms)
    Dashboard Statistics
      ✓ should get dashboard statistics (367 ms)
    Points System
      ✓ should award points to user (admin only) (370 ms)
      ✓ should prevent employees from awarding points (336 ms)
      ✓ should get user points summary (390 ms)
      ✓ should allow users to see only their own points (351 ms)
    Attachments
      ✓ should get attachments for suggestion (370 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:58:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:35 +0000] "POST /api/v2/shifts HTTP/1.1" 201 711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:36 +0000] "POST /api/v2/shifts HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:36 +0000] "GET /api/v2/shifts?date=2025-07-31 HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:36 +0000] "GET /api/v2/shifts/663 HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:37 +0000] "PUT /api/v2/shifts/664 HTTP/1.1" 200 693 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:37 +0000] "DELETE /api/v2/shifts/665 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:37 +0000] "POST /api/v2/shifts/templates HTTP/1.1" 201 334 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:38 +0000] "GET /api/v2/shifts/templates HTTP/1.1" 200 327 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:38 +0000] "PUT /api/v2/shifts/templates/255 HTTP/1.1" 200 328 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:39 +0000] "DELETE /api/v2/shifts/templates/256 HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:39 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 201 267 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1679 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:39 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 403 204 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1707 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:40 +0000] "GET /api/v2/shifts/swap-requests HTTP/1.1" 200 686 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:40 +0000] "PUT /api/v2/shifts/swap-requests/156/status HTTP/1.1" 200 136 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:43 +0000] "GET /api/v2/shifts/overtime?startDate=2025-01-01&endDate=2025-01-31 HTTP/1.1" 200 460 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:43 +0000] "GET /api/v2/shifts/overtime HTTP/1.1" 400 434 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:44 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31&format=csv HTTP/1.1" 200 215 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:44 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31&format=excel HTTP/1.1" 501 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:45 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31 HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:45 +0000] "POST /api/v2/shifts HTTP/1.1" 400 263 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:45 +0000] "POST /api/v2/shifts HTTP/1.1" 400 258 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:46 +0000] "POST /api/v2/shifts HTTP/1.1" 400 372 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1707 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:46 +0000] "GET /api/v2/shifts/673 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1707 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:47 +0000] "GET /api/v2/shifts/templates HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:47 +0000] "POST /api/v2/shifts HTTP/1.1" 201 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:47 +0000] "PUT /api/v2/shifts/templates/258 HTTP/1.1" 200 327 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:48 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 201 234 "-" "-"
PASS backend/src/routes/v2/__tests__/shifts-v2.test.ts (14.195 s)
  Shifts API v2
    Shifts CRUD Operations
      ✓ should create a new shift (429 ms)
      ✓ should fail to create shift without admin role (356 ms)
      ✓ should list shifts with filtering (416 ms)
      ✓ should get shift by ID (362 ms)
      ✓ should update a shift (365 ms)
      ✓ should delete a shift (365 ms)
    Shift Templates
      ✓ should create a shift template (353 ms)
      ✓ should list shift templates (341 ms)
      ✓ should update a template (392 ms)
      ✓ should delete a template (384 ms)
    Shift Swap Requests
      ✓ should create a swap request (377 ms)
      ✓ should not allow swap request for other user's shift (376 ms)
      ✓ should list swap requests (388 ms)
      ✓ should update swap request status (377 ms)
    Overtime Reporting
      ✓ should get overtime report for user (3070 ms)
      ✓ should require date range for overtime report (334 ms)
    Shift Export
      ✓ should export shifts as CSV (362 ms)
      ✓ should return 501 for Excel export (338 ms)
      ✓ should require admin role for export (358 ms)
    Input Validation
      ✓ should validate time format (352 ms)
      ✓ should validate date format (327 ms)
      ✓ should validate required fields (345 ms)
    Multi-Tenant Isolation
      ✓ should not access shifts from other tenant (525 ms)
      ✓ should not see templates from other tenant (513 ms)
    AdminLog Integration
      ✓ should log shift creation (362 ms)
      ✓ should log template updates (364 ms)
      ✓ should log swap request actions (388 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:58:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1672 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1700 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1663 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1716 "-" "-"
info: Fetching all teams for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams HTTP/1.1" 200 585 "-" "-"
info: Fetching all teams for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams?departmentId=1664 HTTP/1.1" 200 585 "-" "-"
info: Fetching all teams for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams?search=Team%201 HTTP/1.1" 200 337 "-" "-"
info: Fetching all teams for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams?includeMembers=true HTTP/1.1" 200 617 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams HTTP/1.1" 401 190 "-" "-"
info: Fetching all teams for tenant 3483 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 0 teams {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams HTTP/1.1" 200 90 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 2 members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams/1205 HTTP/1.1" 200 782 "-" "-"
info: Fetching team with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
warn: Team with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.getTeamById (/app/backend/src/routes/v2/teams/teams.service.ts:112:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getTeamById (/app/backend/src/routes/v2/teams/teams.controller.ts:88:20)","statusCode":404,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.getTeamById (/app/backend/src/routes/v2/teams/teams.service.ts:117:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getTeamById (/app/backend/src/routes/v2/teams/teams.controller.ts:88:20)","statusCode":404,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams/1205 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 0 members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams/1205 HTTP/1.1" 200 348 "-" "-"
info: Fetching department with ID 1664 for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Department 1664 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching all teams for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Creating new team: New Team v2 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team created successfully with ID 1207 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching team with ID 1207 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1207 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1207 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 0 members for team 1207 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams HTTP/1.1" 201 360 "-" "-"
info: Fetching all teams for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 3 teams {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Team with this name already exists {"code":"CONFLICT","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team with this name already exists\n    at TeamsService.createTeam (/app/backend/src/routes/v2/teams/teams.service.ts:185:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at createTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:130:20)","statusCode":409,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams HTTP/1.1" 409 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams HTTP/1.1" 400 309 "-" "-"
info: Fetching department with ID 99999 for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
warn: Department with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Invalid department ID {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Invalid department ID\n    at TeamsService.createTeam (/app/backend/src/routes/v2/teams/teams.service.ts:166:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at createTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:130:20)","statusCode":400,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams HTTP/1.1" 400 181 "-" "-"
error: Invalid leader ID {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Invalid leader ID\n    at TeamsService.createTeam (/app/backend/src/routes/v2/teams/teams.service.ts:174:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at createTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:130:20)","statusCode":400,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams HTTP/1.1" 400 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams HTTP/1.1" 403 182 "-" "-"
info: Fetching all teams for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 3 teams {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Creating new team: Root Created Team {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team created successfully with ID 1208 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching team with ID 1208 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1208 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1208 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 0 members for team 1208 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams HTTP/1.1" 201 341 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching all teams for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 4 teams {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Updating team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 0 members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "PUT /api/v2/teams/1205 HTTP/1.1" 200 363 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Updating team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 0 members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "PUT /api/v2/teams/1205 HTTP/1.1" 200 345 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching all teams for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 4 teams {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Team with this name already exists {"code":"CONFLICT","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team with this name already exists\n    at TeamsService.updateTeam (/app/backend/src/routes/v2/teams/teams.service.ts:255:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at updateTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:173:20)","statusCode":409,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "PUT /api/v2/teams/1205 HTTP/1.1" 409 191 "-" "-"
info: Fetching team with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
warn: Team with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.updateTeam (/app/backend/src/routes/v2/teams/teams.service.ts:222:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at updateTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:173:20)","statusCode":404,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "PUT /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.updateTeam (/app/backend/src/routes/v2/teams/teams.service.ts:222:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at updateTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:173:20)","statusCode":404,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "PUT /api/v2/teams/1205 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "PUT /api/v2/teams/1205 HTTP/1.1" 403 182 "-" "-"
info: Fetching team with ID 1209 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1209 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1209 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 0 members for team 1209 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Deleting team 1209 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1209 deleted successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "DELETE /api/v2/teams/1209 HTTP/1.1" 200 127 "-" "-"
info: Fetching team with ID 1209 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
warn: Team with ID 1209 not found {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.getTeamById (/app/backend/src/routes/v2/teams/teams.service.ts:112:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getTeamById (/app/backend/src/routes/v2/teams/teams.controller.ts:88:20)","statusCode":404,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams/1209 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1210 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1210 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1210 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 1 members for team 1210 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Cannot delete team with members {"code":"BAD_REQUEST","details":{"memberCount":1},"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Cannot delete team with members\n    at TeamsService.deleteTeam (/app/backend/src/routes/v2/teams/teams.service.ts:310:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at deleteTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:212:22)","statusCode":400,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "DELETE /api/v2/teams/1210 HTTP/1.1" 400 219 "-" "-"
info: Fetching team with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
warn: Team with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Error in deleteTeam: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.deleteTeam (/app/backend/src/routes/v2/teams/teams.service.ts:304:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at deleteTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:212:22)","statusCode":404,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "DELETE /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1212 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1212 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Error in deleteTeam: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.deleteTeam (/app/backend/src/routes/v2/teams/teams.service.ts:304:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at deleteTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:212:22)","statusCode":404,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "DELETE /api/v2/teams/1212 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "DELETE /api/v2/teams/1213 HTTP/1.1" 403 182 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 2 members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams/1205/members HTTP/1.1" 200 524 "-" "-"
info: Fetching team with ID 1206 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1206 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1206 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 0 members for team 1206 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams/1206/members HTTP/1.1" 200 90 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 0 members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams/1205/members HTTP/1.1" 200 90 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Error in getTeamMembers: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.getTeamMembers (/app/backend/src/routes/v2/teams/teams.service.ts:341:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getTeamMembers (/app/backend/src/routes/v2/teams/teams.controller.ts:250:23)","statusCode":404,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams/1205/members HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Adding user 17937 to team 1205 for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: User 17937 added to team 1205 successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams/1205/members HTTP/1.1" 201 132 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 1 members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams/1205/members HTTP/1.1" 200 311 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Adding user 17937 to team 1205 for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
warn: User 17937 is already a member of team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Error adding team member: User is already a member of this team {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Error in addTeamMember: User is already a member of this team {"code":"CONFLICT","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: User is already a member of this team\n    at TeamsService.addTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:401:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at addTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:291:22)","statusCode":409,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams/1205/members HTTP/1.1" 409 194 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Error in addTeamMember: Invalid user ID {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Invalid user ID\n    at TeamsService.addTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:378:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at addTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:291:22)","statusCode":400,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams/1205/members HTTP/1.1" 400 175 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Error in addTeamMember: Invalid user ID {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Invalid user ID\n    at TeamsService.addTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:378:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at addTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:291:22)","statusCode":400,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams/1205/members HTTP/1.1" 400 175 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams/1205/members HTTP/1.1" 403 182 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Removing user 17937 from team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: User 17937 removed from team 1205 successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "DELETE /api/v2/teams/1205/members/17937 HTTP/1.1" 200 134 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 0 members for team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams/1205/members HTTP/1.1" 200 90 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Removing user 17938 from team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
warn: User 17938 is not a member of team 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Error in removeTeamMember: User is not a member of this team {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: User is not a member of this team\n    at TeamsService.removeTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:425:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at removeTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:335:22)","statusCode":400,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "DELETE /api/v2/teams/1205/members/17938 HTTP/1.1" 400 193 "-" "-"
info: Fetching team with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
warn: Team with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Error in removeTeamMember: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.removeTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:420:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at removeTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:335:22)","statusCode":404,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "DELETE /api/v2/teams/99999/members/17937 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1205 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1205 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
error: Error in removeTeamMember: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.removeTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:420:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at removeTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:335:22)","statusCode":404,"timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "DELETE /api/v2/teams/1205/members/17937 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "DELETE /api/v2/teams/1205/members/17937 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams HTTP/1.1" 400 258 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams HTTP/1.1" 400 271 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams?search=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa HTTP/1.1" 400 262 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "GET /api/v2/teams/not-a-number HTTP/1.1" 400 256 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams HTTP/1.1" 400 118 "-" "-"
info: Fetching all teams for tenant 3482 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 8 teams {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Creating new team: JSON Team {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team created successfully with ID 1214 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching team with ID 1214 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Team 1214 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Fetching members for team 1214 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
info: Retrieved 0 members for team 1214 {"service":"assixx-backend","timestamp":"2025-07-31 08:58:50"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:50 +0000] "POST /api/v2/teams HTTP/1.1" 201 315 "-" "-"
PASS backend/src/routes/v2/teams/__tests__/teams-v2.test.ts
  Teams v2 API Endpoints
    GET /api/v2/teams
      ✓ should list all teams for the tenant (17 ms)
      ✓ should filter teams by department (9 ms)
      ✓ should search teams by name (13 ms)
      ✓ should include member count when requested (18 ms)
      ✓ should require authentication (10 ms)
      ✓ should isolate teams by tenant (9 ms)
    GET /api/v2/teams/:id
      ✓ should get team by ID with members (18 ms)
      ✓ should return 404 for non-existent team (31 ms)
      ✓ should prevent access to other tenant's teams (10 ms)
      ✓ should allow employee access to view teams (9 ms)
    POST /api/v2/teams
      ✓ should create a new team (20 ms)
      ✓ should prevent duplicate team names (11 ms)
      ✓ should validate required fields (5 ms)
      ✓ should validate department ID (7 ms)
      ✓ should validate leader ID (7 ms)
      ✓ should require admin or root role (6 ms)
      ✓ should allow root role to create teams (12 ms)
    PUT /api/v2/teams/:id
      ✓ should update team details (16 ms)
      ✓ should allow clearing optional fields (13 ms)
      ✓ should prevent duplicate names on update (8 ms)
      ✓ should return 404 for non-existent team (7 ms)
      ✓ should prevent access to other tenant's teams (7 ms)
      ✓ should require admin or root role (5 ms)
    DELETE /api/v2/teams/:id
      ✓ should delete an empty team (22 ms)
      ✓ should prevent deletion of team with members (15 ms)
      ✓ should return 404 for non-existent team (10 ms)
      ✓ should prevent access to other tenant's teams (11 ms)
      ✓ should require admin or root role (9 ms)
    GET /api/v2/teams/:id/members
      ✓ should list team members (12 ms)
      ✓ should return empty array for team without members (11 ms)
      ✓ should allow employees to view team members (9 ms)
      ✓ should prevent access to other tenant's teams (7 ms)
    POST /api/v2/teams/:id/members
      ✓ should add a member to the team (19 ms)
      ✓ should prevent adding duplicate members (18 ms)
      ✓ should validate user ID (12 ms)
      ✓ should prevent adding users from other tenants (7 ms)
      ✓ should require admin or root role (5 ms)
    DELETE /api/v2/teams/:id/members/:userId
      ✓ should remove a member from the team (21 ms)
      ✓ should handle removing non-member gracefully (12 ms)
      ✓ should return 404 for non-existent team (15 ms)
      ✓ should prevent access to other tenant's teams (13 ms)
      ✓ should require admin or root role (12 ms)
    Input Validation
      ✓ should validate team name length (9 ms)
      ✓ should validate description length (5 ms)
      ✓ should validate search parameter (6 ms)
      ✓ should validate numeric IDs (5 ms)
    Content-Type validation
      ✓ should reject non-JSON content type for POST (3 ms)
      ✓ should accept application/json content type (12 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:58:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:52 +0000] "POST /api/v2/surveys HTTP/1.1" 201 600 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:52 +0000] "POST /api/v2/surveys HTTP/1.1" 403 188 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:53 +0000] "POST /api/v2/surveys HTTP/1.1" 400 315 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:53 +0000] "GET /api/v2/surveys HTTP/1.1" 200 657 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:53 +0000] "GET /api/v2/surveys/296 HTTP/1.1" 200 731 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:54 +0000] "GET /api/v2/surveys/99999 HTTP/1.1" 404 174 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:54 +0000] "PUT /api/v2/surveys/298 HTTP/1.1" 200 581 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:54 +0000] "PUT /api/v2/surveys/299 HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:55 +0000] "DELETE /api/v2/surveys/300 HTTP/1.1" 200 129 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:55 +0000] "DELETE /api/v2/surveys/301 HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:56 +0000] "GET /api/v2/surveys/302 HTTP/1.1" 404 174 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:56 +0000] "GET /api/v2/surveys HTTP/1.1" 200 165 "-" "-"
PASS backend/src/routes/v2/__tests__/surveys-v2.test.ts (5.746 s)
  Surveys API v2
    Survey CRUD Operations
      ✓ should create a new survey (394 ms)
      ✓ should fail to create survey without admin role (331 ms)
      ✓ should validate required fields (346 ms)
    Survey List and Get Operations
      ✓ should list surveys (361 ms)
      ✓ should get survey by ID (369 ms)
      ✓ should return 404 for non-existent survey (367 ms)
    Survey Update and Delete Operations
      ✓ should update survey fields (369 ms)
      ✓ employee should not be able to update survey (352 ms)
      ✓ should delete survey without responses (346 ms)
      ✓ employee should not be able to delete survey (368 ms)
    Multi-Tenant Isolation
      ✓ should not access surveys from other tenants (446 ms)
      ✓ should not list surveys from other tenants (441 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:58:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1669 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1698 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/events HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 1310 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/events?page=1&limit=1 HTTP/1.1" 200 754 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/events?status=cancelled HTTP/1.1" 200 750 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/events?search=Team HTTP/1.1" 200 756 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/events HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "POST /api/v2/calendar/events HTTP/1.1" 201 981 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "POST /api/v2/calendar/events HTTP/1.1" 201 1511 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 641 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 260 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 278 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/events/3337 HTTP/1.1" 200 1184 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/events/99999 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/events/3340 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "PUT /api/v2/calendar/events/3341 HTTP/1.1" 200 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "PUT /api/v2/calendar/events/3342 HTTP/1.1" 200 671 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "PUT /api/v2/calendar/events/3343 HTTP/1.1" 403 153 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "PUT /api/v2/calendar/events/3344 HTTP/1.1" 400 260 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "DELETE /api/v2/calendar/events/3345 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/events/3345 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "DELETE /api/v2/calendar/events/3346 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "DELETE /api/v2/calendar/events/3347 HTTP/1.1" 403 153 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "PUT /api/v2/calendar/events/3348/attendees/response HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/events/3348 HTTP/1.1" 200 1212 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "PUT /api/v2/calendar/events/3349/attendees/response HTTP/1.1" 400 254 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1663 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "PUT /api/v2/calendar/events/3350/attendees/response HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/export?format=ics HTTP/1.1" 200 493 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/export?format=csv HTTP/1.1" 200 261 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/export?format=invalid HTTP/1.1" 400 263 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:58 +0000] "GET /api/v2/calendar/export HTTP/1.1" 400 308 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:59 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:59 +0000] "GET /api/v2/calendar/events/3360 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:59 +0000] "PUT /api/v2/calendar/events/3361 HTTP/1.1" 404 122 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:58:59 +0000] "DELETE /api/v2/calendar/events/3362 HTTP/1.1" 404 122 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2.test.ts
  Calendar v2 API Endpoints
    Response Format Validation
      ✓ should return standardized success response format (18 ms)
      ✓ should return standardized error response format (5 ms)
    GET /api/v2/calendar/events
      ✓ should list all events for admin (31 ms)
      ✓ should support pagination (20 ms)
      ✓ should support filtering by status (24 ms)
      ✓ should support search (21 ms)
      ✓ should require authentication (15 ms)
    POST /api/v2/calendar/events
      ✓ should create a new event (24 ms)
      ✓ should create event with attendees (35 ms)
      ✓ should validate required fields (13 ms)
      ✓ should validate date order (7 ms)
      ✓ should require orgId for department/team events (6 ms)
    GET /api/v2/calendar/events/:id
      ✓ should get event by ID (17 ms)
      ✓ should return 404 for non-existent event (21 ms)
      ✓ should respect access control for employees (27 ms)
    PUT /api/v2/calendar/events/:id
      ✓ should update event (owner) (32 ms)
      ✓ should update event (admin) (26 ms)
      ✓ should not allow non-owner employee to update (16 ms)
      ✓ should validate date updates (21 ms)
    DELETE /api/v2/calendar/events/:id
      ✓ should delete event (owner) (26 ms)
      ✓ should delete event (admin) (18 ms)
      ✓ should not allow non-owner employee to delete (14 ms)
    PUT /api/v2/calendar/events/:id/attendees/response
      ✓ should update attendee response (33 ms)
      ✓ should validate response values (19 ms)
      ✓ should add user as attendee if not already (193 ms)
    GET /api/v2/calendar/export
      ✓ should export events as ICS (24 ms)
      ✓ should export events as CSV (17 ms)
      ✓ should validate format parameter (19 ms)
      ✓ should require format parameter (16 ms)
    Multi-Tenant Isolation
      ✓ should not show events from other tenants (98 ms)
      ✓ should not access specific event from other tenant (95 ms)
      ✓ should not update event from other tenant (106 ms)
      ✓ should not delete event from other tenant (103 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1652 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:00 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1106 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:00 +0000] "GET /api/v2/users/me HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:00 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1106 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:00 +0000] "GET /api/v2/users?page=1&limit=10 HTTP/1.1" 200 1294 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:00 +0000] "GET /api/v2/users?role=admin HTTP/1.1" 200 723 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:00 +0000] "GET /api/v2/users?search=Admin HTTP/1.1" 200 723 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:00 +0000] "GET /api/v2/users HTTP/1.1" 403 182 "-" "-"
info: User created successfully with ID: 17976 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "POST /api/v2/users HTTP/1.1" 201 1152 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "POST /api/v2/users HTTP/1.1" 400 463 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "POST /api/v2/users HTTP/1.1" 409 177 "-" "-"
info: Updating field first_name to value: Updated {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: Updating field last_name to value: Name {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: Updating field position to value: Senior Developer {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: Special handling for is_active field - received value: false, type: boolean {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: is_active will be set to: 0 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: Executing update query: UPDATE users SET `first_name` = ?, `last_name` = ?, `position` = ?, `is_active` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: With values: ["Updated","Name","Senior Developer",0,17977,3489] {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "PUT /api/v2/users/17977 HTTP/1.1" 200 1131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "PUT /api/v2/users/17978 HTTP/1.1" 200 1115 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1720 "-" "-"
info: Archiving user 17979 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: Special handling for is_archived field - received value: true, type: boolean {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: is_archived will be set to: 1 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: Executing update query: UPDATE users SET `is_archived` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: With values: [1,17979,3489] {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "POST /api/v2/users/17979/archive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "GET /api/v2/users/17979 HTTP/1.1" 200 1116 "-" "-"
info: Archiving user 17980 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: Special handling for is_archived field - received value: true, type: boolean {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: is_archived will be set to: 1 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: Executing update query: UPDATE users SET `is_archived` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: With values: [1,17980,3489] {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "POST /api/v2/users/17980/archive HTTP/1.1" 200 92 "-" "-"
info: Unarchiving user 17980 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: Special handling for is_archived field - received value: false, type: boolean {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: is_archived will be set to: 0 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: Executing update query: UPDATE users SET `is_archived` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
info: With values: [0,17980,3489] {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "POST /api/v2/users/17980/unarchive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "GET /api/v2/users/17980 HTTP/1.1" 200 1117 "-" "-"
info: Password changed successfully for user 17975 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:01"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:01 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:02 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:02 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 400 253 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:02 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1175 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:02 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:02 +0000] "GET /api/v2/users/me/profile-picture HTTP/1.1" 200 15 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:02 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:02 +0000] "DELETE /api/v2/users/me/profile-picture HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:02 +0000] "GET /api/v2/users/me/profile-picture HTTP/1.1" 404 183 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:02 +0000] "PUT /api/v2/users/17981/availability HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:02 +0000] "PUT /api/v2/users/17982/availability HTTP/1.1" 400 261 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1670 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:02 +0000] "GET /api/v2/users/17974 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:02 +0000] "GET /api/v2/users HTTP/1.1" 200 720 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2.test.ts
  Users v2 API Endpoints
    Response Format Validation
      ✓ should return standardized success response format (10 ms)
      ✓ should return standardized error response format (4 ms)
    Field Mapping (camelCase)
      ✓ should return user data with camelCase fields (6 ms)
    GET /api/v2/users
      ✓ should list users with pagination (admin only) (11 ms)
      ✓ should filter users by role (8 ms)
      ✓ should search users by name or email (7 ms)
      ✓ should deny access to non-admin users (6 ms)
    POST /api/v2/users
      ✓ should create a new user with camelCase input (187 ms)
      ✓ should validate required fields (7 ms)
      ✓ should prevent duplicate emails (8 ms)
    PUT /api/v2/users/:id
      ✓ should update user with camelCase fields (96 ms)
      ✓ should not allow password updates via this endpoint (169 ms)
    POST /api/v2/users/:id/archive & /unarchive
      ✓ should archive a user (117 ms)
      ✓ should unarchive a user (126 ms)
    PUT /api/v2/users/me/password
      ✓ should change password with correct current password (306 ms)
      ✓ should reject incorrect current password (99 ms)
      ✓ should validate password confirmation (7 ms)
    Profile Picture Endpoints
      ✓ should upload profile picture (25 ms)
      ✓ should download profile picture (21 ms)
      ✓ should delete profile picture (31 ms)
    PUT /api/v2/users/:id/availability
      ✓ should update user availability (91 ms)
      ✓ should validate availability status enum (86 ms)
    Multi-Tenant Isolation
      ✓ should not allow cross-tenant user access (6 ms)
      ✓ should not list users from other tenants (6 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:03 +0000] "POST /api/v2/users/17985/archive HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:03 +0000] "POST /api/v2/users/17985/archive HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:03 +0000] "GET /api/v2/users/17986 HTTP/1.1" 200 1101 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:04 +0000] "OPTIONS /api/v2/users/17987/archive HTTP/1.1" 204 0 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2-debug-archive.test.ts
  DEBUG: Users v2 Archive API
    ✓ should check archive endpoint validation (95 ms)
    ✓ should check if user exists before archive (105 ms)
    ✓ should check if route is registered (86 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1652 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
info: Fetching all departments for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:05"}
info: Retrieved 2 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 08:59:05"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:05 +0000] "GET /api/v2/departments HTTP/1.1" 200 672 "-" "-"
info: Fetching all departments for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:05"}
info: Retrieved 2 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 08:59:05"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:05 +0000] "GET /api/v2/departments?includeExtended=false HTTP/1.1" 200 522 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:05 +0000] "GET /api/v2/departments HTTP/1.1" 401 190 "-" "-"
info: Fetching all departments for tenant 3493 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Retrieved 0 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "GET /api/v2/departments HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "GET /api/v2/departments/stats HTTP/1.1" 200 125 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "GET /api/v2/departments/stats HTTP/1.1" 200 125 "-" "-"
info: Fetching all departments for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Retrieved 2 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "GET /api/v2/departments/1667 HTTP/1.1" 200 406 "-" "-"
info: Fetching all departments for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Retrieved 2 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
error: Error in getDepartmentById: Department not found {"code":404,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Department not found\n    at DepartmentService.getDepartmentById (/app/backend/src/routes/v2/departments/departments.service.ts:109:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.getDepartmentById (/app/backend/src/routes/v2/departments/departments.controller.ts:72:26)\n    at /app/backend/src/routes/v2/departments/index.ts:120:5","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "GET /api/v2/departments/99999 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "GET /api/v2/departments/invalid HTTP/1.1" 400 178 "-" "-"
info: Fetching all departments for tenant 3493 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Retrieved 0 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
error: Error in getDepartmentById: Department not found {"code":404,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Department not found\n    at DepartmentService.getDepartmentById (/app/backend/src/routes/v2/departments/departments.service.ts:109:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.getDepartmentById (/app/backend/src/routes/v2/departments/departments.controller.ts:72:26)\n    at /app/backend/src/routes/v2/departments/index.ts:120:5","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "GET /api/v2/departments/1667 HTTP/1.1" 404 177 "-" "-"
info: Creating new department: Marketing {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Department created successfully with ID 1670 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Fetching all departments for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Retrieved 3 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "POST /api/v2/departments HTTP/1.1" 201 422 "-" "-"
info: Fetching department with ID 1667 for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Department 1667 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Creating new department: Frontend Team {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Department created successfully with ID 1671 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Fetching all departments for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Retrieved 3 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "POST /api/v2/departments HTTP/1.1" 201 359 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "POST /api/v2/departments HTTP/1.1" 403 201 "-" "-"
error: Error in createDepartment: Department name is required {"code":400,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Department name is required\n    at DepartmentService.createDepartment (/app/backend/src/routes/v2/departments/departments.service.ts:145:15)\n    at DepartmentController.createDepartment (/app/backend/src/routes/v2/departments/departments.controller.ts:136:50)\n    at /app/backend/src/routes/v2/departments/index.ts:159:32\n    at /app/backend/src/utils/routeHandlers.ts:31:12\n    at Layer.handleRequest (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/layer.js:152:17)\n    at next (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/route.js:157:13)\n    at middleware (/app/node_modules/.pnpm/express-validator@7.2.1/node_modules/express-validator/lib/middlewares/check.js:16:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "POST /api/v2/departments HTTP/1.1" 400 192 "-" "-"
info: Creating new department: Engineering {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
error: Error creating department: Duplicate entry '3492-Engineering' for key 'departments.unique_dept_name_per_tenant' {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
error: Error in createDepartment: Department name already exists {"code":400,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Department name already exists\n    at DepartmentService.createDepartment (/app/backend/src/routes/v2/departments/departments.service.ts:176:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.createDepartment (/app/backend/src/routes/v2/departments/departments.controller.ts:136:26)\n    at /app/backend/src/routes/v2/departments/index.ts:159:5","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "POST /api/v2/departments HTTP/1.1" 400 187 "-" "-"
info: Fetching department with ID 1668 for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Department 1668 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Updating department 1668 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Department 1668 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Fetching all departments for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Retrieved 2 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "PUT /api/v2/departments/1668 HTTP/1.1" 200 426 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "PUT /api/v2/departments/1667 HTTP/1.1" 403 201 "-" "-"
info: Fetching department with ID 1667 for tenant 3493 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
warn: Department with ID 1667 not found {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
error: Error in updateDepartment: Department not found {"code":404,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Department not found\n    at DepartmentService.updateDepartment (/app/backend/src/routes/v2/departments/departments.service.ts:196:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.updateDepartment (/app/backend/src/routes/v2/departments/departments.controller.ts:222:26)\n    at /app/backend/src/routes/v2/departments/index.ts:207:5","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "PUT /api/v2/departments/1667 HTTP/1.1" 404 177 "-" "-"
info: Fetching department with ID 1667 for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Department 1667 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
error: Error in updateDepartment: Manager not found {"code":400,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Manager not found\n    at DepartmentService.updateDepartment (/app/backend/src/routes/v2/departments/departments.service.ts:218:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.updateDepartment (/app/backend/src/routes/v2/departments/departments.controller.ts:222:26)\n    at /app/backend/src/routes/v2/departments/index.ts:207:5","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "PUT /api/v2/departments/1667 HTTP/1.1" 400 174 "-" "-"
info: Creating new department: ToDelete {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Department created successfully with ID 1673 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Fetching all departments for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Retrieved 3 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "POST /api/v2/departments HTTP/1.1" 201 354 "-" "-"
info: Fetching department with ID 1673 for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Department 1673 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Fetching users for department 1673 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Retrieved 0 users for department 1673 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Deleting department 1673 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Department 1673 deleted successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "DELETE /api/v2/departments/1673 HTTP/1.1" 200 133 "-" "-"
info: Fetching department with ID 1667 for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Department 1667 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Fetching users for department 1667 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Retrieved 1 users for department 1667 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
error: Error in deleteDepartment: Cannot delete department with assigned users {"code":400,"details":{"userCount":1},"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Cannot delete department with assigned users\n    at DepartmentService.deleteDepartment (/app/backend/src/routes/v2/departments/departments.service.ts:267:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.deleteDepartment (/app/backend/src/routes/v2/departments/departments.controller.ts:294:7)\n    at /app/backend/src/routes/v2/departments/index.ts:249:5","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "DELETE /api/v2/departments/1667 HTTP/1.1" 400 227 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "DELETE /api/v2/departments/1668 HTTP/1.1" 403 201 "-" "-"
info: Fetching department with ID 1667 for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Department 1667 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Fetching users for department 1667 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Retrieved 2 users for department 1667 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "GET /api/v2/departments/1667/members HTTP/1.1" 200 589 "-" "-"
info: Fetching department with ID 1668 for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Department 1668 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Fetching users for department 1668 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Retrieved 0 users for department 1668 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "GET /api/v2/departments/1668/members HTTP/1.1" 200 90 "-" "-"
info: Fetching department with ID 1667 for tenant 3493 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
warn: Department with ID 1667 not found {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
error: Error in getDepartmentMembers: Department not found {"code":404,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Department not found\n    at DepartmentService.getDepartmentMembers (/app/backend/src/routes/v2/departments/departments.service.ts:297:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.getDepartmentMembers (/app/backend/src/routes/v2/departments/departments.controller.ts:350:23)\n    at /app/backend/src/routes/v2/departments/index.ts:289:5","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "GET /api/v2/departments/1667/members HTTP/1.1" 404 177 "-" "-"
info: Fetching all departments for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
info: Retrieved 2 departments with extended info {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "GET /api/v2/departments HTTP/1.1" 200 747 "-" "-"
info: Fetching department with ID 1675 for tenant 3492 {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
warn: Department with ID 1675 not found {"service":"assixx-backend","timestamp":"2025-07-31 08:59:06"}
error: Error in createDepartment: Parent department not found {"code":400,"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Parent department not found\n    at DepartmentService.createDepartment (/app/backend/src/routes/v2/departments/departments.service.ts:152:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at DepartmentController.createDepartment (/app/backend/src/routes/v2/departments/departments.controller.ts:136:26)\n    at /app/backend/src/routes/v2/departments/index.ts:159:5","timestamp":"2025-07-31 08:59:06"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:06 +0000] "POST /api/v2/departments HTTP/1.1" 400 184 "-" "-"
PASS backend/src/routes/v2/departments/__tests__/departments-v2.test.ts
  Departments v2 API Endpoints
    GET /api/v2/departments
      ✓ should return all departments for authenticated user (17 ms)
      ✓ should return departments without extended fields when includeExtended=false (9 ms)
      ✓ should require authentication (4 ms)
      ✓ should not return departments from other tenants (9 ms)
    GET /api/v2/departments/stats
      ✓ should return department statistics (15 ms)
      ✓ should return stats only for user's tenant (14 ms)
    GET /api/v2/departments/:id
      ✓ should return a specific department (14 ms)
      ✓ should return 404 for non-existent department (19 ms)
      ✓ should return 400 for invalid department ID (8 ms)
      ✓ should not return department from other tenant (9 ms)
    POST /api/v2/departments
      ✓ should create a new department as admin (16 ms)
      ✓ should create a department with parent (19 ms)
      ✓ should require admin or root role (9 ms)
      ✓ should validate required fields (8 ms)
      ✓ should not allow duplicate department names (10 ms)
    PUT /api/v2/departments/:id
      ✓ should update a department (16 ms)
      ✓ should require admin or root role for update (6 ms)
      ✓ should not update department from other tenant (7 ms)
      ✓ should validate manager exists in same tenant (8 ms)
    DELETE /api/v2/departments/:id
      ✓ should delete a department without users (28 ms)
      ✓ should not delete department with assigned users (16 ms)
      ✓ should require admin or root role for deletion (5 ms)
    GET /api/v2/departments/:id/members
      ✓ should return department members (17 ms)
      ✓ should return empty array for department without members (11 ms)
      ✓ should not return members from other tenant's department (7 ms)
    Multi-tenant isolation
      ✓ should completely isolate department data between tenants (11 ms)
      ✓ should not allow cross-tenant parent department assignment (15 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1723 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 635 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:07 +0000] "POST /api/v2/documents HTTP/1.1" 500 35 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:07 +0000] "POST /api/v2/documents HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 201 666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 201 626 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 201 636 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 201 641 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents HTTP/1.1" 200 4128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents?category=personal HTTP/1.1" 200 801 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents?recipientType=team HTTP/1.1" 200 1490 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents HTTP/1.1" 200 4638 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents?page=1&limit=2 HTTP/1.1" 200 1460 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents?search=team HTTP/1.1" 200 1490 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 201 673 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents/1051 HTTP/1.1" 200 673 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents/99999 HTTP/1.1" 404 176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 201 631 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents/1052 HTTP/1.1" 403 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 201 656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "PUT /api/v2/documents/1053 HTTP/1.1" 200 667 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "PUT /api/v2/documents/1053 HTTP/1.1" 200 636 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "PUT /api/v2/documents/1053 HTTP/1.1" 403 207 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 201 638 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "DELETE /api/v2/documents/1054 HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents/1054 HTTP/1.1" 404 176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 201 638 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "DELETE /api/v2/documents/1055 HTTP/1.1" 403 198 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 201 643 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents/1056/archive HTTP/1.1" 200 132 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents?isArchived=true HTTP/1.1" 200 820 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents/1056/unarchive HTTP/1.1" 200 134 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 201 647 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents/1057/download HTTP/1.1" 200 11 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents/1057/preview HTTP/1.1" 200 11 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents/stats HTTP/1.1" 200 200 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "GET /api/v2/documents/stats HTTP/1.1" 200 199 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 400 424 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 400 244 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:08 +0000] "POST /api/v2/documents HTTP/1.1" 400 203 "-" "-"
PASS backend/src/routes/v2/documents/__tests__/documents-v2.test.ts
  Documents API v2
    POST /api/v2/documents
      ✓ should upload a PDF document (38 ms)
      ✓ should reject non-PDF files (13 ms)
      ✓ should require authentication (3 ms)
      ✓ should upload document for team (23 ms)
      ✓ should upload salary document with year/month (21 ms)
    GET /api/v2/documents
      ✓ should list all documents for admin (17 ms)
      ✓ should filter documents by category (10 ms)
      ✓ should filter documents by recipient type (12 ms)
      ✓ should show only accessible documents for regular user (14 ms)
      ✓ should support pagination (11 ms)
      ✓ should support search (14 ms)
    GET /api/v2/documents/:id
      ✓ should get document by ID (13 ms)
      ✓ should return 404 for non-existent document (7 ms)
      ✓ should deny access to unauthorized user (120 ms)
    PUT /api/v2/documents/:id
      ✓ should update document metadata (19 ms)
      ✓ should allow clearing optional fields (18 ms)
      ✓ should download document (9 ms)
      ✓ should preview document inline (12 ms)
    GET /api/v2/documents/stats
      ✓ should get document statistics (11 ms)
      ✓ should not show storage for regular users (6 ms)
    Validation
      ✓ should validate required fields (6 ms)
      ✓ should validate category values (6 ms)
      ✓ should validate recipient requirements (5 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1655 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
Created conversation 1 with ID: 293
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "GET /api/v2/chat/users HTTP/1.1" 200 664 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "GET /api/v2/chat/users?search=chat_employee_test HTTP/1.1" 200 385 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "GET /api/v2/chat/users HTTP/1.1" 401 190 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3495,
  creatorId: 17995,
  data: {
    participantIds: [ 17997 ],
    name: 'New Test 1:1 Chat',
    isGroup: undefined
  }
}
[Chat Service] Creating new conversation with isGroup: false
[Chat Service] Created conversation with ID: 295
[Chat Service] getConversations called with: { tenantId: 3495, userId: 17995, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3495
        AND cp.user_id = 17995
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 676 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3495,
  creatorId: 17995,
  data: {
    participantIds: [ 17996, 17997 ],
    name: 'Test Group Chat',
    isGroup: undefined
  }
}
[Chat Service] Creating new conversation with isGroup: true
[Chat Service] Created conversation with ID: 296
[Chat Service] getConversations called with: { tenantId: 3495, userId: 17995, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3495
        AND cp.user_id = 17995
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 869 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3495,
  creatorId: 17995,
  data: {
    participantIds: [ 17996 ],
    name: 'Another attempt',
    isGroup: undefined
  }
}
[Chat Service] getConversations called with: { tenantId: 3495, userId: 17995, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3495
        AND cp.user_id = 17995
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 400 270 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3495,
  userId: 17995,
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
        WHERE c.tenant_id = 3495
        AND cp.user_id = 17995
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "GET /api/v2/chat/conversations HTTP/1.1" 200 2889 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3495,
  userId: 17995,
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
        WHERE c.tenant_id = 3495
        AND cp.user_id = 17995
        ORDER BY c.created_at DESC
        LIMIT 5 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "GET /api/v2/chat/conversations?page=1&limit=5 HTTP/1.1" 200 2888 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3495,
  userId: 17995,
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
        WHERE c.tenant_id = 3495
        AND cp.user_id = 17995
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "GET /api/v2/chat/conversations?search=Test%20Group HTTP/1.1" 200 2889 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations/293/messages HTTP/1.1" 201 421 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations/293/messages HTTP/1.1" 400 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations/297/messages HTTP/1.1" 403 170 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations/293/messages HTTP/1.1" 201 414 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations/293/messages HTTP/1.1" 201 420 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "GET /api/v2/chat/conversations/293/messages HTTP/1.1" 200 1486 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations/293/messages HTTP/1.1" 201 414 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations/293/messages HTTP/1.1" 201 420 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "GET /api/v2/chat/conversations/293/messages?page=1&limit=1 HTTP/1.1" 200 524 "-" "-"
Test conversationId: 293
Test authToken2: exists
[Chat Controller] markAsRead called
[Chat Controller] markAsRead - conversationId: 293 userId: 17996
[Chat Service] markConversationAsRead: { conversationId: 293, userId: 17996 }
[Chat Service] User is participant, getting unread messages
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations/293/read HTTP/1.1" 200 105 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations/293/messages HTTP/1.1" 201 419 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "GET /api/v2/chat/unread-count HTTP/1.1" 200 250 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3495,
  creatorId: 17995,
  data: {
    participantIds: [ 17997 ],
    name: 'To be deleted',
    isGroup: undefined
  }
}
[Chat Service] getConversations called with: { tenantId: 3495, userId: 17995, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3495
        AND cp.user_id = 17995
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 676 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "DELETE /api/v2/chat/conversations/295 HTTP/1.1" 200 135 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3495,
  userId: 17995,
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
        WHERE c.tenant_id = 3495
        AND cp.user_id = 17995
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "GET /api/v2/chat/conversations HTTP/1.1" 200 2892 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "GET /api/v2/chat/conversations/293 HTTP/1.1" 200 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "GET /api/v2/chat/conversations/99999 HTTP/1.1" 404 180 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "PUT /api/v2/chat/conversations/293 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "PUT /api/v2/chat/messages/1 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "DELETE /api/v2/chat/messages/1 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:10 +0000] "GET /api/v2/chat/search?q=test HTTP/1.1" 501 191 "-" "-"
PASS backend/src/routes/v2/chat/__tests__/chat-v2.test.ts
  Chat API v2
    GET /api/v2/chat/users
      ✓ should get available chat users (19 ms)
      ✓ should filter users by search term (9 ms)
      ✓ should return 401 without auth (3 ms)
    POST /api/v2/chat/conversations
      ✓ should create a new conversation (27 ms)
      ✓ should create a group conversation (26 ms)
      ✓ should return existing conversation for 1:1 chats (10 ms)
      ✓ should validate participant IDs (6 ms)
    GET /api/v2/chat/conversations
      ✓ should get user conversations (11 ms)
      ✓ should support pagination (9 ms)
      ✓ should filter by search (10 ms)
    POST /api/v2/chat/conversations/:id/messages
      ✓ should send a message (19 ms)
      ✓ should validate message content (8 ms)
      ✓ should prevent access to conversations user is not part of (16 ms)
    GET /api/v2/chat/conversations/:id/messages
      ✓ should get conversation messages (29 ms)
      ✓ should support pagination (29 ms)
    POST /api/v2/chat/conversations/:id/read
      ✓ should mark conversation as read (12 ms)
    GET /api/v2/chat/unread-count
      ✓ should get unread message count (16 ms)
    DELETE /api/v2/chat/conversations/:id
      ✓ should delete a conversation (32 ms)
    GET /api/v2/chat/conversations/:id
      ✓ should get conversation details (9 ms)
      ✓ should return 404 for non-existent conversation (6 ms)
    Not Implemented Endpoints
      ✓ PUT /api/v2/chat/conversations/:id should return 501 (5 ms)
      ✓ PUT /api/v2/chat/messages/:id should return 501 (4 ms)
      ✓ DELETE /api/v2/chat/messages/:id should return 501 (5 ms)
      ✓ GET /api/v2/chat/search should return 501 (5 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1632 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 400 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:12 +0000] "GET /api/v2/auth/verify HTTP/1.1" 200 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:12 +0000] "GET /api/v2/auth/verify HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:12 +0000] "GET /api/v2/auth/verify HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:12 +0000] "POST /api/v2/auth/refresh HTTP/1.1" 200 343 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:12 +0000] "POST /api/v2/auth/refresh HTTP/1.1" 401 183 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:12 +0000] "GET /api/v2/auth/me HTTP/1.1" 200 1146 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:12 +0000] "POST /api/auth/login HTTP/1.1" 401 107 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
PASS backend/src/routes/v2/auth/__tests__/auth-v2.test.ts
  Authentication API v2 Endpoints
    POST /api/v2/auth/login
      ✓ should return standardized success response with tokens (115 ms)
      ✓ should return standardized error for invalid credentials (85 ms)
      ✓ should validate required fields (4 ms)
    GET /api/v2/auth/verify
      ✓ should verify valid token (9 ms)
      ✓ should reject invalid token (4 ms)
      ✓ should reject missing token (5 ms)
    POST /api/v2/auth/refresh
      ✓ should refresh access token with valid refresh token (7 ms)
      ✓ should reject access token as refresh token (7 ms)
    GET /api/v2/auth/me
      ✓ should return current user with camelCase fields (9 ms)
    Deprecation Headers
      ✓ should include deprecation headers on v1 endpoints (18 ms)
      ✓ should NOT include deprecation headers on v2 endpoints (5 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1613 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1614 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1635 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 200 726 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 736 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 736 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/role-switch/to-original HTTP/1.1" 200 730 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 403 158 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/role-switch/to-original HTTP/1.1" 200 741 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 403 161 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 403 158 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 179 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:16 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 181 "-" "-"
PASS backend/src/routes/v2/role-switch/__tests__/role-switch-v2.test.ts
  Role Switch API v2 - CRITICAL SECURITY TESTS
    ROOT USER TESTS
      ✓ Root can switch to admin view (22 ms)
      ✓ Root can switch to employee view (16 ms)
      ✓ Root can switch back to original role (27 ms)
    ADMIN USER TESTS
      ✓ Admin can switch to employee view (15 ms)
      ✓ Admin cannot use root-to-admin endpoint (8 ms)
      ✓ Admin can switch back to original role (27 ms)
    EMPLOYEE USER TESTS
      ✓ Employee cannot switch to employee view (7 ms)
      ✓ Employee cannot use root-to-admin endpoint (7 ms)
      ✓ Employee status shows cannot switch (7 ms)
    CRITICAL SECURITY TESTS
      ✓ CRITICAL: Admin logs have correct tenant_id (16 ms)
      ✓ GET /api/v2/role-switch/status returns correct information (8 ms)
      ✓ Switched token preserves all security properties (28 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1668 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1668 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:18 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2-simple.test.ts
  Calendar v2 API - Simple Debug Test
    ✓ should login admin user (100 ms)
    ✓ should access calendar endpoint with token (94 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1664 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2-debug.test.ts
  DEBUG Calendar v2 Test User Creation
    ✓ should debug user creation and login (203 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:08:59:20 +0000] "GET /api/v2/users HTTP/1.1" 401 190 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2-simple.test.ts
  Users v2 API - Simple Test
    Basic Endpoint Test
      ✓ should return 401 without authentication (29 ms)

PASS backend/src/routes/v2/users/users.service.integration.test.ts
  UsersService Integration Tests
    createUser
      ✓ should create user successfully (205 ms)
      ✓ should throw error for duplicate email (15 ms)
    getUserById
      ✓ should return user when found (2 ms)
      ✓ should throw error when user not found (2 ms)
    updateUser
      ✓ should update user fields (6 ms)
    listUsers
      ✓ should return paginated users (11 ms)
      ✓ should filter by search term (2 ms)
    deleteUser
      ✓ should prevent self-deletion (2 ms)
      ✓ should delete user successfully (11 ms)

PASS backend/src/routes/v2/users/users.service.logic.test.ts
  UsersService Logic Tests
    ServiceError
      ✓ should create ServiceError with correct properties (2 ms)
      ✓ should use default status code 500 (1 ms)
      ✓ should include details when provided
    Error Code Constants
      ✓ should have proper error codes
    Business Logic Validation
      ✓ should validate pagination parameters (1 ms)
      ✓ should validate limit parameters
      ✓ should calculate pagination metadata
      ✓ should validate sort parameters
      ✓ should validate sort order (1 ms)
    Field Mapping Logic
      ✓ should map database fields to API fields (1 ms)
      ✓ should map API fields to database fields
    Password Validation
      ✓ should validate password requirements (1 ms)
    Email Validation
      ✓ should validate email format (1 ms)
    Employee Number Generation
      ✓ should generate employee number in correct format

PASS backend/src/routes/v2/users/users.service.simple.test.ts
  UsersService - Simple Test
    ServiceError
      ✓ should create ServiceError with correct properties (8 ms)
      ✓ should use default status code 500 (1 ms)
      ✓ should include details when provided (1 ms)

PASS backend/src/routes/v2/calendar/calendar.service.simple.test.ts
  Calendar ServiceError
    Error Creation
      ✓ should create ServiceError with correct properties (2 ms)
      ✓ should create ServiceError with details (2 ms)
      ✓ should handle different error codes
    Error Type Checking
      ✓ should identify ServiceError correctly
      ✓ should handle null and undefined (1 ms)
      ✓ should handle other types
    Calendar-Specific Errors
      ✓ should create date validation error (1 ms)
      ✓ should create permission error
      ✓ should create conflict error
      ✓ should create attendee error (1 ms)
    Error Serialization
      ✓ should convert to JSON properly
      ✓ should handle error without details (1 ms)
    Calendar Data Validation
      ✓ should validate ISO date format (1 ms)
      ✓ should detect invalid dates (1 ms)
      ✓ should validate organization levels
      ✓ should validate event status

PASS backend/src/routes/v2/calendar/calendar.service.logic.test.ts
  Calendar Service Business Logic
    Date Validation Logic
      ✓ should validate that end time is after start time (2 ms)
      ✓ should detect invalid date order (1 ms)
      ✓ should handle all-day events
    Organization Level Validation
      ✓ should require orgId for department events
      ✓ should require orgId for team events (1 ms)
      ✓ should not require orgId for personal events
      ✓ should not require orgId for company events
    Pagination Logic
      ✓ should calculate correct page values
      ✓ should handle invalid page numbers
      ✓ should limit maximum page size
      ✓ should calculate offset correctly (1 ms)
      ✓ should calculate total pages
      ✓ should determine hasNext correctly
      ✓ should determine hasPrev correctly
    Color Validation
      ✓ should validate hex color format
      ✓ should reject invalid color formats
    Recurrence Rule Logic
      ✓ should parse recurrence pattern
      ✓ should calculate interval days for patterns
      ✓ should parse COUNT option
      ✓ should parse UNTIL option
    Sort Field Mapping
      ✓ should map API field names to DB field names (1 ms)
      ✓ should default to start_date for invalid sort field (1 ms)
    Attendee Response Validation
      ✓ should validate attendee response values
      ✓ should reject invalid response values
    Permission Logic
      ✓ should allow owner to manage event (1 ms)
      ✓ should allow admin to manage any event
      ✓ should allow manager to manage any event
      ✓ should not allow non-owner employee to manage
    Export Format Logic
      ✓ should format CSV row correctly (1 ms)
      ✓ should escape CSV fields with quotes
      ✓ should format ICS date correctly
      ✓ should generate unique UID for ICS (1 ms)
    Time Calculation Logic
      ✓ should calculate event duration
      ✓ should handle weekday recurrence
      ✓ should calculate monthly recurrence (1 ms)
      ✓ should calculate yearly recurrence
    Filter Logic
      ✓ should map filter to event type
      ✓ should handle date range filtering
      ✓ should handle search term matching

PASS backend/src/utils/__tests__/errorHandler.test.ts
  errorHandler
    getErrorMessage
      ✓ should extract message from Error object (1 ms)
      ✓ should extract message from object with message property
      ✓ should convert string error to message
      ✓ should handle number error
      ✓ should handle null error
      ✓ should handle undefined error
      ✓ should handle MySQL error format (1 ms)
      ✓ should handle empty object
      ✓ should handle array error
      ✓ should handle boolean error (1 ms)
      ✓ should handle Error with empty message
      ✓ should NOT trim whitespace from error messages

Test Suites: 22 passed, 22 total
Tests:       403 passed, 403 total
Snapshots:   0 total
Time:        81.443 s
Ran all test suites.

🧹 Running global test cleanup...
✅ Global cleanup complete. Remaining test tenants: 0
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
scs@SOSCSPC1M16:~/projects/Assixx/docker$ docker exec assixx-backend pnpm test --verbose --forceExit --runInBand

> assixx@1.0.0 test /app
> node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js --verbose --forceExit --runInBand


🧹 Pre-test cleanup: Removing old test data...
✅ No leftover test data found
(node:999) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
Entries in DB before test: 1 [
  { id: 3888, title: 'Test Entry', org_level: 'company', org_id: null }
]
Employee user info: { id: 18007, role: 'employee', department_id: null, tenant_id: 3501 }
Employee team info: No team assignment
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:54 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 766 "-" "-"
Response data length: 1
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:54 +0000] "GET /api/v2/blackboard/entries?status=archived HTTP/1.1" 200 774 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:55 +0000] "GET /api/v2/blackboard/entries?page=1&limit=5 HTTP/1.1" 200 764 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:55 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:56 +0000] "GET /api/v2/blackboard/entries/3893 HTTP/1.1" 200 715 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
error: Error getting blackboard entry: Entry not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Entry not found\n    at BlackboardService.getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:100:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:111:19)","statusCode":404,"timestamp":"2025-07-31 08:59:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:56 +0000] "GET /api/v2/blackboard/entries/99999 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:57 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 752 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
error: Error creating blackboard entry: Organization ID is required for department level entries {"code":"VALIDATION_ERROR","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Organization ID is required for department level entries\n    at BlackboardService.createEntry (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:115:13)\n    at createEntry (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:147:43)\n    at /app/backend/src/utils/routeHandlers.ts:31:12\n    at Layer.handleRequest (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/layer.js:152:17)\n    at next (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/route.js:157:13)\n    at handleValidationErrors (/app/backend/src/middleware/validation.ts:43:3)\n    at Layer.handleRequest (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/layer.js:152:17)\n    at next (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/route.js:157:13)\n    at middleware (/app/node_modules/.pnpm/express-validator@7.2.1/node_modules/express-validator/lib/middlewares/check.js:16:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)","statusCode":400,"timestamp":"2025-07-31 08:59:57"}
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:57 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 400 221 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:58 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 400 445 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:58 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:59 +0000] "PUT /api/v2/blackboard/entries/3900 HTTP/1.1" 200 719 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:08:59:59 +0000] "PUT /api/v2/blackboard/entries/3901 HTTP/1.1" 200 713 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:00 +0000] "DELETE /api/v2/blackboard/entries/3902 HTTP/1.1" 200 128 "-" "-"
error: Error getting blackboard entry: Entry not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Entry not found\n    at BlackboardService.getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:100:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:111:19)","statusCode":404,"timestamp":"2025-07-31 09:00:00"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:00 +0000] "GET /api/v2/blackboard/entries/3902 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:00 +0000] "POST /api/v2/blackboard/entries/3903/archive HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:01 +0000] "POST /api/v2/blackboard/entries/3904/unarchive HTTP/1.1" 200 767 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:01 +0000] "POST /api/v2/blackboard/entries/3905/confirm HTTP/1.1" 200 130 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:02 +0000] "POST /api/v2/blackboard/entries/3906/confirm HTTP/1.1" 200 130 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:02 +0000] "GET /api/v2/blackboard/entries/3906/confirmations HTTP/1.1" 200 7260 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:02 +0000] "GET /api/v2/blackboard/dashboard HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:03 +0000] "GET /api/v2/blackboard/dashboard?limit=2 HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:03 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:03 +0000] "GET /api/v2/blackboard/tags HTTP/1.1" 200 382 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:04 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:04 +0000] "GET /api/v2/blackboard/entries/3912 HTTP/1.1" 200 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:05 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 766 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
error: Error getting blackboard entry: Entry not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Entry not found\n    at BlackboardService.getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:100:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:111:19)","statusCode":404,"timestamp":"2025-07-31 09:00:05"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:05 +0000] "GET /api/v2/blackboard/entries/3916 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:06 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 802 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:06 +0000] "POST /api/v2/blackboard/entries/3919/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:07 +0000] "POST /api/v2/blackboard/entries/3920/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:07 +0000] "GET /api/v2/blackboard/entries/3920/attachments HTTP/1.1" 200 418 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:07 +0000] "POST /api/v2/blackboard/entries/3921/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:07 +0000] "GET /api/v2/blackboard/entries/3921/attachments HTTP/1.1" 200 418 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:07 +0000] "DELETE /api/v2/blackboard/attachments/161 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:08 +0000] "POST /api/v2/blackboard/entries/3922/attachments HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:08 +0000] "GET /api/v2/blackboard/entries?priority=high HTTP/1.1" 200 797 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:09 +0000] "GET /api/v2/blackboard/entries?requiresConfirmation=true HTTP/1.1" 200 1397 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:09 +0000] "GET /api/v2/blackboard/entries?sortBy=priority&sortDir=DESC HTTP/1.1" 200 2636 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:10 +0000] "GET /api/v2/blackboard/entries?search=Urgent HTTP/1.1" 200 797 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:10 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 750 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:11 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 737 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:11 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 719 "-" "-"
PASS backend/src/routes/v2/blackboard/__tests__/blackboard-v2.test.ts (21.872 s)
  Blackboard API v2
    GET /api/v2/blackboard/entries
      ✓ should list all entries for authenticated user (548 ms)
      ✓ should filter entries by status (477 ms)
      ✓ should support pagination (461 ms)
      ✓ should return 401 without authentication (484 ms)
    GET /api/v2/blackboard/entries/:id
      ✓ should get a specific entry (491 ms)
      ✓ should return 404 for non-existent entry (478 ms)
    POST /api/v2/blackboard/entries
      ✓ should create a new entry as admin (520 ms)
      ✓ should require orgId for department level entries (480 ms)
      ✓ should validate required fields (487 ms)
      ✓ should reject creation from non-admin users (488 ms)
    PUT /api/v2/blackboard/entries/:id
      ✓ should update an entry as admin (526 ms)
      ✓ should allow partial updates (481 ms)
    DELETE /api/v2/blackboard/entries/:id
      ✓ should delete an entry as admin (529 ms)
    POST /api/v2/blackboard/entries/:id/archive
      ✓ should archive an entry (480 ms)
    POST /api/v2/blackboard/entries/:id/unarchive
      ✓ should unarchive an entry (510 ms)
    POST /api/v2/blackboard/entries/:id/confirm
      ✓ should confirm reading an entry (494 ms)
      ✓ should track confirmation status (516 ms)
    GET /api/v2/blackboard/dashboard
      ✓ should get dashboard entries (482 ms)
      ✓ should limit dashboard entries (501 ms)
    Tags functionality
      ✓ should get all available tags (521 ms)
      ✓ should filter entries by tag (556 ms)
    Multi-tenant isolation
      ✓ should not see entries from other tenants (664 ms)
      ✓ should not access other tenant's entry directly (641 ms)
      ✓ should allow other tenant to see their own entries (654 ms)
    Attachments functionality
      ✓ should upload an attachment to an entry (502 ms)
      ✓ should get attachments for an entry (509 ms)
      ✓ should delete an attachment (503 ms)
      ✓ should require authentication for attachment operations (450 ms)
    Advanced filtering and sorting
      ✓ should filter by priority (487 ms)
      ✓ should filter by requiresConfirmation (525 ms)
      ✓ should sort entries (473 ms)
      ✓ should search entries by title and content (507 ms)
    Entry expiration
      ✓ should create entry with expiration date (468 ms)
    Department and Team level entries
      ✓ should create department level entry with orgId (471 ms)
      ✓ should create team level entry with orgId (473 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:00:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:13 +0000] "POST /api/v2/shifts HTTP/1.1" 201 711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:13 +0000] "POST /api/v2/shifts HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:14 +0000] "GET /api/v2/shifts?date=2025-07-31 HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:14 +0000] "GET /api/v2/shifts/678 HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1707 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:14 +0000] "PUT /api/v2/shifts/679 HTTP/1.1" 200 692 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:15 +0000] "DELETE /api/v2/shifts/680 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1679 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:15 +0000] "POST /api/v2/shifts/templates HTTP/1.1" 201 334 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:16 +0000] "GET /api/v2/shifts/templates HTTP/1.1" 200 327 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:16 +0000] "PUT /api/v2/shifts/templates/261 HTTP/1.1" 200 328 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:16 +0000] "DELETE /api/v2/shifts/templates/262 HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:17 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 201 267 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:17 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 403 204 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:18 +0000] "GET /api/v2/shifts/swap-requests HTTP/1.1" 200 687 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:18 +0000] "PUT /api/v2/shifts/swap-requests/160/status HTTP/1.1" 200 136 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:18 +0000] "GET /api/v2/shifts/overtime?startDate=2025-01-01&endDate=2025-01-31 HTTP/1.1" 200 460 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:21 +0000] "GET /api/v2/shifts/overtime HTTP/1.1" 400 434 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:22 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31&format=csv HTTP/1.1" 200 215 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:22 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31&format=excel HTTP/1.1" 501 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:22 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31 HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:23 +0000] "POST /api/v2/shifts HTTP/1.1" 400 263 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:23 +0000] "POST /api/v2/shifts HTTP/1.1" 400 258 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:23 +0000] "POST /api/v2/shifts HTTP/1.1" 400 372 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:24 +0000] "GET /api/v2/shifts/688 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:25 +0000] "GET /api/v2/shifts/templates HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:25 +0000] "POST /api/v2/shifts HTTP/1.1" 201 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:25 +0000] "PUT /api/v2/shifts/templates/264 HTTP/1.1" 200 327 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:26 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 201 234 "-" "-"
PASS backend/src/routes/v2/__tests__/shifts-v2.test.ts (14.34 s)
  Shifts API v2
    Shifts CRUD Operations
      ✓ should create a new shift (417 ms)
      ✓ should fail to create shift without admin role (355 ms)
      ✓ should list shifts with filtering (368 ms)
      ✓ should get shift by ID (371 ms)
      ✓ should update a shift (366 ms)
      ✓ should delete a shift (383 ms)
    Shift Templates
      ✓ should create a shift template (355 ms)
      ✓ should list shift templates (359 ms)
      ✓ should update a template (384 ms)
      ✓ should delete a template (391 ms)
    Shift Swap Requests
      ✓ should create a swap request (408 ms)
      ✓ should not allow swap request for other user's shift (385 ms)
      ✓ should list swap requests (396 ms)
      ✓ should update swap request status (381 ms)
    Overtime Reporting
      ✓ should get overtime report for user (361 ms)
      ✓ should require date range for overtime report (3078 ms)
    Shift Export
      ✓ should export shifts as CSV (359 ms)
      ✓ should return 501 for Excel export (337 ms)
      ✓ should require admin role for export (366 ms)
    Input Validation
      ✓ should validate time format (366 ms)
      ✓ should validate date format (329 ms)
      ✓ should validate required fields (346 ms)
    Multi-Tenant Isolation
      ✓ should not access shifts from other tenant (519 ms)
      ✓ should not see templates from other tenant (539 ms)
    AdminLog Integration
      ✓ should log shift creation (378 ms)
      ✓ should log template updates (361 ms)
      ✓ should log swap request actions (390 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:00:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:27 +0000] "GET /api/v2/kvp/categories HTTP/1.1" 200 251 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:28 +0000] "GET /api/v2/kvp/categories HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:28 +0000] "POST /api/v2/kvp HTTP/1.1" 201 941 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:28 +0000] "POST /api/v2/kvp HTTP/1.1" 400 572 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:29 +0000] "GET /api/v2/kvp?page=1&limit=10 HTTP/1.1" 200 2320 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:29 +0000] "GET /api/v2/kvp?status=new HTTP/1.1" 200 882 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:30 +0000] "GET /api/v2/kvp HTTP/1.1" 200 1604 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:30 +0000] "GET /api/v2/kvp/2410 HTTP/1.1" 200 823 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:30 +0000] "GET /api/v2/kvp/99999 HTTP/1.1" 404 178 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:31 +0000] "PUT /api/v2/kvp/2412 HTTP/1.1" 200 840 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:31 +0000] "PUT /api/v2/kvp/2413 HTTP/1.1" 200 842 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:31 +0000] "PUT /api/v2/kvp/2415 HTTP/1.1" 404 178 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:32 +0000] "DELETE /api/v2/kvp/2416 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1657 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:32 +0000] "POST /api/v2/kvp/2417/comments HTTP/1.1" 201 227 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:33 +0000] "GET /api/v2/kvp/2418/comments HTTP/1.1" 200 493 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:33 +0000] "GET /api/v2/kvp/2419/comments HTTP/1.1" 200 292 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:33 +0000] "GET /api/v2/kvp/dashboard/stats HTTP/1.1" 200 211 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:34 +0000] "POST /api/v2/kvp/points/award HTTP/1.1" 201 264 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1690 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:34 +0000] "POST /api/v2/kvp/points/award HTTP/1.1" 403 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:34 +0000] "GET /api/v2/kvp/points/user/18174 HTTP/1.1" 200 146 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:35 +0000] "GET /api/v2/kvp/points/user/18175 HTTP/1.1" 403 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:35 +0000] "GET /api/v2/kvp/2430/attachments HTTP/1.1" 200 90 "-" "-"
PASS backend/src/routes/v2/__tests__/kvp-v2.test.ts (9.595 s)
  KVP API v2
    Categories
      ✓ should get all categories (382 ms)
      ✓ should require authentication (378 ms)
    Suggestions CRUD
      Create Suggestion
        ✓ should create a new suggestion (369 ms)
        ✓ should validate required fields (343 ms)
      List Suggestions
        ✓ should list suggestions with pagination (382 ms)
        ✓ should filter by status (386 ms)
        ✓ should respect employee visibility rules (388 ms)
      Get Suggestion by ID
        ✓ should get suggestion details (363 ms)
        ✓ should return 404 for non-existent suggestion (362 ms)
      Update Suggestion
        ✓ should update own suggestion (391 ms)
        ✓ should allow admin to update status (383 ms)
        ✓ should prevent employee from updating others suggestions (387 ms)
      Delete Suggestion
        ✓ should delete own suggestion (402 ms)
    Comments
      ✓ should add comment to suggestion (396 ms)
      ✓ should get comments for suggestion (380 ms)
      ✓ should hide internal comments from employees (385 ms)
    Dashboard Statistics
      ✓ should get dashboard statistics (344 ms)
    Points System
      ✓ should award points to user (admin only) (401 ms)
      ✓ should prevent employees from awarding points (357 ms)
      ✓ should get user points summary (378 ms)
      ✓ should allow users to see only their own points (373 ms)
    Attachments
      ✓ should get attachments for suggestion (370 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:00:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:37 +0000] "POST /api/v2/surveys HTTP/1.1" 201 600 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:37 +0000] "POST /api/v2/surveys HTTP/1.1" 403 188 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:38 +0000] "POST /api/v2/surveys HTTP/1.1" 400 315 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:38 +0000] "GET /api/v2/surveys HTTP/1.1" 200 657 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:38 +0000] "GET /api/v2/surveys/306 HTTP/1.1" 200 731 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:39 +0000] "GET /api/v2/surveys/99999 HTTP/1.1" 404 174 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:39 +0000] "PUT /api/v2/surveys/308 HTTP/1.1" 200 581 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:39 +0000] "PUT /api/v2/surveys/309 HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:40 +0000] "DELETE /api/v2/surveys/310 HTTP/1.1" 200 129 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:40 +0000] "DELETE /api/v2/surveys/311 HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:41 +0000] "GET /api/v2/surveys/312 HTTP/1.1" 404 174 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:41 +0000] "GET /api/v2/surveys HTTP/1.1" 200 165 "-" "-"
PASS backend/src/routes/v2/__tests__/surveys-v2.test.ts (5.818 s)
  Surveys API v2
    Survey CRUD Operations
      ✓ should create a new survey (409 ms)
      ✓ should fail to create survey without admin role (355 ms)
      ✓ should validate required fields (344 ms)
    Survey List and Get Operations
      ✓ should list surveys (394 ms)
      ✓ should get survey by ID (381 ms)
      ✓ should return 404 for non-existent survey (366 ms)
    Survey Update and Delete Operations
      ✓ should update survey fields (371 ms)
      ✓ employee should not be able to update survey (356 ms)
      ✓ should delete survey without responses (371 ms)
      ✓ employee should not be able to delete survey (356 ms)
    Multi-Tenant Isolation
      ✓ should not access surveys from other tenants (449 ms)
      ✓ should not list surveys from other tenants (440 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:00:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1613 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1614 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1635 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:42 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 200 726 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:42 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 736 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:42 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 736 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:42 +0000] "POST /api/v2/role-switch/to-original HTTP/1.1" 200 730 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:42 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:42 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 403 158 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:42 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:42 +0000] "POST /api/v2/role-switch/to-original HTTP/1.1" 200 741 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:42 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 403 161 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:42 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 403 158 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:43 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:43 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:43 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 179 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:43 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:43 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 181 "-" "-"
PASS backend/src/routes/v2/role-switch/__tests__/role-switch-v2.test.ts
  Role Switch API v2 - CRITICAL SECURITY TESTS
    ROOT USER TESTS
      ✓ Root can switch to admin view (21 ms)
      ✓ Root can switch to employee view (13 ms)
      ✓ Root can switch back to original role (25 ms)
    ADMIN USER TESTS
      ✓ Admin can switch to employee view (12 ms)
      ✓ Admin cannot use root-to-admin endpoint (7 ms)
      ✓ Admin can switch back to original role (24 ms)
    EMPLOYEE USER TESTS
      ✓ Employee cannot switch to employee view (6 ms)
      ✓ Employee cannot use root-to-admin endpoint (11 ms)
      ✓ Employee status shows cannot switch (7 ms)
    CRITICAL SECURITY TESTS
      ✓ CRITICAL: Admin logs have correct tenant_id (16 ms)
      ✓ GET /api/v2/role-switch/status returns correct information (6 ms)
      ✓ Switched token preserves all security properties (17 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:00:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1652 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:44 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1106 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:44 +0000] "GET /api/v2/users/me HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:44 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1106 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:44 +0000] "GET /api/v2/users?page=1&limit=10 HTTP/1.1" 200 1294 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:44 +0000] "GET /api/v2/users?role=admin HTTP/1.1" 200 723 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:44 +0000] "GET /api/v2/users?search=Admin HTTP/1.1" 200 723 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:44 +0000] "GET /api/v2/users HTTP/1.1" 403 182 "-" "-"
info: User created successfully with ID: 18210 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:44"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:44 +0000] "POST /api/v2/users HTTP/1.1" 201 1152 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:44 +0000] "POST /api/v2/users HTTP/1.1" 400 463 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:44 +0000] "POST /api/v2/users HTTP/1.1" 409 177 "-" "-"
info: Updating field first_name to value: Updated {"service":"assixx-backend","timestamp":"2025-07-31 09:00:44"}
info: Updating field last_name to value: Name {"service":"assixx-backend","timestamp":"2025-07-31 09:00:44"}
info: Updating field position to value: Senior Developer {"service":"assixx-backend","timestamp":"2025-07-31 09:00:44"}
info: Special handling for is_active field - received value: false, type: boolean {"service":"assixx-backend","timestamp":"2025-07-31 09:00:44"}
info: is_active will be set to: 0 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:44"}
info: Executing update query: UPDATE users SET `first_name` = ?, `last_name` = ?, `position` = ?, `is_active` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-07-31 09:00:44"}
info: With values: ["Updated","Name","Senior Developer",0,18211,3513] {"service":"assixx-backend","timestamp":"2025-07-31 09:00:44"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:44 +0000] "PUT /api/v2/users/18211 HTTP/1.1" 200 1131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "PUT /api/v2/users/18212 HTTP/1.1" 200 1115 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1720 "-" "-"
info: Archiving user 18213 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
info: Special handling for is_archived field - received value: true, type: boolean {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
info: is_archived will be set to: 1 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
info: Executing update query: UPDATE users SET `is_archived` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
info: With values: [1,18213,3513] {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "POST /api/v2/users/18213/archive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "GET /api/v2/users/18213 HTTP/1.1" 200 1116 "-" "-"
info: Archiving user 18214 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
info: Special handling for is_archived field - received value: true, type: boolean {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
info: is_archived will be set to: 1 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
info: Executing update query: UPDATE users SET `is_archived` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
info: With values: [1,18214,3513] {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "POST /api/v2/users/18214/archive HTTP/1.1" 200 92 "-" "-"
info: Unarchiving user 18214 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
info: Special handling for is_archived field - received value: false, type: boolean {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
info: is_archived will be set to: 0 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
info: Executing update query: UPDATE users SET `is_archived` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
info: With values: [0,18214,3513] {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "POST /api/v2/users/18214/unarchive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "GET /api/v2/users/18214 HTTP/1.1" 200 1117 "-" "-"
info: Password changed successfully for user 18209 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:45"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 400 253 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "GET /api/v2/users/me/profile-picture HTTP/1.1" 200 15 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "DELETE /api/v2/users/me/profile-picture HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "GET /api/v2/users/me/profile-picture HTTP/1.1" 404 183 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:45 +0000] "PUT /api/v2/users/18215/availability HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:46 +0000] "PUT /api/v2/users/18216/availability HTTP/1.1" 400 261 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:46 +0000] "GET /api/v2/users/18208 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:46 +0000] "GET /api/v2/users HTTP/1.1" 200 721 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2.test.ts
  Users v2 API Endpoints
    Response Format Validation
      ✓ should return standardized success response format (14 ms)
      ✓ should return standardized error response format (6 ms)
    Field Mapping (camelCase)
      ✓ should return user data with camelCase fields (12 ms)
    GET /api/v2/users
      ✓ should list users with pagination (admin only) (20 ms)
      ✓ should filter users by role (13 ms)
      ✓ should search users by name or email (8 ms)
      ✓ should deny access to non-admin users (6 ms)
    POST /api/v2/users
      ✓ should create a new user with camelCase input (178 ms)
      ✓ should validate required fields (5 ms)
      ✓ should prevent duplicate emails (6 ms)
    PUT /api/v2/users/:id
      ✓ should update user with camelCase fields (118 ms)
      ✓ should not allow password updates via this endpoint (187 ms)
    POST /api/v2/users/:id/archive & /unarchive
      ✓ should archive a user (105 ms)
      ✓ should unarchive a user (138 ms)
    PUT /api/v2/users/me/password
      ✓ should change password with correct current password (276 ms)
      ✓ should reject incorrect current password (88 ms)
      ✓ should validate password confirmation (5 ms)
    Profile Picture Endpoints
      ✓ should upload profile picture (21 ms)
      ✓ should download profile picture (20 ms)
      ✓ should delete profile picture (30 ms)
    PUT /api/v2/users/:id/availability
      ✓ should update user availability (113 ms)
      ✓ should validate availability status enum (88 ms)
    Multi-Tenant Isolation
      ✓ should not allow cross-tenant user access (6 ms)
      ✓ should not list users from other tenants (7 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:00:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1669 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1698 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 1310 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events?page=1&limit=1 HTTP/1.1" 200 754 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events?status=cancelled HTTP/1.1" 200 750 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events?search=Team HTTP/1.1" 200 756 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "POST /api/v2/calendar/events HTTP/1.1" 201 981 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "POST /api/v2/calendar/events HTTP/1.1" 201 1511 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 641 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 260 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 278 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events/3376 HTTP/1.1" 200 1184 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events/99999 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events/3379 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "PUT /api/v2/calendar/events/3380 HTTP/1.1" 200 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "PUT /api/v2/calendar/events/3381 HTTP/1.1" 200 671 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "PUT /api/v2/calendar/events/3382 HTTP/1.1" 403 153 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "PUT /api/v2/calendar/events/3383 HTTP/1.1" 400 260 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "DELETE /api/v2/calendar/events/3384 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events/3384 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "DELETE /api/v2/calendar/events/3385 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "DELETE /api/v2/calendar/events/3386 HTTP/1.1" 403 153 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "PUT /api/v2/calendar/events/3387/attendees/response HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events/3387 HTTP/1.1" 200 1212 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "PUT /api/v2/calendar/events/3388/attendees/response HTTP/1.1" 400 254 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1663 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "PUT /api/v2/calendar/events/3389/attendees/response HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/export?format=ics HTTP/1.1" 200 493 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/export?format=csv HTTP/1.1" 200 261 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/export?format=invalid HTTP/1.1" 400 263 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/export HTTP/1.1" 400 308 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:48 +0000] "GET /api/v2/calendar/events/3399 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:49 +0000] "PUT /api/v2/calendar/events/3400 HTTP/1.1" 404 122 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:49 +0000] "DELETE /api/v2/calendar/events/3401 HTTP/1.1" 404 122 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2.test.ts
  Calendar v2 API Endpoints
    Response Format Validation
      ✓ should return standardized success response format (18 ms)
      ✓ should return standardized error response format (7 ms)
    GET /api/v2/calendar/events
      ✓ should list all events for admin (26 ms)
      ✓ should support pagination (22 ms)
      ✓ should support filtering by status (28 ms)
      ✓ should support search (24 ms)
      ✓ should require authentication (18 ms)
    POST /api/v2/calendar/events
      ✓ should create a new event (27 ms)
      ✓ should create event with attendees (35 ms)
      ✓ should validate required fields (15 ms)
      ✓ should validate date order (7 ms)
      ✓ should require orgId for department/team events (6 ms)
    GET /api/v2/calendar/events/:id
      ✓ should get event by ID (19 ms)
      ✓ should return 404 for non-existent event (25 ms)
      ✓ should respect access control for employees (26 ms)
    PUT /api/v2/calendar/events/:id
      ✓ should update event (owner) (29 ms)
      ✓ should update event (admin) (28 ms)
      ✓ should not allow non-owner employee to update (15 ms)
      ✓ should validate date updates (15 ms)
    DELETE /api/v2/calendar/events/:id
      ✓ should delete event (owner) (27 ms)
      ✓ should delete event (admin) (15 ms)
      ✓ should not allow non-owner employee to delete (14 ms)
    PUT /api/v2/calendar/events/:id/attendees/response
      ✓ should update attendee response (31 ms)
      ✓ should validate response values (22 ms)
      ✓ should add user as attendee if not already (187 ms)
    GET /api/v2/calendar/export
      ✓ should export events as ICS (20 ms)
      ✓ should export events as CSV (18 ms)
      ✓ should validate format parameter (15 ms)
      ✓ should require format parameter (15 ms)
    Multi-Tenant Isolation
      ✓ should not show events from other tenants (102 ms)
      ✓ should not access specific event from other tenant (131 ms)
      ✓ should not update event from other tenant (103 ms)
      ✓ should not delete event from other tenant (105 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:00:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1672 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1700 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1663 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1716 "-" "-"
info: Fetching all teams for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams HTTP/1.1" 200 585 "-" "-"
info: Fetching all teams for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams?departmentId=1682 HTTP/1.1" 200 585 "-" "-"
info: Fetching all teams for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams?search=Team%201 HTTP/1.1" 200 337 "-" "-"
info: Fetching all teams for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams?includeMembers=true HTTP/1.1" 200 617 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams HTTP/1.1" 401 190 "-" "-"
info: Fetching all teams for tenant 3518 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 0 teams {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams HTTP/1.1" 200 90 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 2 members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams/1220 HTTP/1.1" 200 782 "-" "-"
info: Fetching team with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
warn: Team with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.getTeamById (/app/backend/src/routes/v2/teams/teams.service.ts:112:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getTeamById (/app/backend/src/routes/v2/teams/teams.controller.ts:88:20)","statusCode":404,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.getTeamById (/app/backend/src/routes/v2/teams/teams.service.ts:117:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getTeamById (/app/backend/src/routes/v2/teams/teams.controller.ts:88:20)","statusCode":404,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams/1220 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 0 members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams/1220 HTTP/1.1" 200 348 "-" "-"
info: Fetching department with ID 1682 for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Department 1682 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching all teams for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 2 teams {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Creating new team: New Team v2 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team created successfully with ID 1222 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching team with ID 1222 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1222 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching members for team 1222 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 0 members for team 1222 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams HTTP/1.1" 201 360 "-" "-"
info: Fetching all teams for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 3 teams {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Team with this name already exists {"code":"CONFLICT","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team with this name already exists\n    at TeamsService.createTeam (/app/backend/src/routes/v2/teams/teams.service.ts:185:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at createTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:130:20)","statusCode":409,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams HTTP/1.1" 409 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams HTTP/1.1" 400 309 "-" "-"
info: Fetching department with ID 99999 for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
warn: Department with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Invalid department ID {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Invalid department ID\n    at TeamsService.createTeam (/app/backend/src/routes/v2/teams/teams.service.ts:166:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at createTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:130:20)","statusCode":400,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams HTTP/1.1" 400 181 "-" "-"
error: Invalid leader ID {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Invalid leader ID\n    at TeamsService.createTeam (/app/backend/src/routes/v2/teams/teams.service.ts:174:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at createTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:130:20)","statusCode":400,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams HTTP/1.1" 400 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams HTTP/1.1" 403 182 "-" "-"
info: Fetching all teams for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 3 teams {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Creating new team: Root Created Team {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team created successfully with ID 1223 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching team with ID 1223 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1223 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching members for team 1223 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 0 members for team 1223 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams HTTP/1.1" 201 341 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching all teams for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 4 teams {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Updating team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 0 members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "PUT /api/v2/teams/1220 HTTP/1.1" 200 363 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Updating team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 0 members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "PUT /api/v2/teams/1220 HTTP/1.1" 200 345 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching all teams for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 4 teams {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Team with this name already exists {"code":"CONFLICT","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team with this name already exists\n    at TeamsService.updateTeam (/app/backend/src/routes/v2/teams/teams.service.ts:255:17)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at updateTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:173:20)","statusCode":409,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "PUT /api/v2/teams/1220 HTTP/1.1" 409 191 "-" "-"
info: Fetching team with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
warn: Team with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.updateTeam (/app/backend/src/routes/v2/teams/teams.service.ts:222:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at updateTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:173:20)","statusCode":404,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "PUT /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.updateTeam (/app/backend/src/routes/v2/teams/teams.service.ts:222:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at updateTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:173:20)","statusCode":404,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "PUT /api/v2/teams/1220 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "PUT /api/v2/teams/1220 HTTP/1.1" 403 182 "-" "-"
info: Fetching team with ID 1224 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1224 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching members for team 1224 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 0 members for team 1224 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Deleting team 1224 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1224 deleted successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "DELETE /api/v2/teams/1224 HTTP/1.1" 200 127 "-" "-"
info: Fetching team with ID 1224 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
warn: Team with ID 1224 not found {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.getTeamById (/app/backend/src/routes/v2/teams/teams.service.ts:112:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getTeamById (/app/backend/src/routes/v2/teams/teams.controller.ts:88:20)","statusCode":404,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams/1224 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1225 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1225 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching members for team 1225 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 1 members for team 1225 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Cannot delete team with members {"code":"BAD_REQUEST","details":{"memberCount":1},"name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Cannot delete team with members\n    at TeamsService.deleteTeam (/app/backend/src/routes/v2/teams/teams.service.ts:310:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at deleteTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:212:22)","statusCode":400,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "DELETE /api/v2/teams/1225 HTTP/1.1" 400 219 "-" "-"
info: Fetching team with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
warn: Team with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Error in deleteTeam: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.deleteTeam (/app/backend/src/routes/v2/teams/teams.service.ts:304:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at deleteTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:212:22)","statusCode":404,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "DELETE /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1227 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1227 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Error in deleteTeam: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.deleteTeam (/app/backend/src/routes/v2/teams/teams.service.ts:304:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at deleteTeam (/app/backend/src/routes/v2/teams/teams.controller.ts:212:22)","statusCode":404,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "DELETE /api/v2/teams/1227 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "DELETE /api/v2/teams/1228 HTTP/1.1" 403 182 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 2 members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams/1220/members HTTP/1.1" 200 524 "-" "-"
info: Fetching team with ID 1221 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1221 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching members for team 1221 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 0 members for team 1221 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams/1221/members HTTP/1.1" 200 90 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 0 members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams/1220/members HTTP/1.1" 200 90 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Error in getTeamMembers: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.getTeamMembers (/app/backend/src/routes/v2/teams/teams.service.ts:341:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getTeamMembers (/app/backend/src/routes/v2/teams/teams.controller.ts:250:23)","statusCode":404,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams/1220/members HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Adding user 18227 to team 1220 for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: User 18227 added to team 1220 successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams/1220/members HTTP/1.1" 201 132 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 1 members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams/1220/members HTTP/1.1" 200 311 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Adding user 18227 to team 1220 for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
warn: User 18227 is already a member of team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Error adding team member: User is already a member of this team {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Error in addTeamMember: User is already a member of this team {"code":"CONFLICT","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: User is already a member of this team\n    at TeamsService.addTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:401:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at addTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:291:22)","statusCode":409,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams/1220/members HTTP/1.1" 409 194 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Error in addTeamMember: Invalid user ID {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Invalid user ID\n    at TeamsService.addTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:378:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at addTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:291:22)","statusCode":400,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams/1220/members HTTP/1.1" 400 175 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Error in addTeamMember: Invalid user ID {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Invalid user ID\n    at TeamsService.addTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:378:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at addTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:291:22)","statusCode":400,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams/1220/members HTTP/1.1" 400 175 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams/1220/members HTTP/1.1" 403 182 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Removing user 18227 from team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: User 18227 removed from team 1220 successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "DELETE /api/v2/teams/1220/members/18227 HTTP/1.1" 200 134 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Fetching members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Retrieved 0 members for team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams/1220/members HTTP/1.1" 200 90 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Removing user 18228 from team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
warn: User 18228 is not a member of team 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Error in removeTeamMember: User is not a member of this team {"code":"BAD_REQUEST","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: User is not a member of this team\n    at TeamsService.removeTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:425:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at removeTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:335:22)","statusCode":400,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "DELETE /api/v2/teams/1220/members/18228 HTTP/1.1" 400 193 "-" "-"
info: Fetching team with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
warn: Team with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Error in removeTeamMember: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.removeTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:420:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at removeTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:335:22)","statusCode":404,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "DELETE /api/v2/teams/99999/members/18227 HTTP/1.1" 404 172 "-" "-"
info: Fetching team with ID 1220 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
info: Team 1220 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:51"}
error: Error in removeTeamMember: Team not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Team not found\n    at TeamsService.removeTeamMember (/app/backend/src/routes/v2/teams/teams.service.ts:420:15)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at removeTeamMember (/app/backend/src/routes/v2/teams/teams.controller.ts:335:22)","statusCode":404,"timestamp":"2025-07-31 09:00:51"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "DELETE /api/v2/teams/1220/members/18227 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "DELETE /api/v2/teams/1220/members/18227 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams HTTP/1.1" 400 258 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams HTTP/1.1" 400 271 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams?search=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa HTTP/1.1" 400 262 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "GET /api/v2/teams/not-a-number HTTP/1.1" 400 256 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:51 +0000] "POST /api/v2/teams HTTP/1.1" 400 118 "-" "-"
info: Fetching all teams for tenant 3517 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:49"}
info: Retrieved 8 teams {"service":"assixx-backend","timestamp":"2025-07-31 09:00:49"}
info: Creating new team: JSON Team {"service":"assixx-backend","timestamp":"2025-07-31 09:00:49"}
info: Team created successfully with ID 1229 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:49"}
info: Fetching team with ID 1229 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:49"}
info: Team 1229 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:49"}
info: Fetching members for team 1229 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:49"}
info: Retrieved 0 members for team 1229 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:49"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:49 +0000] "POST /api/v2/teams HTTP/1.1" 201 315 "-" "-"
PASS backend/src/routes/v2/teams/__tests__/teams-v2.test.ts (5.206 s)
  Teams v2 API Endpoints
    GET /api/v2/teams
      ✓ should list all teams for the tenant (20 ms)
      ✓ should filter teams by department (9 ms)
      ✓ should search teams by name (9 ms)
      ✓ should include member count when requested (17 ms)
      ✓ should require authentication (10 ms)
      ✓ should isolate teams by tenant (7 ms)
    GET /api/v2/teams/:id
      ✓ should get team by ID with members (16 ms)
      ✓ should return 404 for non-existent team (21 ms)
      ✓ should prevent access to other tenant's teams (8 ms)
      ✓ should allow employee access to view teams (8 ms)
    POST /api/v2/teams
      ✓ should create a new team (18 ms)
      ✓ should prevent duplicate team names (8 ms)
      ✓ should validate required fields (6 ms)
      ✓ should validate department ID (7 ms)
      ✓ should validate leader ID (8 ms)
      ✓ should require admin or root role (5 ms)
      ✓ should allow root role to create teams (14 ms)
    PUT /api/v2/teams/:id
      ✓ should update team details (15 ms)
      ✓ should allow clearing optional fields (12 ms)
      ✓ should prevent duplicate names on update (9 ms)
      ✓ should return 404 for non-existent team (7 ms)
      ✓ should prevent access to other tenant's teams (7 ms)
      ✓ should require admin or root role (4 ms)
    DELETE /api/v2/teams/:id
      ✓ should delete an empty team (21 ms)
      ✓ should prevent deletion of team with members (15 ms)
      ✓ should return 404 for non-existent team (11 ms)
      ✓ should prevent access to other tenant's teams (11 ms)
      ✓ should require admin or root role (13 ms)
    GET /api/v2/teams/:id/members
      ✓ should list team members (12 ms)
      ✓ should return empty array for team without members (11 ms)
      ✓ should allow employees to view team members (8 ms)
      ✓ should prevent access to other tenant's teams (7 ms)
    POST /api/v2/teams/:id/members
      ✓ should add a member to the team (20 ms)
      ✓ should prevent adding duplicate members (20 ms)
      ✓ should validate user ID (14 ms)
      ✓ should prevent adding users from other tenants (7 ms)
      ✓ should require admin or root role (6 ms)
    DELETE /api/v2/teams/:id/members/:userId
      ✓ should remove a member from the team (27 ms)
      ✓ should handle removing non-member gracefully (14 ms)
      ✓ should return 404 for non-existent team (16 ms)
      ✓ should prevent access to other tenant's teams (15 ms)
      ✓ should require admin or root role (14 ms)
    Input Validation
      ✓ should validate team name length (11 ms)
      ✓ should validate description length (5 ms)
      ✓ should validate search parameter (6 ms)
      ✓ should validate numeric IDs (5 ms)
    Content-Type validation
      ✓ should reject non-JSON content type for POST (3 ms)
      ✓ should accept application/json content type (-2258 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:00:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1723 "-" "-"
info: Creating new document in category general for user 18231 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document created successfully with ID 1058 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1058 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1058 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 201 635 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 500 35 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 401 190 "-" "-"
info: Fetching team with ID 1230 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Team 1230 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Creating new document in category work for team 1230 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document created successfully with ID 1059 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1059 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1059 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 201 658 "-" "-"
info: Creating new document in category salary for user 18231 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document created successfully with ID 1060 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1060 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1060 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 201 666 "-" "-"
info: Creating new document in category personal for user 18231 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document created successfully with ID 1061 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1061 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1061 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 201 626 "-" "-"
info: Fetching team with ID 1230 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Team 1230 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Creating new document in category work for team 1230 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document created successfully with ID 1062 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1062 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1062 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 201 636 "-" "-"
info: Creating new document in category general for entire company (tenant 3519) {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document created successfully with ID 1063 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1063 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1063 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 201 641 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":3519,"timestamp":"2025-07-31 09:00:56","userId":18230}
info: Finding documents with filters {"isArchived":false,"limit":20,"offset":0,"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Found 6 documents (total: 6) with filters {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents HTTP/1.1" 200 4128 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":3519,"timestamp":"2025-07-31 09:00:56","userId":18230}
info: Finding documents with filters {"category":"personal","isArchived":false,"limit":20,"offset":0,"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Found 1 documents (total: 1) with filters {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents?category=personal HTTP/1.1" 200 801 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":3519,"timestamp":"2025-07-31 09:00:56","userId":18230}
info: Finding documents with filters {"isArchived":false,"limit":20,"offset":0,"recipientType":"team","service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Found 2 documents (total: 2) with filters {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents?recipientType=team HTTP/1.1" 200 1490 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":3519,"timestamp":"2025-07-31 09:00:56","userId":18231}
info: Fetching all accessible documents for employee 18231 in tenant 3519 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Retrieved 6 accessible documents (total: 6) for employee 18231 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents HTTP/1.1" 200 4638 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":3519,"timestamp":"2025-07-31 09:00:56","userId":18230}
info: Finding documents with filters {"isArchived":false,"limit":2,"offset":0,"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Found 2 documents (total: 6) with filters {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents?page=1&limit=2 HTTP/1.1" 200 1460 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":3519,"timestamp":"2025-07-31 09:00:56","userId":18230}
info: Finding documents with filters {"isArchived":false,"limit":20,"offset":0,"searchTerm":"team","service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Found 2 documents (total: 2) with filters {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents?search=team HTTP/1.1" 200 1490 "-" "-"
info: Creating new document in category training for user 18231 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document created successfully with ID 1064 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1064 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1064 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 201 673 "-" "-"
info: Fetching document with ID 1064 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1064 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents/1064 HTTP/1.1" 200 673 "-" "-"
info: Fetching document with ID 99999 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
warn: Document with ID 99999 not found {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
error: Get document error: Document not found {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents/99999 HTTP/1.1" 404 176 "-" "-"
info: Creating new document in category personal for user 18232 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document created successfully with ID 1065 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1065 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1065 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 201 631 "-" "-"
info: Fetching document with ID 1065 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1065 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
error: Get document error: You don't have access to this document {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents/1065 HTTP/1.1" 403 196 "-" "-"
info: Creating new document in category general for entire company (tenant 3519) {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document created successfully with ID 1066 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1066 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1066 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 201 656 "-" "-"
info: Fetching document with ID 1066 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1066 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Updating document 1066 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1066 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1066 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1066 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "PUT /api/v2/documents/1066 HTTP/1.1" 200 667 "-" "-"
info: Fetching document with ID 1066 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1066 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Updating document 1066 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1066 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1066 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1066 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "PUT /api/v2/documents/1066 HTTP/1.1" 200 636 "-" "-"
info: Fetching document with ID 1066 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1066 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
error: Update document error: You don't have permission to update this document {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "PUT /api/v2/documents/1066 HTTP/1.1" 403 207 "-" "-"
info: Creating new document in category general for entire company (tenant 3519) {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document created successfully with ID 1067 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1067 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1067 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 201 638 "-" "-"
info: Fetching document with ID 1067 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1067 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Deleting document 1067 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1067 deleted successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "DELETE /api/v2/documents/1067 HTTP/1.1" 200 131 "-" "-"
info: Fetching document with ID 1067 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
warn: Document with ID 1067 not found {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
error: Get document error: Document not found {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents/1067 HTTP/1.1" 404 176 "-" "-"
info: Creating new document in category general for entire company (tenant 3519) {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document created successfully with ID 1068 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1068 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1068 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 201 638 "-" "-"
info: Fetching document with ID 1068 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1068 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
error: Delete document error: Only administrators can delete documents {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "DELETE /api/v2/documents/1068 HTTP/1.1" 403 198 "-" "-"
info: Creating new document in category general for entire company (tenant 3519) {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document created successfully with ID 1069 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1069 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1069 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 201 643 "-" "-"
info: Archiving document 1069 for user 18230 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1069 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1069 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Updating document 1069 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1069 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents/1069/archive HTTP/1.1" 200 132 "-" "-"
info: Documents v2: listDocuments called {"service":"assixx-backend","tenantId":3519,"timestamp":"2025-07-31 09:00:56","userId":18230}
info: Finding documents with filters {"isArchived":true,"limit":20,"offset":0,"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Found 1 documents (total: 1) with filters {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents?isArchived=true HTTP/1.1" 200 820 "-" "-"
info: Fetching document with ID 1069 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1069 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Updating document 1069 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1069 updated successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents/1069/unarchive HTTP/1.1" 200 134 "-" "-"
info: Creating new document in category general for entire company (tenant 3519) {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document created successfully with ID 1070 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Fetching document with ID 1070 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1070 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 201 647 "-" "-"
info: Fetching document with ID 1070 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1070 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Incrementing download count for document 1070 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Download tracked for document 1070 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents/1070/download HTTP/1.1" 200 11 "-" "-"
info: Fetching document with ID 1070 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Document 1070 retrieved successfully {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Incrementing download count for document 1070 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Download tracked for document 1070 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents/1070/preview HTTP/1.1" 200 11 "-" "-"
info: Calculating total storage used by tenant 3519 {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
info: Tenant 3519 is using 143 bytes of storage {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents/stats HTTP/1.1" 200 200 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "GET /api/v2/documents/stats HTTP/1.1" 200 199 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 400 424 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 400 244 "-" "-"
error: Create document error: User ID is required for user recipient type {"service":"assixx-backend","timestamp":"2025-07-31 09:00:56"}
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:56 +0000] "POST /api/v2/documents HTTP/1.1" 400 203 "-" "-"
PASS backend/src/routes/v2/documents/__tests__/documents-v2.test.ts
  Documents API v2
    POST /api/v2/documents
      ✓ should upload a PDF document (32 ms)
      ✓ should reject non-PDF files (16 ms)
      ✓ should require authentication (3 ms)
      ✓ should upload document for team (25 ms)
      ✓ should upload salary document with year/month (18 ms)
    GET /api/v2/documents
      ✓ should list all documents for admin (17 ms)
      ✓ should filter documents by category (8 ms)
      ✓ should filter documents by recipient type (11 ms)
      ✓ should show only accessible documents for regular user (13 ms)
      ✓ should support pagination (9 ms)
      ✓ should support search (8 ms)
    GET /api/v2/documents/:id
      ✓ should get document by ID (15 ms)
      ✓ should return 404 for non-existent document (6 ms)
      ✓ should deny access to unauthorized user (106 ms)
    PUT /api/v2/documents/:id
      ✓ should update document metadata (21 ms)
      ✓ should allow clearing optional fields (19 ms)
      ✓ should require admin role for update (7 ms)
    DELETE /api/v2/documents/:id
      ✓ should delete document (41 ms)
      ✓ should require admin role for delete (26 ms)
    Archive/Unarchive
      ✓ should archive document (26 ms)
      ✓ should unarchive document (12 ms)
    Download/Preview
      ✓ should download document (11 ms)
      ✓ should preview document inline (9 ms)
    GET /api/v2/documents/stats
      ✓ should get document statistics (10 ms)
      ✓ should not show storage for regular users (6 ms)
    Validation
      ✓ should validate required fields (9 ms)
      ✓ should validate category values (6 ms)
      ✓ should validate recipient requirements (6 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments HTTP/1.1" 200 672 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments?includeExtended=false HTTP/1.1" 200 522 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments/stats HTTP/1.1" 200 125 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments/stats HTTP/1.1" 200 125 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments/1684 HTTP/1.1" 200 406 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments/99999 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments/invalid HTTP/1.1" 400 178 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments/1684 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "POST /api/v2/departments HTTP/1.1" 201 422 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "POST /api/v2/departments HTTP/1.1" 201 359 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "POST /api/v2/departments HTTP/1.1" 403 201 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "POST /api/v2/departments HTTP/1.1" 400 192 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "POST /api/v2/departments HTTP/1.1" 400 187 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "PUT /api/v2/departments/1685 HTTP/1.1" 200 427 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "PUT /api/v2/departments/1684 HTTP/1.1" 403 201 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "PUT /api/v2/departments/1684 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "PUT /api/v2/departments/1684 HTTP/1.1" 400 174 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "POST /api/v2/departments HTTP/1.1" 201 354 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "DELETE /api/v2/departments/1690 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "DELETE /api/v2/departments/1684 HTTP/1.1" 400 227 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "DELETE /api/v2/departments/1685 HTTP/1.1" 403 201 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments/1684/members HTTP/1.1" 200 589 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments/1685/members HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments/1684/members HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "GET /api/v2/departments HTTP/1.1" 200 748 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:00:58 +0000] "POST /api/v2/departments HTTP/1.1" 400 184 "-" "-"
PASS backend/src/routes/v2/departments/__tests__/departments-v2.test.ts
  Departments v2 API Endpoints
    GET /api/v2/departments
      ✓ should return all departments for authenticated user (16 ms)
      ✓ should return departments without extended fields when includeExtended=false (11 ms)
      ✓ should require authentication (4 ms)
      ✓ should not return departments from other tenants (9 ms)
    GET /api/v2/departments/stats
      ✓ should return department statistics (15 ms)
      ✓ should return stats only for user's tenant (14 ms)
    GET /api/v2/departments/:id
      ✓ should return a specific department (15 ms)
      ✓ should return 404 for non-existent department (14 ms)
      ✓ should return 400 for invalid department ID (6 ms)
      ✓ should not return department from other tenant (8 ms)
    POST /api/v2/departments
      ✓ should create a new department as admin (17 ms)
      ✓ should create a department with parent (19 ms)
      ✓ should require admin or root role (9 ms)
      ✓ should validate required fields (8 ms)
      ✓ should not allow duplicate department names (12 ms)
    PUT /api/v2/departments/:id
      ✓ should update a department (19 ms)
      ✓ should require admin or root role for update (7 ms)
      ✓ should not update department from other tenant (8 ms)
      ✓ should validate manager exists in same tenant (9 ms)
    DELETE /api/v2/departments/:id
      ✓ should delete a department without users (27 ms)
      ✓ should not delete department with assigned users (19 ms)
      ✓ should require admin or root role for deletion (6 ms)
    GET /api/v2/departments/:id/members
      ✓ should return department members (20 ms)
      ✓ should return empty array for department without members (8 ms)
      ✓ should not return members from other tenant's department (8 ms)
    Multi-tenant isolation
      ✓ should completely isolate department data between tenants (13 ms)
      ✓ should not allow cross-tenant parent department assignment (18 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1655 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
Created conversation 1 with ID: 298
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "GET /api/v2/chat/users HTTP/1.1" 200 664 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "GET /api/v2/chat/users?search=chat_employee_test HTTP/1.1" 200 385 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "GET /api/v2/chat/users HTTP/1.1" 401 190 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3522,
  creatorId: 18237,
  data: {
    participantIds: [ 18239 ],
    name: 'New Test 1:1 Chat',
    isGroup: undefined
  }
}
[Chat Service] Creating new conversation with isGroup: false
[Chat Service] Created conversation with ID: 300
[Chat Service] getConversations called with: { tenantId: 3522, userId: 18237, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3522
        AND cp.user_id = 18237
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 676 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3522,
  creatorId: 18237,
  data: {
    participantIds: [ 18238, 18239 ],
    name: 'Test Group Chat',
    isGroup: undefined
  }
}
[Chat Service] Creating new conversation with isGroup: true
[Chat Service] Created conversation with ID: 301
[Chat Service] getConversations called with: { tenantId: 3522, userId: 18237, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3522
        AND cp.user_id = 18237
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 869 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3522,
  creatorId: 18237,
  data: {
    participantIds: [ 18238 ],
    name: 'Another attempt',
    isGroup: undefined
  }
}
[Chat Service] getConversations called with: { tenantId: 3522, userId: 18237, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3522
        AND cp.user_id = 18237
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 400 270 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3522,
  userId: 18237,
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
        WHERE c.tenant_id = 3522
        AND cp.user_id = 18237
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "GET /api/v2/chat/conversations HTTP/1.1" 200 2889 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3522,
  userId: 18237,
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
        WHERE c.tenant_id = 3522
        AND cp.user_id = 18237
        ORDER BY c.created_at DESC
        LIMIT 5 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "GET /api/v2/chat/conversations?page=1&limit=5 HTTP/1.1" 200 2888 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3522,
  userId: 18237,
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
        WHERE c.tenant_id = 3522
        AND cp.user_id = 18237
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "GET /api/v2/chat/conversations?search=Test%20Group HTTP/1.1" 200 2889 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations/298/messages HTTP/1.1" 201 421 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations/298/messages HTTP/1.1" 400 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations/302/messages HTTP/1.1" 403 170 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations/298/messages HTTP/1.1" 201 414 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations/298/messages HTTP/1.1" 201 420 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "GET /api/v2/chat/conversations/298/messages HTTP/1.1" 200 1486 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations/298/messages HTTP/1.1" 201 414 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations/298/messages HTTP/1.1" 201 420 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "GET /api/v2/chat/conversations/298/messages?page=1&limit=1 HTTP/1.1" 200 524 "-" "-"
Test conversationId: 298
Test authToken2: exists
[Chat Controller] markAsRead called
[Chat Controller] markAsRead - conversationId: 298 userId: 18238
[Chat Service] markConversationAsRead: { conversationId: 298, userId: 18238 }
[Chat Service] User is participant, getting unread messages
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations/298/read HTTP/1.1" 200 105 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations/298/messages HTTP/1.1" 201 419 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "GET /api/v2/chat/unread-count HTTP/1.1" 200 250 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3522,
  creatorId: 18237,
  data: {
    participantIds: [ 18239 ],
    name: 'To be deleted',
    isGroup: undefined
  }
}
[Chat Service] getConversations called with: { tenantId: 3522, userId: 18237, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3522
        AND cp.user_id = 18237
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 676 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "DELETE /api/v2/chat/conversations/300 HTTP/1.1" 200 135 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3522,
  userId: 18237,
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
        WHERE c.tenant_id = 3522
        AND cp.user_id = 18237
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "GET /api/v2/chat/conversations HTTP/1.1" 200 2892 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "GET /api/v2/chat/conversations/298 HTTP/1.1" 200 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "GET /api/v2/chat/conversations/99999 HTTP/1.1" 404 180 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "PUT /api/v2/chat/conversations/298 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "PUT /api/v2/chat/messages/1 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "DELETE /api/v2/chat/messages/1 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:00 +0000] "GET /api/v2/chat/search?q=test HTTP/1.1" 501 191 "-" "-"
PASS backend/src/routes/v2/chat/__tests__/chat-v2.test.ts
  Chat API v2
    GET /api/v2/chat/users
      ✓ should get available chat users (19 ms)
      ✓ should filter users by search term (9 ms)
      ✓ should return 401 without auth (3 ms)
    POST /api/v2/chat/conversations
      ✓ should create a new conversation (31 ms)
      ✓ should create a group conversation (27 ms)
      ✓ should return existing conversation for 1:1 chats (11 ms)
      ✓ should validate participant IDs (12 ms)
    GET /api/v2/chat/conversations
      ✓ should get user conversations (10 ms)
      ✓ should support pagination (10 ms)
      ✓ should filter by search (11 ms)
    POST /api/v2/chat/conversations/:id/messages
      ✓ should send a message (16 ms)
      ✓ should validate message content (5 ms)
      ✓ should prevent access to conversations user is not part of (16 ms)
    GET /api/v2/chat/conversations/:id/messages
      ✓ should get conversation messages (33 ms)
      ✓ should support pagination (31 ms)
    POST /api/v2/chat/conversations/:id/read
      ✓ should mark conversation as read (12 ms)
    GET /api/v2/chat/unread-count
      ✓ should get unread message count (17 ms)
    DELETE /api/v2/chat/conversations/:id
      ✓ should delete a conversation (33 ms)
    GET /api/v2/chat/conversations/:id
      ✓ should get conversation details (15 ms)
      ✓ should return 404 for non-existent conversation (7 ms)
    Not Implemented Endpoints
      ✓ PUT /api/v2/chat/conversations/:id should return 501 (5 ms)
      ✓ PUT /api/v2/chat/messages/:id should return 501 (5 ms)
      ✓ DELETE /api/v2/chat/messages/:id should return 501 (5 ms)
      ✓ GET /api/v2/chat/search should return 501 (5 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1632 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 400 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:02 +0000] "GET /api/v2/auth/verify HTTP/1.1" 200 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:02 +0000] "GET /api/v2/auth/verify HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:02 +0000] "GET /api/v2/auth/verify HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:02 +0000] "POST /api/v2/auth/refresh HTTP/1.1" 200 343 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:02 +0000] "POST /api/v2/auth/refresh HTTP/1.1" 401 183 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:02 +0000] "GET /api/v2/auth/me HTTP/1.1" 200 1146 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:02 +0000] "POST /api/auth/login HTTP/1.1" 401 107 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
PASS backend/src/routes/v2/auth/__tests__/auth-v2.test.ts
  Authentication API v2 Endpoints
    POST /api/v2/auth/login
      ✓ should return standardized success response with tokens (112 ms)
      ✓ should return standardized error for invalid credentials (85 ms)
      ✓ should validate required fields (5 ms)
    GET /api/v2/auth/verify
      ✓ should verify valid token (9 ms)
      ✓ should reject invalid token (5 ms)
      ✓ should reject missing token (4 ms)
    POST /api/v2/auth/refresh
      ✓ should refresh access token with valid refresh token (8 ms)
      ✓ should reject access token as refresh token (6 ms)
    GET /api/v2/auth/me
      ✓ should return current user with camelCase fields (10 ms)
    Deprecation Headers
      ✓ should include deprecation headers on v1 endpoints (18 ms)
      ✓ should NOT include deprecation headers on v2 endpoints (5 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1670 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:04 +0000] "POST /api/v2/users/18242/archive HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:04 +0000] "POST /api/v2/users/18242/archive HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:04 +0000] "GET /api/v2/users/18243 HTTP/1.1" 200 1101 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:04 +0000] "OPTIONS /api/v2/users/18244/archive HTTP/1.1" 204 0 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2-debug-archive.test.ts
  DEBUG: Users v2 Archive API
    ✓ should check archive endpoint validation (98 ms)
    ✓ should check if user exists before archive (103 ms)
    ✓ should check if route is registered (86 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1676 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1676 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:05 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2-simple.test.ts
  Calendar v2 API - Simple Debug Test
    ✓ should login admin user (116 ms)
    ✓ should access calendar endpoint with token (95 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1664 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2-debug.test.ts
  DEBUG Calendar v2 Test User Creation
    ✓ should debug user creation and login (205 ms)

::ffff:127.0.0.1 - - [31/Jul/2025:09:01:08 +0000] "GET /api/v2/users HTTP/1.1" 401 190 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2-simple.test.ts
  Users v2 API - Simple Test
    Basic Endpoint Test
      ✓ should return 401 without authentication (21 ms)

PASS backend/src/routes/v2/users/users.service.integration.test.ts
  UsersService Integration Tests
    createUser
      ✓ should create user successfully (181 ms)
      ✓ should throw error for duplicate email (15 ms)
    getUserById
      ✓ should return user when found (1 ms)
      ✓ should throw error when user not found (3 ms)
    updateUser
      ✓ should update user fields (8 ms)
    listUsers
      ✓ should return paginated users (3 ms)
      ✓ should filter by search term (1 ms)
    deleteUser
      ✓ should prevent self-deletion (2 ms)
      ✓ should delete user successfully (14 ms)

PASS backend/src/routes/v2/users/users.service.logic.test.ts
  UsersService Logic Tests
    ServiceError
      ✓ should create ServiceError with correct properties (2 ms)
      ✓ should use default status code 500 (1 ms)
      ✓ should include details when provided
    Error Code Constants
      ✓ should have proper error codes
    Business Logic Validation
      ✓ should validate pagination parameters (1 ms)
      ✓ should validate limit parameters
      ✓ should calculate pagination metadata
      ✓ should validate sort parameters (1 ms)
      ✓ should validate sort order (11 ms)
    Field Mapping Logic
      ✓ should map database fields to API fields (1 ms)
      ✓ should map API fields to database fields
    Password Validation
      ✓ should validate password requirements (1 ms)
    Email Validation
      ✓ should validate email format (1 ms)
    Employee Number Generation
      ✓ should generate employee number in correct format (1 ms)

PASS backend/src/routes/v2/users/users.service.simple.test.ts
  UsersService - Simple Test
    ServiceError
      ✓ should create ServiceError with correct properties (1 ms)
      ✓ should use default status code 500
      ✓ should include details when provided (1 ms)

PASS backend/src/routes/v2/calendar/calendar.service.logic.test.ts
  Calendar Service Business Logic
    Date Validation Logic
      ✓ should validate that end time is after start time (2 ms)
      ✓ should detect invalid date order
      ✓ should handle all-day events (1 ms)
    Organization Level Validation
      ✓ should require orgId for department events
      ✓ should require orgId for team events (1 ms)
      ✓ should not require orgId for personal events
      ✓ should not require orgId for company events
    Pagination Logic
      ✓ should calculate correct page values (1 ms)
      ✓ should handle invalid page numbers
      ✓ should limit maximum page size (1 ms)
      ✓ should calculate offset correctly
      ✓ should calculate total pages
      ✓ should determine hasNext correctly (1 ms)
      ✓ should determine hasPrev correctly
    Color Validation
      ✓ should validate hex color format
      ✓ should reject invalid color formats
    Recurrence Rule Logic
      ✓ should parse recurrence pattern (1 ms)
      ✓ should calculate interval days for patterns
      ✓ should parse COUNT option (1 ms)
      ✓ should parse UNTIL option
    Sort Field Mapping
      ✓ should map API field names to DB field names (1 ms)
      ✓ should default to start_date for invalid sort field
    Attendee Response Validation
      ✓ should validate attendee response values
      ✓ should reject invalid response values
    Permission Logic
      ✓ should allow owner to manage event
      ✓ should allow admin to manage any event (1 ms)
      ✓ should allow manager to manage any event
      ✓ should not allow non-owner employee to manage
    Export Format Logic
      ✓ should format CSV row correctly (1 ms)
      ✓ should escape CSV fields with quotes
      ✓ should format ICS date correctly (1 ms)
      ✓ should generate unique UID for ICS
    Time Calculation Logic
      ✓ should calculate event duration (1 ms)
      ✓ should handle weekday recurrence
      ✓ should calculate monthly recurrence
      ✓ should calculate yearly recurrence
    Filter Logic
      ✓ should map filter to event type (1 ms)
      ✓ should handle date range filtering
      ✓ should handle search term matching

PASS backend/src/routes/v2/calendar/calendar.service.simple.test.ts
  Calendar ServiceError
    Error Creation
      ✓ should create ServiceError with correct properties (1 ms)
      ✓ should create ServiceError with details (1 ms)
      ✓ should handle different error codes (5 ms)
    Error Type Checking
      ✓ should identify ServiceError correctly
      ✓ should handle null and undefined (1 ms)
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
      ✓ should validate ISO date format
      ✓ should detect invalid dates (1 ms)
      ✓ should validate organization levels
      ✓ should validate event status (1 ms)

PASS backend/src/utils/__tests__/errorHandler.test.ts
  errorHandler
    getErrorMessage
      ✓ should extract message from Error object (1 ms)
      ✓ should extract message from object with message property
      ✓ should convert string error to message
      ✓ should handle number error (1 ms)
      ✓ should handle null error
      ✓ should handle undefined error
      ✓ should handle MySQL error format
      ✓ should handle empty object (1 ms)
      ✓ should handle array error
      ✓ should handle boolean error
      ✓ should handle Error with empty message (1 ms)
      ✓ should NOT trim whitespace from error messages

Test Suites: 22 passed, 22 total
Tests:       403 passed, 403 total
Snapshots:   0 total
Time:        79.442 s, estimated 82 s
Ran all test suites.

🧹 Running global test cleanup...
✅ Global cleanup complete. Remaining test tenants: 0
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
scs@SOSCSPC1M16:~/projects/Assixx/docker$ docker exec assixx-backend pnpm test --runInBand

> assixx@1.0.0 test /app
> node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js --runInBand


🧹 Pre-test cleanup: Removing old test data...
✅ No leftover test data found
(node:1075) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
Entries in DB before test: 1 [
  { id: 3945, title: 'Test Entry', org_level: 'company', org_id: null }
]
Employee user info: { id: 18250, role: 'employee', department_id: null, tenant_id: 3528 }
Employee team info: No team assignment
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:35 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 766 "-" "-"
Response data length: 1
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:35 +0000] "GET /api/v2/blackboard/entries?status=archived HTTP/1.1" 200 774 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:36 +0000] "GET /api/v2/blackboard/entries?page=1&limit=5 HTTP/1.1" 200 765 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:36 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:37 +0000] "GET /api/v2/blackboard/entries/3950 HTTP/1.1" 200 716 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:37 +0000] "GET /api/v2/blackboard/entries/99999 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:38 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 752 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:38 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 400 221 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:39 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 400 445 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:39 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:40 +0000] "PUT /api/v2/blackboard/entries/3957 HTTP/1.1" 200 719 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:40 +0000] "PUT /api/v2/blackboard/entries/3958 HTTP/1.1" 200 713 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:41 +0000] "DELETE /api/v2/blackboard/entries/3959 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:41 +0000] "GET /api/v2/blackboard/entries/3959 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:41 +0000] "POST /api/v2/blackboard/entries/3960/archive HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:42 +0000] "POST /api/v2/blackboard/entries/3961/unarchive HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:42 +0000] "POST /api/v2/blackboard/entries/3962/confirm HTTP/1.1" 200 130 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:43 +0000] "POST /api/v2/blackboard/entries/3963/confirm HTTP/1.1" 200 130 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:43 +0000] "GET /api/v2/blackboard/entries/3963/confirmations HTTP/1.1" 200 7266 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:43 +0000] "GET /api/v2/blackboard/dashboard HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:44 +0000] "GET /api/v2/blackboard/dashboard?limit=2 HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:44 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 746 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:44 +0000] "GET /api/v2/blackboard/tags HTTP/1.1" 200 382 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:45 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:45 +0000] "GET /api/v2/blackboard/entries/3969 HTTP/1.1" 200 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:45 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 766 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:46 +0000] "GET /api/v2/blackboard/entries/3973 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1653 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:47 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 801 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:47 +0000] "POST /api/v2/blackboard/entries/3976/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:48 +0000] "POST /api/v2/blackboard/entries/3977/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:48 +0000] "GET /api/v2/blackboard/entries/3977/attachments HTTP/1.1" 200 418 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:48 +0000] "POST /api/v2/blackboard/entries/3978/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:48 +0000] "GET /api/v2/blackboard/entries/3978/attachments HTTP/1.1" 200 418 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:48 +0000] "DELETE /api/v2/blackboard/attachments/164 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:49 +0000] "POST /api/v2/blackboard/entries/3979/attachments HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:49 +0000] "GET /api/v2/blackboard/entries?priority=high HTTP/1.1" 200 797 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:50 +0000] "GET /api/v2/blackboard/entries?requiresConfirmation=true HTTP/1.1" 200 1397 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:50 +0000] "GET /api/v2/blackboard/entries?sortBy=priority&sortDir=DESC HTTP/1.1" 200 2636 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:51 +0000] "GET /api/v2/blackboard/entries?search=Urgent HTTP/1.1" 200 796 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:51 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:51 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:51 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 751 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:51 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:51 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:51 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 737 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
PASS backend/src/routes/v2/blackboard/__tests__/blackboard-v2.test.ts (21.604 s)
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:52 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 720 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:54 +0000] "POST /api/v2/shifts HTTP/1.1" 201 711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1679 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:54 +0000] "POST /api/v2/shifts HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:54 +0000] "GET /api/v2/shifts?date=2025-07-31 HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:55 +0000] "GET /api/v2/shifts/693 HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:55 +0000] "PUT /api/v2/shifts/694 HTTP/1.1" 200 693 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1707 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:56 +0000] "DELETE /api/v2/shifts/695 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:56 +0000] "POST /api/v2/shifts/templates HTTP/1.1" 201 334 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:56 +0000] "GET /api/v2/shifts/templates HTTP/1.1" 200 327 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:01:57 +0000] "PUT /api/v2/shifts/templates/267 HTTP/1.1" 200 328 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:00 +0000] "DELETE /api/v2/shifts/templates/268 HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1707 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:00 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 201 267 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:00 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 403 204 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:01 +0000] "GET /api/v2/shifts/swap-requests HTTP/1.1" 200 687 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:01 +0000] "PUT /api/v2/shifts/swap-requests/164/status HTTP/1.1" 200 136 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:02 +0000] "GET /api/v2/shifts/overtime?startDate=2025-01-01&endDate=2025-01-31 HTTP/1.1" 200 460 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:02 +0000] "GET /api/v2/shifts/overtime HTTP/1.1" 400 434 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:02 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31&format=csv HTTP/1.1" 200 215 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:03 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31&format=excel HTTP/1.1" 501 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:03 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31 HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:03 +0000] "POST /api/v2/shifts HTTP/1.1" 400 263 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:04 +0000] "POST /api/v2/shifts HTTP/1.1" 400 258 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:04 +0000] "POST /api/v2/shifts HTTP/1.1" 400 372 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:04 +0000] "GET /api/v2/shifts/703 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1679 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:05 +0000] "GET /api/v2/shifts/templates HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1707 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:05 +0000] "POST /api/v2/shifts HTTP/1.1" 201 690 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:06 +0000] "PUT /api/v2/shifts/templates/270 HTTP/1.1" 200 327 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
PASS backend/src/routes/v2/__tests__/shifts-v2.test.ts (14.233 s)
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:06 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 201 234 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:08 +0000] "GET /api/v2/kvp/categories HTTP/1.1" 200 251 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:08 +0000] "GET /api/v2/kvp/categories HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:08 +0000] "POST /api/v2/kvp HTTP/1.1" 201 941 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:09 +0000] "POST /api/v2/kvp HTTP/1.1" 400 572 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:09 +0000] "GET /api/v2/kvp?page=1&limit=10 HTTP/1.1" 200 2320 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:10 +0000] "GET /api/v2/kvp?status=new HTTP/1.1" 200 882 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:10 +0000] "GET /api/v2/kvp HTTP/1.1" 200 1604 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:10 +0000] "GET /api/v2/kvp/2441 HTTP/1.1" 200 823 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:11 +0000] "GET /api/v2/kvp/99999 HTTP/1.1" 404 178 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1690 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:11 +0000] "PUT /api/v2/kvp/2443 HTTP/1.1" 200 839 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:11 +0000] "PUT /api/v2/kvp/2444 HTTP/1.1" 200 842 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:12 +0000] "PUT /api/v2/kvp/2446 HTTP/1.1" 404 178 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:12 +0000] "DELETE /api/v2/kvp/2447 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:13 +0000] "POST /api/v2/kvp/2448/comments HTTP/1.1" 201 227 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:13 +0000] "GET /api/v2/kvp/2449/comments HTTP/1.1" 200 493 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1685 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:13 +0000] "GET /api/v2/kvp/2450/comments HTTP/1.1" 200 292 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:14 +0000] "GET /api/v2/kvp/dashboard/stats HTTP/1.1" 200 211 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:14 +0000] "POST /api/v2/kvp/points/award HTTP/1.1" 201 264 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:14 +0000] "POST /api/v2/kvp/points/award HTTP/1.1" 403 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:15 +0000] "GET /api/v2/kvp/points/user/18417 HTTP/1.1" 200 146 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:15 +0000] "GET /api/v2/kvp/points/user/18418 HTTP/1.1" 403 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
PASS backend/src/routes/v2/__tests__/kvp-v2.test.ts (9.204 s)
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:15 +0000] "GET /api/v2/kvp/2461/attachments HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:17 +0000] "POST /api/v2/surveys HTTP/1.1" 201 600 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:17 +0000] "POST /api/v2/surveys HTTP/1.1" 403 188 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1708 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:18 +0000] "POST /api/v2/surveys HTTP/1.1" 400 315 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:18 +0000] "GET /api/v2/surveys HTTP/1.1" 200 657 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:18 +0000] "GET /api/v2/surveys/316 HTTP/1.1" 200 731 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:19 +0000] "GET /api/v2/surveys/99999 HTTP/1.1" 404 174 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:19 +0000] "PUT /api/v2/surveys/318 HTTP/1.1" 200 581 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:19 +0000] "PUT /api/v2/surveys/319 HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:20 +0000] "DELETE /api/v2/surveys/320 HTTP/1.1" 200 129 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:20 +0000] "DELETE /api/v2/surveys/321 HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:21 +0000] "GET /api/v2/surveys/322 HTTP/1.1" 404 174 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
PASS backend/src/routes/v2/__tests__/surveys-v2.test.ts (5.705 s)
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:21 +0000] "GET /api/v2/surveys HTTP/1.1" 200 165 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1672 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1700 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1663 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1716 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams HTTP/1.1" 200 585 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams?departmentId=1697 HTTP/1.1" 200 585 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams?search=Team%201 HTTP/1.1" 200 337 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams?includeMembers=true HTTP/1.1" 200 617 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams/1234 HTTP/1.1" 200 782 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams/1234 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams/1234 HTTP/1.1" 200 348 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/teams HTTP/1.1" 201 360 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/teams HTTP/1.1" 409 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/teams HTTP/1.1" 400 309 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/teams HTTP/1.1" 400 181 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/teams HTTP/1.1" 400 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/teams HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/teams HTTP/1.1" 201 341 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "PUT /api/v2/teams/1234 HTTP/1.1" 200 363 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "PUT /api/v2/teams/1234 HTTP/1.1" 200 345 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "PUT /api/v2/teams/1234 HTTP/1.1" 409 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "PUT /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "PUT /api/v2/teams/1234 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "PUT /api/v2/teams/1234 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "DELETE /api/v2/teams/1238 HTTP/1.1" 200 127 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams/1238 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "DELETE /api/v2/teams/1239 HTTP/1.1" 400 219 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "DELETE /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "DELETE /api/v2/teams/1241 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "DELETE /api/v2/teams/1242 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams/1234/members HTTP/1.1" 200 524 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams/1235/members HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams/1234/members HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams/1234/members HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/teams/1234/members HTTP/1.1" 201 132 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams/1234/members HTTP/1.1" 200 311 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/teams/1234/members HTTP/1.1" 409 194 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/teams/1234/members HTTP/1.1" 400 175 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/teams/1234/members HTTP/1.1" 400 175 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "POST /api/v2/teams/1234/members HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "DELETE /api/v2/teams/1234/members/18449 HTTP/1.1" 200 134 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:23 +0000] "GET /api/v2/teams/1234/members HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:24 +0000] "DELETE /api/v2/teams/1234/members/18450 HTTP/1.1" 400 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:24 +0000] "DELETE /api/v2/teams/99999/members/18449 HTTP/1.1" 404 172 "-" "-"
PASS backend/src/routes/v2/teams/__tests__/teams-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:24 +0000] "DELETE /api/v2/teams/1234/members/18449 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:24 +0000] "DELETE /api/v2/teams/1234/members/18449 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:24 +0000] "POST /api/v2/teams HTTP/1.1" 400 258 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:24 +0000] "POST /api/v2/teams HTTP/1.1" 400 271 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:24 +0000] "GET /api/v2/teams?search=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa HTTP/1.1" 400 262 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:24 +0000] "GET /api/v2/teams/not-a-number HTTP/1.1" 400 256 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:24 +0000] "POST /api/v2/teams HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:24 +0000] "POST /api/v2/teams HTTP/1.1" 201 315 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1652 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1106 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "GET /api/v2/users/me HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1106 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "GET /api/v2/users?page=1&limit=10 HTTP/1.1" 200 1294 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "GET /api/v2/users?role=admin HTTP/1.1" 200 723 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "GET /api/v2/users?search=Admin HTTP/1.1" 200 723 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "GET /api/v2/users HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "POST /api/v2/users HTTP/1.1" 201 1152 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "POST /api/v2/users HTTP/1.1" 400 463 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "POST /api/v2/users HTTP/1.1" 409 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "PUT /api/v2/users/18455 HTTP/1.1" 200 1131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:25 +0000] "PUT /api/v2/users/18456 HTTP/1.1" 200 1115 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1720 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "POST /api/v2/users/18457/archive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "GET /api/v2/users/18457 HTTP/1.1" 200 1116 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "POST /api/v2/users/18458/archive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "POST /api/v2/users/18458/unarchive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "GET /api/v2/users/18458 HTTP/1.1" 200 1117 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 400 253 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "GET /api/v2/users/me/profile-picture HTTP/1.1" 200 15 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "DELETE /api/v2/users/me/profile-picture HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "GET /api/v2/users/me/profile-picture HTTP/1.1" 404 183 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "PUT /api/v2/users/18459/availability HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:26 +0000] "PUT /api/v2/users/18460/availability HTTP/1.1" 400 261 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:27 +0000] "GET /api/v2/users/18452 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:27 +0000] "GET /api/v2/users HTTP/1.1" 200 721 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1669 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1698 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "GET /api/v2/calendar/events HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 1310 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "GET /api/v2/calendar/events?page=1&limit=1 HTTP/1.1" 200 754 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "GET /api/v2/calendar/events?status=cancelled HTTP/1.1" 200 750 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "GET /api/v2/calendar/events?search=Team HTTP/1.1" 200 756 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "GET /api/v2/calendar/events HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "POST /api/v2/calendar/events HTTP/1.1" 201 981 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "POST /api/v2/calendar/events HTTP/1.1" 201 1511 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 641 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 260 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 278 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:28 +0000] "GET /api/v2/calendar/events/3415 HTTP/1.1" 200 1184 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "GET /api/v2/calendar/events/99999 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "GET /api/v2/calendar/events/3418 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "PUT /api/v2/calendar/events/3419 HTTP/1.1" 200 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "PUT /api/v2/calendar/events/3420 HTTP/1.1" 200 671 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "PUT /api/v2/calendar/events/3421 HTTP/1.1" 403 153 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "PUT /api/v2/calendar/events/3422 HTTP/1.1" 400 260 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "DELETE /api/v2/calendar/events/3423 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "GET /api/v2/calendar/events/3423 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "DELETE /api/v2/calendar/events/3424 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "DELETE /api/v2/calendar/events/3425 HTTP/1.1" 403 153 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "PUT /api/v2/calendar/events/3426/attendees/response HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "GET /api/v2/calendar/events/3426 HTTP/1.1" 200 1212 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "PUT /api/v2/calendar/events/3427/attendees/response HTTP/1.1" 400 254 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1663 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "PUT /api/v2/calendar/events/3428/attendees/response HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "GET /api/v2/calendar/export?format=ics HTTP/1.1" 200 493 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "GET /api/v2/calendar/export?format=csv HTTP/1.1" 200 261 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "GET /api/v2/calendar/export?format=invalid HTTP/1.1" 400 263 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "GET /api/v2/calendar/export HTTP/1.1" 400 308 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "GET /api/v2/calendar/events/3438 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:29 +0000] "PUT /api/v2/calendar/events/3439 HTTP/1.1" 404 122 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:32 +0000] "DELETE /api/v2/calendar/events/3440 HTTP/1.1" 404 122 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2.test.ts (5.567 s)
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1719 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 201 635 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 500 35 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 201 658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 201 666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 201 626 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 201 636 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 201 641 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents HTTP/1.1" 200 4128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents?category=personal HTTP/1.1" 200 801 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents?recipientType=team HTTP/1.1" 200 1490 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents HTTP/1.1" 200 4638 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents?page=1&limit=2 HTTP/1.1" 200 1460 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents?search=team HTTP/1.1" 200 1490 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 201 673 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents/1077 HTTP/1.1" 200 673 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents/99999 HTTP/1.1" 404 176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 201 631 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents/1078 HTTP/1.1" 403 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 201 656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "PUT /api/v2/documents/1079 HTTP/1.1" 200 667 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "PUT /api/v2/documents/1079 HTTP/1.1" 200 636 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "PUT /api/v2/documents/1079 HTTP/1.1" 403 207 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 201 638 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "DELETE /api/v2/documents/1080 HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents/1080 HTTP/1.1" 404 176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 201 638 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "DELETE /api/v2/documents/1081 HTTP/1.1" 403 198 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 201 643 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents/1082/archive HTTP/1.1" 200 132 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents?isArchived=true HTTP/1.1" 200 820 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents/1082/unarchive HTTP/1.1" 200 134 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 201 647 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents/1083/download HTTP/1.1" 200 11 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents/1083/preview HTTP/1.1" 200 11 "-" "-"
PASS backend/src/routes/v2/documents/__tests__/documents-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents/stats HTTP/1.1" 200 200 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "GET /api/v2/documents/stats HTTP/1.1" 200 199 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 400 424 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 400 244 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:34 +0000] "POST /api/v2/documents HTTP/1.1" 400 203 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "GET /api/v2/departments HTTP/1.1" 200 672 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "GET /api/v2/departments?includeExtended=false HTTP/1.1" 200 522 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "GET /api/v2/departments HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "GET /api/v2/departments HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "GET /api/v2/departments/stats HTTP/1.1" 200 125 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "GET /api/v2/departments/stats HTTP/1.1" 200 125 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "GET /api/v2/departments/1700 HTTP/1.1" 200 406 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "GET /api/v2/departments/99999 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "GET /api/v2/departments/invalid HTTP/1.1" 400 178 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "GET /api/v2/departments/1700 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "POST /api/v2/departments HTTP/1.1" 201 422 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "POST /api/v2/departments HTTP/1.1" 201 359 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "POST /api/v2/departments HTTP/1.1" 403 201 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "POST /api/v2/departments HTTP/1.1" 400 192 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "POST /api/v2/departments HTTP/1.1" 400 187 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "PUT /api/v2/departments/1701 HTTP/1.1" 200 427 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "PUT /api/v2/departments/1700 HTTP/1.1" 403 201 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:36 +0000] "PUT /api/v2/departments/1700 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:37 +0000] "PUT /api/v2/departments/1700 HTTP/1.1" 400 174 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:37 +0000] "POST /api/v2/departments HTTP/1.1" 201 354 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:37 +0000] "DELETE /api/v2/departments/1706 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:37 +0000] "DELETE /api/v2/departments/1700 HTTP/1.1" 400 227 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:37 +0000] "DELETE /api/v2/departments/1701 HTTP/1.1" 403 201 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:37 +0000] "GET /api/v2/departments/1700/members HTTP/1.1" 200 589 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:37 +0000] "GET /api/v2/departments/1701/members HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:37 +0000] "GET /api/v2/departments/1700/members HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:37 +0000] "GET /api/v2/departments HTTP/1.1" 200 748 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:37 +0000] "POST /api/v2/departments HTTP/1.1" 400 184 "-" "-"
PASS backend/src/routes/v2/departments/__tests__/departments-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1655 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
Created conversation 1 with ID: 303
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "GET /api/v2/chat/users HTTP/1.1" 200 664 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "GET /api/v2/chat/users?search=chat_employee_test HTTP/1.1" 200 385 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "GET /api/v2/chat/users HTTP/1.1" 401 190 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3548,
  creatorId: 18477,
  data: {
    participantIds: [ 18479 ],
    name: 'New Test 1:1 Chat',
    isGroup: undefined
  }
}
[Chat Service] Creating new conversation with isGroup: false
[Chat Service] Created conversation with ID: 305
[Chat Service] getConversations called with: { tenantId: 3548, userId: 18477, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3548
        AND cp.user_id = 18477
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 676 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3548,
  creatorId: 18477,
  data: {
    participantIds: [ 18478, 18479 ],
    name: 'Test Group Chat',
    isGroup: undefined
  }
}
[Chat Service] Creating new conversation with isGroup: true
[Chat Service] Created conversation with ID: 306
[Chat Service] getConversations called with: { tenantId: 3548, userId: 18477, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3548
        AND cp.user_id = 18477
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 869 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3548,
  creatorId: 18477,
  data: {
    participantIds: [ 18478 ],
    name: 'Another attempt',
    isGroup: undefined
  }
}
[Chat Service] getConversations called with: { tenantId: 3548, userId: 18477, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3548
        AND cp.user_id = 18477
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 400 270 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3548,
  userId: 18477,
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
        WHERE c.tenant_id = 3548
        AND cp.user_id = 18477
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "GET /api/v2/chat/conversations HTTP/1.1" 200 2889 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3548,
  userId: 18477,
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
        WHERE c.tenant_id = 3548
        AND cp.user_id = 18477
        ORDER BY c.created_at DESC
        LIMIT 5 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "GET /api/v2/chat/conversations?page=1&limit=5 HTTP/1.1" 200 2888 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3548,
  userId: 18477,
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
        WHERE c.tenant_id = 3548
        AND cp.user_id = 18477
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "GET /api/v2/chat/conversations?search=Test%20Group HTTP/1.1" 200 2889 "-" "-"
[Chat Controller] markAsRead called
[Chat Controller] markAsRead - conversationId: 303 userId: 18478
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations/303/messages HTTP/1.1" 201 421 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations/303/messages HTTP/1.1" 400 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations/307/messages HTTP/1.1" 403 170 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations/303/messages HTTP/1.1" 201 414 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations/303/messages HTTP/1.1" 201 420 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "GET /api/v2/chat/conversations/303/messages HTTP/1.1" 200 1486 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations/303/messages HTTP/1.1" 201 414 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations/303/messages HTTP/1.1" 201 420 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "GET /api/v2/chat/conversations/303/messages?page=1&limit=1 HTTP/1.1" 200 524 "-" "-"
Test conversationId: 303
Test authToken2: exists
[Chat Service] markConversationAsRead: { conversationId: 303, userId: 18478 }
[Chat Service] User is participant, getting unread messages
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations/303/read HTTP/1.1" 200 105 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations/303/messages HTTP/1.1" 201 419 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "GET /api/v2/chat/unread-count HTTP/1.1" 200 250 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3548,
  creatorId: 18477,
  data: {
    participantIds: [ 18479 ],
    name: 'To be deleted',
    isGroup: undefined
  }
}
[Chat Service] getConversations called with: { tenantId: 3548, userId: 18477, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3548
        AND cp.user_id = 18477
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:02:38 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 676 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:39 +0000] "DELETE /api/v2/chat/conversations/305 HTTP/1.1" 200 135 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3548,
  userId: 18477,
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
        WHERE c.tenant_id = 3548
        AND cp.user_id = 18477
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:02:39 +0000] "GET /api/v2/chat/conversations HTTP/1.1" 200 2892 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:39 +0000] "GET /api/v2/chat/conversations/303 HTTP/1.1" 200 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:39 +0000] "GET /api/v2/chat/conversations/99999 HTTP/1.1" 404 180 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:39 +0000] "PUT /api/v2/chat/conversations/303 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:39 +0000] "PUT /api/v2/chat/messages/1 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:39 +0000] "DELETE /api/v2/chat/messages/1 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:39 +0000] "GET /api/v2/chat/search?q=test HTTP/1.1" 501 191 "-" "-"
PASS backend/src/routes/v2/chat/__tests__/chat-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1632 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 400 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:40 +0000] "GET /api/v2/auth/verify HTTP/1.1" 200 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:40 +0000] "GET /api/v2/auth/verify HTTP/1.1" 401 186 "-" "-"
PASS backend/src/routes/v2/auth/__tests__/auth-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:40 +0000] "GET /api/v2/auth/verify HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:40 +0000] "POST /api/v2/auth/refresh HTTP/1.1" 200 343 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:40 +0000] "POST /api/v2/auth/refresh HTTP/1.1" 401 183 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:40 +0000] "GET /api/v2/auth/me HTTP/1.1" 200 1146 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:40 +0000] "POST /api/auth/login HTTP/1.1" 401 107 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:42 +0000] "POST /api/v2/users/18482/archive HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:42 +0000] "POST /api/v2/users/18482/archive HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:42 +0000] "GET /api/v2/users/18483 HTTP/1.1" 200 1101 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:42 +0000] "OPTIONS /api/v2/users/18484/archive HTTP/1.1" 204 0 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2-debug-archive.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1676 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1676 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:43 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2-simple.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1613 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1614 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1635 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 200 726 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 736 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 736 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "POST /api/v2/role-switch/to-original HTTP/1.1" 200 730 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 403 158 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "POST /api/v2/role-switch/to-original HTTP/1.1" 200 741 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 403 161 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 403 158 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 186 "-" "-"
PASS backend/src/routes/v2/role-switch/__tests__/role-switch-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 179 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:45 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 181 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2-debug.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1664 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:02:47 +0000] "GET /api/v2/users HTTP/1.1" 401 190 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2-simple.test.ts
PASS backend/src/routes/v2/users/users.service.integration.test.ts
PASS backend/src/routes/v2/users/users.service.logic.test.ts
PASS backend/src/routes/v2/users/users.service.simple.test.ts
PASS backend/src/routes/v2/calendar/calendar.service.logic.test.ts
PASS backend/src/routes/v2/calendar/calendar.service.simple.test.ts
PASS backend/src/utils/__tests__/errorHandler.test.ts

Test Suites: 22 passed, 22 total
Tests:       403 passed, 403 total
Snapshots:   0 total
Time:        77.741 s, estimated 80 s
Ran all test suites.

🧹 Running global test cleanup...
✅ Global cleanup complete. Remaining test tenants: 0
Jest did not exit one second after the test run has completed.

'This usually means that there are asynchronous operations that weren't stopped in your tests. Consider running Jest with `--detectOpenHandles` to troubleshoot this issue.
^Cscs@SOSCSPC1M16:~/projects/Assixx/docker$ docker exec assixx-backend pnpm test

> assixx@1.0.0 test /app
> node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js


🧹 Pre-test cleanup: Removing old test data...
✅ No leftover test data found
(node:1151) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
Entries in DB before test: 1 [
  { id: 4002, title: 'Test Entry', org_level: 'company', org_id: null }
]
Employee user info: { id: 18493, role: 'employee', department_id: null, tenant_id: 3555 }
Employee team info: No team assignment
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:10 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 766 "-" "-"
Response data length: 1
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:10 +0000] "GET /api/v2/blackboard/entries?status=archived HTTP/1.1" 200 774 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:11 +0000] "GET /api/v2/blackboard/entries?page=1&limit=5 HTTP/1.1" 200 765 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:11 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:12 +0000] "GET /api/v2/blackboard/entries/4007 HTTP/1.1" 200 716 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:12 +0000] "GET /api/v2/blackboard/entries/99999 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:13 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 752 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:13 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 400 221 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:13 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 400 445 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:14 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:14 +0000] "PUT /api/v2/blackboard/entries/4014 HTTP/1.1" 200 719 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:15 +0000] "PUT /api/v2/blackboard/entries/4015 HTTP/1.1" 200 713 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:15 +0000] "DELETE /api/v2/blackboard/entries/4016 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:15 +0000] "GET /api/v2/blackboard/entries/4016 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:16 +0000] "POST /api/v2/blackboard/entries/4017/archive HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:16 +0000] "POST /api/v2/blackboard/entries/4018/unarchive HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:17 +0000] "POST /api/v2/blackboard/entries/4019/confirm HTTP/1.1" 200 130 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:17 +0000] "POST /api/v2/blackboard/entries/4020/confirm HTTP/1.1" 200 130 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:17 +0000] "GET /api/v2/blackboard/entries/4020/confirmations HTTP/1.1" 200 7258 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:18 +0000] "GET /api/v2/blackboard/dashboard HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:18 +0000] "GET /api/v2/blackboard/dashboard?limit=2 HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:19 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:19 +0000] "GET /api/v2/blackboard/tags HTTP/1.1" 200 382 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:19 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:19 +0000] "GET /api/v2/blackboard/entries/4026 HTTP/1.1" 200 747 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:20 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 766 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:21 +0000] "GET /api/v2/blackboard/entries/4030 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:21 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 802 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:22 +0000] "POST /api/v2/blackboard/entries/4033/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:22 +0000] "POST /api/v2/blackboard/entries/4034/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:22 +0000] "GET /api/v2/blackboard/entries/4034/attachments HTTP/1.1" 200 416 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:23 +0000] "POST /api/v2/blackboard/entries/4035/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:23 +0000] "GET /api/v2/blackboard/entries/4035/attachments HTTP/1.1" 200 416 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:23 +0000] "DELETE /api/v2/blackboard/attachments/167 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:23 +0000] "POST /api/v2/blackboard/entries/4036/attachments HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:24 +0000] "GET /api/v2/blackboard/entries?priority=high HTTP/1.1" 200 797 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:24 +0000] "GET /api/v2/blackboard/entries?requiresConfirmation=true HTTP/1.1" 200 1397 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:25 +0000] "GET /api/v2/blackboard/entries?sortBy=priority&sortDir=DESC HTTP/1.1" 200 2636 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:25 +0000] "GET /api/v2/blackboard/entries?search=Urgent HTTP/1.1" 200 797 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:26 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 751 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:26 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 736 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
PASS backend/src/routes/v2/blackboard/__tests__/blackboard-v2.test.ts (21.366 s)
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:27 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 719 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1707 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:28 +0000] "POST /api/v2/shifts HTTP/1.1" 201 710 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:29 +0000] "POST /api/v2/shifts HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:29 +0000] "GET /api/v2/shifts?date=2025-07-31 HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:29 +0000] "GET /api/v2/shifts/708 HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1679 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:30 +0000] "PUT /api/v2/shifts/709 HTTP/1.1" 200 693 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:30 +0000] "DELETE /api/v2/shifts/710 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:30 +0000] "POST /api/v2/shifts/templates HTTP/1.1" 201 334 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1679 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:31 +0000] "GET /api/v2/shifts/templates HTTP/1.1" 200 327 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:31 +0000] "PUT /api/v2/shifts/templates/273 HTTP/1.1" 200 328 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:31 +0000] "DELETE /api/v2/shifts/templates/274 HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:32 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 201 267 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1679 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:32 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 403 204 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:33 +0000] "GET /api/v2/shifts/swap-requests HTTP/1.1" 200 687 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:33 +0000] "PUT /api/v2/shifts/swap-requests/168/status HTTP/1.1" 200 136 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:33 +0000] "GET /api/v2/shifts/overtime?startDate=2025-01-01&endDate=2025-01-31 HTTP/1.1" 200 460 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:34 +0000] "GET /api/v2/shifts/overtime HTTP/1.1" 400 434 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:34 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31&format=csv HTTP/1.1" 200 215 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:34 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31&format=excel HTTP/1.1" 501 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:35 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:35 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31 HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1679 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:38 +0000] "POST /api/v2/shifts HTTP/1.1" 400 263 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:38 +0000] "POST /api/v2/shifts HTTP/1.1" 400 258 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:39 +0000] "POST /api/v2/shifts HTTP/1.1" 400 372 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1651 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:39 +0000] "GET /api/v2/shifts/718 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:39 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1707 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:40 +0000] "GET /api/v2/shifts/templates HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:40 +0000] "POST /api/v2/shifts HTTP/1.1" 201 691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:40 +0000] "PUT /api/v2/shifts/templates/276 HTTP/1.1" 200 327 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
PASS backend/src/routes/v2/__tests__/shifts-v2.test.ts (14.239 s)
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:41 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 201 234 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:43 +0000] "GET /api/v2/kvp/categories HTTP/1.1" 200 251 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:43 +0000] "GET /api/v2/kvp/categories HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:43 +0000] "POST /api/v2/kvp HTTP/1.1" 201 941 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1690 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:44 +0000] "POST /api/v2/kvp HTTP/1.1" 400 572 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:44 +0000] "GET /api/v2/kvp?page=1&limit=10 HTTP/1.1" 200 2320 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:44 +0000] "GET /api/v2/kvp?status=new HTTP/1.1" 200 882 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:45 +0000] "GET /api/v2/kvp HTTP/1.1" 200 1604 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:45 +0000] "GET /api/v2/kvp/2472 HTTP/1.1" 200 823 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:45 +0000] "GET /api/v2/kvp/99999 HTTP/1.1" 404 178 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:46 +0000] "PUT /api/v2/kvp/2474 HTTP/1.1" 200 840 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:46 +0000] "PUT /api/v2/kvp/2475 HTTP/1.1" 200 842 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:47 +0000] "PUT /api/v2/kvp/2477 HTTP/1.1" 404 178 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:47 +0000] "DELETE /api/v2/kvp/2478 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:47 +0000] "POST /api/v2/kvp/2479/comments HTTP/1.1" 201 227 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:48 +0000] "GET /api/v2/kvp/2480/comments HTTP/1.1" 200 493 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:48 +0000] "GET /api/v2/kvp/2481/comments HTTP/1.1" 200 292 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:48 +0000] "GET /api/v2/kvp/dashboard/stats HTTP/1.1" 200 211 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:49 +0000] "POST /api/v2/kvp/points/award HTTP/1.1" 201 264 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:49 +0000] "POST /api/v2/kvp/points/award HTTP/1.1" 403 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:50 +0000] "GET /api/v2/kvp/points/user/18660 HTTP/1.1" 200 146 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:50 +0000] "GET /api/v2/kvp/points/user/18661 HTTP/1.1" 403 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
PASS backend/src/routes/v2/__tests__/kvp-v2.test.ts (9.436 s)
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:50 +0000] "GET /api/v2/kvp/2492/attachments HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:52 +0000] "POST /api/v2/surveys HTTP/1.1" 201 600 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1712 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:52 +0000] "POST /api/v2/surveys HTTP/1.1" 403 188 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:52 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:53 +0000] "POST /api/v2/surveys HTTP/1.1" 400 315 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:53 +0000] "GET /api/v2/surveys HTTP/1.1" 200 657 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:53 +0000] "GET /api/v2/surveys/326 HTTP/1.1" 200 731 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:54 +0000] "GET /api/v2/surveys/99999 HTTP/1.1" 404 174 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:54 +0000] "PUT /api/v2/surveys/328 HTTP/1.1" 200 581 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:54 +0000] "PUT /api/v2/surveys/329 HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:55 +0000] "DELETE /api/v2/surveys/330 HTTP/1.1" 200 129 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:55 +0000] "DELETE /api/v2/surveys/331 HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:56 +0000] "GET /api/v2/surveys/332 HTTP/1.1" 404 174 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
PASS backend/src/routes/v2/__tests__/surveys-v2.test.ts (5.822 s)
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:56 +0000] "GET /api/v2/surveys HTTP/1.1" 200 165 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1669 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1698 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "GET /api/v2/calendar/events HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 1310 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "GET /api/v2/calendar/events?page=1&limit=1 HTTP/1.1" 200 754 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "GET /api/v2/calendar/events?status=cancelled HTTP/1.1" 200 750 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "GET /api/v2/calendar/events?search=Team HTTP/1.1" 200 756 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "GET /api/v2/calendar/events HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "POST /api/v2/calendar/events HTTP/1.1" 201 981 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "POST /api/v2/calendar/events HTTP/1.1" 201 1511 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 641 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 260 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 278 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "GET /api/v2/calendar/events/3454 HTTP/1.1" 200 1184 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "GET /api/v2/calendar/events/99999 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "GET /api/v2/calendar/events/3457 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "PUT /api/v2/calendar/events/3458 HTTP/1.1" 200 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "PUT /api/v2/calendar/events/3459 HTTP/1.1" 200 671 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "PUT /api/v2/calendar/events/3460 HTTP/1.1" 403 153 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "PUT /api/v2/calendar/events/3461 HTTP/1.1" 400 260 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "DELETE /api/v2/calendar/events/3462 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "GET /api/v2/calendar/events/3462 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "DELETE /api/v2/calendar/events/3463 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "DELETE /api/v2/calendar/events/3464 HTTP/1.1" 403 153 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "PUT /api/v2/calendar/events/3465/attendees/response HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "GET /api/v2/calendar/events/3465 HTTP/1.1" 200 1212 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "PUT /api/v2/calendar/events/3466/attendees/response HTTP/1.1" 400 254 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1663 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:58 +0000] "PUT /api/v2/calendar/events/3467/attendees/response HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:59 +0000] "GET /api/v2/calendar/export?format=ics HTTP/1.1" 200 493 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:59 +0000] "GET /api/v2/calendar/export?format=csv HTTP/1.1" 200 261 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:59 +0000] "GET /api/v2/calendar/export?format=invalid HTTP/1.1" 400 263 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:59 +0000] "GET /api/v2/calendar/export HTTP/1.1" 400 308 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:59 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:59 +0000] "GET /api/v2/calendar/events/3477 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:59 +0000] "PUT /api/v2/calendar/events/3478 HTTP/1.1" 404 122 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:03:59 +0000] "DELETE /api/v2/calendar/events/3479 HTTP/1.1" 404 122 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1652 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1106 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "GET /api/v2/users/me HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1106 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "GET /api/v2/users?page=1&limit=10 HTTP/1.1" 200 1294 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "GET /api/v2/users?role=admin HTTP/1.1" 200 723 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "GET /api/v2/users?search=Admin HTTP/1.1" 200 723 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "GET /api/v2/users HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "POST /api/v2/users HTTP/1.1" 201 1152 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "POST /api/v2/users HTTP/1.1" 400 463 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "POST /api/v2/users HTTP/1.1" 409 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "PUT /api/v2/users/18702 HTTP/1.1" 200 1131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "PUT /api/v2/users/18703 HTTP/1.1" 200 1115 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1720 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "POST /api/v2/users/18704/archive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "GET /api/v2/users/18704 HTTP/1.1" 200 1116 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "POST /api/v2/users/18705/archive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "POST /api/v2/users/18705/unarchive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:01 +0000] "GET /api/v2/users/18705 HTTP/1.1" 200 1117 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 400 253 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "GET /api/v2/users/me/profile-picture HTTP/1.1" 200 15 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1175 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "DELETE /api/v2/users/me/profile-picture HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "GET /api/v2/users/me/profile-picture HTTP/1.1" 404 183 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "PUT /api/v2/users/18706/availability HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "PUT /api/v2/users/18707/availability HTTP/1.1" 400 261 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "GET /api/v2/users/18699 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:02 +0000] "GET /api/v2/users HTTP/1.1" 200 721 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1672 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1695 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1663 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1716 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "GET /api/v2/teams HTTP/1.1" 200 585 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "GET /api/v2/teams?departmentId=1714 HTTP/1.1" 200 585 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "GET /api/v2/teams?search=Team%201 HTTP/1.1" 200 337 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "GET /api/v2/teams?includeMembers=true HTTP/1.1" 200 617 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "GET /api/v2/teams HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "GET /api/v2/teams HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "GET /api/v2/teams/1248 HTTP/1.1" 200 780 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "GET /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "GET /api/v2/teams/1248 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "GET /api/v2/teams/1248 HTTP/1.1" 200 348 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "POST /api/v2/teams HTTP/1.1" 201 360 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "POST /api/v2/teams HTTP/1.1" 409 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "POST /api/v2/teams HTTP/1.1" 400 309 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "POST /api/v2/teams HTTP/1.1" 400 181 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "POST /api/v2/teams HTTP/1.1" 400 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "POST /api/v2/teams HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "POST /api/v2/teams HTTP/1.1" 201 341 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "PUT /api/v2/teams/1248 HTTP/1.1" 200 363 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "PUT /api/v2/teams/1248 HTTP/1.1" 200 345 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "PUT /api/v2/teams/1248 HTTP/1.1" 409 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "PUT /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "PUT /api/v2/teams/1248 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "PUT /api/v2/teams/1248 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "DELETE /api/v2/teams/1252 HTTP/1.1" 200 127 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "GET /api/v2/teams/1252 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "DELETE /api/v2/teams/1253 HTTP/1.1" 400 219 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "DELETE /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "DELETE /api/v2/teams/1255 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:04 +0000] "DELETE /api/v2/teams/1256 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "GET /api/v2/teams/1248/members HTTP/1.1" 200 522 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "GET /api/v2/teams/1249/members HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "GET /api/v2/teams/1248/members HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "GET /api/v2/teams/1248/members HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "POST /api/v2/teams/1248/members HTTP/1.1" 201 132 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "GET /api/v2/teams/1248/members HTTP/1.1" 200 309 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "POST /api/v2/teams/1248/members HTTP/1.1" 409 194 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "POST /api/v2/teams/1248/members HTTP/1.1" 400 175 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "POST /api/v2/teams/1248/members HTTP/1.1" 400 175 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "POST /api/v2/teams/1248/members HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "DELETE /api/v2/teams/1248/members/18710 HTTP/1.1" 200 134 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "GET /api/v2/teams/1248/members HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "DELETE /api/v2/teams/1248/members/18711 HTTP/1.1" 400 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "DELETE /api/v2/teams/99999/members/18710 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "DELETE /api/v2/teams/1248/members/18710 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "DELETE /api/v2/teams/1248/members/18710 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "POST /api/v2/teams HTTP/1.1" 400 258 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "POST /api/v2/teams HTTP/1.1" 400 271 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "GET /api/v2/teams?search=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa HTTP/1.1" 400 262 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "GET /api/v2/teams/not-a-number HTTP/1.1" 400 256 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "POST /api/v2/teams HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:05 +0000] "POST /api/v2/teams HTTP/1.1" 201 315 "-" "-"
PASS backend/src/routes/v2/teams/__tests__/teams-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1723 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "POST /api/v2/documents HTTP/1.1" 201 635 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "POST /api/v2/documents HTTP/1.1" 500 35 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "POST /api/v2/documents HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "POST /api/v2/documents HTTP/1.1" 201 658 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "POST /api/v2/documents HTTP/1.1" 201 666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "POST /api/v2/documents HTTP/1.1" 201 626 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "POST /api/v2/documents HTTP/1.1" 201 636 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "POST /api/v2/documents HTTP/1.1" 201 641 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "GET /api/v2/documents HTTP/1.1" 200 4128 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "GET /api/v2/documents?category=personal HTTP/1.1" 200 801 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "GET /api/v2/documents?recipientType=team HTTP/1.1" 200 1490 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "GET /api/v2/documents HTTP/1.1" 200 4638 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "GET /api/v2/documents?page=1&limit=2 HTTP/1.1" 200 1460 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:06 +0000] "GET /api/v2/documents?search=team HTTP/1.1" 200 1490 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 673 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "GET /api/v2/documents/1090 HTTP/1.1" 200 673 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "GET /api/v2/documents/99999 HTTP/1.1" 404 176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 631 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "GET /api/v2/documents/1091 HTTP/1.1" 403 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "PUT /api/v2/documents/1092 HTTP/1.1" 200 667 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "PUT /api/v2/documents/1092 HTTP/1.1" 200 636 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "PUT /api/v2/documents/1092 HTTP/1.1" 403 207 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 638 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "DELETE /api/v2/documents/1093 HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "GET /api/v2/documents/1093 HTTP/1.1" 404 176 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 638 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "DELETE /api/v2/documents/1094 HTTP/1.1" 403 198 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 643 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "POST /api/v2/documents/1095/archive HTTP/1.1" 200 132 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "GET /api/v2/documents?isArchived=true HTTP/1.1" 200 820 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "POST /api/v2/documents/1095/unarchive HTTP/1.1" 200 134 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "POST /api/v2/documents HTTP/1.1" 201 647 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "GET /api/v2/documents/1096/download HTTP/1.1" 200 11 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "GET /api/v2/documents/1096/preview HTTP/1.1" 200 11 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "GET /api/v2/documents/stats HTTP/1.1" 200 200 "-" "-"
PASS backend/src/routes/v2/documents/__tests__/documents-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "GET /api/v2/documents/stats HTTP/1.1" 200 199 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "POST /api/v2/documents HTTP/1.1" 400 424 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "POST /api/v2/documents HTTP/1.1" 400 244 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:07 +0000] "POST /api/v2/documents HTTP/1.1" 400 203 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1691 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments HTTP/1.1" 200 672 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments?includeExtended=false HTTP/1.1" 200 522 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments/stats HTTP/1.1" 200 125 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments/stats HTTP/1.1" 200 125 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments/1716 HTTP/1.1" 200 406 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments/99999 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments/invalid HTTP/1.1" 400 178 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments/1716 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "POST /api/v2/departments HTTP/1.1" 201 422 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "POST /api/v2/departments HTTP/1.1" 201 359 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "POST /api/v2/departments HTTP/1.1" 403 201 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "POST /api/v2/departments HTTP/1.1" 400 192 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "POST /api/v2/departments HTTP/1.1" 400 187 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "PUT /api/v2/departments/1717 HTTP/1.1" 200 427 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "PUT /api/v2/departments/1716 HTTP/1.1" 403 201 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "PUT /api/v2/departments/1716 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "PUT /api/v2/departments/1716 HTTP/1.1" 400 174 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "POST /api/v2/departments HTTP/1.1" 201 354 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "DELETE /api/v2/departments/1722 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "DELETE /api/v2/departments/1716 HTTP/1.1" 400 227 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "DELETE /api/v2/departments/1717 HTTP/1.1" 403 201 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments/1716/members HTTP/1.1" 200 589 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments/1717/members HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments/1716/members HTTP/1.1" 404 177 "-" "-"
PASS backend/src/routes/v2/departments/__tests__/departments-v2.test.ts (5.035 s)
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "GET /api/v2/departments HTTP/1.1" 200 748 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:12 +0000] "POST /api/v2/departments HTTP/1.1" 400 184 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1655 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
Created conversation 1 with ID: 308
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "GET /api/v2/chat/users HTTP/1.1" 200 664 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "GET /api/v2/chat/users?search=chat_employee_test HTTP/1.1" 200 385 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "GET /api/v2/chat/users HTTP/1.1" 401 190 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3575,
  creatorId: 18720,
  data: {
    participantIds: [ 18722 ],
    name: 'New Test 1:1 Chat',
    isGroup: undefined
  }
}
[Chat Service] Creating new conversation with isGroup: false
[Chat Service] Created conversation with ID: 310
[Chat Service] getConversations called with: { tenantId: 3575, userId: 18720, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3575
        AND cp.user_id = 18720
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 676 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3575,
  creatorId: 18720,
  data: {
    participantIds: [ 18721, 18722 ],
    name: 'Test Group Chat',
    isGroup: undefined
  }
}
[Chat Service] Creating new conversation with isGroup: true
[Chat Service] Created conversation with ID: 311
[Chat Service] getConversations called with: { tenantId: 3575, userId: 18720, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3575
        AND cp.user_id = 18720
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 869 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3575,
  creatorId: 18720,
  data: {
    participantIds: [ 18721 ],
    name: 'Another attempt',
    isGroup: undefined
  }
}
[Chat Service] getConversations called with: { tenantId: 3575, userId: 18720, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3575
        AND cp.user_id = 18720
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 400 270 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3575,
  userId: 18720,
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
        WHERE c.tenant_id = 3575
        AND cp.user_id = 18720
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "GET /api/v2/chat/conversations HTTP/1.1" 200 2889 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3575,
  userId: 18720,
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
        WHERE c.tenant_id = 3575
        AND cp.user_id = 18720
        ORDER BY c.created_at DESC
        LIMIT 5 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "GET /api/v2/chat/conversations?page=1&limit=5 HTTP/1.1" 200 2888 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3575,
  userId: 18720,
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
        WHERE c.tenant_id = 3575
        AND cp.user_id = 18720
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "GET /api/v2/chat/conversations?search=Test%20Group HTTP/1.1" 200 2889 "-" "-"
[Chat Controller] markAsRead called
[Chat Controller] markAsRead - conversationId: 308 userId: 18721
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations/308/messages HTTP/1.1" 201 421 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations/308/messages HTTP/1.1" 400 206 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations/312/messages HTTP/1.1" 403 170 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations/308/messages HTTP/1.1" 201 414 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations/308/messages HTTP/1.1" 201 420 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "GET /api/v2/chat/conversations/308/messages HTTP/1.1" 200 1486 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations/308/messages HTTP/1.1" 201 414 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations/308/messages HTTP/1.1" 201 420 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "GET /api/v2/chat/conversations/308/messages?page=1&limit=1 HTTP/1.1" 200 524 "-" "-"
Test conversationId: 308
Test authToken2: exists
[Chat Service] markConversationAsRead: { conversationId: 308, userId: 18721 }
[Chat Service] User is participant, getting unread messages
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations/308/read HTTP/1.1" 200 105 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations/308/messages HTTP/1.1" 201 419 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "GET /api/v2/chat/unread-count HTTP/1.1" 200 250 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 3575,
  creatorId: 18720,
  data: {
    participantIds: [ 18722 ],
    name: 'To be deleted',
    isGroup: undefined
  }
}
[Chat Service] getConversations called with: { tenantId: 3575, userId: 18720, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 3575
        AND cp.user_id = 18720
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 676 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "DELETE /api/v2/chat/conversations/310 HTTP/1.1" 200 135 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 3575,
  userId: 18720,
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
        WHERE c.tenant_id = 3575
        AND cp.user_id = 18720
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "GET /api/v2/chat/conversations HTTP/1.1" 200 2892 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "GET /api/v2/chat/conversations/308 HTTP/1.1" 200 678 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "GET /api/v2/chat/conversations/99999 HTTP/1.1" 404 180 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "PUT /api/v2/chat/conversations/308 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "PUT /api/v2/chat/messages/1 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "DELETE /api/v2/chat/messages/1 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:14 +0000] "GET /api/v2/chat/search?q=test HTTP/1.1" 501 191 "-" "-"
PASS backend/src/routes/v2/chat/__tests__/chat-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:15 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:15 +0000] "POST /api/v2/users/18724/archive HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:15 +0000] "POST /api/v2/users/18724/archive HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:16 +0000] "GET /api/v2/users/18725 HTTP/1.1" 200 1100 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:16 +0000] "OPTIONS /api/v2/users/18726/archive HTTP/1.1" 204 0 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2-debug-archive.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1672 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1672 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:17 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2-simple.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1627 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 400 196 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:19 +0000] "GET /api/v2/auth/verify HTTP/1.1" 200 192 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:19 +0000] "GET /api/v2/auth/verify HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:19 +0000] "GET /api/v2/auth/verify HTTP/1.1" 401 190 "-" "-"
PASS backend/src/routes/v2/auth/__tests__/auth-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:19 +0000] "POST /api/v2/auth/refresh HTTP/1.1" 200 342 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:19 +0000] "POST /api/v2/auth/refresh HTTP/1.1" 401 183 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:19 +0000] "GET /api/v2/auth/me HTTP/1.1" 200 1144 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:19 +0000] "POST /api/auth/login HTTP/1.1" 401 107 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1613 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1614 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1635 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 200 726 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 736 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 736 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/role-switch/to-original HTTP/1.1" 200 730 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 403 158 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/role-switch/to-original HTTP/1.1" 200 741 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 403 161 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 403 158 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 186 "-" "-"
PASS backend/src/routes/v2/role-switch/__tests__/role-switch-v2.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 179 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:20 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 181 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2-debug.test.ts
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1664 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
::ffff:127.0.0.1 - - [31/Jul/2025:09:04:23 +0000] "GET /api/v2/users HTTP/1.1" 401 190 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2-simple.test.ts
PASS backend/src/routes/v2/users/users.service.integration.test.ts
PASS backend/src/routes/v2/users/users.service.logic.test.ts
PASS backend/src/routes/v2/users/users.service.simple.test.ts
PASS backend/src/routes/v2/calendar/calendar.service.simple.test.ts
PASS backend/src/routes/v2/calendar/calendar.service.logic.test.ts
PASS backend/src/utils/__tests__/errorHandler.test.ts

Test Suites: 22 passed, 22 total
Tests:       403 passed, 403 total
Snapshots:   0 total
Time:        78.579 s
Ran all test suites.

🧹 Running global test cleanup...
✅ Global cleanup complete. Remaining test tenants: 0
Jest did not exit one second after the test run has completed.

'This usually means that there are asynchronous operations that weren't stopped in your tests. Consider running Jest with `--detectOpenHandles` to troubleshoot this issue.
^Cscs@SOSCSPC1M16:~/projects/Assixx/docker$ 
