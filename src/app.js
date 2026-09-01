import {
  createDraft,
  formatTime,
  generatedName,
  GONGS,
  presetMetadata,
  selectedIdAfterDeletion,
  THEMES,
  totalMinutes,
  validatePreset,
} from './domain.js?v=9';
import { loadState, saveState } from './storage.js?v=9';
import { TimerEngine } from './timer-engine.js?v=9';
import { installStandaloneViewportCompensation } from './viewport.js?v=9';

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
let editorFeedbackTimeout = null;
let removedInterval = null;
let intervalErrors = {};
let savingDraft = false;
let activeGongKind = null;
let intervalDrag = null;
let presetDrag = null;
const historyOverlays = [];
let suppressedPopstates = 0;
const gongPlayers = new Map();

const elements = {
  app: $('#app'),
  themeButton: $('#themeButton'),
  themePopover: $('#themePopover'),
  themeOptions: $('#themeOptions'),
  sessionLabel: $('#sessionLabel'),
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
  cancelEditor: $('#cancelEditor'),
  presetName: $('#presetName'),
  startEndGongLabel: $('#startEndGongLabel'),
  intervalGongLabel: $('#intervalGongLabel'),
  startEndSoundField: $('#startEndSoundField'),
  intervalSoundField: $('#intervalSoundField'),
  sequenceLabel: $('#sequenceLabel'),
  editorTotal: $('#editorTotal'),
  editorError: $('#editorError'),
  editorFeedback: $('#editorFeedback'),
  editorFeedbackMessage: $('#editorFeedbackMessage'),
  editorFeedbackAction: $('#editorFeedbackAction'),
  intervalList: $('#intervalList'),
  addInterval: $('#addInterval'),
  savePreset: $('#savePreset'),
  gongPicker: $('#gongPicker'),
  gongScrim: $('#gongScrim'),
  gongDone: $('#gongDone'),
  gongContext: $('#gongContext'),
  gongNote: $('#gongNote'),
  gongOptions: $('#gongOptions'),
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
  const colors = {
    light: '#F5F5F2',
    dark: '#121212',
    verdant: '#7ED6A7',
    solar: '#FFD54F',
    cobalt: '#536BDA',
    ember: '#F06A67',
    azure: '#68CBE7',
    lavender: '#B7A4E8',
    coral: '#F49A7B',
  };
  $('meta[name="theme-color"]').content = colors[theme];
  saveState(state);
  renderThemes();
}

