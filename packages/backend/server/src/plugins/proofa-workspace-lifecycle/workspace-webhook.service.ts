import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

import { WebhookDlqService } from './webhook-dlq.service';

@Injectable()
export class WorkspaceWebhookService {
  private readonly logger = new Logger(WorkspaceWebhookService.name);

  constructor(private readonly dlqService: WebhookDlqService) {}

  async notifyWorkspaceCreated(
    workspaceId: string,
    retryCount = 0
  ): Promise<void> {
    const webhookUrl = process.env.PROOFA_KIMAI_WEBHOOK_URL;
    const secret = process.env.PROOFA_WEBHOOK_SECRET;

    if (!webhookUrl || !secret) {
      this.logger.warn(
        'PROOFA_KIMAI_WEBHOOK_URL or PROOFA_WEBHOOK_SECRET is not configured. Skipping webhook notification.'
      );
      return;
    }

    const payload = JSON.stringify({
      workspace_id: workspaceId,
      timestamp: new Date().toISOString(),
    });

    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    try {
      this.logger.log(
        `Sending workspace.created webhook for workspace ${workspaceId} to ${webhookUrl} (Attempt ${retryCount + 1})`
      );

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
        },
        body: payload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Webhook failed with status ${response.status}: ${errorText}`
        );

        // 409 Conflict means schema already exists, which is fine (idempotency)
        if (response.status === 409) {
          this.logger.warn(
            `Schema for workspace ${workspaceId} already exists.`
          );
          return;
        }

        // 403 Forbidden means invalid data, no point in retrying
        if (response.status === 403) {
          this.logger.error(
            `Webhook rejected with 403 Forbidden for workspace ${workspaceId}. Not retrying.`
          );
          return;
        }

        await this.handleRetry(workspaceId, retryCount);
      } else {
        this.logger.log(
          `Webhook sent successfully for workspace ${workspaceId}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send webhook for workspace ${workspaceId}`,
        error
      );
      await this.handleRetry(workspaceId, retryCount);
    }
  }

  private async handleRetry(workspaceId: string, retryCount: number) {
    const maxRetries = 3;
    if (retryCount >= maxRetries) {
      this.logger.error(
        `Max retries reached for workspace ${workspaceId} webhook. Pushing to DLQ.`
      );
      await this.dlqService.pushToDeadLetterQueue(
        'workspace.created',
        workspaceId,
        JSON.stringify({ workspace_id: workspaceId }),
        'Max retries exhausted'
      );
      return;
    }

    const backoffTimes = [1000, 5000, 15000]; // 1s, 5s, 15s
    const delay = backoffTimes[retryCount];

    this.logger.log(
      `Retrying webhook for workspace ${workspaceId} in ${delay}ms...`
    );

    setTimeout(() => {
      this.notifyWorkspaceCreated(workspaceId, retryCount + 1).catch(e => {
        this.logger.error('Error in retry timeout', e);
      });
    }, delay);
  }

  async notifyWorkspaceDeleted(
    workspaceId: string,
    retryCount = 0
  ): Promise<void> {
    const webhookUrl =
      process.env.PROOFA_KIMAI_WEBHOOK_DELETED_URL ??
      process.env.PROOFA_KIMAI_WEBHOOK_URL?.replace(
        'workspace-created',
        'workspace-deleted'
      );
    const secret = process.env.PROOFA_WEBHOOK_SECRET;

    if (!webhookUrl || !secret) {
      this.logger.warn(
        'Webhook URL or Secret is not configured. Skipping webhook notification.'
      );
      return;
    }

    const payload = JSON.stringify({
      workspace_id: workspaceId,
      timestamp: new Date().toISOString(),
    });

    const signature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    try {
      this.logger.log(
        `Sending workspace.deleted webhook for workspace ${workspaceId} to ${webhookUrl} (Attempt ${retryCount + 1})`
      );

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': `sha256=${signature}`,
        },
        body: payload,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Webhook failed with status ${response.status}: ${errorText}`
        );

        if (response.status === 409) {
          this.logger.warn(
            `Workspace ${workspaceId} cannot be deleted due to active time entries.`
          );
          return;
        }

        if (response.status === 403) {
          this.logger.error(
            `Webhook rejected with 403 Forbidden for workspace ${workspaceId}. Not retrying.`
          );
          return;
        }

        await this.handleRetryDeleted(workspaceId, retryCount);
      } else {
        this.logger.log(
          `Webhook sent successfully for workspace ${workspaceId} deletion`
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send webhook for workspace ${workspaceId} deletion`,
        error
      );
      await this.handleRetryDeleted(workspaceId, retryCount);
    }
  }

  private async handleRetryDeleted(workspaceId: string, retryCount: number) {
    const maxRetries = 3;
    if (retryCount >= maxRetries) {
      this.logger.error(
        `Max retries reached for workspace ${workspaceId} deletion webhook. Pushing to DLQ.`
      );
      await this.dlqService.pushToDeadLetterQueue(
        'workspace.deleted',
        workspaceId,
        JSON.stringify({ workspace_id: workspaceId }),
        'Max retries exhausted for deletion'
      );
      return;
    }

    const backoffTimes = [1000, 5000, 15000]; // 1s, 5s, 15s
    const delay = backoffTimes[retryCount];

    this.logger.log(
      `Retrying deletion webhook for workspace ${workspaceId} in ${delay}ms...`
    );

    setTimeout(() => {
      this.notifyWorkspaceDeleted(workspaceId, retryCount + 1).catch(e => {
        this.logger.error('Error in retry timeout', e);
      });
    }, delay);
  }
}
