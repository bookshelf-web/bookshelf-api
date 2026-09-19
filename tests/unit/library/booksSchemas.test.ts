import {
  bookIdParamsSchema,
  createBookSchema,
  listBooksQuerySchema,
  SORTABLE_COLUMNS,
  updateBookSchema,
  updateBookStatusSchema,
} from '../../../src/contexts/library/books/booksSchemas';

const nextYear = new Date().getFullYear() + 1;

describe('createBookSchema', () => {
  it('requires a non-blank title and author, trimmed', () => {
    expect(createBookSchema.parse({ title: '  Dom Casmurro ', author: ' Machado ' })).toMatchObject({
      title: 'Dom Casmurro',
      author: 'Machado',
    });
    expect(createBookSchema.safeParse({ title: ' ', author: 'x' }).success).toBe(false);
    expect(createBookSchema.safeParse({ title: 'x' }).success).toBe(false);
  });

  it('treats blank optional text and nulls as absent', () => {
    const parsed = createBookSchema.parse({
      title: 'T',
      author: 'A',
      isbn: '  ',
      publisher: null,
      notes: '',
      rating: null,
      pages: null,
    });

    expect(parsed.isbn).toBeUndefined();
    expect(parsed.publisher).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
    expect(parsed.rating).toBeUndefined();
    expect(parsed.pages).toBeUndefined();
  });

  it.each([
    ['a rating below 1', { rating: 0 }],
    ['a rating above 5', { rating: 6 }],
    ['a fractional rating', { rating: 2.5 }],
    ['a future publication year', { publishedYear: nextYear }],
    ['fractional pages', { pages: 10.5 }],
  ])('rejects %s', (_label, extra) => {
    expect(createBookSchema.safeParse({ title: 'T', author: 'A', ...extra }).success).toBe(false);
  });

  it('accepts the boundary values', () => {
    expect(createBookSchema.safeParse({ title: 'T', author: 'A', rating: 1 }).success).toBe(true);
    expect(createBookSchema.safeParse({ title: 'T', author: 'A', rating: 5 }).success).toBe(true);
    expect(
      createBookSchema.safeParse({ title: 'T', author: 'A', publishedYear: new Date().getFullYear() }).success,
    ).toBe(true);
  });
});

describe('updateBookSchema', () => {
  it('keeps null so a field can be cleared explicitly', () => {
    const parsed = updateBookSchema.parse({ rating: null, notes: null, publisher: null, pages: null });

    expect(parsed).toEqual({ rating: null, notes: null, publisher: null, pages: null });
  });

  it('rejects an empty title or author and an unknown status', () => {
    expect(updateBookSchema.safeParse({ title: ' ' }).success).toBe(false);
    expect(updateBookSchema.safeParse({ author: '' }).success).toBe(false);
    expect(updateBookSchema.safeParse({ status: 'lost' }).success).toBe(false);
    expect(updateBookSchema.safeParse({ status: 'reading' }).success).toBe(true);
  });
});

describe('updateBookStatusSchema and bookIdParamsSchema', () => {
  it('explains which statuses are valid', () => {
    const result = updateBookStatusSchema.safeParse({ status: 'nope' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toContain('to_read, reading, read');
  });

  it('requires a uuid', () => {
    expect(bookIdParamsSchema.safeParse({ id: 'abc' }).success).toBe(false);
    expect(bookIdParamsSchema.safeParse({ id: '3f2a1c8e-9b4d-4c6a-8f1e-2d7b5a9c0e11' }).success).toBe(true);
  });
});

describe('listBooksQuerySchema', () => {
  it('applies defaults', () => {
    expect(listBooksQuerySchema.parse({})).toEqual({ page: 1, limit: 10 });
  });

  it('coerces numbers and upper-cases the sort order', () => {
    const parsed = listBooksQuerySchema.parse({
      page: '3',
      limit: '25',
      rating: '4',
      sortBy: 'title',
      sortOrder: 'desc',
      status: 'read',
      search: ' dom ',
    });

    expect(parsed).toMatchObject({ page: 3, limit: 25, rating: 4, sortOrder: 'DESC', search: 'dom' });
  });

  it.each([
    [{ page: '0' }],
    [{ limit: '101' }],
    [{ rating: '6' }],
    [{ status: 'x' }],
    [{ sortBy: 'password' }],
    [{ sortOrder: 'sideways' }],
    [{ search: '   ' }],
  ])('rejects the query %p', query => {
    expect(listBooksQuerySchema.safeParse(query).success).toBe(false);
  });

  it('only allows sorting by a whitelisted column', () => {
    for (const column of SORTABLE_COLUMNS) {
      expect(listBooksQuerySchema.safeParse({ sortBy: column }).success).toBe(true);
    }
  });
});
