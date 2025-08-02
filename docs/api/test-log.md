scs@SOSCSPC1M16:~/projects/Assixx/docker$docker exec assixx-backend pnpm test --verbose --forceExit

> assixx@1.0.0 test /app
> node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js --verbose --forceExit


🧹 Pre-test cleanup: Removing old test data...
✅ No leftover test data found
(node:2437) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
Entries in DB before test: 1 [
  { id: 5927, title: 'Test Entry', org_level: 'company', org_id: null }
]
Employee user info: { id: 30991, role: 'employee', department_id: null, tenant_id: 4980 }
Employee team info: No team assignment
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:54 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 765 "-" "-"
Response data length: 1
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:54 +0000] "GET /api/v2/blackboard/entries?status=archived HTTP/1.1" 200 774 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:55 +0000] "GET /api/v2/blackboard/entries?page=1&limit=5 HTTP/1.1" 200 765 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:55 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:56 +0000] "GET /api/v2/blackboard/entries/5932 HTTP/1.1" 200 716 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
error: Error getting blackboard entry: Entry not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Entry not found\n    at BlackboardService.getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:100:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:111:19)","statusCode":404,"timestamp":"2025-08-02 18:46:56"}
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:56 +0000] "GET /api/v2/blackboard/entries/99999 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:57 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 752 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
error: Error creating blackboard entry: Organization ID is required for department level entries {"code":"VALIDATION_ERROR","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Organization ID is required for department level entries\n    at BlackboardService.createEntry (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:115:13)\n    at createEntry (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:147:43)\n    at /app/backend/src/utils/routeHandlers.ts:31:12\n    at Layer.handleRequest (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/layer.js:152:17)\n    at next (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/route.js:157:13)\n    at handleValidationErrors (/app/backend/src/middleware/validation.ts:43:3)\n    at Layer.handleRequest (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/layer.js:152:17)\n    at next (/app/node_modules/.pnpm/router@2.2.0/node_modules/router/lib/route.js:157:13)\n    at middleware (/app/node_modules/.pnpm/express-validator@7.2.1/node_modules/express-validator/lib/middlewares/check.js:16:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)","statusCode":400,"timestamp":"2025-08-02 18:46:57"}
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:57 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 400 221 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1679 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:58 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 400 445 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:58 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:58 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:59 +0000] "PUT /api/v2/blackboard/entries/5939 HTTP/1.1" 200 719 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:59 +0000] "PUT /api/v2/blackboard/entries/5940 HTTP/1.1" 200 713 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:46:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:00 +0000] "DELETE /api/v2/blackboard/entries/5941 HTTP/1.1" 200 128 "-" "-"
error: Error getting blackboard entry: Entry not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Entry not found\n    at BlackboardService.getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:100:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:111:19)","statusCode":404,"timestamp":"2025-08-02 18:47:00"}
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:00 +0000] "GET /api/v2/blackboard/entries/5941 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:00 +0000] "POST /api/v2/blackboard/entries/5942/archive HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:01 +0000] "POST /api/v2/blackboard/entries/5943/unarchive HTTP/1.1" 200 768 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:01 +0000] "POST /api/v2/blackboard/entries/5944/confirm HTTP/1.1" 200 130 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:02 +0000] "POST /api/v2/blackboard/entries/5945/confirm HTTP/1.1" 200 130 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:02 +0000] "GET /api/v2/blackboard/entries/5945/confirmations HTTP/1.1" 200 7258 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:05 +0000] "GET /api/v2/blackboard/dashboard HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:05 +0000] "GET /api/v2/blackboard/dashboard?limit=2 HTTP/1.1" 200 691 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:06 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 747 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:06 +0000] "GET /api/v2/blackboard/tags HTTP/1.1" 200 382 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:06 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:06 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 747 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:06 +0000] "GET /api/v2/blackboard/entries/5951 HTTP/1.1" 200 747 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:07 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 766 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:07 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1653 "-" "-"
error: Error getting blackboard entry: Entry not found {"code":"NOT_FOUND","name":"ServiceError","service":"assixx-backend","stack":"ServiceError: Entry not found\n    at BlackboardService.getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.service.ts:100:13)\n    at processTicksAndRejections (node:internal/process/task_queues:95:5)\n    at getEntryById (/app/backend/src/routes/v2/blackboard/blackboard.controller.ts:111:19)","statusCode":404,"timestamp":"2025-08-02 18:47:08"}
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:08 +0000] "GET /api/v2/blackboard/entries/5955 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:08 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1653 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:08 +0000] "GET /api/v2/blackboard/entries HTTP/1.1" 200 801 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:09 +0000] "POST /api/v2/blackboard/entries/5958/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:09 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:09 +0000] "POST /api/v2/blackboard/entries/5959/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:09 +0000] "GET /api/v2/blackboard/entries/5959/attachments HTTP/1.1" 200 418 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:10 +0000] "POST /api/v2/blackboard/entries/5960/attachments HTTP/1.1" 201 140 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:10 +0000] "GET /api/v2/blackboard/entries/5960/attachments HTTP/1.1" 200 418 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:10 +0000] "DELETE /api/v2/blackboard/attachments/266 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:10 +0000] "POST /api/v2/blackboard/entries/5961/attachments HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:11 +0000] "GET /api/v2/blackboard/entries?priority=high HTTP/1.1" 200 797 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:11 +0000] "GET /api/v2/blackboard/entries?requiresConfirmation=true HTTP/1.1" 200 1399 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:12 +0000] "GET /api/v2/blackboard/entries?sortBy=priority&sortDir=DESC HTTP/1.1" 200 2636 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1656 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:12 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:12 +0000] "GET /api/v2/blackboard/entries?search=Urgent HTTP/1.1" 200 796 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:13 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 751 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:13 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 737 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:14 +0000] "POST /api/v2/blackboard/entries HTTP/1.1" 201 720 "-" "-"
PASS backend/src/routes/v2/blackboard/__tests__/blackboard-v2.test.ts (26.689 s)
  Blackboard API v2
    GET /api/v2/blackboard/entries
      ✓ should list all entries for authenticated user (523 ms)
      ✓ should filter entries by status (474 ms)
      ✓ should support pagination (479 ms)
      ✓ should return 401 without authentication (475 ms)
    GET /api/v2/blackboard/entries/:id
      ✓ should get a specific entry (490 ms)
      ✓ should return 404 for non-existent entry (483 ms)
    POST /api/v2/blackboard/entries
      ✓ should create a new entry as admin (518 ms)
      ✓ should require orgId for department level entries (477 ms)
      ✓ should validate required fields (473 ms)
      ✓ should reject creation from non-admin users (480 ms)
    PUT /api/v2/blackboard/entries/:id
      ✓ should update an entry as admin (507 ms)
      ✓ should allow partial updates (481 ms)
    DELETE /api/v2/blackboard/entries/:id
      ✓ should delete an entry as admin (475 ms)
    POST /api/v2/blackboard/entries/:id/archive
      ✓ should archive an entry (505 ms)
    POST /api/v2/blackboard/entries/:id/unarchive
      ✓ should unarchive an entry (520 ms)
    POST /api/v2/blackboard/entries/:id/confirm
      ✓ should confirm reading an entry (471 ms)
      ✓ should track confirmation status (-2586 ms)
    GET /api/v2/blackboard/dashboard
      ✓ should get dashboard entries (6271 ms)
      ✓ should limit dashboard entries (479 ms)
    Tags functionality
      ✓ should get all available tags (552 ms)
      ✓ should filter entries by tag (527 ms)
    Multi-tenant isolation
      ✓ should not see entries from other tenants (642 ms)
      ✓ should not access other tenant's entry directly (656 ms)
      ✓ should allow other tenant to see their own entries (649 ms)
    Attachments functionality
      ✓ should upload an attachment to an entry (509 ms)
      ✓ should get attachments for an entry (479 ms)
      ✓ should delete an attachment (496 ms)
      ✓ should require authentication for attachment operations (451 ms)
    Advanced filtering and sorting
      ✓ should filter by priority (546 ms)
      ✓ should filter by requiresConfirmation (475 ms)
      ✓ should sort entries (479 ms)
      ✓ should search entries by title and content (502 ms)
    Entry expiration
      ✓ should create entry with expiration date (470 ms)
    Department and Team level entries
      ✓ should create department level entry with orgId (480 ms)
      ✓ should create team level entry with orgId (466 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:47:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:16 +0000] "POST /api/v2/shifts HTTP/1.1" 201 712 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:16 +0000] "POST /api/v2/shifts HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:17 +0000] "GET /api/v2/shifts?date=2025-08-02 HTTP/1.1" 200 769 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:17 +0000] "GET /api/v2/shifts/4657 HTTP/1.1" 200 692 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:17 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:17 +0000] "PUT /api/v2/shifts/4658 HTTP/1.1" 200 694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:18 +0000] "DELETE /api/v2/shifts/4659 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:18 +0000] "POST /api/v2/shifts/templates HTTP/1.1" 201 334 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:18 +0000] "GET /api/v2/shifts/templates HTTP/1.1" 200 327 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1707 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:19 +0000] "PUT /api/v2/shifts/templates/477 HTTP/1.1" 200 328 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:19 +0000] "DELETE /api/v2/shifts/templates/478 HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:19 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:20 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 201 268 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:20 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 403 204 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:20 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:20 +0000] "GET /api/v2/shifts/swap-requests HTTP/1.1" 200 687 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:21 +0000] "PUT /api/v2/shifts/swap-requests/304/status HTTP/1.1" 200 136 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:21 +0000] "GET /api/v2/shifts/overtime?startDate=2025-01-01&endDate=2025-01-31 HTTP/1.1" 200 460 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1679 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:21 +0000] "GET /api/v2/shifts/overtime HTTP/1.1" 400 434 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:22 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31&format=csv HTTP/1.1" 200 215 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:22 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31&format=excel HTTP/1.1" 501 196 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:22 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:22 +0000] "GET /api/v2/shifts/export?startDate=2025-01-01&endDate=2025-01-31 HTTP/1.1" 403 206 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:23 +0000] "POST /api/v2/shifts HTTP/1.1" 400 263 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:23 +0000] "POST /api/v2/shifts HTTP/1.1" 400 258 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:23 +0000] "POST /api/v2/shifts HTTP/1.1" 400 372 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:24 +0000] "GET /api/v2/shifts/4667 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:24 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:25 +0000] "GET /api/v2/shifts/templates HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:25 +0000] "POST /api/v2/shifts HTTP/1.1" 201 692 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:25 +0000] "PUT /api/v2/shifts/templates/480 HTTP/1.1" 200 327 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:26 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1707 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:26 +0000] "POST /api/v2/shifts/swap-requests HTTP/1.1" 201 235 "-" "-"
