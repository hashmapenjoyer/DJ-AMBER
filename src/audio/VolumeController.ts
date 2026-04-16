import type { Gain } from './types';

/**
 * owns the WebAudio gain-node graph:
 *   musicTrackGain -> highpassFilter -> lowpassFilter -> masterGain -> destination
 *   sfxTrackGain                                      -> masterGain
 *
 * exposes the track gain nodes so the Scheduler can connect
 * source nodes to the right bus.
 */
export class VolumeController {
  private readonly ctx: AudioContext;

  readonly masterGain: GainNode;
  readonly musicTrackGain: GainNode;
  readonly sfxTrackGain: GainNode;

  private readonly highpassFilter: BiquadFilterNode;
  private readonly lowpassFilter: BiquadFilterNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.connect(ctx.destination);

    this.highpassFilter = ctx.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.value = 20; // 20 Hz = effectively bypassed

    this.lowpassFilter = ctx.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.value = 20000; // 20 kHz = effectively bypassed

    this.musicTrackGain = ctx.createGain();
    this.musicTrackGain.connect(this.highpassFilter);
    this.highpassFilter.connect(this.lowpassFilter);
    this.lowpassFilter.connect(this.masterGain);

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

  /** Set the highpass cutoff frequency in Hz. 20 Hz = effectively bypassed. */
  setHighpass(freq: number): void {
    this.highpassFilter.frequency.setValueAtTime(freq, this.ctx.currentTime);
  }

  /** Set the lowpass cutoff frequency in Hz. 20000 Hz = effectively bypassed. */
  setLowpass(freq: number): void {
    this.lowpassFilter.frequency.setValueAtTime(freq, this.ctx.currentTime);
  }
}
