import type { ID, Seconds, Gain } from '../../types/UtilTypes';
import type { Fade, FadeType } from '../../types/Fade';

/** a song in the playlist */
export interface PlaylistEntry {
  id: ID;
  bufferId: ID;
  title: string;
  artist: string;
  duration: Seconds;
}

/** crossfade transition between two adjacent playlist entries */
export interface Transition {
  id: ID;
  fromEntryId: ID;
  toEntryId: ID;
  duration: Seconds;
  fadeOutType: FadeType;
  fadeInType: FadeType;
}

/**
 * computed by PlaylistManager.computeTimeline()
 * represents one song's absolute placement on the transport timeline
 */
export interface ScheduledEntry {
  entryId: ID;
  bufferId: ID;
  title: string;
  artist: string;
  absoluteStart: Seconds;
  absoluteEnd: Seconds;
  bufferOffset: Seconds;
  playDuration: Seconds;
  fades: Fade[];
}

/** a SFX clip placed at some absolute time on the timeline */
export interface SfxClip {
  id: ID;
  bufferId: ID;
  absoluteStart: Seconds;
  duration: Seconds;
  bufferOffset: Seconds;
  gain: Gain;
}

/** a live WebAudio node group tracked by the Scheduler. */
export interface ActiveNode {
  id: ID;
  sourceNode: AudioBufferSourceNode;
  gainNode: GainNode;
  scheduledStartCtx: number;
  scheduledEndCtx: number;
  transportStart: Seconds;
  transportEnd: Seconds;
}

export type TransportState = 'stopped' | 'playing' | 'paused';

/** events emitted by the AudioEngine */
export type AudioEngineEvents = {
  stateChange: { state: TransportState };
  songChange: { entryId: ID; title: string; artist: string };
  timelineChange: { entries: ScheduledEntry[] };
  playlistChange: { entries: PlaylistEntry[] };
  error: { message: string; error?: unknown };
  seeked: { time: Seconds };
};

export type { ID, Seconds, Gain, Fade, FadeType };
