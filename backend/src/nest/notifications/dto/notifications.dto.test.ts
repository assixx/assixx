import { describe, expect, it } from 'vitest';

import { CreateNotificationSchema } from './create-notification.dto.js';
import { ListNotificationsQuerySchema } from './list-notifications-query.dto.js';
import { UpdatePreferencesSchema } from './update-preferences.dto.js';

// =============================================================
// CreateNotificationSchema
// =============================================================

describe('CreateNotificationSchema', () => {
  const valid = {
    type: 'announcement' as const,
    title: 'System Update',
    message: 'Maintenance scheduled for tonight.',
    recipientType: 'all' as const,
  };

  it('should accept valid notification for all recipients', () => {
    expect(CreateNotificationSchema.safeParse(valid).success).toBe(true);
  });

  it('should accept notification with recipientId for user type', () => {
    const result = CreateNotificationSchema.safeParse({
      ...valid,
      recipientType: 'user',
      recipientId: '5',
    });

    expect(result.success).toBe(true);
  });

  it('should reject user-type without recipientId (refinement)', () => {
    const result = CreateNotificationSchema.safeParse({
      ...valid,
      recipientType: 'user',
    });

    expect(result.success).toBe(false);
  });

  it('should reject department-type without recipientId (refinement)', () => {
    const result = CreateNotificationSchema.safeParse({
      ...valid,
      recipientType: 'department',
    });

    expect(result.success).toBe(false);
  });

  it('should reject missing title', () => {
    const { title: _title, ...noTitle } = valid;

    expect(CreateNotificationSchema.safeParse(noTitle).success).toBe(false);
  });

  it('should reject title longer than 255 characters', () => {
    expect(
      CreateNotificationSchema.safeParse({
        ...valid,
        title: 'T'.repeat(256),
      }).success,
    ).toBe(false);
  });

  it.each(['system', 'task', 'message', 'announcement', 'reminder'] as const)(
    'should accept type=%s',
    (type) => {
      expect(
        CreateNotificationSchema.safeParse({ ...valid, type }).success,
      ).toBe(true);
    },
  );

  it('should reject invalid type', () => {
    expect(
      CreateNotificationSchema.safeParse({ ...valid, type: 'email' }).success,
    ).toBe(false);
  });

  it.each(['low', 'normal', 'medium', 'high', 'urgent'] as const)(
    'should accept priority=%s',
    (priority) => {
      expect(
        CreateNotificationSchema.safeParse({ ...valid, priority }).success,
      ).toBe(true);
    },
  );
});

// =============================================================
// ListNotificationsQuerySchema
// =============================================================

describe('ListNotificationsQuerySchema', () => {
  it('should accept empty query', () => {
    expect(ListNotificationsQuerySchema.safeParse({}).success).toBe(true);
  });

  it('should coerce unread from string "true" to boolean', () => {
    const data = ListNotificationsQuerySchema.parse({ unread: 'true' });

    expect(data.unread).toBe(true);
  });

  it('should coerce unread from string "false" to boolean', () => {
    const data = ListNotificationsQuerySchema.parse({ unread: 'false' });

    expect(data.unread).toBe(false);
  });

  it('should accept valid type filter', () => {
    expect(
      ListNotificationsQuerySchema.safeParse({ type: 'system' }).success,
    ).toBe(true);
  });

  it('should reject invalid priority filter', () => {
    expect(
      ListNotificationsQuerySchema.safeParse({ priority: 'critical' }).success,
    ).toBe(false);
  });
});

// =============================================================
// UpdatePreferencesSchema
// =============================================================

describe('UpdatePreferencesSchema', () => {
  it('should accept empty object (all optional)', () => {
    expect(UpdatePreferencesSchema.safeParse({}).success).toBe(true);
  });

  it('should accept boolean notification toggles', () => {
    const result = UpdatePreferencesSchema.safeParse({
      emailNotifications: true,
      pushNotifications: false,
      smsNotifications: false,
    });

    expect(result.success).toBe(true);
  });

  it('should accept nested notification types record', () => {
    const result = UpdatePreferencesSchema.safeParse({
      notificationTypes: {
        system: { email: true, push: false },
        task: { email: false, push: true },
      },
    });

    expect(result.success).toBe(true);
  });

  it('should reject non-boolean values in notification types', () => {
    expect(
      UpdatePreferencesSchema.safeParse({
        notificationTypes: { system: { email: 'yes' } },
      }).success,
    ).toBe(false);
  });
});
