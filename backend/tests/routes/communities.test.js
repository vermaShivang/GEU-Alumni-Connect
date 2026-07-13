const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const db = require('../../src/db');

jest.mock('../../src/db');

describe('Communities Routes (/api/communities)', () => {
  let token;

  beforeEach(() => {
    process.env.JWT_SECRET = 'testsecret';
    token = jwt.sign({ id: 'user-1', email: 'user@geu.ac.in' }, process.env.JWT_SECRET);
    jest.clearAllMocks();
  });

  it('GET /api/communities should list communities with member count', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('UPDATE users SET last_seen')) return { rows: [] };
      if (sql.includes('FROM users')) {
        return {
          rows: [{ id: 'user-1', email: 'user@geu.ac.in', is_admin: false, is_super_admin: false }]
        };
      }
      if (sql.includes('FROM communities')) {
        return {
          rows: [
            {
              id: 'comm-1',
              name: 'Computer Science Alumni',
              description: 'GEU CSE graduates group',
              members_count: 42,
              is_member: true
            }
          ]
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/communities')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Computer Science Alumni');
  });

  it('GET /api/communities/:id/posts should return posts if user is a member', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('UPDATE users SET last_seen')) return { rows: [] };
      if (sql.includes('FROM users')) {
        return {
          rows: [{ id: 'user-1', email: 'user@geu.ac.in', is_admin: false, is_super_admin: false }]
        };
      }
      if (sql.includes('FROM community_members')) {
        return {
          rows: [{ role: 'member', can_chat: true }]
        };
      }
      if (sql.includes('FROM community_posts')) {
        return {
          rows: [
            {
              id: 'post-1',
              community_id: 'comm-1',
              title: 'Alumni Meetup',
              content: 'Join us this Saturday!',
              author_name: 'Jane Doe'
            }
          ]
        };
      }
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/communities/comm-1/posts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Alumni Meetup');
  });

  it('GET /api/communities/:id/posts should forbid non-members', async () => {
    db.query.mockImplementation(async (sql) => {
      if (sql.includes('UPDATE users SET last_seen')) return { rows: [] };
      if (sql.includes('FROM users')) {
        return {
          rows: [{ id: 'user-1', email: 'user@geu.ac.in', is_admin: false, is_super_admin: false }]
        };
      }
      if (sql.includes('FROM community_members')) return { rows: [] };
      return { rows: [] };
    });

    const res = await request(app)
      .get('/api/communities/comm-1/posts')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Join first');
  });
});
