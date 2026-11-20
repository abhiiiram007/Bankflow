import test from 'node:test';
import assert from 'node:assert/strict';
import { rupeesToPaise, paiseToRupees } from '../src/utils/money.js';

test('converts rupees to integer paise without floating point storage', () => {
  assert.equal(rupeesToPaise(12.34), 1234n);
  assert.equal(paiseToRupees(1234), '12.34');
});

test('rejects zero and negative amounts', () => {
  assert.throws(() => rupeesToPaise(0));
  assert.throws(() => rupeesToPaise(-1));
});
