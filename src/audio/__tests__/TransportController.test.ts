import { describe, it, expect, vi } from 'vitest';
import { TransportController } from '../TransportController';
import { MockAudioContext } from './webAudioMock';
import type { Scheduler } from '../Scheduler';

function setup(totalDuration = 100) {
  const ctx = new MockAudioContext();
  const scheduler = {
    start: vi.fn(),
    stopAll: vi.fn(),
  } as unknown as Scheduler;
  const getDuration = vi.fn(() => totalDuration);
  const onStateChange = vi.fn();
  const transport = new TransportController(
    ctx as unknown as AudioContext,
    scheduler,
    getDuration,
    onStateChange,
  );
  return { ctx, scheduler, getDuration, onStateChange, transport };
}

describe('TransportController', () => {
  describe('initial state', () => {
    it('getState() is "stopped"', () => {
      const { transport } = setup();
      expect(transport.getState()).toBe('stopped');
    });

    it('getCurrentTime() is 0', () => {
      const { transport } = setup();
      expect(transport.getCurrentTime()).toBe(0);
    });
  });

  describe('play()', () => {
    it('transitions to playing, calls scheduler.start, fires onStateChange', async () => {
      const { transport, scheduler, onStateChange } = setup();
      await transport.play();
      expect(transport.getState()).toBe('playing');
      expect(scheduler.start).toHaveBeenCalledTimes(1);
      expect(onStateChange).toHaveBeenCalledWith('playing');
    });

    it('calls ctx.resume() only when suspended', async () => {
      const { ctx, transport } = setup();
      const resumeSpy = vi.spyOn(ctx, 'resume');
      ctx.state = 'suspended';
      await transport.play();
      expect(resumeSpy).toHaveBeenCalledTimes(1);
    });

    it('does not call ctx.resume() when already running', async () => {
      const { ctx, transport } = setup();
      ctx.state = 'running';
      const resumeSpy = vi.spyOn(ctx, 'resume');
      await transport.play();
      expect(resumeSpy).not.toHaveBeenCalled();
    });

    it('is a no-op when already playing', async () => {
      const { transport, scheduler } = setup();
      await transport.play();
      await transport.play();
      expect(scheduler.start).toHaveBeenCalledTimes(1);
    });

    it('starts scheduler with transportTime=0 on fresh play', async () => {
      const { transport, scheduler, ctx } = setup();
      ctx.currentTime = 5.0;
      await transport.play();
      expect(scheduler.start).toHaveBeenCalledWith(0, 5.0);
    });
  });

  describe('pause()', () => {
    it('transitions to paused, calls stopAll, fires onStateChange', async () => {
      const { transport, scheduler, onStateChange } = setup();
      await transport.play();
      onStateChange.mockClear();
      transport.pause();
      expect(transport.getState()).toBe('paused');
      expect(scheduler.stopAll).toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledWith('paused');
    });

    it('is a no-op when not playing', () => {
      const { transport, scheduler } = setup();
      transport.pause();
      expect(scheduler.stopAll).not.toHaveBeenCalled();
    });

    it('captures the current transport time into pausedAt', async () => {
      const { transport, ctx } = setup();
      ctx.currentTime = 0;
      await transport.play();
      ctx.currentTime = 2.5;
      transport.pause();
      expect(transport.getCurrentTime()).toBeCloseTo(2.5);
    });
  });

  describe('stop()', () => {
    it('transitions to stopped, resets pausedAt, calls stopAll and onStateChange', async () => {
      const { transport, scheduler, onStateChange } = setup();
      await transport.play();
      onStateChange.mockClear();
      transport.stop();
      expect(transport.getState()).toBe('stopped');
      expect(transport.getCurrentTime()).toBe(0);
      expect(scheduler.stopAll).toHaveBeenCalled();
      expect(onStateChange).toHaveBeenCalledWith('stopped');
    });

    it('does not throw when already stopped', () => {
      const { transport } = setup();
      expect(() => transport.stop()).not.toThrow();
    });
  });

  describe('seek()', () => {
    it('clamps negative time to 0', () => {
      const { transport } = setup(100);
      transport.seek(-5);
      expect(transport.getCurrentTime()).toBe(0);
    });

    it('clamps time above total duration', () => {
      const { transport } = setup(100);
      transport.seek(500);
      expect(transport.getCurrentTime()).toBe(100);
    });

    it('when paused: updates pausedAt without calling scheduler.start', async () => {
      const { transport, scheduler } = setup();
      await transport.play();
      transport.pause();
      scheduler.stopAll = vi.fn();
      scheduler.start = vi.fn();
      transport.seek(30);
      expect(transport.getCurrentTime()).toBe(30);
      expect(scheduler.start).not.toHaveBeenCalled();
    });

    it('when stopped: updates pausedAt without calling scheduler.start', () => {
      const { transport, scheduler } = setup();
      transport.seek(30);
      expect(transport.getCurrentTime()).toBe(30);
      expect(scheduler.start).not.toHaveBeenCalled();
    });

    it('when playing: calls stopAll then start at the new time', async () => {
      const { transport, scheduler, ctx } = setup();
      await transport.play();
      vi.mocked(scheduler.stopAll).mockClear();
      vi.mocked(scheduler.start).mockClear();
      ctx.currentTime = 7.5;
      transport.seek(42);
      expect(scheduler.stopAll).toHaveBeenCalledTimes(1);
      expect(scheduler.start).toHaveBeenCalledWith(42, 7.5);
    });
  });

  describe('getCurrentTime() while playing', () => {
    it('returns pausedAt when stopped', () => {
      const { transport } = setup();
      expect(transport.getCurrentTime()).toBe(0);
    });

    it('returns transportTimeAtPlay + elapsed ctx time during playback', async () => {
      const { ctx, transport } = setup();
      ctx.currentTime = 1.0;
      await transport.play();
      ctx.currentTime = 3.5;
      expect(transport.getCurrentTime()).toBeCloseTo(2.5);
    });

    it('returns the seeked position immediately after seek() while paused', async () => {
      const { transport } = setup();
      await transport.play();
      transport.pause();
      transport.seek(42);
      expect(transport.getCurrentTime()).toBe(42);
    });
  });
});
