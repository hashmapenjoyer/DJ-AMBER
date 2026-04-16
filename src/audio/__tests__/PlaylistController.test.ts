import { describe, it, expect, vi } from 'vitest';
import { PlaylistController } from '../PlaylistController';
import { PlaylistManager } from '../PlaylistManager';
import { FadeType } from '../../../types/Fade';
import type { BufferCache } from '../BufferCache';

function setup(durationByBuffer: Record<string, number> = { 'buf-1': 120, 'buf-2': 60 }) {
  const pm = new PlaylistManager();
  const bufferCache = {
    getDuration: vi.fn((id: string) => durationByBuffer[id]),
  } as unknown as BufferCache;
  const onChanged = vi.fn();
  const onBeforeRemove = vi.fn();
  const ctrl = new PlaylistController(pm, bufferCache, onChanged, onBeforeRemove);
  return { pm, ctrl, onChanged, onBeforeRemove };
}

describe('PlaylistController', () => {
  describe('append()', () => {
    it('is a no-op when the buffer is not cached', () => {
      const { ctrl, pm, onChanged } = setup();
      ctrl.append('missing', 'title', 'artist');
      expect(pm.getEntries()).toHaveLength(0);
      expect(onChanged).not.toHaveBeenCalled();
    });

    it('appends an entry with correct fields and calls onChanged', () => {
      const { ctrl, pm, onChanged } = setup();
      ctrl.append('buf-1', 'Song A', 'Artist A');
      const entries = pm.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        bufferId: 'buf-1',
        title: 'Song A',
        artist: 'Artist A',
        duration: 120,
      });
      expect(typeof entries[0].id).toBe('string');
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('insert()', () => {
    it('is a no-op when buffer is not cached', () => {
      const { ctrl, pm, onChanged } = setup();
      ctrl.insert(0, 'missing', 't', 'a');
      expect(pm.getEntries()).toHaveLength(0);
      expect(onChanged).not.toHaveBeenCalled();
    });

    it('inserts at the specified index and calls onChanged', () => {
      const { ctrl, pm, onChanged } = setup();
      ctrl.append('buf-1', 'A', '');
      ctrl.insert(0, 'buf-2', 'B', '');
      expect(pm.getEntries()[0].title).toBe('B');
      expect(onChanged).toHaveBeenCalledTimes(2);
    });
  });

  describe('remove()', () => {
    it('calls onBeforeRemove, then removes, then calls onChanged in that order', () => {
      const { ctrl, pm, onChanged, onBeforeRemove } = setup();
      ctrl.append('buf-1', 'A', '');
      const id = pm.getEntries()[0].id;
      const callOrder: string[] = [];
      onBeforeRemove.mockImplementation((eid: string) => {
        callOrder.push(`beforeRemove:${eid}`);
        // at this point, entry should still exist
        expect(pm.getEntries()).toHaveLength(1);
      });
      onChanged.mockImplementation(() => {
        callOrder.push('onChanged');
        // entry should have been removed by now
        expect(pm.getEntries()).toHaveLength(0);
      });
      onChanged.mockClear();
      ctrl.remove(id);
      expect(callOrder).toEqual([`beforeRemove:${id}`, 'onChanged']);
    });
  });

  describe('reorder()', () => {
    it('delegates to playlistManager.moveEntry and calls onChanged', () => {
      const { ctrl, pm, onChanged } = setup();
      ctrl.append('buf-1', 'A', '');
      ctrl.append('buf-2', 'B', '');
      onChanged.mockClear();
      ctrl.reorder(0, 1);
      expect(pm.getEntries().map((e) => e.title)).toEqual(['B', 'A']);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('setTransition()', () => {
    it('defaults both fade types to LINEAR', () => {
      const { ctrl, pm } = setup();
      ctrl.append('buf-1', 'A', '');
      ctrl.append('buf-2', 'B', '');
      const [a, b] = pm.getEntries();
      ctrl.setTransition(a.id, b.id, 2);
      const t = pm.getTransitions()[0];
      expect(t.fadeOutType).toBe(FadeType.LINEAR);
      expect(t.fadeInType).toBe(FadeType.LINEAR);
    });

    it('calls onChanged once for a valid transition', () => {
      const { ctrl, pm, onChanged } = setup();
      ctrl.append('buf-1', 'A', '');
      ctrl.append('buf-2', 'B', '');
      const [a, b] = pm.getEntries();
      onChanged.mockClear();
      ctrl.setTransition(a.id, b.id, 2);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('still calls onChanged even when the transition was rejected (non-adjacent)', () => {
      // Documents current behavior: PlaylistController does not check the
      // return value of PlaylistManager.setTransition.
      const { ctrl, pm, onChanged } = setup({ 'buf-1': 10, 'buf-2': 10, 'buf-3': 10 });
      ctrl.append('buf-1', 'A', '');
      ctrl.append('buf-2', 'B', '');
      ctrl.append('buf-3', 'C', '');
      const [a, , c] = pm.getEntries();
      onChanged.mockClear();
      ctrl.setTransition(a.id, c.id, 2);
      expect(pm.getTransitions()).toHaveLength(0);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeTransition()', () => {
    it('calls onChanged once', () => {
      const { ctrl, pm, onChanged } = setup();
      ctrl.append('buf-1', 'A', '');
      ctrl.append('buf-2', 'B', '');
      const [a, b] = pm.getEntries();
      ctrl.setTransition(a.id, b.id, 2);
      onChanged.mockClear();
      ctrl.removeTransition(a.id, b.id);
      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(pm.getTransitions()).toHaveLength(0);
    });
  });

  describe('getters', () => {
    it('getEntries / getTransitions / getTotalDuration delegate correctly', () => {
      const { ctrl, pm } = setup();
      ctrl.append('buf-1', 'A', '');
      expect(ctrl.getEntries()).toBe(pm.getEntries());
      expect(ctrl.getTransitions()).toBe(pm.getTransitions());
      expect(ctrl.getTotalDuration()).toBe(120);
    });
  });
});
