import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const ok = (data, init) => NextResponse.json({ data }, init);

/** Wraps a route handler so every error becomes a consistent JSON response. */
export function handle(fn) {
  return async (request, context) => {
    try {
      return await fn(request, context);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: { message: err.message, code: err.code } }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const fields = err.flatten().fieldErrors;
        const first = Object.values(fields).flat()[0] || 'Invalid input.';
        return NextResponse.json({ error: { message: first, code: 'VALIDATION', fields } }, { status: 400 });
      }
      console.error('[api] unhandled error', err);
      return NextResponse.json({ error: { message: 'Something went wrong. Please try again.' } }, { status: 500 });
    }
  };
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.');
  }
}
