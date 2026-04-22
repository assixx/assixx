/**
 * Shift Handover — Entry Route Param DTO.
 *
 * Entries use UUIDv7 primary keys (plan §1.2). Re-export the shared
 * `UuidIdParamDto` factory from `common/dto` with a module-local alias
 * for clarity at the controller callsite.
 */
export {
  UuidIdParamDto as EntryIdParamDto,
  UuidIdParamSchema as EntryIdParamSchema,
} from '../../common/dto/index.js';
