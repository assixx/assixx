/**
 * Work Orders DTOs — Barrel Export
 *
 * Re-exports all work order DTOs and their Zod schemas.
 */
export { AssignUsersDto, AssignUsersSchema } from './assign-users.dto.js';
export { CreateCommentDto, CreateCommentSchema } from './create-comment.dto.js';
export {
  CreateWorkOrderDto,
  CreateWorkOrderSchema,
} from './create-work-order.dto.js';
export {
  ListWorkOrdersQueryDto,
  ListWorkOrdersQuerySchema,
} from './list-work-orders-query.dto.js';
export { UpdateStatusDto, UpdateStatusSchema } from './update-status.dto.js';
export {
  UpdateWorkOrderDto,
  UpdateWorkOrderSchema,
} from './update-work-order.dto.js';

// Common schemas (for reuse in services/controllers/tests)
export {
  LimitSchema,
  PageSchema,
  UuidParamDto,
  UuidParamSchema,
  WorkOrderPrioritySchema,
  WorkOrderSourceTypeSchema,
  WorkOrderStatusSchema,
} from './common.dto.js';
