import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPresets, formatTime, generatedName, totalMinutes, validatePreset } from '../src/domain.js';

test('starter presets match the MVP', () => {
  const presets = defaultPresets();
  assert.deepEqual(presets.map(totalMinutes), [15, 30, 45, 60]);
  assert.equal(presets[1].startEndGong, 'gong1');
  assert.equal(presets[1].intervalGong, 'gong2');
});

test('time formatting supports sessions longer than one hour', () => {
  assert.equal(formatTime(30 * 60), '30:00');
  assert.equal(formatTime(90 * 60 + 5), '01:30:05');
});

test('preset validation enforces integer and total limits', () => {
  assert.deepEqual(validatePreset({ intervals: [10, 20] }), {});
  assert.ok(validatePreset({ intervals: [0] })[0]);
  assert.ok(validatePreset({ intervals: [1000, 500] }).total);
});

test('generated names stay unique', () => {
  const presets = [{ id: '1', name: 'Meditation 10 min' }, { id: '2', name: 'Meditation 10 min (2)' }];
  assert.equal(generatedName(10, presets), 'Meditation 10 min (3)');
});
