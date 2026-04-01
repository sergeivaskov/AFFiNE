import assert from 'node:assert/strict';
import { after,before, describe, it } from 'node:test';

import { Test, TestingModule } from '@nestjs/testing';

import { ProofaLogger } from '../index';

void describe('ProofaLogger', () => {
  let module: TestingModule;
  let logger: ProofaLogger;

  before(async () => {
    module = await Test.createTestingModule({
      providers: [ProofaLogger],
    }).compile();

    logger = module.get<ProofaLogger>(ProofaLogger);
  });

  after(async () => {
    await module.close();
  });

  void it('should be defined', () => {
    assert.ok(logger);
    assert.ok(logger instanceof ProofaLogger);
  });

  void it('should have required logging methods', () => {
    assert.equal(typeof logger.log, 'function');
    assert.equal(typeof logger.error, 'function');
    assert.equal(typeof logger.warn, 'function');
    assert.equal(typeof logger.debug, 'function');
  });

  void it('should execute log method without errors', () => {
    assert.doesNotThrow(() => {
      logger.log('test message', 'TestContext');
    });
  });

  void it('should execute warn method without errors', () => {
    assert.doesNotThrow(() => {
      logger.warn('test warning', 'TestContext');
    });
  });

  void it('should execute error method without errors', () => {
    assert.doesNotThrow(() => {
      logger.error('test error', new Error('test'), 'TestContext');
    });
  });

  void it('should handle circular references', () => {
    const circular: any = { name: 'test' };
    circular.self = circular;

    assert.doesNotThrow(() => {
      logger.log('circular test', circular);
    });
  });
});
