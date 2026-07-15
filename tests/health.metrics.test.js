const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const http = require('http');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { createApp } = require('../src/app');
const {
  observeLoginSuccess,
  observeLoginFailure,
  register,
} = require('../src/metrics');

/**
 * @param {import('http').Server} server
 * @param {string} urlPath
 */
function request(server, urlPath) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    http
      .get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      })
      .on('error', reject);
  });
}

describe('health & metrics', () => {
  it('GET /health/live returns 200 without checking dependencies', async () => {
    const app = createApp();
    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });

    try {
      const res = await request(server, '/health/live');
      assert.equal(res.statusCode, 200);
      const json = JSON.parse(res.body);
      assert.equal(json.success, true);
      assert.equal(json.data.status, 'ok');
      assert.ok(res.headers['x-request-id']);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /metrics exposes Prometheus login counters', async () => {
    observeLoginSuccess();
    observeLoginFailure('invalid_credentials');

    const app = createApp();
    const server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });

    try {
      const res = await request(server, '/metrics');
      assert.equal(res.statusCode, 200);
      assert.match(res.headers['content-type'] || '', /text\/plain/);
      assert.match(res.body, /auth_login_attempts_total/);
      assert.match(res.body, /result="success"/);
      assert.match(res.body, /result="failure"/);
      // Default process metrics from prom-client
      assert.match(res.body, /process_cpu/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('metrics registry is a prometheus Registry', () => {
    assert.equal(typeof register.metrics, 'function');
  });
});
