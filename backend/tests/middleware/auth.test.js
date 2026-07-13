const jwt = require('jsonwebtoken');
const authMiddleware = require('../../src/middleware/auth');
const db = require('../../src/db');

jest.mock('../../src/db');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    process.env.JWT_SECRET = 'testsecret';
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  it('should return 401 if no Authorization header provided', async () => {
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
  });

  it('should return 401 if token is invalid', async () => {
    req.headers['authorization'] = 'Bearer invalid.jwt.token';
    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
  });

  it('should return 401 if user no longer exists in DB', async () => {
    const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
    req.headers['authorization'] = `Bearer ${token}`;
    db.query.mockResolvedValueOnce({ rows: [] });

    await authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'User no longer exists' });
  });

  it('should populate req.user and call next() on valid token', async () => {
    const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
    req.headers['authorization'] = `Bearer ${token}`;
    db.query.mockResolvedValue({
      rows: [{ id: 'user-1', email: 'user@example.com', is_admin: true, is_super_admin: false }]
    });

    await authMiddleware(req, res, next);
    expect(req.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      is_admin: true,
      is_super_admin: false
    });
    expect(next).toHaveBeenCalled();
  });
});
