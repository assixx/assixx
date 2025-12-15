/**
 * Navigation Services
 * API calls, SSE, badge updates, and storage management
 */

import { apiClient } from '../../../utils/api-client';
import { $$, setHTML } from '../../../utils/dom-utils';
import { tokenManager } from '../../../utils/token-manager';
import { loadUserInfo as loadUserInfoFromAuth } from '../../auth/index';
import { SSEClient } from '../../utils/sse-client';
import { CSS_CLASSES } from './constants';
import type { Role, UserProfileResponse, StorageInfo } from './types';
import { formatBytes, getProgressBarColor, isTestMode } from './utils';

// SSE client instance
let sseClient: SSEClient | null = null;

/**
 * Initialize SSE connection for real-time notifications
 */
export function initializeSSE(onTokenRefreshed?: () => void): void {
  if (isTestMode()) {
    return;
  }

  // Connect to SSE endpoint
  sseClient = new SSEClient('/api/v2/notifications/stream');
  sseClient.connect();

  // Reconnect SSE after token refresh to use new token
  if (onTokenRefreshed) {
    tokenManager.onTokenRefreshed(() => {
      if (sseClient) {
        sseClient.reconnectWithNewToken();
      }
      onTokenRefreshed();
    });
  } else {
    tokenManager.onTokenRefreshed(() => {
      if (sseClient) {
        sseClient.reconnectWithNewToken();
      }
    });
  }

  // Reconnect on visibility change
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && sseClient && !sseClient.isConnected()) {
      sseClient.connect();
    }
  });

  // Clean up SSE connection before page unload
  window.addEventListener('beforeunload', () => {
    if (sseClient?.isConnected() === true) {
      sseClient.disconnect();
    }
  });
}

/**
 * Get SSE client instance
 */
export function getSSEClient(): SSEClient | null {
  return sseClient;
}

/**
 * Load user profile from API
 */
export async function loadUserProfile(): Promise<UserProfileResponse | null> {
  try {
    if (isTestMode()) return null;

    return (await loadUserInfoFromAuth()) as UserProfileResponse;
  } catch (error) {
    console.error('Error loading user data:', error);
    return null;
  }
}

/**
 * Check if error is an abort error (expected during logout/navigation)
 */
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('aborted');
}

/**
 * Update unread chat messages badge
 */
export async function updateUnreadMessages(): Promise<void> {
  try {
    if (isTestMode()) return;

    const data = await apiClient.get<{
      totalUnread: number;
      conversations: {
        conversationId: number;
        conversationName: string | null;
        unreadCount: number;
        lastMessageTime: Date;
      }[];
    }>('/chat/unread-count');

    const badge = $$('#chat-unread-badge');
    if (badge) {
      updateBadgeDisplay(badge, data.totalUnread);
    }
  } catch (error) {
    if (isAbortError(error)) return;
    console.error('Error updating unread messages:', error);
  }
}

/**
 * Mark all documents as read
 */
export async function markAllDocumentsAsRead(): Promise<void> {
  try {
    if (isTestMode()) return;

    await apiClient.post('/documents/mark-all-read');

    const badge = $$('#documents-unread-badge');
    if (badge) {
      badge.classList.add(CSS_CLASSES.hidden);
    }
  } catch (error) {
    console.error('Error marking documents as read:', error);
  }
}

/**
 * Reset KVP badge when admin/root clicks on KVP
 */
export async function resetKvpBadge(): Promise<{ lastKvpClickTimestamp: number; lastKnownKvpCount: number }> {
  const badge = $$('#kvp-badge');
  if (badge) {
    badge.classList.add(CSS_CLASSES.hidden);
    badge.textContent = '0';
  }

  // Save the timestamp
  const lastKvpClickTimestamp = Date.now();
  localStorage.setItem('lastKvpClickTimestamp', lastKvpClickTimestamp.toString());

  let lastKnownKvpCount = 0;

  // Get baseline count from API
  try {
    if (!isTestMode()) {
      const data = await apiClient.get<{
        totalSuggestions: number;
        newSuggestions: number;
        inProgress: number;
        implemented: number;
        rejected: number;
        avgSavings: number | null;
      }>('/kvp/dashboard/stats');

      lastKnownKvpCount = data.newSuggestions;
      localStorage.setItem('lastKnownKvpCount', lastKnownKvpCount.toString());
    }
  } catch (error) {
    console.error('Error fetching KVP count for baseline:', error);
  }

  return { lastKvpClickTimestamp, lastKnownKvpCount };
}

/**
 * Get badge count from element
 */
export function getBadgeCount(badge: HTMLElement | null): number {
  if (badge === null) {
    return 0;
  }

  const isHidden = badge.classList.contains(CSS_CLASSES.hidden);
  const textContent = badge.textContent;

  if (isHidden || textContent === '') {
    return 0;
  }

  const count = Number.parseInt(textContent, 10);
  return Number.isNaN(count) ? 0 : count;
}

/**
 * Update badge display
 */
export function updateBadgeDisplay(badge: HTMLElement, count: number): void {
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count.toString();
    badge.classList.remove(CSS_CLASSES.hidden);
  } else {
    badge.classList.add(CSS_CLASSES.hidden);
  }
}

/**
 * Update Lean Management parent badge based on child badges
 */
