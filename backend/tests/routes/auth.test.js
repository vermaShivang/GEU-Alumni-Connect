const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const db = require('../../src/db');

jest.mock('../../src/db');

describe('Auth Routes (/api/auth)', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'testsecret';
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 when identifier or password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: '' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Username/email and password are required');
    });

    it('should return 401 when user is not found', async () => {
      db.query.mockResolvedValue({ rows: [] });
      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'unknown@example.com', password: 'secretpassword' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should return 401 when password does not match', async () => {
      const hashed = await bcrypt.hash('correctpassword', 4);
      db.query.mockImplementation(async (sql) => {
        if (sql.includes('SELECT')) {
          return {
            rows: [{
              id: 'user-1',
              email: 'test@example.com',
              username: 'testuser',
              password_hash: hashed,
              is_admin: false,
              is_super_admin: false,
              must_change_password: false
            }]
          };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'testuser', password: 'wrongpassword' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should return 200 and token when login succeeds', async () => {
      const hashed = await bcrypt.hash('correctpassword', 4);
      db.query.mockImplementation(async (sql) => {
        if (sql.includes('SELECT')) {
          return {
            rows: [{
              id: 'user-1',
              email: 'test@example.com',
              username: 'testuser',
              password_hash: hashed,
              is_admin: true,
              is_super_admin: false,
              must_change_password: true
            }]
          };
        }
        return { rows: [] };
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'testuser', password: 'correctpassword' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        is_admin: true,
        is_super_admin: false,
        must_change_password: true
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user when token is valid', async () => {
      const token = jwt.sign({ id: 'user-10', email: 'me@example.com' }, process.env.JWT_SECRET);
      db.query.mockImplementation(async (sql) => {
        if (sql.includes('UPDATE users SET last_seen')) return { rows: [] };
        return {
          rows: [{
            id: 'user-10',
            email: 'me@example.com',
            username: 'me.user',
            is_admin: false,
            is_super_admin: false,
            must_change_password: false
          }]
        };
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.username).toBe('me.user');
    });
  });
});
