import {
  createDraft,
  formatTime,
  generatedName,
  GONGS,
  presetMetadata,
  THEMES,
  totalMinutes,
  validatePreset,
} from './domain.js';
import { loadState, saveState } from './storage.js';
import { TimerEngine } from './timer-engine.js';

const $ = (selector) => document.querySelector(selector);
const state = loadState();
const timer = new TimerEngine();
let managing = false;
let draft = null;
let draftOriginal = '';
let editingId = null;
let wakeLock = null;
let pendingConfirmation = null;
let toastTimeout = null;

const elements = {
  app: $('#app'),
  themeButton: $('#themeButton'),
  themePopover: $('#themePopover'),
  themeOptions: $('#themeOptions'),
  title: $('#sessionTitle'),
  timerMode: $('#timerMode'),
  timerValue: $('#timerValue'),
  timerInterval: $('#timerInterval'),
  progress: $('#progressCircle'),
  primaryAction: $('#primaryAction'),
  primaryIcon: $('#primaryIcon'),
  endSession: $('#endSession'),
  presetList: $('#presetList'),
  managePresets: $('#managePresets'),
  addPreset: $('#addPreset'),
  editor: $('#editorSheet'),
  editorForm: $('#editorForm'),
  editorTitle: $('#editorTitle'),
  editorEyebrow: $('#editorEyebrow'),
  closeEditor: $('#closeEditor'),
  presetName: $('#presetName'),
  startEndGong: $('#startEndGong'),
  intervalGong: $('#intervalGong'),
  editorTotal: $('#editorTotal'),
  editorError: $('#editorError'),
  intervalList: $('#intervalList'),
  addInterval: $('#addInterval'),
  confirm: $('#confirmDialog'),
  confirmTitle: $('#confirmTitle'),
  confirmMessage: $('#confirmMessage'),
  confirmAccept: $('#confirmAccept'),
  confirmCancel: $('#confirmCancel'),
  toast: $('#toast'),
};

function selectedPreset() {
  return state.presets.find((preset) => preset.id === state.selectedId) ?? state.presets[0] ?? null;
}

function applyTheme(theme) {
  state.theme = theme;
  document.body.dataset.theme = theme;
  const colors = { green: '#59E5B5', light: '#F5F5F2', dark: '#121212' };
  $('meta[name="theme-color"]').content = colors[theme];
  saveState(state);
  renderThemes();
}

function render() {
  const preset = timer.preset ?? selectedPreset();
  const active = ['running', 'paused', 'completed'].includes(timer.state);
  elements.app.classList.toggle('active', active);
  elements.endSession.disabled = !active;
  elements.title.textContent = preset?.name ?? 'Choose a preset';
  elements.timerMode.textContent = timer.state === 'paused'
    ? 'PAUSED'
    : preset?.mode === 'countUp' ? 'COUNT UP' : timer.state === 'completed' ? 'COMPLETE' : 'COUNTDOWN';
  const idleSeconds = preset ? totalMinutes(preset) * 60 : 0;
  elements.timerValue.textContent = formatTime(active ? timer.displayedSeconds : idleSeconds);
  const count = preset?.intervals.length ?? 0;
  elements.timerInterval.textContent = `${count} ${count === 1 ? 'interval' : 'intervals'}`;

  let visualProgress = preset?.mode === 'countUp' ? 0 : 1;
  if (active) visualProgress = preset.mode === 'countUp' ? timer.progress : 1 - timer.progress;
  elements.progress.style.strokeDashoffset = String(829.38 * (1 - visualProgress));

  const running = timer.state === 'running';
  elements.primaryIcon.src = running ? './assets/timer_pause_icon.svg' : './assets/timer_start_icon.svg';
  elements.primaryAction.ariaLabel = running ? 'Pause session' : timer.state === 'paused' ? 'Resume session' : 'Start session';
  elements.primaryAction.disabled = timer.state === 'completed' || !preset;
  renderPresets();
}

function renderPresets() {
  elements.managePresets.textContent = managing ? 'DONE' : 'EDIT';
  elements.managePresets.disabled = !state.presets.length || timer.state !== 'idle';
  elements.addPreset.disabled = timer.state !== 'idle';
  elements.presetList.replaceChildren();

  for (const [index, preset] of state.presets.entries()) {
    const row = document.createElement(managing ? 'div' : 'button');
    row.className = `preset-row${preset.id === state.selectedId ? ' active' : ''}`;
    if (!managing) {
      row.type = 'button';
      row.addEventListener('click', () => {
        if (timer.state !== 'idle') return;
        state.selectedId = preset.id;
        saveState(state);
        render();
      });
    }
    row.innerHTML = `
      <span class="preset-dot" aria-hidden="true"></span>
      <span class="preset-copy"><strong>${escapeHtml(preset.name)}</strong><small>${escapeHtml(presetMetadata(preset))}</small></span>
      ${managing ? '<span class="manage-row"></span>' : `<span class="preset-time">${formatTime(totalMinutes(preset) * 60)}</span>`}
    `;
    if (managing) {
      const actions = row.querySelector('.manage-row');
      actions.append(
        actionButton('↑', 'Move preset up', () => movePreset(index, -1), index === 0),
        actionButton('↓', 'Move preset down', () => movePreset(index, 1), index === state.presets.length - 1),
        actionButton('✎', 'Edit preset', () => openEditor(preset)),
        actionButton('×', 'Delete preset', () => deletePreset(preset)),
      );
    }
    elements.presetList.append(row);
  }
}

