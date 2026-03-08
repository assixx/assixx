/**
 * Employee ID Generator
 * Format: DOMAINROLEIDDDMMYYYYHHMM
 * Example: SCSRT10120620251752
 */

function getRoleAbbreviation(role: string): string {
  const roleMap: Record<string, string> = {
    root: 'RT',
    admin: 'AD',
    employee: 'EMP',
  };
  return roleMap[role.toLowerCase()] ?? 'EMP';
}

/**
 * Get current datetime in DDMMYYYYHHMM format
 */
function getDateTimeString(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');

  return `${dd}${mm}${yyyy}${hh}${min}`;
}

/**
 * Generates a unique employee ID
 * @param subdomain - Tenant subdomain (e.g., 'scs'), truncated to 10 chars
 * @param role - User role ('root' | 'admin' | 'employee')
 * @returns Formatted employee ID (e.g., SCSRT10120620251752)
 */
export function generateEmployeeId(
  subdomain: string,
  role: string,
  userId: number,
): string {
  const domain = subdomain.toUpperCase().slice(0, 10);
  const roleCode = getRoleAbbreviation(role);
  const dateTime = getDateTimeString();

  return `${domain}${roleCode}${userId}${dateTime}`;
}
