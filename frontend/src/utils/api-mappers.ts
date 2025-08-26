/**
 * API Field Mappers for handling v1/v2 API differences
 * Uses the generated types from Swagger
 */

import type { components } from '../generated/api-types';

// Type from our generated Swagger types
export type SwaggerUser = components['schemas']['User'];

// Union type for API responses that might have snake_case or camelCase
export interface UserAPIResponse {
  id: number;
  username?: string;
  email?: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  role?: 'root' | 'admin' | 'employee';
  tenant_id?: number;
  tenantId?: number;
  department_id?: number | null;
  departmentId?: number | null;
  department_name?: string;
  departmentName?: string;
  department?: string;
  team_id?: number | null;
  teamId?: number | null;
  team_name?: string;
  teamName?: string;
  position?: string;
  employee_number?: string;
  employeeNumber?: string;
  is_active?: boolean;
  isActive?: boolean;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  // Availability fields
  availability_status?: string;
  availabilityStatus?: string;
  availability_start?: string;
  availabilityStart?: string;
  availability_end?: string;
  availabilityEnd?: string;
  availability_notes?: string;
  availabilityNotes?: string;
}

// Extended User type with both snake_case and camelCase fields for compatibility
export interface MappedUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: 'root' | 'admin' | 'employee';
  tenantId: number;
  departmentId: number | null;
  departmentName?: string;
  teamId?: number | null;
  teamName?: string;
  position?: string;
  employeeNumber?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Availability fields
  availabilityStatus?: string;
  availabilityStart?: string;
  availabilityEnd?: string;
  availabilityNotes?: string;
}

/**
 * Maps a user from API response (v1 or v2) to our unified MappedUser type
 * Handles both snake_case (v1) and camelCase (v2) field names
 */
export function mapUser(user: UserAPIResponse): MappedUser {
  // Handle both v1 (snake_case) and v2 (camelCase) field names
  const firstName = user.first_name ?? user.firstName ?? '';
  const lastName = user.last_name ?? user.lastName ?? '';

  // Debug availability mapping
  console.info('[API Mapper] Mapping user availability:', {
    id: user.id,
    email: user.email,
    availability_status: user.availability_status,
    availabilityStatus: user.availabilityStatus,
  });

  return {
    id: user.id,
    username: user.username ?? '',
    email: user.email ?? '',
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
    role: user.role ?? 'employee',
    tenantId: user.tenant_id ?? user.tenantId ?? 0,
    departmentId: user.department_id ?? user.departmentId ?? null,
    departmentName: user.department_name ?? user.departmentName ?? 'Keine Abteilung',
    teamId: user.team_id ?? user.teamId ?? null,
    teamName: user.team_name ?? user.teamName ?? 'Kein Team',
    position: user.position ?? 'Mitarbeiter',
    employeeNumber: user.employee_number ?? user.employeeNumber ?? '',
    isActive: user.is_active ?? user.isActive ?? true,
    createdAt: user.created_at ?? user.createdAt,
    updatedAt: user.updated_at ?? user.updatedAt,
    // Map availability fields
    availabilityStatus: user.availability_status ?? user.availabilityStatus ?? 'available',
    availabilityStart: user.availability_start ?? user.availabilityStart,
    availabilityEnd: user.availability_end ?? user.availabilityEnd,
    availabilityNotes: user.availability_notes ?? user.availabilityNotes,
  };
}

/**
 * Maps an array of users
 */
export function mapUsers(users: UserAPIResponse[]): MappedUser[] {
  return users.map(mapUser);
}

// Department mapping
export interface MappedDepartment {
  id: number;
  name: string;
  description?: string;
  areaId?: number | null;
  memberCount: number;
  createdAt?: string;
  updatedAt?: string;
}

