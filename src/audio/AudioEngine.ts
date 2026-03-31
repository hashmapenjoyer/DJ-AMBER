import { EventEmitter } from './EventEmitter';
import { BufferCache } from './BufferCache';
import { PlaylistManager } from './PlaylistManager';
import { Scheduler } from './Scheduler';
import { TransportController } from './TransportController';
import { VolumeController } from './VolumeController';
import { PlaylistController } from './PlaylistController';
import { SfxController } from './SfxController';
import type { ID, AudioEngineEvents, ScheduledEntry } from './types';

/**
 * mediator — wires the focused controllers together and coordinates
 * cross-cutting concerns (timeline recomputation, event emission).
 *
 * this is the single object React components interact with via useAudioEngine.
 * imperative mutations go through the sub-controllers:
 *   engine.transport.play()
 *   engine.playlist.append(bufferId, title)
 *   engine.volume.setMaster(0.8)
 *   engine.sfx.add({...})
 *   engine.buffers.add(id, arrayBuffer)
 */
export class AudioEngine extends EventEmitter<AudioEngineEvents> {
  /** raw AudioContext (use for waveform rendering, etc.) */
  readonly ctx: AudioContext;

  readonly transport: TransportController;
  readonly playlist: PlaylistController;
  readonly sfx: SfxController;
  readonly volume: VolumeController;
  readonly buffers: BufferCache;

  private readonly scheduler: Scheduler;
  private readonly playlistManager: PlaylistManager;
  private cachedTimeline: ScheduledEntry[] = [];

  constructor() {
    super();
    this.ctx = new AudioContext();

    // subsystems

    this.volume = new VolumeController(this.ctx);
    this.buffers = new BufferCache(this.ctx);
    this.playlistManager = new PlaylistManager();

    this.scheduler = new Scheduler(
      this.ctx,
      this.buffers,
      this.volume.musicTrackGain,
      this.volume.sfxTrackGain,
    );

    // controllers (injected callbacks keep them decoupled)

    this.transport = new TransportController(
      this.ctx,
      this.scheduler,
      () => this.playlistManager.getTotalDuration(),
      (state) => this.emit('stateChange', { state }),
    );

    this.playlist = new PlaylistController(
      this.playlistManager,
      this.buffers,
      () => this.recomputeAndSync(),
      (entryId) => this.handleBeforeRemove(entryId),
    );

    this.sfx = new SfxController((clips) => {
      this.scheduler.setSfxClips(clips);
    });

    // scheduler -> mediator wiring

    this.scheduler.setOnPlaybackEnded(() => this.transport.stop());
    this.scheduler.setOnSongChange((entryId, title) => {
      this.emit('songChange', { entryId, title });
    });
  }

  // cross-cutting reads (coordinate multiple controllers)

  getTimeline(): ReadonlyArray<ScheduledEntry> {
    return this.cachedTimeline;
  }

  getCurrentEntry(): ScheduledEntry | undefined {
    return this.playlist.getEntryAtTime(this.transport.getCurrentTime());
  }

  getTotalDuration() {
    return this.playlist.getTotalDuration();
  }

  // mediator coordination

  private handleBeforeRemove(entryId: ID): void {
    if (this.transport.getState() === 'playing') {
      this.scheduler.fadeOutNode(entryId);
    }
  }

  /**
   * recompute the timeline after any playlist/transition change.
   * updates the scheduler and handles currently-playing nodes.
   */
  private recomputeAndSync(): void {
    const timeline = this.playlistManager.computeTimeline();
    this.cachedTimeline = timeline;

    this.scheduler.setScheduledEntries(timeline);
    this.scheduler.setSfxClips([...this.sfx.getClips()]);

    if (this.transport.getState() === 'playing') {
      // cancel future nodes since they may have moved
      this.scheduler.cancelFutureNodes();
      // cancel nodes whose entry moved away from the current playback position
      this.scheduler.cancelDisplacedNodes();

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