function actionButton(text, label, action, disabled = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  button.ariaLabel = label;
  button.disabled = disabled;
  button.addEventListener('click', action);
  return button;
}

function movePreset(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= state.presets.length) return;
  const [preset] = state.presets.splice(index, 1);
  state.presets.splice(target, 0, preset);
  saveState(state);
  renderPresets();
}

function deletePreset(preset) {
  askConfirmation('Delete preset?', `${preset.name} will be removed from this device.`, 'Delete', () => {
    const index = state.presets.findIndex((item) => item.id === preset.id);
    state.presets.splice(index, 1);
    if (state.selectedId === preset.id) {
      state.selectedId = state.presets[Math.min(index, state.presets.length - 1)]?.id ?? null;
    }
    saveState(state);
    render();
    showToast('Preset deleted.');
  });
}

function renderThemes() {
  elements.themeOptions.replaceChildren();
  const labels = { green: 'Green', dark: 'Dark', light: 'Light' };
  const colors = { green: '#59E5B5', dark: '#121212', light: '#F5F5F2' };
  for (const theme of THEMES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `theme-option${theme === state.theme ? ' active' : ''}`;
    button.innerHTML = `<span class="theme-swatch" style="background:${colors[theme]}"></span><strong>${labels[theme]}</strong><span class="selected-mark">${theme === state.theme ? '✓' : ''}</span>`;
    button.addEventListener('click', () => {
      applyTheme(theme);
      closeThemePopover();
    });
    elements.themeOptions.append(button);
  }
}

function closeThemePopover() {
  elements.themePopover.hidden = true;
  elements.themeButton.ariaExpanded = 'false';
}

async function primaryAction() {
  const preset = selectedPreset();
  if (!preset) return;
  if (timer.state === 'running') {
    timer.pause();
    return;
  }
  if (timer.state === 'paused') {
    timer.resume();
    await requestWakeLock();
    return;
  }
  await playGong(preset.startEndGong);
  timer.start(preset);
  await requestWakeLock();
}

async function playGong(id) {
  const gong = GONGS.find((item) => item.id === id);
  if (!gong?.file) return;
  try {
    const audio = new Audio(gong.file);
    audio.preload = 'auto';
    await audio.play();
  } catch {
    showToast('Sound is unavailable. Check silent mode and media volume.');
  }
}

async function requestWakeLock() {
  try {
    wakeLock = await navigator.wakeLock?.request('screen');
  } catch {
    showToast('Keep the screen awake for the most reliable timer.');
  }
}

async function releaseWakeLock() {
  try { await wakeLock?.release(); } catch { /* already released */ }
  wakeLock = null;
}

function openEditor(preset = null) {
  editingId = preset?.id ?? null;
  draft = createDraft(preset);
  draftOriginal = JSON.stringify(draft);
  elements.editorTitle.textContent = preset ? 'Edit preset' : 'New preset';
  elements.editorEyebrow.textContent = preset ? 'PRESET SETTINGS' : 'NEW PRESET';
  elements.presetName.value = draft.name;
  elements.editor.querySelector(`[name="mode"][value="${draft.mode}"]`).checked = true;
  populateGongSelect(elements.startEndGong, draft.startEndGong);
  populateGongSelect(elements.intervalGong, draft.intervalGong);
  renderEditor();
  elements.editor.hidden = false;
  elements.presetName.focus();
}

function populateGongSelect(select, selected) {
  select.replaceChildren(...GONGS.map((gong) => {
    const option = document.createElement('option');
    option.value = gong.id;
    option.textContent = `${gong.label} — ${gong.description}`;
    option.selected = gong.id === selected;
    return option;
  }));
}

function renderEditor() {
  elements.editorTotal.textContent = `${totalMinutes(draft)} min`;
  elements.intervalList.replaceChildren();
  draft.intervals.forEach((minutes, index) => {
    const row = document.createElement('div');
    row.className = 'interval-row';
    row.innerHTML = `
      <label>Interval ${String(index + 1).padStart(2, '0')}<input type="number" min="1" max="1440" step="1" inputmode="numeric" value="${minutes}" aria-label="Interval ${index + 1} minutes"></label>
      <button class="remove-interval" type="button" aria-label="Remove interval" ${draft.intervals.length === 1 ? 'disabled' : ''}>×</button>
    `;
    row.querySelector('input').addEventListener('input', (event) => {
      draft.intervals[index] = Number(event.target.value);
      elements.editorTotal.textContent = `${totalMinutes(draft)} min`;
      elements.editorError.hidden = true;
    });
    row.querySelector('button').addEventListener('click', () => {
      draft.intervals.splice(index, 1);
      renderEditor();
    });
    elements.intervalList.append(row);
  });
}

