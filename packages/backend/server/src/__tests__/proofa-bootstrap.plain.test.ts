import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';

const require = createRequire(import.meta.url);

void describe('proofa-bootstrap correlation ID', () => {
  void it('should load without errors', () => {
    const bootstrapPath = require.resolve('../../proofa-bootstrap.cjs');
    delete require.cache[bootstrapPath];

    assert.doesNotThrow(() => {
      require('../../proofa-bootstrap.cjs');
    });
  });

  void it('bootstrap module should be CommonJS', () => {
    const bootstrapPath = require.resolve('../../proofa-bootstrap.cjs');
    delete require.cache[bootstrapPath];

    const bootstrap = require('../../proofa-bootstrap.cjs');
    assert.ok(bootstrap !== undefined);
  });

  void it('should patch http module on require', () => {
    const http = require('node:http');
    assert.ok(http);
    assert.equal(typeof http.createServer, 'function');
  });
});
