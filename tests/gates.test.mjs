import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gateError, requiredStep } from '../src/lib/auth/gates.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const PASSWORD = { allowPasswordChange: true };
const TERMS = { allowTerms: true };

test('an owner added by PearlSolutions (temporary password AND terms pending) is not stuck: password first, then terms', () => {
  const fresh = { mustChangePassword: true, termsRequired: true };
  assert.equal(requiredStep(fresh), 'password');
  assert.equal(gateError(fresh, PASSWORD), null, 'the change-password API must work (this was the bug: it said "accept the Terms first")');
  const afterPassword = { mustChangePassword: false, termsRequired: true };
  assert.equal(requiredStep(afterPassword), 'terms');
  assert.equal(gateError(afterPassword, TERMS), null);
  assert.equal(requiredStep({ mustChangePassword: false, termsRequired: false }), null);
});

test('while a step is pending, nothing else is open', () => {
  const fresh = { mustChangePassword: true, termsRequired: true };
  assert.equal(gateError(fresh)[0], 'PASSWORD_CHANGE_REQUIRED'); // any normal API
  assert.equal(gateError(fresh, TERMS)[0], 'PASSWORD_CHANGE_REQUIRED'); // cannot accept terms before choosing a password
  const afterPassword = { mustChangePassword: false, termsRequired: true };
  assert.equal(gateError(afterPassword)[0], 'TERMS_REQUIRED');
  assert.equal(gateError(afterPassword, PASSWORD)[0], 'TERMS_REQUIRED');
});

test('self-signup owner (no temporary password) and ordinary users are unaffected', () => {
  assert.equal(gateError({ mustChangePassword: false, termsRequired: true }, TERMS), null);
  assert.equal(gateError({ mustChangePassword: true, termsRequired: false }, PASSWORD), null);
  assert.equal(gateError({ mustChangePassword: false, termsRequired: false }), null);
});

test('the screen and the API use the same ordering', () => {
  assert.match(read('src/lib/auth/guard.js'), /gateError\(auth, \{ allowPasswordChange, allowTerms \}\)/);
  const layout = read('src/app/(dashboard)/layout.js');
  assert.match(layout, /requiredStep\(\{ mustChangePassword, termsRequired \}\)/);
  assert.match(layout, /step === 'password'[\s\S]*step === 'terms'/);
  assert.match(read('src/app/api/auth/password/route.js'), /allowPasswordChange: true/);
  assert.match(read('src/app/api/terms/accept/route.js'), /allowTerms: true/);
});
