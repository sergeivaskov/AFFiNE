import { test } from 'ava';

import { AuthService } from '../../../core/auth/service';

test.beforeEach(() => {
  // TODO: mock config (Config)
  // TODO: mock models (Models)
  // TODO: mock mailer (Mailer)
});

test('AuthService should be defined', t => {
  t.truthy(AuthService);
});
