/**
 * Database failures a user can cause with odd input. They get a plain 4xx message instead of a generic 500
 * (and never see table, column or SQL details). Anything not listed here is still logged and returned as a 500.
 * Detected by code/name so this file does not need to import Prisma (plain .mjs so the tests can run it).
 */
export function prismaFailure(err) {
  if (err?.name === 'PrismaClientValidationError') return { status: 400, code: 'VALIDATION', message: 'Some of the values you entered are not valid.' };
  switch (err?.code) {
    case 'P2020': // value out of range for the column type
    case 'P2000': // value too long for the column
      return { status: 400, code: 'VALIDATION', message: 'A number or text you entered is too large.' };
    case 'P2025': return { status: 404, code: 'NOT_FOUND', message: 'That record was not found. It may have been removed.' };
    case 'P2002': return { status: 409, code: 'DUPLICATE', message: 'That already exists.' };
    case 'P2003': return { status: 409, code: 'IN_USE', message: 'This record is still in use, so the change was not made.' };
    default: return null;
  }
}