function render() {
  elements.app.scrollTop = 0;
  elements.app.scrollLeft = 0;
  const preset = timer.preset ?? selectedPreset();
  const active = ['running', 'paused', 'completed'].includes(timer.state);
  const empty = !preset;
  elements.app.classList.toggle('active', active);
  elements.app.classList.toggle('empty', empty);
  elements.endSession.disabled = !active;
  elements.sessionLabel.textContent = empty ? 'NO PRESETS YET' : 'CURRENT PRESET';
  elements.title.textContent = preset?.name ?? 'Create your first preset';
  elements.timerMode.textContent = empty
    ? 'NO TIMER'
    : timer.state === 'paused'
    ? 'PAUSED'
    : preset?.mode === 'countUp' ? 'COUNT UP' : timer.state === 'completed' ? 'COMPLETE' : 'COUNTDOWN';
  const idleSeconds = preset ? totalMinutes(preset) * 60 : 0;
  elements.timerValue.textContent = empty ? '--:--' : formatTime(active ? timer.displayedSeconds : idleSeconds);
  const count = preset?.intervals.length ?? 0;
  elements.timerInterval.textContent = empty
    ? 'Add a preset to begin'
    : `${count} ${count === 1 ? 'interval' : 'intervals'}`;

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
  elements.app.scrollTop = 0;
  elements.app.scrollLeft = 0;
  if (!state.presets.length) managing = false;
  elements.managePresets.textContent = managing ? 'DONE' : 'EDIT';
  elements.managePresets.hidden = !state.presets.length;
  elements.managePresets.disabled = !state.presets.length || timer.state !== 'idle';
  elements.addPreset.disabled = timer.state !== 'idle';
  elements.presetList.replaceChildren();

  for (const [index, preset] of state.presets.entries()) {
    const row = document.createElement(managing ? 'div' : 'button');
    row.className = `preset-row${managing ? ' edit-mode' : ''}${preset.id === state.selectedId ? ' active' : ''}`;
    row.dataset.presetIndex = String(index);
    if (!managing) {
      row.type = 'button';
      row.addEventListener('click', () => selectPreset(preset));
    }
    if (managing) {
      row.innerHTML = `
        <button class="reorder-preset" type="button" aria-label="Reorder ${escapeHtml(preset.name)}. Move up with Arrow Up; move down with Arrow Down." aria-keyshortcuts="ArrowUp ArrowDown">
          <span class="management-icon drag-icon" aria-hidden="true"></span>
        </button>
        <button class="select-preset" type="button" aria-label="Select ${escapeHtml(preset.name)}">
          <span class="preset-copy"><strong>${escapeHtml(preset.name)}</strong><small>${escapeHtml(presetMetadata(preset))}</small></span>
        </button>
        <button class="edit-preset" type="button" aria-label="Edit preset"><span class="management-icon edit-icon" aria-hidden="true"></span></button>
        <button class="delete-preset" type="button" aria-label="Delete preset"><span class="management-icon trash-icon" aria-hidden="true"></span></button>
      `;
      const handle = row.querySelector('.reorder-preset');
      handle.addEventListener('pointerdown', (event) => beginPresetDrag(event, index));
      handle.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowUp') { event.preventDefault(); movePreset(index, -1, true); }
        if (event.key === 'ArrowDown') { event.preventDefault(); movePreset(index, 1, true); }
      });
      row.querySelector('.select-preset').addEventListener('click', () => selectPreset(preset));
      row.querySelector('.edit-preset').addEventListener('click', () => openEditor(preset));
      row.querySelector('.delete-preset').addEventListener('click', () => deletePreset(preset));
    } else {
      row.innerHTML = `
        <span class="preset-dot" aria-hidden="true"></span>
        <span class="preset-copy"><strong>${escapeHtml(preset.name)}</strong><small>${escapeHtml(presetMetadata(preset))}</small></span>
        <span class="preset-time">${formatTime(totalMinutes(preset) * 60)}</span>
      `;
    }
    elements.presetList.append(row);
  }
}

function selectPreset(preset) {
  if (timer.state !== 'idle') return;
  state.selectedId = preset.id;
  saveState(state);
  render();
}

function movePreset(index, direction, restoreFocus = false) {
  const target = index + direction;
  if (target < 0 || target >= state.presets.length) return;
  const [preset] = state.presets.splice(index, 1);
  state.presets.splice(target, 0, preset);
  saveState(state);
  renderPresets();
  if (restoreFocus) {
    requestAnimationFrame(() => elements.presetList.querySelector(`[data-preset-index="${target}"] .reorder-preset`)?.focus());
  }
}

function beginPresetDrag(event, index) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  presetDrag = { pointerId: event.pointerId, index };
  event.currentTarget.closest('.preset-row')?.classList.add('dragging');
}

function continuePresetDrag(event) {
  if (!presetDrag || event.pointerId !== presetDrag.pointerId) return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.preset-row');
  if (!target || !elements.presetList.contains(target)) return;
  const targetIndex = Number(target.dataset.presetIndex);
  if (targetIndex === presetDrag.index) return;
  const [preset] = state.presets.splice(presetDrag.index, 1);
  state.presets.splice(targetIndex, 0, preset);
  presetDrag.index = targetIndex;
  saveState(state);
  renderPresets();
  elements.presetList.querySelector(`[data-preset-index="${targetIndex}"]`)?.classList.add('dragging');
}

function endPresetDrag(event) {
  if (!presetDrag || event.pointerId !== presetDrag.pointerId) return;
  presetDrag = null;
  elements.presetList.querySelector('.dragging')?.classList.remove('dragging');
}

function deletePreset(preset) {
  askConfirmation('Delete preset?', `“${preset.name}” will be removed from this device.`, 'DELETE', () => {
    const index = state.presets.findIndex((item) => item.id === preset.id);
    state.presets.splice(index, 1);
    if (state.selectedId === preset.id) {
      state.selectedId = selectedIdAfterDeletion(state.presets, index);
    }
    saveState(state);
    render();
    showToast('Preset deleted.');
  }, 'delete');
}

