import { describe, it, expect } from 'vitest';
import { VolumeController } from '../VolumeController';
import { MockAudioContext } from './webAudioMock';

function setup(): { vc: VolumeController; ctx: MockAudioContext } {
  const ctx = new MockAudioContext();
  const vc = new VolumeController(ctx as unknown as AudioContext);
  return { vc, ctx };
}

describe('VolumeController', () => {
  describe('constructor graph wiring', () => {
    it('creates exactly 3 GainNodes', () => {
      const { ctx } = setup();
      expect(ctx.getCreatedGainNodes()).toHaveLength(3);
    });

    it('connects masterGain to ctx.destination', () => {
      const { vc, ctx } = setup();
      // masterGain.connected should include ctx.destination

      const master = vc.masterGain as any;
      expect(master.connected).toContain(ctx.destination);
    });

    it('connects musicTrackGain through filters to masterGain', () => {
      const { vc, ctx } = setup();

      // musicTrackGain -> highpassFilter -> lowpassFilter -> masterGain
      const [highpass, lowpass] = ctx.getCreatedBiquadFilterNodes();
      const music = vc.musicTrackGain as any;
      expect(music.connected).toContain(highpass);
      expect((highpass as any).connected).toContain(lowpass);
      expect((lowpass as any).connected).toContain(vc.masterGain);
    });

    it('connects sfxTrackGain to masterGain', () => {
      const { vc } = setup();

      const sfx = vc.sfxTrackGain as any;
      expect(sfx.connected).toContain(vc.masterGain);
    });
  });

  describe('setMaster', () => {
    it('calls setValueAtTime on masterGain with ctx.currentTime', () => {
      const { vc, ctx } = setup();
      ctx.currentTime = 1.5;
      vc.setMaster(0.7);

      const calls = (vc.masterGain.gain as any).getCalls();
      expect(calls).toContainEqual({ method: 'setValueAtTime', args: [0.7, 1.5] });
    });
  });

  describe('setMusic', () => {
    it('calls setValueAtTime on musicTrackGain', () => {
      const { vc, ctx } = setup();
      ctx.currentTime = 2.0;
      vc.setMusic(0.5);

      const calls = (vc.musicTrackGain.gain as any).getCalls();
      expect(calls).toContainEqual({ method: 'setValueAtTime', args: [0.5, 2.0] });
    });
  });

  describe('setSfx', () => {
    it('calls setValueAtTime on sfxTrackGain', () => {
      const { vc, ctx } = setup();
      ctx.currentTime = 3.0;
      vc.setSfx(0.25);

      const calls = (vc.sfxTrackGain.gain as any).getCalls();
      expect(calls).toContainEqual({ method: 'setValueAtTime', args: [0.25, 3.0] });
    });
  });
});