PASS backend/src/routes/v2/__tests__/shifts-v2.test.ts (11.807 s)
  Shifts API v2
    Shifts CRUD Operations
      ✓ should create a new shift (420 ms)
      ✓ should fail to create shift without admin role (338 ms)
      ✓ should list shifts with filtering (360 ms)
      ✓ should get shift by ID (352 ms)
      ✓ should update a shift (378 ms)
      ✓ should delete a shift (365 ms)
    Shift Templates
      ✓ should create a shift template (354 ms)
      ✓ should list shift templates (369 ms)
      ✓ should update a template (372 ms)
      ✓ should delete a template (375 ms)
    Shift Swap Requests
      ✓ should create a swap request (396 ms)
      ✓ should not allow swap request for other user's shift (377 ms)
      ✓ should list swap requests (384 ms)
      ✓ should update swap request status (384 ms)
    Overtime Reporting
      ✓ should get overtime report for user (354 ms)
      ✓ should require date range for overtime report (346 ms)
    Shift Export
      ✓ should export shifts as CSV (352 ms)
      ✓ should return 501 for Excel export (344 ms)
      ✓ should require admin role for export (330 ms)
    Input Validation
      ✓ should validate time format (328 ms)
      ✓ should validate date format (340 ms)
      ✓ should validate required fields (345 ms)
    Multi-Tenant Isolation
      ✓ should not access shifts from other tenant (523 ms)
      ✓ should not see templates from other tenant (534 ms)
    RootLog Integration
      ✓ should log shift creation (362 ms)
      ✓ should log template updates (350 ms)
      ✓ should log swap request actions (383 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:47:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:27 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:27 +0000] "GET /api/v2/kvp/categories HTTP/1.1" 200 253 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:28 +0000] "GET /api/v2/kvp/categories HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:28 +0000] "POST /api/v2/kvp HTTP/1.1" 201 943 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:28 +0000] "POST /api/v2/kvp HTTP/1.1" 400 572 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:29 +0000] "GET /api/v2/kvp?page=1&limit=10 HTTP/1.1" 200 2326 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:29 +0000] "GET /api/v2/kvp?status=new HTTP/1.1" 200 884 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:29 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:30 +0000] "GET /api/v2/kvp HTTP/1.1" 200 1608 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:30 +0000] "GET /api/v2/kvp/5906 HTTP/1.1" 200 825 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:30 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:30 +0000] "GET /api/v2/kvp/99999 HTTP/1.1" 404 178 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:31 +0000] "PUT /api/v2/kvp/5908 HTTP/1.1" 200 842 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:31 +0000] "PUT /api/v2/kvp/5909 HTTP/1.1" 200 844 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:31 +0000] "PUT /api/v2/kvp/5911 HTTP/1.1" 404 178 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1662 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:32 +0000] "DELETE /api/v2/kvp/5912 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:32 +0000] "POST /api/v2/kvp/5913/comments HTTP/1.1" 201 227 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:32 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:33 +0000] "GET /api/v2/kvp/5914/comments HTTP/1.1" 200 493 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:33 +0000] "GET /api/v2/kvp/5915/comments HTTP/1.1" 200 292 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:33 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:33 +0000] "GET /api/v2/kvp/dashboard/stats HTTP/1.1" 200 211 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:34 +0000] "POST /api/v2/kvp/points/award HTTP/1.1" 201 264 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:34 +0000] "POST /api/v2/kvp/points/award HTTP/1.1" 403 186 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:37 +0000] "GET /api/v2/kvp/points/user/31158 HTTP/1.1" 200 146 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:37 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:38 +0000] "GET /api/v2/kvp/points/user/31159 HTTP/1.1" 403 191 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:38 +0000] "GET /api/v2/kvp/5926/attachments HTTP/1.1" 200 90 "-" "-"
PASS backend/src/routes/v2/__tests__/kvp-v2.test.ts (12.33 s)
  KVP API v2
    Categories
      ✓ should get all categories (385 ms)
      ✓ should require authentication (328 ms)
    Suggestions CRUD
      Create Suggestion
        ✓ should create a new suggestion (382 ms)
        ✓ should validate required fields (340 ms)
      List Suggestions
        ✓ should list suggestions with pagination (389 ms)
        ✓ should filter by status (374 ms)
        ✓ should respect employee visibility rules (385 ms)
      Get Suggestion by ID
        ✓ should get suggestion details (355 ms)
        ✓ should return 404 for non-existent suggestion (357 ms)
      Update Suggestion
        ✓ should update own suggestion (377 ms)
        ✓ should allow admin to update status (412 ms)
        ✓ should prevent employee from updating others suggestions (363 ms)
      Delete Suggestion
        ✓ should delete own suggestion (378 ms)
    Comments
      ✓ should add comment to suggestion (370 ms)
      ✓ should get comments for suggestion (391 ms)
      ✓ should hide internal comments from employees (380 ms)
    Dashboard Statistics
      ✓ should get dashboard statistics (358 ms)
    Points System
      ✓ should award points to user (admin only) (393 ms)
      ✓ should prevent employees from awarding points (355 ms)
      ✓ should get user points summary (3085 ms)
      ✓ should allow users to see only their own points (375 ms)
    Attachments
      ✓ should get attachments for suggestion (375 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:47:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1712 "-" "-"
[Reports Service] getOverviewReport called with: { tenantId: 4988, dateFrom: undefined, dateTo: undefined }
[Reports Service] Getting employee metrics...
[Reports Service] Getting department metrics...
[Reports Service] Getting shift metrics...
[Reports Service] Getting KVP metrics...
[Reports Service] Getting survey metrics...
[Reports Service] Overview report generated successfully
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:40 +0000] "GET /api/v2/reports/overview HTTP/1.1" 200 421 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getOverviewReport called with: { tenantId: 4988, dateFrom: undefined, dateTo: undefined }
[Reports Service] Getting employee metrics...
[Reports Service] Getting department metrics...
[Reports Service] Getting shift metrics...
[Reports Service] Getting KVP metrics...
[Reports Service] Getting survey metrics...
[Reports Service] Overview report generated successfully
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:40 +0000] "GET /api/v2/reports/overview HTTP/1.1" 200 421 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getOverviewReport called with: { tenantId: 4988, dateFrom: '2025-01-01', dateTo: '2025-01-31' }
[Reports Service] Getting employee metrics...
[Reports Service] Getting department metrics...
[Reports Service] Getting shift metrics...
[Reports Service] Getting KVP metrics...
[Reports Service] Getting survey metrics...
[Reports Service] Overview report generated successfully
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:41 +0000] "GET /api/v2/reports/overview?dateFrom=2025-01-01&dateTo=2025-01-31 HTTP/1.1" 200 421 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:41 +0000] "GET /api/v2/reports/overview HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:41 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:41 +0000] "GET /api/v2/reports/employees HTTP/1.1" 200 297 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:42 +0000] "GET /api/v2/reports/employees?departmentId=2470 HTTP/1.1" 200 316 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:42 +0000] "GET /api/v2/reports/employees?teamId=1848 HTTP/1.1" 200 310 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:42 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getDepartmentReport called with: { tenantId: 4988, dateFrom: undefined, dateTo: undefined }
[Reports Service] Department data query result: [
  [
    {
      department_id: 2470,
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
    departmentId: 2470,
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
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:43 +0000] "GET /api/v2/reports/departments HTTP/1.1" 200 231 "-" "-"
Department report data: [
  {
    "departmentId": 2470,
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
Department ID: 2470
Tenant ID: 4988
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:43 +0000] "GET /api/v2/reports/shifts HTTP/1.1" 200 497 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:43 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:43 +0000] "GET /api/v2/reports/shifts HTTP/1.1" 200 497 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getKvpReport called with: {
  tenantId: 4988,
  dateFrom: undefined,
  dateTo: undefined,
  categoryId: undefined
}
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:44 +0000] "GET /api/v2/reports/kvp HTTP/1.1" 200 376 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getKvpReport called with: {
  tenantId: 4988,
  dateFrom: undefined,
  dateTo: undefined,
  categoryId: undefined
}
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:44 +0000] "GET /api/v2/reports/kvp HTTP/1.1" 200 376 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:44 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1712 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:45 +0000] "GET /api/v2/reports/attendance?dateFrom=2025-01-01&dateTo=2025-01-31 HTTP/1.1" 200 2731 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:45 +0000] "GET /api/v2/reports/attendance HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:45 +0000] "GET /api/v2/reports/attendance?dateFrom=2025-01-01&dateTo=2025-05-01 HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:46 +0000] "GET /api/v2/reports/compliance?dateFrom=2025-01-01&dateTo=2025-01-31 HTTP/1.1" 200 654 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:46 +0000] "GET /api/v2/reports/compliance?dateFrom=2025-01-01&dateTo=2025-01-31 HTTP/1.1" 200 626 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:46 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:47 +0000] "POST /api/v2/reports/custom HTTP/1.1" 201 544 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:47 +0000] "POST /api/v2/reports/custom HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:47 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:47 +0000] "POST /api/v2/reports/custom HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getOverviewReport called with: { tenantId: 4988, dateFrom: undefined, dateTo: undefined }
[Reports Service] Getting employee metrics...
[Reports Service] Getting department metrics...
[Reports Service] Getting shift metrics...
[Reports Service] Getting KVP metrics...
[Reports Service] Getting survey metrics...
[Reports Service] Overview report generated successfully
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:48 +0000] "GET /api/v2/reports/export/overview?format=pdf HTTP/1.1" 200 476 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:48 +0000] "GET /api/v2/reports/export/shifts?format=excel&dateFrom=2025-01-01&dateTo=2025-01-31 HTTP/1.1" 200 317 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:48 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getKvpReport called with: { tenantId: 4988, dateFrom: undefined, dateTo: undefined }
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:49 +0000] "GET /api/v2/reports/export/kvp?format=csv HTTP/1.1" 200 284 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:49 +0000] "GET /api/v2/reports/export/invalid_type?format=pdf HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:49 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:49 +0000] "GET /api/v2/reports/export/overview?format=invalid_format HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:50 +0000] "GET /api/v2/reports/export/overview HTTP/1.1" 400 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
[Reports Service] getOverviewReport called with: { tenantId: 4988, dateFrom: undefined, dateTo: undefined }
[Reports Service] Getting employee metrics...
[Reports Service] Getting department metrics...
[Reports Service] Getting shift metrics...
[Reports Service] Getting KVP metrics...
[Reports Service] Getting survey metrics...
[Reports Service] Overview report generated successfully
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:50 +0000] "GET /api/v2/reports/overview HTTP/1.1" 200 425 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:50 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:51 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1712 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:51 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1706 "-" "-"
[Reports Service] getOverviewReport called with: { tenantId: 4989, dateFrom: undefined, dateTo: undefined }
[Reports Service] Getting employee metrics...
[Reports Service] Getting department metrics...
[Reports Service] Getting shift metrics...
[Reports Service] Getting KVP metrics...
[Reports Service] Getting survey metrics...
[Reports Service] Overview report generated successfully
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:51 +0000] "GET /api/v2/reports/overview HTTP/1.1" 200 421 "-" "-"
PASS backend/src/routes/v2/reports/__tests__/reports-v2.test.ts (12.889 s)
  Reports API v2
    GET /api/v2/reports/overview
      ✓ should get company overview report as admin (428 ms)
      ✓ should get overview report as employee (403 ms)
      ✓ should accept date range parameters (404 ms)
      ✓ should require authentication (417 ms)
    GET /api/v2/reports/employees
      ✓ should get employee analytics report (388 ms)
      ✓ should filter by department (408 ms)
      ✓ should filter by team (384 ms)
    GET /api/v2/reports/departments
      ✓ should get department performance report (409 ms)
    GET /api/v2/reports/shifts
      ✓ should get shift analytics report (410 ms)
      ✓ should include overtime breakdown (446 ms)
    GET /api/v2/reports/kvp
      ✓ should get KVP ROI report (427 ms)
      ✓ should calculate ROI correctly (394 ms)
    GET /api/v2/reports/attendance
      ✓ should get attendance report with required dates (370 ms)
      ✓ should require date parameters (426 ms)
      ✓ should validate date range (max 90 days) (407 ms)
    GET /api/v2/reports/compliance
      ✓ should get compliance report (401 ms)
      ✓ should include violation breakdown (402 ms)
    POST /api/v2/reports/custom
      ✓ should generate custom report (408 ms)
      ✓ should validate required fields (392 ms)
      ✓ should validate metrics array (399 ms)
    GET /api/v2/reports/export/:type
      ✓ should export overview report as PDF (416 ms)
      ✓ should export shifts report as Excel (403 ms)
      ✓ should export kvp report as CSV (383 ms)
      ✓ should validate report type (401 ms)
      ✓ should validate export format (384 ms)
      ✓ should require format parameter (378 ms)
    Authorization Tests
      ✓ should allow employees to access reports (409 ms)
      ✓ should isolate data by tenant (571 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1650 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1659 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1636 "-" "-"
Created 4 test audit entries
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail HTTP/1.1" 401 190 "-" "-"
[Audit Trail v2] getEntries called with user: 31221
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail HTTP/1.1" 200 796 "-" "-"
[Audit Trail v2] getEntries called with user: 31220
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail?page=1&limit=2 HTTP/1.1" 200 843 "-" "-"
[Audit Trail v2] getEntries called with user: 31220
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail?action=create HTTP/1.1" 200 508 "-" "-"
[Audit Trail v2] getEntries called with user: 31220
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail?resourceType=user HTTP/1.1" 200 508 "-" "-"
[Audit Trail v2] getEntries called with user: 31221
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail?status=failure HTTP/1.1" 200 490 "-" "-"
[Audit Trail v2] getEntries called with user: 31220
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail?dateFrom=2025-08-01T18%3A47%3A53.737Z&dateTo=2025-08-03T18%3A47%3A53.737Z HTTP/1.1" 200 844 "-" "-"
[Audit Trail v2] getEntries called with user: 31222
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail?search=Admin HTTP/1.1" 200 844 "-" "-"
[Audit Trail v2] getEntries called with user: 31222
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail HTTP/1.1" 200 1464 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail?page=invalid&limit=200&status=invalid_status HTTP/1.1" 400 382 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail/105 HTTP/1.1" 200 419 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail/105 HTTP/1.1" 403 196 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail/99999 HTTP/1.1" 404 179 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail/stats HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail/stats HTTP/1.1" 200 434 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail/stats?dateFrom=2025-07-26T18%3A47%3A53.832Z&dateTo=2025-08-02T18%3A47%3A53.832Z HTTP/1.1" 200 464 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "POST /api/v2/audit-trail/reports HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "POST /api/v2/audit-trail/reports HTTP/1.1" 200 699 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "POST /api/v2/audit-trail/reports HTTP/1.1" 400 257 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "POST /api/v2/audit-trail/reports HTTP/1.1" 400 257 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail/export?format=json HTTP/1.1" 200 1377 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail/export?format=csv HTTP/1.1" 200 694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail/export HTTP/1.1" 200 2081 "-" "-"
[Audit Trail v2] getEntries called with user: 31220
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail?action=export&resourceType=audit_trail HTTP/1.1" 200 1232 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "DELETE /api/v2/audit-trail/retention HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "DELETE /api/v2/audit-trail/retention HTTP/1.1" 400 263 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "DELETE /api/v2/audit-trail/retention HTTP/1.1" 200 146 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "DELETE /api/v2/audit-trail/retention HTTP/1.1" 200 146 "-" "-"
[Audit Trail v2] getEntries called with user: 31222
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:53 +0000] "GET /api/v2/audit-trail?action=delete&resourceType=audit_trail HTTP/1.1" 200 996 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:54 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1665 "-" "-"
[Audit Trail v2] getEntries called with user: 31223
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:54 +0000] "GET /api/v2/audit-trail HTTP/1.1" 200 451 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:54 +0000] "GET /api/v2/audit-trail/115 HTTP/1.1" 404 179 "-" "-"
PASS backend/src/routes/v2/audit-trail/__tests__/audit-trail-v2.test.ts
  Audit Trail API v2
    GET /api/v2/audit-trail
      ✓ should require authentication (14 ms)
      ✓ should return user's own audit entries (16 ms)
      ✓ should support pagination (10 ms)
      ✓ should support filtering by action (11 ms)
      ✓ should support filtering by resource type (9 ms)
      ✓ should support filtering by status (11 ms)
      ✓ should support date range filtering (14 ms)
      ✓ should support search (9 ms)
      ✓ should allow root to see all entries (10 ms)
      ✓ should validate query parameters (9 ms)
    GET /api/v2/audit-trail/:id
      ✓ should return specific audit entry (9 ms)
      ✓ should prevent users from viewing others' entries (8 ms)
      ✓ should return 404 for non-existent entry (8 ms)
    GET /api/v2/audit-trail/stats
      ✓ should require admin or root role (6 ms)
      ✓ should return audit statistics (18 ms)
      ✓ should support date filtering for stats (12 ms)
    POST /api/v2/audit-trail/reports
      ✓ should require admin or root role (7 ms)
      ✓ should generate GDPR compliance report (9 ms)
      ✓ should validate date range (6 ms)
      ✓ should enforce maximum date range (7 ms)
    GET /api/v2/audit-trail/export
      ✓ should export entries as JSON (21 ms)
      ✓ should export entries as CSV (15 ms)
      ✓ should log the export action (24 ms)
    DELETE /api/v2/audit-trail/retention
      ✓ should require root role (6 ms)
      ✓ should require minimum 90 days (6 ms)
      ✓ should delete old entries with valid password (26 ms)
      ✓ should log the deletion action (25 ms)
    Multi-tenant isolation
      ✓ should not leak audit entries between tenants (8 ms)
      ✓ should not allow cross-tenant audit entry access (8 ms)
    Integration with other services
      ✓ should be called when creating resources (12 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:47:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1652 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:55 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:55 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1106 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:55 +0000] "GET /api/v2/users/me HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:55 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1106 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "GET /api/v2/users?page=1&limit=10 HTTP/1.1" 200 1294 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "GET /api/v2/users?role=admin HTTP/1.1" 200 723 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "GET /api/v2/users?search=Admin HTTP/1.1" 200 723 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "GET /api/v2/users HTTP/1.1" 403 182 "-" "-"
