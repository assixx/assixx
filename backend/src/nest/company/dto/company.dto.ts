/**
 * Company DTO
 *
 * Data transfer objects for tenant company data (address, contact).
 * Uses Zod for runtime validation.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ========================================
// SCHEMA DEFINITIONS
// ========================================

const StreetSchema = z
  .string()
  .min(1, 'Straße ist erforderlich')
  .max(255, 'Straße darf maximal 255 Zeichen lang sein')
  .regex(
    /^[a-zA-Z0-9\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df\s\-.,/()]+$/,
    'Straße enthält ungültige Zeichen',
  )
  .transform((val: string) => val.trim());

const HouseNumberSchema = z
  .string()
  .min(1, 'Hausnummer ist erforderlich')
  .max(20, 'Hausnummer darf maximal 20 Zeichen lang sein')
  .regex(/^[a-zA-Z0-9\s\-/]+$/, 'Hausnummer enthält ungültige Zeichen')
  .transform((val: string) => val.trim());

const PostalCodeSchema = z
  .string()
  .min(3, 'PLZ muss mindestens 3 Zeichen lang sein')
  .max(20, 'PLZ darf maximal 20 Zeichen lang sein')
  .regex(/^[a-zA-Z0-9\s-]+$/, 'PLZ enthält ungültige Zeichen')
  .transform((val: string) => val.trim());

const CitySchema = z
  .string()
  .min(1, 'Stadt ist erforderlich')
  .max(100, 'Stadt darf maximal 100 Zeichen lang sein')
  .regex(
    /^[a-zA-Z\u00e4\u00f6\u00fc\u00c4\u00d6\u00dc\u00df\s\-.,()'/]+$/,
    'Stadt enthält ungültige Zeichen',
  )
  .transform((val: string) => val.trim());

const CountryCodeSchema = z
  .string()
  .length(2, 'Ländercode muss genau 2 Zeichen lang sein')
  .regex(/^[A-Z]{2}$/, 'Ländercode muss aus zwei Großbuchstaben bestehen')
  .transform((val: string) => val.toUpperCase());

// ========================================
// UPDATE SCHEMA
// ========================================

/**
 * All address fields optional — PATCH semantics (partial update)
 */
export const UpdateCompanySchema = z.object({
  street: StreetSchema.optional(),
  houseNumber: HouseNumberSchema.optional(),
  postalCode: PostalCodeSchema.optional(),
  city: CitySchema.optional(),
  countryCode: CountryCodeSchema.optional(),
});

export class UpdateCompanyDto extends createZodDto(UpdateCompanySchema) {}

// ========================================
// RESPONSE TYPES
// ========================================

export interface CompanyData {
  companyName: string;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  phone: string | null;
  email: string;
}
