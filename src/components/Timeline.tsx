import { useRef, useEffect, useCallback, useState } from 'react';
import { useAudioEngine } from '../audio/UseAudioEngine';
import { formatDuration } from '../../types/FormatDuration';
import type { ScheduledEntry } from '../audio/types';
import '../styles/timeline.css';

// Constants
const PX_PER_SEC = 4;
const HEADER_HEIGHT = 32;
const CLIP_HEIGHT = 56;
const LANE_PADDING = 8;
const CANVAS_HEIGHT = HEADER_HEIGHT + CLIP_HEIGHT + 48;
const MIN_TIMELINE_SECS = 420; // always show at least 7 minutes
const TICK_INTERVAL = 30; // a tick every 30 seconds
const MIN_TRANSITION_SECS = 0.5; // minimum drag-overlap to count as a transition

/** Clamp drag delta so the clip can't create a gap or exceed max overlap with prev. */
function clampDragDelta(dragged: ScheduledEntry, prev: ScheduledEntry, rawDeltaPx: number): number {
  const deltaSec = rawDeltaPx / PX_PER_SEC;
  const currentOverlap = prev.absoluteEnd - dragged.absoluteStart;
  const maxOverlap = Math.min(
    prev.absoluteEnd - prev.absoluteStart,
    dragged.absoluteEnd - dragged.absoluteStart,
  );
  // left limit: can't overlap more than max; right limit: can't create a gap
  const clampedSec = Math.max(currentOverlap - maxOverlap, Math.min(currentOverlap, deltaSec));
  return clampedSec * PX_PER_SEC;
}

