/**
 * Database Helper Utilities
 *
 * Shared pure functions for DB row → API response mapping.
 * Companion to field-mapper.ts (which handles snake_case ↔ camelCase).
 */

/** Coerce a Date|string DB value to ISO string */
export function toIsoString(value: Date | string): string {
  return typeof value === 'string' ? value : new Date(value).toISOString();
}

/** Coerce a nullable Date|string DB value to ISO string or null */
export function toIsoStringOrNull(value: Date | string | null): string | null {
  return value === null ? null : toIsoString(value);
}

/** Build a full name from first/last, with fallback for empty results */
export function buildFullName(
  first: string | null | undefined,
  last: string | null | undefined,
  fallback: string = 'Unknown',
): string {
  const full = `${first ?? ''} ${last ?? ''}`.trim();
  return full !== '' ? full : fallback;
}

/** Parse a comma-separated STRING_AGG result into string array */
export function parseStringAgg(agg: string | null): string[] {
  if (agg === null || agg === '') return [];
  return agg.split(',').map((s: string) => s.trim());
}

/** Parse a comma-separated STRING_AGG result into number array */
export function parseStringAggNumbers(agg: string | null): number[] {
  if (agg === null || agg === '') return [];
  return agg.split(',').map((s: string) => Number(s.trim()));
}

/** Field mapping tuple: [apiField, dbColumn] */
export type FieldMapping = readonly [string, string];

/** Result of building a SET clause */
export interface SetClauseResult {
  setClauses: string[];
  params: unknown[];
  nextParamIndex: number;
}

/**
 * Build parameterized SET clauses from field mappings.
 * Only includes fields that are !== undefined in the data object.
 */
export function buildSetClause(
  data: Record<string, unknown>,
  mappings: readonly FieldMapping[],
  startIndex: number = 1,
): SetClauseResult {
  const setClauses: string[] = [];
  const params: unknown[] = [];
  let idx = startIndex;

  for (const [apiField, dbColumn] of mappings) {
    if (data[apiField] !== undefined) {
      setClauses.push(`${dbColumn} = $${idx}`);
      params.push(data[apiField]);
      idx++;
    }
  }

  return { setClauses, params, nextParamIndex: idx };
}
