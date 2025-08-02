scs@SOSCSPC1M16:~/projects/Assixx/docker$docker exec assixx-backend pnpm test --verbose --forceExit --detectOpenHandles

> assixx@1.0.0 test /app
> node --experimental-vm-modules node_modules/jest/bin/jest.js --config jest.config.js --verbose --forceExit --detectOpenHandles

🧹 Pre-test cleanup: Removing old test data...
✅ No leftover test data found
(node:1569) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
info: User created successfully with ID: 31313 {"service":"assixx-backend","timestamp":"2025-08-02 20:15:55"}
info: Updating field first_name to value: Updated {"service":"assixx-backend","timestamp":"2025-08-02 20:15:55"}
info: Updating field last_name to value: Name {"service":"assixx-backend","timestamp":"2025-08-02 20:15:55"}
info: Updating field position to value: Senior Developer {"service":"assixx-backend","timestamp":"2025-08-02 20:15:55"}
info: Executing update query: UPDATE users SET `first_name` = ?, `last_name` = ?, `position` = ? WHERE id = ? AND tenant_id = ? {"service":"assixx-backend","timestamp":"2025-08-02 20:15:55"}
info: With values: ["Updated","Name","Senior Developer",31313,5021] {"service":"assixx-backend","timestamp":"2025-08-02 20:15:55"}
PASS backend/src/routes/v2/users/users.service.integration.test.ts
UsersService Integration Tests
createUser
✓ should create user successfully (220 ms)
✓ should throw error for duplicate email (23 ms)
getUserById
✓ should return user when found (3 ms)
✓ should throw error when user not found (6 ms)
updateUser
✓ should update user fields (29 ms)
listUsers
✓ should return paginated users (14 ms)
✓ should filter by search term (7 ms)
deleteUser
✓ should prevent self-deletion (5 ms)
✓ should delete user successfully (14 ms)

PASS backend/src/routes/v2/users/users.service.logic.test.ts
UsersService Logic Tests
ServiceError
✓ should create ServiceError with correct properties (3 ms)
✓ should use default status code 500 (1 ms)
✓ should include details when provided (2 ms)
Error Code Constants
✓ should have proper error codes (1 ms)
Business Logic Validation
✓ should validate pagination parameters (1 ms)
✓ should validate limit parameters (1 ms)
✓ should calculate pagination metadata (1 ms)
✓ should validate sort parameters (1 ms)
✓ should validate sort order (1 ms)
Field Mapping Logic
✓ should map database fields to API fields (1 ms)
✓ should map API fields to database fields (5 ms)
Password Validation
✓ should validate password requirements (1 ms)
Email Validation
✓ should validate email format (1 ms)
Employee Number Generation
✓ should generate employee number in correct format (1 ms)

PASS backend/src/routes/v2/users/users.service.simple.test.ts
UsersService - Simple Test
ServiceError
✓ should create ServiceError with correct properties (2 ms)
✓ should use default status code 500 (1 ms)
✓ should include details when provided (2 ms)

PASS backend/src/routes/v2/calendar/calendar.service.logic.test.ts
Calendar Service Business Logic
Date Validation Logic
✓ should validate that end time is after start time (2 ms)
✓ should detect invalid date order (4 ms)
✓ should handle all-day events (1 ms)
Organization Level Validation
✓ should require orgId for department events (1 ms)
✓ should require orgId for team events (1 ms)
✓ should not require orgId for personal events (1 ms)
✓ should not require orgId for company events (1 ms)
Pagination Logic
✓ should calculate correct page values (1 ms)
✓ should handle invalid page numbers (1 ms)
✓ should limit maximum page size (1 ms)
✓ should calculate offset correctly (2 ms)
✓ should calculate total pages
✓ should determine hasNext correctly
✓ should determine hasPrev correctly (1 ms)
Color Validation
✓ should validate hex color format (4 ms)
✓ should reject invalid color formats (1 ms)
Recurrence Rule Logic
✓ should parse recurrence pattern (1 ms)
✓ should calculate interval days for patterns
✓ should parse COUNT option (1 ms)
✓ should parse UNTIL option (1 ms)
Sort Field Mapping
✓ should map API field names to DB field names (1 ms)
✓ should default to start_date for invalid sort field (1 ms)
Attendee Response Validation
✓ should validate attendee response values (1 ms)
✓ should reject invalid response values (1 ms)
Permission Logic
✓ should allow owner to manage event
✓ should allow admin to manage any event
✓ should allow manager to manage any event (1 ms)
✓ should not allow non-owner employee to manage
Export Format Logic
✓ should format CSV row correctly (1 ms)
✓ should escape CSV fields with quotes (1 ms)
✓ should format ICS date correctly (1 ms)
✓ should generate unique UID for ICS (1 ms)
Time Calculation Logic
✓ should calculate event duration (1 ms)
✓ should handle weekday recurrence
✓ should calculate monthly recurrence (1 ms)
✓ should calculate yearly recurrence (1 ms)
Filter Logic
✓ should map filter to event type (1 ms)
✓ should handle date range filtering
✓ should handle search term matching

