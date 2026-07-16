const { loadEnv } = require('./env');

const env = loadEnv();

const config = Object.freeze({
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  isDev: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,

  database: {
    url: env.DATABASE_URL,
    pool: {
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: env.DB_POOL_IDLE_MS,
      connectionTimeoutMillis: env.DB_POOL_CONN_TIMEOUT_MS,
    },
  },

  redis: {
    url: env.REDIS_URL,
  },

  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },

  cors: {
    // Comma-separated list in .env → array for cors middleware
    origins: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  },

  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM,
  },

  appUrl: env.APP_URL,

  /** When true, Express trusts one reverse-proxy hop (X-Forwarded-For / Proto). */
  trustProxy: env.TRUST_PROXY,

  bcrypt: {
    saltRounds: env.BCRYPT_SALT_ROUNDS,
  },

  rateLimit: {
    login: { max: env.RL_LOGIN_MAX, windowSeconds: env.RL_LOGIN_WINDOW_SEC },
    forgot: { max: env.RL_FORGOT_MAX, windowSeconds: env.RL_FORGOT_WINDOW_SEC },
    register: {
      max: env.RL_REGISTER_MAX,
      windowSeconds: env.RL_REGISTER_WINDOW_SEC,
    },
    resend: { max: env.RL_RESEND_MAX, windowSeconds: env.RL_RESEND_WINDOW_SEC },
  },
});

module.exports = { config };