function renderThemes() {
  elements.themeOptions.replaceChildren();
  const labels = {
    light: 'Light',
    dark: 'Dark',
    verdant: 'Verdant Green',
    solar: 'Solar Yellow',
    cobalt: 'Cobalt Blue',
    ember: 'Ember Red',
    azure: 'Azure Blue',
    lavender: 'Digital Lavender',
    coral: 'Warm Coral',
  };
  const colors = {
    light: '#F5F5F2',
    dark: '#121212',
    verdant: '#7ED6A7',
    solar: '#FFD54F',
    cobalt: '#536BDA',
    ember: '#F06A67',
    azure: '#68CBE7',
    lavender: '#B7A4E8',
    coral: '#F49A7B',
  };
  for (const theme of THEMES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `theme-option${theme === state.theme ? ' active' : ''}`;
    button.ariaPressed = String(theme === state.theme);
    button.ariaLabel = `Use ${labels[theme]} theme`;
    button.innerHTML = `<span class="theme-swatch" style="background:${colors[theme]}"></span><strong>${labels[theme]}</strong>`;
    button.addEventListener('click', () => {
      applyTheme(theme);
      closeThemePopover();
    });
    elements.themeOptions.append(button);
  }
}

function openThemePopover() {
  elements.themePopover.hidden = false;
  elements.themeButton.ariaExpanded = 'true';
  elements.app.classList.add('settings-open');
  pushOverlayHistory('settings');
}

function closeThemePopover(fromHistory = false) {
  if (elements.themePopover.hidden) return;
  elements.themePopover.hidden = true;
  elements.themeButton.ariaExpanded = 'false';
  elements.app.classList.remove('settings-open');
  if (!fromHistory) releaseOverlayHistory('settings');
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
    let audio = gongPlayers.get(gong.id);
    if (!audio) {
      audio = new Audio(gong.file);
      audio.preload = 'auto';
      gongPlayers.set(gong.id, audio);
    }
    audio.pause();
    audio.currentTime = 0;
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
  intervalErrors = {};
  removedInterval = null;
  savingDraft = false;
  clearEditorFeedback();
  elements.editorError.hidden = true;
  elements.editorTitle.textContent = preset ? 'Edit preset' : 'Create a preset';
  elements.presetName.value = draft.name;
  elements.editor.querySelector(`[name="mode"][value="${draft.mode}"]`).checked = true;
  renderEditor();
  elements.editor.hidden = false;
  pushOverlayHistory('editor');
}

function gongLabel(id) {
  return GONGS.find((gong) => gong.id === id)?.label ?? 'None';
}

function renderEditorSummary() {
  const minutes = totalMinutes(draft);
  const count = draft.intervals.length;
  elements.presetName.placeholder = `Meditation ${minutes} min`;
  elements.sequenceLabel.textContent = `SESSION SEQUENCE · ${minutes} MIN`;
  elements.editorTotal.textContent = `${count} ${count === 1 ? 'interval' : 'intervals'}  ·  ${minutes} min`;
  elements.startEndGongLabel.textContent = gongLabel(draft.startEndGong);
  elements.intervalGongLabel.textContent = gongLabel(draft.intervalGong);
}

