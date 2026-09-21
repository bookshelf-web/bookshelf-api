import { AppDataSource } from '../../config/database';
import { CatalogBook, CatalogBookStatus, CatalogService, normalizeIsbn } from '../catalog';
import { CompaniesService, IdentityDirectory } from '../identity';
import { ForbiddenError, NotFoundError } from '../../shared/errors';
import { AuditService } from '../audit';
import type { CreateListingInput, ListingsQuery, UpdateListingInput } from './marketplaceSchemas';
import { Listing, ListingStatus } from './models/Listing';

export interface ListingView {
  id: string;
  book: Pick<CatalogBook, 'id' | 'title' | 'author' | 'isbn' | 'publisher' | 'publishedYear' | 'edition' | 'coverUrl'>;
  priceCents: number;
  condition: Listing['condition'];
  quantity: number;
  shippingFeeCents: number;
  pickupAvailable: boolean;
  pickupNote: string | null;
  description: string | null;
  status: ListingStatus;
  seller: { id: string; name: string; company: boolean };
  createdAt: string;
}

const SORTS = {
  newest: ['listing.createdAt', 'DESC'],
  price_asc: ['listing.priceCents', 'ASC'],
  price_desc: ['listing.priceCents', 'DESC'],
} as const;

export class ListingsService {
  private static get listings() {
    return AppDataSource.getRepository(Listing);
  }

  static async create(sellerId: string, input: CreateListingInput): Promise<ListingView> {
    const book = await CatalogService.getById(input.catalogBookId);
    if (book.status !== CatalogBookStatus.ACTIVE) {
      throw new NotFoundError('Catalog book not found', 'CATALOG_BOOK_NOT_FOUND');
    }
    if (input.companyId) await CompaniesService.assertCanSell(sellerId, input.companyId);

    const listing = await this.listings.save(
      this.listings.create({
        sellerId,
        companyId: input.companyId ?? null,
        catalogBookId: book.id,
        priceCents: input.priceCents,
        condition: input.condition,
        quantity: input.quantity,
        shippingFeeCents: input.shippingFeeCents,
        pickupAvailable: input.pickupAvailable,
        pickupNote: input.pickupNote || null,
        description: input.description || null,
      }),
    );
    return (await this.toViews([{ ...listing, catalogBook: book } as Listing]))[0];
  }

  static async search(query: ListingsQuery) {
    const qb = this.listings
      .createQueryBuilder('listing')
      .innerJoinAndSelect('listing.catalogBook', 'book')
      .where('listing.status = :status', { status: ListingStatus.ACTIVE })
      .andWhere('listing.quantity > 0')
      .andWhere('book.status = :bookStatus', { bookStatus: CatalogBookStatus.ACTIVE });

    if (query.search) {
      qb.andWhere('(LOWER(book.title) LIKE LOWER(:search) OR LOWER(book.author) LIKE LOWER(:search))', {
        search: `%${query.search}%`,
      });
    }
    if (query.isbn) qb.andWhere('book.isbn = :isbn', { isbn: normalizeIsbn(query.isbn) ?? '' });
    if (query.condition) qb.andWhere('listing.condition = :condition', { condition: query.condition });
    if (query.minPriceCents !== undefined) qb.andWhere('listing.priceCents >= :min', { min: query.minPriceCents });
    if (query.maxPriceCents !== undefined) qb.andWhere('listing.priceCents <= :max', { max: query.maxPriceCents });

    const [column, direction] = SORTS[query.sort];
    qb.orderBy(column, direction)
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [rows, total] = await qb.getManyAndCount();
    return {
      listings: await this.toViews(rows),
      pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    };
  }

  static async listMine(sellerId: string, page: number, limit: number) {
    const [rows, total] = await this.listings.findAndCount({
      where: [
        { sellerId, status: ListingStatus.ACTIVE },
        { sellerId, status: ListingStatus.PAUSED },
      ],
      relations: { catalogBook: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      listings: await this.toViews(rows),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Anyone can open an active listing; a paused one is visible only to its seller. */
  static async getVisible(id: string, viewerId: string): Promise<ListingView> {
    const listing = await this.listings.findOne({ where: { id }, relations: { catalogBook: true } });
    const hidden = !listing || listing.status === ListingStatus.REMOVED || (listing.status === ListingStatus.PAUSED && listing.sellerId !== viewerId);
    if (hidden) throw new NotFoundError('Listing not found', 'LISTING_NOT_FOUND');
    return (await this.toViews([listing]))[0];
  }

  static async update(sellerId: string, id: string, input: UpdateListingInput): Promise<ListingView> {
    const listing = await this.ownedBy(sellerId, id);
    Object.assign(listing, input);
    await this.listings.save(listing);
    return (await this.toViews([listing]))[0];
  }

  static async remove(sellerId: string, id: string): Promise<void> {
    const listing = await this.ownedBy(sellerId, id);
    listing.status = ListingStatus.REMOVED;
    await this.listings.save(listing);
  }

  /** Every listing whatever its status, for moderation. */
  static async listForAdmin(status: ListingStatus | undefined, page: number, limit: number) {
    const [rows, total] = await this.listings.findAndCount({
      where: status ? { status } : {},
      relations: { catalogBook: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { listings: await this.toViews(rows), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /** An admin takes a listing down, e.g. for abuse. Open orders keep their frozen items. */
  static async adminRemove(adminId: string, id: string, reason?: string): Promise<ListingView> {
    const listing = await this.listings.findOne({ where: { id }, relations: { catalogBook: true } });
    if (!listing) throw new NotFoundError('Listing not found', 'LISTING_NOT_FOUND');

    listing.status = ListingStatus.REMOVED;
    await this.listings.save(listing);
    await AuditService.record({
      actorId: adminId,
      action: 'marketplace.listing.remove',
      targetType: 'listing',
      targetId: id,
      changes: reason ? { reason } : null,
    });
    return (await this.toViews([listing]))[0];
  }

  private static async ownedBy(sellerId: string, id: string): Promise<Listing> {
    const listing = await this.listings.findOne({ where: { id }, relations: { catalogBook: true } });
    if (!listing || listing.status === ListingStatus.REMOVED) {
      throw new NotFoundError('Listing not found', 'LISTING_NOT_FOUND');
    }
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenError('This listing belongs to another seller', 'NOT_LISTING_OWNER');
    }
    return listing;
  }

  private static async toViews(rows: Listing[]): Promise<ListingView[]> {
    const people = await IdentityDirectory.userNames([...new Set(rows.map(row => row.sellerId))]);
    const companies = await IdentityDirectory.companyNames([
      ...new Set(rows.map(row => row.companyId).filter((id): id is string => !!id)),
    ]);

    return rows.map(row => ({
      id: row.id,
      book: {
        id: row.catalogBook.id,
        title: row.catalogBook.title,
        author: row.catalogBook.author,
        isbn: row.catalogBook.isbn,
        publisher: row.catalogBook.publisher,
        publishedYear: row.catalogBook.publishedYear,
        edition: row.catalogBook.edition,
        coverUrl: row.catalogBook.coverUrl,
      },
      priceCents: row.priceCents,
      condition: row.condition,
      quantity: row.quantity,
      shippingFeeCents: row.shippingFeeCents,
      pickupAvailable: row.pickupAvailable,
      pickupNote: row.pickupNote ?? null,
      description: row.description ?? null,
      status: row.status,
      seller: {
        id: row.sellerId,
        name: (row.companyId && companies.get(row.companyId)) || people.get(row.sellerId) || '',
        company: !!row.companyId,
      },
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
