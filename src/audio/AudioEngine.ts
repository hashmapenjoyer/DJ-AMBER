import { FadeType } from '../../types/Fade';
import { EventEmitter } from './EventEmitter';
import { BufferCache } from './BufferCache';
import { PlaylistManager } from './PlaylistManager';
import { Scheduler } from './Scheduler';
import type {
  ID,
  Seconds,
  Gain,
  FadeType as FadeTypeAlias,
  TransportState,
  AudioEngineEvents,
  PlaylistEntry,
  ScheduledEntry,
  SfxClip,
} from './types';

/**
 * the main audio engine orchestrator.
 *
 * owns the AudioContext, transport state, and all sub-systems.
 * this is the only class that React components interact with (via useAudioEngine).
 */
export class AudioEngine extends EventEmitter<AudioEngineEvents> {
  private readonly ctx: AudioContext;
  private readonly masterGain: GainNode;
  private readonly musicTrackGain: GainNode;
  private readonly sfxTrackGain: GainNode;

  private readonly bufferCache: BufferCache;
  private readonly playlistManager: PlaylistManager;
  private readonly scheduler: Scheduler;

  private transportState: TransportState = 'stopped';
  private transportTimeAtPlay: Seconds = 0;
  private contextTimeAtPlay: number = 0;
  private pausedAt: Seconds = 0;

  private sfxClips: SfxClip[] = [];
  private cachedTimeline: ScheduledEntry[] = [];

  constructor() {
    super();
    this.ctx = new AudioContext();

    // build the node graph
    // per-track gains -> master gain -> destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    this.musicTrackGain = this.ctx.createGain();
    this.musicTrackGain.connect(this.masterGain);

    this.sfxTrackGain = this.ctx.createGain();
    this.sfxTrackGain.connect(this.masterGain);

    this.bufferCache = new BufferCache(this.ctx);
    this.playlistManager = new PlaylistManager();
    this.scheduler = new Scheduler(
      this.ctx,
      this.bufferCache,
      this.musicTrackGain,
      this.sfxTrackGain,
    );

    this.scheduler.setOnPlaybackEnded(() => this.stop());
    this.scheduler.setOnSongChange((entryId, title) => {
      this.emit('songChange', { entryId, title });
    });
  }

  // transport

  async play(): Promise<void> {
    if (this.transportState === 'playing') return;

    // browser requires user input to resume AudioContext
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.contextTimeAtPlay = this.ctx.currentTime;
    this.transportTimeAtPlay = this.pausedAt;
    this.transportState = 'playing';

    this.scheduler.start(this.transportTimeAtPlay, this.contextTimeAtPlay);
    this.emit('stateChange', { state: 'playing' });
  }

  pause(): void {
    if (this.transportState !== 'playing') return;

    this.pausedAt = this.getCurrentTime();
    this.scheduler.stopAll();
    this.transportState = 'paused';
    this.emit('stateChange', { state: 'paused' });
  }

  stop(): void {
    this.scheduler.stopAll();
    this.pausedAt = 0;
    this.transportState = 'stopped';
    this.emit('stateChange', { state: 'stopped' });
  }

  seek(time: Seconds): void {
    const totalDuration = this.getTotalDuration();
    this.pausedAt = Math.max(0, Math.min(time, totalDuration));

    if (this.transportState === 'playing') {
      this.scheduler.stopAll();
      this.contextTimeAtPlay = this.ctx.currentTime;
      this.transportTimeAtPlay = this.pausedAt;
      this.scheduler.start(this.pausedAt, this.contextTimeAtPlay);
    }
    // if paused/stopped, just update pausedAt, playhead moves but no audio
  }

  /** get current transport time */
  getCurrentTime(): Seconds {
    if (this.transportState === 'playing') {
      return this.transportTimeAtPlay + (this.ctx.currentTime - this.contextTimeAtPlay);
    }
    return this.pausedAt;
  }

  getState(): TransportState {
    return this.transportState;
  }

  getTotalDuration(): Seconds {
    return this.playlistManager.getTotalDuration();
  }

  // playlist

  appendToPlaylist(bufferId: ID, title: string): void {
    const duration = this.bufferCache.getDuration(bufferId);
    if (duration === undefined) return;

    const entry: PlaylistEntry = {
      id: crypto.randomUUID(),
      bufferId,
      title,
      duration,
    };
    this.playlistManager.appendEntry(entry);
    this.recomputeAndSync();
  }

