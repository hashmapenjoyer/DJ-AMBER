import { describe, it, expect, vi } from 'vitest';
import { SfxController } from '../SfxController';
import type { SfxClip } from '../types';

function baseClip(): Omit<SfxClip, 'id'> {
  return {
    bufferId: 'buf1',
    absoluteStart: 0,
    duration: 2,
    bufferOffset: 0,
    gain: 1,
  };
}

describe('SfxController', () => {
  describe('add()', () => {
    it('generates a unique ID and returns it', () => {
      const ctrl = new SfxController(() => {});
      const id1 = ctrl.add(baseClip());
      const id2 = ctrl.add(baseClip());
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
    });

    it('stores the clip with the returned ID', () => {
      const ctrl = new SfxController(() => {});
      const id = ctrl.add(baseClip());
      const clips = ctrl.getClips();
      expect(clips).toHaveLength(1);
      expect(clips[0].id).toBe(id);
    });

    it('calls onChanged with the current clips', () => {
      const onChanged = vi.fn();
      const ctrl = new SfxController(onChanged);
      ctrl.add(baseClip());
      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(onChanged.mock.calls[0][0]).toHaveLength(1);
    });

    it('multiple adds accumulate in onChanged payload', () => {
      const onChanged = vi.fn();
      const ctrl = new SfxController(onChanged);
      ctrl.add(baseClip());
      ctrl.add(baseClip());
      expect(onChanged).toHaveBeenCalledTimes(2);
      expect(onChanged.mock.calls[1][0]).toHaveLength(2);
    });
  });

  describe('remove()', () => {
    it('removes the matching clip', () => {
      const ctrl = new SfxController(() => {});
      const id = ctrl.add(baseClip());
      ctrl.remove(id);
      expect(ctrl.getClips()).toHaveLength(0);
    });

    it('calls onChanged after remove', () => {
      const onChanged = vi.fn();
      const ctrl = new SfxController(onChanged);
      const id = ctrl.add(baseClip());
      onChanged.mockClear();
      ctrl.remove(id);
      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(onChanged.mock.calls[0][0]).toHaveLength(0);
    });

    it('is a no-op (for data) when ID is unknown but still calls onChanged', () => {
      const onChanged = vi.fn();
      const ctrl = new SfxController(onChanged);
      ctrl.add(baseClip());
      onChanged.mockClear();
      ctrl.remove('unknown');
      expect(ctrl.getClips()).toHaveLength(1);
      expect(onChanged).toHaveBeenCalledTimes(1);
    });
  });

  describe('getClips()', () => {
    it('returns an empty array initially', () => {
      const ctrl = new SfxController(() => {});
      expect(ctrl.getClips()).toEqual([]);
    });
  });
});
