/**
 * Turns service results (Dates, Prisma Decimals ...) into the same plain JSON the /api routes would send,
 * so a Server Component can hand them to a Client Component as props without surprises.
 */
export const plain = (value) => JSON.parse(JSON.stringify(value));
