import { FadeType } from "../../types/Fade";
import type {
  ID,
  Seconds,
  Fade,
  ScheduledEntry,
  SfxClip,
  ActiveNode,
} from "./types";
import type { BufferCache } from "./BufferCache";

/** how often the scheduling loop fires (ms) */
const LOOKAHEAD_INTERVAL_MS = 25;

/** how far ahead to schedule audio (seconds) */
const SCHEDULE_AHEAD_S: Seconds = 0.2;

/** grace period, nodes within this window of ctx.currentTime are considered "audible" */
const AUDIBLE_GRACE_S = 0.05;

/**
 * Look-ahead scheduler
 *
 * Every 25ms, looks 200ms into the future and schedules WebAudio nodes.
 * Tracks active nodes for cancellation when something changes during playback
 */
export class Scheduler {
  private readonly ctx: AudioContext;
  private readonly bufferCache: BufferCache;
  private readonly musicTrackGain: GainNode;
  private readonly sfxTrackGain: GainNode;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly activeNodes = new Map<ID, ActiveNode>();

  private scheduledEntries: ScheduledEntry[] = [];
  private sfxClips: SfxClip[] = [];

  private transportTimeAtPlay: Seconds = 0;
  private contextTimeAtPlay: number = 0;

  private onPlaybackEnded: (() => void) | null = null;
  private onSongChange: ((entryId: ID, title: string) => void) | null = null;
  private lastReportedEntryId: ID | null = null;

  constructor(
    ctx: AudioContext,
    bufferCache: BufferCache,
    musicTrackGain: GainNode,
    sfxTrackGain: GainNode,
  ) {
    this.ctx = ctx;
    this.bufferCache = bufferCache;
    this.musicTrackGain = musicTrackGain;
    this.sfxTrackGain = sfxTrackGain;
  }

  setOnPlaybackEnded(cb: () => void): void {
    this.onPlaybackEnded = cb;
  }

  setOnSongChange(cb: (entryId: ID, title: string) => void): void {
    this.onSongChange = cb;
  }

  // lifecycle

  start(transportTime: Seconds, contextTimeAtPlay: number): void {
    this.transportTimeAtPlay = transportTime;
    this.contextTimeAtPlay = contextTimeAtPlay;
    this.lastReportedEntryId = null;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(
      () => this.tick(),
      LOOKAHEAD_INTERVAL_MS,
    );

    // immediate first tick to avoid 25ms delay on play
    this.tick();
  }

  stopAll(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    const now = this.ctx.currentTime;
    for (const node of this.activeNodes.values()) {
      this.killNode(node, now);
    }
    this.activeNodes.clear();
    this.lastReportedEntryId = null;
  }

  /** immediately silence and tear down a single active node. */
  private killNode(node: ActiveNode, now: number): void {
    // get rid of stale onended
    node.sourceNode.onended = null;

    // mute gain immediately (stop/disconnect race was giving me cancer)
    node.gainNode.gain.cancelScheduledValues(now);
    node.gainNode.gain.setValueAtTime(0, now);

    node.gainNode.disconnect();
    node.sourceNode.disconnect();

    try {
      node.sourceNode.stop();
    } catch {
      // already stopped
    }
  }

  // data updates

  setScheduledEntries(entries: ScheduledEntry[]): void {
    this.scheduledEntries = entries;
  }

  setSfxClips(clips: SfxClip[]): void {
    this.sfxClips = clips;
  }

  // node management

  getActiveNodes(): ReadonlyMap<ID, ActiveNode> {
    return this.activeNodes;
  }

  /**
   * cancel nodes that haven't started playing yet, but leaves
   * currently-audible nodes untouched
   */
  cancelFutureNodes(): ActiveNode[] {
    const now = this.ctx.currentTime;
    const cancelled: ActiveNode[] = [];

    for (const [id, node] of this.activeNodes) {
      if (node.scheduledStartCtx > now + AUDIBLE_GRACE_S) {
        node.sourceNode.onended = null;
        try {
          node.sourceNode.stop(0);
        } catch {
          // already stopped
        }
        node.sourceNode.disconnect();
        node.gainNode.disconnect();
        cancelled.push(node);
        this.activeNodes.delete(id);
      }
    }
    return cancelled;
  }