info: User created successfully with ID: 31226 {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "POST /api/v2/users HTTP/1.1" 201 1152 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "POST /api/v2/users HTTP/1.1" 400 463 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "POST /api/v2/users HTTP/1.1" 409 177 "-" "-"
info: Updating field first_name to value: Updated {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: Updating field last_name to value: Name {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: Updating field position to value: Senior Developer {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: Special handling for is_active field - received value: false, type: boolean {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: is_active will be set to: 0 {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: Executing update query: UPDATE users SET `first_name` = ?, `last_name` = ?, `position` = ?, `is_active` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: With values: ["Updated","Name","Senior Developer",0,31227,4992] {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "PUT /api/v2/users/31227 HTTP/1.1" 200 1131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "PUT /api/v2/users/31228 HTTP/1.1" 200 1115 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1720 "-" "-"
info: Archiving user 31229 {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: Special handling for is_archived field - received value: true, type: boolean {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: is_archived will be set to: 1 {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: Executing update query: UPDATE users SET `is_archived` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: With values: [1,31229,4992] {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "POST /api/v2/users/31229/archive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "GET /api/v2/users/31229 HTTP/1.1" 200 1116 "-" "-"
info: Archiving user 31230 {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: Special handling for is_archived field - received value: true, type: boolean {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: is_archived will be set to: 1 {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: Executing update query: UPDATE users SET `is_archived` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: With values: [1,31230,4992] {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "POST /api/v2/users/31230/archive HTTP/1.1" 200 92 "-" "-"
info: Unarchiving user 31230 {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: Special handling for is_archived field - received value: false, type: boolean {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: is_archived will be set to: 0 {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: Executing update query: UPDATE users SET `is_archived` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
info: With values: [0,31230,4992] {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "POST /api/v2/users/31230/unarchive HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "GET /api/v2/users/31230 HTTP/1.1" 200 1117 "-" "-"
info: Password changed successfully for user 31225 {"service":"assixx-backend","timestamp":"2025-08-02 18:47:56"}
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:56 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1680 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "GET /api/v2/users/me HTTP/1.1" 200 1118 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "PUT /api/v2/users/me/password HTTP/1.1" 400 253 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "GET /api/v2/users/me/profile-picture HTTP/1.1" 200 15 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "POST /api/v2/users/me/profile-picture HTTP/1.1" 200 1176 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "DELETE /api/v2/users/me/profile-picture HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "GET /api/v2/users/me/profile-picture HTTP/1.1" 404 183 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "PUT /api/v2/users/31231/availability HTTP/1.1" 200 1161 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "PUT /api/v2/users/31232/availability HTTP/1.1" 400 261 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "GET /api/v2/users/31224 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:57 +0000] "GET /api/v2/users HTTP/1.1" 200 721 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2.test.ts
  Users v2 API Endpoints
    Response Format Validation
      ✓ should return standardized success response format (14 ms)
      ✓ should return standardized error response format (6 ms)
    Field Mapping (camelCase)
      ✓ should return user data with camelCase fields (10 ms)
    GET /api/v2/users
      ✓ should list users with pagination (admin only) (18 ms)
      ✓ should filter users by role (11 ms)
      ✓ should search users by name or email (10 ms)
      ✓ should deny access to non-admin users (7 ms)
    POST /api/v2/users
      ✓ should create a new user with camelCase input (183 ms)
      ✓ should validate required fields (6 ms)
      ✓ should prevent duplicate emails (10 ms)
    PUT /api/v2/users/:id
      ✓ should update user with camelCase fields (101 ms)
      ✓ should not allow password updates via this endpoint (179 ms)
    POST /api/v2/users/:id/archive & /unarchive
      ✓ should archive a user (112 ms)
      ✓ should unarchive a user (137 ms)
    PUT /api/v2/users/me/password
      ✓ should change password with correct current password (257 ms)
      ✓ should reject incorrect current password (85 ms)
      ✓ should validate password confirmation (6 ms)
    Profile Picture Endpoints
      ✓ should upload profile picture (24 ms)
      ✓ should download profile picture (24 ms)
      ✓ should delete profile picture (36 ms)
    PUT /api/v2/users/:id/availability
      ✓ should update user availability (95 ms)
      ✓ should validate availability status enum (92 ms)
    Multi-Tenant Isolation
      ✓ should not allow cross-tenant user access (5 ms)
      ✓ should not list users from other tenants (9 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:47:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:59 +0000] "POST /api/v2/surveys HTTP/1.1" 201 601 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:59 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:47:59 +0000] "POST /api/v2/surveys HTTP/1.1" 403 188 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:00 +0000] "POST /api/v2/surveys HTTP/1.1" 400 315 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:00 +0000] "GET /api/v2/surveys HTTP/1.1" 200 658 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:00 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1708 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:01 +0000] "GET /api/v2/surveys/1813 HTTP/1.1" 200 734 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:01 +0000] "GET /api/v2/surveys/99999 HTTP/1.1" 404 174 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1684 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:01 +0000] "PUT /api/v2/surveys/1815 HTTP/1.1" 200 582 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:01 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:02 +0000] "PUT /api/v2/surveys/1816 HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:02 +0000] "DELETE /api/v2/surveys/1817 HTTP/1.1" 200 129 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:02 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:02 +0000] "DELETE /api/v2/surveys/1818 HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:03 +0000] "GET /api/v2/surveys/1819 HTTP/1.1" 404 174 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1689 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:03 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:03 +0000] "GET /api/v2/surveys HTTP/1.1" 200 165 "-" "-"
PASS backend/src/routes/v2/__tests__/surveys-v2.test.ts (6.289 s)
  Surveys API v2
    Survey CRUD Operations
      ✓ should create a new survey (446 ms)
      ✓ should fail to create survey without admin role (344 ms)
      ✓ should validate required fields (341 ms)
    Survey List and Get Operations
      ✓ should list surveys (381 ms)
      ✓ should get survey by ID (376 ms)
      ✓ should return 404 for non-existent survey (397 ms)
    Survey Update and Delete Operations
      ✓ should update survey fields (396 ms)
      ✓ employee should not be able to update survey (384 ms)
      ✓ should delete survey without responses (388 ms)
      ✓ employee should not be able to delete survey (370 ms)
    Multi-Tenant Isolation
      ✓ should not access surveys from other tenants (437 ms)
      ✓ should not list surveys from other tenants (463 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1655 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:05 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1683 "-" "-"
Created conversation 1 with ID: 494
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:05 +0000] "GET /api/v2/chat/users HTTP/1.1" 200 664 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:05 +0000] "GET /api/v2/chat/users?search=chat_employee_test HTTP/1.1" 200 385 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:05 +0000] "GET /api/v2/chat/users HTTP/1.1" 401 190 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 4997,
  creatorId: 31260,
  data: {
    participantIds: [ 31262 ],
    name: 'New Test 1:1 Chat',
    isGroup: undefined
  }
}
[Chat Service] Creating new conversation with isGroup: false
[Chat Service] Created conversation with ID: 496
[Chat Service] getConversations called with: { tenantId: 4997, userId: 31260, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 4997
        AND cp.user_id = 31260
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:05 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 676 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 4997,
  creatorId: 31260,
  data: {
    participantIds: [ 31261, 31262 ],
    name: 'Test Group Chat',
    isGroup: undefined
  }
}
[Chat Service] Creating new conversation with isGroup: true
[Chat Service] Created conversation with ID: 497
[Chat Service] getConversations called with: { tenantId: 4997, userId: 31260, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 4997
        AND cp.user_id = 31260
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:05 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 869 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 4997,
  creatorId: 31260,
  data: {
    participantIds: [ 31261 ],
    name: 'Another attempt',
    isGroup: undefined
  }
}
[Chat Service] getConversations called with: { tenantId: 4997, userId: 31260, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 4997
        AND cp.user_id = 31260
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:05 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 678 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:05 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 400 270 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 4997,
  userId: 31260,
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
        WHERE c.tenant_id = 4997
        AND cp.user_id = 31260
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:05 +0000] "GET /api/v2/chat/conversations HTTP/1.1" 200 2889 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 4997,
  userId: 31260,
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
        WHERE c.tenant_id = 4997
        AND cp.user_id = 31260
        ORDER BY c.created_at DESC
        LIMIT 5 OFFSET 0

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:05 +0000] "GET /api/v2/chat/conversations?page=1&limit=5 HTTP/1.1" 200 2888 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 4997,
  userId: 31260,
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
        WHERE c.tenant_id = 4997
        AND cp.user_id = 31260
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:05 +0000] "GET /api/v2/chat/conversations?search=Test%20Group HTTP/1.1" 200 2889 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:05 +0000] "POST /api/v2/chat/conversations/494/messages HTTP/1.1" 201 421 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "POST /api/v2/chat/conversations/494/messages HTTP/1.1" 400 206 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "POST /api/v2/chat/conversations/498/messages HTTP/1.1" 403 170 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "POST /api/v2/chat/conversations/494/messages HTTP/1.1" 201 414 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "POST /api/v2/chat/conversations/494/messages HTTP/1.1" 201 420 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "GET /api/v2/chat/conversations/494/messages HTTP/1.1" 200 1486 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "POST /api/v2/chat/conversations/494/messages HTTP/1.1" 201 414 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "POST /api/v2/chat/conversations/494/messages HTTP/1.1" 201 420 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "GET /api/v2/chat/conversations/494/messages?page=1&limit=1 HTTP/1.1" 200 524 "-" "-"
Test conversationId: 494
Test authToken2: exists
[Chat Controller] markAsRead called
[Chat Controller] markAsRead - conversationId: 494 userId: 31261
[Chat Service] markConversationAsRead: { conversationId: 494, userId: 31261 }
[Chat Service] User is participant, getting unread messages
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "POST /api/v2/chat/conversations/494/read HTTP/1.1" 200 105 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "POST /api/v2/chat/conversations/494/messages HTTP/1.1" 201 419 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "GET /api/v2/chat/unread-count HTTP/1.1" 200 250 "-" "-"
[Chat Service] createConversation called with: {
  tenantId: 4997,
  creatorId: 31260,
  data: {
    participantIds: [ 31262 ],
    name: 'To be deleted',
    isGroup: undefined
  }
}
[Chat Service] getConversations called with: { tenantId: 4997, userId: 31260, filters: { limit: 100 } }
[Chat Service] Full query:
        SELECT DISTINCT
          c.id,
          c.name,
          c.is_group,
          c.created_at,
          c.updated_at
        FROM conversations c
        INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.tenant_id = 4997
        AND cp.user_id = 31260
        ORDER BY c.created_at DESC
        LIMIT 100 OFFSET 0

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "POST /api/v2/chat/conversations HTTP/1.1" 201 676 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "DELETE /api/v2/chat/conversations/496 HTTP/1.1" 200 135 "-" "-"
[Chat Service] getConversations called with: {
  tenantId: 4997,
  userId: 31260,
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
        WHERE c.tenant_id = 4997
        AND cp.user_id = 31260
        ORDER BY c.created_at DESC
        LIMIT 20 OFFSET 0

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "GET /api/v2/chat/conversations HTTP/1.1" 200 2892 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "GET /api/v2/chat/conversations/494 HTTP/1.1" 200 678 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "GET /api/v2/chat/conversations/99999 HTTP/1.1" 404 180 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "PUT /api/v2/chat/conversations/494 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "PUT /api/v2/chat/messages/1 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "DELETE /api/v2/chat/messages/1 HTTP/1.1" 501 191 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:06 +0000] "GET /api/v2/chat/search?q=test HTTP/1.1" 501 191 "-" "-"
PASS backend/src/routes/v2/chat/__tests__/chat-v2.test.ts
  Chat API v2
    GET /api/v2/chat/users
      ✓ should get available chat users (22 ms)
      ✓ should filter users by search term (10 ms)
      ✓ should return 401 without auth (3 ms)
    POST /api/v2/chat/conversations
      ✓ should create a new conversation (38 ms)
      ✓ should create a group conversation (34 ms)
      ✓ should return existing conversation for 1:1 chats (14 ms)
      ✓ should validate participant IDs (10 ms)
    GET /api/v2/chat/conversations
      ✓ should get user conversations (22 ms)
      ✓ should support pagination (15 ms)
      ✓ should filter by search (18 ms)
    POST /api/v2/chat/conversations/:id/messages
      ✓ should send a message (24 ms)
      ✓ should validate message content (7 ms)
      ✓ should prevent access to conversations user is not part of (21 ms)
    GET /api/v2/chat/conversations/:id/messages
      ✓ should get conversation messages (42 ms)
      ✓ should support pagination (39 ms)
    POST /api/v2/chat/conversations/:id/read
      ✓ should mark conversation as read (18 ms)
    GET /api/v2/chat/unread-count
      ✓ should get unread message count (27 ms)
    DELETE /api/v2/chat/conversations/:id
      ✓ should delete a conversation (49 ms)
    GET /api/v2/chat/conversations/:id
      ✓ should get conversation details (15 ms)
      ✓ should return 404 for non-existent conversation (15 ms)
    Not Implemented Endpoints
      ✓ PUT /api/v2/chat/conversations/:id should return 501 (8 ms)
      ✓ PUT /api/v2/chat/messages/:id should return 501 (7 ms)
      ✓ DELETE /api/v2/chat/messages/:id should return 501 (6 ms)
      ✓ GET /api/v2/chat/search should return 501 (9 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1669 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:10 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1694 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1698 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/events HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 1310 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/events?page=1&limit=1 HTTP/1.1" 200 754 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/events?status=cancelled HTTP/1.1" 200 750 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/events?search=Team HTTP/1.1" 200 756 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/events HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "POST /api/v2/calendar/events HTTP/1.1" 201 981 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "POST /api/v2/calendar/events HTTP/1.1" 201 1511 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 641 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 260 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "POST /api/v2/calendar/events HTTP/1.1" 400 278 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/events/4904 HTTP/1.1" 200 1184 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/events/99999 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/events/4907 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "PUT /api/v2/calendar/events/4908 HTTP/1.1" 200 678 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "PUT /api/v2/calendar/events/4909 HTTP/1.1" 200 671 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "PUT /api/v2/calendar/events/4910 HTTP/1.1" 403 153 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "PUT /api/v2/calendar/events/4911 HTTP/1.1" 400 260 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "DELETE /api/v2/calendar/events/4912 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/events/4912 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "DELETE /api/v2/calendar/events/4913 HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "DELETE /api/v2/calendar/events/4914 HTTP/1.1" 403 153 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "PUT /api/v2/calendar/events/4915/attendees/response HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/events/4915 HTTP/1.1" 200 1212 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "PUT /api/v2/calendar/events/4916/attendees/response HTTP/1.1" 400 254 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1663 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "PUT /api/v2/calendar/events/4917/attendees/response HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/export?format=ics HTTP/1.1" 200 493 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/export?format=csv HTTP/1.1" 200 261 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/export?format=invalid HTTP/1.1" 400 263 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/export HTTP/1.1" 400 308 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:11 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:12 +0000] "GET /api/v2/calendar/events/4927 HTTP/1.1" 404 173 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:12 +0000] "PUT /api/v2/calendar/events/4928 HTTP/1.1" 404 122 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:12 +0000] "DELETE /api/v2/calendar/events/4929 HTTP/1.1" 404 122 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2.test.ts (5.977 s)
  Calendar v2 API Endpoints
    Response Format Validation
      ✓ should return standardized success response format (19 ms)
      ✓ should return standardized error response format (7 ms)
    GET /api/v2/calendar/events
      ✓ should list all events for admin (29 ms)
      ✓ should support pagination (25 ms)
      ✓ should support filtering by status (31 ms)
      ✓ should support search (24 ms)
      ✓ should require authentication (18 ms)
    POST /api/v2/calendar/events
      ✓ should create a new event (29 ms)
      ✓ should create event with attendees (38 ms)
      ✓ should validate required fields (15 ms)
      ✓ should validate date order (9 ms)
      ✓ should require orgId for department/team events (9 ms)
    GET /api/v2/calendar/events/:id
      ✓ should get event by ID (23 ms)
      ✓ should return 404 for non-existent event (31 ms)
      ✓ should respect access control for employees (27 ms)
    PUT /api/v2/calendar/events/:id
      ✓ should update event (owner) (32 ms)
      ✓ should update event (admin) (26 ms)
      ✓ should not allow non-owner employee to update (21 ms)
      ✓ should validate date updates (16 ms)
    DELETE /api/v2/calendar/events/:id
      ✓ should delete event (owner) (31 ms)
      ✓ should delete event (admin) (24 ms)
      ✓ should not allow non-owner employee to delete (14 ms)
    PUT /api/v2/calendar/events/:id/attendees/response
      ✓ should update attendee response (39 ms)
      ✓ should validate response values (25 ms)
      ✓ should add user as attendee if not already (202 ms)
    GET /api/v2/calendar/export
      ✓ should export events as ICS (30 ms)
      ✓ should export events as CSV (18 ms)
      ✓ should validate format parameter (16 ms)
      ✓ should require format parameter (18 ms)
    Multi-Tenant Isolation
      ✓ should not show events from other tenants (99 ms)
      ✓ should not access specific event from other tenant (97 ms)
      ✓ should not update event from other tenant (93 ms)
      ✓ should not delete event from other tenant (91 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:13 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1679 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1704 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "POST /api/v2/machines HTTP/1.1" 201 796 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "POST /api/v2/machines HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "POST /api/v2/machines HTTP/1.1" 400 350 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "POST /api/v2/machines HTTP/1.1" 201 611 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "POST /api/v2/machines HTTP/1.1" 400 269 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines HTTP/1.1" 200 1598 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines?status=operational HTTP/1.1" 200 1598 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines?machineType=production HTTP/1.1" 200 1598 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines?search=CNC HTTP/1.1" 200 936 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines/97 HTTP/1.1" 200 796 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines/99999 HTTP/1.1" 404 175 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines/97 HTTP/1.1" 200 796 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "PUT /api/v2/machines/97 HTTP/1.1" 200 799 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "PUT /api/v2/machines/97 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "POST /api/v2/machines/maintenance HTTP/1.1" 201 652 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "POST /api/v2/machines/maintenance HTTP/1.1" 400 471 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "POST /api/v2/machines/maintenance HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines/97/maintenance HTTP/1.1" 200 654 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines/statistics HTTP/1.1" 200 210 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines/categories HTTP/1.1" 200 1484 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines/upcoming-maintenance?days=30 HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines/upcoming-maintenance?days=400 HTTP/1.1" 400 191 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "POST /api/v2/machines HTTP/1.1" 201 580 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "DELETE /api/v2/machines/99 HTTP/1.1" 200 130 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines/99 HTTP/1.1" 200 580 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "DELETE /api/v2/machines/97 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1655 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "POST /api/v2/machines HTTP/1.1" 201 584 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines HTTP/1.1" 200 1691 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "GET /api/v2/machines/100 HTTP/1.1" 404 175 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "PUT /api/v2/machines/100 HTTP/1.1" 404 175 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:14 +0000] "DELETE /api/v2/machines/100 HTTP/1.1" 404 175 "-" "-"
PASS backend/src/routes/v2/machines/__tests__/machines-v2.test.ts
  Machines v2 API Endpoints
    Response Format Validation
      ✓ should return standardized success response format (19 ms)
      ✓ should return standardized error response format (5 ms)
    POST /api/v2/machines - Create Machine
      ✓ should create machine with admin role (26 ms)
      ✓ should reject creation with employee role (6 ms)
      ✓ should validate required fields (8 ms)
      ✓ should reject duplicate serial number (38 ms)
    GET /api/v2/machines - List Machines
      ✓ should list all machines for authenticated user (9 ms)
      ✓ should filter machines by status (9 ms)
      ✓ should filter machines by type (9 ms)
      ✓ should search machines by keyword (11 ms)
    GET /api/v2/machines/:id - Get Machine by ID
      ✓ should get machine details (10 ms)
      ✓ should return 404 for non-existent machine (10 ms)
      ✓ should return camelCase fields (11 ms)
    PUT /api/v2/machines/:id - Update Machine
      ✓ should update machine with admin role (31 ms)
      ✓ should reject update with employee role (6 ms)
    POST /api/v2/machines/maintenance - Add Maintenance Record
      ✓ should add maintenance record with admin role (25 ms)
      ✓ should validate required fields (8 ms)
      ✓ should reject with employee role (6 ms)
    GET /api/v2/machines/:id/maintenance - Get Maintenance History
      ✓ should get maintenance history for machine (9 ms)
    GET /api/v2/machines/statistics - Get Statistics
      ✓ should get machine statistics (7 ms)
    GET /api/v2/machines/categories - Get Categories
      ✓ should get machine categories (8 ms)
    GET /api/v2/machines/upcoming-maintenance - Get Upcoming Maintenance
      ✓ should get machines needing maintenance soon (8 ms)
      ✓ should validate days parameter (6 ms)
    DELETE /api/v2/machines/:id - Delete Machine
      ✓ should soft delete machine with admin role (50 ms)
      ✓ should reject delete with employee role (7 ms)
    Multi-Tenant Isolation
      ✓ should not see machines from other tenants (9 ms)
      ✓ should not access machine from other tenant (8 ms)
      ✓ should not update machine from other tenant (10 ms)
      ✓ should not delete machine from other tenant (7 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1632 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 400 196 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:16 +0000] "GET /api/v2/auth/verify HTTP/1.1" 200 193 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:16 +0000] "GET /api/v2/auth/verify HTTP/1.1" 401 186 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:16 +0000] "GET /api/v2/auth/verify HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:16 +0000] "POST /api/v2/auth/refresh HTTP/1.1" 200 343 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:16 +0000] "POST /api/v2/auth/refresh HTTP/1.1" 401 183 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:16 +0000] "GET /api/v2/auth/me HTTP/1.1" 200 1146 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:16 +0000] "POST /api/auth/login HTTP/1.1" 401 107 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:16 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
PASS backend/src/routes/v2/auth/__tests__/auth-v2.test.ts
  Authentication API v2 Endpoints
    POST /api/v2/auth/login
      ✓ should return standardized success response with tokens (128 ms)
      ✓ should return standardized error for invalid credentials (80 ms)
      ✓ should validate required fields (3 ms)
    GET /api/v2/auth/verify
      ✓ should verify valid token (9 ms)
      ✓ should reject invalid token (6 ms)
      ✓ should reject missing token (6 ms)
    POST /api/v2/auth/refresh
      ✓ should refresh access token with valid refresh token (10 ms)
      ✓ should reject access token as refresh token (7 ms)
    GET /api/v2/auth/me
      ✓ should return current user with camelCase fields (12 ms)
    Deprecation Headers
      ✓ should include deprecation headers on v1 endpoints (19 ms)
      ✓ should NOT include deprecation headers on v2 endpoints (7 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1672 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1700 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1658 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1716 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "GET /api/v2/teams HTTP/1.1" 200 585 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "GET /api/v2/teams?departmentId=2474 HTTP/1.1" 200 585 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "GET /api/v2/teams?search=Team%201 HTTP/1.1" 200 337 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "GET /api/v2/teams?includeMembers=true HTTP/1.1" 200 617 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "GET /api/v2/teams HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "GET /api/v2/teams HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "GET /api/v2/teams/1850 HTTP/1.1" 200 782 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "GET /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "GET /api/v2/teams/1850 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "GET /api/v2/teams/1850 HTTP/1.1" 200 348 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "POST /api/v2/teams HTTP/1.1" 201 360 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "POST /api/v2/teams HTTP/1.1" 409 191 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "POST /api/v2/teams HTTP/1.1" 400 309 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "POST /api/v2/teams HTTP/1.1" 400 181 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "POST /api/v2/teams HTTP/1.1" 400 177 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "POST /api/v2/teams HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "POST /api/v2/teams HTTP/1.1" 201 341 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "PUT /api/v2/teams/1850 HTTP/1.1" 200 363 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "PUT /api/v2/teams/1850 HTTP/1.1" 200 345 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "PUT /api/v2/teams/1850 HTTP/1.1" 409 191 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "PUT /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "PUT /api/v2/teams/1850 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "PUT /api/v2/teams/1850 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "DELETE /api/v2/teams/1854 HTTP/1.1" 200 127 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "GET /api/v2/teams/1854 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:18 +0000] "DELETE /api/v2/teams/1855 HTTP/1.1" 400 219 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "DELETE /api/v2/teams/99999 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "DELETE /api/v2/teams/1857 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "DELETE /api/v2/teams/1858 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "GET /api/v2/teams/1850/members HTTP/1.1" 200 524 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "GET /api/v2/teams/1851/members HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "GET /api/v2/teams/1850/members HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "GET /api/v2/teams/1850/members HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "POST /api/v2/teams/1850/members HTTP/1.1" 201 132 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "GET /api/v2/teams/1850/members HTTP/1.1" 200 311 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "POST /api/v2/teams/1850/members HTTP/1.1" 409 194 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "POST /api/v2/teams/1850/members HTTP/1.1" 400 175 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "POST /api/v2/teams/1850/members HTTP/1.1" 400 175 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "POST /api/v2/teams/1850/members HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "DELETE /api/v2/teams/1850/members/31276 HTTP/1.1" 200 134 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "GET /api/v2/teams/1850/members HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "DELETE /api/v2/teams/1850/members/31277 HTTP/1.1" 400 193 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "DELETE /api/v2/teams/99999/members/31276 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "DELETE /api/v2/teams/1850/members/31276 HTTP/1.1" 404 172 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "DELETE /api/v2/teams/1850/members/31276 HTTP/1.1" 403 182 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "POST /api/v2/teams HTTP/1.1" 400 258 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "POST /api/v2/teams HTTP/1.1" 400 271 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "GET /api/v2/teams?search=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa HTTP/1.1" 400 262 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "GET /api/v2/teams/not-a-number HTTP/1.1" 400 256 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "POST /api/v2/teams HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:19 +0000] "POST /api/v2/teams HTTP/1.1" 201 315 "-" "-"
PASS backend/src/routes/v2/teams/__tests__/teams-v2.test.ts
  Teams v2 API Endpoints
    GET /api/v2/teams
      ✓ should list all teams for the tenant (17 ms)
      ✓ should filter teams by department (19 ms)
      ✓ should search teams by name (23 ms)
      ✓ should include member count when requested (26 ms)
      ✓ should require authentication (15 ms)
      ✓ should isolate teams by tenant (13 ms)
    GET /api/v2/teams/:id
      ✓ should get team by ID with members (30 ms)
      ✓ should return 404 for non-existent team (24 ms)
      ✓ should prevent access to other tenant's teams (11 ms)
      ✓ should allow employee access to view teams (15 ms)
    POST /api/v2/teams
      ✓ should create a new team (23 ms)
      ✓ should prevent duplicate team names (9 ms)
      ✓ should validate required fields (9 ms)
      ✓ should validate department ID (11 ms)
      ✓ should validate leader ID (9 ms)
      ✓ should require admin or root role (13 ms)
      ✓ should allow root role to create teams (15 ms)
    PUT /api/v2/teams/:id
      ✓ should update team details (19 ms)
      ✓ should allow clearing optional fields (17 ms)
      ✓ should prevent duplicate names on update (12 ms)
      ✓ should return 404 for non-existent team (10 ms)
      ✓ should prevent access to other tenant's teams (10 ms)
      ✓ should require admin or root role (7 ms)
    DELETE /api/v2/teams/:id
      ✓ should delete an empty team (26 ms)
      ✓ should prevent deletion of team with members (20 ms)
      ✓ should return 404 for non-existent team (13 ms)
      ✓ should prevent access to other tenant's teams (13 ms)
      ✓ should require admin or root role (10 ms)
    GET /api/v2/teams/:id/members
      ✓ should list team members (14 ms)
      ✓ should return empty array for team without members (13 ms)
      ✓ should allow employees to view team members (9 ms)
      ✓ should prevent access to other tenant's teams (8 ms)
    POST /api/v2/teams/:id/members
      ✓ should add a member to the team (23 ms)
      ✓ should prevent adding duplicate members (23 ms)
      ✓ should validate user ID (14 ms)
      ✓ should prevent adding users from other tenants (9 ms)
      ✓ should require admin or root role (6 ms)
    DELETE /api/v2/teams/:id/members/:userId
      ✓ should remove a member from the team (25 ms)
      ✓ should handle removing non-member gracefully (14 ms)
      ✓ should return 404 for non-existent team (16 ms)
      ✓ should prevent access to other tenant's teams (17 ms)
      ✓ should require admin or root role (13 ms)
    Input Validation
      ✓ should validate team name length (11 ms)
      ✓ should validate description length (7 ms)
      ✓ should validate search parameter (7 ms)
      ✓ should validate numeric IDs (7 ms)
    Content-Type validation
      ✓ should reject non-JSON content type for POST (3 ms)
      ✓ should accept application/json content type (18 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1633 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1661 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1634 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "POST /api/v2/notifications HTTP/1.1" 201 111 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "POST /api/v2/notifications HTTP/1.1" 201 111 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "POST /api/v2/notifications HTTP/1.1" 403 194 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "POST /api/v2/notifications HTTP/1.1" 400 495 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "POST /api/v2/notifications HTTP/1.1" 201 111 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "GET /api/v2/notifications HTTP/1.1" 200 1442 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "GET /api/v2/notifications?type=task HTTP/1.1" 200 602 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "GET /api/v2/notifications?priority=high HTTP/1.1" 200 605 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "GET /api/v2/notifications?page=1&limit=2 HTTP/1.1" 200 1023 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "GET /api/v2/notifications HTTP/1.1" 200 184 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "PUT /api/v2/notifications/2750/read HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "PUT /api/v2/notifications/2751/read HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "PUT /api/v2/notifications/2751/read HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "PUT /api/v2/notifications/2752/read HTTP/1.1" 404 180 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "PUT /api/v2/notifications/mark-all-read HTTP/1.1" 200 105 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "DELETE /api/v2/notifications/2758 HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "DELETE /api/v2/notifications/2759 HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "DELETE /api/v2/notifications/2760 HTTP/1.1" 404 180 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "GET /api/v2/notifications/preferences HTTP/1.1" 200 405 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "PUT /api/v2/notifications/preferences HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "GET /api/v2/notifications/preferences HTTP/1.1" 200 354 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "PUT /api/v2/notifications/preferences HTTP/1.1" 400 276 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "GET /api/v2/notifications/stats HTTP/1.1" 200 285 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:21 +0000] "GET /api/v2/notifications/stats HTTP/1.1" 403 189 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:22 +0000] "GET /api/v2/notifications/stats/me HTTP/1.1" 200 172 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:22 +0000] "POST /api/v2/notifications/subscribe HTTP/1.1" 200 136 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:22 +0000] "DELETE /api/v2/notifications/subscribe/sub_123 HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:22 +0000] "GET /api/v2/notifications/templates HTTP/1.1" 200 104 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:22 +0000] "POST /api/v2/notifications/from-template HTTP/1.1" 404 176 "-" "-"
PASS backend/src/routes/v2/notifications/__tests__/notifications-v2.test.ts
  Notifications API v2
    POST /api/v2/notifications
      ✓ should create notification as admin (28 ms)
      ✓ should create targeted notification (21 ms)
      ✓ should deny notification creation by employees (12 ms)
      ✓ should validate required fields (8 ms)
      ✓ should create notification with metadata (15 ms)
    GET /api/v2/notifications
      ✓ should list notifications for user (32 ms)
      ✓ should filter by type (26 ms)
      ✓ should filter by priority (25 ms)
      ✓ should paginate results (27 ms)
      ✓ should enforce tenant isolation (28 ms)
    PUT /api/v2/notifications/:id/read
      ✓ should mark notification as read (26 ms)
      ✓ should handle already read notifications (30 ms)
      ✓ should return 404 for notifications from other tenants (20 ms)
    PUT /api/v2/notifications/mark-all-read
      ✓ should mark all notifications as read (58 ms)
    DELETE /api/v2/notifications/:id
      ✓ should delete notification as admin (27 ms)
      ✓ should allow users to delete their own notifications (22 ms)
      ✓ should enforce tenant isolation on delete (12 ms)
    Notification Preferences
      GET /api/v2/notifications/preferences
        ✓ should get default preferences (14 ms)
      PUT /api/v2/notifications/preferences
        ✓ should update notification preferences (32 ms)
        ✓ should validate preference structure (7 ms)
    Notification Statistics
      ✓ should get notification statistics for admin (62 ms)
      ✓ should deny stats access to employees (58 ms)
      ✓ should get personal notification stats (54 ms)
    Real-time Notifications
      ✓ should subscribe to notification updates (14 ms)
      ✓ should unsubscribe from notifications (10 ms)
    Notification Templates
      ✓ should list notification templates for admin (8 ms)
      ✓ should return 404 for non-existent template (10 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1613 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1614 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1635 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 200 726 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 736 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 736 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/role-switch/to-original HTTP/1.1" 200 730 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 403 158 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/role-switch/to-original HTTP/1.1" 200 741 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 403 161 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/role-switch/root-to-admin HTTP/1.1" 403 158 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 186 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 179 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "POST /api/v2/role-switch/to-employee HTTP/1.1" 200 743 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:23 +0000] "GET /api/v2/role-switch/status HTTP/1.1" 200 181 "-" "-"
PASS backend/src/routes/v2/role-switch/__tests__/role-switch-v2.test.ts
  Role Switch API v2 - CRITICAL SECURITY TESTS
    ROOT USER TESTS
      ✓ Root can switch to admin view (18 ms)
      ✓ Root can switch to employee view (16 ms)
      ✓ Root can switch back to original role (27 ms)
    ADMIN USER TESTS
      ✓ Admin can switch to employee view (18 ms)
      ✓ Admin cannot use root-to-admin endpoint (16 ms)
      ✓ Admin can switch back to original role (27 ms)
    EMPLOYEE USER TESTS
      ✓ Employee cannot switch to employee view (8 ms)
      ✓ Employee cannot use root-to-admin endpoint (8 ms)
      ✓ Employee status shows cannot switch (8 ms)
    CRITICAL SECURITY TESTS
      ✓ CRITICAL: Admin logs have correct tenant_id (16 ms)
      ✓ GET /api/v2/role-switch/status returns correct information (7 ms)
      ✓ Switched token preserves all security properties (20 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1717 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:25 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1723 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:25 +0000] "POST /api/v2/documents HTTP/1.1" 201 635 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:25 +0000] "POST /api/v2/documents HTTP/1.1" 500 35 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:25 +0000] "POST /api/v2/documents HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:25 +0000] "POST /api/v2/documents HTTP/1.1" 201 658 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:25 +0000] "POST /api/v2/documents HTTP/1.1" 201 666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:25 +0000] "POST /api/v2/documents HTTP/1.1" 201 626 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:25 +0000] "POST /api/v2/documents HTTP/1.1" 201 636 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "POST /api/v2/documents HTTP/1.1" 201 641 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents HTTP/1.1" 200 4128 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents?category=personal HTTP/1.1" 200 801 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents?recipientType=team HTTP/1.1" 200 1490 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents HTTP/1.1" 200 4638 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents?page=1&limit=2 HTTP/1.1" 200 1460 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents?search=team HTTP/1.1" 200 1490 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "POST /api/v2/documents HTTP/1.1" 201 673 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents/1580 HTTP/1.1" 200 673 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents/99999 HTTP/1.1" 404 176 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "POST /api/v2/documents HTTP/1.1" 201 631 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents/1581 HTTP/1.1" 403 196 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "POST /api/v2/documents HTTP/1.1" 201 656 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "PUT /api/v2/documents/1582 HTTP/1.1" 200 667 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "PUT /api/v2/documents/1582 HTTP/1.1" 200 636 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "PUT /api/v2/documents/1582 HTTP/1.1" 403 207 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "POST /api/v2/documents HTTP/1.1" 201 638 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "DELETE /api/v2/documents/1583 HTTP/1.1" 200 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents/1583 HTTP/1.1" 404 176 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "POST /api/v2/documents HTTP/1.1" 201 638 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "DELETE /api/v2/documents/1584 HTTP/1.1" 403 198 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "POST /api/v2/documents HTTP/1.1" 201 643 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "POST /api/v2/documents/1585/archive HTTP/1.1" 200 132 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents?isArchived=true HTTP/1.1" 200 820 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "POST /api/v2/documents/1585/unarchive HTTP/1.1" 200 134 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "POST /api/v2/documents HTTP/1.1" 201 647 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents/1586/download HTTP/1.1" 200 11 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents/1586/preview HTTP/1.1" 200 11 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents/stats HTTP/1.1" 200 200 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "GET /api/v2/documents/stats HTTP/1.1" 200 199 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "POST /api/v2/documents HTTP/1.1" 400 424 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "POST /api/v2/documents HTTP/1.1" 400 244 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:26 +0000] "POST /api/v2/documents HTTP/1.1" 400 203 "-" "-"
