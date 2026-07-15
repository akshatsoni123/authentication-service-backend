const { hashPassword, verifyPassword } = require('../src/utils/password');

describe('password utils', () => {
  it('hashPassword returns a bcrypt hash, not plaintext', async () => {
    const plain = 'Str0ng-Pass1';
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash).toMatch(/^\$2[aby]?\$/);
  });

  it('verifyPassword accepts correct password and rejects wrong one', async () => {
    const hash = await hashPassword('Str0ng-Pass1');
    expect(await verifyPassword('Str0ng-Pass1', hash)).toBe(true);
    expect(await verifyPassword('wrong-pass', hash)).toBe(false);
  });
});
