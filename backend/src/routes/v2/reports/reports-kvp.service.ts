/**
 * Reports KVP Service v2
 * Business logic for KVP (continuous improvement) analytics and ROI reporting
 */
import { log, error as logError } from 'console';

import { query as executeQuery } from '../../../utils/db.js';
import { dbToApi } from '../../../utils/fieldMapping.js';
import { getDefaultDateFrom, getDefaultDateTo } from './reports-metrics.service.js';

/**
 * Build KVP query conditions from filters
 */
function buildKvpQueryConditions(
  tenantId: number,
  dateFrom: string,
  dateTo: string,
  categoryId?: number,
): { conditions: string[]; params: (string | number)[] } {
  const conditions = [`k.tenant_id = ?`];
  const params: (string | number)[] = [tenantId];

  conditions.push(`k.created_at BETWEEN ? AND ?`);
  params.push(dateFrom, dateTo);

  if (categoryId) {
    conditions.push(`k.category_id = ?`);
    params.push(categoryId);
  }

  return { conditions, params };
}

/**
 * Get KVP summary data (total suggestions, implemented, cost, savings)
 */
async function getKvpSummary(
  conditions: string[],
  params: (string | number)[],
): Promise<Record<string, unknown>> {
  const [rows] = await executeQuery(
    `
    SELECT
      COUNT(*) as total_suggestions,
      COUNT(CASE WHEN status = 'implemented' THEN 1 END) as implemented,
      SUM(CASE WHEN status = 'implemented' THEN estimated_cost ELSE 0 END) as total_cost,
      SUM(CASE WHEN status = 'implemented' THEN actual_savings ELSE 0 END) as total_savings
    FROM kvp_suggestions k
    WHERE ${conditions.join(' AND ')}
  `,
    params,
  );
  return (rows as Record<string, unknown>[])[0] ?? {};
}

/**
 * Get KVP metrics grouped by category
 */
async function getKvpByCategory(
  tenantId: number,
  dateFrom: string,
  dateTo: string,
): Promise<Record<string, unknown>[]> {
  const [rows] = await executeQuery(
    `
    SELECT
      c.id as category_id,
      c.name as category_name,
      COUNT(k.id) as suggestions,
      COUNT(CASE WHEN k.status = 'implemented' THEN 1 END) as implemented,
      AVG(CASE WHEN k.status = 'implemented' THEN k.actual_savings ELSE NULL END) as avg_savings
    FROM kvp_categories c
    LEFT JOIN kvp_suggestions k ON k.category_id = c.id
      AND k.tenant_id = ?
      AND k.created_at BETWEEN ? AND ?
    GROUP BY c.id, c.name
    ORDER BY suggestions DESC
  `,
    [tenantId, dateFrom, dateTo],
  );
  return rows as Record<string, unknown>[];
}

/**
 * Get top KVP performers (employees with most suggestions/savings)
 */
async function getKvpTopPerformers(
  tenantId: number,
  dateFrom: string,
  dateTo: string,
): Promise<Record<string, unknown>[]> {
  const [rows] = await executeQuery(
    `
    SELECT
      u.id as user_id,
      CONCAT(u.first_name, ' ', u.last_name) as name,
      COUNT(k.id) as suggestions,
      SUM(CASE WHEN k.status = 'implemented' THEN k.actual_savings ELSE 0 END) as total_savings
    FROM users u
    JOIN kvp_suggestions k ON k.submitted_by = u.id
    WHERE k.tenant_id = ?
      AND k.created_at BETWEEN ? AND ?
    GROUP BY u.id, u.first_name, u.last_name
    HAVING suggestions > 0
    ORDER BY total_savings DESC
    LIMIT 10
  `,
    [tenantId, dateFrom, dateTo],
  );
  return rows as Record<string, unknown>[];
}

/**
 * Calculate ROI from summary data
 * ROI = (Savings - Cost) / Cost
 */
function calculateRoi(summary: Record<string, unknown>): number {
  const totalCost = Number(summary.total_cost);
  const totalSavings = Number(summary.total_savings);
  return totalCost > 0 ? (totalSavings - totalCost) / totalCost : 0;
}

/**
 * Get KVP ROI report with category breakdown and top performers
 * @param filters - Filter criteria containing tenantId, date range, and optional categoryId
 * @returns Comprehensive KVP ROI analytics report
 */
export async function getKvpReport(filters: {
  tenantId: number;
  dateFrom?: string;
  dateTo?: string;
  categoryId?: number;
}): Promise<Record<string, unknown>> {
  try {
    log('[Reports Service] getKvpReport called with:', filters);

    const dateFrom = filters.dateFrom ?? getDefaultDateFrom();
    const dateTo = filters.dateTo ?? getDefaultDateTo();

    const { conditions, params } = buildKvpQueryConditions(
      filters.tenantId,
      dateFrom,
      dateTo,
      filters.categoryId,
    );

    // Get all KVP data in parallel
    const [summary, byCategory, topPerformers] = await Promise.all([
      getKvpSummary(conditions, params),
      getKvpByCategory(filters.tenantId, dateFrom, dateTo),
      getKvpTopPerformers(filters.tenantId, dateFrom, dateTo),
    ]);

    return {
      period: { from: dateFrom, to: dateTo },
      summary: {
        totalSuggestions: Number.parseInt(String(summary.total_suggestions)) || 0,
        implemented: Number.parseInt(String(summary.implemented)) || 0,
        totalCost: Number.parseFloat(String(summary.total_cost)) || 0,
        totalSavings: Number.parseFloat(String(summary.total_savings)) || 0,
        roi: calculateRoi(summary),
      },
      byCategory: byCategory.map((row: Record<string, unknown>) => dbToApi(row)),
      topPerformers: topPerformers.map((row: Record<string, unknown>) => dbToApi(row)),
    };
  } catch (error: unknown) {
    logError('[Reports Service] Error in getKvpReport:', error);
    throw error;
  }
}
