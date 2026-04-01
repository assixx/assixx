/**
 * Types for the My-Team page
 *
 * Read-only view of team members for employees.
 */

export interface TeamMember {
  id: number;
  uuid: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string | undefined;
  employeeId: string | undefined;
  role: string | undefined;
  userRole: string | undefined;
  availabilityStatus: string | undefined;
  availabilityStart: string | undefined;
  availabilityEnd: string | undefined;
}

export interface TeamOption {
  id: number;
  name: string;
}