function renderEditor() {
  renderEditorSummary();
  elements.intervalList.replaceChildren();
  draft.intervals.forEach((minutes, index) => {
    const item = document.createElement('div');
    const error = intervalErrors[index];
    item.className = `interval-item${error ? ' has-error' : ''}`;
    const row = document.createElement('div');
    row.className = `interval-row${error ? ' invalid' : ''}`;
    row.dataset.intervalIndex = String(index);
    const hintId = `interval-${index}-hint`;
    const errorId = `interval-${index}-error`;
    row.innerHTML = `
      <button class="interval-drag" type="button" aria-label="Reorder interval ${index + 1}" title="Drag to reorder; use arrow keys with a keyboard">
        <span class="management-icon drag-icon" aria-hidden="true"></span>
      </button>
      <span class="interval-number">${String(index + 1).padStart(2, '0')}</span>
      <div class="minute-stepper">
        <button class="minute-minus" type="button" aria-label="Decrease interval ${index + 1}">
          <span class="editor-icon minus-icon" aria-hidden="true"></span>
        </button>
        <label class="minute-value">
          <input type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${escapeHtml(minutes)}" aria-label="Interval ${index + 1} duration in minutes" aria-describedby="${error ? errorId : hintId}" aria-invalid="${Boolean(error)}">
          <span>min</span>
        </label>
        <button class="minute-plus" type="button" aria-label="Increase interval ${index + 1}">
          <span class="editor-icon plus-icon" aria-hidden="true"></span>
        </button>
      </div>
      <button class="remove-interval" type="button" aria-label="Remove interval ${index + 1}" ${draft.intervals.length === 1 ? 'disabled' : ''}>
        <span class="management-icon trash-icon" aria-hidden="true"></span>
      </button>
    `;
    const input = row.querySelector('.minute-value input');
    input.addEventListener('input', () => {
      draft.intervals[index] = input.value;
      delete intervalErrors[index];
      item.classList.remove('has-error');
      row.classList.remove('invalid');
      input.ariaInvalid = 'false';
      input.setAttribute('aria-describedby', hintId);
      item.querySelector('.interval-error').hidden = true;
      item.querySelector('.interval-hint').hidden = false;
      elements.editorError.hidden = true;
      renderEditorSummary();
    });
    input.addEventListener('blur', () => validateIntervalAt(index));
    bindPressAndHold(row.querySelector('.minute-minus'), () => adjustInterval(index, -1, input, item));
    bindPressAndHold(row.querySelector('.minute-plus'), () => adjustInterval(index, 1, input, item));
    row.querySelector('.remove-interval').addEventListener('click', () => {
      removeIntervalAt(index);
    });
    const dragHandle = row.querySelector('.interval-drag');
    dragHandle.addEventListener('pointerdown', (event) => beginIntervalDrag(event, index));
    dragHandle.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp') { event.preventDefault(); moveInterval(index, -1); }
      if (event.key === 'ArrowDown') { event.preventDefault(); moveInterval(index, 1); }
    });
    const hint = document.createElement('small');
    hint.className = 'interval-hint';
    hint.id = hintId;
    hint.textContent = '1–1440 min';
    hint.hidden = Boolean(error);
    const message = document.createElement('small');
    message.className = 'interval-error';
    message.id = errorId;
    message.textContent = error ?? '';
    message.hidden = !error;
    item.append(row, hint, message);
    elements.intervalList.append(item);
  });
}

function adjustInterval(index, delta, input, item) {
  const current = Number(draft.intervals[index]);
  const base = Number.isInteger(current) ? current : delta > 0 ? 0 : 2;
  const value = Math.max(1, Math.min(1440, base + delta));
  draft.intervals[index] = value;
  input.value = String(value);
  delete intervalErrors[index];
  item.classList.remove('has-error');
  item.querySelector('.interval-row').classList.remove('invalid');
  input.ariaInvalid = 'false';
  input.setAttribute('aria-describedby', `interval-${index}-hint`);
  item.querySelector('.interval-error').hidden = true;
  item.querySelector('.interval-hint').hidden = false;
  elements.editorError.hidden = true;
  renderEditorSummary();
}

function bindPressAndHold(button, action) {
  let holdDelay = null;
  let repeat = null;
  const stop = () => {
    clearTimeout(holdDelay);
    clearInterval(repeat);
    holdDelay = null;
    repeat = null;
  };
  button.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    action();
    holdDelay = setTimeout(() => { repeat = setInterval(action, 90); }, 420);
  });
  button.addEventListener('click', (event) => {
    if (event.detail === 0) action();
    else event.preventDefault();
  });
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('lostpointercapture', stop);
}

function validateIntervalAt(index) {
  const value = Number(draft.intervals[index]);
  if (!Number.isInteger(value) || value < 1 || value > 1440) {
    intervalErrors[index] = 'Enter a duration from 1 to 1440 minutes.';
  } else {
    draft.intervals[index] = value;
    delete intervalErrors[index];
  }
  const totalError = validatePreset(draft).total ?? '';
  elements.editorError.textContent = totalError;
  elements.editorError.hidden = !totalError;
  renderEditor();
}

function removeIntervalAt(index) {
  if (draft.intervals.length === 1) return;
  removedInterval = { index, minutes: draft.intervals[index] };
  draft.intervals.splice(index, 1);
  intervalErrors = {};
  elements.editorError.hidden = true;
  renderEditor();
  showEditorFeedback('Interval removed', 'UNDO', undoRemovedInterval, 5000);
}

function undoRemovedInterval() {
  if (!removedInterval) return;
  draft.intervals.splice(removedInterval.index, 0, removedInterval.minutes);
  removedInterval = null;
  clearEditorFeedback();
  renderEditor();
}

