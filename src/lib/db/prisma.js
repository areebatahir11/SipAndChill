import { PrismaClient } from '@prisma/client';
import { withRetry } from './retry.mjs';

// One client per process (avoids exhausting connections during dev hot-reload).
const globalForPrisma = globalThis;

function createClient() {
  // Every query goes through withRetry: a brief "can't reach database" (P1001) is repeated instead of failing the page.
  return new PrismaClient().$extends({
    query: { $allOperations: ({ operation, args, query }) => withRetry(() => query(args), operation) },
  });
}

export const prisma = globalForPrisma.__prisma ?? createClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;
