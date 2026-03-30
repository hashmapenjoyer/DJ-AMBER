import { useSyncExternalStore } from 'react';
import { AudioEngine } from './AudioEngine';
import type { TransportState, PlaylistEntry, ScheduledEntry } from './types';

// singleton engine instance
let engineInstance: AudioEngine | null = null;

function getEngine(): AudioEngine {
  if (!engineInstance) {
    engineInstance = new AudioEngine();
  }
  return engineInstance;
}

/**
 * React hook for the AudioEngine singleton.
 *
 * Re-renders ONLY on discrete events (stateChange, playlistChange, timelineChange, songChange).
 * For continuous time (playhead, progress bar), use engine.transport.getCurrentTime() in a rAF loop
 */
export function useAudioEngine() {
  const engine = getEngine();

  const transportState = useSyncExternalStore<TransportState>(
    (onStoreChange) => engine.on('stateChange', () => onStoreChange()),
    () => engine.transport.getState(),
  );

  const playlist = useSyncExternalStore<ReadonlyArray<PlaylistEntry>>(
    (onStoreChange) => engine.on('playlistChange', () => onStoreChange()),
    () => engine.playlist.getEntries(),
  );

  const timeline = useSyncExternalStore<ReadonlyArray<ScheduledEntry>>(
    (onStoreChange) => engine.on('timelineChange', () => onStoreChange()),
    () => engine.getTimeline(),
  );

  const currentSongTitle = useSyncExternalStore<string>(
    (onStoreChange) => engine.on('songChange', () => onStoreChange()),
    () => engine.getCurrentEntry()?.title ?? '',
  );

  return {
    engine,
    transportState,
    playlist,
    timeline,
    currentSongTitle,
  };
}
