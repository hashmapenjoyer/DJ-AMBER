import type { Gain } from './types';

/**
 * owns the WebAudio gain-node graph:
 *   per-track gains -> master gain -> destination
 *
 * exposes the track gain nodes so the Scheduler can connect
 * source nodes to the right bus.
 */
export class VolumeController {
  private readonly ctx: AudioContext;

  readonly masterGain: GainNode;
  readonly musicTrackGain: GainNode;
  readonly sfxTrackGain: GainNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.connect(ctx.destination);

    this.musicTrackGain = ctx.createGain();
    this.musicTrackGain.connect(this.masterGain);

    this.sfxTrackGain = ctx.createGain();
    this.sfxTrackGain.connect(this.masterGain);
  }

  setMaster(gain: Gain): void {
    this.masterGain.gain.setValueAtTime(gain, this.ctx.currentTime);
  }

  setMusic(gain: Gain): void {
    this.musicTrackGain.gain.setValueAtTime(gain, this.ctx.currentTime);
  }

  setSfx(gain: Gain): void {
    this.sfxTrackGain.gain.setValueAtTime(gain, this.ctx.currentTime);
  }
}