function closeEditor(force = false) {
  if (!draft) return;
  syncDraftFields();
  if (!force && JSON.stringify(draft) !== draftOriginal) {
    askConfirmation('Discard changes?', 'Your preset changes have not been saved.', 'Discard', () => closeEditor(true));
    return;
  }
  document.activeElement?.blur();
  elements.editor.hidden = true;
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  draft = null;
  editingId = null;
}

function syncDraftFields() {
  draft.name = elements.presetName.value.trim();
  draft.mode = elements.editor.querySelector('[name="mode"]:checked').value;
  draft.startEndGong = elements.startEndGong.value;
  draft.intervalGong = elements.intervalGong.value;
}

function saveDraft(event) {
  event.preventDefault();
  syncDraftFields();
  const errors = validatePreset(draft);
  if (Object.keys(errors).length) {
    elements.editorError.textContent = errors.total ?? errors[Object.keys(errors)[0]];
    elements.editorError.hidden = false;
    return;
  }
  draft.intervals = draft.intervals.map(Number);
  if (!draft.name) draft.name = generatedName(totalMinutes(draft), state.presets, editingId);
  const existing = state.presets.findIndex((preset) => preset.id === editingId);
  if (existing >= 0) state.presets[existing] = structuredClone(draft);
  else state.presets.push(structuredClone(draft));
  state.selectedId = draft.id;
  saveState(state);
  closeEditor(true);
  render();
  requestAnimationFrame(() => elements.presetList.querySelector('.active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
}

function askConfirmation(title, message, acceptLabel, action) {
  pendingConfirmation = action;
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmAccept.textContent = acceptLabel;
  elements.confirm.hidden = false;
  elements.confirmAccept.focus();
}

function closeConfirmation() {
  pendingConfirmation = null;
  elements.confirm.hidden = true;
}

function showToast(message) {
  clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimeout = setTimeout(() => { elements.toast.hidden = true; }, 4200);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

elements.themeButton.addEventListener('click', () => {
  elements.themePopover.hidden = !elements.themePopover.hidden;
  elements.themeButton.ariaExpanded = String(!elements.themePopover.hidden);
});
document.addEventListener('pointerdown', (event) => {
  if (!elements.themePopover.hidden && !elements.themePopover.contains(event.target) && !elements.themeButton.contains(event.target)) closeThemePopover();
});
elements.primaryAction.addEventListener('click', primaryAction);
elements.endSession.addEventListener('click', () => askConfirmation(
  'End meditation?',
  'This session will stop and will not be saved to history in the MVP.',
  'End session',
  async () => { timer.reset(); await releaseWakeLock(); },
));
elements.managePresets.addEventListener('click', () => { managing = !managing; renderPresets(); });
elements.addPreset.addEventListener('click', () => openEditor());
elements.closeEditor.addEventListener('click', () => closeEditor());
elements.editorForm.addEventListener('submit', saveDraft);
elements.addInterval.addEventListener('click', () => { draft.intervals.push(10); renderEditor(); });
elements.startEndGong.addEventListener('change', (event) => { draft.startEndGong = event.target.value; });
elements.intervalGong.addEventListener('change', (event) => { draft.intervalGong = event.target.value; });
elements.editor.querySelectorAll('[name="mode"]').forEach((radio) => radio.addEventListener('change', (event) => { draft.mode = event.target.value; }));
elements.editor.querySelectorAll('.preview-sound').forEach((button) => button.addEventListener('click', () => playGong(
  button.dataset.preview === 'start' ? elements.startEndGong.value : elements.intervalGong.value,
)));
elements.confirmCancel.addEventListener('click', closeConfirmation);
elements.confirmAccept.addEventListener('click', () => {
  const action = pendingConfirmation;
  closeConfirmation();
  action?.();
});
timer.addEventListener('change', render);
timer.addEventListener('interval', () => playGong(timer.preset.intervalGong));
timer.addEventListener('complete', async () => {
  await playGong(timer.preset.startEndGong);
  await releaseWakeLock();
  showToast('Session complete.');
});
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    timer.synchronize();
    if (timer.state === 'running') await requestWakeLock();
  }
});
window.addEventListener('beforeunload', (event) => {
  if (draft && JSON.stringify(draft) !== draftOriginal) {
    event.preventDefault();
    event.returnValue = '';
  }
});

applyTheme(state.theme);
render();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
