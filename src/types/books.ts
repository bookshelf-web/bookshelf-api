export enum BookStatus {
  TO_READ = 'to_read',
  READING = 'reading',
  READ = 'read',
}

export interface CreateBookDTO {
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publishedYear?: number;
  pages?: number;
  language?: string;
  description?: string;
  rating?: number;
  notes?: string;
  coverUrl?: string;
}

export interface UpdateBookDTO {
  title?: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  publishedYear?: number;
  pages?: number;
  language?: string;
  description?: string;
  status?: BookStatus;
  rating?: number;
  notes?: string;
  coverUrl?: string;
}

export interface UpdateBookStatusDTO {
  status: BookStatus;
}