export default function Timeline() {
  const { engine, transportState, timeline } = useAudioEngine();

  const [playhead, setPlayhead] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Drag: ref for mouse tracking (avoids stale closures), state for re-renders
  const dragRef = useRef<{
    entryId: string;
    entryIndex: number;
    startMouseX: number;
    moved: boolean;
    lastDeltaPx: number;
  } | null>(null);

  const [dragState, setDragState] = useState<{
    entryId: string;
    entryIndex: number;
    deltaPx: number;
  } | null>(null);

  const justDraggedRef = useRef(false);
  const timelineRef = useRef(timeline);
  useEffect(() => {
    timelineRef.current = timeline;
  });

  // derive total duration from the engine, with a minimum so the timeline isn't tiny
  const totalDuration = Math.max(MIN_TIMELINE_SECS, engine.getTotalDuration() + 30);
  const timelineWidth = totalDuration * PX_PER_SEC;

  // build tick marks
  const ticks: number[] = [];
  for (let s = 0; s <= totalDuration; s += TICK_INTERVAL) ticks.push(s);

  // playhead animation, reads engine.getCurrentTime() in a rAF loop
  useEffect(() => {
    const tick = () => {
      setPlayhead(engine.transport.getCurrentTime());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [engine]);

  // click on the ruler / lane area to seek (skip if a drag just ended)
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (justDraggedRef.current) {
        justDraggedRef.current = false;
        return;
      }
      if (!scrollRef.current) return;
      const scrollLeft = scrollRef.current.scrollLeft;
      const rectLeft = scrollRef.current.getBoundingClientRect().left;
      const clickX = e.clientX - rectLeft + scrollLeft;
      engine.transport.seek(Math.max(0, clickX / PX_PER_SEC));
    },
    [engine],
  );

  // transport controls
  const handlePlayPause = useCallback(() => {
    if (transportState === 'playing') {
      engine.transport.pause();
    } else {
      void engine.transport.play();
    }
  }, [engine, transportState]);

  const handleReturnToStart = useCallback(() => {
    engine.transport.stop();
  }, [engine]);

  // start dragging a clip (first clip is fixed at t=0)
  const onClipMouseDown = useCallback(
    (e: React.MouseEvent, entryId: string, entryIndex: number) => {
      if (entryIndex === 0) return;
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        entryId,
        entryIndex,
        startMouseX: e.clientX,
        moved: false,
        lastDeltaPx: 0,
      };
      setDragState({ entryId, entryIndex, deltaPx: 0 });
    },
    [],
  );

  // global mouse handlers for drag
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      dragRef.current.moved = true;
      const deltaPx = e.clientX - dragRef.current.startMouseX;
      dragRef.current.lastDeltaPx = deltaPx;
      setDragState({
        entryId: dragRef.current.entryId,
        entryIndex: dragRef.current.entryIndex,
        deltaPx,
      });
    };

    const onMouseUp = () => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.moved) {
        justDraggedRef.current = true;
        const tl = timelineRef.current;
        const draggedEntry = tl[drag.entryIndex];
        const prevEntry = tl[drag.entryIndex - 1];

        if (draggedEntry && prevEntry) {
          const clampedPx = clampDragDelta(draggedEntry, prevEntry, drag.lastDeltaPx);
          const clampedSec = clampedPx / PX_PER_SEC;
          const currentOverlap = prevEntry.absoluteEnd - draggedEntry.absoluteStart;
          const newOverlap = currentOverlap - clampedSec;

          if (newOverlap >= MIN_TRANSITION_SECS) {
            engine.playlist.setTransition(prevEntry.entryId, draggedEntry.entryId, newOverlap);
          } else {
            engine.playlist.removeTransition(prevEntry.entryId, draggedEntry.entryId);
          }
        }
      }

      dragRef.current = null;
      setDragState(null);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [engine]);

  const isPlaying = transportState === 'playing';

  // compute crossfade overlay regions from adjacent clip overlaps
  const crossfades: Array<{ key: string; leftPx: number; widthPx: number; duration: number }> = [];

  for (let i = 0; i < timeline.length - 1; i++) {
    const current = timeline[i];
    const next = timeline[i + 1];

    let nextStart = next.absoluteStart;

    // if the next clip is being dragged, use the preview position
    if (dragState && dragState.entryIndex === i + 1) {
      const clampedPx = clampDragDelta(next, current, dragState.deltaPx);
      nextStart = next.absoluteStart + clampedPx / PX_PER_SEC;
    }

    const overlap = current.absoluteEnd - nextStart;
    if (overlap > 0) {
      crossfades.push({
        key: `${current.entryId}-${next.entryId}`,
        leftPx: nextStart * PX_PER_SEC,
        widthPx: overlap * PX_PER_SEC,
        duration: overlap,
      });
    }
  }

  return (
    <div className="timeline">
      {/* Header / Controls */}
      <div className="timeline_header">
        <div className="timeline_controls">
          <button className="timeline_btn" title="Return to start" onClick={handleReturnToStart}>
            ⏮
          </button>
          <button className="timeline_btn timeline_play_btn" onClick={handlePlayPause}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <span className="timeline_time_display">{formatDuration(playhead)}</span>
        </div>
      </div>

      {/* Scrollable track area */}
      <div ref={scrollRef} className="timeline_scroll_area">
        <div
          className="timeline_canvas"
          style={{ width: timelineWidth, height: CANVAS_HEIGHT }}
          onClick={handleTimelineClick}
        >
          {/* Time ticks */}
          <div className="timeline_ticks" style={{ width: timelineWidth }}>
            {ticks.map((s) => (
              <div key={s} className="timeline_tick" style={{ left: s * PX_PER_SEC }}>
                <span className="timeline_tick_label">{formatDuration(s)}</span>
              </div>
            ))}
          </div>

          {/* Lane background */}
          <div className="timeline_lane" style={{ top: HEADER_HEIGHT, width: timelineWidth }} />

          {/* Clips from engine timeline */}
          {timeline.map((entry, idx) => {
            const isDragging = dragState?.entryId === entry.entryId;
            let leftPx = entry.absoluteStart * PX_PER_SEC;

            if (isDragging && idx > 0) {
              const prev = timeline[idx - 1];
              leftPx += clampDragDelta(entry, prev, dragState.deltaPx);
            }

            const clipWidth = (entry.absoluteEnd - entry.absoluteStart) * PX_PER_SEC;

            return (
              <div
                className={`timeline_clip${isDragging ? ' timeline_clip_dragging' : ''}`}
                key={entry.entryId}
                onMouseDown={(e) => onClipMouseDown(e, entry.entryId, idx)}
                style={{
                  left: leftPx,
                  top: HEADER_HEIGHT + LANE_PADDING,
                  width: clipWidth,
                  borderColor: '#00dabd',
                  cursor: idx === 0 ? 'default' : undefined,
                  zIndex: isDragging ? 50 : 5 + idx,
                }}
              >
                <div className="timeline_clip_label">
                  <span className="timeline_clip_name">{entry.title}</span>
                  <span className="timeline_clip_duration">
                    {formatDuration(entry.absoluteEnd - entry.absoluteStart)}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Crossfade indicators */}
          {crossfades.map((cf) => (
            <div
              key={cf.key}
              className="timeline_crossfade"
              style={{
                left: cf.leftPx,
                top: HEADER_HEIGHT + LANE_PADDING,
                width: cf.widthPx,
                height: CLIP_HEIGHT,
              }}
            >
              <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="timeline_crossfade_svg">
                <line x1="0" y1="0" x2="1" y2="1" />
                <line x1="0" y1="1" x2="1" y2="0" />
              </svg>
              {cf.widthPx > 48 && (
                <span className="timeline_crossfade_label">{formatDuration(cf.duration)}</span>
              )}
            </div>
          ))}

          {/* Playhead */}
          <div
            className="timeline_playhead"
            style={{
              left: playhead * PX_PER_SEC,
              height: CANVAS_HEIGHT,
            }}
          >
            <div className="timeline_playhead_handle" />
          </div>
        </div>
      </div>
    </div>
  );
}
