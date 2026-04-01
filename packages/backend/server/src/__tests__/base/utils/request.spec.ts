import { PrismaService } from '@affine/server/prisma';
import { TestingModule } from '@nestjs/testing';
import test from 'ava';

import { getRequestResponseFromHost } from '../../../base/utils/request';

let _moduleRef: TestingModule;
let _prisma: PrismaService;

test.beforeEach(async () => {
  // _moduleRef = await Test.createTestingModule({
  //   imports: [AppModule],
  // }).compile();
  // _prisma = _moduleRef.get(PrismaService);
});

test.afterEach.always(async () => {
  // await _prisma.$disconnect();
  // await _moduleRef?.close();
});

test('getRequestResponseFromHost integration test', async t => {
  t.truthy(getRequestResponseFromHost);
});
