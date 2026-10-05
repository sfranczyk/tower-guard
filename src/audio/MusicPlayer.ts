import { MUSIC_FADE_S, MUSIC_LOOP_END_S, MUSIC_LOOP_START_S } from '../config';

/**
 * The looping theme. The file plays its intro once, then loops MUSIC_LOOP_START_S..MUSIC_LOOP_END_S
 * (the end of that range is crossfaded into its start in the file itself, so the seam is inaudible).
 * It keeps playing across scene changes; turning it off fades out, and turning it back on resumes
 * inside the loop rather than replaying the intro.
 */
export class MusicPlayer {
  private readonly gain: GainNode;
  private buffer?: AudioBuffer;
  private source?: AudioBufferSourceNode;
  private wanted = false;
  private playedIntro = false;
  private volume = 1;

  public constructor(private readonly context: AudioContext, destination: AudioNode) {
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(destination);
  }

  /** Decodes the track and starts it if music is on (it waits silently while the context is suspended). */
  public async load(url: string): Promise<void> {
    try {
      this.buffer = await this.context.decodeAudioData(await (await fetch(url)).arrayBuffer());
    } catch {
      return; // No music: the game plays on without it.
    }
    this.sync();
  }

  public setPlaying(playing: boolean): void {
    this.wanted = playing;
    this.sync();
  }

  public setVolume(volume: number): void {
    this.volume = volume;
    if (this.source) {
      this.rampTo(volume);
    }
  }

  private sync(): void {
    if (this.wanted && !this.source && this.buffer) {
      this.start(this.buffer);
    } else if (!this.wanted && this.source) {
      this.stop();
    }
  }

  private start(buffer: AudioBuffer): void {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = MUSIC_LOOP_START_S;
    source.loopEnd = Math.min(MUSIC_LOOP_END_S, buffer.duration);
    source.connect(this.gain);
    source.start(0, this.playedIntro ? MUSIC_LOOP_START_S : 0);
    this.playedIntro = true;
    this.source = source;
    this.rampTo(this.volume);
  }

  private stop(): void {
    const source = this.source;
    this.source = undefined;
    this.rampTo(0);
    source?.stop(this.context.currentTime + MUSIC_FADE_S);
  }

  private rampTo(value: number): void {
    const now = this.context.currentTime;
    const gain = this.gain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(value, now + MUSIC_FADE_S);
  }
}