PASS backend/src/routes/v2/documents/__tests__/documents-v2.test.ts
  Documents API v2
    POST /api/v2/documents
      ✓ should upload a PDF document (42 ms)
      ✓ should reject non-PDF files (15 ms)
      ✓ should require authentication (4 ms)
      ✓ should upload document for team (29 ms)
      ✓ should upload salary document with year/month (23 ms)
    GET /api/v2/documents
      ✓ should list all documents for admin (18 ms)
      ✓ should filter documents by category (12 ms)
      ✓ should filter documents by recipient type (13 ms)
      ✓ should show only accessible documents for regular user (15 ms)
      ✓ should support pagination (12 ms)
      ✓ should support search (10 ms)
    GET /api/v2/documents/:id
      ✓ should get document by ID (14 ms)
      ✓ should return 404 for non-existent document (9 ms)
      ✓ should deny access to unauthorized user (119 ms)
    PUT /api/v2/documents/:id
      ✓ should update document metadata (20 ms)
      ✓ should allow clearing optional fields (20 ms)
      ✓ should require admin role for update (9 ms)
    DELETE /api/v2/documents/:id
      ✓ should delete document (40 ms)
      ✓ should require admin role for delete (29 ms)
    Archive/Unarchive
      ✓ should archive document (26 ms)
      ✓ should unarchive document (14 ms)
    Download/Preview
      ✓ should download document (13 ms)
      ✓ should preview document inline (11 ms)
    GET /api/v2/documents/stats
      ✓ should get document statistics (12 ms)
      ✓ should not show storage for regular users (15 ms)
    Validation
      ✓ should validate required fields (7 ms)
      ✓ should validate category values (8 ms)
      ✓ should validate recipient requirements (9 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1664 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1673 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1655 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1664 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "GET /api/v2/features HTTP/1.1" 200 4032 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "GET /api/v2/features HTTP/1.1" 200 3712 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "GET /api/v2/features?includeInactive=true HTTP/1.1" 200 4033 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "GET /api/v2/features/categories HTTP/1.1" 200 4186 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "GET /api/v2/features/test_feature_v2 HTTP/1.1" 200 411 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "GET /api/v2/features/non_existent_feature HTTP/1.1" 404 101 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "GET /api/v2/features/my-features HTTP/1.1" 401 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "GET /api/v2/features/my-features HTTP/1.1" 200 2845 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "POST /api/v2/features/activate HTTP/1.1" 403 127 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "POST /api/v2/features/activate HTTP/1.1" 200 110 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "POST /api/v2/features/activate HTTP/1.1" 200 110 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "POST /api/v2/features/activate HTTP/1.1" 200 110 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:28 +0000] "POST /api/v2/features/activate HTTP/1.1" 200 110 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "POST /api/v2/features/activate HTTP/1.1" 404 122 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "POST /api/v2/features/deactivate HTTP/1.1" 403 127 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "POST /api/v2/features/deactivate HTTP/1.1" 200 112 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "POST /api/v2/features/deactivate HTTP/1.1" 404 128 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/tenant/5009 HTTP/1.1" 401 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/tenant/5009 HTTP/1.1" 403 127 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/tenant/5009 HTTP/1.1" 200 476 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/tenant/5010 HTTP/1.1" 403 129 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/tenant/5010 HTTP/1.1" 403 129 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/test/test_feature_v2 HTTP/1.1" 200 167 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/test/test_feature_v2 HTTP/1.1" 403 105 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/test/test_feature_v2 HTTP/1.1" 403 105 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/usage/test_feature_v2 HTTP/1.1" 400 450 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/usage/test_feature_v2?startDate=2025-07-26T18%3A48%3A29.241Z&endDate=2025-08-02T18%3A48%3A29.241Z HTTP/1.1" 200 117 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/usage/test_feature_v2?startDate=2025-01-01&endDate=2024-01-01 HTTP/1.1" 400 260 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/all-tenants HTTP/1.1" 403 127 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/all-tenants HTTP/1.1" 200 763 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/my-features HTTP/1.1" 200 2845 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/my-features HTTP/1.1" 200 2754 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "POST /api/v2/features/activate HTTP/1.1" 200 110 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/INVALID-CODE! HTTP/1.1" 400 306 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:29 +0000] "GET /api/v2/features/tenant/99999999 HTTP/1.1" 403 129 "-" "-"
