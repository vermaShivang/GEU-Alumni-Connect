const requireAdmin = require('../../src/middleware/admin');
const db = require('../../src/db');

jest.mock('../../src/db');

describe('Admin Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  it('should return 401 if req.user is unauthenticated', async () => {
    req = {};
    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 403 if user is not an admin in DB', async () => {
    req = { user: { id: 'user-2' } };
    db.query.mockResolvedValueOnce({ rows: [{ is_admin: false, is_super_admin: false }] });

    await requireAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
  });

  it('should call next() and update req.user flags if user is admin', async () => {
    req = { user: { id: 'admin-1' } };
    db.query.mockResolvedValueOnce({ rows: [{ is_admin: true, is_super_admin: false }] });

    await requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user.is_admin).toBe(true);
    expect(req.user.is_super_admin).toBe(false);
  });
});
