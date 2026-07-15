const { rateLimit } = require('../src/middleware/rateLimit');
const { AppError } = require('../src/utils/AppError');

/**
 * Run middleware; resolve with { err, retryAfter }.
 */
function run(mw, req = { ip: '127.0.0.1', body: {} }) {
  const headers = {};
  const res = {
    setHeader(name, value) {
      headers[name] = value;
    },
  };

  return new Promise((resolve) => {
    mw(req, res, (err) => {
      resolve({ err: err || null, retryAfter: headers['Retry-After'] });
    });
  });
}

describe('rateLimit middleware (fixed window)', () => {
  it('allows requests under the max, then returns 429 on burst', async () => {
    const max = 5;
    let counter = 0;

    const mw = rateLimit({
      max,
      windowSeconds: 900,
      name: 'test-burst',
      keyFn: () => 'rl:test:burst',
      redis: {
        async incr() {
          counter += 1;
          return counter;
        },
        async ttl() {
          return 600;
        },
      },
    });

    for (let i = 0; i < max; i += 1) {
      const { err } = await run(mw);
      expect(err).toBeNull();
    }

    const { err, retryAfter } = await run(mw);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
    expect(retryAfter).toBe('600');
  });

  it('returns 503 when Redis incr fails (fail-closed)', async () => {
    const mw = rateLimit({
      max: 5,
      windowSeconds: 900,
      name: 'test-fail-closed',
      keyFn: () => 'rl:test:fail',
      redis: {
        async incr() {
          throw new Error('redis down');
        },
        async ttl() {
          return -2;
        },
      },
    });

    const { err } = await run(mw);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('uses windowSeconds for Retry-After when TTL is missing', async () => {
    const mw = rateLimit({
      max: 1,
      windowSeconds: 120,
      name: 'test-retry-fallback',
      keyFn: () => 'rl:test:retry',
      redis: {
        async incr() {
          return 2;
        },
        async ttl() {
          return -1;
        },
      },
    });

    const { err, retryAfter } = await run(mw);
    expect(err.statusCode).toBe(429);
    expect(retryAfter).toBe('120');
  });
});
