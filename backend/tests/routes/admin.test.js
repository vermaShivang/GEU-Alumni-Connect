const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const db = require('../../src/db');

jest.mock('../../src/db');

describe('Admin Routes (/api/admin)', () => {
  let adminToken;

  beforeEach(() => {
    process.env.JWT_SECRET = 'testsecret';
    adminToken = jwt.sign({ id: 'admin-1', email: 'admin@geu.ac.in' }, process.env.JWT_SECRET);
    jest.clearAllMocks();
  });

  it('should deny non-admin users with 403', async () => {
    const userToken = jwt.sign({ id: 'user-1', email: 'user@geu.ac.in' }, process.env.JWT_SECRET);
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('UPDATE users SET last_seen')) return { rows: [] };
      return {
        rows: [{ id: 'user-1', email: 'user@geu.ac.in', is_admin: false, is_super_admin: false }]
      };
    });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/admin/stats should return summary statistics for admin', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('UPDATE users SET last_seen')) return { rows: [] };
      if (sql.includes('WHERE id = $1')) {
        return {
          rows: [{ id: 'admin-1', email: 'admin@geu.ac.in', is_admin: true, is_super_admin: true }]
        };
      }
      if (sql.includes('FROM users')) return { rows: [{ c: 15 }] };
      if (sql.includes('pending_registrations')) return { rows: [{ c: 3 }] };
      if (sql.includes('FROM posts')) return { rows: [{ c: 20 }] };
      if (sql.includes('FROM jobs')) return { rows: [{ c: 5 }] };
      if (sql.includes('FROM communities')) return { rows: [{ c: 4 }] };
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total_users: 15,
      pending_signups: 3,
      total_posts: 20,
      open_jobs: 5,
      total_communities: 4
    });
  });

  it('GET /api/admin/pending should return pending signups', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('UPDATE users SET last_seen')) return { rows: [] };
      if (sql.includes('WHERE id = $1')) {
        return {
          rows: [{ id: 'admin-1', email: 'admin@geu.ac.in', is_admin: true, is_super_admin: true }]
        };
      }
      if (sql.includes('pending_registrations')) {
        return {
          rows: [
            { id: 'pending-1', full_name: 'Pending User', email: 'pending@example.com', status: 'pending' }
          ]
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/admin/pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].full_name).toBe('Pending User');
  });

  it('GET /api/admin/analytics should return platform analytics summary and distributions', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('UPDATE users SET last_seen')) return { rows: [] };
      if (sql.includes('WHERE id = $1')) {
        return {
          rows: [{ id: 'admin-1', email: 'admin@geu.ac.in', is_admin: true, is_super_admin: true }]
        };
      }
      if (sql.includes('GROUP BY graduation_year')) return { rows: [{ year: 2024, count: 6 }] };
      if (sql.includes('GROUP BY course')) return { rows: [{ course: 'B.Tech CSE', count: 10 }] };
      if (sql.includes('GROUP BY job_type')) return { rows: [{ job_type: 'full-time', count: 4 }] };
      if (sql.includes('GROUP BY status')) return { rows: [{ status: 'pending', count: 3 }, { status: 'approved', count: 12 }] };
      return { rows: [{ c: 5 }] };
    });

    const res = await request(app)
      .get('/api/admin/analytics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.graduation_years).toBeDefined();
    expect(res.body.top_courses).toBeDefined();
    expect(res.body.job_types).toBeDefined();
  });

  it('GET /api/admin/health-report should return system health diagnostics and user activity audit log', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('UPDATE users SET last_seen')) return { rows: [] };
      if (sql.includes('WHERE id = $1')) {
        return {
          rows: [{ id: 'admin-1', email: 'admin@geu.ac.in', is_admin: true, is_super_admin: true }]
        };
      }
      if (sql.includes('SELECT 1')) return { rows: [{ '?column?': 1 }] };
      if (sql.includes('SELECT u.id, u.email')) {
        return {
          rows: [
            {
              id: 'u-101', email: 'aarav@geu.ac.in', username: 'aarav',
              full_name: 'Aarav Sharma', course: 'B.Tech CSE', graduation_year: 2024,
              is_admin: false, is_super_admin: false, last_seen: new Date().toISOString(), created_at: new Date().toISOString()
            }
          ]
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/admin/health-report')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.system_health.status).toBe('HEALTHY');
    expect(res.body.api_endpoints_status).toHaveLength(7);
    expect(res.body.user_activity_log[0].username).toBe('aarav');
  });
});
