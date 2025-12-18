# Tech Stack Context

**NOW USING:**

- API V2 (no V1 fallback)
- PostgreSQL 17.7 + `pg` library v8.16.3
- `uuid` v13.0.0 (UUIDv7 everywhere - DB records AND files)
- `is_active` INTEGER status: `0`=inactive, `1`=active, `3`=archive, `4`=deleted (soft delete)

---

just for context

:~/projects/Assixx/docker$ docker exec assixx-backend sh -c "pnpm run format && pnpm run lint:fix && pnpm run type-check"

> assixx@1.0.0 format /app
> prettier --write .

.prettierrc.json 22ms (unchanged)
backend/docs/FINAL-TYPESCRIPT-MIGRATION-SUMMARY.md 49ms (unchanged)
backend/docs/MIGRATION-STATUS.md 53ms (unchanged)
backend/docs/TYPED_ROUTES_MIGRATION.md 11ms (unchanged)
backend/docs/TYPESCRIPT-DB-UTILITIES.md 111ms (unchanged)
backend/docs/ZOD-INTEGRATION-GUIDE.md 129ms (unchanged)
backend/package.json 4ms (unchanged)
backend/README.md 11ms (unchanged)
backend/scripts/create-feature-tables.js 29ms (unchanged)
backend/scripts/fix-tenant-admins.js 17ms (unchanged)
backend/scripts/generate-controllers.js 18ms (unchanged)
backend/scripts/send-bulk-email.js 17ms (unchanged)
backend/scripts/setup/setup-database.js 14ms (unchanged)
backend/scripts/setup/setup-tenant.js 21ms (unchanged)
backend/scripts/setup/setup-tenants.js 5ms (unchanged)
backend/src/app.ts 18ms (unchanged)
backend/src/config/database.ts 67ms (unchanged)
backend/src/config/redis.ts 8ms (unchanged)
backend/src/config/tenants.ts 8ms (unchanged)
backend/src/config/token.config.ts 3ms (unchanged)
backend/src/database/migrations/add_survey_feature.js 12ms (unchanged)
backend/src/database/tenantDb.ts 17ms (unchanged)
backend/src/loaders/api-routes.ts 9ms (unchanged)
backend/src/loaders/error-handler.ts 10ms (unchanged)
backend/src/loaders/express.ts 5ms (unchanged)
backend/src/loaders/health.ts 7ms (unchanged)
backend/src/loaders/index.ts 3ms (unchanged)
backend/src/loaders/login-redirect.ts 3ms (unchanged)
backend/src/loaders/middleware.ts 8ms (unchanged)
backend/src/loaders/page-routes.ts 16ms (unchanged)
backend/src/loaders/rate-limiting.ts 15ms (unchanged)
backend/src/loaders/security.ts 19ms (unchanged)
backend/src/loaders/static-files.ts 17ms (unchanged)
backend/src/middleware/auth.ts 39ms (unchanged)
backend/src/middleware/departmentAccess.ts 35ms (unchanged)
backend/src/middleware/features.ts 34ms (unchanged)
backend/src/middleware/pageAuth.ts 23ms (unchanged)
backend/src/middleware/rateLimiter.ts 20ms (unchanged)
backend/src/middleware/role.middleware.ts 4ms (unchanged)
backend/src/middleware/security-enhanced.ts 51ms (unchanged)
backend/src/middleware/security.ts 23ms (unchanged)
backend/src/middleware/tenant.ts 24ms (unchanged)
backend/src/middleware/tenantIsolation.ts 10ms (unchanged)
backend/src/middleware/tenantStatus.ts 20ms (unchanged)
backend/src/middleware/v2/auth.middleware.ts 15ms (unchanged)
backend/src/middleware/v2/roleCheck.middleware.ts 3ms (unchanged)
backend/src/middleware/v2/security.middleware.ts 9ms (unchanged)
backend/src/middleware/validation.zod.ts 16ms (unchanged)
backend/src/models/blackboard.ts 95ms (unchanged)
backend/src/models/calendar.ts 1ms (unchanged)
backend/src/models/calendar/calendar.attendees.ts 7ms (unchanged)
backend/src/models/calendar/calendar.crud.ts 24ms (unchanged)
backend/src/models/calendar/calendar.recurring.ts 12ms (unchanged)
backend/src/models/calendar/calendar.types.ts 13ms (unchanged)
backend/src/models/calendar/calendar.utils.ts 31ms (unchanged)
backend/src/models/calendar/index.ts 4ms (unchanged)
backend/src/models/department.ts 24ms (unchanged)
backend/src/models/document.ts 70ms (unchanged)
backend/src/models/feature.ts 18ms (unchanged)
backend/src/models/kvp.ts 49ms (unchanged)
backend/src/models/machine.ts 25ms (unchanged)
backend/src/models/plan.ts 22ms (unchanged)
backend/src/models/rootLog.ts 17ms (unchanged)
backend/src/models/shift-core.ts 38ms (unchanged)
backend/src/models/shift-types.ts 15ms (unchanged)
backend/src/models/shift-v2.ts 40ms (unchanged)
backend/src/models/shift.ts 6ms (unchanged)
backend/src/models/survey.ts 51ms (unchanged)
backend/src/models/team.ts 24ms (unchanged)
backend/src/models/tenant.ts 36ms (unchanged)
backend/src/models/user/index.ts 6ms (unchanged)
backend/src/models/user/user.availability.ts 4ms (unchanged)
backend/src/models/user/user.crud.ts 25ms (unchanged)
backend/src/models/user/user.profile.ts 9ms (unchanged)
backend/src/models/user/user.stats.ts 12ms (unchanged)
backend/src/models/user/user.types.ts 7ms (unchanged)
backend/src/models/user/user.utils.ts 13ms (unchanged)
backend/src/routes/pages/html.routes.ts 18ms (unchanged)
backend/src/routes/v2/admin-permissions/controller.ts 23ms (unchanged)
backend/src/routes/v2/admin-permissions/index.ts 6ms (unchanged)
backend/src/routes/v2/admin-permissions/service.ts 26ms (unchanged)
backend/src/routes/v2/admin-permissions/types.ts 3ms (unchanged)
backend/src/routes/v2/areas/areas.controller.ts 20ms (unchanged)
backend/src/routes/v2/areas/areas.service.ts 30ms (unchanged)
backend/src/routes/v2/areas/areas.validation.zod.ts 6ms (unchanged)
backend/src/routes/v2/areas/index.ts 9ms (unchanged)
backend/src/routes/v2/areas/types.ts 6ms (unchanged)
backend/src/routes/v2/audit-trail/audit-trail.controller.ts 37ms (unchanged)
backend/src/routes/v2/audit-trail/audit-trail.service.ts 27ms (unchanged)
backend/src/routes/v2/audit-trail/audit-trail.validation.zod.ts 10ms (unchanged)
backend/src/routes/v2/audit-trail/index.ts 6ms (unchanged)
backend/src/routes/v2/audit-trail/types.ts 6ms (unchanged)
backend/src/routes/v2/auth/auth.controller.ts 21ms (unchanged)
backend/src/routes/v2/auth/auth.validation.zod.ts 7ms (unchanged)
backend/src/routes/v2/auth/index.ts 3ms (unchanged)
backend/src/routes/v2/blackboard/blackboard.controller.ts 32ms (unchanged)
backend/src/routes/v2/blackboard/blackboard.service.ts 21ms (unchanged)
backend/src/routes/v2/blackboard/blackboard.validation.zod.ts 10ms (unchanged)
backend/src/routes/v2/blackboard/index.ts 12ms (unchanged)
backend/src/routes/v2/calendar/calendar.controller.ts 29ms (unchanged)
backend/src/routes/v2/calendar/calendar.service.ts 27ms (unchanged)
backend/src/routes/v2/calendar/calendar.validation.zod.ts 12ms (unchanged)
backend/src/routes/v2/calendar/index.ts 3ms (unchanged)
backend/src/routes/v2/chat/chat-conversations.service.ts 24ms (unchanged)
backend/src/routes/v2/chat/chat-messages.service.ts 17ms (unchanged)
backend/src/routes/v2/chat/chat-users.service.ts 6ms (unchanged)
backend/src/routes/v2/chat/chat.controller.ts 29ms (unchanged)
backend/src/routes/v2/chat/chat.service.ts 3ms (unchanged)
backend/src/routes/v2/chat/chat.types.ts 8ms (unchanged)
backend/src/routes/v2/chat/index.ts 20ms (unchanged)
backend/src/routes/v2/chat/WEBSOCKET-NOTES.md 11ms (unchanged)
backend/src/routes/v2/department-groups/controller.ts 15ms (unchanged)
backend/src/routes/v2/department-groups/index.ts 5ms (unchanged)
backend/src/routes/v2/department-groups/service.ts 27ms (unchanged)
backend/src/routes/v2/department-groups/types.ts 6ms (unchanged)
backend/src/routes/v2/departments/departments.controller.ts 27ms (unchanged)
backend/src/routes/v2/departments/departments.service.ts 32ms (unchanged)
backend/src/routes/v2/departments/departments.validation.zod.ts 8ms (unchanged)
backend/src/routes/v2/departments/index.ts 7ms (unchanged)
backend/src/routes/v2/documents/documents.controller.ts 34ms (unchanged)
backend/src/routes/v2/documents/documents.service.ts 34ms (unchanged)
backend/src/routes/v2/documents/documents.validation.zod.ts 15ms (unchanged)
backend/src/routes/v2/documents/index.ts 3ms (unchanged)
backend/src/routes/v2/features/features.controller.ts 18ms (unchanged)
backend/src/routes/v2/features/features.service.ts 26ms (unchanged)
backend/src/routes/v2/features/features.validation.zod.ts 11ms (unchanged)
backend/src/routes/v2/features/index.ts 4ms (unchanged)
backend/src/routes/v2/features/types.ts 8ms (unchanged)
backend/src/routes/v2/kvp/index.ts 11ms (unchanged)
backend/src/routes/v2/kvp/kvp.controller.ts 47ms (unchanged)
backend/src/routes/v2/kvp/kvp.service.ts 31ms (unchanged)
backend/src/routes/v2/kvp/kvp.validation.zod.ts 13ms (unchanged)
backend/src/routes/v2/machines/index.ts 8ms (unchanged)
backend/src/routes/v2/machines/machines.controller.ts 23ms (unchanged)
backend/src/routes/v2/machines/machines.service.ts 35ms (unchanged)
backend/src/routes/v2/machines/types.ts 6ms (unchanged)
backend/src/routes/v2/machines/validation.zod.ts 14ms (unchanged)
backend/src/routes/v2/notifications/index.ts 5ms (unchanged)
backend/src/routes/v2/notifications/notifications.controller.ts 23ms (unchanged)
backend/src/routes/v2/notifications/notifications.service.ts 26ms (unchanged)
backend/src/routes/v2/notifications/notifications.validation.zod.ts 12ms (unchanged)
backend/src/routes/v2/notifications/sse.controller.ts 17ms (unchanged)
backend/src/routes/v2/notifications/types.ts 2ms (unchanged)
backend/src/routes/v2/plans/index.ts 1ms (unchanged)
backend/src/routes/v2/plans/plans.controller.ts 13ms (unchanged)
backend/src/routes/v2/plans/plans.service.ts 20ms (unchanged)
backend/src/routes/v2/plans/types.ts 5ms (unchanged)
backend/src/routes/v2/reports/index.ts 5ms (unchanged)
backend/src/routes/v2/reports/reports-employee.service.ts 7ms (unchanged)
backend/src/routes/v2/reports/reports-export.service.ts 10ms (unchanged)
backend/src/routes/v2/reports/reports-kvp.service.ts 10ms (unchanged)
backend/src/routes/v2/reports/reports-metrics.service.ts 13ms (unchanged)
backend/src/routes/v2/reports/reports-other.service.ts 13ms (unchanged)
backend/src/routes/v2/reports/reports-overview.service.ts 5ms (unchanged)
backend/src/routes/v2/reports/reports-shift.service.ts 11ms (unchanged)
backend/src/routes/v2/reports/reports.controller.ts 20ms (unchanged)
backend/src/routes/v2/reports/reports.service.ts 2ms (unchanged)
backend/src/routes/v2/reports/reports.types.ts 5ms (unchanged)
backend/src/routes/v2/reports/reports.validation.zod.ts 13ms (unchanged)
backend/src/routes/v2/role-switch/index.ts 3ms (unchanged)
backend/src/routes/v2/role-switch/role-switch.controller.ts 10ms (unchanged)
backend/src/routes/v2/role-switch/role-switch.service.ts 14ms (unchanged)
backend/src/routes/v2/role-switch/validation.zod.ts 3ms (unchanged)
backend/src/routes/v2/roles/controller.ts 8ms (unchanged)
backend/src/routes/v2/roles/index.ts 7ms (unchanged)
backend/src/routes/v2/roles/service.ts 7ms (unchanged)
backend/src/routes/v2/roles/types.ts 5ms (unchanged)
backend/src/routes/v2/roles/validation.zod.ts 5ms (unchanged)
backend/src/routes/v2/root/index.ts 17ms (unchanged)
backend/src/routes/v2/root/root.controller.ts 34ms (unchanged)
backend/src/routes/v2/root/root.service.ts 45ms (unchanged)
backend/src/routes/v2/root/types.ts 9ms (unchanged)
backend/src/routes/v2/root/validation.zod.ts 24ms (unchanged)
backend/src/routes/v2/settings/index.ts 4ms (unchanged)
backend/src/routes/v2/settings/settings.controller.ts 31ms (unchanged)
backend/src/routes/v2/settings/settings.service.ts 39ms (unchanged)
backend/src/routes/v2/settings/types.ts 3ms (unchanged)
backend/src/routes/v2/shifts/index.ts 12ms (unchanged)
backend/src/routes/v2/shifts/kontischicht.service.ts 39ms (unchanged)
backend/src/routes/v2/shifts/rotation.controller.ts 15ms (unchanged)
backend/src/routes/v2/shifts/rotation.service.ts 34ms (unchanged)
backend/src/routes/v2/shifts/rotation.types.ts 4ms (unchanged)
backend/src/routes/v2/shifts/shift-plans.service.ts 23ms (unchanged)
backend/src/routes/v2/shifts/shifts.controller.ts 42ms (unchanged)
backend/src/routes/v2/shifts/shifts.service.ts 48ms (unchanged)
backend/src/routes/v2/shifts/shifts.validation.zod.ts 17ms (unchanged)
backend/src/routes/v2/signup/controller.ts 11ms (unchanged)
backend/src/routes/v2/signup/index.ts 5ms (unchanged)
backend/src/routes/v2/signup/service.ts 10ms (unchanged)
backend/src/routes/v2/signup/types.ts 3ms (unchanged)
backend/src/routes/v2/signup/validation.zod.ts 8ms (unchanged)
backend/src/routes/v2/surveys/index.ts 5ms (unchanged)
backend/src/routes/v2/surveys/responses.controller.ts 16ms (unchanged)
backend/src/routes/v2/surveys/responses.service.ts 40ms (unchanged)
backend/src/routes/v2/surveys/responses.validation.zod.ts 12ms (unchanged)
backend/src/routes/v2/surveys/surveys.controller.ts 15ms (unchanged)
backend/src/routes/v2/surveys/surveys.service.ts 33ms (unchanged)
backend/src/routes/v2/surveys/surveys.validation.zod.ts 12ms (unchanged)
backend/src/routes/v2/teams/index.ts 8ms (unchanged)
backend/src/routes/v2/teams/teams.controller.ts 34ms (unchanged)
backend/src/routes/v2/teams/teams.service.ts 29ms (unchanged)
backend/src/routes/v2/teams/teams.validation.zod.ts 8ms (unchanged)
backend/src/routes/v2/users/index.ts 10ms (unchanged)
backend/src/routes/v2/users/users.controller.ts 34ms (unchanged)
backend/src/routes/v2/users/users.service.ts 32ms (unchanged)
backend/src/routes/v2/users/users.types.ts 4ms (unchanged)
backend/src/routes/v2/users/users.validation.zod.ts 13ms (unchanged)
backend/src/schemas/common.schema.ts 16ms (unchanged)
backend/src/server.ts 8ms (unchanged)
backend/src/services/admin.service.ts 7ms (unchanged)
backend/src/services/adminPermission.service.ts 24ms (unchanged)
backend/src/services/alerting.service.ts 18ms (unchanged)
backend/src/services/availability.service.ts 14ms (unchanged)
backend/src/services/blackboard.service.ts 9ms (unchanged)
backend/src/services/calendar.service.ts 13ms (unchanged)
backend/src/services/chat.service.ts 38ms (unchanged)
backend/src/services/department.service.ts 6ms (unchanged)
backend/src/services/departmentGroup.service.ts 23ms (unchanged)
backend/src/services/employee.service.ts 7ms (unchanged)
backend/src/services/feature.service.ts 7ms (unchanged)
backend/src/services/kvp.service.ts 13ms (unchanged)
backend/src/services/kvpPermission.service.ts 22ms (unchanged)
backend/src/services/shift.service.ts 26ms (unchanged)
backend/src/services/survey.service.ts 15ms (unchanged)
backend/src/services/team.service.ts 13ms (unchanged)
backend/src/services/tenant.service.ts 6ms (unchanged)
backend/src/services/tenantDeletion.service.ts 35ms (unchanged)
backend/src/services/user.service.ts 13ms (unchanged)
backend/src/types/api.d.ts 6ms (unchanged)
backend/src/types/auth.types.ts 3ms (unchanged)
backend/src/types/database-rows.types.ts 31ms (unchanged)
backend/src/types/database.types.ts 4ms (unchanged)
backend/src/types/express-extensions.d.ts 7ms (unchanged)
backend/src/types/express.d.ts 3ms (unchanged)
backend/src/types/index.ts 3ms (unchanged)
backend/src/types/middleware.types.ts 10ms (unchanged)
backend/src/types/models.d.ts 12ms (unchanged)
backend/src/types/query-results.types.ts 17ms (unchanged)
backend/src/types/request.types.ts 8ms (unchanged)
backend/src/types/response.types.ts 11ms (unchanged)
backend/src/types/security.types.ts 14ms (unchanged)
backend/src/types/tenant.types.ts 2ms (unchanged)
backend/src/utils/apiResponse.ts 4ms (unchanged)
backend/src/utils/constants.ts 5ms (unchanged)
backend/src/utils/db.ts 10ms (unchanged)
backend/src/utils/dbWrapper.ts 5ms (unchanged)
backend/src/utils/emailService.ts 35ms (unchanged)
backend/src/utils/employeeIdGenerator.ts 4ms (unchanged)
backend/src/utils/errorHandler.ts 2ms (unchanged)
backend/src/utils/errors.ts 4ms (unchanged)
backend/src/utils/eventBus.ts 6ms (unchanged)
backend/src/utils/fieldMapper.ts 11ms (unchanged)
backend/src/utils/fieldMapping.ts 4ms (unchanged)
backend/src/utils/getCurrentDir.ts 3ms (unchanged)
backend/src/utils/helpers.ts 11ms (unchanged)
backend/src/utils/logger.ts 7ms (unchanged)
backend/src/utils/pathSecurity.ts 6ms (unchanged)
backend/src/utils/routeHandlers.ts 14ms (unchanged)
backend/src/utils/ServiceError.ts 3ms (unchanged)
backend/src/utils/typeHelpers.ts 10ms (unchanged)
backend/src/utils/uploadMiddleware.ts 5ms (unchanged)
backend/src/websocket.ts 52ms (unchanged)
backend/src/workers/deletionWorker.ts 12ms (unchanged)
backend/src/workers/start-deletion-worker.js 3ms (unchanged)
backend/templates/email/new-document.html 69ms (unchanged)
backend/templates/email/notification.html 15ms (unchanged)
backend/templates/email/welcome.html 16ms (unchanged)
backend/tsconfig.build.json 2ms (unchanged)
backend/tsconfig.eslint.json 1ms (unchanged)
backend/tsconfig.json 5ms (unchanged)
backend/tsconfig.test.json 1ms (unchanged)
backend/tsdoc.json 4ms (unchanged)
eslint.config.js 34ms (unchanged)
frontend/.prettierrc.json 2ms (unchanged)
frontend/app.css 18ms (unchanged)
frontend/package.json 1ms (unchanged)
frontend/postcss.config.js 4ms (unchanged)
frontend/src/design-system/components/card/card.css 15ms (unchanged)
frontend/src/design-system/components/confirm-modal/confirm-modal.css 19ms (unchanged)
frontend/src/design-system/components/confirm-modal/README.md 31ms (unchanged)
frontend/src/design-system/index.css 2ms (unchanged)
frontend/src/design-system/primitives/avatar/avatar.css 19ms (unchanged)
frontend/src/design-system/primitives/avatar/avatar.js 8ms (unchanged)
frontend/src/design-system/primitives/avatar/index.css 1ms (unchanged)
frontend/src/design-system/primitives/avatar/README.md 13ms (unchanged)
frontend/src/design-system/primitives/badges/badge.action.css 6ms (unchanged)
frontend/src/design-system/primitives/badges/badge.base.css 3ms (unchanged)
frontend/src/design-system/primitives/badges/badge.count.css 7ms (unchanged)
frontend/src/design-system/primitives/badges/badge.kvp.css 6ms (unchanged)
frontend/src/design-system/primitives/badges/badge.process.css 3ms (unchanged)
frontend/src/design-system/primitives/badges/badge.role.css 3ms (unchanged)
frontend/src/design-system/primitives/badges/badge.status.css 6ms (unchanged)
frontend/src/design-system/primitives/badges/badge.workflow.css 10ms (unchanged)
frontend/src/design-system/primitives/badges/index.css 1ms (unchanged)
frontend/src/design-system/primitives/badges/README.md 30ms (unchanged)
frontend/src/design-system/primitives/buttons/ACTION-ICONS.md 18ms (unchanged)
frontend/src/design-system/primitives/buttons/button.action-icons.css 8ms (unchanged)
frontend/src/design-system/primitives/buttons/button.base.css 4ms (unchanged)
frontend/src/design-system/primitives/buttons/button.danger.css 3ms (unchanged)
frontend/src/design-system/primitives/buttons/button.dark.css 4ms (unchanged)
frontend/src/design-system/primitives/buttons/button.edit.css 4ms (unchanged)
frontend/src/design-system/primitives/buttons/button.effects.css 8ms (unchanged)
frontend/src/design-system/primitives/buttons/button.float.css 11ms (unchanged)
frontend/src/design-system/primitives/buttons/button.info.css 4ms (unchanged)
frontend/src/design-system/primitives/buttons/button.light.css 6ms (unchanged)
frontend/src/design-system/primitives/buttons/button.link.css 5ms (unchanged)
frontend/src/design-system/primitives/buttons/button.manage.css 5ms (unchanged)
frontend/src/design-system/primitives/buttons/button.modal.css 5ms (unchanged)
frontend/src/design-system/primitives/buttons/button.primary-first.css 2ms (unchanged)
frontend/src/design-system/primitives/buttons/button.primary.css 3ms (unchanged)
frontend/src/design-system/primitives/buttons/button.secondary.css 4ms (unchanged)
frontend/src/design-system/primitives/buttons/button.sizes.css 3ms (unchanged)
frontend/src/design-system/primitives/buttons/button.status.css 3ms (unchanged)
frontend/src/design-system/primitives/buttons/button.success.css 2ms (unchanged)
frontend/src/design-system/primitives/buttons/button.upload.css 3ms (unchanged)
frontend/src/design-system/primitives/buttons/button.warning.css 6ms (unchanged)
frontend/src/design-system/primitives/buttons/index.css 1ms (unchanged)
frontend/src/design-system/primitives/buttons/README.md 44ms (unchanged)
frontend/src/design-system/primitives/cards/card-accent.css 3ms (unchanged)
frontend/src/design-system/primitives/cards/card-base.css 4ms (unchanged)
frontend/src/design-system/primitives/cards/card-stat.css 6ms (unchanged)
frontend/src/design-system/primitives/cards/index.css 1ms (unchanged)
frontend/src/design-system/primitives/cards/README.md 25ms (unchanged)
frontend/src/design-system/primitives/choice-cards/choice-card.base.css 10ms (unchanged)
frontend/src/design-system/primitives/choice-cards/choice-card.feature.css 10ms (unchanged)
frontend/src/design-system/primitives/choice-cards/choice-card.plan.css 11ms (unchanged)
frontend/src/design-system/primitives/choice-cards/index.css 1ms (unchanged)
frontend/src/design-system/primitives/choice-cards/README.md 47ms (unchanged)
frontend/src/design-system/primitives/collapse/collapse.css 8ms (unchanged)
frontend/src/design-system/primitives/collapse/index.css 1ms (unchanged)
frontend/src/design-system/primitives/containers/container.base.css 3ms (unchanged)
frontend/src/design-system/primitives/containers/index.css 1ms (unchanged)
frontend/src/design-system/primitives/containers/README.md 18ms (unchanged)
frontend/src/design-system/primitives/data-display/data-list.css 5ms (unchanged)
frontend/src/design-system/primitives/data-display/empty-state.css 4ms (unchanged)
frontend/src/design-system/primitives/data-display/index.css 1ms (unchanged)
frontend/src/design-system/primitives/data-display/README.md 62ms (unchanged)
frontend/src/design-system/primitives/data-display/table.base.css 3ms (unchanged)
frontend/src/design-system/primitives/data-display/table.bordered.css 2ms (unchanged)
frontend/src/design-system/primitives/data-display/table.borderless.css 1ms (unchanged)
frontend/src/design-system/primitives/data-display/table.compact.css 2ms (unchanged)
frontend/src/design-system/primitives/data-display/table.hover.css 1ms (unchanged)
frontend/src/design-system/primitives/data-display/table.striped.css 1ms (unchanged)
frontend/src/design-system/primitives/dropdowns/custom-dropdown.css 7ms (unchanged)
frontend/src/design-system/primitives/dropdowns/index.css 1ms (unchanged)
frontend/src/design-system/primitives/dropdowns/README.md 20ms (unchanged)
frontend/src/design-system/primitives/empty-states/empty-state.css 8ms (unchanged)
frontend/src/design-system/primitives/empty-states/index.css 1ms (unchanged)
frontend/src/design-system/primitives/feedback/alert.base.css 7ms (unchanged)
frontend/src/design-system/primitives/feedback/alert.variants.css 8ms (unchanged)
frontend/src/design-system/primitives/feedback/index.css 1ms (unchanged)
frontend/src/design-system/primitives/feedback/progress.css 9ms (unchanged)
frontend/src/design-system/primitives/feedback/README.md 62ms (unchanged)
frontend/src/design-system/primitives/feedback/skeleton.css 10ms (unchanged)
frontend/src/design-system/primitives/feedback/spinner.css 12ms (unchanged)
frontend/src/design-system/primitives/feedback/toast.css 16ms (unchanged)
frontend/src/design-system/primitives/file-upload/file-upload-list.css 10ms (unchanged)
frontend/src/design-system/primitives/file-upload/file-upload-zone.css 10ms (unchanged)
frontend/src/design-system/primitives/file-upload/index.css 1ms (unchanged)
frontend/src/design-system/primitives/file-upload/README.md 11ms (unchanged)
frontend/src/design-system/primitives/forms/form.base.css 12ms (unchanged)
frontend/src/design-system/primitives/forms/index.css 1ms (unchanged)
frontend/src/design-system/primitives/forms/multi-select.css 9ms (unchanged)
frontend/src/design-system/primitives/forms/password-toggle.css 3ms (unchanged)
frontend/src/design-system/primitives/forms/README.md 9ms (unchanged)
frontend/src/design-system/primitives/modals/index.css 1ms (unchanged)
frontend/src/design-system/primitives/modals/modal.base.css 11ms (unchanged)
frontend/src/design-system/primitives/modals/README.md 33ms (unchanged)
frontend/src/design-system/primitives/navigation/accordion.css 9ms (unchanged)
frontend/src/design-system/primitives/navigation/breadcrumb.css 2ms (unchanged)
frontend/src/design-system/primitives/navigation/index.css 1ms (unchanged)
frontend/src/design-system/primitives/navigation/pagination.css 5ms (unchanged)
frontend/src/design-system/primitives/navigation/README.md 49ms (unchanged)
frontend/src/design-system/primitives/navigation/stepper.css 7ms (unchanged)
frontend/src/design-system/primitives/navigation/tabs.css 7ms (unchanged)
frontend/src/design-system/primitives/pickers/date-picker.css 9ms (unchanged)
frontend/src/design-system/primitives/pickers/date-range.css 4ms (unchanged)
frontend/src/design-system/primitives/pickers/index.css 1ms (unchanged)
frontend/src/design-system/primitives/pickers/README.md 56ms (unchanged)
frontend/src/design-system/primitives/pickers/time-picker.css 9ms (unchanged)
frontend/src/design-system/primitives/search-input/index.css 1ms (unchanged)
frontend/src/design-system/primitives/search-input/README.md 10ms (unchanged)
frontend/src/design-system/primitives/search-input/search-input.css 11ms (unchanged)
frontend/src/design-system/primitives/toggles/index.css 1ms (unchanged)
frontend/src/design-system/primitives/toggles/README.md 14ms (unchanged)
frontend/src/design-system/primitives/toggles/toggle-button-group.css 3ms (unchanged)
frontend/src/design-system/primitives/toggles/toggle-switch.css 12ms (unchanged)
frontend/src/design-system/primitives/tooltip/index.css 1ms (unchanged)
frontend/src/design-system/primitives/tooltip/tooltip.css 12ms (unchanged)
frontend/src/design-system/README.md 47ms (unchanged)
frontend/src/design-system/tokens/animations.css 4ms (unchanged)
frontend/src/design-system/tokens/colors.css 4ms (unchanged)
frontend/src/design-system/tokens/forms.css 3ms (unchanged)
frontend/src/design-system/tokens/gradients.css 2ms (unchanged)
frontend/src/design-system/tokens/index.css 1ms (unchanged)
frontend/src/design-system/tokens/shadows.css 5ms (unchanged)
frontend/src/pages/.claude/agents/ide-issues-resolver.md 30ms (unchanged)
frontend/src/pages/account-settings.html 17ms (unchanged)
frontend/src/pages/admin-dashboard.html 14ms (unchanged)
frontend/src/pages/admin-profile.html 11ms (unchanged)
frontend/src/pages/blackboard.html 34ms (unchanged)
frontend/src/pages/calendar.html 6ms (unchanged)
frontend/src/pages/chat.html 26ms (unchanged)
frontend/src/pages/design-system-demo.html 13ms (unchanged)
frontend/src/pages/documents-explorer.html 20ms (unchanged)
frontend/src/pages/employee-dashboard.html 17ms (unchanged)
frontend/src/pages/employee-profile.html 11ms (unchanged)
frontend/src/pages/index.html 34ms (unchanged)
frontend/src/pages/kvp-detail.html 14ms (unchanged)
frontend/src/pages/kvp.html 15ms (unchanged)
frontend/src/pages/login.html 6ms (unchanged)
frontend/src/pages/logs.html 33ms (unchanged)
frontend/src/pages/manage-admins.html 16ms (unchanged)
frontend/src/pages/manage-areas.html 10ms (unchanged)
frontend/src/pages/manage-department-groups.html 11ms (unchanged)
frontend/src/pages/manage-departments.html 14ms (unchanged)
frontend/src/pages/manage-employees.html 15ms (unchanged)
frontend/src/pages/manage-machines.html 11ms (unchanged)
frontend/src/pages/manage-root.html 13ms (unchanged)
frontend/src/pages/manage-teams.html 13ms (unchanged)
frontend/src/pages/rate-limit.html 5ms (unchanged)
frontend/src/pages/root-dashboard.html 5ms (unchanged)
frontend/src/pages/root-features.html 9ms (unchanged)
frontend/src/pages/root-profile.html 10ms (unchanged)
frontend/src/pages/shifts.html 28ms (unchanged)
frontend/src/pages/signup.html 13ms (unchanged)
frontend/src/pages/storage-upgrade.html 10ms (unchanged)
frontend/src/pages/survey-admin.html 14ms (unchanged)
frontend/src/pages/survey-employee.html 8ms (unchanged)
frontend/src/pages/survey-results.html 3ms (unchanged)
frontend/src/pages/tenant-deletion-status.html 38ms (unchanged)
frontend/src/scripts/account-settings/api.ts 6ms (unchanged)
frontend/src/scripts/account-settings/index.ts 15ms (unchanged)
frontend/src/scripts/account-settings/types.ts 2ms (unchanged)
frontend/src/scripts/account-settings/ui.ts 8ms (unchanged)
frontend/src/scripts/admin/areas.ts 36ms (unchanged)
frontend/src/scripts/admin/dashboard/index.ts 24ms (unchanged)
frontend/src/scripts/admin/dashboard/init.ts 3ms (unchanged)
frontend/src/scripts/admin/dashboard/services.ts 17ms (unchanged)
frontend/src/scripts/admin/dashboard/types.ts 4ms (unchanged)
frontend/src/scripts/admin/dashboard/ui.ts 16ms (unchanged)
frontend/src/scripts/admin/profile/data.ts 5ms (unchanged)
frontend/src/scripts/admin/profile/forms.ts 24ms (unchanged)
frontend/src/scripts/admin/profile/index.ts 4ms (unchanged)
frontend/src/scripts/admin/profile/types.ts 2ms (unchanged)
frontend/src/scripts/admin/profile/ui.ts 9ms (unchanged)
frontend/src/scripts/auth/index.ts 19ms (unchanged)
frontend/src/scripts/auth/login-api.ts 9ms (unchanged)
frontend/src/scripts/auth/login-form-controller.ts 8ms (unchanged)
frontend/src/scripts/auth/login-pre-check.ts 5ms (unchanged)
frontend/src/scripts/auth/login-token-validator.ts 3ms (unchanged)
frontend/src/scripts/auth/role-switch.ts 14ms (unchanged)
frontend/src/scripts/auth/signup-api.ts 4ms (unchanged)
frontend/src/scripts/auth/signup-dropdown.ts 8ms (unchanged)
frontend/src/scripts/auth/signup-form-controller.ts 14ms (unchanged)
frontend/src/scripts/auth/signup-validators.ts 6ms (unchanged)
frontend/src/scripts/blackboard/core.ts 59ms (unchanged)
frontend/src/scripts/blackboard/index.ts 1ms (unchanged)
frontend/src/scripts/blackboard/modal.js 18ms (unchanged)
frontend/src/scripts/blackboard/types.ts 3ms (unchanged)
frontend/src/scripts/blackboard/ui-helpers.ts 36ms (unchanged)
frontend/src/scripts/blackboard/widget.js 13ms (unchanged)
frontend/src/scripts/calendar/api.ts 28ms (unchanged)
frontend/src/scripts/calendar/filters.ts 8ms
frontend/src/scripts/calendar/fullcalendar-loader.ts 11ms (unchanged)
frontend/src/scripts/calendar/index.ts 54ms (unchanged)
frontend/src/scripts/calendar/modals.ts 12ms (unchanged)
frontend/src/scripts/calendar/state.ts 11ms (unchanged)
frontend/src/scripts/calendar/types.ts 5ms (unchanged)
frontend/src/scripts/calendar/ui.ts 21ms (unchanged)
frontend/src/scripts/chat/index.ts 117ms (unchanged)
frontend/src/scripts/components/blackboard-widget.ts 5ms (unchanged)
frontend/src/scripts/components/breadcrumb-config.js 11ms (unchanged)
frontend/src/scripts/components/breadcrumb.js 11ms (unchanged)
frontend/src/scripts/components/dropdowns.js 1ms (unchanged)
frontend/src/scripts/components/header-user-info.ts 8ms (unchanged)
frontend/src/scripts/components/modals.js 3ms (unchanged)
frontend/src/scripts/components/tooltips.js 1ms (unchanged)
frontend/src/scripts/components/types/api.types.js 1ms (unchanged)
frontend/src/scripts/components/types/utils.types.js 1ms (unchanged)
frontend/src/scripts/components/unified-navigation.ts 110ms (unchanged)
frontend/src/scripts/dashboard/common.ts 9ms (unchanged)
frontend/src/scripts/dashboard/employee.ts 16ms (unchanged)
frontend/src/scripts/dashboard/root-init.ts 2ms (unchanged)
frontend/src/scripts/dashboard/root.ts 23ms (unchanged)
frontend/src/scripts/documents/explorer/api.ts 10ms (unchanged)
frontend/src/scripts/documents/explorer/grid.ts 16ms (unchanged)
frontend/src/scripts/documents/explorer/index.ts 10ms (unchanged)
frontend/src/scripts/documents/explorer/list.ts 16ms (unchanged)
frontend/src/scripts/documents/explorer/modal.ts 14ms (unchanged)
frontend/src/scripts/documents/explorer/permissions.ts 10ms (unchanged)
frontend/src/scripts/documents/explorer/router.ts 8ms (unchanged)
frontend/src/scripts/documents/explorer/sidebar.ts 7ms (unchanged)
frontend/src/scripts/documents/explorer/state.ts 15ms (unchanged)
frontend/src/scripts/documents/explorer/toolbar.ts 9ms (unchanged)
frontend/src/scripts/documents/explorer/types.ts 6ms (unchanged)
frontend/src/scripts/documents/explorer/upload-modal.ts 25ms (unchanged)
frontend/src/scripts/documents/shared/api.ts 3ms (unchanged)
frontend/src/scripts/documents/shared/types.ts 1ms (unchanged)
frontend/src/scripts/documents/shared/ui-helpers.ts 5ms (unchanged)
frontend/src/scripts/employee/dashboard/init.ts 11ms (unchanged)
frontend/src/scripts/employee/profile/data.ts 4ms (unchanged)
frontend/src/scripts/employee/profile/forms.ts 23ms (unchanged)
frontend/src/scripts/employee/profile/index.ts 4ms (unchanged)
frontend/src/scripts/employee/profile/types.ts 2ms (unchanged)
frontend/src/scripts/employee/profile/ui.ts 7ms (unchanged)
frontend/src/scripts/features/data.ts 12ms (unchanged)
frontend/src/scripts/features/index.ts 13ms (unchanged)
frontend/src/scripts/features/types.ts 2ms (unchanged)
frontend/src/scripts/features/ui.ts 11ms (unchanged)
frontend/src/scripts/kvp/api.ts 5ms (unchanged)
frontend/src/scripts/kvp/data.ts 13ms (unchanged)
frontend/src/scripts/kvp/forms.ts 14ms (unchanged)
frontend/src/scripts/kvp/index.ts 16ms (unchanged)
frontend/src/scripts/kvp/types.ts 3ms (unchanged)
frontend/src/scripts/kvp/ui.ts 14ms (unchanged)
frontend/src/scripts/landing/form-handler.ts 5ms (unchanged)
frontend/src/scripts/landing/form-validator.ts 3ms (unchanged)
frontend/src/scripts/landing/index.ts 3ms (unchanged)
frontend/src/scripts/landing/signup-modal.ts 2ms (unchanged)
frontend/src/scripts/main.ts 8ms (unchanged)
frontend/src/scripts/manage/admins/data.ts 12ms (unchanged)
frontend/src/scripts/manage/admins/forms.ts 39ms (unchanged)
frontend/src/scripts/manage/admins/index.ts 25ms (unchanged)
frontend/src/scripts/manage/admins/types.ts 3ms (unchanged)
frontend/src/scripts/manage/admins/ui.ts 9ms (unchanged)
frontend/src/scripts/manage/areas/api.ts 9ms (unchanged)
frontend/src/scripts/manage/areas/forms.ts 14ms (unchanged)
frontend/src/scripts/manage/areas/index.ts 27ms (unchanged)
frontend/src/scripts/manage/areas/types.ts 2ms (unchanged)
frontend/src/scripts/manage/areas/ui.ts 17ms (unchanged)
frontend/src/scripts/manage/department-groups/api.ts 7ms (unchanged)
frontend/src/scripts/manage/department-groups/forms.ts 11ms (unchanged)
frontend/src/scripts/manage/department-groups/index.ts 28ms (unchanged)
frontend/src/scripts/manage/department-groups/types.ts 3ms (unchanged)
frontend/src/scripts/manage/department-groups/ui.ts 6ms (unchanged)
frontend/src/scripts/manage/departments/api.ts 5ms (unchanged)
frontend/src/scripts/manage/departments/forms.ts 7ms (unchanged)
frontend/src/scripts/manage/departments/index.ts 32ms (unchanged)
frontend/src/scripts/manage/departments/types.ts 2ms (unchanged)
frontend/src/scripts/manage/departments/ui.ts 12ms (unchanged)
frontend/src/scripts/manage/employees/data.ts 9ms (unchanged)
frontend/src/scripts/manage/employees/forms.ts 19ms (unchanged)
frontend/src/scripts/manage/employees/index.ts 30ms (unchanged)
frontend/src/scripts/manage/employees/types.ts 4ms (unchanged)
frontend/src/scripts/manage/employees/ui.ts 14ms (unchanged)
frontend/src/scripts/manage/machines/data.ts 7ms (unchanged)
frontend/src/scripts/manage/machines/forms.ts 13ms (unchanged)
frontend/src/scripts/manage/machines/index.ts 17ms (unchanged)
frontend/src/scripts/manage/machines/types.ts 3ms (unchanged)
frontend/src/scripts/manage/machines/ui.ts 12ms (unchanged)
frontend/src/scripts/manage/root-users.ts 23ms (unchanged)
frontend/src/scripts/manage/root/data.ts 5ms (unchanged)
frontend/src/scripts/manage/root/forms.ts 25ms (unchanged)
frontend/src/scripts/manage/root/index.ts 11ms (unchanged)
frontend/src/scripts/manage/root/types.ts 3ms (unchanged)
frontend/src/scripts/manage/root/ui.ts 7ms (unchanged)
frontend/src/scripts/manage/teams/data.ts 8ms (unchanged)
frontend/src/scripts/manage/teams/forms.ts 8ms (unchanged)
frontend/src/scripts/manage/teams/index.ts 24ms (unchanged)
frontend/src/scripts/manage/teams/types.ts 3ms (unchanged)
frontend/src/scripts/manage/teams/ui.ts 27ms (unchanged)
frontend/src/scripts/pages/kvp-detail/actions.ts 12ms (unchanged)
frontend/src/scripts/pages/kvp-detail/data-loader.ts 5ms (unchanged)
frontend/src/scripts/pages/kvp-detail/index.ts 10ms (unchanged)
frontend/src/scripts/pages/kvp-detail/permissions.ts 6ms (unchanged)
frontend/src/scripts/pages/kvp-detail/renderer.ts 17ms (unchanged)
frontend/src/scripts/pages/kvp-detail/share-modal.ts 9ms (unchanged)
frontend/src/scripts/pages/kvp-detail/ui.ts 27ms (unchanged)
frontend/src/scripts/rate-limit/rate-limit-controller.ts 5ms (unchanged)
frontend/src/scripts/root/profile/data.ts 9ms (unchanged)
frontend/src/scripts/root/profile/forms.ts 24ms (unchanged)
frontend/src/scripts/root/profile/index.ts 7ms (unchanged)
frontend/src/scripts/root/profile/types.ts 2ms (unchanged)
frontend/src/scripts/root/profile/ui.ts 11ms (unchanged)
frontend/src/scripts/services/notification.service.ts 12ms (unchanged)
frontend/src/scripts/services/storage.service.ts 6ms (unchanged)
frontend/src/scripts/shifts/calendar-integration.ts 9ms (unchanged)
frontend/src/scripts/shifts/index.ts 238ms (unchanged)
frontend/src/scripts/shifts/kontischicht-types.ts 5ms (unchanged)
frontend/src/scripts/shifts/kontischicht.ts 73ms (unchanged)
frontend/src/scripts/storage/storage-upgrade-controller.ts 10ms (unchanged)
frontend/src/scripts/survey/admin/data.ts 9ms (unchanged)
frontend/src/scripts/survey/admin/forms.ts 40ms (unchanged)
frontend/src/scripts/survey/admin/index.ts 15ms (unchanged)
frontend/src/scripts/survey/admin/types.ts 5ms (unchanged)
frontend/src/scripts/survey/admin/ui.ts 20ms (unchanged)
frontend/src/scripts/survey/employee/data.ts 6ms (unchanged)
frontend/src/scripts/survey/employee/forms.ts 21ms (unchanged)
frontend/src/scripts/survey/employee/index.ts 9ms (unchanged)
frontend/src/scripts/survey/employee/types.ts 2ms (unchanged)
frontend/src/scripts/survey/employee/ui.ts 12ms (unchanged)
frontend/src/scripts/survey/results/data.ts 6ms (unchanged)
frontend/src/scripts/survey/results/index.ts 8ms (unchanged)
frontend/src/scripts/survey/results/types.ts 4ms (unchanged)
frontend/src/scripts/survey/results/ui.ts 19ms (unchanged)
frontend/src/scripts/utils/alerts.ts 7ms (unchanged)
frontend/src/scripts/utils/browser-fingerprint.js 9ms (unchanged)
frontend/src/scripts/utils/browser-fingerprint.ts 14ms (unchanged)
frontend/src/scripts/utils/session-manager.ts 25ms (unchanged)
frontend/src/scripts/utils/sse-client.ts 8ms (unchanged)
frontend/src/styles/account-settings.css 3ms (unchanged)
frontend/src/styles/admin-dashboard.css 7ms (unchanged)
frontend/src/styles/admin-profile.css 4ms (unchanged)
frontend/src/styles/alerts.css 2ms (unchanged)
frontend/src/styles/base/variables.css 1ms (unchanged)
frontend/src/styles/blackboard-widget.css 11ms (unchanged)
frontend/src/styles/blackboard.css 78ms (unchanged)
frontend/src/styles/bootstrap-override.css 2ms (unchanged)
frontend/src/styles/breadcrumb-alignment.css 2ms (unchanged)
frontend/src/styles/calendar.css 27ms (unchanged)
frontend/src/styles/chat-icons.css 2ms (unchanged)
frontend/src/styles/chat.css 51ms (unchanged)
frontend/src/styles/container-padding-fix.css 0ms (unchanged)
frontend/src/styles/dashboard-theme.css 31ms (unchanged)
frontend/src/styles/design-system/index.css 1ms (unchanged)
frontend/src/styles/design-system/variables-contrast.css 7ms (unchanged)
frontend/src/styles/design-system/variables-dark.css 8ms (unchanged)
frontend/src/styles/design-system/variables-light.css 7ms (unchanged)
frontend/src/styles/documents-explorer.css 6ms (unchanged)
frontend/src/styles/employee-dashboard.css 12ms (unchanged)
frontend/src/styles/employee-profile.css 4ms (unchanged)
frontend/src/styles/feature-management.css 8ms (unchanged)
frontend/src/styles/fonts-outfit.css 1ms (unchanged)
frontend/src/styles/index.css 24ms (unchanged)
frontend/src/styles/kvp-detail.css 11ms (unchanged)
frontend/src/styles/kvp.css 10ms (unchanged)
frontend/src/styles/login.css 13ms (unchanged)
frontend/src/styles/logs.css 18ms (unchanged)
frontend/src/styles/main.css 1ms (unchanged)
frontend/src/styles/manage-admins.css 1ms (unchanged)
frontend/src/styles/manage-areas.css 1ms (unchanged)
frontend/src/styles/manage-department-groups.css 5ms (unchanged)
frontend/src/styles/manage-employees.css 0ms (unchanged)
frontend/src/styles/manage-machines.css 0ms (unchanged)
frontend/src/styles/manage-root.css 1ms (unchanged)
frontend/src/styles/manage-teams.css 1ms (unchanged)
frontend/src/styles/password-strength.css 7ms (unchanged)
frontend/src/styles/profile-picture.css 7ms (unchanged)
frontend/src/styles/rate-limit.css 2ms (unchanged)
frontend/src/styles/root-dashboard.css 2ms (unchanged)
frontend/src/styles/root-features.css 7ms (unchanged)
frontend/src/styles/root-profile.css 5ms (unchanged)
frontend/src/styles/shifts.css 85ms (unchanged)
frontend/src/styles/signup.css 21ms (unchanged)
frontend/src/styles/storage-upgrade.css 7ms (unchanged)
frontend/src/styles/style.css 4ms (unchanged)
frontend/src/styles/survey-admin.css 6ms (unchanged)
frontend/src/styles/survey-employee.css 6ms (unchanged)
frontend/src/styles/survey-results.css 5ms (unchanged)
frontend/src/styles/tailwind.css 6ms (unchanged)
frontend/src/styles/tailwind/base.css 5ms (unchanged)
frontend/src/styles/tailwind/compat/bootstrap-buttons.css 5ms (unchanged)
frontend/src/styles/tailwind/compat/bootstrap-forms.css 6ms (unchanged)
frontend/src/styles/tailwind/compat/bootstrap-modals.css 6ms (unchanged)
frontend/src/styles/tailwind/compat/bootstrap-tables.css 8ms (unchanged)
frontend/src/styles/tailwind/components/container.css 1ms (unchanged)
frontend/src/styles/tailwind/components/glass.css 7ms (unchanged)
frontend/src/styles/tailwind/utilities.css 6ms (unchanged)
frontend/src/styles/tenant-deletion-status.css 11ms (unchanged)
frontend/src/styles/unified-navigation.css 32ms (unchanged)
frontend/src/styles/user-info-update.css 4ms (unchanged)
frontend/src/types/api.types.ts 5ms (unchanged)
frontend/src/types/global.d.ts 4ms (unchanged)
frontend/src/types/utils.types.ts 5ms (unchanged)
frontend/src/utils/api-client.ts 16ms (unchanged)
frontend/src/utils/auth-helpers.ts 6ms (unchanged)
frontend/src/utils/date-helpers.ts 6ms (unchanged)
frontend/src/utils/dom-utils.ts 11ms (unchanged)
frontend/src/utils/jwt-utils.ts 2ms (unchanged)
frontend/src/utils/password-strength-core.ts 7ms (unchanged)
frontend/src/utils/password-strength-integration.ts 13ms (unchanged)
frontend/src/utils/password-toggle.ts 5ms (unchanged)
frontend/src/utils/token-manager.ts 17ms (unchanged)
frontend/tailwind.config.js 6ms (unchanged)
frontend/tsconfig.json 2ms (unchanged)
frontend/tsconfig.node.json 1ms (unchanged)
frontend/vite.config.js 15ms (unchanged)
jest.config.js 5ms (unchanged)
jest.globalSetup.js 5ms (unchanged)
jest.globalTeardown.js 6ms (unchanged)
jest.setup.ts 2ms (unchanged)
package.json 2ms (unchanged)
pnpm-workspace.yaml 10ms (unchanged)
tsconfig.base.json 2ms (unchanged)
tsconfig.json 1ms (unchanged)
tsconfig.test.json 1ms (unchanged)

