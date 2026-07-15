const request = require('supertest');
const { getTestApp } = require('./helpers/app');
const {
  uniqueEmail,
  truncateAuthTables,
  flushTestRedis,
} = require('./helpers/db');
const {
  installEmailCapture,
  getCapturedVerifyToken,
  getCapturedResetToken,
} = require('./helpers/email');
const { setUserRoles } = require('../src/modules/roles/roles.service');

const PASSWORD = 'Str0ng1Pass';
const NEW_PASSWORD = 'N3wStr0ngPass';

describe('Auth API (integration)', () => {
  /** @type {import('express').Express} */
  let app;

  beforeAll(async () => {
    app = await getTestApp();
  });

  beforeEach(async () => {
    installEmailCapture();
    await truncateAuthTables();
    await flushTestRedis();
  });

  describe('validation 400', () => {
    it('rejects weak register password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: uniqueEmail('weak'), password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid login email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('happy path register → verify → login → me', () => {
    it('completes the core auth loop', async () => {
      const email = uniqueEmail('happy');

      const reg = await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: PASSWORD });

      expect(reg.status).toBe(201);
      expect(reg.body.data.user.email).toBe(email);
      expect(reg.body.data.user.roles).toContain('user');

      const verifyToken = getCapturedVerifyToken();
      const verified = await request(app)
        .post('/api/v1/auth/verify-email')
        .send({ token: verifyToken });

      expect(verified.status).toBe(200);

      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD });

      expect(login.status).toBe(200);
      expect(login.body.data.accessToken).toBeTruthy();
      expect(login.body.data.user.isEmailVerified).toBe(true);

      const me = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`);

      expect(me.status).toBe(200);
      expect(me.body.data.user.email).toBe(email);
    });
  });

  describe('login abuse paths', () => {
    it('rejects invalid password with opaque 401', async () => {
      const email = uniqueEmail('badpass');
      await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPass999' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toMatch(/invalid email or password/i);
    });

    it('returns 429 after login burst (rate limit)', async () => {
      const email = uniqueEmail('ratelimit');
      await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD });

      let lastStatus = 0;
      for (let i = 0; i < 6; i += 1) {
        const res = await request(app)
          .post('/api/v1/auth/login')
          .send({ email, password: 'WrongPass999' });
        lastStatus = res.status;
      }

      expect(lastStatus).toBe(429);
    });
  });

  describe('refresh rotation + reuse rejection', () => {
    it('rotates refresh and rejects reuse of the old cookie', async () => {
      const email = uniqueEmail('refresh');
      await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD });

      const agent = request.agent(app);
      const login = await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD });
      expect(login.status).toBe(200);

      const firstRefresh = await agent.post('/api/v1/auth/refresh');
      expect(firstRefresh.status).toBe(200);
      expect(firstRefresh.body.data.accessToken).toBeTruthy();

      // Steal the OLD refresh cookie value from the login Set-Cookie (before rotation).
      // After agent rotated, capture current cookie, then replay an outdated one via raw request.
      const cookies = login.headers['set-cookie'] || [];
      const refreshCookie = cookies.find((c) => c.startsWith('refresh_token='));
      expect(refreshCookie).toBeTruthy();

      const reuse = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookie.split(';')[0]);

      expect(reuse.status).toBe(401);
      expect(reuse.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('logout then refresh fails', () => {
    it('cannot refresh after logout', async () => {
      const email = uniqueEmail('logout');
      await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD });

      const agent = request.agent(app);
      const login = await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD });
      const accessToken = login.body.data.accessToken;

      const logout = await agent
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(logout.status).toBe(200);

      const refresh = await agent.post('/api/v1/auth/refresh');
      expect(refresh.status).toBe(401);
    });
  });

  describe('forgot / reset password', () => {
    it('resets password, kills old sessions, and accepts the new password', async () => {
      const email = uniqueEmail('reset');
      await request(app).post('/api/v1/auth/register').send({ email, password: PASSWORD });

      const agent = request.agent(app);
      await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD });

      const forgot = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email });
      expect(forgot.status).toBe(200);
      expect(forgot.body.data.message).toMatch(/if an account exists/i);

      // Anti-enumeration: unknown email looks identical
      const unknown = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: uniqueEmail('nobody') });
      expect(unknown.status).toBe(200);
      expect(unknown.body.data.message).toBe(forgot.body.data.message);

      const resetToken = getCapturedResetToken();
      const reset = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: resetToken, newPassword: NEW_PASSWORD });
      expect(reset.status).toBe(200);

      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD });
      expect(oldLogin.status).toBe(401);

      const staleRefresh = await agent.post('/api/v1/auth/refresh');
      expect(staleRefresh.status).toBe(401);

      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: NEW_PASSWORD });
      expect(newLogin.status).toBe(200);
    });
  });

  describe('RBAC admin allow / user deny', () => {
    it('denies normal users and allows admins on GET /admin/users', async () => {
      const email = uniqueEmail('rbac');
      const reg = await request(app)
        .post('/api/v1/auth/register')
        .send({ email, password: PASSWORD });
      const userId = reg.body.data.user.id;

      const userLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD });

      const denied = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userLogin.body.data.accessToken}`);
      expect(denied.status).toBe(403);
      expect(denied.body.error.code).toBe('FORBIDDEN');

      await setUserRoles(userId, ['user', 'admin']);

      // Roles are stamped into JWT at login — must re-login after promotion
      const adminLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD });

      const allowed = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminLogin.body.data.accessToken}`);
      expect(allowed.status).toBe(200);
      expect(allowed.body.success).toBe(true);
    });
  });
});