  insertInPlaylist(index: number, bufferId: ID, title: string): void {
    const duration = this.bufferCache.getDuration(bufferId);
    if (duration === undefined) return;

    const entry: PlaylistEntry = {
      id: crypto.randomUUID(),
      bufferId,
      title,
      duration,
    };
    this.playlistManager.insertEntry(index, entry);
    this.recomputeAndSync();
  }

  removeFromPlaylist(entryId: ID): void {
    // if this entry is currently playing, fade it out quickly
    if (this.transportState === 'playing') {
      const activeNodes = this.scheduler.getActiveNodes();
      const activeNode = activeNodes.get(entryId);
      if (activeNode) {
        const now = this.ctx.currentTime;
        activeNode.gainNode.gain.cancelScheduledValues(now);
        activeNode.gainNode.gain.setValueAtTime(activeNode.gainNode.gain.value, now);
        activeNode.gainNode.gain.linearRampToValueAtTime(0, now + 0.05);
        try {
          activeNode.sourceNode.stop(now + 0.05);
        } catch {
          // already stopped
        }
      }
    }

    this.playlistManager.removeEntry(entryId);
    this.recomputeAndSync();
  }

  reorderPlaylist(fromIndex: number, toIndex: number): void {
    this.playlistManager.moveEntry(fromIndex, toIndex);
    this.recomputeAndSync();
  }

  getPlaylist(): ReadonlyArray<PlaylistEntry> {
    return this.playlistManager.getEntries();
  }

  getTimeline(): ReadonlyArray<ScheduledEntry> {
    return this.cachedTimeline;
  }

  getCurrentEntry(): ScheduledEntry | undefined {
    return this.playlistManager.getEntryAtTime(this.getCurrentTime());
  }

  // transitions

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
    this.recomputeAndSync();
  }

  removeTransition(fromEntryId: ID, toEntryId: ID): void {
    this.playlistManager.removeTransitionBetween(fromEntryId, toEntryId);
    this.recomputeAndSync();
  }

  getTransitions() {
    return this.playlistManager.getTransitions();
  }

  // SFX

  addSfx(sfx: Omit<SfxClip, 'id'>): ID {
    const id = crypto.randomUUID();
    const clip: SfxClip = { ...sfx, id };
    this.sfxClips.push(clip);
    this.scheduler.setSfxClips(this.sfxClips);
    return id;
  }

  removeSfx(sfxId: ID): void {
    this.sfxClips = this.sfxClips.filter((s) => s.id !== sfxId);
    this.scheduler.setSfxClips(this.sfxClips);
  }

  getSfxClips(): ReadonlyArray<SfxClip> {
    return this.sfxClips;
  }

  // audio loading

  async loadAudioFile(id: ID, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    return this.bufferCache.add(id, arrayBuffer);
  }

  getBufferDuration(id: ID): Seconds | undefined {
    return this.bufferCache.getDuration(id);
  }

  hasBuffer(id: ID): boolean {
    return this.bufferCache.has(id);
  }

  removeBuffer(id: ID): void {
    this.bufferCache.remove(id);
  }

  // volume

  setMasterVolume(gain: Gain): void {
    this.masterGain.gain.setValueAtTime(gain, this.ctx.currentTime);
  }

  setMusicVolume(gain: Gain): void {
    this.musicTrackGain.gain.setValueAtTime(gain, this.ctx.currentTime);
  }

  setSfxVolume(gain: Gain): void {
    this.sfxTrackGain.gain.setValueAtTime(gain, this.ctx.currentTime);
  }

  // AudioContext access (for waveform rendering, etc.)

  getAudioContext(): AudioContext {
    return this.ctx;
  }

  getBuffer(id: ID): AudioBuffer | undefined {
    return this.bufferCache.get(id);
  }

  // utils

  /**
   * Recompute the timeline after any playlist/transition change.
   * Updates the scheduler and handles currently-playing nodes.
   */
  private recomputeAndSync(): void {
    const timeline = this.playlistManager.computeTimeline();
    this.cachedTimeline = timeline;

    this.scheduler.setScheduledEntries(timeline);
    this.scheduler.setSfxClips(this.sfxClips);

    if (this.transportState === 'playing') {
      // cancel future nodes since they may have moved
      this.scheduler.cancelFutureNodes();

      // update fades on currently-playing nodes (in case transitions changed)
      for (const [id] of this.scheduler.getActiveNodes()) {
        const updatedEntry = timeline.find((e) => e.entryId === id);
        if (updatedEntry) {
          this.scheduler.updateNodeFades(id, updatedEntry.fades);
        }
      }
    }

    this.emit('timelineChange', { entries: timeline });
    this.emit('playlistChange', {
      entries: [...this.playlistManager.getEntries()],
    });
  }
}
