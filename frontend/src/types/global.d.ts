// Global Type Declarations for Frontend

import type { User, JWTPayload } from './api.types';
import type { UnifiedNavigation } from '../scripts/components/unified-navigation';

// Extend Window interface
interface Window {
  unifiedNav?: UnifiedNavigation;
  UnifiedNavigation?: typeof UnifiedNavigation;
  showSuccess?: (message: string) => void;
  showError?: (message: string) => void;
  showInfo?: (message: string) => void;
  showSection?: (section: string) => void;
}

// Declare global functions
declare function getAuthToken(): string | null;
declare function setAuthToken(token: string): void;
declare function removeAuthToken(): void;
declare function isAuthenticated(): boolean;
declare function fetchWithAuth(url: string, options?: RequestInit): Promise<Response>;
declare function loadUserInfo(): Promise<User>;
declare function logout(): void;
declare function showSuccess(message: string): void;
declare function showError(message: string): void;
declare function showInfo(message: string): void;
declare function showSection(sectionId: string): void;
declare function parseJwt(token: string): JWTPayload;

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

declare function Toastify(options: ToastifyOptions): ToastifyInstance;

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
