// Short database hiccups (cloud pooler waking up, a dropped connection) should not become an error page.
// Pure helper (no Prisma import) so tests can run it.

/** P1001 = server never reached, so repeating even a write is safe. The rest may have reached the server: repeat reads only. */
const NEVER_REACHED = new Set(['P1001']);
const MAYBE_REACHED = new Set(['P1002', 'P1008', 'P1017']);
const READS = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);

export function canRetry(err, operation) {
  const code = err?.code;
  if (NEVER_REACHED.has(code)) return true;
  return MAYBE_REACHED.has(code) && READS.has(operation);
}

/** Runs `fn`; on a retryable failure waits (400 ms, 1.2 s) and tries again, at most `tries` times in total. */
export async function withRetry(fn, operation, { tries = 3, delays = [400, 1200], sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= tries || !canRetry(err, operation)) throw err;
      await sleep(delays[attempt - 1] ?? delays[delays.length - 1]);
    }
  }
}
