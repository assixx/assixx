export type ApprovalApproverType =
  | 'user'
  | 'team_lead'
  | 'area_lead'
  | 'department_lead'
  | 'position';

export interface ApprovalConfig {
  uuid: string;
  addonCode: string;
  approverType: ApprovalApproverType;
  approverUserId: number | null;
  approverUserName: string | null;
  approverPositionId: string | null;
  approverPositionName: string | null;
  scopeAreaIds: number[] | null;
  scopeDepartmentIds: number[] | null;
  scopeTeamIds: number[] | null;
  createdAt: string;
}

export interface OrgItem {
  id: number;
  name: string;
}

export interface Area extends OrgItem {
  departmentCount?: number;
}

export interface Department extends OrgItem {
  areaId?: number;
  areaName?: string;
}

export interface Team extends OrgItem {
  departmentId?: number;
}

export interface PositionOption {
  id: string;
  name: string;
  roleCategory: 'employee' | 'admin' | 'root';
  sortOrder: number;
  isSystem: boolean;
}

export interface UserOption {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
  employeeNumber?: string | null;
  position?: string | null;
  profilePicture?: string | null;
}
