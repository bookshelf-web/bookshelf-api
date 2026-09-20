import { z } from 'zod';
import { CatalogBookStatus, CatalogReviewStatus } from './models/CatalogBook';
import { RevisionStatus } from './models/CatalogRevision';

const page = z.coerce.number().int().positive().default(1);
const limit = z.coerce.number().int().positive().max(100).default(20);

export const idParamsSchema = z.object({ id: z.string().uuid('Invalid id') });

export const catalogSearchQuerySchema = z.object({
  isbn: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  page,
  limit,
});

export const reviewBooksQuerySchema = z.object({
  review: z.nativeEnum(CatalogReviewStatus).optional(),
  status: z.nativeEnum(CatalogBookStatus).optional(),
  page,
  limit,
});

export const revisionsQuerySchema = z.object({
  status: z.nativeEnum(RevisionStatus).optional(),
  page,
  limit,
});

const nullableText = (max: number) => z.string().trim().max(max).nullish();

/** An admin can change any catalog field; `null` or blank clears an optional one. */
export const adminEditSchema = z
  .object({
    title: z.string().trim().min(1, 'Title cannot be empty').max(255).optional(),
    author: z.string().trim().min(1, 'Author cannot be empty').max(255).optional(),
    isbn: nullableText(20),
    publisher: nullableText(255),
    publishedYear: z.number().int().min(1000).max(new Date().getFullYear()).nullish(),
    edition: nullableText(100),
    pages: z.number().int().positive().nullish(),
    language: nullableText(10),
    description: z.string().nullish(),
    coverUrl: nullableText(500),
  })
  .strict();

export const visibilitySchema = z.object({
  hidden: z.boolean({ required_error: 'hidden is required' }),
  reason: z.string().trim().max(500).optional(),
});

export const decisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
});
