export const money = (n, currency = 'Rs') => `${currency} ${Number(n || 0).toLocaleString('en-PK')}`;
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : '');
/** Calendar date stored at UTC midnight (e.g. a due date), shown without time-zone shifting. */
export const dateOnly = (d) => (d ? new Date(d).toLocaleDateString('en-PK', { dateStyle: 'medium', timeZone: 'UTC' }) : '');
/** Value for <input type="date">. */
export const dateInputValue = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
