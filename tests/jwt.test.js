const jwt = require('jsonwebtoken');
const { signAccessToken, verifyAccessToken } = require('../src/utils/jwt');
const { config } = require('../src/config');

describe('jwt utils', () => {
  it('signAccessToken includes sub, roles, jti and verifyAccessToken accepts it', () => {
    const { token, jti, expiresIn } = signAccessToken({
      userId: '11111111-1111-1111-1111-111111111111',
      roles: ['user'],
    });

    expect(expiresIn).toBe(config.jwt.accessExpiresIn);
    expect(jti).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('11111111-1111-1111-1111-111111111111');
    expect(payload.roles).toEqual(['user']);
    expect(payload.jti).toBe(jti);
  });

  it('verifyAccessToken rejects forged signatures', () => {
    const forged = jwt.sign(
      { sub: 'x', roles: ['admin'], jti: 'y' },
      'wrong-secret-that-is-long-enough-32chars',
      { expiresIn: 60 },
    );
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('verifyAccessToken rejects expired tokens', () => {
    const expired = jwt.sign(
      { sub: 'x', roles: ['user'], jti: 'z' },
      config.jwt.accessSecret,
      { expiresIn: -1 },
    );
    expect(() => verifyAccessToken(expired)).toThrow(/expired/i);
  });
});
