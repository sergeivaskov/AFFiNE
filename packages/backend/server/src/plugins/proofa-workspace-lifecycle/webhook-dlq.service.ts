import { Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class WebhookDlqService {
  private readonly logger = new Logger(WebhookDlqService.name);
  private redis: Redis | null = null;

  private getRedis(): Redis | null {
    if (!this.redis) {
      const redisHost = process.env.REDIS_SERVER_HOST ?? 'localhost';
      const redisPort = parseInt(process.env.REDIS_SERVER_PORT ?? '6379', 10);
      try {
        this.redis = new Redis({
          host: redisHost,
          port: redisPort,
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        });
        this.redis.connect().catch(err => {
          this.logger.warn(
            `Redis DLQ connection failed: ${err.message}. DLQ disabled.`
          );
          this.redis = null;
        });
      } catch {
        this.logger.warn('Failed to initialize Redis for DLQ. DLQ disabled.');
        return null;
      }
    }
    return this.redis;
  }

  async pushToDeadLetterQueue(
    event: string,
    workspaceId: string,
    payload: string,
    error: string
  ): Promise<void> {
    const redis = this.getRedis();
    if (!redis) {
      this.logger.error(
        `Cannot push to DLQ (Redis unavailable). Event: ${event}, Workspace: ${workspaceId}`
      );
      return;
    }

    const dlqEntry = JSON.stringify({
      event,
      workspace_id: workspaceId,
      payload,
      error,
      failed_at: new Date().toISOString(),
      retries_exhausted: true,
    });

    try {
      await redis.lpush('proofa:webhook:dlq', dlqEntry);
      this.logger.warn(
        `Pushed failed webhook to DLQ: event=${event}, workspace=${workspaceId}`
      );
    } catch (err: any) {
      this.logger.error(`Failed to push to DLQ: ${err.message}`);
    }
  }
}
