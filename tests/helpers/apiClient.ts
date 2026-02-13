import request from 'supertest';
import app from '../../src/app';

export class ApiClient {
  private baseURL = '/api';
  private token: string | null = null;

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  // Auth endpoints
  async register(data: any) {
    return request(app)
      .post(`${this.baseURL}/auth/register`)
      .send(data);
  }

  async login(data: any) {
    return request(app)
      .post(`${this.baseURL}/auth/login`)
      .send(data);
  }

  // Books endpoints
  async createBook(data: any) {
    const req = request(app).post(`${this.baseURL}/books`).send(data);
    return this.token ? req.set('Authorization', `Bearer ${this.token}`) : req;
  }

  async getBooks(query?: any) {
    const req = request(app).get(`${this.baseURL}/books`);
    if (query) req.query(query);
    return this.token ? req.set('Authorization', `Bearer ${this.token}`) : req;
  }

  async getBookById(id: string) {
    const req = request(app).get(`${this.baseURL}/books/${id}`);
    return this.token ? req.set('Authorization', `Bearer ${this.token}`) : req;
  }

  async updateBook(id: string, data: any) {
    const req = request(app).put(`${this.baseURL}/books/${id}`).send(data);
    return this.token ? req.set('Authorization', `Bearer ${this.token}`) : req;
  }

  async updateBookStatus(id: string, status: string) {
    const req = request(app)
      .patch(`${this.baseURL}/books/${id}/status`)
      .send({ status });
    return this.token ? req.set('Authorization', `Bearer ${this.token}`) : req;
  }

  async deleteBook(id: string) {
    const req = request(app).delete(`${this.baseURL}/books/${id}`);
    return this.token ? req.set('Authorization', `Bearer ${this.token}`) : req;
  }

  // Stats endpoints
  async getStats() {
    const req = request(app).get(`${this.baseURL}/stats`);
    return this.token ? req.set('Authorization', `Bearer ${this.token}`) : req;
  }

  // Health check
  async healthCheck() {
    return request(app).get('/health');
  }
}