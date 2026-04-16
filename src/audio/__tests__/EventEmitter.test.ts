import { describe, it, expect } from 'vitest';
import { EventEmitter } from '../EventEmitter';

type TestEvents = {
  hello: { value: number };
  other: { text: string };
};

function makeEmitter(): EventEmitter<TestEvents> {
  return new EventEmitter<TestEvents>();
}

describe('EventEmitter', () => {
  describe('on()', () => {
    it('registers a listener and calls it on emit', () => {
      const emitter = makeEmitter();
      let received: { value: number } | null = null;
      emitter.on('hello', (data) => {
        received = data;
      });
      emitter.emit('hello', { value: 42 });
      expect(received).toEqual({ value: 42 });
    });

    it('supports multiple listeners for the same event', () => {
      const emitter = makeEmitter();
      let a = 0;
      let b = 0;
      emitter.on('hello', (d) => {
        a = d.value;
      });
      emitter.on('hello', (d) => {
        b = d.value * 2;
      });
      emitter.emit('hello', { value: 5 });
      expect(a).toBe(5);
      expect(b).toBe(10);
    });

    it('does not call listeners registered for other events', () => {
      const emitter = makeEmitter();
      let called = false;
      emitter.on('hello', () => {
        called = true;
      });
      emitter.emit('other', { text: 'x' });
      expect(called).toBe(false);
    });

    it('returns an unsubscribe function that removes the listener', () => {
      const emitter = makeEmitter();
      let count = 0;
      const unsub = emitter.on('hello', () => {
        count++;
      });
      emitter.emit('hello', { value: 1 });
      unsub();
      emitter.emit('hello', { value: 1 });
      expect(count).toBe(1);
    });

    it('calling the unsubscribe function twice is a no-op', () => {
      const emitter = makeEmitter();
      const unsub = emitter.on('hello', () => {});
      unsub();
      expect(() => {
        unsub();
      }).not.toThrow();
    });
  });

  describe('off()', () => {
    it('removes a specific listener by reference', () => {
      const emitter = makeEmitter();
      let count = 0;
      const listener = () => {
        count++;
      };
      emitter.on('hello', listener);
      emitter.off('hello', listener);
      emitter.emit('hello', { value: 1 });
      expect(count).toBe(0);
    });

    it('is a no-op if listener was never registered', () => {
      const emitter = makeEmitter();
      expect(() => {
        emitter.off('hello', () => {});
      }).not.toThrow();
    });

    it('removing one listener does not affect others on the same event', () => {
      const emitter = makeEmitter();
      let a = 0;
      let b = 0;
      const listenerA = () => {
        a++;
      };
      const listenerB = () => {
        b++;
      };
      emitter.on('hello', listenerA);
      emitter.on('hello', listenerB);
      emitter.off('hello', listenerA);
      emitter.emit('hello', { value: 1 });
      expect(a).toBe(0);
      expect(b).toBe(1);
    });
  });

  describe('emit()', () => {
    it('does not throw when no listeners are registered for the event', () => {
      const emitter = makeEmitter();
      expect(() => {
        emitter.emit('hello', { value: 1 });
      }).not.toThrow();
    });

    it('passes the correct data payload reference to the listener', () => {
      const emitter = makeEmitter();
      const payload = { value: 7 };
      let received: { value: number } | null = null;
      emitter.on('hello', (d) => {
        received = d;
      });
      emitter.emit('hello', payload);
      expect(received).toBe(payload);
    });

    it('calls listeners registered between emits', () => {
      const emitter = makeEmitter();
      emitter.emit('hello', { value: 1 });
      let count = 0;
      emitter.on('hello', () => {
        count++;
      });
      emitter.emit('hello', { value: 2 });
      expect(count).toBe(1);
    });
  });

  describe('isolation between events', () => {
    it('unsubscribing one event does not affect listeners of another', () => {
      const emitter = makeEmitter();
      let helloCount = 0;
      let otherCount = 0;
      const unsub = emitter.on('hello', () => {
        helloCount++;
      });
      emitter.on('other', () => {
        otherCount++;
      });
      unsub();
      emitter.emit('hello', { value: 1 });
      emitter.emit('other', { text: 'x' });
      expect(helloCount).toBe(0);
      expect(otherCount).toBe(1);
    });
  });
});
