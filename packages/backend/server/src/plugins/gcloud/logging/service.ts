import { LoggerService, Provider } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';

import { AFFiNELogger as LoggerProvide } from '../../../base/logger';
import { AFFiNELogger } from './logger';

const moreMetadata = format(info => {
  info.requestId = LoggerProvide.getRequestId();
  if (!info.extra) {
    info.extra = {};
  }
  info.extra.correlation_id = info.requestId || 'no-request-context';
  info.extra.channel = info.context || 'unknown';
  return info;
});

export const LoggerProvider: Provider<LoggerService> = {
  provide: LoggerProvide,
  useFactory: () => {
    const logFilePath =
      process.env.AI_LOG_FILE_PATH || '/var/log/proofa/node-backend.jsonl';
    const instance = createLogger({
      level: env.namespaces.canary ? 'debug' : 'info',
      transports: [
        new transports.Console(),
        new transports.File({
          filename: logFilePath,
          format: format.json(),
        }),
      ],
      format: format.combine(moreMetadata(), format.json()),
    });
    return new AFFiNELogger(instance);
  },
};
