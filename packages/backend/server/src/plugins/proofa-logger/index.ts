import * as fs from 'node:fs';
import * as path from 'node:path';

import { Injectable, type LogLevel } from '@nestjs/common';

import { AFFiNELogger } from '../../base/logger/service';

// Путь к файлу логов для MCP-сервера
const aiLogFilePath = path.resolve(
  process.cwd(),
  '../../../../../.cursor/logs/node-backend.jsonl'
);

@Injectable()
export class ProofaLogger extends AFFiNELogger {
  private writeJsonLog(
    level: LogLevel,
    message: unknown,
    context?: string,
    stack?: string
  ) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        msg: typeof message === 'string' ? message : JSON.stringify(message),
        context: {
          requestId: AFFiNELogger.getRequestId(),
          contextName: context || this.context,
          stack,
        },
        extra: {
          correlation_id: AFFiNELogger.getRequestId() || 'no-request-context',
          channel: context || this.context || 'app',
        },
      };
      // Асинхронная запись, чтобы не блокировать Event Loop
      fs.appendFile(aiLogFilePath, JSON.stringify(logEntry) + '\n', () => {});
    } catch {
      // Игнорируем ошибки записи логов
    }
  }

  override log(message: any, context?: string) {
    super.log(message, context);
    this.writeJsonLog('log', message, context);
  }

  override warn(message: any, context?: string) {
    super.warn(message, context);
    this.writeJsonLog('warn', message, context);
  }

  override debug(message: any, context?: string) {
    super.debug(message, context);
    this.writeJsonLog('debug', message, context);
  }

  override verbose(message: any, context?: string) {
    super.verbose(message, context);
    this.writeJsonLog('verbose', message, context);
  }

  override error(
    message: any,
    stackOrError?: Error | string | unknown,
    context?: string
  ) {
    const stack = AFFiNELogger.formatStack(stackOrError);
    super.error(message, stack, context);
    this.writeJsonLog(
      'error',
      message,
      context,
      typeof stack === 'string' ? stack : undefined
    );
  }
}
