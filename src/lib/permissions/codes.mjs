// Single source of truth for permissions and default roles.
// Plain ESM (.mjs) so Next.js, the Prisma seed script and the tests can all import it.
// Code never compares role NAMES; it only asks "does this user hold permission X?".

export const PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: 'dashboard.view',
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_MANAGE: 'products.manage',
  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_MANAGE: 'categories.manage',
  INGREDIENTS_VIEW: 'ingredients.view',
  INGREDIENTS_MANAGE: 'ingredients.manage',
  RECIPES_VIEW: 'recipes.view',
  RECIPES_MANAGE: 'recipes.manage',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_ADJUST: 'inventory.adjust',
  SUPPLIERS_VIEW: 'suppliers.view',
  SUPPLIERS_MANAGE: 'suppliers.manage',
  ORDERS_CREATE: 'orders.create',
  ORDERS_VIEW: 'orders.view',
  ORDERS_CANCEL: 'orders.cancel',
  PAYMENTS_RECORD: 'payments.record',
  RECEIPTS_PRINT: 'receipts.print',
  REPORTS_VIEW: 'reports.view',
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  AUDIT_VIEW: 'audit.view',
  SETTINGS_MANAGE: 'settings.manage',
});

const P = PERMISSIONS;

export const PERMISSION_CATALOG = [
  [P.DASHBOARD_VIEW, 'Dashboard', 'View sales dashboard and financial summaries'],
  [P.PRODUCTS_VIEW, 'Menu', 'View menu items'],
  [P.PRODUCTS_MANAGE, 'Menu', 'Create, edit and deactivate menu items'],
  [P.CATEGORIES_VIEW, 'Menu', 'View categories'],
  [P.CATEGORIES_MANAGE, 'Menu', 'Create, edit and delete categories'],
  [P.INGREDIENTS_VIEW, 'Inventory', 'View ingredients and stock levels'],
  [P.INGREDIENTS_MANAGE, 'Inventory', 'Create and edit ingredients'],
  [P.RECIPES_VIEW, 'Inventory', 'View recipes'],
  [P.RECIPES_MANAGE, 'Inventory', 'Create and edit recipes'],
  [P.INVENTORY_VIEW, 'Inventory', 'View stock movements and inventory reports'],
  [P.INVENTORY_ADJUST, 'Inventory', 'Record purchases, stock-in, wastage and adjustments'],
  [P.SUPPLIERS_VIEW, 'Suppliers', 'View suppliers'],
  [P.SUPPLIERS_MANAGE, 'Suppliers', 'Create and edit suppliers'],
  [P.ORDERS_CREATE, 'Orders', 'Use the POS to create orders'],
  [P.ORDERS_VIEW, 'Orders', 'View order history'],
  [P.ORDERS_CANCEL, 'Orders', 'Cancel or delete orders'],
  [P.PAYMENTS_RECORD, 'Orders', 'Record customer payments'],
  [P.RECEIPTS_PRINT, 'Orders', 'Print receipts'],
  [P.REPORTS_VIEW, 'Reports', 'View sales and financial reports'],
  [P.USERS_VIEW, 'Staff', 'View staff accounts'],
  [P.USERS_MANAGE, 'Staff', 'Create staff, assign roles, reset passwords, deactivate accounts'],
  [P.AUDIT_VIEW, 'Security', 'View the audit log'],
  [P.SETTINGS_MANAGE, 'Settings', 'Change business settings'],
].map(([code, module, description]) => ({ code, module, description }));

export const ROLE_CODES = Object.freeze({
  OWNER: 'OWNER',
  MANAGER: 'MANAGER',
  CASHIER: 'CASHIER',
  INVENTORY_STAFF: 'INVENTORY_STAFF',
});

export const OWNER_RANK = 100;

