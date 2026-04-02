import assert from 'node:assert';
import { before, describe, it } from 'node:test';

import { RefreshTokenStore } from '../../../plugins/proofa-auth/refresh-token.store';

/* eslint-disable @typescript-eslint/no-floating-promises */

describe('RefreshTokenStore', () => {
  let store: RefreshTokenStore;
  let mockRedis: any;

  before(() => {
    mockRedis = {
      set: async (...args: any[]) => 'OK',
      get: async (key: string) => null,
      del: async (...keys: string[]) => keys.length,
      hset: async (...args: any[]) => 1,
      hdel: async (...args: any[]) => 1,
      hkeys: async (key: string) => [],
    };
    store = new RefreshTokenStore(mockRedis);
  });

  it('should save a refresh token to Redis', async () => {
    const calls: any[] = [];
    mockRedis.set = async (...args: any[]) => {
      calls.push(args);
      return 'OK';
    };
    mockRedis.hset = async (...args: any[]) => {
      calls.push(args);
      return 1;
    };

    const jti = await store.save('user-123', 'workspace-456');

    assert.ok(jti);
    assert.strictEqual(typeof jti, 'string');
    assert.ok(calls.some(c => c[0].startsWith('refresh_token:')));
    assert.ok(calls.some(c => c[0] === 'user_sessions:user-123'));
  });

  it('should validate an existing refresh token', async () => {
    const tokenData = {
      userId: 'user-123',
      workspaceId: 'workspace-456',
      issuedAt: Date.now(),
    };
    mockRedis.get = async (key: string) => JSON.stringify(tokenData);

    const result = await store.validate('test-jti');

    assert.ok(result);
    assert.strictEqual(result?.userId, 'user-123');
    assert.strictEqual(result?.workspaceId, 'workspace-456');
  });

  it('should return null for non-existent token', async () => {
    mockRedis.get = async (key: string) => null;

    const result = await store.validate('non-existent-jti');

    assert.strictEqual(result, null);
  });

  it('should revoke a refresh token', async () => {
    const deletedKeys: string[] = [];
    mockRedis.del = async (...keys: string[]) => {
      deletedKeys.push(...keys);
      return keys.length;
    };
    mockRedis.hdel = async (...args: any[]) => 1;

    await store.revoke('test-jti', 'user-123');

    assert.ok(deletedKeys.includes('refresh_token:test-jti'));
  });

  it('should rotate a token (set rotatedAt and short TTL)', async () => {
    const tokenData = {
      userId: 'user-123',
      workspaceId: 'workspace-456',
      issuedAt: Date.now(),
    };
    let ttl = 0;
    mockRedis.get = async (key: string) => JSON.stringify(tokenData);
    mockRedis.set = async (key: string, value: string, ex: string, ttlSeconds: number) => {
      ttl = ttlSeconds;
      return 'OK';
    };
    mockRedis.hdel = async (...args: any[]) => 1;

    await store.rotate('test-jti', 'user-123');

    assert.strictEqual(ttl, 30);
  });

  it('should revoke all tokens for a user', async () => {
    mockRedis.hkeys = async (key: string) => ['jti-1', 'jti-2', 'jti-3'];
    const deletedKeys: string[] = [];
    mockRedis.del = async (...keys: string[]) => {
      deletedKeys.push(...keys);
      return keys.length;
    };

    await store.revokeAllForUser('user-123');

    assert.ok(deletedKeys.includes('refresh_token:jti-1'));
    assert.ok(deletedKeys.includes('refresh_token:jti-2'));
    assert.ok(deletedKeys.includes('refresh_token:jti-3'));
    assert.ok(deletedKeys.includes('user_sessions:user-123'));
  });
});
