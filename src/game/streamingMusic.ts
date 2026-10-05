import type { OggVorbisDecodedAudio, OggVorbisDecoderWebWorker } from '@wasm-audio-decoders/ogg-vorbis';

interface MusicChunk {
  buffer: AudioBuffer;
  offset: number;
  source?: AudioBufferSourceNode;
  start?: number;
  loop?: boolean;
}
const BUFFER_SECONDS = 8;
const INPUT_BYTES = 32 * 1024;

/** Decode OGG as it arrives. No media element means no native media session. */
export class StreamingMusic {
  private chunks: MusicChunk[] = [];
  private decoder?: OggVorbisDecoderWebWorker;
  private controller = new AbortController();
  private requestedPlaying = false;
  private destroyed = false;
  private nextTime = 0;
  private waitTimer?: ReturnType<typeof setTimeout>;
  private wake?: () => void;
  mode: 'streaming' | 'buffered' = 'streaming';

  constructor(private context: AudioContext, private gain: GainNode, private url: string) {
    void this.stream().catch(async () => {
      if (this.destroyed) return;
      // Restricted WebViews may forbid the decoder worker. Still never create
      // an HTMLAudioElement: fall back to a fully decoded Web Audio buffer.
      try {
        const response = await fetch(this.url, {signal: this.controller.signal,cache:'force-cache'});
        if (!response.ok) return;
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        if (this.destroyed) return;
        this.stopSources();this.chunks = [{buffer,offset:0,loop:true}];
        this.mode = 'buffered';this.schedule();
      } catch { /* Music is optional when unavailable or the page is closing. */ }
    });
  }

  get paused() { return !this.requestedPlaying || this.context.state !== 'running'; }
  get bufferedSeconds() {
    return this.chunks.reduce((sum,chunk) => sum + chunk.buffer.duration - this.currentOffset(chunk), 0);
  }
  setPlaying(playing: boolean) {
    if (this.destroyed || playing === this.requestedPlaying) return;
    if (!playing) this.stopSources();
    this.requestedPlaying = playing;
    if (playing) this.schedule();
  }
  private currentOffset(chunk: MusicChunk) {
    const elapsed = chunk.start === undefined ? 0 : Math.max(0,this.context.currentTime - chunk.start);
    const offset = chunk.offset + elapsed;
    return chunk.loop ? offset % chunk.buffer.duration : Math.min(chunk.buffer.duration,offset);
  }
  private stopSources() {
    for (const chunk of this.chunks) {
      chunk.offset = this.currentOffset(chunk);
      const source = chunk.source;
      chunk.source = undefined;chunk.start = undefined;
      if (source) { source.onended = null;source.stop();source.disconnect(); }
    }
    this.chunks = this.chunks.filter(chunk => chunk.offset < chunk.buffer.duration);
    this.nextTime = 0;
  }
  private schedule() {
    if (!this.requestedPlaying || this.destroyed) return;
    for (const chunk of this.chunks) {
      if (chunk.source) continue;
      const source = this.context.createBufferSource();
      source.buffer = chunk.buffer;source.loop = !!chunk.loop;
      source.connect(this.gain);
      const start = Math.max(this.context.currentTime + .05,this.nextTime);
      chunk.source = source;chunk.start = start;
      this.nextTime = start + chunk.buffer.duration - chunk.offset;
      source.onended = () => {
        source.disconnect();
        this.chunks = this.chunks.filter(item => item !== chunk);
        this.wake?.();
      };
      source.start(start,chunk.offset);
    }
  }
  private append(decoded: OggVorbisDecodedAudio) {
    if (this.destroyed || !decoded.samplesDecoded) return;
    if (decoded.errors.length) throw new Error('Invalid music stream');
    const buffer = this.context.createBuffer(decoded.channelData.length,decoded.samplesDecoded,decoded.sampleRate);
    decoded.channelData.forEach((channel,index) => buffer.copyToChannel(channel as Float32Array<ArrayBuffer>,index));
    this.chunks.push({buffer,offset:0});this.schedule();
  }
  private async waitForRoom() {
    while (!this.destroyed && this.bufferedSeconds >= BUFFER_SECONDS) {
      await new Promise<void>(resolve => {
        const wake = () => { clearTimeout(this.waitTimer);this.wake = undefined;resolve(); };
        this.wake = wake;this.waitTimer = setTimeout(wake,250);
      });
    }
  }
  private freeDecoder(decoder: OggVorbisDecoderWebWorker) {
    if (this.decoder !== decoder) return;
    this.decoder = undefined;
    // Cleanup may race with worker initialization during StrictMode/unmount.
    void decoder.ready.then(() => decoder.free()).catch(() => {});
  }
  private async stream() {
    const { OggVorbisDecoderWebWorker } = await import('@wasm-audio-decoders/ogg-vorbis');
    if (this.destroyed) return;
    const decoder = this.decoder = new OggVorbisDecoderWebWorker();
    try {
      await decoder.ready;
      while (!this.destroyed) {
        const response = await fetch(this.url, {signal:this.controller.signal,cache:'force-cache'});
        if (!response.ok || !response.body) throw new Error('Music stream unavailable');
        const reader = response.body.getReader();
        let samples = 0;
        try {
          while (!this.destroyed) {
            await this.waitForRoom();
            if (this.destroyed) return;
            const {done,value} = await reader.read();
            if (done) break;
            // Fetch may deliver a whole cached file at once. Bound each decode
            // and the PCM queue instead of retaining minutes of decoded music.
            for (let offset=0;offset<value.length&&!this.destroyed;offset+=INPUT_BYTES) {
              await this.waitForRoom();
              if (this.destroyed) return;
              const decoded = await decoder.decode(value.slice(offset,offset+INPUT_BYTES));
              samples += decoded.samplesDecoded;this.append(decoded);
            }
          }
          const final = await decoder.flush();samples += final.samplesDecoded;this.append(final);
          if (!samples) throw new Error('Empty music stream');
        } finally { await reader.cancel().catch(() => {}); }
        // Queue the next iteration while the last seconds are still playing.
        if (!this.destroyed) await decoder.reset();
      }
    } finally { this.freeDecoder(decoder); }
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;this.controller.abort();this.wake?.();
    this.stopSources();this.chunks = [];
    if (this.decoder) this.freeDecoder(this.decoder);
    this.gain.disconnect();
  }
}
