import { Request } from 'express';

export interface AuthRequest extends Request {
  userId?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
}

export enum BookStatus {
  TO_READ = 'to_read',
  READING = 'reading',
  READ = 'read'
}

export interface CreateBookDTO {
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publishedYear?: number;
  pages?: number;
  language?: string;
  coverUrl?: string;
  description?: string;
}

export interface UpdateBookDTO {
  title?: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  publishedYear?: number;
  pages?: number;
  language?: string;
  coverUrl?: string;
  description?: string;
  status?: BookStatus;
  rating?: number;
  notes?: string;
}

export interface BookFilters {
  status?: BookStatus;
  rating?: number;
  author?: string;
  title?: string;
  publishedYear?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}