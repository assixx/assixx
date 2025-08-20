/**
 * Test Data Tracker
 * Tracks all test-created IDs for safe cleanup
 */

export class TestDataTracker {
  private static instance: TestDataTracker;
  private createdTenantIds = new Set<number>();
  private createdUserIds = new Set<number>();
  private createdDepartmentIds = new Set<number>();
  private createdTeamIds = new Set<number>();

  private constructor() {}

  static getInstance(): TestDataTracker {
    if (!TestDataTracker.instance) {
      TestDataTracker.instance = new TestDataTracker();
    }
    return TestDataTracker.instance;
  }

  // Track created entities
  trackTenant(id: number): void {
    this.createdTenantIds.add(id);
  }

  trackUser(id: number): void {
    this.createdUserIds.add(id);
  }

  trackDepartment(id: number): void {
    this.createdDepartmentIds.add(id);
  }

  trackTeam(id: number): void {
    this.createdTeamIds.add(id);
  }

  // Get tracked IDs
  getTenantIds(): number[] {
    return [...this.createdTenantIds];
  }

  getUserIds(): number[] {
    return [...this.createdUserIds];
  }

  getDepartmentIds(): number[] {
    return [...this.createdDepartmentIds];
  }

  getTeamIds(): number[] {
    return [...this.createdTeamIds];
  }

  // Clear all tracked data
  clear(): void {
    this.createdTenantIds.clear();
    this.createdUserIds.clear();
    this.createdDepartmentIds.clear();
    this.createdTeamIds.clear();
  }

  // Generate SQL WHERE clause for safe deletion
  getSafeDeleteSQL(): {
    tenants: string;
    users: string;
    departments: string;
    teams: string;
  } {
    const tenantIds = this.getTenantIds();
    const userIds = this.getUserIds();
    const departmentIds = this.getDepartmentIds();
    const teamIds = this.getTeamIds();

    return {
      tenants: tenantIds.length > 0 ? `WHERE id IN (${String(tenantIds.join(','))})` : 'WHERE 1=0', // Never delete if no test tenants
      users: userIds.length > 0 ? `WHERE id IN (${String(userIds.join(','))})` : 'WHERE 1=0',
      departments:
        departmentIds.length > 0 ? `WHERE id IN (${String(departmentIds.join(','))})` : 'WHERE 1=0',
      teams: teamIds.length > 0 ? `WHERE id IN (${String(teamIds.join(','))})` : 'WHERE 1=0',
    };
  }
}

// Export singleton instance
export const testDataTracker = TestDataTracker.getInstance();
