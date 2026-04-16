import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioEngine } from '../AudioEngine';
import type { MockAudioContext } from './webAudioMock';

async function addBufferToCache(engine: AudioEngine, id: string, duration: number): Promise<void> {
  const ctx = engine.ctx as unknown as MockAudioContext;
  ctx.setDecodedDuration(duration);
  await engine.buffers.add(id, new ArrayBuffer(8));
}

describe('AudioEngine', () => {
  let engine: AudioEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new AudioEngine();
  });

  afterEach(() => {
    engine.transport.stop();
    vi.useRealTimers();
  });

  describe('event emission', () => {
    it('emits playlistChange after append', async () => {
      await addBufferToCache(engine, 'buf1', 120);
      const spy = vi.fn();
      engine.on('playlistChange', spy);
      engine.playlist.append('buf1', 'T', 'A');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].entries).toHaveLength(1);
    });

    it('emits timelineChange after append', async () => {
      await addBufferToCache(engine, 'buf1', 120);
      const spy = vi.fn();
      engine.on('timelineChange', spy);
      engine.playlist.append('buf1', 'T', 'A');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].entries).toHaveLength(1);
    });

    it('emits stateChange { playing } after transport.play', async () => {
      const spy = vi.fn();
      engine.on('stateChange', spy);
      await engine.transport.play();
      expect(spy).toHaveBeenCalledWith({ state: 'playing' });
    });

    it('emits stateChange { paused } after transport.pause', async () => {
      await engine.transport.play();
      const spy = vi.fn();
      engine.on('stateChange', spy);
      engine.transport.pause();
      expect(spy).toHaveBeenCalledWith({ state: 'paused' });
    });

    it('emits stateChange { stopped } after transport.stop', async () => {
      await engine.transport.play();
      const spy = vi.fn();
      engine.on('stateChange', spy);
      engine.transport.stop();
      expect(spy).toHaveBeenCalledWith({ state: 'stopped' });
    });

    it('emits songChange while playing as the scheduler reports changes', async () => {
      await addBufferToCache(engine, 'buf1', 10);
      engine.playlist.append('buf1', 'Title', 'Artist');
      const spy = vi.fn();
      engine.on('songChange', spy);
      await engine.transport.play();
      // first tick should have reported the initial song
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toMatchObject({ title: 'Title', artist: 'Artist' });
    });
  });

  describe('recomputeAndSync', () => {
    it('updates getTimeline() after append', async () => {
      await addBufferToCache(engine, 'buf1', 60);
      expect(engine.getTimeline()).toHaveLength(0);
      engine.playlist.append('buf1', 'T', 'A');
      expect(engine.getTimeline()).toHaveLength(1);
    });

    it('updates the scheduler so getCurrentEntry finds the new entry', async () => {
      await addBufferToCache(engine, 'buf1', 60);
      engine.playlist.append('buf1', 'T', 'A');
      expect(engine.getCurrentEntry()?.title).toBe('T');
    });
  });

  describe('getCurrentEntry()', () => {
    it('returns undefined when playlist is empty', () => {
      expect(engine.getCurrentEntry()).toBeUndefined();
    });
  });

  describe('getTotalDuration()', () => {
    it('delegates to playlistManager', async () => {
      await addBufferToCache(engine, 'buf1', 42);
      engine.playlist.append('buf1', 'T', 'A');
      expect(engine.getTotalDuration()).toBe(42);
    });
  });

  describe('end-of-set: transport.stop fires from scheduler callback', () => {
    it('transitions transport to stopped when playback ends', async () => {
      await addBufferToCache(engine, 'buf1', 1);
      engine.playlist.append('buf1', 'T', 'A');
      await engine.transport.play();

      // advance past the end
      const ctx = engine.ctx as unknown as MockAudioContext;
      ctx.currentTime = 2;
      vi.advanceTimersByTime(25);

      expect(engine.transport.getState()).toBe('stopped');
    });
  });

  describe('handleBeforeRemove (via PlaylistController.remove)', () => {
    it('during playback: calls fadeOutNode on the currently playing entry', async () => {
      await addBufferToCache(engine, 'buf1', 60);
      engine.playlist.append('buf1', 'T', 'A');
      const entries = engine.playlist.getEntries();
      const entryId = entries[0].id;

      await engine.transport.play();
      const ctx = engine.ctx as unknown as MockAudioContext;
      ctx.currentTime = 1;

      const sources = ctx.getCreatedSourceNodes();
      const initialStopCount = sources[sources.length - 1].getStopCalls().length;

      engine.playlist.remove(entryId);

      const finalStopCount = sources[sources.length - 1].getStopCalls().length;
      expect(finalStopCount).toBeGreaterThan(initialStopCount);
    });

    it('when stopped: does not schedule any fadeOut', async () => {
      await addBufferToCache(engine, 'buf1', 60);
      engine.playlist.append('buf1', 'T', 'A');
      const entryId = engine.playlist.getEntries()[0].id;
      const ctx = engine.ctx as unknown as MockAudioContext;
      const sourcesBefore = ctx.getCreatedSourceNodes().length;
      engine.playlist.remove(entryId);
      expect(ctx.getCreatedSourceNodes().length).toBe(sourcesBefore);
    });
  });

  describe('volume passthrough', () => {
    it('volume.setMaster calls setValueAtTime on masterGain', () => {
      engine.volume.setMaster(0.6);

      const calls = (engine.volume.masterGain.gain as any).getCalls() as Array<{
        method: string;
        args: number[];
      }>;
      expect(calls.some((c) => c.method === 'setValueAtTime' && c.args[0] === 0.6)).toBe(true);
    });
  });
});
