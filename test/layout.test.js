import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
const serviceWorker = await readFile(new URL('../src/sw.js', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
const appJs = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');
const dragHandle = await readFile(new URL('../src/assets/icons/drag_handle.svg', import.meta.url), 'utf8');

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

test('the service worker and package metadata publish version 9 without showing it in settings', () => {
  assert.match(serviceWorker, /meditation-timer-pwa-v9/);
  assert.match(indexHtml, /application-version" content="v9/);
  assert.doesNotMatch(indexHtml, /Build v9/);
  assert.match(indexHtml, /styles\.css\?v=9/);
  assert.match(indexHtml, /app\.js\?v=9/);
  assert.match(serviceWorker, /domain\.js\?v=9/);
  assert.match(serviceWorker, /storage\.js\?v=9/);
  assert.match(serviceWorker, /timer-engine\.js\?v=9/);
  assert.match(serviceWorker, /viewport\.js\?v=9/);
  assert.match(appJs, /domain\.js\?v=9/);
  assert.match(appJs, /storage\.js\?v=9/);
  assert.match(appJs, /timer-engine\.js\?v=9/);
  assert.match(appJs, /viewport\.js\?v=9/);
});

test('settings and preset management use the current Figma contract', () => {
  const settings = rule('.settings-sheet');
  const editRow = rule('.preset-row.edit-mode');

  assert.match(settings, /height:\s*268px/);
  assert.match(settings, /border-radius:\s*0 0 24px 24px/);
  assert.match(editRow, /height:\s*49px/);
  assert.match(indexHtml, /aria-label="Open settings"/);
  assert.match(indexHtml, /CHOOSE COLOR/);
  assert.doesNotMatch(indexHtml, /APPEARANCE|Choose a visual profile|brush_icon/);
  assert.doesNotMatch(indexHtml, /class="ambient|editor-ambient/);
  assert.match(css, /\.trash-icon[^}]*assets\/icons\/trash\.svg/s);
  assert.doesNotMatch(appJs, /actionButton\('↑'|actionButton\('↓'|actionButton\('✎'|actionButton\('×'/);
});

test('preset editor follows the synchronized Figma behavior contract', () => {
  assert.match(indexHtml, />Create a preset<\/h2>/);
  assert.doesNotMatch(indexHtml, /editor-back|id="closeEditor"|aria-label="Go back"/);
  assert.match(appJs, /type="text" inputmode="numeric" pattern="\[0-9\]\*"/);
  assert.match(appJs, /function bindPressAndHold/);
  assert.match(appJs, /Interval removed/);
  assert.match(appJs, /We couldn’t save this preset\. Try again\./);
  assert.match(appJs, /Saving…/);
  assert.match(css, /\.gong-picker\.start-end-picker \.gong-sheet[^}]*482px/);
});

test('empty and End session states use the approved copy and safe confirmation', () => {
  assert.match(appJs, /NO PRESETS YET/);
  assert.match(appJs, /Create your first preset/);
  assert.match(appJs, /Add a preset to begin/);
  assert.match(appJs, /Your current session will end\. The end gong will not play\./);
  assert.match(appJs, /'END SESSION'/);
  assert.match(appJs, /elements\.confirmCancel\.focus\(\)/);
  assert.match(appJs, /timer\.addEventListener\('complete',[\s\S]*playGong\(event\.detail\.preset\.startEndGong\)/);
  assert.doesNotMatch(appJs, /Session complete\./);
});

test('preset and interval reordering share one complete six-dot asset', () => {
  assert.equal((dragHandle.match(/<circle/g) ?? []).length, 6);
  assert.match(css, /\.drag-icon[^}]*assets\/icons\/drag_handle\.svg/s);
  assert.doesNotMatch(appJs, /preset-editor\/drag_handle\.svg/);
  assert.doesNotMatch(serviceWorker, /preset-editor\/drag_handle\.svg/);
});

test('edit mode keeps presets selectable and closes after leaving the editor', () => {
  assert.match(appJs, /class="select-preset"/);
  assert.match(appJs, /querySelector\('\.select-preset'\)\.addEventListener\('click', \(\) => selectPreset\(preset\)\)/);
  assert.match(appJs, /function closeEditor[\s\S]*managing = false;[\s\S]*render\(\);/);
});

test('desktop layout exposes Figma-sized timer, settings, rows, and dialog', () => {
  assert.match(css, /@media \(min-width:\s*1200px\)/);
  assert.match(css, /\.timer-dial\s*\{[^}]*width:\s*476px[^}]*height:\s*476px/s);
  assert.match(css, /\.settings-sheet\s*\{[^}]*width:\s*520px[^}]*height:\s*268px/s);
  assert.match(css, /\.preset-row\.edit-mode\s*\{[^}]*width:\s*400px[^}]*height:\s*82px/s);
  assert.match(css, /\.confirm-card\s*\{[^}]*width:\s*420px/s);
});

test('all seven approved Figma palettes expose their canvas and timer colors', () => {
  const expected = {
    verdant: ['#7ed6a7', '#a6e7c2', '#8ad9af', '#276a4a'],
    solar: ['#ffd54f', '#ffe78a', '#f4c937', '#815f00'],
    cobalt: ['#536bda', '#6f84e4', '#6178df', '#fff'],
    ember: ['#f06a67', '#ff9690', '#e75a5b', '#8c202c'],
    azure: ['#68cbe7', '#98e3f3', '#76d5ea', '#08768f'],
    lavender: ['#b7a4e8', '#d1c5f4', '#aa96e0', '#6046a8'],
    coral: ['#f49a7b', '#ffc3ae', '#ec896d', '#9a3e2b'],
  };

  for (const [theme, colors] of Object.entries(expected)) {
    const escaped = `body[data-theme='${theme}']`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const themeRules = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g'))];
    const themeRule = themeRules.find((match) => match[1].includes('--canvas:'))?.[1];
    assert.ok(themeRule, `Missing palette rule for ${theme}`);
    for (const color of colors) assert.match(themeRule, new RegExp(color));
  }
  assert.match(css, /\.timer-mode, \.timer-value, \.timer-interval\s*\{[^}]*color:\s*var\(--timer-ink/s);
  assert.doesNotMatch(css, /data-theme='modern'/);
});
