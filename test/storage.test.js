import assert from 'node:assert/strict';
import test from 'node:test';

import { loadState, saveState } from '../src/storage.js';

function withStoredState(stored, callback) {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() {
      return JSON.stringify(stored);
    },
  };

  try {
    callback();
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
}

test('legacy Green migrates to Verdant Green', () => {
  withStoredState({ theme: 'green', presets: [], selectedId: null }, () => {
    assert.equal(loadState().theme, 'verdant');
  });
});

test('legacy Modern migrates to Light', () => {
  withStoredState({ theme: 'modern', presets: [], selectedId: null }, () => {
    assert.equal(loadState().theme, 'light');
  });
});

test('a local persistence failure is reported without throwing', () => {
  const previousStorage = globalThis.localStorage;
  globalThis.localStorage = {
    setItem() {
      throw new Error('Quota exceeded');
    },
  };

  try {
    assert.equal(saveState({ theme: 'green', presets: [], selectedId: null }), false);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});
