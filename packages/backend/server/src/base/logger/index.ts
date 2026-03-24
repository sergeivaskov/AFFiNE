import { Global, Module } from '@nestjs/common';

import { ProofaLogger } from '../../plugins/proofa-logger';
import { ConfigModule } from '../config';
import { AFFiNELogger } from './service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: AFFiNELogger,
      useClass: ProofaLogger,
    },
  ],
  exports: [AFFiNELogger],
})
export class LoggerModule {}

export { AFFiNELogger } from './service';
