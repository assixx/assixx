import { describe, expect, it } from 'vitest';

import { AddMachineSchema } from './add-machine.dto.js';
import { AddMemberSchema } from './add-member.dto.js';
import { CreateTeamSchema } from './create-team.dto.js';
import { DeleteTeamQuerySchema } from './delete-team.dto.js';
import { ListTeamsQuerySchema } from './list-teams-query.dto.js';
import { TeamIdParamSchema } from './team-id-param.dto.js';
import { TeamMembersQuerySchema } from './team-members-query.dto.js';
import { UpdateTeamSchema } from './update-team.dto.js';

// =============================================================
// CreateTeamSchema
// =============================================================

describe('CreateTeamSchema', () => {
  const valid = { name: 'Alpha Team' };

  it('should accept valid team', () => {
    expect(CreateTeamSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept full payload with coerced IDs', () => {
    const data = CreateTeamSchema.parse({
      ...valid,
      description: 'First team',
      departmentId: '3',
      leaderId: '7',
    });

    expect(data.departmentId).toBe(3);
    expect(data.leaderId).toBe(7);
  });

  it('should reject name shorter than 2 characters', () => {
    expect(CreateTeamSchema.safeParse({ name: 'X' }).success).toBe(false);
  });

  it('should reject name longer than 100 characters', () => {
    expect(CreateTeamSchema.safeParse({ name: 'X'.repeat(101) }).success).toBe(
      false,
    );
  });

  it('should reject description longer than 500 characters', () => {
    expect(
      CreateTeamSchema.safeParse({ ...valid, description: 'D'.repeat(501) })
        .success,
    ).toBe(false);
  });
});

// =============================================================
// UpdateTeamSchema
// =============================================================

describe('UpdateTeamSchema', () => {
  it('should accept empty object (all optional)', () => {
    expect(UpdateTeamSchema.safeParse({}).success).toBe(true);
  });

  it('should accept nullable departmentId', () => {
    const data = UpdateTeamSchema.parse({ departmentId: null });

    expect(data.departmentId).toBeNull();
  });

  it.each([0, 1, 3] as const)('should accept isActive=%d', (isActive) => {
    expect(
      UpdateTeamSchema.safeParse({ isActive: String(isActive) }).success,
    ).toBe(true);
  });

  it('should reject isActive=5 (out of range)', () => {
    expect(UpdateTeamSchema.safeParse({ isActive: '5' }).success).toBe(false);
  });
});

// =============================================================
// ListTeamsQuerySchema
// =============================================================

describe('ListTeamsQuerySchema', () => {
  it('should accept empty query', () => {
    expect(ListTeamsQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should coerce departmentId from string', () => {
    const data = ListTeamsQuerySchema.parse({ departmentId: '10' });

    expect(data.departmentId).toBe(10);
  });

  it('should coerce includeMembers from string "true"', () => {
    const data = ListTeamsQuerySchema.parse({ includeMembers: 'true' });

    expect(data.includeMembers).toBe(true);
  });

  it('should reject search longer than 100 characters', () => {
    expect(
      ListTeamsQuerySchema.safeParse({ search: 'X'.repeat(101) }).success,
    ).toBe(false);
  });
});

// =============================================================
// TeamIdParamSchema
// =============================================================

describe('TeamIdParamSchema', () => {
  it('should coerce string id to number', () => {
    const data = TeamIdParamSchema.parse({ id: '5' });

    expect(data.id).toBe(5);
  });

  it('should reject negative id', () => {
    expect(TeamIdParamSchema.safeParse({ id: '-1' }).success).toBe(false);
  });
});

// =============================================================
// AddMemberSchema / AddMachineSchema
// =============================================================

describe('AddMemberSchema', () => {
  it('should coerce userId from string', () => {
    const data = AddMemberSchema.parse({ userId: '42' });

    expect(data.userId).toBe(42);
  });

  it('should reject non-positive userId', () => {
    expect(AddMemberSchema.safeParse({ userId: '0' }).success).toBe(false);
  });
});

describe('AddMachineSchema', () => {
  it('should coerce machineId from string', () => {
    const data = AddMachineSchema.parse({ machineId: '99' });

    expect(data.machineId).toBe(99);
  });

  it('should reject non-positive machineId', () => {
    expect(AddMachineSchema.safeParse({ machineId: '-5' }).success).toBe(false);
  });
});

// =============================================================
// TeamMembersQuerySchema
// =============================================================

describe('TeamMembersQuerySchema', () => {
  it('should accept empty query', () => {
    expect(TeamMembersQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should accept valid date range', () => {
    const result = TeamMembersQuerySchema.safeParse({
      startDate: '2025-06-01',
      endDate: '2025-06-30',
    });

    expect(result.success).toBe(true);
  });

  it('should reject invalid date format', () => {
    expect(
      TeamMembersQuerySchema.safeParse({ startDate: '06/01/2025' }).success,
    ).toBe(false);
  });
});

// =============================================================
// DeleteTeamQuerySchema
// =============================================================

describe('DeleteTeamQuerySchema', () => {
  it('should accept empty query', () => {
    expect(DeleteTeamQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should coerce force from string "true"', () => {
    const data = DeleteTeamQuerySchema.parse({ force: 'true' });

    expect(data.force).toBe(true);
  });
});
