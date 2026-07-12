/**
 * Initial auth schema: users, RBAC, email/password tokens, audit_logs.
 *
 * Refresh tokens: intentionally NOT stored here — active sessions live in Redis
 * (see docs/HLD.md and docs/DATABASE.md). Add a refresh_tokens table later
 * only if you need long-term audit of session history in Postgres.
 *
 * @param {import('knex').Knex} knex
 */
exports.up = async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 320).notNullable();
    table.string('password_hash', 255).notNullable();
    table.boolean('is_email_verified').notNullable().defaultTo(false);
    table
      .enum('status', ['active', 'disabled', 'locked'], {
        useNative: true,
        enumName: 'user_status',
      })
      .notNullable()
      .defaultTo('active');
    table.timestamps(true, true);

    table.unique(['email'], { indexName: 'users_email_unique' });
  });

  // Case-insensitive uniqueness helper: normalize email in app layer to lower-case.
  // Extra btree index supports login lookups (unique already indexes email).
  await knex.raw(`
    CREATE INDEX users_email_lower_idx ON users (lower(email));
  `);

  await knex.schema.createTable('roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 64).notNullable();
    table.string('description', 255);
    table.timestamps(true, true);

    table.unique(['name'], { indexName: 'roles_name_unique' });
  });

  await knex.schema.createTable('permissions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('key', 128).notNullable(); // e.g. users:read
    table.string('description', 255);
    table.timestamps(true, true);

    table.unique(['key'], { indexName: 'permissions_key_unique' });
  });

  await knex.schema.createTable('user_roles', (table) => {
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('role_id')
      .notNullable()
      .references('id')
      .inTable('roles')
      .onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.primary(['user_id', 'role_id']);
    table.index(['role_id'], 'user_roles_role_id_idx');
  });

  await knex.schema.createTable('role_permissions', (table) => {
    table
      .uuid('role_id')
      .notNullable()
      .references('id')
      .inTable('roles')
      .onDelete('CASCADE');
    table
      .uuid('permission_id')
      .notNullable()
      .references('id')
      .inTable('permissions')
      .onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.primary(['role_id', 'permission_id']);
    table.index(['permission_id'], 'role_permissions_permission_id_idx');
  });

  await knex.schema.createTable('email_verification_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('token_hash', 128).notNullable();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('used_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['token_hash'], { indexName: 'email_verification_tokens_token_hash_unique' });
    table.index(['user_id'], 'email_verification_tokens_user_id_idx');
    table.index(['expires_at'], 'email_verification_tokens_expires_at_idx');
  });

  await knex.schema.createTable('password_reset_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('token_hash', 128).notNullable();
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('used_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique(['token_hash'], { indexName: 'password_reset_tokens_token_hash_unique' });
    table.index(['user_id'], 'password_reset_tokens_user_id_idx');
    table.index(['expires_at'], 'password_reset_tokens_expires_at_idx');
  });

  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.string('event', 64).notNullable(); // e.g. login_success, password_reset
    table.string('ip', 64);
    table.string('user_agent', 512);
    table.jsonb('meta').nullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['user_id'], 'audit_logs_user_id_idx');
    table.index(['event'], 'audit_logs_event_idx');
    table.index(['created_at'], 'audit_logs_created_at_idx');
  });
};

/**
 * @param {import('knex').Knex} knex
 */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('password_reset_tokens');
  await knex.schema.dropTableIfExists('email_verification_tokens');
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('user_roles');
  await knex.schema.dropTableIfExists('permissions');
  await knex.schema.dropTableIfExists('roles');
  await knex.schema.dropTableIfExists('users');
  await knex.raw('DROP TYPE IF EXISTS user_status');
};
