// Global Type Declarations for Frontend

import type { User, JWTPayload } from './api.types';
import type { UnifiedNavigation } from '../scripts/components/navigation/index';
import type { ApiClient } from '../utils/api-client';

// NOTE: Because this file has imports, it's a TypeScript module
// ALL global declarations must be inside 'declare global {}'
declare global {
  // Extend Window interface
  interface Window {
    unifiedNav?: UnifiedNavigation;
    UnifiedNavigation?: typeof UnifiedNavigation;
    openLightbox?: (url: string) => void;
    ApiClient?: typeof ApiClient;
    apiClient?: ApiClient;
    // showSection removed - deprecated, sections are now separate pages
    // showSuccess, showError, showInfo are declared in auth/index.ts
  }

  // Toastify type declarations
  interface ToastifyOptions {
    text: string;
    duration?: number;
    gravity?: 'top' | 'bottom';
    position?: 'left' | 'center' | 'right';
    backgroundColor?: string;
    stopOnFocus?: boolean;
    close?: boolean;
    className?: string;
    style?: Record<string, string>;
    onClick?: () => void;
    callback?: () => void;
    escapeMarkup?: boolean;
    oldestFirst?: boolean;
    newWindow?: boolean;
    offset?: { x?: number | string; y?: number | string };
    avatar?: string;
    selector?: string | HTMLElement;
    destination?: string;
  }

  interface ToastifyInstance {
    showToast: () => void;
    hideToast: () => void;
  }

  // CustomEvent Detail Types
  interface ShareKvpDetail {
    orgLevel: 'company' | 'department' | 'team';
    orgId: number | null;
  }

  interface StatusChangeDetail {
    status: string;
  }

  // FullCalendar Extended Props Interface
  interface CalendarEventExtendedProps {
    description?: string;
    location?: string;
    departmentId?: number;
    teamId?: number;
    userId?: number;
    type?: string;
    status?: string;
  }

  // Extend WindowEventMap with custom events for type-safe event listeners
  interface WindowEventMap {
    shareKvp: CustomEvent<ShareKvpDetail>;
    statusChange: CustomEvent<StatusChangeDetail>;
    loadOrgData: CustomEvent<void>;
  }

  // Global functions
  function getAuthToken(): string | null;
  function setAuthToken(token: string): void;
  function removeAuthToken(): void;
  function isAuthenticated(): boolean;
  function fetchWithAuth(url: string, options?: RequestInit): Promise<Response>;
  function loadUserInfo(): Promise<User>;
  function logout(): void;
  function showSuccess(message: string): void;
  function showError(message: string): void;
  function showInfo(message: string): void;
  // showSection removed - deprecated, sections are now separate pages
  function parseJwt(token: string): JWTPayload | null;

  // eslint-disable-next-line @typescript-eslint/naming-convention -- External library uses PascalCase
  function Toastify(options: ToastifyOptions): ToastifyInstance;
}

// Module declarations for libraries without types
declare module 'marked' {
  export function parse(markdown: string): string;
  export function parseInline(markdown: string): string;
}

// Asset imports
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