function moveInterval(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= draft.intervals.length) return;
  const [minutes] = draft.intervals.splice(index, 1);
  draft.intervals.splice(target, 0, minutes);
  intervalErrors = {};
  renderEditor();
  elements.intervalList.querySelector(`[data-interval-index="${target}"] .interval-drag`)?.focus();
}

function beginIntervalDrag(event, index) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  event.preventDefault();
  intervalDrag = { pointerId: event.pointerId, index };
  event.currentTarget.closest('.interval-row')?.classList.add('dragging');
}

function continueIntervalDrag(event) {
  if (!intervalDrag || event.pointerId !== intervalDrag.pointerId) return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.interval-row');
  if (!target || !elements.intervalList.contains(target)) return;
  const targetIndex = Number(target.dataset.intervalIndex);
  if (targetIndex === intervalDrag.index) return;
  const [minutes] = draft.intervals.splice(intervalDrag.index, 1);
  draft.intervals.splice(targetIndex, 0, minutes);
  intervalErrors = {};
  intervalDrag.index = targetIndex;
  renderEditor();
  elements.intervalList.querySelector(`[data-interval-index="${targetIndex}"]`)?.classList.add('dragging');
}

function endIntervalDrag(event) {
  if (!intervalDrag || event.pointerId !== intervalDrag.pointerId) return;
  intervalDrag = null;
  elements.intervalList.querySelector('.dragging')?.classList.remove('dragging');
}

function openGongPicker(kind) {
  activeGongKind = kind;
  const isStartEnd = kind === 'startEndGong';
  elements.gongPicker.classList.toggle('start-end-picker', isStartEnd);
  elements.gongContext.textContent = isStartEnd ? 'START & END GONG' : 'INTERVAL GONG';
  elements.gongNote.textContent = isStartEnd
    ? 'Used at the start and end of the session. Interval gong is set separately.'
    : 'Used between intervals. Choose None for silence.';
  renderGongOptions();
  elements.gongPicker.hidden = false;
  pushOverlayHistory('gong');
}

function renderGongOptions() {
  const visibleIds = activeGongKind === 'startEndGong'
    ? ['gong1', 'gong2', 'gong3']
    : ['gong1', 'gong2', 'gong3', 'none'];
  elements.gongOptions.replaceChildren();
  for (const gong of visibleIds.map((id) => GONGS.find((item) => item.id === id))) {
    const row = document.createElement('div');
    const selected = draft[activeGongKind] === gong.id;
    row.className = `gong-option${selected ? ' selected' : ''}`;

    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'gong-preview';
    preview.disabled = !gong.file;
    preview.ariaLabel = gong.file ? `Preview ${gong.label}` : 'No preview available';
    preview.innerHTML = '<span class="editor-icon play-icon" aria-hidden="true"></span>';
    preview.addEventListener('click', () => playGong(gong.id));

    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'gong-select';
    select.innerHTML = `
      <span><strong>${escapeHtml(gong.label)}</strong><small>${escapeHtml(gong.description)}</small></span>
      ${selected ? '<span class="editor-icon selected-icon" role="img" aria-label="Selected"></span>' : ''}
    `;
    select.addEventListener('click', () => {
      draft[activeGongKind] = gong.id;
      renderEditorSummary();
      renderGongOptions();
    });
    row.append(preview, select);
    elements.gongOptions.append(row);
  }
}

function closeGongPicker(fromHistory = false) {
  if (elements.gongPicker.hidden) return;
  elements.gongPicker.hidden = true;
  elements.gongPicker.classList.remove('start-end-picker');
  activeGongKind = null;
  if (!fromHistory) releaseOverlayHistory('gong');
}

function closeEditor(force = false, fromHistory = false) {
  if (!draft || savingDraft) return;
  if (!force && draftIsDirty()) {
    askConfirmation('Discard changes?', 'Your preset changes have not been saved.', 'DISCARD', () => closeEditor(true, true), 'discard');
    return;
  }
  document.activeElement?.blur();
  if (!elements.gongPicker.hidden) closeGongPicker(true);
  elements.editor.hidden = true;
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  clearEditorFeedback();
  draft = null;
  editingId = null;
  intervalErrors = {};
  removedInterval = null;
  managing = false;
  if (!fromHistory) releaseOverlayHistory('editor');
  render();
}

function syncDraftFields() {
  draft.name = elements.presetName.value.trim();
  draft.mode = elements.editor.querySelector('[name="mode"]:checked').value;
}