PASS backend/src/routes/v2/calendar/calendar.service.simple.test.ts
Calendar ServiceError
Error Creation
✓ should create ServiceError with correct properties (2 ms)
✓ should create ServiceError with details (1 ms)
✓ should handle different error codes
Error Type Checking
✓ should identify ServiceError correctly
✓ should handle null and undefined (1 ms)
✓ should handle other types (1 ms)
Calendar-Specific Errors
✓ should create date validation error (1 ms)
✓ should create permission error (1 ms)
✓ should create conflict error (1 ms)
✓ should create attendee error
Error Serialization
✓ should convert to JSON properly (1 ms)
✓ should handle error without details (1 ms)
Calendar Data Validation
✓ should validate ISO date format (1 ms)
✓ should detect invalid dates (1 ms)
✓ should validate organization levels (1 ms)
✓ should validate event status (1 ms)

PASS backend/src/utils/**tests**/errorHandler.test.ts
errorHandler
getErrorMessage
✓ should extract message from Error object (2 ms)
✓ should extract message from object with message property (1 ms)
✓ should convert string error to message
✓ should handle number error (1 ms)
✓ should handle null error (1 ms)
✓ should handle undefined error
✓ should handle MySQL error format (1 ms)
✓ should handle empty object (1 ms)
✓ should handle array error (4 ms)
✓ should handle boolean error
✓ should handle Error with empty message (1 ms)
✓ should NOT trim whitespace from error messages (1 ms)

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

FAIL backend/src/routes/v2/users/**tests**/users-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "inactive" | "suspended" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2.test.ts.

FAIL backend/src/routes/v2/users/**tests**/users-v2-simple.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/users/**tests**/users-v2-debug-archive.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2-debug-archive.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2-debug-archive.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/users/**tests**/users-v2-debug-archive.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/teams/**tests**/teams-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/teams/**tests**/teams-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/teams/**tests**/teams-v2.test.ts.

FAIL backend/src/routes/v2/teams/**tests**/teams-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/settings/**tests**/settings-v2-fixed.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/settings/**tests**/settings-v2-fixed.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/settings/**tests**/settings-v2-fixed.test.ts.

FAIL backend/src/routes/v2/settings/**tests**/settings-v2-fixed.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/role-switch/**tests**/role-switch-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/role-switch/**tests**/role-switch-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/role-switch/**tests**/role-switch-v2.test.ts.

FAIL backend/src/routes/v2/role-switch/**tests**/role-switch-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/plans/**tests**/plans-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/plans/**tests**/plans-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/plans/**tests**/plans-v2.test.ts.

FAIL backend/src/routes/v2/plans/**tests**/plans-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/reports/**tests**/reports-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/reports/**tests**/reports-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/reports/**tests**/reports-v2.test.ts.

FAIL backend/src/routes/v2/reports/**tests**/reports-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/notifications/**tests**/notifications-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/notifications/**tests**/notifications-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/notifications/**tests**/notifications-v2.test.ts.

FAIL backend/src/routes/v2/notifications/**tests**/notifications-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/machines/**tests**/machines-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/machines/**tests**/machines-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/machines/**tests**/machines-v2.test.ts.

FAIL backend/src/routes/v2/machines/**tests**/machines-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/features/**tests**/features-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/features/**tests**/features-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/features/**tests**/features-v2.test.ts.

FAIL backend/src/routes/v2/features/**tests**/features-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/documents/**tests**/documents-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/documents/**tests**/documents-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/documents/**tests**/documents-v2.test.ts.

FAIL backend/src/routes/v2/documents/**tests**/documents-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/departments/**tests**/departments-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/departments/**tests**/departments-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/departments/**tests**/departments-v2.test.ts.

FAIL backend/src/routes/v2/departments/**tests**/departments-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/blackboard/**tests**/blackboard-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/blackboard/**tests**/blackboard-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/blackboard/**tests**/blackboard-v2.test.ts.

FAIL backend/src/routes/v2/blackboard/**tests**/blackboard-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/chat/**tests**/chat-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/chat/**tests**/chat-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/chat/**tests**/chat-v2.test.ts.

FAIL backend/src/routes/v2/chat/**tests**/chat-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/calendar/**tests**/calendar-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/calendar/**tests**/calendar-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/calendar/**tests**/calendar-v2.test.ts.

FAIL backend/src/routes/v2/calendar/**tests**/calendar-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/calendar/**tests**/calendar-v2-simple.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/calendar/**tests**/calendar-v2-simple.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/calendar/**tests**/calendar-v2-simple.test.ts.

FAIL backend/src/routes/v2/calendar/**tests**/calendar-v2-simple.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/calendar/**tests**/calendar-v2-debug.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/calendar/**tests**/calendar-v2-debug.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/calendar/**tests**/calendar-v2-debug.test.ts.

FAIL backend/src/routes/v2/calendar/**tests**/calendar-v2-debug.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/auth/**tests**/auth-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/auth/**tests**/auth-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/auth/**tests**/auth-v2.test.ts.

