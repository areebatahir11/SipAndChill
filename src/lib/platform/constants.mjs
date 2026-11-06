// Shared by the platform API, the UI and the tests (plain ESM, no framework imports).

export const BUSINESS_TYPES = Object.freeze({
  JUICE_SHOP: 'Juice shop',
  COFFEE_SHOP: 'Coffee shop',
  JUICE_COFFEE_SHOP: 'Juice & coffee shop',
  ICE_CREAM_SHOP: 'Ice cream shop',
});

export const BILLING_STATUS = Object.freeze({ PAID: 'PAID', UNPAID: 'UNPAID' });

export const businessTypeLabel = (code) => BUSINESS_TYPES[code] || code;

// Every self-serve signup gets this many days before the first payment is due.
export const TRIAL_DAYS = 14;

// Where a business is in its life with us. PENDING = signed up and verified its email, waiting for PearlSolutions to approve.
// Pending and rejected businesses also have Tenant.isActive = false, so every existing "is this business active" check keeps them out.
export const TENANT_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', PENDING: 'PENDING', REJECTED: 'REJECTED' });
