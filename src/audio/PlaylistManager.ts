import type { Fade } from '../../types/Fade';
import type { ID, Seconds, PlaylistEntry, Transition, ScheduledEntry } from './types';

/**
 * manages the ordered playlist and transitions.
 * core responsibility is basically just that computeTimeline() turns playlist + transitions
 * into ScheduledEntry[] with absolute times and computed fades.
 */
export class PlaylistManager {
  private entries: PlaylistEntry[] = [];
  private transitions: Transition[] = [];

  constructor() {}

  // playlist CRUD :P

  getEntries(): ReadonlyArray<PlaylistEntry> {
    return this.entries;
  }

  appendEntry(entry: PlaylistEntry): void {
    this.entries.push(entry);
  }

  insertEntry(index: number, entry: PlaylistEntry): void {
    this.entries.splice(index, 0, entry);
  }

  removeEntry(entryId: ID): void {
    this.entries = this.entries.filter((e) => e.id !== entryId);
    // remove any transitions referencing this entry
    this.transitions = this.transitions.filter(
      (t) => t.fromEntryId !== entryId && t.toEntryId !== entryId,
    );
  }

  moveEntry(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 ||
      fromIndex >= this.entries.length ||
      toIndex < 0 ||
      toIndex >= this.entries.length
    ) {
      return;
    }
    const [entry] = this.entries.splice(fromIndex, 1);
    this.entries.splice(toIndex, 0, entry);
    // remove transitions that are no longer between adjacent entries
    this.pruneInvalidTransitions();
  }

  // transition CRUD

  getTransitions(): ReadonlyArray<Transition> {
    return this.transitions;
  }

  getTransitionBetween(fromEntryId: ID, toEntryId: ID): Transition | undefined {
    return this.transitions.find((t) => t.fromEntryId === fromEntryId && t.toEntryId === toEntryId);
  }

  setTransition(transition: Transition): void {
    // validate b/c entries must be adjacent
    const fromIdx = this.entries.findIndex((e) => e.id === transition.fromEntryId);
    const toIdx = this.entries.findIndex((e) => e.id === transition.toEntryId);
    if (fromIdx === -1 || toIdx === -1 || toIdx !== fromIdx + 1) return;

    // clamp duration to not exceed either song
    const fromEntry = this.entries[fromIdx];
    const toEntry = this.entries[toIdx];
    const maxDuration = Math.min(fromEntry.duration, toEntry.duration);
    transition.duration = Math.min(transition.duration, maxDuration);

    // replace existing or add new
    const existingIdx = this.transitions.findIndex(
      (t) => t.fromEntryId === transition.fromEntryId && t.toEntryId === transition.toEntryId,
    );
    if (existingIdx !== -1) {
      this.transitions[existingIdx] = transition;
    } else {
      this.transitions.push(transition);
    }
  }

  removeTransition(transitionId: ID): void {
    this.transitions = this.transitions.filter((t) => t.id !== transitionId);
  }

  removeTransitionBetween(fromEntryId: ID, toEntryId: ID): void {
    this.transitions = this.transitions.filter(
      (t) => !(t.fromEntryId === fromEntryId && t.toEntryId === toEntryId),
    );
  }

  // timeline computation

  /**
   * compute the absolute timeline from playlist order + transitions.
   *
   * EX:
   *   Songs: A (180s), B (200s), C (150s)
   *   Transitions: A -> B (5s), B -> C (3s)
   *
   *   A: start=0,   end=180,  fadeOut at 175-180
   *   B: start=175, end=375,  fadeIn at 0-5, fadeOut at 197-200
   *   C: start=372, end=522,  fadeIn at 0-3
   *   Total: 522s
   */
  computeTimeline(): ScheduledEntry[] {
    const timeline: ScheduledEntry[] = [];
    let cursor: Seconds = 0;

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const fades: Fade[] = [];

      // check for incoming transition (from previous song)
      if (i > 0) {
        const prevEntry = this.entries[i - 1];
        const incomingTransition = this.getTransitionBetween(prevEntry.id, entry.id);
        if (incomingTransition) {
          fades.push({
            type: incomingTransition.fadeInType,
            startOffset: 0,
            endOffset: incomingTransition.duration,
            startGain: 0,
            endGain: 1,
          });
        }
      }

      // check for outgoing transition (to next song)
      if (i < this.entries.length - 1) {
        const nextEntry = this.entries[i + 1];
        const outgoingTransition = this.getTransitionBetween(entry.id, nextEntry.id);
        if (outgoingTransition) {
          fades.push({
            type: outgoingTransition.fadeOutType,
            startOffset: entry.duration - outgoingTransition.duration,
            endOffset: entry.duration,
            startGain: 1,
            endGain: 0,
          });
        }
      }

      const scheduled: ScheduledEntry = {
        entryId: entry.id,
        bufferId: entry.bufferId,
        title: entry.title,
        artist: entry.artist,
        absoluteStart: cursor,
        absoluteEnd: cursor + entry.duration,
        bufferOffset: 0,
        playDuration: entry.duration,
        fades,
      };
      timeline.push(scheduled);

      // advance cursor, pulling back by crossfade overlap
      cursor += entry.duration;
      if (i < this.entries.length - 1) {
        const nextEntry = this.entries[i + 1];
        const transition = this.getTransitionBetween(entry.id, nextEntry.id);
        if (transition) {
          cursor -= transition.duration;
        }
      }
    }

    return timeline;
  }

  getTotalDuration(): Seconds {
    const timeline = this.computeTimeline();
    if (timeline.length === 0) return 0;
    const last = timeline[timeline.length - 1];
    return last.absoluteEnd;
  }

  getEntryAtTime(time: Seconds): ScheduledEntry | undefined {
    const timeline = this.computeTimeline();
    // return the last entry that contains this time (during crossfades, prefer the newer song)
    for (let i = timeline.length - 1; i >= 0; i--) {
      const entry = timeline[i];
      if (time >= entry.absoluteStart && time < entry.absoluteEnd) {
        return entry;
      }
    }
    return undefined;
  }

  updateTitleByBufferId(bufferId: ID, newTitle: string): boolean {
    let changed = false;
    for (const entry of this.entries) {
      if (entry.bufferId === bufferId) {
        entry.title = newTitle;
        changed = true;
      }
    }
    return changed;
  }

  // util (singular)

  private pruneInvalidTransitions(): void {
    this.transitions = this.transitions.filter((t) => {
      const fromIdx = this.entries.findIndex((e) => e.id === t.fromEntryId);
      const toIdx = this.entries.findIndex((e) => e.id === t.toEntryId);
      return fromIdx !== -1 && toIdx !== -1 && toIdx === fromIdx + 1;
    });
  }
}
