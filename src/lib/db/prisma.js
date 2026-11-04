import { PrismaClient } from '@prisma/client';

// One client per process (avoids exhausting connections during dev hot-reload).
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma;