PASS backend/src/routes/v2/features/__tests__/features-v2.test.ts
  Features API v2
    GET /api/v2/features
      ✓ should return all active features without authentication (25 ms)
      ✓ should respect includeInactive parameter (28 ms)
    GET /api/v2/features/categories
      ✓ should return features grouped by category (18 ms)
    GET /api/v2/features/:code
      ✓ should return a specific feature by code (15 ms)
      ✓ should return 404 for non-existent feature (12 ms)
    GET /api/v2/features/my-features
      ✓ should require authentication (7 ms)
      ✓ should return features with tenant status for authenticated user (25 ms)
    POST /api/v2/features/activate
      ✓ should require admin or root role (17 ms)
      ✓ should allow admin to activate feature for their tenant (40 ms)
      ✓ should handle duplicate activation gracefully (52 ms)
      ✓ should support activation options (30 ms)
      ✓ should return 404 for non-existent feature (15 ms)
    POST /api/v2/features/deactivate
      ✓ should require admin or root role (15 ms)
      ✓ should allow admin to deactivate feature (32 ms)
      ✓ should return 404 if feature not activated (24 ms)
    GET /api/v2/features/tenant/:tenantId
      ✓ should require authentication (11 ms)
      ✓ should not allow regular users to view tenant features (18 ms)
      ✓ should allow admin to view their own tenant features (20 ms)
      ✓ should prevent viewing other tenant features (non-admin) (16 ms)
      ✓ should allow root to view any tenant features (18 ms)
    GET /api/v2/features/test/:featureCode
      ✓ should test feature access and log usage (30 ms)
      ✓ should deny access for non-activated feature (18 ms)
      ✓ should deny access for expired feature (12 ms)
    GET /api/v2/features/usage/:featureCode
      ✓ should require date parameters (11 ms)
      ✓ should return usage statistics (14 ms)
      ✓ should validate date range (9 ms)
    GET /api/v2/features/all-tenants
      ✓ should require root role (7 ms)
      ✓ should return all tenants with feature summary (19 ms)
    Multi-tenant isolation
      ✓ should not leak features between tenants (28 ms)
      ✓ should prevent cross-tenant feature activation (25 ms)
    Error handling
      ✓ should handle invalid feature code format (13 ms)
      ✓ should handle database errors gracefully (8 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1666 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1687 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1652 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1670 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "GET /api/v2/departments HTTP/1.1" 200 672 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "GET /api/v2/departments?includeExtended=false HTTP/1.1" 200 522 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "GET /api/v2/departments HTTP/1.1" 401 190 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "GET /api/v2/departments HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "GET /api/v2/departments/stats HTTP/1.1" 200 125 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "GET /api/v2/departments/stats HTTP/1.1" 200 125 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "GET /api/v2/departments/2477 HTTP/1.1" 200 406 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "GET /api/v2/departments/99999 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "GET /api/v2/departments/invalid HTTP/1.1" 400 178 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "GET /api/v2/departments/2477 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "POST /api/v2/departments HTTP/1.1" 201 422 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "POST /api/v2/departments HTTP/1.1" 201 359 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "POST /api/v2/departments HTTP/1.1" 403 201 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "POST /api/v2/departments HTTP/1.1" 400 192 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "POST /api/v2/departments HTTP/1.1" 400 187 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "PUT /api/v2/departments/2478 HTTP/1.1" 200 426 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "PUT /api/v2/departments/2477 HTTP/1.1" 403 201 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "PUT /api/v2/departments/2477 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "PUT /api/v2/departments/2477 HTTP/1.1" 400 174 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "POST /api/v2/departments HTTP/1.1" 201 354 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "DELETE /api/v2/departments/2483 HTTP/1.1" 200 133 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "DELETE /api/v2/departments/2477 HTTP/1.1" 400 227 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:31 +0000] "DELETE /api/v2/departments/2478 HTTP/1.1" 403 201 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:32 +0000] "GET /api/v2/departments/2477/members HTTP/1.1" 200 588 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:32 +0000] "GET /api/v2/departments/2478/members HTTP/1.1" 200 90 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:32 +0000] "GET /api/v2/departments/2477/members HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:32 +0000] "GET /api/v2/departments HTTP/1.1" 200 747 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:32 +0000] "POST /api/v2/departments HTTP/1.1" 400 184 "-" "-"
