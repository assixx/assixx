/**
 * Department Groups API v2 Types
 * Type definitions for hierarchical department group management
 */

export interface DepartmentGroup {
  id: number;
  name: string;
  description?: string;
  parentGroupId?: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
}

export interface DepartmentGroupWithHierarchy extends DepartmentGroup {
  departments: GroupDepartment[];
  subgroups: DepartmentGroupWithHierarchy[];
}

export interface GroupDepartment {
  id: number;
  name: string;
  description?: string;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  parentGroupId?: number;
  departmentIds?: number[];
}

export interface UpdateGroupRequest {
  name: string;
  description?: string;
}

export interface AddDepartmentsRequest {
  departmentIds: number[];
}

export interface DepartmentGroupsResponse {
  success: boolean;
  data: DepartmentGroupWithHierarchy[];
}

export interface SingleGroupResponse {
  success: boolean;
  data: DepartmentGroup;
}

export interface GroupDepartmentsResponse {
  success: boolean;
  data: GroupDepartment[];
}

export interface CreateGroupResponse {
  success: boolean;
  data: {
    id: number;
  };
  message: string;
}

export interface SuccessMessageResponse {
  success: boolean;
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: {
      field: string;
      message: string;
    }[];
  };
}

/**
 *
 */
export class ServiceError extends Error {
  /**
   *
   * @param code - The code parameter
   * @param message - The message parameter
   */
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
