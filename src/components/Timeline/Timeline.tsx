import { useRef, useEffect, useCallback, useState } from 'react';
import { FadeType } from '../../../types/Fade';
import type { FadeType as FadeTypeValue } from '../../../types/Fade';
import { useAudioEngine } from '../../audio/UseAudioEngine';
import TimelineControls from './TimelineControls';
import TimelineTicks from './TimelineTicks';
import TimelineClip from './TimelineClip';
import TransitionModal from '../TransitionModal';
import '../../styles/timeline.css';

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
  const timelineWidth = totalTime * PX_PER_SEC;

  // Playhead
  const playheadRef = useRef<HTMLDivElement>(null);

  // Code from Ben's docs
  useEffect(() => {
    if (transportState !== 'playing') return;
    let rafId: number;
    const tick = () => {
      if (playheadRef.current) {
        playheadRef.current.style.left = `${engine.transport.getCurrentTime() * PX_PER_SEC}px`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [transportState, engine]);

  // Playing / pausing
  const handlePlayPause = useCallback(async () => {
    if (transportState === 'playing') {
      engine.transport.pause();
    } else {
      await engine.transport.play();
    }
  }, [transportState, engine]);

  // Reset
  const handleReturnToStart = useCallback(() => {
    engine.transport.seek(0);
    if (playheadRef.current) playheadRef.current.style.left = '0px';
  }, [engine]);

  // dragOverride is React state so the clip re-renders while dragging.
  const [dragOverride, setDragOverride] = useState<{ entryId: string; leftPx: number } | null>(
    null,
  );

  // dragRef is a ref so mousemove/mouseup handlers always see current values
  // without needing to be recreated on every render.
  const dragRef = useRef<DragState | null>(null);

  // Transition modal state
  const [transitionTarget, setTransitionTarget] = useState<{
    fromEntryId: string;
    fromTitle: string;
    toEntryId: string;
    toTitle: string;
    maxDuration: number;
  } | null>(null);

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
  //
  // The engine owns playlist order and derives clip positions from that order
  // plus any crossfade transition durations. It does NOT accept arbitrary
  // absoluteStart values for music clips. So on drop we translate the pixel
  // position into up to two engine operations:
  //
  // 1. reorderPlaylist(fromIdx, toIdx)  — if the clip moved past a neighbour
  // 2. setTransition / removeTransition — based on overlap with neighbours
  //
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
        engine.playlist.reorder(drag.originalIndex, newIndex);
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
          engine.playlist.setTransition(leftNeighbour.entryId, dragged.entryId, overlapSec);
        } else {
          engine.playlist.removeTransition(leftNeighbour.entryId, dragged.entryId);
        }
      }

      // Right overlap: handle the case where the dragged clip extends into the right neighbour
      if (rightNeighbour) {
        const overlapSec = droppedStartSec + clipDurationSec - rightNeighbour.absoluteStart;
        if (overlapSec > 0.1) {
          engine.playlist.setTransition(dragged.entryId, rightNeighbour.entryId, overlapSec);
        } else {
          engine.playlist.removeTransition(dragged.entryId, rightNeighbour.entryId);
        }
      }
    },
    [engine, timeline],
  );

  const onClipContextMenu = useCallback(
    (e: React.MouseEvent, entryId: string) => {
      e.preventDefault();
      e.stopPropagation();

      const idx = timeline.findIndex((en) => en.entryId === entryId);
      if (idx === -1 || timeline.length < 2) return;

      const entry = timeline[idx];
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
      const rectLeft = scrollRef.current?.getBoundingClientRect().left ?? 0;
      const clickCanvasPx = e.clientX - rectLeft + scrollLeft;
      const clipLeftPx = entry.absoluteStart * PX_PER_SEC;
      const clipWidthPx = (entry.absoluteEnd - entry.absoluteStart) * PX_PER_SEC;
      const clickedLeftHalf = clickCanvasPx - clipLeftPx < clipWidthPx / 2;

      let fromIdx: number;
      let toIdx: number;

      if (clickedLeftHalf && idx > 0) {
        fromIdx = idx - 1;
        toIdx = idx;
      } else if (!clickedLeftHalf && idx < timeline.length - 1) {
        fromIdx = idx;
        toIdx = idx + 1;
      } else if (idx > 0) {
        fromIdx = idx - 1;
        toIdx = idx;
      } else {
        fromIdx = idx;
        toIdx = idx + 1;
      }

      const fromEntry = timeline[fromIdx];
      const toEntry = timeline[toIdx];
      const maxDur = Math.min(
        fromEntry.absoluteEnd - fromEntry.absoluteStart,
        toEntry.absoluteEnd - toEntry.absoluteStart,
      );

      setTransitionTarget({
        fromEntryId: fromEntry.entryId,
        fromTitle: fromEntry.title,
        toEntryId: toEntry.entryId,
        toTitle: toEntry.title,
        maxDuration: maxDur,
      });
    },
    [timeline],
  );

  const handleTransitionApply = useCallback(
    (duration: number, fadeOutType: FadeTypeValue, fadeInType: FadeTypeValue) => {
      if (!transitionTarget) return;
      engine.playlist.setTransition(
        transitionTarget.fromEntryId,
        transitionTarget.toEntryId,
        duration,
        fadeOutType,
        fadeInType,
      );
      setTransitionTarget(null);
    },
    [engine, transitionTarget],
  );

  const handleTransitionRemove = useCallback(() => {
    if (!transitionTarget) return;
    engine.playlist.removeTransition(
      transitionTarget.fromEntryId,
      transitionTarget.toEntryId,
    );
    setTransitionTarget(null);
  }, [engine, transitionTarget]);

  const onOverlapClick = useCallback(
    (entryId: string) => {
      const idx = timeline.findIndex((en) => en.entryId === entryId);
      if (idx <= 0) return;

      const fromEntry = timeline[idx - 1];
      const toEntry = timeline[idx];
      const maxDur = Math.min(
        fromEntry.absoluteEnd - fromEntry.absoluteStart,
        toEntry.absoluteEnd - toEntry.absoluteStart,
      );

      setTransitionTarget({
        fromEntryId: fromEntry.entryId,
        fromTitle: fromEntry.title,
        toEntryId: toEntry.entryId,
        toTitle: toEntry.title,
        maxDuration: maxDur,
      });
    },
    [timeline],
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
      <TimelineControls
        isPlaying={isPlaying}
        currentTime={engine.transport.getCurrentTime()}
        onPlayPause={() => {
          void handlePlayPause();
        }}
        onReturnToStart={handleReturnToStart}
      />

      {/* Track */}
      <div ref={scrollRef} className="timeline_scroll_area">
        <div className="timeline_canvas" style={{ width: timelineWidth, height: CANVAS_HEIGHT }}>
          {/* Time ticks */}
          <TimelineTicks
            totalTime={totalTime}
            pxPerSec={PX_PER_SEC}
            timelineWidth={timelineWidth}
          />

          {/* Lane background */}
          <div className="timeline_lane" style={{ top: HEADER_HEIGHT, width: timelineWidth }} />

          {/* Clips */}
          {timeline.map((entry, idx) => {
            const isDragging = dragOverride?.entryId === entry.entryId;

            // During a drag, show the clip at the dragged position.
            // All other clips stay at their engine-computed positions.
            const leftPx = isDragging ? dragOverride.leftPx : entry.absoluteStart * PX_PER_SEC;
            const widthPx = (entry.absoluteEnd - entry.absoluteStart) * PX_PER_SEC;

            let overlapWidthPx = 0;
            if (idx > 0) {
              const leftNeighbour = timeline[idx - 1];
              // If the left neighbour is also being dragged (shouldn't happen, but shit happens lol)
              const neighbourRightPx =
                dragOverride?.entryId === leftNeighbour.entryId
                  ? dragOverride.leftPx +
                    (leftNeighbour.absoluteEnd - leftNeighbour.absoluteStart) * PX_PER_SEC
                  : leftNeighbour.absoluteEnd * PX_PER_SEC;
              overlapWidthPx = Math.max(0, neighbourRightPx - leftPx);
            }

            return (
              <TimelineClip
                key={entry.entryId}
                entryId={entry.entryId}
                title={entry.title}
                leftPx={leftPx}
                widthPx={widthPx}
                pxPerSecond={PX_PER_SEC}
                zIndex={idx}
                isDragging={isDragging}
                overlapWidthPx={overlapWidthPx}
                onMouseDown={onClipMouseDown}
                onContextMenu={onClipContextMenu}
                onOverlapClick={onOverlapClick}
              />
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

      {transitionTarget && (() => {
        const existing = engine.playlist.getTransitions().find(
          (t) =>
            t.fromEntryId === transitionTarget.fromEntryId &&
            t.toEntryId === transitionTarget.toEntryId,
        );
        return (
          <TransitionModal
            fromTitle={transitionTarget.fromTitle}
            toTitle={transitionTarget.toTitle}
            currentDuration={existing?.duration ?? 3}
            currentFadeOutType={existing?.fadeOutType ?? FadeType.LINEAR}
            currentFadeInType={existing?.fadeInType ?? FadeType.LINEAR}
            maxDuration={transitionTarget.maxDuration}
            hasExistingTransition={!!existing}
            onApply={handleTransitionApply}
            onRemove={handleTransitionRemove}
            onClose={() => setTransitionTarget(null)}
          />
        );
      })()}
    </div>
  );
}
