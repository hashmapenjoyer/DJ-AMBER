import { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/timeline.css';
import { formatDuration } from '../../types/FormatDuration';
import { useAudioEngine } from '../audio/UseAudioEngine';

 
// Constants
const PX_PER_SEC = 4;
const HEADER_HEIGHT = 32;
const CANVAS_HEIGHT = HEADER_HEIGHT + 32 + 48;
 
interface DragState {
  entryId: string;
  originalIndex: number;
  grabOffsetPx: number;
  currentLeftPx: number;
}
 
export default function Timeline() {
  const { engine, transportState, timeline } = useAudioEngine();
 
  const scrollRef = useRef<HTMLDivElement>(null);
 
  const totalTime = engine.getTotalDuration() || 900;
  const TIMELINE_WIDTH = totalTime * PX_PER_SEC;
 
  // Timeline ticks 
  const ticks: number[] = [];
  for (let s = 0; s <= totalTime; s += 30) ticks.push(s);
 
  // Playhead 
  const playheadRef = useRef<HTMLDivElement>(null);
  
  // Code from Ben's docs
  useEffect(() => {
    if (transportState !== 'playing') return;
    let rafId: number;
    const tick = () => {
      if (playheadRef.current) {
        playheadRef.current.style.left = `${engine.getCurrentTime() * PX_PER_SEC}px`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [transportState, engine]);
 
  // Playing / pausing
  const handlePlayPause = useCallback(async () => {
    if (transportState === 'playing') {
      engine.pause();
    } else {
      await engine.play();
    }
  }, [transportState, engine]);
  
  // Reset
  const handleReturnToStart = useCallback(() => {
    engine.seek(0);
    if (playheadRef.current) playheadRef.current.style.left = '0px';
  }, [engine]);
 

  // dragOverride is React state so the clip re-renders while dragging.
  const [dragOverride, setDragOverride] = useState<{ entryId: string; leftPx: number } | null>(
    null,
  );

  // dragRef is a ref so mousemove/mouseup handlers always see current values
  // without needing to be recreated on every render.
  const dragRef = useRef<DragState | null>(null);
 
  const onClipMouseDown = useCallback(
    (e: React.MouseEvent, entryId: string) => {
      e.preventDefault();
      e.stopPropagation();
 
      const idx = timeline.findIndex((en) => en.entryId === entryId);
      if (idx === -1) return;
 
      const entry = timeline[idx];
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
      const rectLeft = scrollRef.current?.getBoundingClientRect().left ?? 0;
      const clickCanvasPx = e.clientX - rectLeft + scrollLeft;
      const clipLeftPx = entry.absoluteStart * PX_PER_SEC;
 
      dragRef.current = {
        entryId,
        originalIndex: idx,
        grabOffsetPx: clickCanvasPx - clipLeftPx,
        currentLeftPx: clipLeftPx,
      };
 
      setDragOverride({ entryId, leftPx: clipLeftPx });
    },
    [timeline],
  );
 
  // Drop logic
  
  // The engine owns playlist order and derives clip positions from that order
  // plus any crossfade transition durations. It does NOT accept arbitrary
  // absoluteStart values for music clips. So on drop we translate the pixel
  // position into up to two engine operations:
  
  // 1. reorderPlaylist(fromIdx, toIdx)  — if the clip moved past a neighbour
  // 2. setTransition / removeTransition — based on overlap with neighbours
  
  // Overlap in pixels / PX_PER_SEC = the crossfade duration in seconds.

  const commitDrop = useCallback(
    (drag: DragState) => {
      const droppedStartSec = drag.currentLeftPx / PX_PER_SEC;
      const draggedEntry = timeline[drag.originalIndex];
      const clipDurationSec = draggedEntry.absoluteEnd - draggedEntry.absoluteStart;
      const droppedCentreSec = droppedStartSec + clipDurationSec / 2;
 
      // Resolve new playlist order
      const withMids = timeline.map((en, idx) => ({
        entryId: en.entryId,
        idx,
        midSec:
          idx === drag.originalIndex
            ? droppedCentreSec
            : en.absoluteStart + (en.absoluteEnd - en.absoluteStart) / 2,
      }));
      withMids.sort((a, b) => a.midSec - b.midSec);
      const newIndex = withMids.findIndex((o) => o.entryId === drag.entryId);
 
      if (newIndex !== drag.originalIndex) {
        engine.reorderPlaylist(drag.originalIndex, newIndex);
      }
 
      // Resolve transitions
      const newTimeline = engine.getTimeline();
      const newIdx = newTimeline.findIndex((en) => en.entryId === drag.entryId);
      if (newIdx === -1) return;
 
      const dragged = newTimeline[newIdx];
      const leftNeighbour = newIdx > 0 ? newTimeline[newIdx - 1] : null;
      const rightNeighbour = newIdx < newTimeline.length - 1 ? newTimeline[newIdx + 1] : null;
 
      // Left overlap: user dragged this clip to start before the left neighbour ends.
      if (leftNeighbour) {
        const overlapSec = leftNeighbour.absoluteEnd - droppedStartSec;
        if (overlapSec > 0.1) {
          engine.setTransition(leftNeighbour.entryId, dragged.entryId, overlapSec);
        } else {
          engine.removeTransition(leftNeighbour.entryId, dragged.entryId);
        }
      }
 
      // Right overlap: handle the case where the dragged clip extends into the right neignbor
      if (rightNeighbour) {
        const overlapSec = (droppedStartSec + clipDurationSec) - rightNeighbour.absoluteStart;
        if (overlapSec > 0.1) {
          engine.setTransition(dragged.entryId, rightNeighbour.entryId, overlapSec);
        } else {
          engine.removeTransition(dragged.entryId, rightNeighbour.entryId);
        }
      }
    },
    [engine, timeline],
  );
 
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !scrollRef.current) return;
      const scrollLeft = scrollRef.current.scrollLeft;
      const rectLeft = scrollRef.current.getBoundingClientRect().left;
      const canvasPx = e.clientX - rectLeft + scrollLeft;
      const newLeftPx = Math.max(0, canvasPx - dragRef.current.grabOffsetPx);
 
      dragRef.current.currentLeftPx = newLeftPx;
      setDragOverride({ entryId: dragRef.current.entryId, leftPx: newLeftPx });
    };
 
    const onMouseUp = () => {
      if (!dragRef.current) return;
      commitDrop(dragRef.current);
      dragRef.current = null;
      setDragOverride(null);
    };
 
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [commitDrop]);
 
  const isPlaying = transportState === 'playing';
 
  return (
    <div className="timeline">
      {/* Header / Controls */}
      <div className="timeline_header">
        <div className="timeline_controls">
          <button className="timeline_btn" title="Return to start" onClick={handleReturnToStart}>
            ⏮
          </button>
          <button className="timeline_play_btn" onClick={handlePlayPause}>
            {isPlaying ? '⏸' : '▶'}
          </button>
        </div>
      </div>
 
      {/* Track */}
      <div ref={scrollRef} className="timeline_scroll_area">
        <div className="timeline_canvas" style={{ width: TIMELINE_WIDTH, height: CANVAS_HEIGHT }}>
          {/* Time Ticks */}
          <div className="timeline_ticks" style={{ width: TIMELINE_WIDTH }}>
            {ticks.map((s) => (
              <div key={s} className="timeline_tick" style={{ left: s * PX_PER_SEC }}>
                <span className="timeline_tick_label">{formatDuration(s)}</span>
              </div>
            ))}
          </div>
 
          {/* Lane background */}
          <div className="timeline_lane" style={{ top: HEADER_HEIGHT, width: TIMELINE_WIDTH }} />
 
          {/* Clips */}
          {timeline.map((entry, idx) => {
            const isDragging = dragOverride?.entryId === entry.entryId;
 
            // During a drag, show the clip at the dragged position.
            // All other clips stay at their engine-computed positions.
            const leftPx = isDragging
              ? dragOverride!.leftPx
              : entry.absoluteStart * PX_PER_SEC;
            const widthPx = (entry.absoluteEnd - entry.absoluteStart) * PX_PER_SEC;
            const clipDuration = entry.absoluteEnd - entry.absoluteStart;
 
            let crossfadeWidthPx = 0;
            if (idx > 0) {
              const leftNeighbour = timeline[idx - 1];
              // If the left neighbour is also being dragged (shouldn't happen, but shit happens lol)
              const neighbourRightPx =
                dragOverride?.entryId === leftNeighbour.entryId
                  ? dragOverride!.leftPx +
                    (leftNeighbour.absoluteEnd - leftNeighbour.absoluteStart) * PX_PER_SEC
                  : leftNeighbour.absoluteEnd * PX_PER_SEC;
              crossfadeWidthPx = Math.max(0, neighbourRightPx - leftPx);
            }
 
            return (
              <div
                className={`timeline_clip${isDragging ? ' timeline_clip--dragging' : ''}`}
                key={entry.entryId}
                onMouseDown={(e) => onClipMouseDown(e, entry.entryId)}
                style={{
                  left: leftPx,
                  top: HEADER_HEIGHT + 8,
                  width: widthPx,
                  zIndex: isDragging ? 100 : 5 + idx,
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
              >
                {/* Drawing Overlap */}
                {crossfadeWidthPx > 0 && (
                  <div
                    className="timeline_clip_crossfade"
                    style={{ width: crossfadeWidthPx, height: CANVAS_HEIGHT}}
                    title={`Crossfade: ${formatDuration(crossfadeWidthPx / PX_PER_SEC)}`}
                  />
                )}
                <div className="timeline_clip_label">
                  <span className="timeline_clip_name">{entry.title}</span>
                  <span className="timeline_clip_duration">{formatDuration(clipDuration)}</span>
                </div>
              </div>
            );
          })}
 
          {/* Playhead */}
          <div
            ref={playheadRef}
            className="timeline_playhead"
            style={{ left: 0, height: CANVAS_HEIGHT }}
          >
            <div className="timeline_playhead_handle" />
          </div>
        </div>
      </div>
    </div>
  );
}