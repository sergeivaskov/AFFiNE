import * as fs from 'node:fs';

import { ConsoleLogger, Injectable, type LogLevel } from '@nestjs/common';
import { ClsServiceManager } from 'nestjs-cls';

import { UserFriendlyError } from '../error';

const aiLogFilePath =
  process.env.AI_LOG_FILE_PATH || '/var/log/proofa/node-backend.jsonl';

// DO NOT use this Logger directly
// Use it via this way: `private readonly logger = new Logger(MyService.name)`
@Injectable()
export class AFFiNELogger extends ConsoleLogger {
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
          contextName: context || this.context,
          stack,
        },
        extra: {
          correlation_id: AFFiNELogger.getRequestId() || 'no-request-context',
          channel: context || this.context,
        },
      };
      // Асинхронная запись, чтобы не блокировать Event Loop
      fs.appendFile(aiLogFilePath, JSON.stringify(logEntry) + '\n', () => {});
    } catch (e) {
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

  override stringifyMessage(message: unknown, logLevel: LogLevel) {
    const messageString = super.stringifyMessage(message, logLevel);
    const requestId = AFFiNELogger.getRequestId();
    if (!requestId) {
      return messageString;
    }
    return `<${requestId}> ${messageString}`;
  }

  static getRequestId(): string | undefined {
    return ClsServiceManager.getClsService()?.getId();
  }

  static formatStack(stackOrError?: Error | string | unknown) {
    if (stackOrError instanceof Error) {
      let err = stackOrError;

      // most of the internal error are caught and created by `GlobalExceptionFilter`,
      // and their error stack is helpless
      if (err instanceof UserFriendlyError) {
        return err.stacktrace;
      }

      let stack = err.stack ?? '';
      if (err.cause instanceof Error && err.cause.stack) {
        stack += `\n\nCaused by:\n\n${err.cause.stack}`;
      }
      return stack;
    }
    return stackOrError;
  }

  /**
   * Nestjs ConsoleLogger.error() will not print the stack trace if the error is an instance of Error
   * This method is a workaround to print the stack trace
   *
   * Usage:
   * ```
   * this.logger.error('some error happens', errInstance);
   * ```
   */
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
