import { Injectable, Logger } from '@nestjs/common';

import { OnEvent } from '../../base';
import { WorkspaceWebhookService } from './workspace-webhook.service';

@Injectable()
export class WorkspaceLifecycleSubscriber {
  private readonly logger = new Logger(WorkspaceLifecycleSubscriber.name);

  constructor(private readonly webhookService: WorkspaceWebhookService) {}

  @OnEvent('workspace.created')
  async onWorkspaceCreated(workspace: Events['workspace.created']) {
    this.logger.log(
      `Received workspace.created event for workspace ${workspace.id}`
    );
    await this.webhookService.notifyWorkspaceCreated(workspace.id);
  }

  @OnEvent('workspace.deleted')
  async onWorkspaceDeleted(workspace: Events['workspace.deleted']) {
    this.logger.log(
      `Received workspace.deleted event for workspace ${workspace.id}`
    );
    await this.webhookService.notifyWorkspaceDeleted(workspace.id);
  }
}
