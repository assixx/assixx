# BACKEND LINT ERROR FIX

USE SUB-AGENTS LIBERALLY TO PARALLELIZE WORK AND SAVE ON CONTEXT — BUT THINK CAREFULLY ABOUT WHEN IT'S MOST EFFECTIVE.
FIX ALL ERRORS.

HOW TO?

LINE BY LINE AND NOT BY GROUPING — THAT MEANS ALWAYS ONE FILE AT A TIME.
ONLY CREATE A SCRIPT IF INDIVIDUAL LETTERS OR WORDS OR SYMBOLS NEED TO BE REPLACED, OTHERWISE DO NOT CREATE SCRIPTS TO FIX THE ERRORS!
DO NOT RUN INTERMEDIATE TESTS — ONLY WHEN I SAY "AVOCADO" THEN YOU RUN:
PNPM RUN LINT:FIX IN /PROJECTS/ASSIXX/BACKEND$ PNPM RUN LINT:FIX IN THE FILE YOU JUST CORRECTED.

DO NOT MAKE ASSUMPTIONS WHEN FIXING — ALWAYS VERIFY! READ CONTEXT, INCLUDING OTHER FILES IF YOU ABSOLUTELY MUST, TO BETTER UNDERSTAND!
DONT STOP UNTIL YOU REACHED THE LAST FILE.
LINE BY LINE:
HERE ARE THE ERRORS

scs@SOSCSPC1M16:~/p

scs@SOSCSPC1M16:~/projects/Assixx/docker$docker exec assixx-backend pnpm run type-check

> assixx@1.0.0 type-check /app
> tsc --noEmit

