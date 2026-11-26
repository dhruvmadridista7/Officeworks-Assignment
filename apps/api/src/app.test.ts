import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app';

describe('GET /api/health', () => {
  it('returns an ok status', async () => {
    const response = await request(buildApp()).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
