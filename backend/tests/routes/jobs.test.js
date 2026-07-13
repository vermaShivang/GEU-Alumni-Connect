const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const db = require('../../src/db');

jest.mock('../../src/db');

describe('Jobs Routes (/api/jobs)', () => {
  let token;

  beforeEach(() => {
    process.env.JWT_SECRET = 'testsecret';
    token = jwt.sign({ id: 'user-1', email: 'user@geu.ac.in' }, process.env.JWT_SECRET);
    jest.clearAllMocks();
  });

  it('GET /api/jobs should return list of open jobs', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('UPDATE users SET last_seen')) return { rows: [] };
      if (sql.includes('FROM users')) {
        return {
          rows: [{ id: 'user-1', email: 'user@geu.ac.in', is_admin: false, is_super_admin: false }]
        };
      }
      if (sql.includes('FROM jobs')) {
        return {
          rows: [
            {
              id: 'job-1',
              title: 'Software Engineer',
              company: 'Tech Corp',
              job_type: 'full-time',
              is_open: true
            }
          ]
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Software Engineer');
  });

  it('POST /api/jobs should create a new job post', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('UPDATE users SET last_seen')) return { rows: [] };
      if (sql.includes('FROM users')) {
        return {
          rows: [{ id: 'user-1', email: 'user@geu.ac.in', is_admin: false, is_super_admin: false }]
        };
      }
      if (sql.includes('INSERT INTO jobs')) {
        return {
          rows: [
            {
              id: 'job-10',
              title: 'Full Stack Developer',
              company: 'Acme Inc',
              location: 'Dehradun',
              job_type: 'full-time',
              posted_by: 'user-1',
              is_open: true
            }
          ]
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Full Stack Developer',
        company: 'Acme Inc',
        location: 'Dehradun',
        job_type: 'full-time',
        description: 'Building React and Node applications',
        apply_email: 'hr@acme.com'
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Full Stack Developer');
  });

  it('POST /api/jobs should validate required fields', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('UPDATE users SET last_seen')) return { rows: [] };
      if (sql.includes('FROM users')) {
        return {
          rows: [{ id: 'user-1', email: 'user@geu.ac.in', is_admin: false, is_super_admin: false }]
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: '' });

    expect(res.status).toBe(400);
  });
});