export function updateLeanManagementParentBadge(): void {
  const leanBadge = $$('#lean-management-badge');
  if (!leanBadge) {
    return;
  }

  const kvpBadge = $$('#kvp-badge');
  const surveysBadge = $$('#surveys-pending-badge');

  const kvpCount = getBadgeCount(kvpBadge);
  const surveysCount = getBadgeCount(surveysBadge);
  const totalCount = kvpCount + surveysCount;

  updateBadgeDisplay(leanBadge, totalCount);
}

/**
 * Update storage UI elements
 */
export function updateStorageUI(used: number, total: number, percentage: number): void {
  const usedElement = $$('#storage-used');
  const totalElement = $$('#storage-total');
  const progressBar = $$('#storage-progress-bar');
  const percentageElement = $$('#storage-percentage');

  if (usedElement) {
    usedElement.textContent = formatBytes(used);
  }
  if (totalElement) {
    totalElement.textContent = formatBytes(total);
  }
  if (progressBar) {
    progressBar.style.setProperty('--storage-progress', `${percentage}%`);
    progressBar.style.setProperty('--storage-color', getProgressBarColor(percentage));
    progressBar.classList.add(CSS_CLASSES.progressBarDynamic);
  }
  if (percentageElement) {
    percentageElement.textContent = `${percentage}% belegt`;
  }
}

/**
 * Fetch and update storage info for root users
 */
export async function updateStorageInfo(currentRole: Role | null): Promise<void> {
  try {
    if (currentRole !== 'root' || isTestMode()) {
      return;
    }

    const data = await apiClient.get<StorageInfo>('/root/storage');
    const { used, total, percentage } = data;
    updateStorageUI(used, total, percentage);
  } catch (error) {
    console.error('Error updating storage info:', error);
  }
}

/**
 * Update company info in sidebar
 */
export function updateCompanyInfo(userData: UserProfileResponse): void {
  const companyElement = $$('#sidebar-company-name');
  const companyName = userData.tenant?.companyName ?? userData.companyName;
  if (companyElement && companyName !== undefined) {
    companyElement.textContent = companyName;
  }

  const domainElement = $$('#sidebar-domain');
  const subdomain = userData.tenant?.subdomain ?? userData.subdomain;
  if (domainElement && subdomain !== undefined) {
    domainElement.textContent = `${subdomain}.assixx.de`;
  }
}

/**
 * Update user info in sidebar
 */
export function updateUserInfo(userData: UserProfileResponse): void {
  const sidebarUserName = $$('#sidebar-user-name');
  if (sidebarUserName) {
    sidebarUserName.textContent = userData.email;
  }

  const sidebarFullName = $$('#sidebar-user-fullname');
  if (sidebarFullName) {
    const firstName = userData.firstName ?? userData.data?.firstName ?? '';
    const lastName = userData.lastName ?? userData.data?.lastName ?? '';
    if (firstName !== '' || lastName !== '') {
      const fullName = `${firstName} ${lastName}`.trim();
      sidebarFullName.textContent = fullName;
    }
  }
}

/**
 * Update employee number in sidebar
 */
export function updateEmployeeNumber(userData: UserProfileResponse): void {
  const sidebarEmployeeNumber = $$('#sidebar-employee-number');
  if (!sidebarEmployeeNumber) return;

  // API v2: camelCase only (employeeNumber)
  const employeeNumber = userData.employeeNumber ?? userData.data?.employeeNumber;

  if (employeeNumber !== undefined) {
    sidebarEmployeeNumber.classList.add(CSS_CLASSES.employeeNumberVisible);

    if (employeeNumber !== '000001') {
      setHTML(sidebarEmployeeNumber, `<span class="${CSS_CLASSES.employeeNumberText}">${employeeNumber}</span>`);
    } else {
      setHTML(sidebarEmployeeNumber, `<span class="${CSS_CLASSES.employeeNumberText}">Temporär</span>`);
      sidebarEmployeeNumber.classList.add(CSS_CLASSES.employeeNumberTemp);
    }
  }
}

/**
 * Update admin position in sidebar
 */
export function updateAdminPosition(userData: UserProfileResponse, currentRole: Role | null): void {
  const positionElement = $$('#sidebar-user-position');
  if (!positionElement) return;

  if (currentRole !== 'admin') {
    positionElement.classList.add(CSS_CLASSES.hidden);
    return;
  }

  const position =
    (userData as { position?: string }).position ?? (userData.data as { position?: string } | undefined)?.position;

  if (position !== undefined && position !== '') {
    positionElement.textContent = position;
    positionElement.classList.remove(CSS_CLASSES.hidden);
  } else {
    positionElement.classList.add(CSS_CLASSES.hidden);
  }
}

/**
 * Update header user name
 */
export function updateHeaderUserName(userData: UserProfileResponse): void {
  const headerUserName = $$('#user-name');
  if (!headerUserName) return;

  const firstName = userData.firstName ?? userData.data?.firstName ?? '';
  const lastName = userData.lastName ?? userData.data?.lastName ?? '';

  if (firstName !== '' || lastName !== '') {
    const fullName = `${firstName} ${lastName}`.trim();
    headerUserName.textContent = fullName;
  } else {
    headerUserName.textContent = '';
  }
}
