import type { Seconds, TransportState } from './types';
import type { Scheduler } from './Scheduler';

/**
 * owns the transport state machine (stopped/playing/paused)
 * and play-head position bookkeeping.
 *
 * does NOT know about playlists, volume, or events. the mediator
 * (AudioEngine) wires those concerns together.
 */
export class TransportController {
  private readonly ctx: AudioContext;
  private readonly scheduler: Scheduler;
  private readonly getDuration: () => Seconds;
  private readonly onStateChange: (state: TransportState) => void;
  private readonly onSeek: (time: Seconds) => void;

  private state: TransportState = 'stopped';
  private transportTimeAtPlay: Seconds = 0;
  private contextTimeAtPlay: number = 0;
  private pausedAt: Seconds = 0;

  constructor(
    ctx: AudioContext,
    scheduler: Scheduler,
    getDuration: () => Seconds,
    onStateChange: (state: TransportState) => void,
    onSeek: (time: Seconds) => void = () => {},
  ) {
    this.ctx = ctx;
    this.scheduler = scheduler;
    this.getDuration = getDuration;
    this.onStateChange = onStateChange;
    this.onSeek = onSeek;
  }

  async play(): Promise<void> {
    if (this.state === 'playing') return;

    // browser requires user gesture to resume AudioContext
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.contextTimeAtPlay = this.ctx.currentTime;
    this.transportTimeAtPlay = this.pausedAt;
    this.state = 'playing';

    this.scheduler.start(this.transportTimeAtPlay, this.contextTimeAtPlay);
    this.onStateChange('playing');
  }

  pause(): void {
    if (this.state !== 'playing') return;

    this.pausedAt = this.getCurrentTime();
    this.scheduler.stopAll();
    this.state = 'paused';
    this.onStateChange('paused');
  }

  stop(): void {
    this.scheduler.stopAll();
    this.pausedAt = 0;
    this.state = 'stopped';
    this.onStateChange('stopped');
  }

  seek(time: Seconds): void {
    const totalDuration = this.getDuration();
    this.pausedAt = Math.max(0, Math.min(time, totalDuration));

    if (this.state === 'playing') {
      this.scheduler.stopAll();
      this.contextTimeAtPlay = this.ctx.currentTime;
      this.transportTimeAtPlay = this.pausedAt;
      this.scheduler.start(this.pausedAt, this.contextTimeAtPlay);
    } else {
      // paused/stopped: playhead moves but no audio — notify so song title updates
      this.onSeek(this.pausedAt);
    }
  }

  /** pure arithmetic, safe to call 60fps in a rAF loop */
  getCurrentTime(): Seconds {
    if (this.state === 'playing') {
      return this.transportTimeAtPlay + (this.ctx.currentTime - this.contextTimeAtPlay);
    }
    return this.pausedAt;
  }

  getState(): TransportState {
    return this.state;
  }
}
