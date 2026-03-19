export type ApprovalApproverType =
  | 'user'
  | 'team_lead'
  | 'area_lead'
  | 'department_lead';

export interface ApprovalConfig {
  uuid: string;
  addonCode: string;
  approverType: ApprovalApproverType;
  approverUserId: number | null;
  approverUserName: string | null;
  createdAt: string;
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