  /**
   * update gain automation on a currently-playing node
   * used when a transition changes on the currently-playing song
   */
  updateNodeFades(entryId: ID, newFades: Fade[]): void {
    const node = this.activeNodes.get(entryId);
    if (!node) return;

    const now = this.ctx.currentTime;
    node.gainNode.gain.cancelScheduledValues(now);

    const currentTransport = this.getCurrentTransportTime();
    const startOffset = Math.max(0, currentTransport - node.transportStart);
    const remainingDuration = node.transportEnd - currentTransport;

    this.applyFades(node.gainNode, newFades, startOffset, remainingDuration, now);
  }

  // core scheduling loop

  private tick(): void {
    const now = this.ctx.currentTime;
    const currentTransport = this.getCurrentTransportTime();
    const windowEnd = currentTransport + SCHEDULE_AHEAD_S;

    // schedule playlist entries
    for (const entry of this.scheduledEntries) {
      if (entry.absoluteStart > windowEnd) break; // entries are sorted by time
      if (entry.absoluteEnd <= currentTransport) continue; // already past
      if (this.activeNodes.has(entry.entryId)) continue; // already scheduled

      this.scheduleEntry(entry, now, currentTransport);
    }

    // schedule SFX clips
    for (const sfx of this.sfxClips) {
      const sfxEnd = sfx.absoluteStart + sfx.duration;
      if (sfx.absoluteStart > windowEnd) continue;
      if (sfxEnd <= currentTransport) continue;
      if (this.activeNodes.has(sfx.id)) continue;

      this.scheduleSfx(sfx, now, currentTransport);
    }

    // cleanup finished nodes
    for (const [id, node] of this.activeNodes) {
      if (node.scheduledEndCtx < now - 0.1) {
        this.activeNodes.delete(id);
      }
    }

    // report song changes (find the "primary" music entry at current time)
    this.reportSongChange(currentTransport);

    // detect end of set
    if (this.scheduledEntries.length > 0) {
      const lastEntry = this.scheduledEntries[this.scheduledEntries.length - 1];
      if (
        currentTransport >= lastEntry.absoluteEnd &&
        this.activeNodes.size === 0
      ) {
        this.onPlaybackEnded?.();
      }
    }
  }

  private scheduleEntry(
    entry: ScheduledEntry,
    nowCtx: number,
    nowTransport: Seconds,
  ): void {
    const buffer = this.bufferCache.get(entry.bufferId);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.ctx.createGain();
    source.connect(gainNode);
    gainNode.connect(this.musicTrackGain);

    // calculate when to start in AudioContext time
    let bufferStartOffset: Seconds = entry.bufferOffset;
    let ctxStartTime = nowCtx + (entry.absoluteStart - nowTransport);

    // seeking into the middle of this entry
    if (entry.absoluteStart < nowTransport) {
      bufferStartOffset += nowTransport - entry.absoluteStart;
      ctxStartTime = nowCtx;
    }

    const playDuration = entry.playDuration - (bufferStartOffset - entry.bufferOffset);
    if (playDuration <= 0) return;

    // apply fade automation
    this.applyFades(
      gainNode,
      entry.fades,
      bufferStartOffset - entry.bufferOffset,
      playDuration,
      ctxStartTime,
    );

    // schedule the source
    source.start(ctxStartTime, bufferStartOffset, playDuration);
    const ctxEndTime = ctxStartTime + playDuration;

    source.onended = () => {
      this.activeNodes.delete(entry.entryId);
    };

    this.activeNodes.set(entry.entryId, {
      id: entry.entryId,
      sourceNode: source,
      gainNode,
      scheduledStartCtx: ctxStartTime,
      scheduledEndCtx: ctxEndTime,
      transportStart: entry.absoluteStart,
      transportEnd: entry.absoluteEnd,
    });
  }

