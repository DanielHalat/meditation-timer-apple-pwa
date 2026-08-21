import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStandaloneBottomCompensation } from '../src/viewport.js';

test('standalone compensation fills the iOS 27 system-owned viewport gap', () => {
  assert.equal(calculateStandaloneBottomCompensation(874, 812, 0), 62);
});

test('standalone compensation does not duplicate a correctly reported safe area', () => {
  assert.equal(calculateStandaloneBottomCompensation(844, 763, 47), 34);
  assert.equal(calculateStandaloneBottomCompensation(844, 844, 47), 0);
});

test('standalone compensation is bounded against keyboard-sized viewport changes', () => {
  assert.equal(calculateStandaloneBottomCompensation(844, 400, 47), 96);
  assert.equal(calculateStandaloneBottomCompensation('invalid', 812, 0), 0);
});
