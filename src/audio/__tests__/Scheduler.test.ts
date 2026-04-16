import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Scheduler } from '../Scheduler';
import { FadeType } from '../../../types/Fade';
import { MockAudioBuffer, MockAudioContext, MockGainNode } from './webAudioMock';
import type { BufferCache } from '../BufferCache';
import type { ScheduledEntry, SfxClip, Fade } from '../types';

function setup(bufferDuration = 180) {
  const ctx = new MockAudioContext();
  const buffer = new MockAudioBuffer(bufferDuration);
  const bufferCache = {
    get: vi.fn((_id: string) => buffer),
  } as unknown as BufferCache;
  const musicTrackGain = new MockGainNode();
  const sfxTrackGain = new MockGainNode();
  const scheduler = new Scheduler(
    ctx as unknown as AudioContext,
    bufferCache,
    musicTrackGain as unknown as GainNode,
    sfxTrackGain as unknown as GainNode,
  );
  return { ctx, bufferCache, musicTrackGain, sfxTrackGain, scheduler, buffer };
}

function makeScheduledEntry(overrides: Partial<ScheduledEntry> = {}): ScheduledEntry {
  return {
    entryId: 'e1',
    bufferId: 'buf1',
    title: 'T',
    artist: 'A',
    absoluteStart: 0,
    absoluteEnd: 180,
    bufferOffset: 0,
    playDuration: 180,
    fades: [],
    ...overrides,
  };
}

