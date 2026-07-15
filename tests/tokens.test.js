const { generateOpaqueToken, hashToken } = require('../src/utils/tokens');

describe('tokens utils', () => {
  it('generateOpaqueToken returns hex of expected length', () => {
    const token = generateOpaqueToken(32);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashToken is deterministic SHA-256 hex', () => {
    const raw = 'abc123';
    const once = hashToken(raw);
    const twice = hashToken(raw);
    expect(once).toBe(twice);
    expect(once).toMatch(/^[0-9a-f]{64}$/);
    expect(once).not.toBe(raw);
  });

  it('different tokens produce different hashes', () => {
    expect(hashToken(generateOpaqueToken())).not.toBe(hashToken(generateOpaqueToken()));
  });
});
