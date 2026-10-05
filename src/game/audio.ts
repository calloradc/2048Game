import { StreamingMusic } from './streamingMusic';

const AUDIO_FILES = {
  button: 'button-pressed.ogg', highlight: 'highlight.ogg', currency: 'currency.ogg',
  splash14: 'splash-14.ogg', splash03: 'splash-03.ogg', sell: 'sell.ogg',
} as const;
type Sample = keyof typeof AUDIO_FILES;
type Sound = 'button' | 'merge' | 'purchase' | 'drop';
const LAYERS: Record<Sound, Sample[]> = {
  button: ['button', 'highlight'],
  merge: ['button', 'currency', 'splash14', 'splash03'],
  purchase: ['sell'],
  drop: ['splash03'],
};

export class GameAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private samples = new Map<Sample, Promise<AudioBuffer | undefined>>();
  private music?: StreamingMusic;
  private activeSources = new Set<AudioScheduledSourceNode>();
  private mergeSources = new Set<AudioBufferSourceNode>();
  private active = !document.hidden && document.hasFocus();
  private unlocked = false;
  private focusChanged = () => { this.active = !document.hidden && document.hasFocus(); this.updatePlayback(); };
  private blurred = () => { this.active = false; this.updatePlayback(); };
  private destroyed = false;
  private isMuted = false;
  private isPaused = false;
  private purchasePending = false;
  private lastMerge = -Infinity;
  private lastMergeSound = -Infinity;
  private mergeStreak = 0;

  constructor(muted = false, paused = false) {
    this.isMuted = muted;
    this.isPaused = paused;
    try {
      const context = this.context = new AudioContext();
      this.master = context.createGain();
      const limiter = context.createDynamicsCompressor();
      this.master.connect(limiter); limiter.connect(context.destination);
      const musicGain = context.createGain();
      musicGain.gain.value = 0.2;
      musicGain.connect(this.master);
      this.music = new StreamingMusic(context,musicGain,`${import.meta.env.BASE_URL}assets/audio/playground.ogg`);
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
  get paused() { return this.isPaused; }
  set paused(value: boolean) {
    this.isPaused = value;
    // Attempt allowed autoplay after loading/platform resume. Gesture-only
    // browsers still retry through the existing pointer/click unlock path.
    if (!value && this.active) this.unlock(); else this.updatePlayback();
  }
  set muted(value: boolean) {
    this.isMuted = value;
    if (value) this.purchasePending = false;
    this.updatePlayback();
  }

  rewardPurchase() {
    if (this.muted || this.destroyed) return;
    this.purchasePending = true;
    this.updatePlayback();
  }

  unlock() {
    if (!this.context || this.destroyed || !this.active || this.paused) return;
    this.unlocked = true;
    this.updatePlayback();
  }

  private updatePlayback() {
    const context = this.context;
    if (!context || this.destroyed) return;
    const audible = this.active && !this.muted && !this.paused;
    this.master?.gain.setValueAtTime(audible ? 1 : 0, context.currentTime);
    if (!audible) {
      for (const source of this.activeSources) source.stop();
      this.activeSources.clear();
      this.mergeSources.clear();
    }
    if (!this.active || this.paused) {
      void context.suspend().catch(() => {});
    } else if (this.unlocked) {
      void context.resume().catch(() => {});
    }
    this.music?.setPlaying(audible && this.unlocked);
    if (audible && this.purchasePending) {
      this.purchasePending = false;
      this.play('purchase');
    }
  }

  play(type: Sound) {
    let pitch = 1;
    if (type === 'merge') {
      const now = performance.now();
      const reset = now - this.lastMerge >= 1500;
      this.lastMerge = now;
      // One cue for collisions in the same physics frame or a nearby frame.
      if (now - this.lastMergeSound < 80) return;
      this.lastMergeSound = now;
      this.mergeStreak = reset ? 0 : this.mergeStreak + 1;
      pitch = 1 + this.mergeStreak * 0.06;
    }
    if (this.muted || this.paused || !this.active || !this.context || this.destroyed) return;
    this.unlock();
    const resumed = this.context.state === 'suspended' ? this.context.resume() : Promise.resolve();
    void Promise.all([Promise.all(LAYERS[type].map(sample => this.samples.get(sample))), resumed]).then(([buffers]) => {
      if (this.muted || this.paused || !this.active || this.destroyed || this.context?.state !== 'running') return;
      // Schedule every layer at the same instant, even during fast merge chains.
      const time = this.context.currentTime + 0.005;
      if (type === 'merge') {
        // A new cue replaces the previous merge tail instead of stacking it.
        for (const source of this.mergeSources) source.stop(time);
        this.mergeSources.clear();
      }
      for (const buffer of buffers) if (buffer) this.source(buffer, time, pitch, 0.45, type === 'merge');
    }).catch(() => {});
  }

  private source(buffer: AudioBuffer, time: number, pitch: number, volume: number, merge: boolean) {
    const context = this.context!, source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer; source.playbackRate.setValueAtTime(pitch, time);
    gain.gain.setValueAtTime(volume, time);
    source.connect(gain); gain.connect(this.master!);
    this.activeSources.add(source);
    if (merge) this.mergeSources.add(source);
    source.onended = () => { this.activeSources.delete(source); this.mergeSources.delete(source); source.disconnect(); gain.disconnect(); };
    source.start(time);
    return source;
  }

  destroy() {
    this.destroyed = true;
    document.removeEventListener('visibilitychange', this.focusChanged);
    window.removeEventListener('focus', this.focusChanged);
    window.removeEventListener('blur', this.blurred);
    window.removeEventListener('pagehide', this.blurred);
    window.removeEventListener('pageshow', this.focusChanged);
    this.music?.destroy();
    for (const source of this.activeSources) source.stop();
    this.activeSources.clear();
    this.mergeSources.clear();
    void this.context?.close().catch(() => {});
  }
}
