import { after } from 'next/server';

/**
 * Runs `task` once the response has been sent, so the cashier never waits for it (audit-log writes).
 * Outside a request (scripts, tests) there is no "after": the task simply runs now. Failures never reach the caller.
 */
export function afterResponse(task) {
  try {
    after(task);
  } catch {
    Promise.resolve().then(task).catch(() => {});
  }
}
