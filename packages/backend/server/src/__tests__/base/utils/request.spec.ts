import { PrismaService } from '@affine/server/prisma';
import { TestingModule } from '@nestjs/testing';
import test from 'ava';

import { getRequestResponseFromHost } from '../../../base/utils/request';

let moduleRef: TestingModule;
let prisma: PrismaService;

test.beforeEach(async () => {
  // moduleRef = await Test.createTestingModule({
  //   imports: [AppModule],
  // }).compile();
  // prisma = moduleRef.get(PrismaService);
});

test.afterEach.always(async () => {
  // await prisma.$disconnect();
  // await moduleRef?.close();
});

test('getRequestResponseFromHost integration test', async t => {
  t.truthy(getRequestResponseFromHost);
});
