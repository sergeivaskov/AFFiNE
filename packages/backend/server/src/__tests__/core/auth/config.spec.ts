import { test } from 'ava';

import { config } from '../../../core/auth/config';

test.beforeEach(() => {});

test('config should be defined', t => {
  t.truthy(config);
});
