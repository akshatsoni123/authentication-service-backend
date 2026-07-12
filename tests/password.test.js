const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { hashPassword, verifyPassword } = require('../src/utils/password');

test('hashPassword returns a bcrypt hash, not plaintext', async () => {
  const plain = 'Str0ng-Pass1';
  const hash = await hashPassword(plain);
  assert.notEqual(hash, plain);
  assert.match(hash, /^\$2[aby]?\$/);
});

test('verifyPassword accepts correct password and rejects wrong one', async () => {
  const hash = await hashPassword('Str0ng-Pass1');
  assert.equal(await verifyPassword('Str0ng-Pass1', hash), true);
  assert.equal(await verifyPassword('wrong-pass', hash), false);
});
