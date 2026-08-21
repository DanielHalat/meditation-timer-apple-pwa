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

test('the service worker and package metadata publish version 6 without showing it in settings', () => {
  assert.match(serviceWorker, /meditation-timer-pwa-v6/);
  assert.match(indexHtml, /application-version" content="v6/);
  assert.doesNotMatch(indexHtml, /Build v6/);
  assert.match(indexHtml, /styles\.css\?v=6/);
  assert.match(indexHtml, /app\.js\?v=6/);
  assert.match(serviceWorker, /domain\.js\?v=6/);
  assert.match(serviceWorker, /storage\.js\?v=6/);
  assert.match(serviceWorker, /timer-engine\.js\?v=6/);
  assert.match(serviceWorker, /viewport\.js\?v=6/);
  assert.match(appJs, /domain\.js\?v=6/);
  assert.match(appJs, /storage\.js\?v=6/);
  assert.match(appJs, /timer-engine\.js\?v=6/);
  assert.match(appJs, /viewport\.js\?v=6/);
});

test('settings and preset management use the current Figma contract', () => {
  const settings = rule('.settings-sheet');
  const editRow = rule('.preset-row.edit-mode');

  assert.match(settings, /height:\s*206px/);
  assert.match(settings, /border-radius:\s*0 0 24px 24px/);
  assert.match(editRow, /height:\s*49px/);
  assert.match(indexHtml, /aria-label="Open settings"/);
  assert.match(indexHtml, /CHOOSE COLOR/);
  assert.doesNotMatch(indexHtml, /APPEARANCE|Choose a visual profile|brush_icon/);
  assert.doesNotMatch(indexHtml, /class="ambient|editor-ambient/);
  assert.match(appJs, /assets\/icons\/trash\.svg/);
  assert.doesNotMatch(appJs, /actionButton\('↑'|actionButton\('↓'|actionButton\('✎'|actionButton\('×'/);
});

test('desktop layout exposes Figma-sized timer, settings, rows, and dialog', () => {
  assert.match(css, /@media \(min-width:\s*1200px\)/);
  assert.match(css, /\.timer-dial\s*\{[^}]*width:\s*476px[^}]*height:\s*476px/s);
  assert.match(css, /\.settings-sheet\s*\{[^}]*width:\s*520px[^}]*height:\s*196px/s);
  assert.match(css, /\.preset-row\.edit-mode\s*\{[^}]*width:\s*400px[^}]*height:\s*82px/s);
  assert.match(css, /\.confirm-card\s*\{[^}]*width:\s*420px/s);
});

test('the Modern theme uses the ZEN-inspired palette without changing layout rules', () => {
  const modern = rule("body[data-theme='modern']");

  assert.match(modern, /--canvas:\s*#fafaf8/);
  assert.match(modern, /--ink:\s*#0a0a0a/);
  assert.match(modern, /--progress:\s*#22e243/);
  assert.match(modern, /--active:\s*#222/);
});
