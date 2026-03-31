import test from 'ava';

import { TelemetryService } from '../../../core/telemetry/service';

test.beforeEach(() => {
  // TODO: mock config (Config)
  // TODO: mock url (URLHelper)
});

test('TelemetryService should be defined', t => {
  t.truthy(TelemetryService);
});