~/projects/Assixx/docker$ docker exec assixx-backend pnpm build

> assixx@1.0.0 build /app
> pnpm run build:ts && pnpm run build:frontend

> assixx@1.0.0 build:ts /app
> cd backend && tsc -p tsconfig.build.json

> assixx@1.0.0 build:frontend /app
> cd frontend && pnpm run build

> assixx-frontend@1.0.0 build /app/frontend
> vite build

vite v7.2.4 building client environment for production...
transforming...
✓ 322 modules transformed.
rendering chunks...
computing gzip size...
../dist/pages/rate-limit.html 1.77 kB │ gzip: 0.85 kB
../dist/pages/survey-results.html 1.99 kB │ gzip: 0.79 kB
../dist/pages/login.html 2.01 kB │ gzip: 0.89 kB
../dist/pages/root-dashboard.html 3.23 kB │ gzip: 1.34 kB
../dist/pages/survey-employee.html 3.31 kB │ gzip: 1.23 kB
../dist/pages/tenant-deletion-status.html 3.92 kB │ gzip: 1.64 kB
../dist/fonts/fa-v4compatibility.woff2 4.80 kB
../dist/pages/calendar.html 4.84 kB │ gzip: 1.53 kB
../dist/pages/storage-upgrade.html 4.88 kB │ gzip: 1.82 kB
../dist/pages/admin-dashboard.html 5.64 kB │ gzip: 1.50 kB
../dist/pages/design-system-demo.html 5.89 kB │ gzip: 1.85 kB
../dist/pages/blackboard-detail.html 5.90 kB │ gzip: 1.89 kB
../dist/pages/manage-department-groups.html 6.25 kB │ gzip: 2.06 kB
../dist/pages/root-features.html 6.36 kB │ gzip: 1.75 kB
../dist/pages/account-settings.html 6.60 kB │ gzip: 2.20 kB
../dist/pages/employee-dashboard.html 6.92 kB │ gzip: 1.83 kB
../dist/pages/root-profile.html 6.96 kB │ gzip: 2.07 kB
../dist/pages/manage-departments.html 7.05 kB │ gzip: 2.09 kB
../dist/pages/admin-profile.html 7.17 kB │ gzip: 2.08 kB
../dist/pages/employee-profile.html 7.18 kB │ gzip: 2.10 kB
../dist/pages/survey-admin.html 7.76 kB │ gzip: 2.33 kB
../dist/pages/chat.html 8.06 kB │ gzip: 2.34 kB
../dist/pages/manage-areas.html 8.07 kB │ gzip: 2.27 kB
../dist/pages/manage-teams.html 8.27 kB │ gzip: 2.25 kB
../dist/pages/manage-machines.html 8.78 kB │ gzip: 2.37 kB
../dist/pages/signup.html 8.96 kB │ gzip: 2.54 kB
../dist/pages/kvp.html 10.61 kB │ gzip: 2.92 kB
../dist/fonts/fa-v4compatibility.ttf 10.84 kB
../dist/pages/manage-root.html 11.07 kB │ gzip: 2.98 kB
../dist/pages/kvp-detail.html 11.35 kB │ gzip: 2.86 kB
../dist/pages/blackboard.html 12.01 kB │ gzip: 3.31 kB
../dist/pages/index.html 12.63 kB │ gzip: 4.02 kB
../dist/pages/manage-admins.html 12.70 kB │ gzip: 3.17 kB
../dist/pages/manage-employees.html 13.51 kB │ gzip: 3.21 kB
../dist/pages/documents-explorer.html 13.87 kB │ gzip: 3.70 kB
../dist/pages/shifts.html 15.10 kB │ gzip: 3.55 kB
../dist/pages/logs.html 15.36 kB │ gzip: 3.66 kB
../dist/fonts/fa-regular-400.woff2 25.47 kB
../dist/fonts/fa-regular-400.ttf 68.06 kB
../dist/images/logo-Bz*kpWvs.png 77.67 kB
../dist/fonts/fa-brands-400.woff2 118.68 kB
../dist/fonts/fa-solid-900.woff2 158.22 kB
../dist/fonts/fa-brands-400.ttf 210.79 kB
../dist/fonts/fa-solid-900.ttf 426.11 kB
../dist/css/manage-admins-tn0RQdqM.css 0.00 kB │ gzip: 0.02 kB
../dist/css/rate-limit-DXU94QdK.css 0.40 kB │ gzip: 0.25 kB
../dist/css/account-settings-B_xzhqU4.css 0.65 kB │ gzip: 0.34 kB
../dist/css/root-dashboard-DKhc549F.css 0.77 kB │ gzip: 0.41 kB
../dist/css/admin-profile-DtlXzP9t.css 1.02 kB │ gzip: 0.48 kB
../dist/css/manage-department-groups-Bj54oGEx.css 1.25 kB │ gzip: 0.59 kB
../dist/css/documents-explorer-CkGyZdgc.css 1.47 kB │ gzip: 0.48 kB
../dist/css/user-info-update-DLgpDt9A.css 1.82 kB │ gzip: 0.51 kB
../dist/css/root-profile-C_qu9_kS.css 1.96 kB │ gzip: 0.66 kB
../dist/css/admin-dashboard-DDzb0YWF.css 2.07 kB │ gzip: 0.74 kB
../dist/css/survey-employee-C1yxz8qT.css 2.08 kB │ gzip: 0.66 kB
../dist/css/survey-results-KLaD6120.css 2.16 kB │ gzip: 0.64 kB
../dist/css/survey-admin-mNSU7zJp.css 2.60 kB │ gzip: 0.70 kB
../dist/css/root-features-Y2Tx6bPz.css 2.67 kB │ gzip: 0.87 kB
../dist/css/storage-upgrade-C3wJEpxd.css 3.16 kB │ gzip: 0.95 kB
../dist/css/login-AAHCp0Zq.css 3.68 kB │ gzip: 1.05 kB
../dist/css/alerts-CatR5Du7.css 3.94 kB │ gzip: 1.02 kB
../dist/css/tenant-deletion-status-DSfxbATV.css 3.99 kB │ gzip: 1.18 kB
../dist/css/employee-dashboard-DpAkMjkl.css 4.60 kB │ gzip: 1.33 kB
../dist/css/kvp-CMTyD4Yf.css 4.86 kB │ gzip: 1.33 kB
../dist/css/password-strength-core-CN_pz3he.css 5.27 kB │ gzip: 1.16 kB
../dist/css/logs-B_9dDQi0.css 5.29 kB │ gzip: 1.51 kB
../dist/css/signup-Bg-Ydf-Z.css 8.45 kB │ gzip: 1.88 kB
../dist/css/index-DMYTOmsT.css 10.29 kB │ gzip: 2.12 kB
../dist/css/unified-navigation-D42AQeGR.css 12.16 kB │ gzip: 3.09 kB
../dist/css/kvp-detail-Bn34LV6a.css 15.75 kB │ gzip: 3.46 kB
../dist/css/blackboard-Cp_8496r.css 16.20 kB │ gzip: 3.85 kB
../dist/css/chat-brzEz0Dw.css 18.60 kB │ gzip: 3.69 kB
../dist/css/shifts-as6aJ282.css 31.06 kB │ gzip: 5.60 kB
../dist/css/calendar-CkKY-\_94.css 40.08 kB │ gzip: 8.74 kB
../dist/css/fontawesome.css 77.00 kB │ gzip: 17.40 kB
../dist/css/main-Z1bhseI9.css 219.05 kB │ gzip: 36.53 kB
../dist/js/modulepreload-polyfill-YP0FEG5d.js 0.93 kB │ gzip: 0.59 kB │ map: 0.12 kB
../dist/js/preload-helper-CgvsJPj0.js 1.44 kB │ gzip: 0.89 kB │ map: 0.11 kB
../dist/js/storage.service-Ej_YB_Y-.js 9.00 kB │ gzip: 3.75 kB │ map: 5.73 kB
../dist/js/password-strength-core-C3VPIOGa.js 10.25 kB │ gzip: 4.77 kB │ map: 6.53 kB
../dist/js/rate-limit.js 10.72 kB │ gzip: 4.44 kB │ map: 6.41 kB
../dist/js/password-toggle-q0lq3cK0.js 12.39 kB │ gzip: 4.71 kB │ map: 8.32 kB
../dist/js/index.js 16.41 kB │ gzip: 6.92 kB │ map: 10.19 kB
../dist/js/storage-upgrade.js 17.57 kB │ gzip: 7.74 kB │ map: 10.86 kB
../dist/js/dom-utils-BATYkr7*.js 18.76 kB │ gzip: 7.07 kB │ map: 12.54 kB
../dist/js/password-strength-integration-C8g-vKao.js 30.12 kB │ gzip: 10.38 kB │ map: 19.59 kB
../dist/js/account-settings.js 34.07 kB │ gzip: 12.58 kB │ map: 21.29 kB
../dist/js/logs.js 43.76 kB │ gzip: 16.40 kB │ map: 26.74 kB
../dist/js/root-dashboard.js 44.74 kB │ gzip: 15.77 kB │ map: 26.48 kB
../dist/js/fullcalendar-list-B2WVsApM.js 45.13 kB │ gzip: 16.12 kB │ map: 27.58 kB
../dist/js/tenant-deletion-status.js 45.51 kB │ gzip: 15.82 kB │ map: 25.86 kB
../dist/js/alerts-DQbV5yKj.js 45.77 kB │ gzip: 14.82 kB │ map: 26.45 kB
../dist/js/breadcrumb-D3EMSU2c.js 51.09 kB │ gzip: 16.83 kB │ map: 31.09 kB
../dist/js/widget-jZ0gGhsE.js 51.87 kB │ gzip: 18.41 kB │ map: 31.55 kB
../dist/js/employee-dashboard.js 57.76 kB │ gzip: 21.26 kB │ map: 36.84 kB
../dist/js/signup.js 57.84 kB │ gzip: 19.17 kB │ map: 36.51 kB
../dist/js/login.js 58.42 kB │ gzip: 21.26 kB │ map: 35.90 kB
../dist/js/survey-results.js 65.56 kB │ gzip: 21.58 kB │ map: 39.79 kB
../dist/js/root-features.js 72.07 kB │ gzip: 24.56 kB │ map: 44.74 kB
../dist/js/admin-profile.js 78.59 kB │ gzip: 25.95 kB │ map: 49.88 kB
../dist/js/employee-profile.js 78.94 kB │ gzip: 25.97 kB │ map: 50.07 kB
../dist/js/survey-employee.js 86.69 kB │ gzip: 28.70 kB │ map: 52.28 kB
../dist/js/vendor-CSiHmso\_.js 96.37 kB │ gzip: 35.03 kB │ map: 58.22 kB
../dist/js/admin-dashboard.js 96.61 kB │ gzip: 28.84 kB │ map: 60.40 kB
../dist/js/manage-departments.js 97.72 kB │ gzip: 30.79 kB │ map: 59.27 kB
../dist/js/root-profile.js 98.38 kB │ gzip: 31.29 kB │ map: 61.71 kB
../dist/js/manage-department-groups.js 102.72 kB │ gzip: 31.08 kB │ map: 62.87 kB
../dist/js/manage-areas.js 102.99 kB │ gzip: 30.92 kB │ map: 62.08 kB
../dist/js/blackboard-detail.js 104.35 kB │ gzip: 32.15 kB │ map: 64.53 kB
../dist/js/manage-root.js 105.10 kB │ gzip: 32.87 kB │ map: 64.99 kB
../dist/js/manage-machines.js 113.55 kB │ gzip: 35.81 kB │ map: 70.70 kB
../dist/js/manage-teams.js 132.32 kB │ gzip: 38.93 kB │ map: 80.62 kB
../dist/js/kvp.js 135.49 kB │ gzip: 41.93 kB │ map: 82.31 kB
../dist/js/fullcalendar-daygrid-DASi-aaQ.js 139.91 kB │ gzip: 43.71 kB │ map: 86.02 kB
../dist/js/vendor-utils-CwyYg7ZL.js 145.22 kB │ gzip: 49.20 kB │ map: 91.98 kB
../dist/js/fullcalendar-timegrid--iCeik0h.js 160.03 kB │ gzip: 49.87 kB │ map: 98.22 kB
../dist/js/survey-admin.js 161.83 kB │ gzip: 48.45 kB │ map: 100.42 kB
../dist/js/manage-employees.js 177.95 kB │ gzip: 53.65 kB │ map: 109.42 kB
../dist/js/marked.min-Dr1dxkuQ.js 188.97 kB │ gzip: 56.57 kB │ map: 111.90 kB
../dist/js/blackboard.js 192.09 kB │ gzip: 54.98 kB │ map: 121.70 kB
../dist/js/manage-admins.js 194.63 kB │ gzip: 57.88 kB │ map: 121.08 kB
../dist/js/kvp-detail.js 198.09 kB │ gzip: 56.93 kB │ map: 122.24 kB
../dist/js/zxcvbn-core-B2v0qZns.js 198.73 kB │ gzip: 62.55 kB │ map: 130.78 kB
../dist/js/fullcalendar-interaction-DSTqP4XH.js 217.24 kB │ gzip: 59.81 kB │ map: 137.27 kB
../dist/js/chat.js 255.11 kB │ gzip: 71.00 kB │ map: 154.74 kB
../dist/js/documents-explorer.js 297.95 kB │ gzip: 87.34 kB │ map: 181.91 kB
../dist/js/calendar.js 364.71 kB │ gzip: 103.75 kB │ map: 223.80 kB
../dist/js/unified-navigation-CsSuIoRn.js 519.48 kB │ gzip: 154.80 kB │ map: 314.81 kB
../dist/js/shifts.js 696.80 kB │ gzip: 193.10 kB │ map: 418.17 kB
../dist/js/fullcalendar-core-IyfgmfmD.js 990.65 kB │ gzip: 298.50 kB │ map: 622.63 kB
../dist/js/zxcvbn-common-C5FGJ3pm.js 1,117.39 kB │ gzip: 529.81 kB │ map: 489.22 kB
../dist/js/zxcvbn-de-DPs7F-u1.js 1,910.51 kB │ gzip: 840.88 kB │ map: 820.25 kB
✓ built in 9.14s

