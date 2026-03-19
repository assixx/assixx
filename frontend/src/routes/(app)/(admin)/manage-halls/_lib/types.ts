// =============================================================================
// MANAGE HALLS - TYPE DEFINITIONS
// =============================================================================

import type {
  IsActiveStatus,
  FormIsActiveStatus,
  StatusFilter,
} from '@assixx/shared';

export type { IsActiveStatus, FormIsActiveStatus, StatusFilter };

export interface Hall {
  id: number;
  name: string;
  description?: string | null;
  areaId?: number | null;
  areaName?: string | null;
  departmentIds?: number[];
  departmentNames?: string;
  departmentCount?: number;
  isActive: IsActiveStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Area {
  id: number;
  name: string;
}

export interface HallPayload {
  name: string;
  description?: string | null;
  areaId?: number | null;
  isActive: FormIsActiveStatus;
}

export interface HallsApiResponse {
  data?: Hall[];
  success?: boolean;
}

export interface DeleteHallResult {
  success: boolean;
  error: string | null;
}
