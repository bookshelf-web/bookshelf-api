import { z } from 'zod';
import { BookStatus } from '../../types/books';

/** Columns clients may sort by (whitelist guards against SQL injection). */
export const SORTABLE_COLUMNS = [
  'title',
  'author',
  'status',
  'rating',
  'pages',
  'publishedYear',
  'createdAt',
  'updatedAt',
] as const;

const notInTheFuture = (year: number | null | undefined) =>
  year === undefined || year === null || year <= new Date().getFullYear();

const ratingInRange = (rating: number | null | undefined) =>
  rating === undefined || rating === null || (rating >= 1 && rating <= 5);

const publishedYear = z
  .number()
  .int()
  .nullish()
  .refine(notInTheFuture, { message: 'Published year cannot be in the future' });

const rating = z
  .number()
  .int()
  .nullish()
  .refine(ratingInRange, { message: 'Rating must be between 1 and 5' });

/**
 * Optional string fields. On create an empty/blank value is treated as "absent";
 * on update `null` is kept so a client can explicitly clear a field.
 */
const optionalText = z
  .union([z.string(), z.null()])
  .optional()
  .transform(value => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const clearableText = z.string().nullish();

/** On create, null and absent are equivalent, so both collapse to undefined. */
const nullToUndefined = <T>(value: T | null | undefined) => value ?? undefined;

export const createBookSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).trim().min(1, 'Title is required'),
  author: z.string({ required_error: 'Author is required' }).trim().min(1, 'Author is required'),
  isbn: optionalText,
  publisher: optionalText,
  publishedYear: publishedYear.transform(nullToUndefined),
  pages: z.number().int().nullish().transform(nullToUndefined),
  language: optionalText,
  description: optionalText,
  rating: rating.transform(nullToUndefined),
  notes: optionalText,
  coverUrl: optionalText,
});

export const updateBookSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').optional(),
  author: z.string().trim().min(1, 'Author cannot be empty').optional(),
  status: z.nativeEnum(BookStatus).optional(),
  isbn: clearableText,
  publisher: clearableText,
  publishedYear,
  pages: z.number().int().nullish(),
  language: clearableText,
  description: clearableText,
  rating,
  notes: clearableText,
  coverUrl: clearableText,
});

export const updateBookStatusSchema = z.object({
  status: z.nativeEnum(BookStatus, {
    errorMap: () => ({ message: 'Invalid status. Use one of: to_read, reading, read' }),
  }),
});

export const bookIdParamsSchema = z.object({
  id: z.string().uuid('Invalid book id'),
});

export const listBooksQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.nativeEnum(BookStatus).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  search: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  author: z.string().trim().min(1).optional(),
  sortBy: z.enum(SORTABLE_COLUMNS).optional(),
  sortOrder: z
    .string()
    .transform(value => value.toUpperCase())
    .pipe(z.enum(['ASC', 'DESC']))
    .optional(),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;