// Department API response type
export interface DepartmentAPIResponse {
  id: number;
  name?: string;
  description?: string;
  area_id?: number | null;
  areaId?: number | null;
  member_count?: number;
  memberCount?: number;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export function mapDepartment(dept: DepartmentAPIResponse): MappedDepartment {
  return {
    id: dept.id,
    name: dept.name ?? '',
    description: dept.description ?? '',
    areaId: dept.area_id ?? dept.areaId ?? null,
    memberCount: dept.member_count ?? dept.memberCount ?? 0,
    createdAt: dept.created_at ?? dept.createdAt,
    updatedAt: dept.updated_at ?? dept.updatedAt,
  };
}

// Document mapping
export interface MappedDocument {
  id: number;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
  uploadedBy: number;
  uploadedByName?: string;
  uploadDate: string;
  isPublic: boolean;
}

// Document API response type
export interface DocumentAPIResponse {
  id: number;
  file_name?: string;
  fileName?: string;
  file_size?: number;
  fileSize?: number;
  mime_type?: string;
  mimeType?: string;
  category?: string;
  uploaded_by?: number;
  uploadedBy?: number;
  uploaded_by_name?: string;
  uploadedByName?: string;
  upload_date?: string;
  uploadDate?: string;
  is_public?: boolean;
  isPublic?: boolean;
}

export function mapDocument(doc: DocumentAPIResponse): MappedDocument {
  return {
    id: doc.id,
    fileName: doc.file_name ?? doc.fileName ?? '',
    fileSize: doc.file_size ?? doc.fileSize ?? 0,
    mimeType: doc.mime_type ?? doc.mimeType ?? '',
    category: doc.category ?? '',
    uploadedBy: doc.uploaded_by ?? doc.uploadedBy ?? 0,
    uploadedByName: doc.uploaded_by_name ?? doc.uploadedByName,
    uploadDate: doc.upload_date ?? doc.uploadDate ?? new Date().toISOString(),
    isPublic: doc.is_public ?? doc.isPublic ?? false,
  };
}

// Team mapping
export interface MappedTeam {
  id: number;
  name: string;
  description?: string;
  leaderId?: number;
  leaderName?: string;
  departmentId?: number;
  departmentName?: string;
  areaId?: number;
  shiftModelId?: number;
  memberCount?: number;
  memberNames?: string;
  maxMembers?: number;
  teamType?: 'production' | 'quality' | 'maintenance' | 'logistics' | 'administration' | 'other';
  status: 'active' | 'inactive' | 'restructuring';
  foundedDate?: string;
  costCenter?: string;
  budget?: number;
  performanceScore?: number;
  notes?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Team API response type
export interface TeamAPIResponse {
  id: number;
  name?: string;
  description?: string;
  leader_id?: number;
  leaderId?: number;
  leader_name?: string;
  leaderName?: string;
  department_id?: number;
  departmentId?: number;
  department_name?: string;
  departmentName?: string;
  area_id?: number;
  areaId?: number;
  shift_model_id?: number;
  shiftModelId?: number;
  member_count?: number;
  memberCount?: number;
  member_names?: string;
  memberNames?: string;
  max_members?: number;
  maxMembers?: number;
  team_type?: string;
  teamType?: string;
  status?: string;
  founded_date?: string;
  foundedDate?: string;
  cost_center?: string;
  costCenter?: string;
  budget?: number;
  performance_score?: number;
  performanceScore?: number;
  notes?: string;
  is_active?: boolean;
  isActive?: boolean;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export function mapTeam(team: TeamAPIResponse): MappedTeam {
  return {
    id: team.id,
    name: team.name ?? '',
    description: team.description,
    leaderId: team.leader_id ?? team.leaderId,
    leaderName: team.leader_name ?? team.leaderName,
    departmentId: team.department_id ?? team.departmentId,
    departmentName: team.department_name ?? team.departmentName,
    areaId: team.area_id ?? team.areaId,
    shiftModelId: team.shift_model_id ?? team.shiftModelId,
    memberCount: team.member_count ?? team.memberCount,
    memberNames: team.member_names ?? team.memberNames,
    maxMembers: team.max_members ?? team.maxMembers,
    teamType: (team.team_type ?? team.teamType) as MappedTeam['teamType'],
    status: (team.status ?? 'active') as MappedTeam['status'],
    foundedDate: team.founded_date ?? team.foundedDate,
    costCenter: team.cost_center ?? team.costCenter,
    budget: team.budget,
    performanceScore: team.performance_score ?? team.performanceScore,
    notes: team.notes,
    isActive: team.is_active ?? team.isActive,
    createdAt: team.created_at ?? team.createdAt ?? new Date().toISOString(),
    updatedAt: team.updated_at ?? team.updatedAt ?? new Date().toISOString(),
  };
}

export function mapTeams(teams: TeamAPIResponse[]): MappedTeam[] {
  return teams.map(mapTeam);
}

// Machine mapping
export interface MappedMachine {
  id: number;
  name: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  assetNumber?: string;
  departmentId?: number;
  departmentName?: string;
  areaId?: number;
  location?: string;
  machineType?: 'production' | 'packaging' | 'quality_control' | 'logistics' | 'utility' | 'other';
  status: 'operational' | 'maintenance' | 'repair' | 'standby' | 'decommissioned';
  purchaseDate?: string;
  installationDate?: string;
  warrantyUntil?: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  operatingHours?: number;
  productionCapacity?: string;
  energyConsumption?: string;
  manualUrl?: string;
  qrCode?: string;
  notes?: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Machine API response type
export interface MachineAPIResponse {
  id: number;
  name: string;
  model?: string;
  manufacturer?: string;
  serial_number?: string;
  serialNumber?: string;
  asset_number?: string;
  assetNumber?: string;
  department_id?: number;
  departmentId?: number;
  department_name?: string;
  departmentName?: string;
  area_id?: number;
  areaId?: number;
  location?: string;
  machine_type?: string;
  machineType?: string;
  status: string;
  purchase_date?: string;
  purchaseDate?: string;
  installation_date?: string;
  installationDate?: string;
  warranty_until?: string;
  warrantyUntil?: string;
  last_maintenance?: string;
  lastMaintenance?: string;
  next_maintenance?: string;
  nextMaintenance?: string;
  operating_hours?: number;
  operatingHours?: number;
  production_capacity?: string;
  productionCapacity?: string;
  energy_consumption?: string;
  energyConsumption?: string;
  manual_url?: string;
  manualUrl?: string;
  qr_code?: string;
  qrCode?: string;
  notes?: string;
  is_active?: boolean;
  isActive?: boolean;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export function mapMachine(machine: MachineAPIResponse): MappedMachine {
  return {
    id: machine.id,
    name: machine.name,
    model: machine.model,
    manufacturer: machine.manufacturer,
    serialNumber: machine.serial_number ?? machine.serialNumber,
    assetNumber: machine.asset_number ?? machine.assetNumber,
    departmentId: machine.department_id ?? machine.departmentId,
    departmentName: machine.department_name ?? machine.departmentName,
    areaId: machine.area_id ?? machine.areaId,
    location: machine.location,
    machineType: (machine.machine_type ?? machine.machineType) as MappedMachine['machineType'],
    status: machine.status as MappedMachine['status'],
    purchaseDate: machine.purchase_date ?? machine.purchaseDate,
    installationDate: machine.installation_date ?? machine.installationDate,
    warrantyUntil: machine.warranty_until ?? machine.warrantyUntil,
    lastMaintenance: machine.last_maintenance ?? machine.lastMaintenance,
    nextMaintenance: machine.next_maintenance ?? machine.nextMaintenance,
    operatingHours: machine.operating_hours ?? machine.operatingHours,
    productionCapacity: machine.production_capacity ?? machine.productionCapacity,
    energyConsumption: machine.energy_consumption ?? machine.energyConsumption,
    manualUrl: machine.manual_url ?? machine.manualUrl,
    qrCode: machine.qr_code ?? machine.qrCode,
    notes: machine.notes,
    isActive: machine.is_active ?? machine.isActive,
    createdAt: machine.created_at ?? machine.createdAt ?? new Date().toISOString(),
    updatedAt: machine.updated_at ?? machine.updatedAt ?? new Date().toISOString(),
  };
}

export function mapMachines(machines: MachineAPIResponse[]): MappedMachine[] {
  return machines.map(mapMachine);
}

// Shift Rotation Pattern mapping
export interface MappedRotationPattern {
  id: number;
  tenantId: number;
  teamId: number | null;
  name: string;
  description?: string;
  patternType: 'alternate_fs' | 'fixed_n' | 'custom';
  patternConfig: Record<string, unknown>;
  cycleLengthWeeks: number;
  startsAt: string;
  endsAt?: string | null;
  isActive: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

// Rotation Pattern API response type
export interface RotationPatternAPIResponse {
  id: number;
  tenant_id?: number;
  tenantId?: number;
  team_id?: number | null;
  teamId?: number | null;
  name?: string;
  description?: string;
  pattern_type?: string;
  patternType?: string;
  pattern_config?: Record<string, unknown>;
  patternConfig?: Record<string, unknown>;
  cycle_length_weeks?: number;
  cycleLengthWeeks?: number;
  starts_at?: string;
  startsAt?: string;
  ends_at?: string | null;
  endsAt?: string | null;
  is_active?: boolean | number;
  isActive?: boolean | number;
  created_by?: number;
  createdBy?: number;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
}

export function mapRotationPattern(pattern: RotationPatternAPIResponse): MappedRotationPattern {
  return {
    id: pattern.id,
    tenantId: pattern.tenantId ?? pattern.tenant_id ?? 0,
    teamId: pattern.teamId ?? pattern.team_id ?? null,
    name: pattern.name ?? '',
    description: pattern.description,
    patternType: (pattern.patternType ?? pattern.pattern_type ?? 'custom') as 'alternate_fs' | 'fixed_n' | 'custom',
    patternConfig: pattern.patternConfig ?? pattern.pattern_config ?? {},
    cycleLengthWeeks: pattern.cycleLengthWeeks ?? pattern.cycle_length_weeks ?? 1,
    startsAt: pattern.startsAt ?? pattern.starts_at ?? new Date().toISOString(),
    endsAt: pattern.endsAt ?? pattern.ends_at ?? null,
    isActive: Boolean(pattern.isActive ?? pattern.is_active ?? false),
    createdBy: pattern.createdBy ?? pattern.created_by ?? 0,
    createdAt: pattern.createdAt ?? pattern.created_at ?? new Date().toISOString(),
    updatedAt: pattern.updatedAt ?? pattern.updated_at ?? new Date().toISOString(),
  };
}

export function mapRotationPatterns(patterns: RotationPatternAPIResponse[]): MappedRotationPattern[] {
  return patterns.map(mapRotationPattern);
}
