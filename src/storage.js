import { defaultPresets, THEMES } from './domain.js?v=6';

const STORAGE_KEY = 'meditation-timer.apple-pwa.v1';

export function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(stored?.presets)) {
      return {
        theme: THEMES.includes(stored.theme) ? stored.theme : 'green',
        presets: stored.presets,
        selectedId: stored.selectedId ?? stored.presets[0]?.id ?? null,
      };
    }
  } catch {
    // A damaged local entry is replaced with the safe starter state.
  }
  const presets = defaultPresets();
  return { theme: 'green', presets, selectedId: 'starter-30' };
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    theme: state.theme,
    presets: state.presets,
    selectedId: state.selectedId,
  }));
}
