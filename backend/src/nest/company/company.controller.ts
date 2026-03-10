/**
 * Company Controller
 *
 * HTTP endpoints for tenant company data (address, contact):
 * - GET   /company  — Get company data (root only)
 * - PATCH /company  — Update company address (root only)
 */
import { Body, Controller, Get, Patch } from '@nestjs/common';

import { Roles } from '../common/decorators/roles.decorator.js';
import { TenantId } from '../common/decorators/tenant.decorator.js';
import { CompanyService } from './company.service.js';
import type { CompanyData } from './dto/company.dto.js';
import { UpdateCompanyDto } from './dto/company.dto.js';

interface CompanyResponse {
  data: CompanyData;
}

@Controller('company')
@Roles('root')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  /** GET /company — Get company data */
  @Get()
  async getCompanyData(@TenantId() tenantId: number): Promise<CompanyResponse> {
    const data = await this.companyService.getCompanyData(tenantId);
    return { data };
  }

  /** PATCH /company — Update company address */
  @Patch()
  async updateCompanyData(
    @TenantId() tenantId: number,
    @Body() dto: UpdateCompanyDto,
  ): Promise<CompanyResponse> {
    const data = await this.companyService.updateCompanyData(tenantId, dto);
    return { data };
  }
}
