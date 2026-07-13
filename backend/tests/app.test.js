const request = require('supertest');
const app = require('../src/app');

describe('App setup and root middleware', () => {
  it('GET /api/health should return ok status and email_mode', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('email_mode');
  });

  it('GET /api/nonexistent-route should return 404 Route not found', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Route not found' });
  });

  it('should include CORS headers', async () => {
    const origin = process.env.FRONTEND_URL || 'http://localhost:5173';
    const res = await request(app)
      .get('/api/health')
      .set('Origin', origin);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
  });
});
