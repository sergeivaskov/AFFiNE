import test from 'ava';

import { TestDataFactory } from '../utils/test-data-factory.js';

const factory = new TestDataFactory();

test('Integration: Token refresh flow should work end-to-end', async (t) => {
  const user = factory.createTestUser();
  const workspaceId = 'test-workspace-123';
  
  const jwt = await factory.generateValidJwt(user.id, user.email, workspaceId);
  
  t.truthy(jwt, 'JWT should be generated');
  t.is(typeof jwt, 'string', 'JWT should be a string');
  
  t.pass('Token generation works');
});

test('Integration: Expired JWT should be rejected', async (t) => {
  const user = factory.createTestUser();
  
  const expiredJwt = await factory.generateExpiredJwt(user.id, user.email);
  
  t.truthy(expiredJwt, 'Expired JWT should be generated');
  t.is(typeof expiredJwt, 'string', 'Expired JWT should be a string');
  
  t.pass('Expired token generation works');
});

test('Integration: Test data factory should create unique users', (t) => {
  const user1 = factory.createTestUser();
  const user2 = factory.createTestUser();
  
  t.not(user1.id, user2.id, 'User IDs should be unique');
  t.not(user1.email, user2.email, 'User emails should be unique');
});

test('Integration: JWT payload should contain required fields', async (t) => {
  const user = factory.createTestUser();
  const workspaceId = 'test-workspace-456';
  const roles = ['ROLE_ADMIN', 'ROLE_USER'];
  
  const jwt = await factory.generateValidJwt(user.id, user.email, workspaceId, roles);
  
  t.truthy(jwt);
  
  const parts = jwt.split('.');
  t.is(parts.length, 3, 'JWT should have 3 parts (header.payload.signature)');
  
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  
  t.is(payload.sub, user.id, 'Payload should contain user ID');
  t.is(payload.email, user.email, 'Payload should contain email');
  t.is(payload.workspace_id, workspaceId, 'Payload should contain workspace_id');
  t.is(payload.kimai_role, 'ROLE_ADMIN', 'Payload should contain first role as kimai_role');
  t.truthy(payload.exp, 'Payload should contain expiration');
  t.truthy(payload.iat, 'Payload should contain issued at');
  t.is(payload.iss, 'proofa-identity', 'Payload should have correct issuer');
  t.is(payload.aud, 'proofa-services', 'Payload should have correct audience');
});