FAIL backend/src/routes/v2/auth/**tests**/auth-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/audit-trail/**tests**/audit-trail-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/audit-trail/**tests**/audit-trail-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/audit-trail/**tests**/audit-trail-v2.test.ts.

FAIL backend/src/routes/v2/audit-trail/**tests**/audit-trail-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/**tests**/surveys-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/**tests**/surveys-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/**tests**/surveys-v2.test.ts.

FAIL backend/src/routes/v2/**tests**/surveys-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/**tests**/shifts-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/**tests**/shifts-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/**tests**/shifts-v2.test.ts.

FAIL backend/src/routes/v2/**tests**/shifts-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/**tests**/kvp-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/**tests**/kvp-v2.test.ts.

ReferenceError: You are trying to `import` a file after the Jest environment has been torn down. From backend/src/routes/v2/**tests**/kvp-v2.test.ts.

FAIL backend/src/routes/v2/**tests**/kvp-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

Summary of all failing tests
FAIL backend/src/routes/v2/users/**tests**/users-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "inactive" | "suspended" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/users/**tests**/users-v2-simple.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/users/**tests**/users-v2-debug-archive.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/teams/**tests**/teams-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/settings/**tests**/settings-v2-fixed.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/role-switch/**tests**/role-switch-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/plans/**tests**/plans-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.

Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
Types of property 'currentPlan' are incompatible.
Type 'string | null' is not assignable to type 'string | undefined'.
Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/reports/**tests**/reports-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/notifications/**tests**/notifications-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/machines/**tests**/machines-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/features/**tests**/features-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.

Type 'string | null' is not assignable to type 'string | undefined'.
Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/documents/**tests**/documents-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/departments/**tests**/departments-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/blackboard/**tests**/blackboard-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/chat/**tests**/chat-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/calendar/**tests**/calendar-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/calendar/**tests**/calendar-v2-simple.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/calendar/**tests**/calendar-v2-debug.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId:admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/auth/**tests**/auth-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/audit-trail/**tests**/audit-trail-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/**tests**/surveys-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/**tests**/shifts-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

FAIL backend/src/routes/v2/**tests**/kvp-v2.test.ts
● Test suite failed to run

    backend/src/routes/v2/root/root.service.ts:83:7 - error TS2322: Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }[]' is not assignable to type 'AdminUser[]'.
      Type '{ id: number; username: string; email: string; firstName: string; lastName: string; company: string | undefined; notes: string | undefined; isActive: boolean; tenantId: number | undefined; tenantName: string | undefined; createdAt: Date; updatedAt: Date; lastLogin: Date | undefined; }' is not assignable to type 'AdminUser'.
        Types of property 'tenantId' are incompatible.
          Type 'number | undefined' is not assignable to type 'number'.
            Type 'undefined' is not assignable to type 'number'.

    83       return adminsWithTenants;
             ~~~~~~
    backend/src/routes/v2/root/root.service.ts:123:9 - error TS2322: Type 'number | undefined' is not assignable to type 'number'.
      Type 'undefined' is not assignable to type 'number'.

    123         tenantId: admin.tenant_id,
       ~~~~~~~~
    backend/src/routes/v2/root/root.service.ts:260:7 - error TS2322: Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }[]' is not assignable to type 'AdminLog[]'.
      Type '{ id: number; userId: number; action: string; entityType: string | undefined; entityId: number | undefined; description: any; ipAddress: string | undefined; userAgent: string | undefined; createdAt: Date; }' is not assignable to type 'AdminLog'.
        Types of property 'entityType' are incompatible.
          Type 'string | undefined' is not assignable to type 'string'.
            Type 'undefined' is not assignable to type 'string'.

    260       return logs.map((log) => ({
              ~~~~~~
    backend/src/routes/v2/root/root.service.ts:325:7 - error TS2322: Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: "active" | "suspended" | "inactive" | "deleted"; maxUsers: number | undefined; maxAdmins: number | undefined; ... 6 more ...; storageUsed: any; }[]' is not assignable to type 'Tenant[]'.
      Type '{ id: number; companyName: string; subdomain: string; currentPlan: string | null; status: Tenant["status"]; maxUsers: number | undefined; maxAdmins: number | undefined; industry: string | undefined; ... 5 more ...; storageUsed: any; }' is not assignable to type 'Tenant'.
        Types of property 'currentPlan' are incompatible.
          Type 'string | null' is not assignable to type 'string | undefined'.
            Type 'null' is not assignable to type 'string | undefined'.

    325       return tenantsWithCounts;
              ~~~~~~

Test Suites: 23 failed, 6 passed, 29 total
Tests: 93 passed, 93 total
Snapshots: 0 total
Time: 47.559 s
Ran all test suites.

🧹 Running global test cleanup...
✅ Global cleanup complete. Remaining test tenants: 0
 ELIFECYCLE  Test failed. See above for more details.
scs@SOSCSPC1M16:~/projects/Assixx/docker$
