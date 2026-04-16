import { describe, it, expect } from 'vitest';
import { PlaylistManager } from '../PlaylistManager';
import { FadeType } from '../../../types/Fade';
import type { PlaylistEntry, Transition } from '../types';

function makeEntry(id: string, duration: number): PlaylistEntry {
  return {
    id,
    bufferId: `buf-${id}`,
    title: `Song ${id}`,
    artist: 'Artist',
    duration,
  };
}

function makeTransition(
  from: string,
  to: string,
  duration: number,
  fadeOutType: FadeType = FadeType.LINEAR,
  fadeInType: FadeType = FadeType.LINEAR,
): Transition {
  return {
    id: `t-${from}-${to}`,
    fromEntryId: from,
    toEntryId: to,
    duration,
    fadeOutType,
    fadeInType,
  };
}

describe('PlaylistManager', () => {
  describe('appendEntry / getEntries', () => {
    it('starts with an empty list', () => {
      const pm = new PlaylistManager();
      expect(pm.getEntries()).toEqual([]);
    });

    it('appends entries in order', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('b', 20));
      const ids = pm.getEntries().map((e) => e.id);
      expect(ids).toEqual(['a', 'b']);
    });
  });

  describe('insertEntry', () => {
    it('inserts at index 0 (prepend)', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.insertEntry(0, makeEntry('b', 20));
      expect(pm.getEntries().map((e) => e.id)).toEqual(['b', 'a']);
    });

    it('inserts in the middle', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('c', 10));
      pm.insertEntry(1, makeEntry('b', 10));
      expect(pm.getEntries().map((e) => e.id)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('removeEntry', () => {
    it('removes the matching entry', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('b', 10));
      pm.removeEntry('a');
      expect(pm.getEntries().map((e) => e.id)).toEqual(['b']);
    });

    it('is a no-op for unknown ID', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.removeEntry('nope');
      expect(pm.getEntries()).toHaveLength(1);
    });

    it('removes transitions where the removed entry is fromEntryId', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('b', 10));
      pm.setTransition(makeTransition('a', 'b', 2));
      pm.removeEntry('a');
      expect(pm.getTransitions()).toHaveLength(0);
    });

    it('removes transitions where the removed entry is toEntryId', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('b', 10));
      pm.setTransition(makeTransition('a', 'b', 2));
      pm.removeEntry('b');
      expect(pm.getTransitions()).toHaveLength(0);
    });

    it('preserves unrelated transitions', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('b', 10));
      pm.appendEntry(makeEntry('c', 10));
      pm.appendEntry(makeEntry('d', 10));
      pm.setTransition(makeTransition('a', 'b', 2));
      pm.setTransition(makeTransition('c', 'd', 2));
      pm.removeEntry('a');
      expect(pm.getTransitions()).toHaveLength(1);
      expect(pm.getTransitions()[0].fromEntryId).toBe('c');
    });
  });

  describe('moveEntry', () => {
    it('moves an entry from 0 to 2', () => {
      const pm = new PlaylistManager();
      ['a', 'b', 'c'].forEach((id) => pm.appendEntry(makeEntry(id, 10)));
      pm.moveEntry(0, 2);
      expect(pm.getEntries().map((e) => e.id)).toEqual(['b', 'c', 'a']);
    });

    it('moves an entry from 2 to 0', () => {
      const pm = new PlaylistManager();
      ['a', 'b', 'c'].forEach((id) => pm.appendEntry(makeEntry(id, 10)));
      pm.moveEntry(2, 0);
      expect(pm.getEntries().map((e) => e.id)).toEqual(['c', 'a', 'b']);
    });

    it('is a no-op for out-of-bounds fromIndex', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.moveEntry(5, 0);
      expect(pm.getEntries().map((e) => e.id)).toEqual(['a']);
    });

    it('is a no-op for out-of-bounds toIndex', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.moveEntry(0, 5);
      expect(pm.getEntries().map((e) => e.id)).toEqual(['a']);
    });

    it('prunes transitions that are no longer adjacent after a move', () => {
      const pm = new PlaylistManager();
      ['a', 'b', 'c'].forEach((id) => pm.appendEntry(makeEntry(id, 10)));
      pm.setTransition(makeTransition('a', 'b', 2));
      // after move: c, a, b -> a->b still adjacent
      pm.moveEntry(2, 0);
      expect(pm.getTransitions()).toHaveLength(1);
      // now move a to 0 -> a, c, b -> a->b NOT adjacent
      const pm2 = new PlaylistManager();
      ['a', 'b', 'c'].forEach((id) => pm2.appendEntry(makeEntry(id, 10)));
      pm2.setTransition(makeTransition('a', 'b', 2));
      pm2.moveEntry(1, 2); // a, c, b
      expect(pm2.getTransitions()).toHaveLength(0);
    });
  });

  describe('setTransition', () => {
    it('rejects transition when fromEntryId does not exist', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.setTransition(makeTransition('x', 'a', 2));
      expect(pm.getTransitions()).toHaveLength(0);
    });

    it('rejects transition when toEntryId does not exist', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.setTransition(makeTransition('a', 'x', 2));
      expect(pm.getTransitions()).toHaveLength(0);
    });

    it('rejects transition between non-adjacent entries', () => {
      const pm = new PlaylistManager();
      ['a', 'b', 'c'].forEach((id) => pm.appendEntry(makeEntry(id, 10)));
      pm.setTransition(makeTransition('a', 'c', 2));
      expect(pm.getTransitions()).toHaveLength(0);
    });

    it('accepts a valid adjacent transition', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('b', 10));
      pm.setTransition(makeTransition('a', 'b', 2));
      expect(pm.getTransitions()).toHaveLength(1);
    });

    it('clamps duration to the shorter of the two songs', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('b', 8));
      pm.setTransition(makeTransition('a', 'b', 12));
      expect(pm.getTransitions()[0].duration).toBe(8);
    });

    it('does not clamp when duration fits in both songs', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('b', 10));
      pm.setTransition(makeTransition('a', 'b', 5));
      expect(pm.getTransitions()[0].duration).toBe(5);
    });

    it('replaces an existing transition between the same pair', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('b', 10));
      pm.setTransition(makeTransition('a', 'b', 2));
      pm.setTransition(makeTransition('a', 'b', 4));
      expect(pm.getTransitions()).toHaveLength(1);
      expect(pm.getTransitions()[0].duration).toBe(4);
    });
  });

  describe('removeTransition / removeTransitionBetween', () => {
    it('removeTransition removes by ID', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('b', 10));
      const t = makeTransition('a', 'b', 2);
      pm.setTransition(t);
      pm.removeTransition(t.id);
      expect(pm.getTransitions()).toHaveLength(0);
    });

    it('removeTransitionBetween removes by pair', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('b', 10));
      pm.setTransition(makeTransition('a', 'b', 2));
      pm.removeTransitionBetween('a', 'b');
      expect(pm.getTransitions()).toHaveLength(0);
    });

    it('neither throws for unknown ID/pair', () => {
      const pm = new PlaylistManager();
      expect(() => pm.removeTransition('nope')).not.toThrow();
      expect(() => pm.removeTransitionBetween('a', 'b')).not.toThrow();
    });
  });

  describe('getTransitionBetween', () => {
    it('returns the transition when present', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('b', 10));
      pm.setTransition(makeTransition('a', 'b', 2));
      expect(pm.getTransitionBetween('a', 'b')?.duration).toBe(2);
    });

    it('returns undefined when not present', () => {
      const pm = new PlaylistManager();
      expect(pm.getTransitionBetween('a', 'b')).toBeUndefined();
    });
  });

  describe('computeTimeline', () => {
    it('returns empty array when playlist is empty', () => {
      const pm = new PlaylistManager();
      expect(pm.computeTimeline()).toEqual([]);
    });

    it('single song: one entry, no fades, correct span', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 100));
      const timeline = pm.computeTimeline();
      expect(timeline).toHaveLength(1);
      expect(timeline[0].absoluteStart).toBe(0);
      expect(timeline[0].absoluteEnd).toBe(100);
      expect(timeline[0].bufferOffset).toBe(0);
      expect(timeline[0].playDuration).toBe(100);
      expect(timeline[0].fades).toEqual([]);
    });

    it('two songs, no transition: sequential with no fades', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 100));
      pm.appendEntry(makeEntry('b', 200));
      const timeline = pm.computeTimeline();
      expect(timeline[0].absoluteStart).toBe(0);
      expect(timeline[0].absoluteEnd).toBe(100);
      expect(timeline[1].absoluteStart).toBe(100);
      expect(timeline[1].absoluteEnd).toBe(300);
      expect(timeline[0].fades).toEqual([]);
      expect(timeline[1].fades).toEqual([]);
    });

    it('two songs with 5s crossfade: A=180, B=200', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 180));
      pm.appendEntry(makeEntry('b', 200));
      pm.setTransition(makeTransition('a', 'b', 5));
      const [a, b] = pm.computeTimeline();

      expect(a.absoluteStart).toBe(0);
      expect(a.absoluteEnd).toBe(180);
      expect(a.fades).toHaveLength(1);
      expect(a.fades[0]).toEqual({
        type: FadeType.LINEAR,
        startOffset: 175,
        endOffset: 180,
        startGain: 1,
        endGain: 0,
      });

      expect(b.absoluteStart).toBe(175);
      expect(b.absoluteEnd).toBe(375);
      expect(b.fades).toHaveLength(1);
      expect(b.fades[0]).toEqual({
        type: FadeType.LINEAR,
        startOffset: 0,
        endOffset: 5,
        startGain: 0,
        endGain: 1,
      });
    });

    it('three songs with two transitions matches docstring example', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 180));
      pm.appendEntry(makeEntry('b', 200));
      pm.appendEntry(makeEntry('c', 150));
      pm.setTransition(makeTransition('a', 'b', 5));
      pm.setTransition(makeTransition('b', 'c', 3));
      const [a, b, c] = pm.computeTimeline();

      expect(a.absoluteStart).toBe(0);
      expect(a.absoluteEnd).toBe(180);
      expect(a.fades).toHaveLength(1);

      expect(b.absoluteStart).toBe(175);
      expect(b.absoluteEnd).toBe(375);
      expect(b.fades).toHaveLength(2);
      // fadeIn first
      expect(b.fades[0]).toMatchObject({ startOffset: 0, endOffset: 5, startGain: 0, endGain: 1 });
      // fadeOut second
      expect(b.fades[1]).toMatchObject({
        startOffset: 197,
        endOffset: 200,
        startGain: 1,
        endGain: 0,
      });

      expect(c.absoluteStart).toBe(372);
      expect(c.absoluteEnd).toBe(522);
      expect(c.fades).toHaveLength(1);
    });

    it('three songs with only first transition: C starts at B.end with no fade', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 100));
      pm.appendEntry(makeEntry('b', 100));
      pm.appendEntry(makeEntry('c', 100));
      pm.setTransition(makeTransition('a', 'b', 5));
      const [, b, c] = pm.computeTimeline();
      expect(c.absoluteStart).toBe(b.absoluteEnd);
      expect(c.fades).toEqual([]);
    });

    it('propagates FadeType (EXPONENTIAL)', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 100));
      pm.appendEntry(makeEntry('b', 100));
      pm.setTransition(makeTransition('a', 'b', 5, FadeType.EXPONENTIAL, FadeType.EXPONENTIAL));
      const [a, b] = pm.computeTimeline();
      expect(a.fades[0].type).toBe(FadeType.EXPONENTIAL);
      expect(b.fades[0].type).toBe(FadeType.EXPONENTIAL);
    });

    it('reflects clamped transition duration in the timeline', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      pm.appendEntry(makeEntry('b', 8));
      pm.setTransition(makeTransition('a', 'b', 20));
      const [a, b] = pm.computeTimeline();
      // clamped to 8
      expect(a.absoluteEnd).toBe(10);
      expect(a.fades[0].startOffset).toBe(2); // 10-8
      expect(b.absoluteStart).toBe(2); // 10-8
      expect(b.fades[0].endOffset).toBe(8);
    });
  });

  describe('getTotalDuration', () => {
    it('returns 0 for empty playlist', () => {
      expect(new PlaylistManager().getTotalDuration()).toBe(0);
    });

    it('returns song duration for single song', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 42));
      expect(pm.getTotalDuration()).toBe(42);
    });

    it('returns sum minus crossfade for two songs with transition', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 180));
      pm.appendEntry(makeEntry('b', 200));
      pm.setTransition(makeTransition('a', 'b', 5));
      expect(pm.getTotalDuration()).toBe(375);
    });
  });

  describe('getEntryAtTime', () => {
    it('returns undefined for empty playlist', () => {
      expect(new PlaylistManager().getEntryAtTime(0)).toBeUndefined();
    });

    it('returns undefined for negative time', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      expect(pm.getEntryAtTime(-1)).toBeUndefined();
    });

    it('returns the first song at t=0', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      expect(pm.getEntryAtTime(0)?.entryId).toBe('a');
    });

    it('returns the later song during crossfade overlap', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 180));
      pm.appendEntry(makeEntry('b', 200));
      pm.setTransition(makeTransition('a', 'b', 5));
      // overlap window: [175, 180)
      expect(pm.getEntryAtTime(177)?.entryId).toBe('b');
    });

    it('returns the first song before the crossfade starts', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 180));
      pm.appendEntry(makeEntry('b', 200));
      pm.setTransition(makeTransition('a', 'b', 5));
      expect(pm.getEntryAtTime(100)?.entryId).toBe('a');
    });

    it('returns undefined at exactly the end of the last song', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      expect(pm.getEntryAtTime(10)).toBeUndefined();
    });

    it('returns the last song just before its end', () => {
      const pm = new PlaylistManager();
      pm.appendEntry(makeEntry('a', 10));
      expect(pm.getEntryAtTime(9.999)?.entryId).toBe('a');
    });
  });
});
