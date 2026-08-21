import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../src/sw.js', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
const appJs = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

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

  assert.match(presetList, /padding:[^;]*--safe-area-bottom/);
  assert.match(presetList, /padding:[^;]*--standalone-bottom-compensation/);
});

test('the service worker and visible build marker publish version 5', () => {
  assert.match(serviceWorker, /meditation-timer-pwa-v5/);
  assert.match(indexHtml, /Build v5/);
  assert.match(indexHtml, /styles\.css\?v=5/);
  assert.match(indexHtml, /app\.js\?v=5/);
  assert.match(serviceWorker, /domain\.js\?v=5/);
  assert.match(serviceWorker, /storage\.js\?v=5/);
  assert.match(serviceWorker, /timer-engine\.js\?v=5/);
  assert.match(serviceWorker, /viewport\.js\?v=5/);
  assert.match(appJs, /domain\.js\?v=5/);
  assert.match(appJs, /storage\.js\?v=5/);
  assert.match(appJs, /timer-engine\.js\?v=5/);
  assert.match(appJs, /viewport\.js\?v=5/);
});

test('the Modern theme uses the ZEN-inspired palette without changing layout rules', () => {
  const modern = rule("body[data-theme='modern']");

  assert.match(modern, /--canvas:\s*#fafaf8/);
  assert.match(modern, /--ink:\s*#0a0a0a/);
  assert.match(modern, /--progress:\s*#22e243/);
  assert.match(modern, /--active:\s*#222/);
});
