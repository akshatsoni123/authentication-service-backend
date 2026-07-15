const { authorize } = require('../src/middleware/authorize');

/**
 * Run Express-style middleware and resolve with the error passed to next(),
 * or null if next() was called without an error.
 */
function runMiddleware(mw, req) {
  return new Promise((resolve) => {
    mw(req, {}, (err) => resolve(err || null));
  });
}

describe('authorize middleware', () => {
  it('returns 401 when req.user is missing', async () => {
    const err = await runMiddleware(authorize('admin'), {});
    expect(err).toBeTruthy();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when user lacks required role (deny)', async () => {
    const err = await runMiddleware(authorize('admin'), {
      user: { id: 'u1', roles: ['user'] },
    });
    expect(err).toBeTruthy();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('allows when user has required role (allow)', async () => {
    const err = await runMiddleware(authorize('admin'), {
      user: { id: 'u1', roles: ['user', 'admin'] },
    });
    expect(err).toBeNull();
  });

  it('allows if any listed role matches', async () => {
    const err = await runMiddleware(authorize('admin', 'moderator'), {
      user: { id: 'u1', roles: ['moderator'] },
    });
    expect(err).toBeNull();
  });
});
