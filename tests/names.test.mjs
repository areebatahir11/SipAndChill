import test from 'node:test';
import assert from 'node:assert/strict';
import { businessNameKey } from '../src/lib/platform/names.mjs';

test('the same name written differently gets the same key', () => {
  const k = businessNameKey('Sip & Chill');
  assert.equal(k, 'sipandchill');
  for (const v of ['Sip And Chill', ' sip   and   chill ', 'SIP-AND-CHILL!', 'sip&chill', 'Sip & Chill.']) assert.equal(businessNameKey(v), k, v);
});

test('different names get different keys', () => {
  assert.notEqual(businessNameKey('Sip & Chill'), businessNameKey('Sip & Chill DHA'));
  assert.notEqual(businessNameKey('Juice Hub'), businessNameKey('Juice Hut'));
});

test('accents are ignored and non-Latin names still get a key', () => {
  assert.equal(businessNameKey('Café Noir'), businessNameKey('cafe noir'));
  assert.ok(businessNameKey('جوس کارنر').length > 0);
  assert.notEqual(businessNameKey('جوس کارنر'), businessNameKey('کافی ہاؤس'));
});

test('a name without letters or digits has an empty key (refused by the server)', () => {
  assert.equal(businessNameKey('!!'), '');
  assert.equal(businessNameKey('  - & -  '), 'and'); // "&" counts as a word, so this is not empty; real names are 2+ chars and checked in assertBusinessNameFree
  assert.equal(businessNameKey(null), '');
});