scs@SOSCSPC1M16:~/projects/Assixx$cd docker
scs@SOSCSPC1M16:~/projects/Assixx/docker$ docker-compose build --no-cache
[+] Building 44.7s (18/18) FINISHED
=> [internal] load local bake definitions 0.0s
=> => reading from stdin 544B 0.0s
=> [internal] load build definition from Dockerfile.dev 0.0s
=> => transferring dockerfile: 1.10kB 0.0s
=> [internal] load metadata for docker.io/library/node:24.11.1-alpine 1.3s
=> [auth] library/node:pull token for registry-1.docker.io 0.0s
=> [internal] load .dockerignore 0.0s
=> => transferring context: 2B 0.0s
=> CACHED [ 1/10] FROM docker.io/library/node:24.11.1-alpine@sha256:2867d550cf9d8bb50059a0fff528741f11a84d985c732e60e19e8e75c7239c43 0.0s
=> => resolve docker.io/library/node:24.11.1-alpine@sha256:2867d550cf9d8bb50059a0fff528741f11a84d985c732e60e19e8e75c7239c43 0.0s
=> [internal] load build context 0.0s
=> => transferring context: 424.54kB 0.0s
=> [ 2/10] RUN apk add --no-cache curl jq && apk upgrade --no-cache curl 2.1s
=> [ 3/10] RUN npm install -g pnpm@10.24.0 2.6s
=> [ 4/10] WORKDIR /app 0.0s
=> [ 5/10] COPY package.json ./ 0.0s
=> [ 6/10] COPY pnpm-lock.yaml ./ 0.0s
=> [ 7/10] COPY pnpm-workspace.yaml ./ 0.0s
=> [ 8/10] COPY frontend/package.json ./frontend/ 0.0s
=> [ 9/10] COPY backend/package.json ./backend/ 0.0s
=> [10/10] RUN pnpm install --frozen-lockfile 12.1s
=> exporting to image 26.0s
=> => exporting layers 14.9s
=> => exporting manifest sha256:5535ea66921352eca37af6354e7e198869d4909d0a4b48662951bd396f847569 0.0s
=> => exporting config sha256:47d11813976699f9cd81d622612dbb87e32a4d75fdab27161dd7d7a4a8f2163a 0.0s
=> => exporting attestation manifest sha256:2cdc98b7535f3e46f7af92cdab3f8a0f2fe5a15993fa5b0b9522521f83d0a651 0.0s
=> => exporting manifest list sha256:a11a2b3d501392175926a870df4ff8ea70f94441feb8ea9c62a6338a7b224daf 0.0s
=> => naming to docker.io/library/assixx-backend:dev 0.0s
=> => unpacking to docker.io/library/assixx-backend:dev 11.0s
=> resolving provenance for metadata file 0.0s
[+] Building 1/1
✔ assixx-backend:dev Built0.0s
scs@SOSCSPC1M16:~/projects/Assixx/docker$
