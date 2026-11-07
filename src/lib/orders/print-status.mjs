// Receipt print tracking.
//
// DIRECT (USB / serial) printing can know one real thing: the printer ACCEPTED the bytes (SENT) or the transfer failed (PROBLEM).
// It still cannot see paper-out or a jam, so SENT is "sent to the printer", not "printed OK".
// BROWSER printing (print dialog) can only know the dialog was opened (DIALOG_OPENED); it cannot tell Print from Cancel.
// CONFIRMED exists only because a person said "it printed".

export const PRINT_STATUS = Object.freeze({
  NOT_REQUESTED: 'NOT_REQUESTED', // nothing was sent / opened for this order
  SENT: 'SENT',                   // direct printing: the printer accepted the receipt data
  CONFIRMED: 'CONFIRMED',         // a person confirmed the receipt came out
  PROBLEM: 'PROBLEM',             // sending failed, or a person said it did not print
  DIALOG_OPENED: 'DIALOG_OPENED', // browser print window opened, outcome unknown
});

export const PRINT_EVENTS = Object.freeze(['sent', 'opened', 'confirmed', 'failed']);

/** Words for the UI: [pill tone, label, one-line explanation]. */
export const PRINT_LABEL = Object.freeze({
  NOT_REQUESTED: ['off', 'No receipt', 'No receipt was printed for this order yet.'],
  SENT: ['ok', 'Sent to printer', 'The printer accepted the receipt. (A page cannot see paper-out or a jam, so look at the paper if unsure.)'],
  CONFIRMED: ['ok', 'Printed', 'Someone confirmed this receipt came out.'],
  PROBLEM: ['alert', 'Not printed', 'Printing failed, or someone said the receipt did not come out.'],
  DIALOG_OPENED: ['neutral', 'Check paper', 'The print window was opened but nobody confirmed that paper came out.'],
});

/** A receipt was handed over fine at least once: a later failed COPY must not turn it into a problem. */
const isGood = (status) => status === PRINT_STATUS.SENT || status === PRINT_STATUS.CONFIRMED;

/** Only a failed print, or an unconfirmed browser dialog, needs a second look. SENT never does. */
export const needsAttention = (status) => status === PRINT_STATUS.PROBLEM || status === PRINT_STATUS.DIALOG_OPENED;

/** An open dialog is normal for the first minutes (the cashier is at the printer); only older ones are flagged. */
export const ATTENTION_GRACE_MS = 2 * 60 * 1000;
/** The warning banner looks back this far (older orders stay filterable in the orders list). */
export const ATTENTION_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Pure transition rules. Returns the changes to store for one event given the stored state.
 * Only the four print columns can ever appear in the result: a (re)print can never touch totals, payments or stock.
 *   sent      -> one more attempt; SENT unless already CONFIRMED
 *   opened    -> one more attempt; DIALOG_OPENED unless already SENT / CONFIRMED
 *   confirmed -> CONFIRMED (+ time)
 *   failed    -> PROBLEM unless the receipt already went out (SENT / CONFIRMED)
 */
export function nextPrintState(current, event, now = new Date()) {
  if (!PRINT_EVENTS.includes(event)) throw new RangeError(`Unknown print event: ${event}`);
  const status = current?.printStatus;
  const attempts = Number(current?.printAttempts) || 0;
  if (event === 'sent') return { printStatus: status === PRINT_STATUS.CONFIRMED ? PRINT_STATUS.CONFIRMED : PRINT_STATUS.SENT, printAttempts: attempts + 1, lastPrintAt: now };
  if (event === 'opened') return { printStatus: isGood(status) ? status : PRINT_STATUS.DIALOG_OPENED, printAttempts: attempts + 1, lastPrintAt: now };
  if (event === 'confirmed') return { printStatus: PRINT_STATUS.CONFIRMED, printConfirmedAt: now, lastPrintAt: now };
  return { printStatus: isGood(status) ? status : PRINT_STATUS.PROBLEM, lastPrintAt: now };
}