describe('Scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('start()', () => {
    it('fires an immediate tick (no 25ms delay)', () => {
      const { scheduler, ctx } = setup();
      scheduler.setScheduledEntries([makeScheduledEntry()]);
      scheduler.start(0, 0);
      expect(ctx.getCreatedSourceNodes()).toHaveLength(1);
    });

    it('registers a 25ms recurring interval', () => {
      const { scheduler, ctx } = setup();
      scheduler.setScheduledEntries([makeScheduledEntry({ absoluteStart: 10 })]);
      scheduler.start(0, 0);
      // not yet in window
      expect(ctx.getCreatedSourceNodes()).toHaveLength(0);
      // advance close enough to lookahead window
      ctx.currentTime = 9.9;
      vi.advanceTimersByTime(25);
      expect(ctx.getCreatedSourceNodes()).toHaveLength(1);
    });

    it('skips an entry whose buffer is missing', () => {
      const { scheduler, ctx, bufferCache } = setup();
      vi.mocked(bufferCache.get).mockReturnValue(undefined);
      scheduler.setScheduledEntries([makeScheduledEntry()]);
      scheduler.start(0, 0);
      expect(ctx.getCreatedSourceNodes()).toHaveLength(0);
    });

    it('connects source -> gainNode -> musicTrackGain', () => {
      const { scheduler, ctx, musicTrackGain } = setup();
      scheduler.setScheduledEntries([makeScheduledEntry()]);
      scheduler.start(0, 0);
      const source = ctx.getCreatedSourceNodes()[0];
      const gain = ctx.getCreatedGainNodes()[0];
      expect(source.connected).toContain(gain);
      expect(gain.connected).toContain(musicTrackGain);
    });
  });

  describe('lookahead window', () => {
    it('skips entries past windowEnd (break early)', () => {
      const { scheduler, ctx } = setup();
      scheduler.setScheduledEntries([
        makeScheduledEntry({ entryId: 'e1', absoluteStart: 100 }),
        makeScheduledEntry({ entryId: 'e2', absoluteStart: 200 }),
      ]);
      scheduler.start(0, 0);
      expect(ctx.getCreatedSourceNodes()).toHaveLength(0);
    });

    it('skips entries already past (absoluteEnd <= currentTransport)', () => {
      const { scheduler, ctx } = setup();
      scheduler.setScheduledEntries([
        makeScheduledEntry({ entryId: 'e1', absoluteStart: 0, absoluteEnd: 10 }),
        makeScheduledEntry({ entryId: 'e2', absoluteStart: 20, absoluteEnd: 30 }),
      ]);
      scheduler.start(50, 0);
      expect(ctx.getCreatedSourceNodes()).toHaveLength(0);
    });

    it('does not schedule the same entry twice', () => {
      const { scheduler, ctx } = setup();
      scheduler.setScheduledEntries([makeScheduledEntry()]);
      scheduler.start(0, 0);
      vi.advanceTimersByTime(25);
      vi.advanceTimersByTime(25);
      expect(ctx.getCreatedSourceNodes()).toHaveLength(1);
    });
  });

  describe('mid-song seek scheduling', () => {
    it('adjusts bufferStartOffset when seeking into the middle of an entry', () => {
      const { scheduler, ctx } = setup();
      scheduler.setScheduledEntries([
        makeScheduledEntry({ absoluteStart: 0, absoluteEnd: 180, playDuration: 180 }),
      ]);
      scheduler.start(90, 0);
      const source = ctx.getCreatedSourceNodes()[0];
      const [when, offset, duration] = source.getStartCalls()[0];
      expect(when).toBe(0); // ctxStartTime = nowCtx
      expect(offset).toBe(90); // bufferStartOffset = 0 + 90
      expect(duration).toBe(90); // playDuration = 180 - 90
    });

    it('skips scheduling when remaining duration would be <= 0', () => {
      const { scheduler, ctx } = setup();
      scheduler.setScheduledEntries([
        makeScheduledEntry({ absoluteStart: 0, absoluteEnd: 10, playDuration: 10 }),
      ]);
      scheduler.start(10, 0);
      expect(ctx.getCreatedSourceNodes()).toHaveLength(0);
    });
  });

  describe('stopAll()', () => {
    it('clears the interval, disconnects nodes, clears activeNodes', () => {
      const { scheduler, ctx } = setup();
      scheduler.setScheduledEntries([makeScheduledEntry()]);
      scheduler.start(0, 0);
      expect(scheduler.getActiveNodes().size).toBe(1);
      const source = ctx.getCreatedSourceNodes()[0];
      scheduler.stopAll();
      expect(scheduler.getActiveNodes().size).toBe(0);
      expect(source.onended).toBeNull();
      expect(source.getStopCalls()).toHaveLength(1);
    });

    it('does not throw when called before start', () => {
      const { scheduler } = setup();
      expect(() => scheduler.stopAll()).not.toThrow();
    });
  });

  describe('cancelFutureNodes()', () => {
    it('cancels nodes whose scheduledStartCtx is beyond the audible grace', () => {
      const { scheduler, ctx } = setup();
      scheduler.setScheduledEntries([
        makeScheduledEntry({ absoluteStart: 0.15, absoluteEnd: 10, playDuration: 10 }),
      ]);
      scheduler.start(0, 0);
      expect(scheduler.getActiveNodes().size).toBe(1);
      ctx.currentTime = 0;
      const cancelled = scheduler.cancelFutureNodes();
      expect(cancelled).toHaveLength(1);
      expect(scheduler.getActiveNodes().size).toBe(0);
    });

    it('leaves currently-audible nodes alone', () => {
      const { scheduler } = setup();
      scheduler.setScheduledEntries([makeScheduledEntry()]);
      scheduler.start(0, 0);
      const cancelled = scheduler.cancelFutureNodes();
      expect(cancelled).toHaveLength(0);
      expect(scheduler.getActiveNodes().size).toBe(1);
    });
  });

  describe('cancelDisplacedNodes()', () => {
    it('cancels nodes whose entry was removed from scheduledEntries', () => {
      const { scheduler } = setup();
      scheduler.setScheduledEntries([makeScheduledEntry()]);
      scheduler.start(0, 0);
      scheduler.setScheduledEntries([]);
      scheduler.cancelDisplacedNodes();
      expect(scheduler.getActiveNodes().size).toBe(0);
    });

    it('leaves nodes whose entry still covers currentTransport', () => {
      const { scheduler } = setup();
      scheduler.setScheduledEntries([makeScheduledEntry()]);
      scheduler.start(0, 0);
      scheduler.cancelDisplacedNodes();
      expect(scheduler.getActiveNodes().size).toBe(1);
    });
  });

  describe('fadeOutNode()', () => {
    it('schedules a 50ms linear ramp + stop', () => {
      const { scheduler, ctx } = setup();
      scheduler.setScheduledEntries([makeScheduledEntry()]);
      scheduler.start(0, 0);
      const entryId = 'e1';
      ctx.currentTime = 5;
      scheduler.fadeOutNode(entryId);
      const source = ctx.getCreatedSourceNodes()[0];
      const stops = source.getStopCalls();
      expect(stops[stops.length - 1]).toBeCloseTo(5.05);
      const gain = ctx.getCreatedGainNodes()[0];

      const calls = (gain.gain as any).getCalls() as Array<{ method: string; args: number[] }>;
      const hasRamp = calls.some(
        (c) => c.method === 'linearRampToValueAtTime' && c.args[0] === 0 && c.args[1] === 5.05,
      );
      expect(hasRamp).toBe(true);
    });

    it('is a no-op for unknown ID', () => {
      const { scheduler } = setup();
      expect(() => scheduler.fadeOutNode('nope')).not.toThrow();
    });
  });

  describe('end-of-set detection', () => {
    it('calls onPlaybackEnded when past last entry and no active nodes', () => {
      const { scheduler } = setup();
      const cb = vi.fn();
      scheduler.setOnPlaybackEnded(cb);
      scheduler.setScheduledEntries([
        makeScheduledEntry({ absoluteStart: 0, absoluteEnd: 10, playDuration: 10 }),
      ]);
      scheduler.start(20, 0);
      // no active nodes (past the entry), should trigger callback
      expect(cb).toHaveBeenCalled();
    });

    it('does NOT call onPlaybackEnded when there are still active nodes', () => {
      const { scheduler } = setup();
      const cb = vi.fn();
      scheduler.setOnPlaybackEnded(cb);
      scheduler.setScheduledEntries([makeScheduledEntry()]);
      scheduler.start(0, 0);
      expect(cb).not.toHaveBeenCalled();
    });

    it('does NOT call onPlaybackEnded when playlist is empty', () => {
      const { scheduler } = setup();
      const cb = vi.fn();
      scheduler.setOnPlaybackEnded(cb);
      scheduler.setScheduledEntries([]);
      scheduler.start(0, 0);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('song change detection', () => {
    it('calls onSongChange when the primary entry changes', () => {
      const { scheduler, ctx } = setup();
      const cb = vi.fn();
      scheduler.setOnSongChange(cb);
      scheduler.setScheduledEntries([
        makeScheduledEntry({ entryId: 'a', absoluteStart: 0, absoluteEnd: 10, playDuration: 10 }),
        makeScheduledEntry({ entryId: 'b', absoluteStart: 10, absoluteEnd: 20, playDuration: 10 }),
      ]);
      scheduler.start(0, 0);
      expect(cb).toHaveBeenLastCalledWith('a', 'T', 'A');
      cb.mockClear();
      ctx.currentTime = 12;
      vi.advanceTimersByTime(25);
      expect(cb).toHaveBeenLastCalledWith('b', 'T', 'A');
    });

    it('does not fire again if the entry has not changed', () => {
      const { scheduler, ctx } = setup();
      const cb = vi.fn();
      scheduler.setOnSongChange(cb);
      scheduler.setScheduledEntries([
        makeScheduledEntry({ entryId: 'a', absoluteStart: 0, absoluteEnd: 10, playDuration: 10 }),
      ]);
      scheduler.start(0, 0);
      expect(cb).toHaveBeenCalledTimes(1);
      ctx.currentTime = 5;
      vi.advanceTimersByTime(25);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('prefers the later song during a crossfade overlap', () => {
      const { scheduler } = setup();
      const cb = vi.fn();
      scheduler.setOnSongChange(cb);
      scheduler.setScheduledEntries([
        makeScheduledEntry({ entryId: 'a', absoluteStart: 0, absoluteEnd: 180, playDuration: 180 }),
        makeScheduledEntry({
          entryId: 'b',
          absoluteStart: 175,
          absoluteEnd: 375,
          playDuration: 200,
        }),
      ]);
      scheduler.start(177, 0);
      expect(cb).toHaveBeenLastCalledWith('b', 'T', 'A');
    });
  });

  describe('applyFades() via scheduleEntry side effects', () => {
    function gainCallsFor(ctx: MockAudioContext) {
      // the gain node created for this source is the next one after the musicTrackGain
      // since we create exactly one gain node per scheduled entry
      const gain = ctx.getCreatedGainNodes()[0];

      return (gain.gain as any).getCalls() as Array<{ method: string; args: number[] }>;
    }

    it('sets gain to 1.0 at ctxStartTime when there are no fades', () => {
      const { scheduler, ctx } = setup();
      scheduler.setScheduledEntries([makeScheduledEntry()]);
      scheduler.start(0, 0);
      const calls = gainCallsFor(ctx);
      expect(calls[0]).toEqual({ method: 'setValueAtTime', args: [1.0, 0] });
    });

    it('emits linearRampToValueAtTime for a LINEAR fade', () => {
      const { scheduler, ctx } = setup();
      const fade: Fade = {
        type: FadeType.LINEAR,
        startOffset: 0,
        endOffset: 5,
        startGain: 0,
        endGain: 1,
      };
      scheduler.setScheduledEntries([makeScheduledEntry({ fades: [fade] })]);
      scheduler.start(0, 0);
      const calls = gainCallsFor(ctx);
      expect(calls.some((c) => c.method === 'linearRampToValueAtTime')).toBe(true);
      expect(calls.some((c) => c.method === 'exponentialRampToValueAtTime')).toBe(false);
    });

    it('emits exponentialRampToValueAtTime for an EXPONENTIAL fade', () => {
      const { scheduler, ctx } = setup();
      const fade: Fade = {
        type: FadeType.EXPONENTIAL,
        startOffset: 0,
        endOffset: 5,
        startGain: 0,
        endGain: 1,
      };
      scheduler.setScheduledEntries([makeScheduledEntry({ fades: [fade] })]);
      scheduler.start(0, 0);
      const calls = gainCallsFor(ctx);
      expect(calls.some((c) => c.method === 'exponentialRampToValueAtTime')).toBe(true);
    });

    it('clamps fade endGain to at least 0.0001 (epsilon for exponential)', () => {
      const { scheduler, ctx } = setup();
      const fade: Fade = {
        type: FadeType.EXPONENTIAL,
        startOffset: 0,
        endOffset: 5,
        startGain: 1,
        endGain: 0,
      };
      scheduler.setScheduledEntries([makeScheduledEntry({ fades: [fade] })]);
      scheduler.start(0, 0);
      const calls = gainCallsFor(ctx);
      const expCall = calls.find((c) => c.method === 'exponentialRampToValueAtTime');
      expect(expCall?.args[0]).toBe(0.0001);
    });

    it('skips fades that have already passed (seek past a fade)', () => {
      const { scheduler, ctx } = setup();
      const fade: Fade = {
        type: FadeType.LINEAR,
        startOffset: 0,
        endOffset: 5,
        startGain: 0,
        endGain: 1,
      };
      scheduler.setScheduledEntries([makeScheduledEntry({ fades: [fade] })]);
      scheduler.start(60, 0);
      const calls = gainCallsFor(ctx);
      // only the default setValueAtTime(1.0) should be present (no ramp scheduled)
      expect(calls.some((c) => c.method === 'linearRampToValueAtTime')).toBe(false);
    });
  });

  describe('SFX clip scheduling', () => {
    it('creates a source node connected to sfxTrackGain', () => {
      const { scheduler, ctx, sfxTrackGain } = setup();
      const sfx: SfxClip = {
        id: 'sfx1',
        bufferId: 'buf-sfx',
        absoluteStart: 0,
        duration: 2,
        bufferOffset: 0,
        gain: 0.5,
      };
      scheduler.setSfxClips([sfx]);
      scheduler.start(0, 0);
      const source = ctx.getCreatedSourceNodes()[0];
      const gain = ctx.getCreatedGainNodes()[0];
      expect(source.connected).toContain(gain);
      expect(gain.connected).toContain(sfxTrackGain);
    });

    it('applies the sfx gain via setValueAtTime', () => {
      const { scheduler, ctx } = setup();
      const sfx: SfxClip = {
        id: 'sfx1',
        bufferId: 'buf-sfx',
        absoluteStart: 0,
        duration: 2,
        bufferOffset: 0,
        gain: 0.25,
      };
      scheduler.setSfxClips([sfx]);
      scheduler.start(0, 0);
      const gain = ctx.getCreatedGainNodes()[0];

      const calls = (gain.gain as any).getCalls() as Array<{ method: string; args: number[] }>;
      expect(calls[0]).toEqual({ method: 'setValueAtTime', args: [0.25, 0] });
    });

    it('skips SFX with no remaining play duration after offset adjustment', () => {
      const { scheduler, ctx } = setup();
      const sfx: SfxClip = {
        id: 'sfx1',
        bufferId: 'buf-sfx',
        absoluteStart: 0,
        duration: 2,
        bufferOffset: 0,
        gain: 1,
      };
      scheduler.setSfxClips([sfx]);
      scheduler.start(2, 0);
      expect(ctx.getCreatedSourceNodes()).toHaveLength(0);
    });
  });
});
