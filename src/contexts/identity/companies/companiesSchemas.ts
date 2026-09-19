import { z } from 'zod';
import { CompanyRole } from '../models/CompanyMember';
import { isValidCnpj, normalizeCnpj } from './cnpj';

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

const requiredText = (label: string, max = 255) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must have at most ${max} characters`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform(value => value || undefined);

const cnpj = z
  .string({ required_error: 'CNPJ is required' })
  .transform(normalizeCnpj)
  .refine(isValidCnpj, { message: 'CNPJ is invalid' });

const phone = z
  .string()
  .transform(value => value.replace(/\D/g, ''))
  .refine(value => value.length === 0 || value.length === 10 || value.length === 11, {
    message: 'Phone must have 10 or 11 digits',
  })
  .nullish()
  .transform(value => value || undefined);

const address = z.object({
  street: requiredText('Street'),
  number: requiredText('Number', 20),
  complement: optionalText(100),
  district: requiredText('District', 100),
  city: requiredText('City', 100),
  state: z
    .string({ required_error: 'State is required' })
    .trim()
    .toUpperCase()
    .refine(value => (BRAZILIAN_STATES as readonly string[]).includes(value), {
      message: 'State must be a valid Brazilian state code',
    }),
  zip: z
    .string({ required_error: 'ZIP code is required' })
    .transform(value => value.replace(/\D/g, ''))
    .refine(value => value.length === 8, { message: 'ZIP code must have 8 digits' }),
});

const companyFields = {
  legalName: requiredText('Legal name'),
  tradeName: optionalText(255),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
  phone,
  address,
};

export const createCompanySchema = z.object({ cnpj, ...companyFields });

/** The CNPJ identifies the company and cannot be changed afterwards. */
export const updateCompanySchema = z.object(companyFields).partial();

export const companyIdParamsSchema = z.object({ id: z.string().uuid('Invalid company id') });

export const memberParamsSchema = z.object({
  id: z.string().uuid('Invalid company id'),
  userId: z.string().uuid('Invalid user id'),
});

export const addMemberSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Invalid email address'),
  role: z.enum([CompanyRole.MANAGER, CompanyRole.STAFF]).default(CompanyRole.STAFF),
});

export const verificationSchema = z.object({
  verified: z.boolean({ required_error: 'verified is required' }),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
