import assert from 'node:assert';
import { before, describe, it } from 'node:test';

import { JwtService } from '../../../plugins/proofa-auth/jwt.service';

/* eslint-disable @typescript-eslint/no-floating-promises */

describe('JwtService', () => {
  let jwtService: JwtService;

  before(() => {
    process.env.AFFINE_JWT_SECRET = 'test-secret-key-for-unit-tests-only';
    jwtService = new JwtService();
  });

  it('should sign and verify a JWT token', async () => {
    const payload = {
      sub: 'user-123',
      email: 'test@example.com',
      kimai_role: 'ROLE_USER',
      workspaces: {},
    };

    const token = await jwtService.sign(payload);
    assert.ok(token);
    assert.strictEqual(typeof token, 'string');

    const verified = await jwtService.verify(token);
    assert.strictEqual(verified.sub, 'user-123');
    assert.strictEqual(verified.email, 'test@example.com');
    assert.strictEqual(verified.kimai_role, 'ROLE_USER');
  });

  it('should include issuer and audience claims', async () => {
    const payload = {
      sub: 'user-456',
      email: 'another@example.com',
    };

    const token = await jwtService.sign(payload);
    const verified = await jwtService.verify(token);

    assert.strictEqual(verified.iss, 'proofa-identity');
    assert.strictEqual(verified.aud, 'proofa-services');
  });

  it('should reject tokens with invalid signature', async () => {
    const payload = { sub: 'user-999', email: 'fake@example.com' };
    const token = await jwtService.sign(payload);

    const tamperedToken = token.slice(0, -10) + 'fakesignature';

    await assert.rejects(async () => {
      await jwtService.verify(tamperedToken);
    });
  });
});
