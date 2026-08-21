import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../src/sw.js', import.meta.url), 'utf8');

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Missing CSS rule for ${selector}`);
  return match[1];
}

test('the installed app fills the viewport behind the iOS home indicator area', () => {
  const app = rule('.app');

  assert.match(app, /height:\s*100lvh\s*;/);
});

test('the preset viewport is clipped only at the physical bottom edge', () => {
  const presetsSection = rule('.presets-section');

  assert.match(presetsSection, /bottom:\s*0\s*;/);
  assert.doesNotMatch(presetsSection, /bottom:\s*env\(safe-area-inset-bottom/);
});

test('the safe area remains scrollable end padding rather than a fixed bar', () => {
  const presetList = rule('.preset-list');

  assert.match(presetList, /padding:[^;]*env\(safe-area-inset-bottom/);
});

test('the service worker cache version publishes the viewport correction', () => {
  assert.match(serviceWorker, /meditation-timer-pwa-v4/);
});