backend/src/auth.ts(94,50): error TS2367: This comparison appears to be unintentional because the types 'DbUser' and 'string' have no overlap.
backend/src/auth.ts(114,54): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/controllers/blackboard.controller.ts(91,9): error TS2345: Argument of type 'Pool | undefined' is not assignable to parameter of type 'Pool'.
Type 'undefined' is not assignable to type 'Pool'.
backend/src/controllers/blackboard.controller.ts(119,9): error TS2345: Argument of type 'Pool | undefined' is not assignable to parameter of type 'Pool'.
Type 'undefined' is not assignable to type 'Pool'.
backend/src/controllers/blackboard.controller.ts(162,53): error TS2345: Argument of type 'Pool | undefined' is not assignable to parameter of type 'Pool'.
Type 'undefined' is not assignable to type 'Pool'.
backend/src/controllers/blackboard.controller.ts(197,9): error TS2345: Argument of type 'Pool | undefined' is not assignable to parameter of type 'Pool'.
Type 'undefined' is not assignable to type 'Pool'.
backend/src/controllers/blackboard.controller.ts(224,38): error TS2345: Argument of type 'Pool | undefined' is not assignable to parameter of type 'Pool'.
Type 'undefined' is not assignable to type 'Pool'.
backend/src/controllers/employee.controller.ts(289,13): error TS2322: Type 'string | number | boolean | Date' is not assignable to type 'undefined'.
Type 'string' is not assignable to type 'undefined'.
backend/src/database.ts(49,58): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/middleware/auth-refactored.ts(158,9): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/middleware/features.ts(160,11): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/middleware/security-enhanced.ts(197,58): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/middleware/security.ts(23,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/middleware/security.ts(35,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/middleware/security.ts(51,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/middleware/security.ts(68,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/middleware/security.ts(84,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/middleware/security.ts(99,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/middleware/security.ts(114,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/middleware/security.ts(138,9): error TS2367: This comparison appears to be unintentional because the types 'RateLimitRequestHandler' and 'string' have no overlap.
backend/src/middleware/tenant.ts(70,54): error TS2367: This comparison appears to be unintentional because the types 'DatabaseTenant' and 'string' have no overlap.
backend/src/middleware/tenantStatus.ts(56,7): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/middleware/v2/auth.middleware.ts(278,15): error TS2339: Property 'includes' does not exist on type 'boolean | string[]'.
Property 'includes' does not exist on type 'false'.
backend/src/middleware/v2/auth.middleware.ts(284,44): error TS2339: Property 'includes' does not exist on type 'boolean | string[]'.
Property 'includes' does not exist on type 'false'.
backend/src/middleware/v2/security.middleware.ts(22,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/middleware/v2/security.middleware.ts(34,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/middleware/v2/security.middleware.ts(51,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/middleware/v2/security.middleware.ts(69,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/middleware/v2/security.middleware.ts(86,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/middleware/v2/security.middleware.ts(102,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/middleware/v2/security.middleware.ts(118,60): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/models/calendar.ts(569,9): error TS2367: This comparison appears to be unintentional because the types 'DbCalendarEvent' and 'string' have no overlap.
backend/src/models/document.ts(586,54): error TS2367: This comparison appears to be unintentional because the types 'DocumentFilters' and '""' have no overlap.
backend/src/models/rootLog.ts(165,52): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/models/rootLog.ts(180,56): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/models/rootLog.ts(185,58): error TS2367: This comparison appears to be unintentional because the types 'Date' and 'string' have no overlap.
backend/src/models/rootLog.ts(190,54): error TS2367: This comparison appears to be unintentional because the types 'Date' and 'string' have no overlap.
backend/src/models/shift.ts(389,7): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/models/shift.ts(395,54): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/models/shift.ts(410,52): error TS2367: This comparison appears to be unintentional because the types '"archived" | "draft" | "published"' and '""' have no overlap.
backend/src/models/shift.ts(448,7): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/models/shift.ts(454,54): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/models/shift.ts(469,52): error TS2367: This comparison appears to be unintentional because the types '"archived" | "draft" | "published"' and '""' have no overlap.
backend/src/models/survey.ts(289,52): error TS2367: This comparison appears to be unintentional because the types '"active" | "draft" | "closed"' and '""' have no overlap.
backend/src/models/survey.ts(364,52): error TS2367: This comparison appears to be unintentional because the types '"active" | "draft" | "closed"' and '""' have no overlap.
backend/src/models/survey.ts(417,52): error TS2367: This comparison appears to be unintentional because the types '"active" | "draft" | "closed"' and '""' have no overlap.
backend/src/routes/admin-permissions.ts(190,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/admin-permissions.ts(245,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/admin-permissions.ts(293,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/admin-permissions.ts(345,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/admin.ts(574,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/blackboard.ts(149,54): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/blackboard.ts(156,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/blackboard.ts(1156,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/department-groups.ts(214,58): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/department-groups.ts(266,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/department-groups.ts(342,58): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/department-groups.ts(390,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/departments.ts(157,9): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/departments.ts(169,60): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/departments.ts(469,9): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/departments.ts(481,60): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/departments.ts(509,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/departments.ts(639,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/documents.ts(378,11): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/logs.ts(101,54): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/logs.ts(298,7): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/logs.ts(353,54): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/logs.ts(427,54): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/mocks/database.ts(56,50): error TS2367: This comparison appears to be unintentional because the types 'Pool' and 'string' have no overlap.
backend/src/routes/mocks/database.ts(1010,50): error TS2367: This comparison appears to be unintentional because the types 'Pool' and 'string' have no overlap.
backend/src/routes/mocks/database.ts(1130,5): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/role-switch.ts(48,9): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/root.ts(334,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/root.ts(386,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/root.ts(445,60): error TS2367: This comparison appears to be unintentional because the types 'DbRootLog' and 'string' have no overlap.
backend/src/routes/shifts.ts(285,56): error TS2345: Argument of type '{ tenant_id: number; created_by: number; duration_hours: number | boolean; name: string; start_time: string; end_time: string; break_duration?: number; required_staff?: number; description?: string; color?: string; is_active?: boolean; }' is not assignable to parameter of type 'ShiftTemplateData'.
Types of property 'duration_hours' are incompatible.
Type 'number | boolean' is not assignable to type 'number'.
Type 'boolean' is not assignable to type 'number'.
backend/src/routes/shifts.ts(1434,9): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/teams.ts(547,54): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/teams.ts(641,54): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/teams.ts(875,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/teams.ts(992,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/user.ts(215,52): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/user.ts(337,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/user.ts(420,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/users.ts(500,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/users.ts(546,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/users.ts(626,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/users.ts(718,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/users.ts(782,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/v2/admin-permissions/service.ts(101,62): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/v2/admin-permissions/service.ts(455,7): error TS2322: Type 'boolean | undefined' is not assignable to type 'string[] | undefined'.
Type 'boolean' is not assignable to type 'string[]'.
backend/src/routes/v2/areas/areas.service.ts(192,56): error TS2367: This comparison appears to be unintentional because the types 'Area & { children: Area[]; }' and 'string' have no overlap.
backend/src/routes/v2/audit-trail/audit-trail.service.ts(122,52): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/v2/audit-trail/audit-trail.service.ts(138,60): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/v2/audit-trail/audit-trail.service.ts(142,52): error TS2367: This comparison appears to be unintentional because the types '"success" | "failure"' and '""' have no overlap.
backend/src/routes/v2/auth/auth.controller.ts(231,7): error TS2367: This comparison appears to be unintentional because the types 'DbUser' and 'string' have no overlap.
backend/src/routes/v2/blackboard/blackboard.service.ts(162,7): error TS2322: Type 'number | boolean | undefined' is not assignable to type 'number | undefined'.
Type 'boolean' is not assignable to type 'number'.
backend/src/routes/v2/calendar/calendar.controller.ts(429,56): error TS2367: This comparison appears to be unintentional because the types 'DbCalendarEvent' and 'string' have no overlap.
backend/src/routes/v2/calendar/calendar.controller.ts(547,7): error TS2367: This comparison appears to be unintentional because the types 'DbCalendarEvent' and 'string' have no overlap.
backend/src/routes/v2/calendar/calendar.service.ts(653,34): error TS2339: Property 'length' does not exist on type 'boolean | never[]'.
Property 'length' does not exist on type 'false'.
backend/src/routes/v2/calendar/calendar.service.ts(657,41): error TS2339: Property 'map' does not exist on type 'boolean | never[]'.
Property 'map' does not exist on type 'false'.
backend/src/routes/v2/calendar/calendar.service.ts(657,46): error TS7006: Parameter 'event' implicitly has an 'any' type.
backend/src/routes/v2/chat/chat.controller.ts(476,9): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/v2/department-groups/service.ts(69,11): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/v2/department-groups/service.ts(209,58): error TS2367: This comparison appears to be unintentional because the types 'DepartmentGroupWithHierarchy' and 'string' have no overlap.
backend/src/routes/v2/department-groups/service.ts(504,9): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/routes/v2/features/features.service.ts(61,60): error TS2367: This comparison appears to be unintentional because the types 'FeatureCategory' and 'string' have no overlap.
backend/src/routes/v2/logs/logs.service.ts(64,52): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/v2/logs/logs.service.ts(69,56): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/v2/machines/machines.service.ts(54,60): error TS2367: This comparison appears to be unintentional because the types 'Machine' and 'string' have no overlap.
backend/src/routes/v2/machines/machines.service.ts(141,60): error TS2367: This comparison appears to be unintentional because the types 'Machine' and 'string' have no overlap.
backend/src/routes/v2/notifications/notifications.service.ts(349,54): error TS2367: This comparison appears to be unintentional because the types 'RowDataPacket' and 'string' have no overlap.
backend/src/routes/v2/plans/plans.service.ts(229,52): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/v2/plans/plans.service.ts(321,52): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/routes/v2/settings/settings.service.ts(185,54): error TS2367: This comparison appears to be unintentional because the types 'RowDataPacket' and 'string' have no overlap.
backend/src/routes/v2/settings/settings.service.ts(363,54): error TS2367: This comparison appears to be unintentional because the types 'RowDataPacket' and 'string' have no overlap.
backend/src/routes/v2/settings/settings.service.ts(526,54): error TS2367: This comparison appears to be unintentional because the types 'RowDataPacket' and 'string' have no overlap.
backend/src/routes/v2/teams/teams.service.ts(189,60): error TS2367: This comparison appears to be unintentional because the types 'DbTeam' and 'string' have no overlap.
backend/src/routes/v2/teams/teams.service.ts(259,62): error TS2367: This comparison appears to be unintentional because the types 'DbTeam' and 'string' have no overlap.
backend/src/routes/v2/users/users.service.ts(150,7): error TS2367: This comparison appears to be unintentional because the types 'DbUser' and 'string' have no overlap.
backend/src/services/adminPermission.service.ts(163,60): error TS2367: This comparison appears to be unintentional because the types 'DepartmentWithPermission' and 'string' have no overlap.
backend/src/services/alerting.service.ts(166,9): error TS2869: Right operand of ?? is unreachable because the left operand is never nullish.
backend/src/services/auth.service.ts(174,9): error TS2367: This comparison appears to be unintentional because the types 'DbUser' and 'string' have no overlap.
backend/src/services/auth.service.ts(188,9): error TS2367: This comparison appears to be unintentional because the types 'DbUser' and 'string' have no overlap.
backend/src/services/auth.service.ts(459,58): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/services/availability.service.ts(8,3): error TS6133: 'DatabaseEmployeeAvailability' is declared but its value is never read.
backend/src/services/availability.service.ts(143,9): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(144,9): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(145,9): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(146,9): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(147,9): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(148,9): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(149,9): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(150,9): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(177,11): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(179,21): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(181,11): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(183,21): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(185,11): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(187,21): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(189,11): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(191,21): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(193,11): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/availability.service.ts(195,21): error TS18046: 'dbData' is of type 'unknown'.
backend/src/services/department.service.ts(95,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/services/departmentGroup.service.ts(45,9): error TS2367: This comparison appears to be unintentional because the types 'number' and 'string' have no overlap.
backend/src/services/departmentGroup.service.ts(55,11): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/services/departmentGroup.service.ts(183,9): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/services/departmentGroup.service.ts(294,58): error TS2367: This comparison appears to be unintentional because the types 'DepartmentGroup' and 'string' have no overlap.
backend/src/services/employee.service.ts(103,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/services/team.service.ts(128,56): error TS2367: This comparison appears to be unintentional because the types 'boolean' and 'string' have no overlap.
backend/src/services/tenantDeletion.service.ts(2074,60): error TS2367: This comparison appears to be unintentional because the types 'QueueItemWithTenant' and 'string' have no overlap.
backend/src/services/tenantDeletion.service.ts(2290,60): error TS2367: This comparison appears to be unintentional because the types 'ResultSetHeader | RowDataPacket[]' and 'string' have no overlap.
backend/src/services/tenantDeletion.service.ts(2570,60): error TS2367: This comparison appears to be unintentional because the types 'ConnectionWrapper' and 'string' have no overlap.
backend/src/services/tenantDeletion.service.ts(2979,58): error TS2367: This comparison appears to be unintentional because the types 'LegalHoldRow' and 'string' have no overlap.
backend/src/services/user.service.ts(78,50): error TS2367: This comparison appears to be unintentional because the types 'DbUser' and 'string' have no overlap.
backend/src/services/user.service.ts(111,50): error TS2367: This comparison appears to be unintentional because the types 'DbUser' and 'string' have no overlap.
backend/src/types/middleware.types.ts(83,16): error TS2339: Property 'includes' does not exist on type 'boolean | string[]'.
Property 'includes' does not exist on type 'false'.
backend/src/types/middleware.types.ts(138,56): error TS2367: This comparison appears to be unintentional because the types 'ValidationMiddleware' and 'string' have no overlap.
backend/src/utils/dualLogger.ts(141,46): error TS2367: This comparison appears to be unintentional because the types 'Record<string, unknown>' and 'string' have no overlap.
backend/src/utils/emailService.ts(245,50): error TS2367: This comparison appears to be unintentional because the types 'Error' and 'string' have no overlap.
backend/src/utils/phoneValidator.ts(79,58): error TS2367: This comparison appears to be unintentional because the types 'Pool | PoolConnection' and 'string' have no overlap.
frontend/src/scripts/manage-admins.ts(662,82): error TS2339: Property 'value' does not exist on type 'Element'.
frontend/src/scripts/manage-admins.ts(1019,98): error TS2339: Property 'value' does not exist on type 'Element'.
 ELIFECYCLE  Command failed with exit code 2.
scs@SOSCSPC1M16:~/projects/Assixx/docker$ cd ..
scs@SOSCSPC1M16:~/projects/Assixx$ cd backend
scs@SOSCSPC1M16:~/projects/Assixx/backend$ pnpm run lint:fixnowarn

> assixx-backend@1.0.0 lint:fixnowarn /home/scs/projects/Assixx/backend
> eslint src/\*_/_.ts --no-warn-ignored --fix --quiet

/home/scs/projects/Assixx/backend/src/middleware/departmentAccess.ts
66:24 error Unsafe member access .departmentId on an `any` value @typescript-eslint/no-unsafe-member-access
67:48 error Unsafe member access .departmentId on an `any` value @typescript-eslint/no-unsafe-member-access

/home/scs/projects/Assixx/backend/src/middleware/features.ts
21:59 error Missing return type on function@typescript-eslint/explicit-module-boundary-types
34:126 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
37:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
40:29 error Passing a number to Number() does not change the type or value of the number@typescript-eslint/no-unnecessary-type-conversion
56:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
118:72 error Missing return type on function@typescript-eslint/explicit-module-boundary-types
122:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
125:29 error Passing a number to Number() does not change the type or value of the number@typescript-eslint/no-unnecessary-type-conversion
141:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
199:72 error Missing return type on function@typescript-eslint/explicit-module-boundary-types
203:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
206:29 error Passing a number to Number() does not change the type or value of the number@typescript-eslint/no-unnecessary-type-conversion
222:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment

/home/scs/projects/Assixx/backend/src/middleware/pageAuth.ts
203:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
204:7 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
204:20 error Unsafe return of a value of type `any`@typescript-eslint/no-unsafe-return
208:7 error Unexpected nullable boolean value in conditional. Please handle the nullish case explicitly @typescript-eslint/strict-boolean-expressions
243:8 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
257:8 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
296:8 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/middleware/role.middleware.ts
30:73 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/middleware/security-enhanced.ts
73:7 error Unexpected nullable boolean value in conditional. Please handle the nullish case explicitly @typescript-eslint/strict-boolean-expressions
103:7 error Unexpected any value in conditional. An explicit comparison or type conversion is required @typescript-eslint/strict-boolean-expressions
104:35 error Unsafe argument of type `any` assigned to a parameter of type `string | number | readonly string[]` @typescript-eslint/no-unsafe-argument
182:10 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
478:15 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
499:7 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions
527:25 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
543:21 error Forbidden non-null assertion @typescript-eslint/no-non-null-assertion
552:21 error Forbidden non-null assertion @typescript-eslint/no-non-null-assertion
552:29 error Forbidden non-null assertion @typescript-eslint/no-non-null-assertion
560:21 error Forbidden non-null assertion @typescript-eslint/no-non-null-assertion
629:9 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
629:30 error Prefer using nullish coalescing operator (`??`) instead of a logical or (`||`), as it is a safer operator @typescript-eslint/prefer-nullish-coalescing
629:34 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/middleware/security.ts
133:9 error Unexpected nullable enum value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
145:9 error Unexpected nullable boolean value in conditional. Please handle the nullish case explicitly@typescript-eslint/strict-boolean-expressions
150:9 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/middleware/tenant.ts
50:10 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
63:10 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
63:29 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
63:39 error Unsafe member access .subdomain on an `any` value@typescript-eslint/no-unsafe-member-access
64:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
64:34 error Unsafe member access .subdomain on an `any` value@typescript-eslint/no-unsafe-member-access
68:10 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
68:29 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
68:39 error Unsafe member access .tenant_id on an `any` value@typescript-eslint/no-unsafe-member-access
69:49 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
69:58 error Unsafe member access .tenant_id on an `any` value@typescript-eslint/no-unsafe-member-access
75:10 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
130:7 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
132:23 error Unsafe member access .tenant_id on an `any` value@typescript-eslint/no-unsafe-member-access
133:16 error Unsafe member access .tenant_id on an `any` value@typescript-eslint/no-unsafe-member-access

/home/scs/projects/Assixx/backend/src/middleware/tenantStatus.ts
70:10 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions
125:46 error Invalid type "never" of template literal expression@typescript-eslint/restrict-template-expressions
163:13 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions
194:10 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/middleware/validation.ts
92:3 error Missing return type on function@typescript-eslint/explicit-module-boundary-types
95:3 error Missing return type on function@typescript-eslint/explicit-module-boundary-types
98:3 error Missing return type on function@typescript-eslint/explicit-module-boundary-types
105:3 error Missing return type on function@typescript-eslint/explicit-module-boundary-types
112:3 error Missing return type on function@typescript-eslint/explicit-module-boundary-types
116:3 error Missing return type on function@typescript-eslint/explicit-module-boundary-types
121:37 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
121:63 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
271:54 error Unsafe member access .newPassword on an `any` value@typescript-eslint/no-unsafe-member-access
346:8 error Missing return type on function@typescript-eslint/explicit-module-boundary-types

/home/scs/projects/Assixx/backend/src/middleware/validators.ts
478:7 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
484:5 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
505:10 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
507:61 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/models/blackboard.ts
115:14 error Unexpected class with only static properties @typescript-eslint/no-extraneous-class
119:3 error Missing return type on function @typescript-eslint/explicit-module-boundary-types
222:13 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
225:11 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
235:13 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
334:11 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
337:9 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
398:39 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
425:11 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions
528:13 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions
631:36 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
728:13 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
731:11 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
741:13 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
961:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
962:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
963:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
964:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
965:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
966:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
967:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
968:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
969:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
970:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
971:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
972:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
973:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
974:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
975:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method

/home/scs/projects/Assixx/backend/src/models/calendar.ts
19:8 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
132:14 error Unexpected class with only static properties @typescript-eslint/no-extraneous-class
136:3 error Missing return type on function @typescript-eslint/explicit-module-boundary-types
259:13 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
262:11 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
424:11 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
427:9 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
447:49 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
455:43 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
516:36 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
516:51 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
542:9 error Unexpected nullable boolean value in conditional. Please handle the nullish case explicitly @typescript-eslint/strict-boolean-expressions
547:9 error Unexpected nullable boolean value in conditional. Please handle the nullish case explicitly @typescript-eslint/strict-boolean-expressions
548:9 error Unexpected nullable boolean value in conditional. Please handle the nullish case explicitly @typescript-eslint/strict-boolean-expressions
574:13 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
574:33 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
692:12 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions
699:9 error Unsafe argument of type `any` assigned to a parameter of type `number` @typescript-eslint/no-unsafe-argument
757:14 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
936:13 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
939:11 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
1085:19 error 'parentEvent.description' may use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
1120:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
1121:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
1122:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
1123:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
1124:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
1125:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
1126:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
1127:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
1128:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
1129:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
1130:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
1131:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method

/home/scs/projects/Assixx/backend/src/models/department.ts
67:14 error Unexpected class with only static properties@typescript-eslint/no-extraneous-class
121:39 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
151:39 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
184:45 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
233:45 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
245:45 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
265:45 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
287:65 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
306:50 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
325:44 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/models/document.ts
87:14 error Unexpected class with only static properties@typescript-eslint/no-extraneous-class
149:37 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
165:57 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
193:69 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
212:43 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
233:56 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
297:17 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
310:43 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
339:43 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
347:32 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
367:46 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
372:38 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
399:58 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
470:73 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
485:9 error Unsafe return of a value of type `any`@typescript-eslint/no-unsafe-return
488:44 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
499:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
503:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
517:38 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
587:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
592:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
597:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
607:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
612:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
617:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
664:33 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
675:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
679:13 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
696:72 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
709:7 error Unsafe return of a value of type `any`@typescript-eslint/no-unsafe-return
712:48 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
727:34 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
732:63 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
755:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
764:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
769:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
774:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
784:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
789:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
806:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
824:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
828:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
848:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
853:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
858:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
863:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
873:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
878:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
911:50 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
980:5 error Unsafe return of a value of type `any`@typescript-eslint/no-unsafe-return

/home/scs/projects/Assixx/backend/src/models/feature.ts
47:14 error Unexpected class with only static properties@typescript-eslint/no-extraneous-class
57:37 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
73:43 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
122:50 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
167:49 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
195:51 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
229:41 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
263:44 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
304:40 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
320:88 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/models/kvp.ts
145:14 error Unexpected class with only static properties@typescript-eslint/no-extraneous-class
240:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
245:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
250:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
255:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
489:12 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
500:23 error Passing a number to Number() does not change the type or value of the number@typescript-eslint/no-unnecessary-type-conversion
501:23 error Passing a number to Number() does not change the type or value of the number@typescript-eslint/no-unnecessary-type-conversion
502:30 error Passing a number to Number() does not change the type or value of the number@typescript-eslint/no-unnecessary-type-conversion
558:28 error Passing a number to Number() does not change the type or value of the number@typescript-eslint/no-unnecessary-type-conversion
559:26 error Passing a number to Number() does not change the type or value of the number@typescript-eslint/no-unnecessary-type-conversion
561:22 error Passing a number to Number() does not change the type or value of the number@typescript-eslint/no-unnecessary-type-conversion
562:19 error Passing a number to Number() does not change the type or value of the number@typescript-eslint/no-unnecessary-type-conversion
563:22 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
563:43 error Passing a number to Number() does not change the type or value of the number@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/models/machine.ts
119:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
124:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
129:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
139:9 error Unexpected nullable boolean value in conditional. Please handle the nullish case explicitly@typescript-eslint/strict-boolean-expressions
144:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
266:13 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
359:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
359:30 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/models/plan.ts
69:14 error Unexpected class with only static properties@typescript-eslint/no-extraneous-class
81:45 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
94:41 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
120:42 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
145:40 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
193:37 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
204:40 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
222:42 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
275:42 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
305:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
306:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
309:30 error Unsafe argument of type `any` assigned to a parameter of type `string` @typescript-eslint/no-unsafe-argument
310:31 error Unsafe argument of type `any` assigned to a parameter of type `string` @typescript-eslint/no-unsafe-argument
311:31 error Unsafe argument of type `any` assigned to a parameter of type `string` @typescript-eslint/no-unsafe-argument
311:54 error Unsafe argument of type `any` assigned to a parameter of type `string` @typescript-eslint/no-unsafe-argument
315:43 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/models/rootLog.ts
39:14 error Unexpected class with only static properties@typescript-eslint/no-extraneous-class
91:37 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
115:57 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
131:58 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
203:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
214:22 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
217:38 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/models/shift.ts
21:8 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
32:8 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
514:33 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
514:48 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
587:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
627:8 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
796:36 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
1251:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1256:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1256:31 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1262:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
1267:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
1272:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
1277:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1282:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1287:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
1292:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
1303:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
1306:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
1371:30 error Forbidden non-null assertion@typescript-eslint/no-non-null-assertion
1372:7 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1372:20 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1375:7 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1375:20 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1407:10 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1407:26 error Prefer using nullish coalescing operator (`??`) instead of a logical or (`||`), as it is a safer operator @typescript-eslint/prefer-nullish-coalescing
1407:29 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1407:48 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1412:11 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
1413:54 error Unsafe argument of type `any` assigned to a parameter of type `string | Date | null`@typescript-eslint/no-unsafe-argument
1446:46 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1458:44 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1470:48 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1473:46 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1476:23 error Unsafe argument of type `any` assigned to a parameter of type `string | number | Date | null`@typescript-eslint/no-unsafe-argument
1487:13 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
1634:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1634:28 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1641:13 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
1698:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
1703:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1732:10 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
1736:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
1809:33 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
1926:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
1927:32 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
1928:35 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
1929:32 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
1931:23 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
1932:23 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument

/home/scs/projects/Assixx/backend/src/models/survey.ts
164:14 error Unexpected class with only static properties@typescript-eslint/no-extraneous-class
448:10 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
455:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
482:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
642:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
645:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
645:27 error Unsafe member access .title on an `any` value@typescript-eslint/no-unsafe-member-access
646:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
646:33 error Unsafe member access .description on an `any` value@typescript-eslint/no-unsafe-member-access
647:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
647:31 error Unsafe member access .questions on an `any` value@typescript-eslint/no-unsafe-member-access
721:17 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
741:19 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
755:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
755:34 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
755:42 error Unsafe member access .map on an `any` value@typescript-eslint/no-unsafe-member-access
779:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
779:26 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
779:43 error Unsafe member access .toString on an `any` value@typescript-eslint/no-unsafe-member-access
798:17 error 'stats' is already declared in the upper scope on line 663 column 14@typescript-eslint/no-shadow
800:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
801:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
802:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
803:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
812:35 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
812:35 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
812:60 error Unsafe member access .toString on an `any` value@typescript-eslint/no-unsafe-member-access
814:20 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
814:20 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
814:49 error Unsafe member access .toString on an `any` value@typescript-eslint/no-unsafe-member-access
821:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
822:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment

/home/scs/projects/Assixx/backend/src/models/team.ts
54:14 error Unexpected class with only static properties@typescript-eslint/no-extraneous-class
76:44 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
83:28 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
91:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
98:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
103:45 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
129:39 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
167:13 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
182:39 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
202:39 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
257:63 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
278:55 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
300:53 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/models/tenant.ts
55:14 error Unexpected class with only static properties@typescript-eslint/no-extraneous-class
171:15 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
203:47 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
322:10 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
425:40 error Unsafe return of a value of type `any`@typescript-eslint/no-unsafe-return
621:49 error Unsafe argument of type `any[]` assigned to a parameter of type `number[]` @typescript-eslint/no-unsafe-argument

/home/scs/projects/Assixx/backend/src/models/user.ts
111:14 error Unexpected class with only static properties@typescript-eslint/no-extraneous-class
150:10 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
158:15 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
160:11 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
209:12 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
209:27 error Unexpected nullable boolean value in conditional. Please handle the nullish case explicitly@typescript-eslint/strict-boolean-expressions
216:17 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
218:13 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
232:44 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
247:11 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
257:44 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
296:11 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
305:38 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
347:41 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
368:11 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
377:41 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
392:47 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
446:70 error Invalid type "string | number | boolean | Date" of template literal expression@typescript-eslint/restrict-template-expressions
457:60 error Invalid type "string | number | boolean | Date" of template literal expression@typescript-eslint/restrict-template-expressions
474:41 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
477:35 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
483:47 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
516:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
521:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
526:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
531:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
544:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
567:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
588:35 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
609:63 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
630:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
635:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
640:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
645:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
660:45 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
713:42 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
733:60 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
753:57 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
808:52 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
858:56 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
935:55 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
950:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
967:37 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
994:43 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
1006:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
1011:17 error 'CountResult' is already declared in the upper scope on line 94 column 11@typescript-eslint/no-shadow
1017:45 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
1025:17 error 'CountResult' is already declared in the upper scope on line 94 column 11@typescript-eslint/no-shadow
1035:41 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
1073:41 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/routes/admin-permissions.ts
65:12 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
73:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
77:9 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
148:10 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
171:12 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
179:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
186:9 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
228:10 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
261:51 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
315:45 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
367:51 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
457:44 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
471:48 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/routes/admin.ts
250:57 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
346:40 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
430:74 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
561:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
591:71 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
763:85 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
766:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
771:47 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
862:43 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
872:47 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
880:51 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
892:44 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
918:40 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/routes/areas.ts
38:68 error Async arrow function has no 'await' expression@typescript-eslint/require-await
42:10 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
100:71 error Async arrow function has no 'await' expression@typescript-eslint/require-await
105:10 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
153:69 error Async arrow function has no 'await' expression@typescript-eslint/require-await
160:8 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
170:10 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/routes/auth.routes.ts
102:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
115:5 error Unexpected `await` of a non-Promise (non-"Thenable") value@typescript-eslint/await-thenable
115:11 error Placing a void expression inside another expression is forbidden. Move it to its own statement instead @typescript-eslint/no-confusing-void-expression
173:5 error Unexpected `await` of a non-Promise (non-"Thenable") value@typescript-eslint/await-thenable
173:11 error Placing a void expression inside another expression is forbidden. Move it to its own statement instead @typescript-eslint/no-confusing-void-expression
187:5 error Unexpected `await` of a non-Promise (non-"Thenable") value@typescript-eslint/await-thenable
187:11 error Placing a void expression inside another expression is forbidden. Move it to its own statement instead @typescript-eslint/no-confusing-void-expression

/home/scs/projects/Assixx/backend/src/routes/auth.ts
70:31 error Async arrow function has no 'await' expression @typescript-eslint/require-await
208:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
285:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
314:55 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method

/home/scs/projects/Assixx/backend/src/routes/blackboard.ts
66:26 error Operands of '+' operations must be a number or string. Got `string` + `number`@typescript-eslint/restrict-plus-operands
66:26 error Operands of '+' operations must be a number or string. Got `number` + `string`@typescript-eslint/restrict-plus-operands
173:1 error Async function 'canCreateForOrgLevel' has no 'await' expression@typescript-eslint/require-await
180:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
381:37 error 'req.query.limit ?? "3"' may use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
616:21 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
708:21 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
868:12 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/routes/calendar.ts
503:24 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
506:18 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
512:26 error Unexpected nullable boolean value in conditional. Please handle the nullish case explicitly @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/routes/department-groups.ts
61:45 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
88:43 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
127:12 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
167:47 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
233:49 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
300:47 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
355:49 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
403:50 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
442:45 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/routes/departments.ts
199:39 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
253:40 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
328:56 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
522:56 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
650:56 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
749:68 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/routes/documents.ts
95:15 error Prefer the safe `: unknown` for a `catch` callback variable@typescript-eslint/use-unknown-in-catch-callback-variable
96:12 error Unsafe argument of type `any` assigned to a parameter of type `Error | null`@typescript-eslint/no-unsafe-argument
275:16 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
281:16 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
287:16 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
303:11 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
314:14 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
343:15 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
350:12 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
358:51 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
394:21 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
430:49 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
443:38 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
448:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
448:36 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
453:47 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
580:17 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
581:15 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
611:40 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
746:39 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
815:40 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
845:38 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
875:37 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/routes/employee.ts
93:55 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
169:68 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
212:45 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
241:49 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
258:78 error 'query' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
258:78 error Invalid type "string | ParsedQs | (string | ParsedQs)[] | undefined" of template literal expression @typescript-eslint/restrict-template-expressions
260:12 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
270:16 error 'query' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
274:98 error 'query' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
274:98 error Invalid type "string | ParsedQs | (string | ParsedQs)[]" of template literal expression@typescript-eslint/restrict-template-expressions
280:67 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
314:75 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
369:50 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
384:56 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
397:102 error Invalid type "any" of template literal expression@typescript-eslint/restrict-template-expressions
413:37 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
434:83 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/routes/features.ts
117:47 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
153:44 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
173:40 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
201:38 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
226:40 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
254:40 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
302:59 error Unsafe argument of type `any` assigned to a parameter of type `number` @typescript-eslint/no-unsafe-argument
308:54 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/routes/kvp.routes.ts
25:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
30:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
36:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
38:47 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
41:45 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
44:47 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
47:50 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
54:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
60:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
67:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
72:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
79:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
84:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
95:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method

/home/scs/projects/Assixx/backend/src/routes/kvp.ts
30:26 error Operands of '+' operations must be a number or string. Got `string` + `number` @typescript-eslint/restrict-plus-operands
30:26 error Operands of '+' operations must be a number or string. Got `number` + `string` @typescript-eslint/restrict-plus-operands
134:17 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
162:27 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
209:22 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
251:20 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
323:18 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
325:20 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
326:23 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
329:27 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
330:29 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
453:29 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
454:30 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
457:32 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
461:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
465:3 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method

/home/scs/projects/Assixx/backend/src/routes/legacy.routes.ts
161:32 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions
175:32 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions
206:32 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions
218:31 error Async arrow function has no 'await' expression@typescript-eslint/require-await
303:32 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions
327:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
345:32 error Async arrow function has no 'await' expression@typescript-eslint/require-await

/home/scs/projects/Assixx/backend/src/routes/logs.ts
79:19 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
82:20 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
85:20 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
162:22 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
206:11 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
283:20 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
292:32 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
300:12 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
411:22 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
474:69 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
510:8 error Missing return type on function@typescript-eslint/explicit-module-boundary-types

/home/scs/projects/Assixx/backend/src/routes/machines.ts
42:68 error Async arrow function has no 'await' expression@typescript-eslint/require-await
66:63 error 'departmentId' may use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
87:71 error Async arrow function has no 'await' expression@typescript-eslint/require-await
120:69 error Async arrow function has no 'await' expression@typescript-eslint/require-await
132:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
134:10 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
134:19 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
145:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
146:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
147:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
148:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment

/home/scs/projects/Assixx/backend/src/routes/plans.ts
68:34 error Async arrow function has no 'await' expression@typescript-eslint/require-await
152:55 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
162:45 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
201:41 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
246:40 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
282:24 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
299:44 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
317:35 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
372:35 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
404:37 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/routes/role-switch.ts
43:34 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
56:14 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/routes/root.ts
264:15 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
323:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
502:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
1006:12 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
1486:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
1514:45 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
1661:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
1695:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
1702:41 error Invalid type "any" of template literal expression@typescript-eslint/restrict-template-expressions
1718:32 error Async arrow function has no 'await' expression@typescript-eslint/require-await

/home/scs/projects/Assixx/backend/src/routes/shifts.ts
68:17 error "early" is overridden by string in this union type@typescript-eslint/no-redundant-type-constituents
68:27 error "late" is overridden by string in this union type@typescript-eslint/no-redundant-type-constituents
68:36 error "night" is overridden by string in this union type@typescript-eslint/no-redundant-type-constituents
407:24 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
408:29 error 'req.query.department_id' may use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
410:18 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
411:29 error 'req.query.team_id' may use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
413:21 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
414:20 error 'req.query.start_date' may use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
416:19 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
416:47 error 'req.query.end_date' may use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
417:17 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
418:21 error 'req.query.status' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
420:31 error 'req.query.page ?? "1"' may use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
421:32 error 'req.query.limit ?? "20"' may use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
543:41 error 'start' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
544:39 error 'end' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
554:13 error 'query' is already declared in the upper scope on line 11 column 23@typescript-eslint/no-shadow
592:38 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
645:40 error 'week' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
659:38 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
660:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
668:42 error 'department_id' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
671:14 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly@typescript-eslint/strict-boolean-expressions
684:15 error 'query' is already declared in the upper scope on line 11 column 23@typescript-eslint/no-shadow
706:13 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
706:40 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
713:27 error Unsafe member access .type on an `any` value@typescript-eslint/no-unsafe-member-access
716:47 error Unsafe member access .data on an `any` value@typescript-eslint/no-unsafe-member-access
722:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
795:37 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
797:63 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly@typescript-eslint/strict-boolean-expressions
849:31 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
890:13 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly@typescript-eslint/strict-boolean-expressions
1039:28 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
1060:16 error 'start_date' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
1061:16 error 'end_date' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
1148:17 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
1149:21 error 'req.query.status' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
1155:32 error 'req.query.limit ?? "50"' may use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
1236:16 error 'start_date' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
1237:16 error 'end_date' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
1339:13 error 'query' is already declared in the upper scope on line 11 column 23@typescript-eslint/no-shadow
1382:32 error Async arrow function has no 'await' expression@typescript-eslint/require-await
1428:36 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
1429:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
1440:12 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly@typescript-eslint/strict-boolean-expressions
1452:16 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
1456:13 error 'query' is already declared in the upper scope on line 11 column 23@typescript-eslint/no-shadow
1509:15 error 'query' is already declared in the upper scope on line 11 column 23@typescript-eslint/no-shadow

/home/scs/projects/Assixx/backend/src/routes/surveys.ts
48:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
185:19 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
186:23 error 'status' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
188:17 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
188:40 error 'page' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
189:18 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
189:42 error 'limit' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
198:21 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
199:25 error 'status' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
201:19 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
201:42 error 'page' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
202:20 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
202:44 error 'limit' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
212:21 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
213:25 error 'status' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
215:19 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
215:42 error 'page' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
216:20 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
216:44 error 'limit' may use Object's default stringification format ('[object Object]') when stringified@typescript-eslint/no-base-to-string
339:57 error Unsafe return of a value of type `any`@typescript-eslint/no-unsafe-return
531:23 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
592:27 error Unexpected constant truthiness on the left-hand side of a `&&` expressionno-constant-binary-expression
592:36 error Unexpected constant binary expression. Compares constantly with the left-hand side of the `!==`no-constant-binary-expression
592:53 error Unexpected constant binary expression. Compares constantly with the left-hand side of the `!==`no-constant-binary-expression
594:47 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
594:81 error `substr` is deprecated. A legacy feature for browser compatibility@typescript-eslint/no-deprecated
608:29 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
627:15 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
706:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
707:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
709:15 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
710:15 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
711:17 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
714:15 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
715:15 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
716:15 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
739:22 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
739:48 error 'req.query.format' may use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
779:40 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
832:21 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
834:27 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
834:56 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
835:21 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
835:37 error Unsafe member access .forEach on an `any` value@typescript-eslint/no-unsafe-member-access
862:19 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
864:26 error Invalid type "any" of template literal expression@typescript-eslint/restrict-template-expressions
864:55 error Invalid type "any" of template literal expression@typescript-eslint/restrict-template-expressions
874:29 error Unsafe return of a value of type `any`@typescript-eslint/no-unsafe-return
880:38 error Unsafe spread of an `any[]` array type@typescript-eslint/no-unsafe-argument
881:38 error Unsafe spread of an `any[]` array type@typescript-eslint/no-unsafe-argument

/home/scs/projects/Assixx/backend/src/routes/teams.ts
219:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
221:10 error Unexpected any value in conditional. An explicit comparison or type conversion is required @typescript-eslint/strict-boolean-expressions
233:9 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
246:42 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
255:38 error Unsafe argument of type `any` assigned to a parameter of type `TeamCreateData`@typescript-eslint/no-unsafe-argument
269:42 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
315:43 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
383:48 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
500:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
511:32 error Unexpected any value in conditional. An explicit comparison or type conversion is required @typescript-eslint/strict-boolean-expressions
523:9 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
536:42 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
545:47 error Unsafe argument of type `any` assigned to a parameter of type `TeamUpdateData`@typescript-eslint/no-unsafe-argument
556:48 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
650:48 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
746:60 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
846:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
848:12 error Unexpected any value in conditional. An explicit comparison or type conversion is required @typescript-eslint/strict-boolean-expressions
862:40 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
870:18 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
877:19 error Invalid type "any" of template literal expression@typescript-eslint/restrict-template-expressions
881:43 error Invalid type "any" of template literal expression@typescript-eslint/restrict-template-expressions
888:56 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
1005:60 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/routes/unsubscribe.ts
156:59 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/routes/user.ts
56:20 error Async arrow function has no 'await' expression@typescript-eslint/require-await
138:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
145:11 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
152:9 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
159:11 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
166:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
172:11 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
182:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
184:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
185:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
186:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
187:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
250:12 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
268:12 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
311:11 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
314:11 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
314:11 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
314:11 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
314:36 error Unsafe member access .startsWith on an `any` value@typescript-eslint/no-unsafe-member-access
315:15 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
315:40 error Unsafe member access .substring on an `any` value@typescript-eslint/no-unsafe-member-access
354:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
394:11 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
397:11 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
397:11 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
397:11 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
397:36 error Unsafe member access .startsWith on an `any` value@typescript-eslint/no-unsafe-member-access
398:15 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
398:40 error Unsafe member access .substring on an `any` value@typescript-eslint/no-unsafe-member-access

/home/scs/projects/Assixx/backend/src/routes/users.ts
101:13 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
113:11 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
118:11 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
134:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
139:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
141:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
142:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
143:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
194:47 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
225:50 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
300:50 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
346:50 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
422:47 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
475:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
510:60 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
563:69 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
567:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
572:47 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
602:11 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
607:11 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
614:59 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
636:68 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
674:61 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
699:12 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
730:71 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
799:44 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/services/admin.service.ts
59:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
63:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
76:3 error Async method 'getById' has no 'await' expression@typescript-eslint/require-await
126:3 error Async method 'update' has no 'await' expression@typescript-eslint/require-await
138:3 error Async method 'delete' has no 'await' expression@typescript-eslint/require-await

/home/scs/projects/Assixx/backend/src/services/adminPermission.service.ts
150:27 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
151:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
152:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
153:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
162:44 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
169:29 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
170:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
171:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
172:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
427:11 error Unexpected any value in conditional. An explicit comparison or type conversion is required @typescript-eslint/strict-boolean-expressions
428:11 error Unexpected any value in conditional. An explicit comparison or type conversion is required @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/services/alerting.service.ts
44:10 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
104:10 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
166:9 error Unexpected constant nullishness on the left-hand side of a `??` expressionno-constant-binary-expression
166:10 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
166:42 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
186:15 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
192:15 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
214:50 error Invalid type "any" of template literal expression@typescript-eslint/restrict-template-expressions
214:64 error Unsafe member access .incident on an `any` value@typescript-eslint/no-unsafe-member-access
264:17 error Prefer the safe `: unknown` for a `catch` callback variable@typescript-eslint/use-unknown-in-catch-callback-variable
278:17 error Prefer the safe `: unknown` for a `catch` callback variable@typescript-eslint/use-unknown-in-catch-callback-variable
291:17 error Prefer the safe `: unknown` for a `catch` callback variable@typescript-eslint/use-unknown-in-catch-callback-variable

/home/scs/projects/Assixx/backend/src/services/auth.service.ts
83:15 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
88:62 error Invalid type "any" of template literal expression@typescript-eslint/restrict-template-expressions
109:9 error Forbidden non-null assertion@typescript-eslint/no-non-null-assertion
198:12 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
227:9 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
257:3 error Async method 'verifyToken' has no 'await' expression@typescript-eslint/require-await
260:12 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
458:60 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
470:12 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
482:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
483:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
484:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
485:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
486:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
487:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
488:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
489:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
490:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
500:9 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
501:9 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
508:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment

/home/scs/projects/Assixx/backend/src/services/availability.service.ts
8:3 error 'DatabaseEmployeeAvailability' is defined but never used. Allowed unused vars must match /^\_/u @typescript-eslint/no-unused-vars
41:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
46:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
51:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
51:31 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
122:14 error Returning an awaited promise is required in this context@typescript-eslint/return-await
206:15 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/services/blackboard.service.ts
107:15 error Unexpected nullish value in conditional. The condition is always false @typescript-eslint/strict-boolean-expressions
143:21 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/services/calendar.service.ts
74:3 error Async method 'getAll' has no 'await' expression @typescript-eslint/require-await
111:3 error Async method 'getById' has no 'await' expression @typescript-eslint/require-await
171:3 error Async method 'update' has no 'await' expression @typescript-eslint/require-await
207:3 error Async method 'delete' has no 'await' expression @typescript-eslint/require-await

/home/scs/projects/Assixx/backend/src/services/chat.service.ts
173:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
174:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
233:9 error Unsafe assignment of type `any[]` to a variable of type `number[]`@typescript-eslint/no-unsafe-assignment
263:39 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
340:31 error Unexpected any value in conditional. An explicit comparison or type conversion is required @typescript-eslint/strict-boolean-expressions
342:17 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
343:17 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
344:17 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
345:17 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
349:19 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
350:19 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
356:17 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
357:27 error Unsafe argument of type `any` assigned to a parameter of type `object | null`@typescript-eslint/no-unsafe-argument
411:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
455:20 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
547:9 error Unexpected value in conditional. A boolean expression is required@typescript-eslint/strict-boolean-expressions
598:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
785:12 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
789:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
790:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
792:12 error Unexpected any value in conditional. An explicit comparison or type conversion is required @typescript-eslint/strict-boolean-expressions
906:16 error Invalid type "any" of template literal expression@typescript-eslint/restrict-template-expressions
953:16 error Invalid type "any" of template literal expression@typescript-eslint/restrict-template-expressions

/home/scs/projects/Assixx/backend/src/services/departmentGroup.service.ts
172:25 error Unsafe argument of type `any` assigned to a parameter of type `number` @typescript-eslint/no-unsafe-argument
173:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
174:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
175:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
220:9 error Unsafe argument of type `any` assigned to a parameter of type `number` @typescript-eslint/no-unsafe-argument
259:32 error Unsafe argument of type `any` assigned to a parameter of type `number` @typescript-eslint/no-unsafe-argument
260:29 error Unsafe argument of type `any` assigned to a parameter of type `number` @typescript-eslint/no-unsafe-argument
262:27 error Unsafe argument of type `any` assigned to a parameter of type `number` @typescript-eslint/no-unsafe-argument
263:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
264:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
265:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
276:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
277:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
278:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
279:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
280:42 error Unsafe argument of type `any` assigned to a parameter of type `number` @typescript-eslint/no-unsafe-argument
283:22 error Unsafe argument of type `any` assigned to a parameter of type `number` @typescript-eslint/no-unsafe-argument
288:36 error Unsafe argument of type `any` assigned to a parameter of type `number` @typescript-eslint/no-unsafe-argument
293:39 error Unsafe argument of type `any` assigned to a parameter of type `number` @typescript-eslint/no-unsafe-argument
411:7 error Unsafe argument of type `any` assigned to a parameter of type `number` @typescript-eslint/no-unsafe-argument

/home/scs/projects/Assixx/backend/src/services/document.service.ts
205:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
219:11 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
282:24 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
412:3 error Async method 'getDocumentStats' has no 'await' expression@typescript-eslint/require-await
426:11 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
426:45 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/services/employee.service.ts
77:12 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/services/feature.service.ts
44:3 error Async method 'getAll' has no 'await' expression @typescript-eslint/require-await
61:3 error Async method 'getById' has no 'await' expression @typescript-eslint/require-await
75:3 error Async method 'create' has no 'await' expression @typescript-eslint/require-await
89:3 error Async method 'update' has no 'await' expression @typescript-eslint/require-await
107:3 error Async method 'delete' has no 'await' expression @typescript-eslint/require-await

/home/scs/projects/Assixx/backend/src/services/kvp.service.ts
137:3 error Async method 'getAll' has no 'await' expression @typescript-eslint/require-await
158:3 error Async method 'getById' has no 'await' expression @typescript-eslint/require-await
176:3 error Async method 'create' has no 'await' expression @typescript-eslint/require-await
194:3 error Async method 'update' has no 'await' expression @typescript-eslint/require-await
216:3 error Async method 'delete' has no 'await' expression @typescript-eslint/require-await

/home/scs/projects/Assixx/backend/src/services/kvpPermission.service.ts
93:36 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
146:36 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
184:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
193:27 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
197:9 error Unsafe argument of type `any` assigned to a parameter of type `string | number`@typescript-eslint/no-unsafe-argument
218:10 error Unexpected nullable boolean value in conditional. Please handle the nullish case explicitly@typescript-eslint/strict-boolean-expressions
223:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
234:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
273:34 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
303:11 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
304:11 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
363:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
363:18 error Computed name [row.status] resolves to an `any` value@typescript-eslint/no-unsafe-member-access
368:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
368:20 error Computed name [row.priority] resolves to an `any` value@typescript-eslint/no-unsafe-member-access
380:34 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument

/home/scs/projects/Assixx/backend/src/services/shift.service.ts
111:3 error Async method 'getAll' has no 'await' expression @typescript-eslint/require-await
133:3 error Async method 'getById' has no 'await' expression @typescript-eslint/require-await
151:3 error Async method 'create' has no 'await' expression @typescript-eslint/require-await
169:3 error Async method 'update' has no 'await' expression @typescript-eslint/require-await
191:3 error Async method 'delete' has no 'await' expression @typescript-eslint/require-await
320:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment

/home/scs/projects/Assixx/backend/src/services/survey.service.ts
165:3 error Async method 'getAll' has no 'await' expression @typescript-eslint/require-await
188:3 error Async method 'getById' has no 'await' expression @typescript-eslint/require-await
207:3 error Async method 'create' has no 'await' expression @typescript-eslint/require-await
225:3 error Async method 'update' has no 'await' expression @typescript-eslint/require-await
247:3 error Async method 'delete' has no 'await' expression @typescript-eslint/require-await

/home/scs/projects/Assixx/backend/src/services/tenant.service.ts
56:3 error Async method 'getAll' has no 'await' expression @typescript-eslint/require-await
73:3 error Async method 'getById' has no 'await' expression @typescript-eslint/require-await
103:3 error Async method 'update' has no 'await' expression @typescript-eslint/require-await
121:3 error Async method 'delete' has no 'await' expression @typescript-eslint/require-await

/home/scs/projects/Assixx/backend/src/services/tenantDeletion.service.ts
108:15 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
111:48 error Invalid type "any" of template literal expression@typescript-eslint/restrict-template-expressions
129:15 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
192:18 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
297:49 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
321:18 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
1511:14 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
1631:14 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
1681:9 error Async method 'handler' has no 'await' expression@typescript-eslint/require-await
1722:9 error Async method 'handler' has no 'await' expression@typescript-eslint/require-await
1784:12 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
1812:31 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
1820:31 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
1842:70 error Prefer the safe `: unknown` for a `catch` callback variable@typescript-eslint/use-unknown-in-catch-callback-variable
1852:16 error Prefer the safe `: unknown` for a `catch` callback variable@typescript-eslint/use-unknown-in-catch-callback-variable
1874:17 error 'QueueRow' is already declared in the upper scope on line 46 column 11@typescript-eslint/no-shadow
1888:12 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
1964:17 error Prefer the safe `: unknown` for a `catch` callback variable@typescript-eslint/use-unknown-in-catch-callback-variable
1982:12 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
2040:17 error Prefer the safe `: unknown` for a `catch` callback variable@typescript-eslint/use-unknown-in-catch-callback-variable
2109:12 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
2113:40 error Unsafe argument of type `any` assigned to a parameter of type `number`@typescript-eslint/no-unsafe-argument
2132:12 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
2136:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
2258:53 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
2359:15 error Prefer the safe `: unknown` for a `catch` callback variable@typescript-eslint/use-unknown-in-catch-callback-variable
2405:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
2445:10 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
2464:10 error Unexpected object value in conditional. The condition is always true@typescript-eslint/strict-boolean-expressions
2576:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
2582:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
2582:41 error Unsafe member access .user_count on an `any` value@typescript-eslint/no-unsafe-member-access
2590:23 error Unsafe member access .company_name on an `any` value@typescript-eslint/no-unsafe-member-access
2596:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
2596:36 error Unsafe member access .subdomain on an `any` value@typescript-eslint/no-unsafe-member-access
2597:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
2597:37 error Unsafe member access .created_at on an `any` value@typescript-eslint/no-unsafe-member-access
2598:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
2598:31 error Unsafe member access .current_plan_id on an `any` value@typescript-eslint/no-unsafe-member-access
2599:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
2599:42 error Unsafe member access .deletion_status on an `any` value@typescript-eslint/no-unsafe-member-access
2616:15 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
2630:15 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
2631:15 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
2632:15 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
2633:15 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
2812:11 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
2892:15 error Prefer the safe `: unknown` for a `catch` callback variable@typescript-eslint/use-unknown-in-catch-callback-variable
2905:15 error Prefer the safe `: unknown` for a `catch` callback variable@typescript-eslint/use-unknown-in-catch-callback-variable
3018:47 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/services/user.service.ts
89:14 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
113:14 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
136:12 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/types/middleware.types.ts
22:4 error These overloads can be combined into one signature taking `Request | AuthenticatedRequest` @typescript-eslint/unified-signatures
83:3 error Unsafe return of a value of type error@typescript-eslint/no-unsafe-return
83:10 error Unsafe call of a(n) `error` type typed value@typescript-eslint/no-unsafe-call

/home/scs/projects/Assixx/backend/src/utils/ServiceError.ts
41:9 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/utils/dualLogger.ts
142:9 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
142:37 error 'data.name' will use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
142:37 error Invalid type "{}" of template literal expression@typescript-eslint/restrict-template-expressions
143:14 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
143:43 error 'data.title' will use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
143:43 error Invalid type "{}" of template literal expression@typescript-eslint/restrict-template-expressions
144:14 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
144:43 error 'data.email' will use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
144:43 error Invalid type "{}" of template literal expression@typescript-eslint/restrict-template-expressions
145:14 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
145:46 error 'data.filename' will use Object's default stringification format ('[object Object]') when stringified @typescript-eslint/no-base-to-string
145:46 error Invalid type "{}" of template literal expression@typescript-eslint/restrict-template-expressions

/home/scs/projects/Assixx/backend/src/utils/emailService.ts
94:13 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
94:24 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
94:24 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
94:28 error Unsafe member access .toLowerCase on an `any` value@typescript-eslint/no-unsafe-member-access
94:42 error Unsafe member access .trim on an `any` value@typescript-eslint/no-unsafe-member-access
99:11 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
102:30 error Unsafe argument of type `any` assigned to a parameter of type `{ [Symbol.replace](string: string, replaceValue: string): string; }` @typescript-eslint/no-unsafe-argument
106:11 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
106:11 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
106:20 error Unsafe member access .startsWith on an `any` value@typescript-eslint/no-unsafe-member-access
107:68 error Unsafe argument of type `any` assigned to a parameter of type `string`@typescript-eslint/no-unsafe-argument
108:32 error Unsafe argument of type `any` assigned to a parameter of type `{ [Symbol.replace](string: string, replaceValue: string): string; }` @typescript-eslint/no-unsafe-argument
120:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
134:9 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
134:24 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
134:37 error Unsafe member access .replace on an `any` value@typescript-eslint/no-unsafe-member-access
138:7 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
138:22 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
138:35 error Unsafe member access .replace on an `any` value@typescript-eslint/no-unsafe-member-access
150:14 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
150:14 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
150:27 error Unsafe member access .trim on an `any` value@typescript-eslint/no-unsafe-member-access
150:46 error Invalid type "any" of template literal expression@typescript-eslint/restrict-template-expressions
282:14 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
289:36 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
296:68 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
346:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
392:11 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
394:37 error Invalid type "any" of template literal expression@typescript-eslint/restrict-template-expressions
394:42 error Unsafe member access .messageId on an `any` value@typescript-eslint/no-unsafe-member-access
395:29 error Unsafe assignment of an `any` value@typescript-eslint/no-unsafe-assignment
395:45 error Unsafe member access .messageId on an `any` value@typescript-eslint/no-unsafe-member-access
398:41 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
460:56 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
511:61 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
547:53 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
565:9 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly@typescript-eslint/strict-boolean-expressions
565:36 error Unexpected nullable boolean value in conditional. Please handle the nullish case explicitly@typescript-eslint/strict-boolean-expressions
603:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly@typescript-eslint/strict-boolean-expressions
643:63 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/utils/errorHandler.ts
17:7 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions
29:33 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/utils/fieldMapper.ts
7:9 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
7:20 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
13:11 error Type parameter T is used only once in the function signature @typescript-eslint/no-unnecessary-type-parameters
14:10 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions
44:11 error Unexpected any value in conditional. An explicit comparison or type conversion is required @typescript-eslint/strict-boolean-expressions
44:11 error Unsafe return of a value of type `any` @typescript-eslint/no-unsafe-return
59:11 error Type parameter T is used only once in the function signature @typescript-eslint/no-unnecessary-type-parameters
60:10 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions
85:11 error Unexpected any value in conditional. An explicit comparison or type conversion is required @typescript-eslint/strict-boolean-expressions
85:11 error Unsafe return of a value of type `any` @typescript-eslint/no-unsafe-return

/home/scs/projects/Assixx/backend/src/utils/fieldMapping.ts
2:9 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
2:20 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
2:29 error Avoid referencing unbound methods which may cause unintentional scoping of `this`.
If your function does not access `this`, you can annotate it with `this: void`, or consider using an arrow function instead @typescript-eslint/unbound-method
9:25 error Type parameter T is used only once in the function signature @typescript-eslint/no-unnecessary-type-parameters
20:25 error Type parameter T is used only once in the function signature @typescript-eslint/no-unnecessary-type-parameters
35:7 error Unexpected any value in conditional. An explicit comparison or type conversion is required @typescript-eslint/strict-boolean-expressions
38:7 error Unexpected any value in conditional. An explicit comparison or type conversion is required @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/utils/getCurrentDir.ts
13:42 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/utils/helpers.ts
115:8 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
131:8 error Unexpected value in conditional. A boolean expression is required @typescript-eslint/strict-boolean-expressions
160:3 error Unsafe return of a value of type `any`@typescript-eslint/no-unsafe-return
181:10 error Unexpected object value in conditional. The condition is always true @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/utils/logger.ts
38:18 error Invalid type "unknown" of template literal expression@typescript-eslint/restrict-template-expressions
38:32 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion
38:65 error Invalid type "unknown" of template literal expression@typescript-eslint/restrict-template-expressions
40:18 error Passing a string to String() does not change the type or value of the string @typescript-eslint/no-unnecessary-type-conversion

/home/scs/projects/Assixx/backend/src/utils/multitenantValidator.ts
19:8 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/utils/pathSecurity.ts
46:44 error Invalid type "unknown" of template literal expression@typescript-eslint/restrict-template-expressions
91:8 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
147:10 error Unexpected nullable boolean value in conditional. Please handle the nullish case explicitly @typescript-eslint/strict-boolean-expressions
167:46 error Invalid type "unknown" of template literal expression@typescript-eslint/restrict-template-expressions

/home/scs/projects/Assixx/backend/src/utils/phoneValidator.ts
13:8 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
26:8 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
69:15 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions
73:18 error Unexpected nullable number value in conditional. Please handle the nullish/zero/NaN cases explicitly @typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/utils/routeHandlers.ts
166:30 error Type parameter T is used only once in the function signature @typescript-eslint/no-unnecessary-type-parameters
276:35 error Type parameter T is used only once in the function signature @typescript-eslint/no-unnecessary-type-parameters

/home/scs/projects/Assixx/backend/src/utils/session-security.ts
21:14 error Unexpected class with only static properties@typescript-eslint/no-extraneous-class
28:3 error Static async method 'checkSession' has no 'await' expression @typescript-eslint/require-await
60:3 error Static async method 'logSecurityEvent' has no 'await' expression @typescript-eslint/require-await

/home/scs/projects/Assixx/backend/src/utils/typeHelpers.ts
53:8 error Missing return type on function@typescript-eslint/explicit-module-boundary-types
61:9 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
69:50 error Unsafe return of a value of type `any`@typescript-eslint/no-unsafe-return
69:50 error Unsafe call of a(n) `any` typed value@typescript-eslint/no-unsafe-call
69:57 error Unsafe member access .toUpperCase on an `any` value@typescript-eslint/no-unsafe-member-access
76:48 error Passing a string to String() does not change the type or value of the string@typescript-eslint/no-unnecessary-type-conversion
82:30 error Type parameter T is used only once in the function signature@typescript-eslint/no-unnecessary-type-parameters
108:30 error Type parameter T is used only once in the function signature@typescript-eslint/no-unnecessary-type-parameters

/home/scs/projects/Assixx/backend/src/utils/validators.ts
136:10 error Unexpected nullable string value in conditional. Please handle the nullish/empty cases explicitly @typescript-eslint/strict-boolean-expressions
181:8 error Unexpected any value in conditional. An explicit comparison or type conversion is required@typescript-eslint/strict-boolean-expressions

/home/scs/projects/Assixx/backend/src/workers/deletionWorker.ts
158:23 error Prefer the safe `: unknown` for a `catch` callback variable @typescript-eslint/use-unknown-in-catch-callback-variable

✖ 1097 problems (1097 errors, 0 warnings)

 ELIFECYCLE  Command failed with exit code 1.
scs@SOSCSPC1M16:~/projects/Assixx/backend$
