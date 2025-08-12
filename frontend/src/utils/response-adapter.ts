/**
 * Response Adapter for converting between v1 (snake_case) and v2 (camelCase) API formats
 */

export class ResponseAdapter {
  /**
   * Convert v1 snake_case response to v2 camelCase format
   */
  static toV2Format(v1Data: unknown): unknown {
    if (v1Data === null || v1Data === undefined) {
      return v1Data;
    }

    if (Array.isArray(v1Data)) {
      return v1Data.map((item) => this.toV2Format(item));
    }

    if (v1Data instanceof Date) {
      return v1Data;
    }

    if (typeof v1Data === 'object') {
      const converted: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(v1Data)) {
        const camelKey = this.snakeToCamel(key);
        converted[camelKey] = this.toV2Format(value);
      }

      // Handle specific field conversions
      return this.applyV2FieldConversions(converted);
    }

    return v1Data;
  }

  /**
   * Convert v2 camelCase data to v1 snake_case format
   */
  static toV1Format(v2Data: unknown): unknown {
    if (v2Data === null || v2Data === undefined) {
      return v2Data;
    }

    if (Array.isArray(v2Data)) {
      return v2Data.map((item) => this.toV1Format(item));
    }

    if (v2Data instanceof Date) {
      return v2Data;
    }

    if (typeof v2Data === 'object') {
      const converted: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(v2Data)) {
        const snakeKey = this.camelToSnake(key);
        converted[snakeKey] = this.toV1Format(value);
      }

      // Handle specific field conversions
      return this.applyV1FieldConversions(converted);
    }

    return v2Data;
  }

  /**
   * Convert snake_case to camelCase
   */
  private static snakeToCamel(str: string): string {
    // Special cases that should not be converted
    const specialCases: Record<string, string> = {
      _id: 'id',
      user_id: 'userId',
      tenant_id: 'tenantId',
      created_at: 'createdAt',
      updated_at: 'updatedAt',
      deleted_at: 'deletedAt',
      is_active: 'isActive',
      is_deleted: 'isDeleted',
      is_admin: 'isAdmin',
      is_root: 'isRoot',
      first_name: 'firstName',
      last_name: 'lastName',
      middle_name: 'middleName',
      employee_id: 'employeeId',
      department_id: 'departmentId',
      team_id: 'teamId',
      shift_id: 'shiftId',
      document_id: 'documentId',
      file_name: 'fileName',
      file_size: 'fileSize',
      file_type: 'fileType',
      mime_type: 'mimeType',
      start_date: 'startDate',
      end_date: 'endDate',
      start_time: 'startTime',
      end_time: 'endTime',
      phone_number: 'phoneNumber',
      birth_date: 'birthDate',
      hire_date: 'hireDate',
      last_login: 'lastLogin',
      access_token: 'accessToken',
      refresh_token: 'refreshToken',
      expires_in: 'expiresIn',
      expires_at: 'expiresAt',
      total_count: 'totalCount',
      page_size: 'pageSize',
      current_page: 'currentPage',
      total_pages: 'totalPages',
      has_next: 'hasNext',
      has_previous: 'hasPrevious',
      sort_by: 'sortBy',
      sort_order: 'sortOrder',
      is_public: 'isPublic',
      is_archived: 'isArchived',
      is_published: 'isPublished',
      is_featured: 'isFeatured',
      is_pinned: 'isPinned',
      view_count: 'viewCount',
      like_count: 'likeCount',
      comment_count: 'commentCount',
      attachment_count: 'attachmentCount',
      max_file_size: 'maxFileSize',
      allowed_file_types: 'allowedFileTypes',
      profile_picture: 'profilePicture',
      cover_image: 'coverImage',
      background_image: 'backgroundImage',
      display_name: 'displayName',
      full_name: 'fullName',
      short_name: 'shortName',
      company_name: 'companyName',
      street_address: 'streetAddress',
      postal_code: 'postalCode',
      city_name: 'cityName',
      state_name: 'stateName',
      country_code: 'countryCode',
      time_zone: 'timeZone',
      date_format: 'dateFormat',
      time_format: 'timeFormat',
      week_start: 'weekStart',
      working_hours: 'workingHours',
      break_duration: 'breakDuration',
      overtime_rate: 'overtimeRate',
      base_salary: 'baseSalary',
      hourly_rate: 'hourlyRate',
      contract_type: 'contractType',
      employment_type: 'employmentType',
      job_title: 'jobTitle',
      job_description: 'jobDescription',
      skills_required: 'skillsRequired',
      experience_level: 'experienceLevel',
      education_level: 'educationLevel',
      language_code: 'languageCode',
      currency_code: 'currencyCode',
      payment_method: 'paymentMethod',
      bank_account: 'bankAccount',
      tax_number: 'taxNumber',
      social_security: 'socialSecurity',
      emergency_contact: 'emergencyContact',
      next_of_kin: 'nextOfKin',
      medical_info: 'medicalInfo',
      allergies_list: 'allergiesList',
      blood_type: 'bloodType',
      insurance_number: 'insuranceNumber',
      license_number: 'licenseNumber',
      passport_number: 'passportNumber',
      visa_status: 'visaStatus',
      work_permit: 'workPermit',
      security_clearance: 'securityClearance',
      background_check: 'backgroundCheck',
      drug_test: 'drugTest',
      performance_rating: 'performanceRating',
      attendance_rate: 'attendanceRate',
      tardiness_count: 'tardinessCount',
      absence_count: 'absenceCount',
      vacation_days: 'vacationDays',
      sick_days: 'sickDays',
      remaining_days: 'remainingDays',
      used_days: 'usedDays',
      carry_over: 'carryOver',
      approval_status: 'approvalStatus',
      approved_by: 'approvedBy',
      approved_at: 'approvedAt',
      rejected_by: 'rejectedBy',
      rejected_at: 'rejectedAt',
      rejection_reason: 'rejectionReason',
      cancellation_reason: 'cancellationReason',
      notification_sent: 'notificationSent',
      reminder_sent: 'reminderSent',
      follow_up: 'followUp',
      priority_level: 'priorityLevel',
      severity_level: 'severityLevel',
      impact_level: 'impactLevel',
      risk_level: 'riskLevel',
      completion_rate: 'completionRate',
      success_rate: 'successRate',
      failure_rate: 'failureRate',
      error_count: 'errorCount',
      warning_count: 'warningCount',
      retry_count: 'retryCount',
      max_retries: 'maxRetries',
      timeout_seconds: 'timeoutSeconds',
      response_time: 'responseTime',
      processing_time: 'processingTime',
      queue_position: 'queuePosition',
      batch_size: 'batchSize',
      chunk_size: 'chunkSize',
      buffer_size: 'bufferSize',
      cache_ttl: 'cacheTtl',
      rate_limit: 'rateLimit',
      api_key: 'apiKey',
      api_secret: 'apiSecret',
      webhook_url: 'webhookUrl',
      callback_url: 'callbackUrl',
      redirect_url: 'redirectUrl',
      return_url: 'returnUrl',
      cancel_url: 'cancelUrl',
      success_url: 'successUrl',
      failure_url: 'failureUrl',
      terms_accepted: 'termsAccepted',
      privacy_accepted: 'privacyAccepted',
      cookies_accepted: 'cookiesAccepted',
      newsletter_subscribed: 'newsletterSubscribed',
      sms_enabled: 'smsEnabled',
      push_enabled: 'pushEnabled',
      email_verified: 'emailVerified',
      phone_verified: 'phoneVerified',
      two_factor_enabled: 'twoFactorEnabled',
      remember_me: 'rememberMe',
      stay_logged_in: 'stayLoggedIn',
      auto_login: 'autoLogin',
      single_sign_on: 'singleSignOn',
      oauth_provider: 'oauthProvider',
      oauth_token: 'oauthToken',
      session_id: 'sessionId',
      device_id: 'deviceId',
      ip_address: 'ipAddress',
      user_agent: 'userAgent',
      browser_name: 'browserName',
      browser_version: 'browserVersion',
      os_name: 'osName',
      os_version: 'osVersion',
      device_type: 'deviceType',
      screen_width: 'screenWidth',
      screen_height: 'screenHeight',
      color_depth: 'colorDepth',
      pixel_ratio: 'pixelRatio',
      touch_enabled: 'touchEnabled',
      geolocation_enabled: 'geolocationEnabled',
      notification_enabled: 'notificationEnabled',
      local_storage_enabled: 'localStorageEnabled',
      session_storage_enabled: 'sessionStorageEnabled',
      indexed_db_enabled: 'indexedDbEnabled',
      service_worker_enabled: 'serviceWorkerEnabled',
      web_gl_enabled: 'webGlEnabled',
      web_rtc_enabled: 'webRtcEnabled',
    };

    return specialCases[str] ?? str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  }

  /**
   * Convert camelCase to snake_case
   */
  private static camelToSnake(str: string): string {
    // Reverse mapping of special cases
    const specialCases: Record<string, string> = {
      id: '_id',
      userId: 'user_id',
      tenantId: 'tenant_id',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      isActive: 'is_active',
      isDeleted: 'is_deleted',
      isAdmin: 'is_admin',
      isRoot: 'is_root',
      firstName: 'first_name',
      lastName: 'last_name',
      middleName: 'middle_name',
      employeeId: 'employee_id',
      departmentId: 'department_id',
      teamId: 'team_id',
      shiftId: 'shift_id',
      documentId: 'document_id',
      fileName: 'file_name',
      fileSize: 'file_size',
      fileType: 'file_type',
      mimeType: 'mime_type',
      startDate: 'start_date',
      endDate: 'end_date',
      startTime: 'start_time',
      endTime: 'end_time',
      phoneNumber: 'phone_number',
      birthDate: 'birth_date',
      hireDate: 'hire_date',
      lastLogin: 'last_login',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      expiresIn: 'expires_in',
      expiresAt: 'expires_at',
      totalCount: 'total_count',
      pageSize: 'page_size',
      currentPage: 'current_page',
      totalPages: 'total_pages',
      hasNext: 'has_next',
      hasPrevious: 'has_previous',
      sortBy: 'sort_by',
      sortOrder: 'sort_order',
      isPublic: 'is_public',
      isArchived: 'is_archived',
      isPublished: 'is_published',
      isFeatured: 'is_featured',
      isPinned: 'is_pinned',
      viewCount: 'view_count',
      likeCount: 'like_count',
      commentCount: 'comment_count',
      attachmentCount: 'attachment_count',
      maxFileSize: 'max_file_size',
      allowedFileTypes: 'allowed_file_types',
      profilePicture: 'profile_picture',
      coverImage: 'cover_image',
      backgroundImage: 'background_image',
      displayName: 'display_name',
      fullName: 'full_name',
      shortName: 'short_name',
      companyName: 'company_name',
      streetAddress: 'street_address',
      postalCode: 'postal_code',
      cityName: 'city_name',
      stateName: 'state_name',
      countryCode: 'country_code',
      timeZone: 'time_zone',
      dateFormat: 'date_format',
      timeFormat: 'time_format',
      weekStart: 'week_start',
      workingHours: 'working_hours',
      breakDuration: 'break_duration',
      overtimeRate: 'overtime_rate',
      baseSalary: 'base_salary',
      hourlyRate: 'hourly_rate',
      contractType: 'contract_type',
      employmentType: 'employment_type',
      jobTitle: 'job_title',
      jobDescription: 'job_description',
      skillsRequired: 'skills_required',
      experienceLevel: 'experience_level',
      educationLevel: 'education_level',
      languageCode: 'language_code',
      currencyCode: 'currency_code',
      paymentMethod: 'payment_method',
      bankAccount: 'bank_account',
      taxNumber: 'tax_number',
      socialSecurity: 'social_security',
      emergencyContact: 'emergency_contact',
      nextOfKin: 'next_of_kin',
      medicalInfo: 'medical_info',
      allergiesList: 'allergies_list',
      bloodType: 'blood_type',
      insuranceNumber: 'insurance_number',
      licenseNumber: 'license_number',
      passportNumber: 'passport_number',
      visaStatus: 'visa_status',
      workPermit: 'work_permit',
      securityClearance: 'security_clearance',
      backgroundCheck: 'background_check',
      drugTest: 'drug_test',
      performanceRating: 'performance_rating',
      attendanceRate: 'attendance_rate',
      tardinessCount: 'tardiness_count',
      absenceCount: 'absence_count',
      vacationDays: 'vacation_days',
      sickDays: 'sick_days',
      remainingDays: 'remaining_days',
      usedDays: 'used_days',
      carryOver: 'carry_over',
      approvalStatus: 'approval_status',
      approvedBy: 'approved_by',
      approvedAt: 'approved_at',
      rejectedBy: 'rejected_by',
      rejectedAt: 'rejected_at',
      rejectionReason: 'rejection_reason',
      cancellationReason: 'cancellation_reason',
      notificationSent: 'notification_sent',
      reminderSent: 'reminder_sent',
      followUp: 'follow_up',
      priorityLevel: 'priority_level',
      severityLevel: 'severity_level',
      impactLevel: 'impact_level',
      riskLevel: 'risk_level',
      completionRate: 'completion_rate',
      successRate: 'success_rate',
      failureRate: 'failure_rate',
      errorCount: 'error_count',
      warningCount: 'warning_count',
      retryCount: 'retry_count',
      maxRetries: 'max_retries',
      timeoutSeconds: 'timeout_seconds',
      responseTime: 'response_time',
      processingTime: 'processing_time',
      queuePosition: 'queue_position',
      batchSize: 'batch_size',
      chunkSize: 'chunk_size',
      bufferSize: 'buffer_size',
      cacheTtl: 'cache_ttl',
      rateLimit: 'rate_limit',
      apiKey: 'api_key',
      apiSecret: 'api_secret',
      webhookUrl: 'webhook_url',
      callbackUrl: 'callback_url',
      redirectUrl: 'redirect_url',
      returnUrl: 'return_url',
      cancelUrl: 'cancel_url',
      successUrl: 'success_url',
      failureUrl: 'failure_url',
      termsAccepted: 'terms_accepted',
      privacyAccepted: 'privacy_accepted',
      cookiesAccepted: 'cookies_accepted',
      newsletterSubscribed: 'newsletter_subscribed',
      smsEnabled: 'sms_enabled',
      pushEnabled: 'push_enabled',
      emailVerified: 'email_verified',
      phoneVerified: 'phone_verified',
      twoFactorEnabled: 'two_factor_enabled',
      rememberMe: 'remember_me',
      stayLoggedIn: 'stay_logged_in',
      autoLogin: 'auto_login',
      singleSignOn: 'single_sign_on',
      oauthProvider: 'oauth_provider',
      oauthToken: 'oauth_token',
      sessionId: 'session_id',
      deviceId: 'device_id',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      browserName: 'browser_name',
      browserVersion: 'browser_version',
      osName: 'os_name',
      osVersion: 'os_version',
      deviceType: 'device_type',
      screenWidth: 'screen_width',
      screenHeight: 'screen_height',
      colorDepth: 'color_depth',
      pixelRatio: 'pixel_ratio',
      touchEnabled: 'touch_enabled',
      geolocationEnabled: 'geolocation_enabled',
      notificationEnabled: 'notification_enabled',
      localStorageEnabled: 'local_storage_enabled',
      sessionStorageEnabled: 'session_storage_enabled',
      indexedDbEnabled: 'indexed_db_enabled',
      serviceWorkerEnabled: 'service_worker_enabled',
      webGlEnabled: 'web_gl_enabled',
      webRtcEnabled: 'web_rtc_enabled',
    };

    return specialCases[str] ?? str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  /**
   * Apply specific field conversions for v2 format
   */
  private static applyV2FieldConversions(data: Record<string, unknown>): Record<string, unknown> {
    // Convert date strings to Date objects where appropriate
    const dateFields = [
      'createdAt',
      'updatedAt',
      'deletedAt',
      'startDate',
      'endDate',
      'birthDate',
      'hireDate',
      'lastLogin',
      'expiresAt',
      'approvedAt',
      'rejectedAt',
      'startTime',
      'endTime',
    ];

    dateFields.forEach((field) => {
      if (data[field] != null && typeof data[field] === 'string') {
        const date = new Date(data[field]);
        if (!isNaN(date.getTime())) {
          data[field] = date.toISOString();
        }
      }
    });

    // Convert numeric strings to numbers where appropriate
    const numericFields = [
      'id',
      'userId',
      'tenantId',
      'departmentId',
      'teamId',
      'shiftId',
      'documentId',
      'fileSize',
      'totalCount',
      'pageSize',
      'currentPage',
      'totalPages',
      'viewCount',
      'likeCount',
      'commentCount',
      'attachmentCount',
      'maxFileSize',
      'vacationDays',
      'sickDays',
      'remainingDays',
      'usedDays',
      'carryOver',
      'priorityLevel',
      'severityLevel',
      'impactLevel',
      'riskLevel',
      'completionRate',
      'successRate',
      'failureRate',
      'errorCount',
      'warningCount',
      'retryCount',
      'maxRetries',
      'timeoutSeconds',
      'responseTime',
      'processingTime',
      'queuePosition',
      'batchSize',
      'chunkSize',
      'bufferSize',
      'cacheTtl',
      'rateLimit',
      'screenWidth',
      'screenHeight',
      'colorDepth',
      'pixelRatio',
      'expiresIn',
    ];

    numericFields.forEach((field) => {
      if (data[field] != null && typeof data[field] === 'string') {
        const num = Number(data[field]);
        if (!isNaN(num)) {
          data[field] = num;
        }
      }
    });

    // Convert boolean strings to booleans where appropriate
    const booleanFields = [
      'isActive',
      'isDeleted',
      'isAdmin',
      'isRoot',
      'isPublic',
      'isArchived',
      'isPublished',
      'isFeatured',
      'isPinned',
      'hasNext',
      'hasPrevious',
      'notificationSent',
      'reminderSent',
      'followUp',
      'termsAccepted',
      'privacyAccepted',
      'cookiesAccepted',
      'newsletterSubscribed',
      'smsEnabled',
      'pushEnabled',
      'emailVerified',
      'phoneVerified',
      'twoFactorEnabled',
      'rememberMe',
      'stayLoggedIn',
      'autoLogin',
      'singleSignOn',
      'touchEnabled',
      'geolocationEnabled',
      'notificationEnabled',
      'localStorageEnabled',
      'sessionStorageEnabled',
      'indexedDbEnabled',
      'serviceWorkerEnabled',
      'webGlEnabled',
      'webRtcEnabled',
    ];

    booleanFields.forEach((field) => {
      if (data[field] != null) {
        if (typeof data[field] === 'string') {
          data[field] = data[field] === 'true' || data[field] === '1';
        } else if (typeof data[field] === 'number') {
          data[field] = data[field] === 1;
        }
      }
    });

    return data;
  }

  /**
   * Apply specific field conversions for v1 format
   */
  private static applyV1FieldConversions(data: Record<string, unknown>): Record<string, unknown> {
    // Convert Date objects to strings for v1
    const dateFields = [
      'created_at',
      'updated_at',
      'deleted_at',
      'start_date',
      'end_date',
      'birth_date',
      'hire_date',
      'last_login',
      'expires_at',
      'approved_at',
      'rejected_at',
      'start_time',
      'end_time',
    ];

    dateFields.forEach((field) => {
      if (data[field] instanceof Date) {
        data[field] = data[field].toISOString();
      }
    });

    // Convert booleans to numbers for v1 (MySQL style)
    const booleanFields = [
      'is_active',
      'is_deleted',
      'is_admin',
      'is_root',
      'is_public',
      'is_archived',
      'is_published',
      'is_featured',
      'is_pinned',
      'has_next',
      'has_previous',
      'notification_sent',
      'reminder_sent',
      'follow_up',
      'terms_accepted',
      'privacy_accepted',
      'cookies_accepted',
      'newsletter_subscribed',
      'sms_enabled',
      'push_enabled',
      'email_verified',
      'phone_verified',
      'two_factor_enabled',
      'remember_me',
      'stay_logged_in',
      'auto_login',
      'single_sign_on',
      'touch_enabled',
      'geolocation_enabled',
      'notification_enabled',
      'local_storage_enabled',
      'session_storage_enabled',
      'indexed_db_enabled',
      'service_worker_enabled',
      'web_gl_enabled',
      'web_rtc_enabled',
    ];

    booleanFields.forEach((field) => {
      if (typeof data[field] === 'boolean') {
        data[field] = data[field] ? 1 : 0;
      }
    });

    return data;
  }

  /**
   * Convert API endpoint from v1 to v2 format
   */
  static convertEndpoint(v1Endpoint: string): string {
    const endpointMap: Record<string, string> = {
      '/api/auth': '/api/v2/auth',
      '/api/users': '/api/v2/users',
      '/api/calendar': '/api/v2/calendar',
      '/api/chat': '/api/v2/chat',
      '/api/departments': '/api/v2/departments',
      '/api/teams': '/api/v2/teams',
      '/api/documents': '/api/v2/documents',
      '/api/blackboard': '/api/v2/blackboard',
      '/api/role-switch': '/api/v2/role-switch',
      '/api/kvp': '/api/v2/kvp',
      '/api/shifts': '/api/v2/shifts',
      '/api/surveys': '/api/v2/surveys',
      '/api/admin': '/api/v2/admin-permissions',
      '/api/plans': '/api/v2/plans',
      '/api/machines': '/api/v2/machines',
      '/api/logs': '/api/v2/logs',
      '/api/features': '/api/v2/features',
      '/api/areas': '/api/v2/areas',
      '/api/department-groups': '/api/v2/department-groups',
      '/api/signup': '/api/v2/signup',
      '/api/notifications': '/api/v2/notifications',
      '/api/settings': '/api/v2/settings',
      '/api/reports': '/api/v2/reports',
      '/api/audit-trail': '/api/v2/audit-trail',
      '/api/roles': '/api/v2/roles',
      '/api/root': '/api/v2/root',
    };

    // Check if exact match exists
    for (const [v1Path, v2Path] of Object.entries(endpointMap)) {
      if (v1Endpoint.startsWith(v1Path)) {
        return v1Endpoint.replace(v1Path, v2Path);
      }
    }

    // Default conversion: add /v2 after /api
    if (v1Endpoint.startsWith('/api/')) {
      return v1Endpoint.replace('/api/', '/api/v2/');
    }

    return v1Endpoint;
  }

  /**
   * Adapt pagination response format
   */
  static adaptPaginationResponse(response: unknown, v2Format = true): unknown {
    if (v2Format) {
      // Convert v1 pagination to v2 format
      const responseObj = response as Record<string, unknown>;
      if (responseObj.data != null && Array.isArray(responseObj.data)) {
        return {
          success: true,
          data: {
            items: this.toV2Format(responseObj.data),
            pagination: {
              page: responseObj.page ?? 1,
              pageSize: responseObj.per_page ?? responseObj.limit ?? 20,
              total: responseObj.total ?? (responseObj.data as unknown[]).length,
              totalPages:
                responseObj.total_pages ??
                Math.ceil(
                  (responseObj.total != null ? Number(responseObj.total) : (responseObj.data as unknown[]).length) /
                    (responseObj.per_page != null
                      ? Number(responseObj.per_page)
                      : responseObj.limit != null
                        ? Number(responseObj.limit)
                        : 20),
                ),
            },
          },
        };
      }

      // Handle array responses without pagination info
      if (Array.isArray(response)) {
        return {
          success: true,
          data: this.toV2Format(response),
        };
      }

      // Handle object responses
      return {
        success: true,
        data: this.toV2Format(response),
      };
    } else {
      // Convert v2 pagination to v1 format
      const respObj = response as Record<string, unknown>;
      const respData = respObj.data as Record<string, unknown>;
      if (respData.items != null && respData.pagination != null) {
        const pagination = respData.pagination as Record<string, unknown>;
        return {
          data: this.fromV2Format(respData.items),
          page: pagination.page,
          per_page: pagination.pageSize,
          total: pagination.total,
          total_pages: pagination.totalPages,
        };
      }

      // Handle non-paginated responses
      if ((response as Record<string, unknown>).data != null) {
        return this.fromV2Format((response as Record<string, unknown>).data);
      }

      return response;
    }
  }

  /**
   * Adapt error response format
   */
  static adaptErrorResponse(error: unknown, v2Format = true): unknown {
    if (v2Format) {
      // Convert v1 error to v2 format
      return {
        success: false,
        error: {
          code: (error as Record<string, unknown>).code ?? (error as Record<string, unknown>).error ?? 'UNKNOWN_ERROR',
          message:
            (error as Record<string, unknown>).message ??
            (error as Record<string, unknown>).error_message ??
            'An error occurred',
          details: (error as Record<string, unknown>).details ?? (error as Record<string, unknown>).errors ?? null,
        },
      };
    } else {
      // Convert v2 error to v1 format
      const errorObj = error as Record<string, unknown>;
      if (errorObj.error != null) {
        const errorDetails = errorObj.error as Record<string, unknown>;
        return {
          error: errorDetails.code,
          message: errorDetails.message,
          details: errorDetails.details,
        };
      }
      return error;
    }
  }

  /**
   * Convert from v2 format (camelCase) to v1 format (snake_case)
   */
  static fromV2Format(data: unknown): unknown {
    if (data === null || data === undefined) return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.fromV2Format(item));
    }

    if (typeof data === 'object') {
      const converted: Record<string, unknown> = {};

      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          const snakeKey = this.camelToSnake(key);
          converted[snakeKey] = this.fromV2Format((data as Record<string, unknown>)[key]);
        }
      }

      return this.applyV1FieldConversions(converted);
    }

    return data;
  }

  /**
   * Adapt user response from v2 (camelCase) to v1 (snake_case) format
   */
  static adaptUserResponse(v2User: unknown): unknown {
    if (v2User === null || v2User === undefined) return v2User;

    // Convert from v2 to v1 format
    return this.fromV2Format(v2User);
  }

  /**
   * Adapt user request from v1 (snake_case) to v2 (camelCase) format
   */
  static adaptUserRequest(v1User: unknown): unknown {
    if (v1User === null || v1User === undefined) return v1User;

    // Convert from v1 to v2 format
    return this.toV2Format(v1User);
  }
}