  private scheduleSfx(
    sfx: SfxClip,
    nowCtx: number,
    nowTransport: Seconds,
  ): void {
    const buffer = this.bufferCache.get(sfx.bufferId);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(sfx.gain, nowCtx);
    source.connect(gainNode);
    gainNode.connect(this.sfxTrackGain);

    let bufferStartOffset = sfx.bufferOffset;
    let ctxStartTime = nowCtx + (sfx.absoluteStart - nowTransport);

    // seeking into the middle of this SFX
    if (sfx.absoluteStart < nowTransport) {
      bufferStartOffset += nowTransport - sfx.absoluteStart;
      ctxStartTime = nowCtx;
    }

    const playDuration = sfx.duration - (bufferStartOffset - sfx.bufferOffset);
    if (playDuration <= 0) return;

    source.start(ctxStartTime, bufferStartOffset, playDuration);
    const ctxEndTime = ctxStartTime + playDuration;

    source.onended = () => {
      this.activeNodes.delete(sfx.id);
    };

    this.activeNodes.set(sfx.id, {
      id: sfx.id,
      sourceNode: source,
      gainNode,
      scheduledStartCtx: ctxStartTime,
      scheduledEndCtx: ctxEndTime,
      transportStart: sfx.absoluteStart,
      transportEnd: sfx.absoluteStart + sfx.duration,
    });
  }

  // fades :(

  private applyFades(
    gainNode: GainNode,
    fades: Fade[],
    clipOffset: Seconds,
    playDuration: Seconds,
    ctxStartTime: number,
  ): void {
    // default gain = 1.0
    gainNode.gain.setValueAtTime(1.0, ctxStartTime);

    for (const fade of fades) {
      // fade offsets are relative to the clip's local time (from its start)
      // clipOffset = how far into the clip we're starting (for mid-song seeks)
      if (fade.endOffset <= clipOffset) continue; // fade already passed
      if (fade.startOffset >= clipOffset + playDuration) continue; // fade is beyond what we play

      // clamp to the portion we're actually playing
      const fadeStartLocal = Math.max(fade.startOffset, clipOffset);
      const fadeEndLocal = Math.min(fade.endOffset, clipOffset + playDuration);

      const fadeStartCtx = ctxStartTime + (fadeStartLocal - clipOffset);
      const fadeEndCtx = ctxStartTime + (fadeEndLocal - clipOffset);

      // compute interpolated gain if we're starting in the middle of a fade
      const fadeFraction =
        fade.endOffset === fade.startOffset
          ? 1
          : (fadeStartLocal - fade.startOffset) /
            (fade.endOffset - fade.startOffset);
      const startGain =
        fade.startGain + (fade.endGain - fade.startGain) * fadeFraction;

      gainNode.gain.setValueAtTime(Math.max(startGain, 0.0001), fadeStartCtx);

      if (fade.type === FadeType.LINEAR) {
        gainNode.gain.linearRampToValueAtTime(
          Math.max(fade.endGain, 0.0001),
          fadeEndCtx,
        );
      } else {
        // exponentialRamp can't reach 0, so we use an epsilon
        gainNode.gain.exponentialRampToValueAtTime(
          Math.max(fade.endGain, 0.0001),
          fadeEndCtx,
        );
      }
    }
  }

  // utils

  private getCurrentTransportTime(): Seconds {
    return (
      this.transportTimeAtPlay +
      (this.ctx.currentTime - this.contextTimeAtPlay)
    );
  }

  private reportSongChange(currentTransport: Seconds): void {
    // find the primary entry at this time (prefer the later song during crossfades)
    for (let i = this.scheduledEntries.length - 1; i >= 0; i--) {
      const entry = this.scheduledEntries[i];
      if (
        currentTransport >= entry.absoluteStart &&
        currentTransport < entry.absoluteEnd
      ) {
        if (this.lastReportedEntryId !== entry.entryId) {
          this.lastReportedEntryId = entry.entryId;
          this.onSongChange?.(entry.entryId, entry.title);
        }
        return;
      }
    }
  }
}
