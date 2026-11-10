import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERMISSIONS as P, ROLE_DEFAULTS, ROLE_CODES } from '../src/lib/permissions/codes.mjs';
import { businessNameKey } from '../src/lib/platform/names.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('only the Business Owner can open or change Shop Settings (so only the owner can rename the business)', () => {
  for (const [role, def] of Object.entries(ROLE_DEFAULTS)) {
    assert.equal(def.permissions.includes(P.SETTINGS_MANAGE), role === ROLE_CODES.OWNER, role);
  }
  const route = read('src/app/api/settings/route.js');
  assert.equal((route.match(/requireApi\(request, P\.SETTINGS_MANAGE\)/g) ?? []).length, 2); // both reading and saving
});

test('renaming from Shop Settings uses the same unique-name rule as PearlSolutions, and keeps the comparison key in step', () => {
  const svc = read('src/modules/settings/service.js');
  assert.match(svc, /assertBusinessNameFree\(businessName, \{ exceptTenantId: auth\.tenantId \}\)/);
  assert.match(svc, /nameKey: await assertBusinessNameFree/); // name and nameKey are saved together, never one without the other
  assert.match(svc, /renamedFrom: current\.name/); // the audit log keeps old and new name
  assert.doesNotMatch(svc, /slug:/); // the permanent identity (slug) is never written
  assert.match(svc, /isUniqueViolation/); // two simultaneous renames cannot both win
});

test('what counts as "the same name"', () => {
  assert.equal(businessNameKey('Sip & Chill'), businessNameKey('sip-and-chill!'));
  assert.notEqual(businessNameKey('Sip & Chill'), businessNameKey('Sip & Chill DHA'));
});
