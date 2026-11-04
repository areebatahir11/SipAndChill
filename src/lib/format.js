export const money = (n, currency = 'Rs') => `${currency} ${Number(n || 0).toLocaleString('en-PK')}`;
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : '');
