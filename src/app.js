import {
  createDraft,
  formatTime,
  generatedName,
  GONGS,
  presetMetadata,
  THEMES,
  totalMinutes,
  validatePreset,
} from './domain.js?v=5';
import { loadState, saveState } from './storage.js?v=5';
import { TimerEngine } from './timer-engine.js?v=5';
import { installStandaloneViewportCompensation } from './viewport.js?v=5';

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
let activeGongKind = null;
let intervalDrag = null;

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
  closeEditor: $('#closeEditor'),
  cancelEditor: $('#cancelEditor'),
  presetName: $('#presetName'),
  startEndGongLabel: $('#startEndGongLabel'),
  intervalGongLabel: $('#intervalGongLabel'),
  startEndSoundField: $('#startEndSoundField'),
  intervalSoundField: $('#intervalSoundField'),
  sequenceLabel: $('#sequenceLabel'),
  editorTotal: $('#editorTotal'),
  editorError: $('#editorError'),
  intervalList: $('#intervalList'),
  addInterval: $('#addInterval'),
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
    green: '#59E5B5',
    light: '#F5F5F2',
    dark: '#121212',
    modern: '#FAFAF8',
  };
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
  const labels = { green: 'Green', light: 'Light', dark: 'Dark', modern: 'Modern' };
  const colors = { green: '#59E5B5', light: '#F5F5F2', dark: '#121212', modern: '#22E243' };
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
  elements.presetName.value = draft.name;
  elements.editor.querySelector(`[name="mode"][value="${draft.mode}"]`).checked = true;
  renderEditor();
  elements.editor.hidden = false;
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
    const row = document.createElement('div');
    row.className = 'interval-row';
    row.dataset.intervalIndex = String(index);
    row.innerHTML = `
      <button class="interval-drag" type="button" aria-label="Reorder interval ${index + 1}" title="Drag to reorder; use arrow keys with a keyboard">
        <img src="./assets/preset-editor/drag_handle.svg" alt="">
      </button>
      <span class="interval-number">${String(index + 1).padStart(2, '0')}</span>
      <div class="minute-stepper">
        <button class="minute-minus" type="button" aria-label="Decrease interval ${index + 1}">
          <img src="./assets/preset-editor/minus.svg" alt="">
        </button>
        <strong>${minutes} min</strong>
        <button class="minute-plus" type="button" aria-label="Increase interval ${index + 1}">
          <img src="./assets/preset-editor/plus.svg" alt="">
        </button>
      </div>
      <button class="remove-interval" type="button" aria-label="Remove interval ${index + 1}" ${draft.intervals.length === 1 ? 'disabled' : ''}>
        <img src="./assets/preset-editor/remove.svg" alt="">
      </button>
    `;
    row.querySelector('.minute-minus').addEventListener('click', () => {
      draft.intervals[index] = Math.max(1, Number(draft.intervals[index]) - 1);
      renderEditor();
    });
    row.querySelector('.minute-plus').addEventListener('click', () => {
      draft.intervals[index] = Math.min(1440, Number(draft.intervals[index]) + 1);
      renderEditor();
    });
    row.querySelector('.remove-interval').addEventListener('click', () => {
      if (draft.intervals.length === 1) return;
      draft.intervals.splice(index, 1);
      elements.editorError.hidden = true;
      renderEditor();
    });
    const dragHandle = row.querySelector('.interval-drag');
    dragHandle.addEventListener('pointerdown', (event) => beginIntervalDrag(event, index));
    dragHandle.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowUp') moveInterval(index, -1);
      if (event.key === 'ArrowDown') moveInterval(index, 1);
    });
    elements.intervalList.append(row);
  });
}

function moveInterval(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= draft.intervals.length) return;
  const [minutes] = draft.intervals.splice(index, 1);
  draft.intervals.splice(target, 0, minutes);
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
  elements.gongContext.textContent = isStartEnd ? 'START & END GONG' : 'INTERVAL GONG';
  elements.gongNote.textContent = isStartEnd
    ? 'Used at the start and end of the session. Interval gong is set separately.'
    : 'Used between consecutive intervals. Start and end gong is set separately.';
  renderGongOptions();
  elements.gongPicker.hidden = false;
}

function renderGongOptions() {
  const visibleIds = ['gong1', 'gong2', 'gong3', 'none'];
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
    preview.innerHTML = '<img src="./assets/preset-editor/play.svg" alt="">';
    preview.addEventListener('click', () => playGong(gong.id));

    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'gong-select';
    select.innerHTML = `
      <span><strong>${escapeHtml(gong.label)}</strong><small>${escapeHtml(gong.description)}</small></span>
      ${selected ? '<img src="./assets/preset-editor/selected.svg" alt="Selected">' : ''}
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

function closeGongPicker() {
  elements.gongPicker.hidden = true;
  activeGongKind = null;
}

function closeEditor(force = false) {
  if (!draft) return;
  syncDraftFields();
  if (!force && JSON.stringify(draft) !== draftOriginal) {
    askConfirmation('Discard changes?', 'Your preset changes have not been saved.', 'Discard', () => closeEditor(true));
    return;
  }
  document.activeElement?.blur();
  closeGongPicker();
  elements.editor.hidden = true;
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  draft = null;
  editingId = null;
}

function syncDraftFields() {
  draft.name = elements.presetName.value.trim();
  draft.mode = elements.editor.querySelector('[name="mode"]:checked').value;
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
elements.cancelEditor.addEventListener('click', () => closeEditor());
elements.editorForm.addEventListener('submit', saveDraft);
elements.addInterval.addEventListener('click', () => { draft.intervals.push(10); renderEditor(); });
elements.startEndSoundField.addEventListener('click', () => openGongPicker('startEndGong'));
elements.intervalSoundField.addEventListener('click', () => openGongPicker('intervalGong'));
elements.gongDone.addEventListener('click', closeGongPicker);
elements.gongScrim.addEventListener('click', closeGongPicker);
elements.editor.querySelectorAll('[name="mode"]').forEach((radio) => radio.addEventListener('change', (event) => { draft.mode = event.target.value; }));
document.addEventListener('pointermove', continueIntervalDrag);
document.addEventListener('pointerup', endIntervalDrag);
document.addEventListener('pointercancel', endIntervalDrag);
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
