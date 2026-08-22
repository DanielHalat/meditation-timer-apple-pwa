import assert from 'node:assert/strict';
import test from 'node:test';

import { saveState } from '../src/storage.js';

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
