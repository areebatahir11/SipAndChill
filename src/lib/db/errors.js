/** Prisma unique-constraint violation (e.g. duplicate name inside one tenant). */
export const isUniqueViolation = (err) => err?.code === 'P2002';
