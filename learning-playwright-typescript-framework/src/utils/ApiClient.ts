import { APIRequestContext } from '@playwright/test';

export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseURL: string
  ) {}

  async get(path: string, params?: Record<string, string | number>) {
    return this.request.get(this.buildURL(path, params));
  }

  async post(path: string, data: unknown) {
    return this.request.post(this.buildURL(path), { data });
  }

  async put(path: string, data: unknown) {
    return this.request.put(this.buildURL(path), { data });
  }

  async patch(path: string, data: unknown) {
    return this.request.patch(this.buildURL(path), { data });
  }

  async delete(path: string) {
    return this.request.delete(this.buildURL(path));
  }

  private buildURL(
    path: string,
    params?: Record<string, string | number>
  ): string {
    const url = `${this.baseURL}${path}`;
    if (!params) return url;
    const query = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');
    return `${url}?${query}`;
  }
}
