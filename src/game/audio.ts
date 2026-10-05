const AUDIO_FILES = {
  button: 'button-pressed.ogg', highlight: 'highlight.ogg', currency: 'currency.ogg',
  splash14: 'splash-14.ogg', splash03: 'splash-03.ogg', sell: 'sell.ogg',
} as const;
type Sample = keyof typeof AUDIO_FILES;
type Sound = 'button' | 'merge' | 'purchase' | 'drop';
const LAYERS: Record<Exclude<Sound, 'drop'>, Sample[]> = {
  button: ['button', 'highlight'],
  merge: ['button', 'currency', 'splash14', 'splash03'],
  purchase: ['sell'],
};

export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private samples = new Map<Sample, Promise<AudioBuffer | undefined>>();
  private music?: HTMLAudioElement;
  private activeSources = new Set<AudioScheduledSourceNode>();
  private active = !document.hidden && document.hasFocus();
  private unlocked = false;
  private focusChanged = () => { this.active = !document.hidden && document.hasFocus(); this.updatePlayback(); };
  private blurred = () => { this.active = false; this.updatePlayback(); };
  private destroyed = false;
  private isMuted = false;
  private lastMerge = -Infinity;
  private mergeStreak = 0;

  constructor(muted = false) {
    this.isMuted = muted;
    try {
      const context = this.context = new AudioContext();
      this.master = context.createGain();
      const limiter = context.createDynamicsCompressor();
      this.master.connect(limiter); limiter.connect(context.destination);
      // An unattached audio element streams the music; no player is added to the page.
      this.music = new Audio(`${import.meta.env.BASE_URL}assets/audio/playground.ogg`);
      this.music.controls = false;
      this.music.disableRemotePlayback = true;
      this.music.preload = 'auto';
      this.music.loop = true;
      const musicSource = context.createMediaElementSource(this.music), musicGain = context.createGain();
      musicGain.gain.value = 0.2;
      musicSource.connect(musicGain); musicGain.connect(this.master);
      for (const [sample, file] of Object.entries(AUDIO_FILES)) {
        this.samples.set(sample as Sample, fetch(`${import.meta.env.BASE_URL}assets/audio/${file}`)
          .then(response => { if (!response.ok) throw new Error(`Audio: ${response.status}`); return response.arrayBuffer(); })
          .then(data => context.decodeAudioData(data)).catch(() => undefined));
      }
    } catch { /* Audio is optional on browsers without Web Audio support. */ }
    document.addEventListener('visibilitychange', this.focusChanged);
    window.addEventListener('focus', this.focusChanged);
    window.addEventListener('blur', this.blurred);
    window.addEventListener('pagehide', this.blurred);
    window.addEventListener('pageshow', this.focusChanged);
    // Browsers that allow autoplay can start immediately; otherwise unlock retries in a gesture.
    if (this.active) this.unlock();
  }

  get muted() { return this.isMuted; }
  set muted(value: boolean) {
    this.isMuted = value;
    this.updatePlayback();
  }

  unlock() {
    if (!this.context || this.destroyed || !this.active) return;
    this.unlocked = true;
    this.updatePlayback();
  }

  private updatePlayback() {
    const context = this.context;
    if (!context || this.destroyed) return;
    const audible = this.active && !this.muted;
    this.master?.gain.setValueAtTime(audible ? 1 : 0, context.currentTime);
    if (!audible) {
      this.music?.pause();
      for (const source of this.activeSources) source.stop();
      this.activeSources.clear();
    }
    if (!this.active) {
      void context.suspend().catch(() => {});
    } else if (this.unlocked) {
      void context.resume().catch(() => {});
      if (audible && this.music?.paused) void this.music.play().catch(() => {});
    }
  }

  play(type: Sound) {
    let pitch = 1;
    if (type === 'merge') {
      const now = performance.now();
      this.mergeStreak = now - this.lastMerge >= 3000 ? 0 : this.mergeStreak + 1;
      this.lastMerge = now;
      pitch = 1 + this.mergeStreak * 0.06;
    }
    if (this.muted || !this.active || !this.context || this.destroyed) return;
    this.unlock();
    if (type === 'drop') { this.drop(); return; }
    const resumed = this.context.state === 'suspended' ? this.context.resume() : Promise.resolve();
    void Promise.all([Promise.all(LAYERS[type].map(sample => this.samples.get(sample))), resumed]).then(([buffers]) => {
      if (this.muted || !this.active || this.destroyed || this.context?.state !== 'running') return;
      // Schedule every layer at the same instant, even during fast merge chains.
      const time = this.context.currentTime + 0.005;
      for (const buffer of buffers) if (buffer) this.source(buffer, time, pitch, 0.45);
    }).catch(() => {});
  }

  private source(buffer: AudioBuffer, time: number, pitch: number, volume: number) {
    const context = this.context!, source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; source.playbackRate.setValueAtTime(pitch, time);
    gain.gain.setValueAtTime(volume, time);
    source.connect(gain); gain.connect(this.master!);
    this.activeSources.add(source);
    source.onended = () => { this.activeSources.delete(source); source.disconnect(); gain.disconnect(); };
    source.start(time);
    return source;
  }

  private drop() {
    const context = this.context!, oscillator = context.createOscillator(), gain = context.createGain();
    const time = context.currentTime;
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(210, time);
    oscillator.frequency.exponentialRampToValueAtTime(168, time + 0.19);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(0.075, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.23);
    oscillator.connect(gain); gain.connect(this.master!);
    this.activeSources.add(oscillator);
    oscillator.onended = () => { this.activeSources.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(time); oscillator.stop(time + 0.25);
  }

  destroy() {
    this.destroyed = true;
    document.removeEventListener('visibilitychange', this.focusChanged);
    window.removeEventListener('focus', this.focusChanged);
    window.removeEventListener('blur', this.blurred);
    window.removeEventListener('pagehide', this.blurred);
    window.removeEventListener('pageshow', this.focusChanged);
    if (this.music) { this.music.pause(); this.music.removeAttribute('src'); this.music.load(); }
    for (const source of this.activeSources) source.stop();
    this.activeSources.clear();
    void this.context?.close().catch(() => {});
  }
}
