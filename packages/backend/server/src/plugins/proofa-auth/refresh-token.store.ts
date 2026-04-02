import { Injectable, Logger } from '@nestjs/common';
import { SessionRedis } from '../../base/redis';
import { randomUUID } from 'crypto';

export interface RefreshTokenData {
  userId: string;
  workspaceId?: string;
  issuedAt: number;
  rotatedAt?: number;
}

@Injectable()
export class RefreshTokenStore {
  private readonly logger = new Logger(RefreshTokenStore.name);
  private readonly TTL = 7 * 24 * 60 * 60; // 7 days in seconds
  private readonly GRACE_PERIOD = 30; // 30 seconds grace period for race conditions

  constructor(private readonly redis: SessionRedis) {}

  async save(userId: string, workspaceId?: string): Promise<string> {
    const jti = randomUUID();
    const key = `refresh_token:${jti}`;
    const data: RefreshTokenData = {
      userId,
      workspaceId,
      issuedAt: Date.now(),
    };

    await this.redis.set(key, JSON.stringify(data), 'EX', this.TTL);
    
    // Also store in user's sessions hash for multi-device logout
    const sessionKey = `user_sessions:${userId}`;
    await this.redis.hset(sessionKey, jti, JSON.stringify({ issuedAt: data.issuedAt }));
    
    return jti;
  }

  async validate(jti: string): Promise<RefreshTokenData | null> {
    const key = `refresh_token:${jti}`;
    const dataStr = await this.redis.get(key);
    
    if (!dataStr) {
      return null;
    }
    
    try {
      return JSON.parse(dataStr) as RefreshTokenData;
    } catch (e) {
      this.logger.error(`Failed to parse refresh token data for jti ${jti}`, e);
      return null;
    }
  }

  async revoke(jti: string, userId: string): Promise<void> {
    const key = `refresh_token:${jti}`;
    await this.redis.del(key);
    
    const sessionKey = `user_sessions:${userId}`;
    await this.redis.hdel(sessionKey, jti);
  }

  async rotate(jti: string, userId: string): Promise<void> {
    const key = `refresh_token:${jti}`;
    const dataStr = await this.redis.get(key);
    
    if (dataStr) {
      try {
        const data = JSON.parse(dataStr) as RefreshTokenData;
        data.rotatedAt = Date.now();
        // Overwrite with 30s TTL for grace period
        await this.redis.set(key, JSON.stringify(data), 'EX', this.GRACE_PERIOD);
      } catch (e) {
        // Ignore parse errors, just delete
        await this.revoke(jti, userId);
      }
    }
    
    // Remove from active sessions hash immediately so it can't be used for new sessions
    const sessionKey = `user_sessions:${userId}`;
    await this.redis.hdel(sessionKey, jti);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const sessionKey = `user_sessions:${userId}`;
    const sessions = await this.redis.hkeys(sessionKey);
    
    if (sessions.length > 0) {
      const keysToDelete = sessions.map(jti => `refresh_token:${jti}`);
      await this.redis.del(...keysToDelete);
    }
    
    await this.redis.del(sessionKey);
  }
}