// rank decides who may manage whom (see canManageRank). Same-rank roles are peers.
export const ROLE_DEFAULTS = {
  [ROLE_CODES.OWNER]: {
    name: 'Business Owner',
    rank: OWNER_RANK,
    description: 'Full control of the business: settings, managers and all staff. There is only one owner per business.',
    permissions: Object.values(P),
  },
  [ROLE_CODES.MANAGER]: {
    name: 'Manager',
    rank: 70,
    description: 'Runs daily operations: menu, stock, orders, reports, cashiers and inventory staff.',
    permissions: Object.values(P).filter((c) => ![P.SETTINGS_MANAGE, P.AUDIT_VIEW].includes(c)),
  },
  [ROLE_CODES.CASHIER]: {
    name: 'Cashier',
    rank: 30,
    description: 'Takes orders at the counter, records payments and prints receipts.',
    permissions: [P.ORDERS_CREATE, P.ORDERS_VIEW, P.PAYMENTS_RECORD, P.RECEIPTS_PRINT, P.PRODUCTS_VIEW, P.CATEGORIES_VIEW],
  },
  [ROLE_CODES.INVENTORY_STAFF]: {
    name: 'Inventory Staff',
    rank: 30,
    description: 'Manages ingredients, stock, purchases and suppliers. No financial access.',
    permissions: [
      P.INGREDIENTS_VIEW, P.INGREDIENTS_MANAGE, P.RECIPES_VIEW, P.INVENTORY_VIEW, P.INVENTORY_ADJUST,
      P.SUPPLIERS_VIEW, P.SUPPLIERS_MANAGE, P.PRODUCTS_VIEW, P.CATEGORIES_VIEW,
    ],
  },
};

/**
 * The one hierarchy rule: you may create/edit/reset/deactivate an account only if its rank
 * is below yours. So an owner manages managers and staff, but can never add another owner:
 * new owners are created only by PearlSolutions (the software owner).
 */
export function canManageRank(actorRank, targetRank) {
  return targetRank < actorRank;
}

/** needed: one code, or an array meaning "any of these". */
export function hasPermission(held, needed) {
  if (!needed || (Array.isArray(needed) && needed.length === 0)) return true;
  const list = Array.isArray(needed) ? needed : [needed];
  return list.some((code) => held.includes(code));
}

/**
 * Navigation + routing table. Labels are plain words for shop owners who do not know what a "POS" is;
 * `hint` is the small line under the label in the sidebar.
 */
export const ROUTE_ACCESS = [
  { href: '/', label: 'Sales Summary', hint: 'Today and past days', any: [P.DASHBOARD_VIEW] },
  { href: '/pos', label: 'Take Orders', hint: 'Sell at the counter', any: [P.ORDERS_CREATE] },
  { href: '/orders', label: 'Orders & Receipts', hint: 'All orders taken', any: [P.ORDERS_VIEW] },
  // Printer setup lives inside Take Orders / Orders & Receipts (a "Printer" button), so it is not a sidebar heading.
  // The page itself still exists for old links and the "Connect one" link on the receipt page.
  { href: '/printer', label: 'Receipt Printer', hint: 'Connect your thermal printer', any: [P.RECEIPTS_PRINT], menu: false },
  { href: '/products', label: 'Menu & Prices', hint: 'What you sell', any: [P.PRODUCTS_VIEW] },
  { href: '/categories', label: 'Menu Sections', hint: 'Juices, shakes, coffee…', any: [P.CATEGORIES_VIEW] },
  { href: '/ingredients', label: 'Stock', hint: 'Ingredients, cups, supplies', any: [P.INGREDIENTS_VIEW, P.INVENTORY_VIEW] },
  { href: '/suppliers', label: 'Suppliers', hint: 'Who you buy from', any: [P.SUPPLIERS_VIEW] },
  { href: '/staff', label: 'My Team', hint: 'Managers and staff logins', any: [P.USERS_VIEW] },
  { href: '/settings', label: 'Shop Settings', hint: 'Name, phone, receipt', any: [P.SETTINGS_MANAGE] },
];

/** First finished page this user may open: used after login and when access is denied. */
const LANDING_PRIORITY = ['/', '/pos', '/orders', '/ingredients', '/products', '/categories', '/suppliers', '/staff', '/settings'];
export function homeFor(held) {
  for (const href of LANDING_PRIORITY) {
    const route = ROUTE_ACCESS.find((r) => r.href === href);
    if (route && hasPermission(held, route.any)) return href;
  }
  return '/account'; // every signed-in user can open their account page
}
