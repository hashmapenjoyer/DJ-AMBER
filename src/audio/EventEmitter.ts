/**
 * minimal typed event emitter w/no external dependencies
 * used by AudioEngine to notify React (or some other listener) of discrete state changes.
 */

type Listener<T> = (data: T) => void;

export class EventEmitter<TEvents extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof TEvents, Set<Listener<never>>>();

  on<K extends keyof TEvents>(
    event: K,
    listener: Listener<TEvents[K]>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(listener as Listener<never>);

    // return unsubscribe function (for React useEffect cleanup)
    return () => {
      set.delete(listener as Listener<never>);
    };
  }

  off<K extends keyof TEvents>(
    event: K,
    listener: Listener<TEvents[K]>,
  ): void {
    this.listeners.get(event)?.delete(listener as Listener<never>);
  }

  emit<K extends keyof TEvents>(event: K, data: TEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of set) {
      (listener as Listener<TEvents[K]>)(data);
    }
  }
}
