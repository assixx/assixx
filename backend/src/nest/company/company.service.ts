/**
 * Company Service
 *
 * Reads and updates tenant company data (address, contact) from the tenants table.
 */
import { Injectable, Logger } from '@nestjs/common';
import type { QueryResultRow } from 'pg';

import { DatabaseService } from '../database/database.service.js';
import type { CompanyData, UpdateCompanyDto } from './dto/company.dto.js';

// ============================================================================
// DATABASE ROW TYPES
// ============================================================================

interface DbCompanyRow extends QueryResultRow {
  company_name: string;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: string | null;
  phone: string | null;
  email: string;
}

// ============================================================================
// SERVICE
// ============================================================================

@Injectable()
export class CompanyService {
  private readonly logger = new Logger(CompanyService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Get company data for the current tenant
   */
  async getCompanyData(tenantId: number): Promise<CompanyData> {
    const rows = await this.db.tenantQuery<DbCompanyRow>(
      `SELECT company_name, street, house_number, postal_code, city, country_code, phone, email
       FROM tenants
       WHERE id = $1`,
      [tenantId],
    );

    const row = rows[0];
    if (row === undefined) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    return {
      companyName: row.company_name,
      street: row.street,
      houseNumber: row.house_number,
      postalCode: row.postal_code,
      city: row.city,
      countryCode: row.country_code?.trim() ?? null,
      phone: row.phone,
      email: row.email,
    };
  }

  /**
   * Update company address data for the current tenant
   */
  async updateCompanyData(tenantId: number, dto: UpdateCompanyDto): Promise<CompanyData> {
    const setClauses: string[] = [];
    const values: (string | null)[] = [];
    let paramIndex = 1;

    if (dto.street !== undefined) {
      setClauses.push(`street = $${paramIndex++}`);
      values.push(dto.street);
    }
    if (dto.houseNumber !== undefined) {
      setClauses.push(`house_number = $${paramIndex++}`);
      values.push(dto.houseNumber);
    }
    if (dto.postalCode !== undefined) {
      setClauses.push(`postal_code = $${paramIndex++}`);
      values.push(dto.postalCode);
    }
    if (dto.city !== undefined) {
      setClauses.push(`city = $${paramIndex++}`);
      values.push(dto.city);
    }
    if (dto.countryCode !== undefined) {
      setClauses.push(`country_code = $${paramIndex++}`);
      values.push(dto.countryCode);
    }

    if (setClauses.length === 0) {
      return await this.getCompanyData(tenantId);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(String(tenantId));

    const sql = `UPDATE tenants SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING company_name, street, house_number, postal_code, city, country_code, phone, email`;

    const rows = await this.db.tenantQuery<DbCompanyRow>(sql, values);

    const row = rows[0];
    if (row === undefined) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    this.logger.log(`Company data updated for tenant=${tenantId}`);

    return {
      companyName: row.company_name,
      street: row.street,
      houseNumber: row.house_number,
      postalCode: row.postal_code,
      city: row.city,
      countryCode: row.country_code?.trim() ?? null,
      phone: row.phone,
      email: row.email,
    };
  }
}
