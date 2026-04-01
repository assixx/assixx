/**
 * Types for the User Profile page
 */

export interface UserProfile {
  id: number;
  uuid: string;
  email: string;
  firstName: string;
  lastName: string;
  position: string | null;
  employeeNumber: string | null;
  profilePicture: string | null;
  phone: string | null;
  role: string;
  teamIds: number[] | null;
  teamNames: string[] | null;
  departmentIds: number[] | null;
  departmentNames: string[] | null;
  availabilityStatus: string | null;
  availabilityStart: string | null;
  availabilityEnd: string | null;
  availabilityNotes: string | null;
}