function draftIsDirty() {
  if (!draft) return false;
  syncDraftFields();
  return JSON.stringify(draft) !== draftOriginal;
}

async function saveDraft(event) {
  event.preventDefault();
  if (savingDraft) return;
  syncDraftFields();
  const errors = validatePreset(draft);
  if (Object.keys(errors).length) {
    intervalErrors = Object.fromEntries(Object.entries(errors).filter(([key]) => /^\d+$/.test(key)));
    elements.editorError.textContent = errors.total ?? errors.intervals ?? errors.startEndGong ?? '';
    elements.editorError.hidden = !elements.editorError.textContent;
    renderEditor();
    const firstInvalid = Number(Object.keys(intervalErrors)[0]);
    if (Number.isInteger(firstInvalid)) {
      requestAnimationFrame(() => elements.intervalList.querySelector(`[data-interval-index="${firstInvalid}"] input`)?.focus());
    } else {
      elements.editorError.focus?.();
    }
    return;
  }
  intervalErrors = {};
  elements.editorError.hidden = true;
  clearEditorFeedback();
  const savedPreset = structuredClone(draft);
  savedPreset.intervals = savedPreset.intervals.map(Number);
  if (!savedPreset.name) savedPreset.name = generatedName(totalMinutes(savedPreset), state.presets, editingId);
  const nextPresets = state.presets.map((preset) => structuredClone(preset));
  const existing = state.presets.findIndex((preset) => preset.id === editingId);
  if (existing >= 0) nextPresets[existing] = savedPreset;
  else nextPresets.push(savedPreset);
  const nextState = { theme: state.theme, presets: nextPresets, selectedId: savedPreset.id };
  setSavingState(true);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (!saveState(nextState)) {
    setSavingState(false);
    showEditorFeedback(
      'We couldn’t save this preset. Try again.',
      'Try again',
      () => elements.editorForm.requestSubmit(),
    );
    return;
  }
  state.presets = nextPresets;
  state.selectedId = savedPreset.id;
  setSavingState(false);
  closeEditor(true);
  render();
  requestAnimationFrame(() => elements.presetList.querySelector('.active')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
}

function setSavingState(saving) {
  savingDraft = saving;
  elements.savePreset.disabled = saving;
  elements.savePreset.textContent = saving ? 'Saving…' : 'Save';
  elements.editor.classList.toggle('saving', saving);
}

function askConfirmation(title, message, acceptLabel, action, kind = 'default') {
  pendingConfirmation = action;
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmAccept.textContent = acceptLabel;
  elements.confirm.dataset.kind = kind;
  elements.confirm.classList.toggle('delete-confirmation', kind === 'delete');
  elements.confirm.classList.toggle('end-confirmation', kind === 'end');
  elements.confirm.hidden = false;
  pushOverlayHistory('confirmation');
  elements.confirmCancel.focus();
}

function closeConfirmation(fromHistory = false) {
  if (elements.confirm.hidden) return;
  pendingConfirmation = null;
  elements.confirm.hidden = true;
  elements.confirm.classList.remove('delete-confirmation');
  elements.confirm.classList.remove('end-confirmation');
  delete elements.confirm.dataset.kind;
  if (!fromHistory) releaseOverlayHistory('confirmation');
}

function pushOverlayHistory(name) {
  historyOverlays.push(name);
  history.pushState({ meditationTimerOverlay: name, depth: historyOverlays.length }, '');
}

function releaseOverlayHistory(name) {
  if (historyOverlays.at(-1) !== name) return;
  historyOverlays.pop();
  suppressedPopstates += 1;
  history.back();
}

function showEditorFeedback(message, actionLabel, action, duration = 0) {
  clearTimeout(editorFeedbackTimeout);
  elements.editorFeedbackMessage.textContent = message;
  elements.editorFeedbackAction.textContent = actionLabel;
  elements.editorFeedbackAction.onclick = action;
  elements.editorFeedback.hidden = false;
  if (duration) editorFeedbackTimeout = setTimeout(clearEditorFeedback, duration);
}

function clearEditorFeedback() {
  clearTimeout(editorFeedbackTimeout);
  editorFeedbackTimeout = null;
  elements.editorFeedback.hidden = true;
  elements.editorFeedbackMessage.textContent = '';
  elements.editorFeedbackAction.textContent = '';
  elements.editorFeedbackAction.onclick = null;
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
  if (elements.themePopover.hidden) openThemePopover();
  else closeThemePopover();
});
document.addEventListener('pointerdown', (event) => {
  if (!elements.themePopover.hidden && !elements.themePopover.contains(event.target) && !elements.themeButton.contains(event.target)) closeThemePopover();
});
elements.primaryAction.addEventListener('click', primaryAction);
elements.endSession.addEventListener('click', () => askConfirmation(
  'End session?',
  'Your current session will end. The end gong will not play.',
  'END SESSION',
  async () => { timer.reset(); await releaseWakeLock(); },
  'end',
));
elements.managePresets.addEventListener('click', () => { managing = !managing; renderPresets(); });
elements.addPreset.addEventListener('click', () => openEditor());
elements.cancelEditor.addEventListener('click', () => closeEditor());
elements.editorForm.addEventListener('submit', saveDraft);
elements.addInterval.addEventListener('click', () => {
  draft.intervals.push(10);
  intervalErrors = {};
  clearEditorFeedback();
  renderEditor();
  const index = draft.intervals.length - 1;
  requestAnimationFrame(() => elements.intervalList.querySelector(`[data-interval-index="${index}"] input`)?.focus());
});
elements.startEndSoundField.addEventListener('click', () => openGongPicker('startEndGong'));
elements.intervalSoundField.addEventListener('click', () => openGongPicker('intervalGong'));
elements.gongDone.addEventListener('click', closeGongPicker);
elements.gongScrim.addEventListener('click', closeGongPicker);
elements.editor.querySelectorAll('[name="mode"]').forEach((radio) => radio.addEventListener('change', (event) => { draft.mode = event.target.value; }));
elements.presetName.addEventListener('input', () => { if (draft) draft.name = elements.presetName.value.trim(); });
document.addEventListener('pointermove', continueIntervalDrag);
document.addEventListener('pointermove', continuePresetDrag);
document.addEventListener('pointerup', endIntervalDrag);
document.addEventListener('pointerup', endPresetDrag);
document.addEventListener('pointercancel', endIntervalDrag);
document.addEventListener('pointercancel', endPresetDrag);
elements.confirmCancel.addEventListener('click', () => closeConfirmation());
elements.confirm.addEventListener('click', (event) => {
  if (event.target === elements.confirm) closeConfirmation();
});
elements.confirmAccept.addEventListener('click', () => {
  const action = pendingConfirmation;
  const kind = elements.confirm.dataset.kind;
  if (kind === 'discard') {
    closeConfirmation(true);
    if (historyOverlays.at(-1) === 'confirmation') historyOverlays.pop();
    if (historyOverlays.at(-1) === 'editor') historyOverlays.pop();
    suppressedPopstates += 1;
    history.go(-2);
    action?.();
    return;
  }
  closeConfirmation();
  action?.();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!elements.confirm.hidden) closeConfirmation();
  else if (!elements.gongPicker.hidden) closeGongPicker();
  else if (!elements.themePopover.hidden) closeThemePopover();
  else if (!elements.editor.hidden) closeEditor();
});
window.addEventListener('popstate', () => {
  if (suppressedPopstates > 0) {
    suppressedPopstates -= 1;
    return;
  }
  const overlay = historyOverlays.pop();
  if (overlay === 'confirmation') closeConfirmation(true);
  if (overlay === 'gong') closeGongPicker(true);
  if (overlay === 'settings') closeThemePopover(true);
  if (overlay === 'editor') {
    if (draftIsDirty()) {
      historyOverlays.push('editor');
      history.pushState({ meditationTimerOverlay: 'editor', depth: historyOverlays.length }, '');
      closeEditor(false, true);
    } else {
      closeEditor(true, true);
    }
  }
});
timer.addEventListener('change', render);
timer.addEventListener('interval', () => playGong(timer.preset.intervalGong));
timer.addEventListener('complete', (event) => {
  void playGong(event.detail.preset.startEndGong);
  void releaseWakeLock();
});
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    timer.synchronize();
    if (timer.state === 'running') await requestWakeLock();
  }
});
window.addEventListener('beforeunload', (event) => {
  if (draftIsDirty()) {
    event.preventDefault();
    event.returnValue = '';
  }
});

installStandaloneViewportCompensation();
applyTheme(state.theme);
render();
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      await registration.update();
    } catch {
      // The timer remains usable online when service worker registration is unavailable.
    }
  });
}
