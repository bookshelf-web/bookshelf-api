import { AppDataSource } from '../../config/database';
import { AuditLog } from './models/AuditLog';

export interface AuditEntry {
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  changes?: Record<string, unknown> | null;
}

export interface AuditQuery {
  page: number;
  limit: number;
  targetType?: string;
  targetId?: string;
  actorId?: string;
}

export class AuditService {
  private static get repository() {
    return AppDataSource.getRepository(AuditLog);
  }

  static async record(entry: AuditEntry): Promise<AuditLog> {
    return this.repository.save(this.repository.create({ ...entry, changes: entry.changes ?? null }));
  }

  static async list({ page, limit, targetType, targetId, actorId }: AuditQuery) {
    const where: Record<string, string> = {};
    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;
    if (actorId) where.actorId = actorId;

    const [entries, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { entries, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}

/** Builds a `{ field: { from, to } }` map with only the fields that actually changed. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after) as (keyof T)[]) {
    const from = before[key];
    const to = after[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      changes[String(key)] = { from, to };
    }
  }
  return changes;
}
