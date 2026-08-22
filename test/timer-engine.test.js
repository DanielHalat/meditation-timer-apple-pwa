import assert from 'node:assert/strict';
import test from 'node:test';

import { TimerEngine } from '../src/timer-engine.js';

test('natural completion emits the preset and immediately returns to idle', () => {
  let now = 0;
  const timer = new TimerEngine(() => now);
  const preset = {
    id: 'completion-test',
    name: 'Completion test',
    intervals: [1],
    mode: 'countdown',
    startEndGong: 'gong1',
    intervalGong: 'none',
  };
  let completedPreset = null;
  timer.addEventListener('complete', (event) => {
    completedPreset = event.detail.preset;
  });

  timer.start(preset);
  now = 60000;
  timer.synchronize();

  assert.equal(completedPreset.startEndGong, 'gong1');
  assert.equal(timer.state, 'idle');
  assert.equal(timer.preset, null);
  assert.equal(timer.durationMs, 0);
});

test('interval boundaries emit once and count-up progress covers the whole session', () => {
  let now = 0;
  const timer = new TimerEngine(() => now);
  const preset = {
    id: 'interval-test',
    name: 'Interval test',
    intervals: [1, 2],
    mode: 'countUp',
    startEndGong: 'gong1',
    intervalGong: 'gong2',
  };
  let boundaries = 0;
  timer.addEventListener('interval', () => { boundaries += 1; });

  timer.start(preset);
  now = 60000;
  timer.synchronize();
  timer.synchronize();

  assert.equal(boundaries, 1);
  assert.equal(timer.displayedSeconds, 60);
  assert.equal(timer.progress, 1 / 3);
  timer.reset();
});
