/**
 * KVP Categories Admin - Type Definitions
 */

/** Global default category with optional override info */
export interface CustomizableDefault {
  id: number;
  defaultName: string;
  customName: string | null;
  description: string;
  color: string;
  icon: string;
  isCustomized: boolean;
}

/** Tenant-specific custom category */
export interface CustomCategory {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string;
}

/** Full API response for GET /kvp/categories/customizable */
export interface CustomizableCategoriesData {
  defaults: CustomizableDefault[];
  custom: CustomCategory[];
  totalCount: number;
  maxAllowed: number;
  remainingSlots: number;
}
