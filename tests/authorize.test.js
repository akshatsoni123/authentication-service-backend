const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
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
    assert.ok(err);
    assert.equal(err.statusCode, 401);
    assert.equal(err.code, 'UNAUTHORIZED');
  });

  it('returns 403 when user lacks required role (deny)', async () => {
    const err = await runMiddleware(authorize('admin'), {
      user: { id: 'u1', roles: ['user'] },
    });
    assert.ok(err);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, 'FORBIDDEN');
  });

  it('allows when user has required role (allow)', async () => {
    const err = await runMiddleware(authorize('admin'), {
      user: { id: 'u1', roles: ['user', 'admin'] },
    });
    assert.equal(err, null);
  });

  it('allows if any listed role matches', async () => {
    const err = await runMiddleware(authorize('admin', 'moderator'), {
      user: { id: 'u1', roles: ['moderator'] },
    });
    assert.equal(err, null);
  });
});
