export const THEMES = ['green', 'dark', 'light'];
export const GONGS = [
  { id: 'none', label: 'None', description: 'No sound', file: '' },
  { id: 'gong1', label: 'Gong 1', description: 'Default start & end gong', file: './assets/gong1.wav' },
  { id: 'gong2', label: 'Gong 2', description: 'Default interval gong', file: './assets/gong2.wav' },
  { id: 'gong3', label: 'Gong 3', description: 'Alternative gong', file: './assets/gong3.wav' },
  { id: 'gong4', label: 'Gong 4', description: 'Alternative gong', file: './assets/gong4.wav' },
];

export function defaultPresets() {
  return [15, 30, 45, 60].map((minutes) => ({
    id: `starter-${minutes}`,
    name: `Meditation ${minutes} min`,
    intervals: [minutes],
    mode: 'countdown',
    startEndGong: 'gong1',
    intervalGong: 'gong2',
  }));
}

export function createDraft(preset) {
  return preset ? structuredClone(preset) : {
    id: crypto.randomUUID?.() ?? `preset-${Date.now()}`,
    name: '',
    intervals: [10],
    mode: 'countdown',
    startEndGong: 'gong1',
    intervalGong: 'gong2',
  };
}

export function totalMinutes(preset) {
  return preset.intervals.reduce((sum, minutes) => sum + Number(minutes || 0), 0);
}

export function presetMetadata(preset) {
  const count = preset.intervals.length;
  return `${count} ${count === 1 ? 'interval' : 'intervals'} · ${preset.mode === 'countdown' ? 'countdown' : 'count up'}`;
}

export function generatedName(minutes, presets, excludedId = null) {
  const base = `Meditation ${minutes} min`;
  const names = new Set(presets.filter((item) => item.id !== excludedId).map((item) => item.name));
  if (!names.has(base)) return base;
  let suffix = 2;
  while (names.has(`${base} (${suffix})`)) suffix += 1;
  return `${base} (${suffix})`;
}

export function validatePreset(preset) {
  const errors = {};
  if (!preset.intervals.length) errors.intervals = 'Add at least one interval.';
  preset.intervals.forEach((minutes, index) => {
    if (!Number.isInteger(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 1440) {
      errors[index] = 'Use a whole number from 1 to 1440.';
    }
  });
  if (totalMinutes(preset) > 1440) errors.total = 'The session cannot exceed 1440 minutes.';
  return errors;
}

export function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.min(86400, Math.floor(totalSeconds)));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
