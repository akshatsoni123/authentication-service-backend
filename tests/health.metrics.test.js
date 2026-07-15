const request = require('supertest');
const { createApp } = require('../src/app');
const {
  observeLoginSuccess,
  observeLoginFailure,
  register,
} = require('../src/metrics');

describe('health & metrics', () => {
  it('GET /health/live returns 200 without checking dependencies', async () => {
    const app = createApp();
    const res = await request(app).get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('GET /metrics exposes Prometheus login counters', async () => {
    observeLoginSuccess();
    observeLoginFailure('invalid_credentials');

    const app = createApp();
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toMatch(/auth_login_attempts_total/);
    expect(res.text).toMatch(/result="success"/);
    expect(res.text).toMatch(/result="failure"/);
    expect(res.text).toMatch(/process_cpu/);
  });

  it('metrics registry is a prometheus Registry', () => {
    expect(typeof register.metrics).toBe('function');
  });
});
