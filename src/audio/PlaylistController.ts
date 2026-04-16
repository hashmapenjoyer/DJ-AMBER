import { FadeType } from '../../types/Fade';
import type { PlaylistManager } from './PlaylistManager';
import type { BufferCache } from './BufferCache';
import type {
  ID,
  Seconds,
  PlaylistEntry,
  ScheduledEntry,
  Transition,
  FadeType as FadeTypeAlias,
} from './types';

/**
 * playlist + transition CRUD.
 *
 * wraps PlaylistManager (pure data) and BufferCache (duration lookups)
 * so callers don't have to assemble PlaylistEntry objects themselves.
 *
 * mutations trigger `onChanged` which the mediator uses to recompute
 * the timeline and sync the scheduler.
 */
export class PlaylistController {
  private readonly playlistManager: PlaylistManager;
  private readonly bufferCache: BufferCache;
  private readonly onChanged: () => void;
  private readonly onBeforeRemove: (entryId: ID) => void;

  constructor(
    playlistManager: PlaylistManager,
    bufferCache: BufferCache,
    onChanged: () => void,
    onBeforeRemove: (entryId: ID) => void,
  ) {
    this.playlistManager = playlistManager;
    this.bufferCache = bufferCache;
    this.onChanged = onChanged;
    this.onBeforeRemove = onBeforeRemove;
  }

  // entries

  append(bufferId: ID, title: string, artist: string): void {
    const duration = this.bufferCache.getDuration(bufferId);
    if (duration === undefined) return;

    const entry: PlaylistEntry = {
      id: crypto.randomUUID(),
      bufferId,
      title,
      artist,
      duration,
    };
    this.playlistManager.appendEntry(entry);
    this.onChanged();
  }

  insert(index: number, bufferId: ID, title: string, artist: string): void {
    const duration = this.bufferCache.getDuration(bufferId);
    if (duration === undefined) return;

    const entry: PlaylistEntry = {
      id: crypto.randomUUID(),
      bufferId,
      title,
      artist,
      duration,
    };
    this.playlistManager.insertEntry(index, entry);
    this.onChanged();
  }

  remove(entryId: ID): void {
    this.onBeforeRemove(entryId);
    this.playlistManager.removeEntry(entryId);
    this.onChanged();
  }

  reorder(fromIndex: number, toIndex: number): void {
    this.playlistManager.moveEntry(fromIndex, toIndex);
    this.onChanged();
  }

  getEntries(): ReadonlyArray<PlaylistEntry> {
    return this.playlistManager.getEntries();
  }

  getEntryAtTime(time: Seconds): ScheduledEntry | undefined {
    return this.playlistManager.getEntryAtTime(time);
  }

  getTotalDuration(): Seconds {
    return this.playlistManager.getTotalDuration();
  }

  // transitions (tightly coupled to playlist adjacency)

  setTransition(
    fromEntryId: ID,
    toEntryId: ID,
    duration: Seconds,
    fadeOutType: FadeTypeAlias = FadeType.LINEAR,
    fadeInType: FadeTypeAlias = FadeType.LINEAR,
  ): void {
    this.playlistManager.setTransition({
      id: crypto.randomUUID(),
      fromEntryId,
      toEntryId,
      duration,
      fadeOutType,
      fadeInType,
    });
    this.onChanged();
  }

  removeTransition(fromEntryId: ID, toEntryId: ID): void {
    this.playlistManager.removeTransitionBetween(fromEntryId, toEntryId);
    this.onChanged();
  }

  getTransitions(): ReadonlyArray<Transition> {
    return this.playlistManager.getTransitions();
  }

  updateTitleByBufferId(bufferId: ID, newTitle: string): void {
    const entries = this.playlistManager.getEntries();
    let changed = false;

    entries.forEach((entry) => {
      if (entry.bufferId === bufferId) {
        entry.title = newTitle;
        changed = true;
      }
    });

    if (changed) {
      this.onChanged();
    }
  }
}
