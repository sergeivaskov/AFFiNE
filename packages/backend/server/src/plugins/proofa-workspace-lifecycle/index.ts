import { Module } from '@nestjs/common';

import { WebhookDlqService } from './webhook-dlq.service';
import { WorkspaceLifecycleSubscriber } from './workspace-lifecycle.subscriber';
import { WorkspaceWebhookService } from './workspace-webhook.service';

@Module({
  providers: [
    WebhookDlqService,
    WorkspaceWebhookService,
    WorkspaceLifecycleSubscriber,
  ],
})
export class ProofaWorkspaceLifecycleModule {}