PASS backend/src/routes/v2/departments/__tests__/departments-v2.test.ts
  Departments v2 API Endpoints
    GET /api/v2/departments
      ✓ should return all departments for authenticated user (18 ms)
      ✓ should return departments without extended fields when includeExtended=false (14 ms)
      ✓ should require authentication (6 ms)
      ✓ should not return departments from other tenants (11 ms)
    GET /api/v2/departments/stats
      ✓ should return department statistics (20 ms)
      ✓ should return stats only for user's tenant (18 ms)
    GET /api/v2/departments/:id
      ✓ should return a specific department (18 ms)
      ✓ should return 404 for non-existent department (20 ms)
      ✓ should return 400 for invalid department ID (8 ms)
      ✓ should not return department from other tenant (13 ms)
    POST /api/v2/departments
      ✓ should create a new department as admin (22 ms)
      ✓ should create a department with parent (24 ms)
      ✓ should require admin or root role (14 ms)
      ✓ should validate required fields (11 ms)
      ✓ should not allow duplicate department names (24 ms)
    PUT /api/v2/departments/:id
      ✓ should update a department (24 ms)
      ✓ should require admin or root role for update (10 ms)
      ✓ should not update department from other tenant (12 ms)
      ✓ should validate manager exists in same tenant (13 ms)
    DELETE /api/v2/departments/:id
      ✓ should delete a department without users (47 ms)
      ✓ should not delete department with assigned users (25 ms)
      ✓ should require admin or root role for deletion (8 ms)
    GET /api/v2/departments/:id/members
      ✓ should return department members (39 ms)
      ✓ should return empty array for department without members (15 ms)
      ✓ should not return members from other tenant's department (12 ms)
    Multi-tenant isolation
      ✓ should completely isolate department data between tenants (18 ms)
      ✓ should not allow cross-tenant parent department assignment (27 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1712 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1711 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1702 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "GET /api/v2/settings/system HTTP/1.1" 403 171 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "GET /api/v2/settings/system HTTP/1.1" 403 171 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "GET /api/v2/settings/system HTTP/1.1" 200 103 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "PUT /api/v2/settings/system/test_setting HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "GET /api/v2/settings/system/test_setting HTTP/1.1" 200 319 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "GET /api/v2/settings/tenant HTTP/1.1" 200 103 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "PUT /api/v2/settings/tenant/company_name HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "PUT /api/v2/settings/tenant/test_tenant_setting HTTP/1.1" 403 196 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "GET /api/v2/settings/user HTTP/1.1" 200 103 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "PUT /api/v2/settings/user/theme HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "PUT /api/v2/settings/user/notifications_enabled HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "PUT /api/v2/settings/user/items_per_page HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "PUT /api/v2/settings/user/preferences HTTP/1.1" 200 92 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "GET /api/v2/settings/user HTTP/1.1" 200 727 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "GET /api/v2/settings/categories HTTP/1.1" 200 681 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:34 +0000] "PUT /api/v2/settings/bulk HTTP/1.1" 200 175 "-" "-"
PASS backend/src/routes/v2/settings/__tests__/settings-v2-fixed.test.ts
  Settings API v2 - Fixed
    System Settings
      ✓ should deny employees access to system settings (14 ms)
      ✓ should deny admin access to system settings (10 ms)
      ✓ should allow root to get system settings (10 ms)
      ✓ should create and get system setting as root (38 ms)
    Tenant Settings
      ✓ should get tenant settings (16 ms)
      ✓ should allow admin to create tenant setting (22 ms)
      ✓ should deny employee from creating tenant settings (15 ms)
    User Settings
      ✓ should get user settings (12 ms)
      ✓ should create user setting (18 ms)
      ✓ should handle different value types (55 ms)
    Common Endpoints
      ✓ should get categories (19 ms)
      ✓ should bulk update user settings (29 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1650 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1659 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "GET /api/v2/plans HTTP/1.1" 200 3896 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "GET /api/v2/plans HTTP/1.1" 200 3896 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "GET /api/v2/plans/current HTTP/1.1" 200 1373 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "GET /api/v2/plans/current HTTP/1.1" 401 131 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "GET /api/v2/plans/addons HTTP/1.1" 200 128 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "PUT /api/v2/plans/addons HTTP/1.1" 200 129 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "PUT /api/v2/plans/addons HTTP/1.1" 403 127 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "PUT /api/v2/plans/addons HTTP/1.1" 400 269 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "PUT /api/v2/plans/addons HTTP/1.1" 200 129 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "GET /api/v2/plans/costs HTTP/1.1" 200 199 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "GET /api/v2/plans/2 HTTP/1.1" 200 1455 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "GET /api/v2/plans/999999 HTTP/1.1" 404 177 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "PUT /api/v2/plans/2/upgrade HTTP/1.1" 200 1771 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "PUT /api/v2/plans/3/upgrade HTTP/1.1" 403 127 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "PUT /api/v2/plans/1/upgrade HTTP/1.1" 400 248 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:36 +0000] "PUT /api/v2/plans/1/upgrade HTTP/1.1" 200 1373 "-" "-"
PASS backend/src/routes/v2/plans/__tests__/plans-v2.test.ts
  Plans API v2
    GET /api/v2/plans
      ✓ should return all active plans without authentication (24 ms)
      ✓ should include features for each plan (9 ms)
    GET /api/v2/plans/current
      ✓ should return current tenant plan for authenticated user (19 ms)
      ✓ should require authentication (6 ms)
    GET /api/v2/plans/addons
      ✓ should return zero addons initially (10 ms)
    PUT /api/v2/plans/addons
      ✓ should allow admin to update addons (42 ms)
      ✓ should prevent regular users from updating addons (11 ms)
      ✓ should validate addon values (10 ms)
    GET /api/v2/plans/costs
      ✓ should calculate current costs with addons (35 ms)
    GET /api/v2/plans/:id
      ✓ should return plan by ID (13 ms)
      ✓ should return 404 for non-existent plan (6 ms)
    PUT /api/v2/plans/:id/upgrade
      ✓ should allow admin to upgrade plan (38 ms)
      ✓ should prevent non-admin from upgrading plan (7 ms)
      ✓ should validate plan code (8 ms)
      ✓ should log plan changes in audit trail (45 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1676 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:38 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1676 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:38 +0000] "GET /api/v2/calendar/events HTTP/1.1" 200 206 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2-simple.test.ts
  Calendar v2 API - Simple Debug Test
    ✓ should login admin user (105 ms)
    ✓ should access calendar endpoint with token (104 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:40 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1674 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:43 +0000] "POST /api/v2/users/31303/archive HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:43 +0000] "POST /api/v2/users/31303/archive HTTP/1.1" 400 118 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:43 +0000] "GET /api/v2/users/31304 HTTP/1.1" 200 1101 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:43 +0000] "OPTIONS /api/v2/users/31305/archive HTTP/1.1" 204 0 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2-debug-archive.test.ts
  DEBUG: Users v2 Archive API
    ✓ should check archive endpoint validation (2810 ms)
    ✓ should check if user exists before archive (98 ms)
    ✓ should check if route is registered (94 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 200 1664 "-" "-"
::ffff:127.0.0.1 - - [02/Aug/2025:18:48:45 +0000] "POST /api/v2/auth/login HTTP/1.1" 401 193 "-" "-"
PASS backend/src/routes/v2/calendar/__tests__/calendar-v2-debug.test.ts
  DEBUG Calendar v2 Test User Creation
    ✓ should debug user creation and login (220 ms)

::ffff:127.0.0.1 - - [02/Aug/2025:18:48:46 +0000] "GET /api/v2/users HTTP/1.1" 401 190 "-" "-"
PASS backend/src/routes/v2/users/__tests__/users-v2-simple.test.ts
  Users v2 API - Simple Test
    Basic Endpoint Test
      ✓ should return 401 without authentication (24 ms)

PASS backend/src/routes/v2/users/users.service.integration.test.ts
  UsersService Integration Tests
    createUser
      ✓ should create user successfully (192 ms)
      ✓ should throw error for duplicate email (18 ms)
    getUserById
      ✓ should return user when found (1 ms)
      ✓ should throw error when user not found (3 ms)
    updateUser
      ✓ should update user fields (7 ms)
    listUsers
      ✓ should return paginated users (3 ms)
      ✓ should filter by search term (2 ms)
    deleteUser
      ✓ should prevent self-deletion (3 ms)
      ✓ should delete user successfully (10 ms)

PASS backend/src/routes/v2/users/users.service.logic.test.ts
  UsersService Logic Tests
    ServiceError
      ✓ should create ServiceError with correct properties (2 ms)
      ✓ should use default status code 500
      ✓ should include details when provided (1 ms)
    Error Code Constants
      ✓ should have proper error codes (1 ms)
    Business Logic Validation
      ✓ should validate pagination parameters (1 ms)
      ✓ should validate limit parameters
      ✓ should calculate pagination metadata (1 ms)
      ✓ should validate sort parameters
      ✓ should validate sort order (1 ms)
    Field Mapping Logic
      ✓ should map database fields to API fields
      ✓ should map API fields to database fields (1 ms)
    Password Validation
      ✓ should validate password requirements
    Email Validation
      ✓ should validate email format (9 ms)
    Employee Number Generation
      ✓ should generate employee number in correct format (1 ms)

PASS backend/src/routes/v2/users/users.service.simple.test.ts
  UsersService - Simple Test
    ServiceError
      ✓ should create ServiceError with correct properties (2 ms)
      ✓ should use default status code 500
      ✓ should include details when provided (1 ms)

PASS backend/src/routes/v2/calendar/calendar.service.logic.test.ts
  Calendar Service Business Logic
    Date Validation Logic
      ✓ should validate that end time is after start time (1 ms)
      ✓ should detect invalid date order
      ✓ should handle all-day events (1 ms)
    Organization Level Validation
      ✓ should require orgId for department events
      ✓ should require orgId for team events (1 ms)
      ✓ should not require orgId for personal events
      ✓ should not require orgId for company events
    Pagination Logic
      ✓ should calculate correct page values
      ✓ should handle invalid page numbers
      ✓ should limit maximum page size
      ✓ should calculate offset correctly
      ✓ should calculate total pages (1 ms)
      ✓ should determine hasNext correctly
      ✓ should determine hasPrev correctly
    Color Validation
      ✓ should validate hex color format (1 ms)
      ✓ should reject invalid color formats
    Recurrence Rule Logic
      ✓ should parse recurrence pattern (1 ms)
      ✓ should calculate interval days for patterns
      ✓ should parse COUNT option
      ✓ should parse UNTIL option (1 ms)
    Sort Field Mapping
      ✓ should map API field names to DB field names (1 ms)
      ✓ should default to start_date for invalid sort field
    Attendee Response Validation
      ✓ should validate attendee response values
      ✓ should reject invalid response values (1 ms)
    Permission Logic
      ✓ should allow owner to manage event
      ✓ should allow admin to manage any event
      ✓ should allow manager to manage any event (1 ms)
      ✓ should not allow non-owner employee to manage
    Export Format Logic
      ✓ should format CSV row correctly
      ✓ should escape CSV fields with quotes (1 ms)
      ✓ should format ICS date correctly
      ✓ should generate unique UID for ICS
    Time Calculation Logic
      ✓ should calculate event duration
      ✓ should handle weekday recurrence
      ✓ should calculate monthly recurrence
      ✓ should calculate yearly recurrence
    Filter Logic
      ✓ should map filter to event type
      ✓ should handle date range filtering
      ✓ should handle search term matching

PASS backend/src/routes/v2/calendar/calendar.service.simple.test.ts
  Calendar ServiceError
    Error Creation
      ✓ should create ServiceError with correct properties (2 ms)
      ✓ should create ServiceError with details (1 ms)
      ✓ should handle different error codes (1 ms)
    Error Type Checking
      ✓ should identify ServiceError correctly
      ✓ should handle null and undefined (1 ms)
      ✓ should handle other types
    Calendar-Specific Errors
      ✓ should create date validation error (1 ms)
      ✓ should create permission error
      ✓ should create conflict error
      ✓ should create attendee error (7 ms)
    Error Serialization
      ✓ should convert to JSON properly
      ✓ should handle error without details
    Calendar Data Validation
      ✓ should validate ISO date format (2 ms)
      ✓ should detect invalid dates (1 ms)
      ✓ should validate organization levels (1 ms)
      ✓ should validate event status

PASS backend/src/utils/__tests__/errorHandler.test.ts
  errorHandler
    getErrorMessage
      ✓ should extract message from Error object (1 ms)
      ✓ should extract message from object with message property
      ✓ should convert string error to message (1 ms)
      ✓ should handle number error
      ✓ should handle null error
      ✓ should handle undefined error
      ✓ should handle MySQL error format
      ✓ should handle empty object
      ✓ should handle array error (1 ms)
      ✓ should handle boolean error
      ✓ should handle Error with empty message
      ✓ should NOT trim whitespace from error messages

Test Suites: 29 passed, 29 total
Tests:       576 passed, 576 total
Snapshots:   0 total
Time:        120.376 s
Ran all test suites.

🧹 Running global test cleanup...
✅ Global cleanup complete. Remaining test tenants: 0
Force exiting Jest: Have you considered using `--detectOpenHandles` to detect async operations that kept running after all tests finished?
scs@SOSCSPC1M16:~/projects/Assixx/docker$ 
