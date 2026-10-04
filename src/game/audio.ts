export class GameAudio {
  private context?: AudioContext;
  muted = false;
  unlock() {
    if (!this.context) { try { this.context = new AudioContext(); } catch { return; } }
    if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
  }
  play(type: 'drop' | 'merge' | 'shake', level = 0) {
    if (this.muted || !this.context || this.context.state !== 'running') return;
    const context = this.context;
    const base = type === 'merge' ? 440 * Math.pow(2, (level % 7) / 12) : type === 'drop' ? 210 : 145;
    const notes = type === 'merge' ? [1, 1.25, 1.5] : [1];
    notes.forEach((ratio, i) => {
      const oscillator = context.createOscillator(), gain = context.createGain();
      const t = context.currentTime + i * 0.035;
      oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(base * ratio, t);
      oscillator.frequency.exponentialRampToValueAtTime(base * ratio * 0.8, t + 0.19);
      gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.075, t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.23);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(t); oscillator.stop(t + 0.25);
    });
  }
  destroy() { void this.context?.close().catch(() => {}); }
}
