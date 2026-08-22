import { defaultPresets, normalizePresetSounds, THEMES } from './domain.js?v=8';

const STORAGE_KEY = 'meditation-timer.apple-pwa.v1';

export function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(stored?.presets)) {
      const presets = stored.presets.map(normalizePresetSounds);
      const selectedId = presets.some((preset) => preset.id === stored.selectedId)
        ? stored.selectedId
        : presets[0]?.id ?? null;
      return {
        theme: THEMES.includes(stored.theme) ? stored.theme : 'green',
        presets,
        selectedId,
      };
    }
  } catch {
    // A damaged local entry is replaced with the safe starter state.
  }
  const presets = defaultPresets();
  return { theme: 'green', presets, selectedId: 'starter-30' };
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      theme: state.theme,
      presets: state.presets,
      selectedId: state.selectedId,
    }));
    return true;
  } catch {
    return false;
  }
}
