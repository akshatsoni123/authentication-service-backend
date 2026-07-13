const crypto = require('crypto');
const { set, get, del, keys, getRedis } = require('../redis');
const { hashToken, generateOpaqueToken } = require('../utils/tokens');
const { config } = require('../config');

/** Refresh cookie lifetime in seconds (default 7 days). */
const refreshTtlSeconds = () => config.jwt.refreshExpiresIn;

/**
 * How long we remember a rotated (used) refresh hash for reuse detection.
 * Long enough to catch an attacker replaying the old cookie after rotation.
 */
const REUSE_TOMBSTONE_TTL_SECONDS = 60 * 60 * 24 * 7; // match refresh life

/**
 * Create a new refresh session in Redis (login or after rotate).
 * Cookie gets rawRefresh; Redis stores only the hash + metadata.
 */
async function createRefreshSession({ userId, familyId, ip, userAgent }) {
  const tokenId = crypto.randomUUID();
  const rawRefresh = generateOpaqueToken();
  const tokenHash = hashToken(rawRefresh);
  const ttl = refreshTtlSeconds();

  const meta = {
    userId,
    tokenId,
    familyId,
    tokenHash,
    ip: ip || null,
    userAgent: userAgent || null,
    createdAt: new Date().toISOString(),
  };

  // Primary session record: auth:refresh:{userId}:{tokenId}
  await set(keys.refresh(userId, tokenId), meta, ttl);
  // Lookup by cookie hash → find the session quickly
  await set(keys.refreshByHash(tokenHash), { userId, tokenId, familyId }, ttl);

  return { rawRefresh, tokenId, familyId, ttl, tokenHash };
}

/**
 * Resolve an active session from the raw cookie value.
 * Returns null if missing/expired.
 */
async function findRefreshSession(rawRefresh) {
  const tokenHash = hashToken(rawRefresh);
  const pointer = await get(keys.refreshByHash(tokenHash));
  if (!pointer) return null;

  const meta = await get(keys.refresh(pointer.userId, pointer.tokenId));
  if (!meta) return null;

  return { ...meta, tokenHash };
}

/**
 * Check if this refresh hash was already rotated (reuse / theft signal).
 */
async function findRefreshReuseTombstone(rawRefresh) {
  const tokenHash = hashToken(rawRefresh);
  return get(keys.refreshUsed(tokenHash));
}

/**
 * Delete one active session (after rotate or logout).
 * Also writes a tombstone so a later replay can trigger family revoke.
 */
async function destroyRefreshSession({ userId, tokenId, tokenHash, familyId, writeTombstone = false }) {
  await del(keys.refresh(userId, tokenId));
  if (tokenHash) {
    await del(keys.refreshByHash(tokenHash));
    if (writeTombstone && familyId) {
      await set(
        keys.refreshUsed(tokenHash),
        { userId, familyId },
        REUSE_TOMBSTONE_TTL_SECONDS,
      );
    }
  }
}

/**
 * Reuse detection: wipe ALL refresh sessions in this family for the user.
 */
async function revokeFamily(userId, familyId) {
  const redis = getRedis();
  const pattern = `auth:refresh:${userId}:*`;
  let cursor = '0';

  do {
    // SCAN is safer than KEYS in production (non-blocking)
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;

    for (const key of batch) {
      const meta = await get(key);
      if (meta && meta.familyId === familyId) {
        await del(key);
        if (meta.tokenHash) {
          await del(keys.refreshByHash(meta.tokenHash));
          await del(keys.refreshUsed(meta.tokenHash));
        }
      }
    }
  } while (cursor !== '0');
}

/** Denylist access JWT jti until it would have expired naturally. */
async function denyAccessJti(jti, ttlSeconds) {
  if (!jti || !ttlSeconds || ttlSeconds <= 0) return;
  await set(keys.denyJti(jti), { deniedAt: Date.now() }, ttlSeconds);
}

async function isAccessJtiDenied(jti) {
  if (!jti) return false;
  return (await get(keys.denyJti(jti))) !== null;
}

/** logout-all: delete every refresh session for this user. */
async function revokeAllUserSessions(userId) {
  const redis = getRedis();
  const pattern = `auth:refresh:${userId}:*`;
  let cursor = '0';

  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;

    for (const key of batch) {
      const meta = await get(key);
      await del(key);
      if (meta?.tokenHash) {
        await del(keys.refreshByHash(meta.tokenHash));
        await del(keys.refreshUsed(meta.tokenHash));
      }
    }
  } while (cursor !== '0');
}

module.exports = {
  createRefreshSession,
  findRefreshSession,
  findRefreshReuseTombstone,
  destroyRefreshSession,
  revokeFamily,
  denyAccessJti,
  isAccessJtiDenied,
  revokeAllUserSessions,
};
