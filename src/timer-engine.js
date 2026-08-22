export class TimerEngine extends EventTarget {
  constructor(now = () => Date.now()) {
    super();
    this.now = now;
    this.reset();
  }

  start(preset) {
    this.preset = structuredClone(preset);
    this.durationMs = preset.intervals.reduce((sum, minutes) => sum + minutes * 60_000, 0);
    this.startedAt = this.now();
    this.accumulatedMs = 0;
    this.state = 'running';
    this.boundaries = [];
    let cursor = 0;
    for (const minutes of preset.intervals.slice(0, -1)) {
      cursor += minutes * 60_000;
      this.boundaries.push(cursor);
    }
    this.crossed = new Set();
    this.#beginTicker();
    this.#emit();
  }

  pause() {
    if (this.state !== 'running') return;
    this.accumulatedMs = this.elapsedMs;
    this.state = 'paused';
    clearInterval(this.ticker);
    this.#emit();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.startedAt = this.now();
    this.state = 'running';
    this.#beginTicker();
    this.#emit();
  }

  synchronize() {
    if (this.state === 'running') this.#tick();
  }

  reset() {
    clearInterval(this.ticker);
    this.state = 'idle';
    this.preset = null;
    this.durationMs = 0;
    this.startedAt = 0;
    this.accumulatedMs = 0;
    this.boundaries = [];
    this.crossed = new Set();
    this.ticker = null;
    this.#emit();
  }

  get elapsedMs() {
    if (this.state === 'running') {
      return Math.min(this.durationMs, this.accumulatedMs + this.now() - this.startedAt);
    }
    return Math.min(this.durationMs, this.accumulatedMs);
  }

  get progress() {
    return this.durationMs ? this.elapsedMs / this.durationMs : 0;
  }

  get displayedSeconds() {
    if (!this.preset) return 0;
    const elapsed = Math.floor(this.elapsedMs / 1000);
    return this.preset.mode === 'countUp'
      ? elapsed
      : Math.max(0, Math.ceil(this.durationMs / 1000) - elapsed);
  }

  #beginTicker() {
    clearInterval(this.ticker);
    this.ticker = setInterval(() => this.#tick(), 200);
  }

  #tick() {
    const elapsed = this.elapsedMs;
    for (const boundary of this.boundaries) {
      if (elapsed >= boundary && !this.crossed.has(boundary)) {
        this.crossed.add(boundary);
        this.dispatchEvent(new CustomEvent('interval'));
      }
    }
    if (this.durationMs > 0 && elapsed >= this.durationMs) {
      this.accumulatedMs = this.durationMs;
      this.state = 'completed';
      clearInterval(this.ticker);
      const preset = structuredClone(this.preset);
      this.dispatchEvent(new CustomEvent('complete', { detail: { preset } }));
      if (this.state === 'completed') this.reset();
      return;
    }
    this.#emit();
  }

  #emit() {
    this.dispatchEvent(new CustomEvent('change'));
  }
}
