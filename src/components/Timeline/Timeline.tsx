import { useRef, useEffect, useCallback, useState } from 'react';
import { FadeType } from '../../../types/Fade';
import type { FadeType as FadeTypeValue } from '../../../types/Fade';
import { useAudioEngine } from '../../audio/UseAudioEngine';
import type { SfxClip } from '../../audio/types';
import type { LibraryItem } from '../../../types/LibraryItem';
import TimelineTicks from './TimelineTicks';
import TimelineClip from './TimelineClip';
import TimelineContextMenu from './TimelineContextMenu';
import type { TimelineContextMenuItem } from './TimelineContextMenu';
import TransitionModal from '../TransitionModal';
import '../../styles/timeline.css';

// Zoom limits (px per second)
const MIN_PX_PER_SEC = 0.5;
const MAX_PX_PER_SEC = 64;

// Empty runway appended after all content so the canvas always extends past what's visible
const TIMELINE_TAIL_SEC = 3600;
const ZOOM_SENSITIVITY = 0.001;

// Vertical margin inside each lane (px above and below a clip)
const CLIP_MARGIN = 8;

interface MusicDragState {
  kind: 'music';
  entryId: string;
  originalIndex: number;
  grabOffsetPx: number;
  currentLeftPx: number;
}

interface SfxDragState {
  kind: 'sfx';
  clip: SfxClip;
  grabOffsetPx: number;
  currentLeftPx: number;
}

type DragState = MusicDragState | SfxDragState;

type Selection = { kind: 'music'; entryId: string } | { kind: 'sfx'; sfxId: string };

interface ContextMenuState {
  x: number;
  y: number;
  items: TimelineContextMenuItem[];
}

interface TimelineProps {
  sfxClips: SfxClip[];
  libraryItems: LibraryItem[];
  onSfxChange: () => void;
}

export default function Timeline({ sfxClips, libraryItems, onSfxChange }: TimelineProps) {
  const { engine, timeline } = useAudioEngine();

  const scrollRef = useRef<HTMLDivElement>(null);
  const totalTime = engine.getTotalDuration() || 900;
  const effectiveDuration = totalTime + TIMELINE_TAIL_SEC;

  // we need these for the wheel handler bc react
  const effectiveDurationRef = useRef(effectiveDuration);
  useEffect(() => {
    effectiveDurationRef.current = effectiveDuration;
  }, [effectiveDuration]);
  const containerWidthRef = useRef(800);

  // Resizing (tbh idk how good this implementation is, but it works :) )
  const [containerSize, setContainerSize] = useState({ width: 800, height: 240 });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      containerWidthRef.current = entry.contentRect.width;
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 1/8 of the track area is ticks row.
  // The remaining 7/8 is split evenly between the music and SFX lanes.
  const trackAreaHeight = containerSize.height;
  const ticksRowHeight = Math.round(trackAreaHeight / 8);
  const lanesHeight = trackAreaHeight - ticksRowHeight;
  const laneHeight = Math.floor(lanesHeight / 2);

  const canvasHeight = ticksRowHeight + laneHeight * 2;

  const musicLaneTop = ticksRowHeight;
  const sfxLaneTop = ticksRowHeight + laneHeight;
  const clipHeight = Math.max(24, laneHeight - CLIP_MARGIN * 2);
  const musicClipTop = musicLaneTop + CLIP_MARGIN;
  const sfxClipTop = sfxLaneTop + CLIP_MARGIN;

  // pxPerSec is dynamic so that scrolling can zoom in/out
  const [pxPerSec, setPxPerSec] = useState(() =>
    Math.max(MIN_PX_PER_SEC, containerSize.width / Math.max(totalTime, 1)),
  );
  // Always-fresh ref so RAF / drag callbacks never close over a stale value.
  const pxPerSecRef = useRef(pxPerSec);
  useEffect(() => {
    pxPerSecRef.current = pxPerSec;
  }, [pxPerSec]);

  const timelineWidth = effectiveDuration * pxPerSec;

  const playheadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      if (playheadRef.current) {
        playheadRef.current.style.left = `${engine.transport.getCurrentTime() * pxPerSecRef.current}px`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [engine]);

  // Drag states
  // Two separate override states so music and SFX clips never interfere.
  const [musicDragOverride, setMusicDragOverride] = useState<{
    entryId: string;
    leftPx: number;
  } | null>(null);

  const [sfxDragOverride, setSfxDragOverride] = useState<{
    sfxId: string;
    leftPx: number;
  } | null>(null);

  // Music dragging
  const dragRef = useRef<DragState | null>(null);

  // Transition modal state
  const [transitionTarget, setTransitionTarget] = useState<{
    fromEntryId: string;
    fromTitle: string;
    toEntryId: string;
    toTitle: string;
    maxDuration: number;
  } | null>(null);

  // Clip selection (for delete-via-keyboard and visual highlight)
  const [selection, setSelection] = useState<Selection | null>(null);

  // Custom right-click context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const onMusicClipMouseDown = useCallback(
    (e: React.MouseEvent, entryId: string) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const idx = timeline.findIndex((en) => en.entryId === entryId);
      if (idx === -1) return;

      const entry = timeline[idx];
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
      const rectLeft = scrollRef.current?.getBoundingClientRect().left ?? 0;
      const clickCanvasPx = e.clientX - rectLeft + scrollLeft;
      const clipLeftPx = entry.absoluteStart * pxPerSecRef.current;

      dragRef.current = {
        kind: 'music',
        entryId,
        originalIndex: idx,
        grabOffsetPx: clickCanvasPx - clipLeftPx,
        currentLeftPx: clipLeftPx,
      };
      setMusicDragOverride({ entryId, leftPx: clipLeftPx });
      setSelection({ kind: 'music', entryId });
    },
    [timeline],
  );

  // SFX dragging
  const onSfxClipMouseDown = useCallback(
    (e: React.MouseEvent, sfxId: string) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const clip = sfxClips.find((c) => c.id === sfxId);
      if (!clip) return;

      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
      const rectLeft = scrollRef.current?.getBoundingClientRect().left ?? 0;
      const clickCanvasPx = e.clientX - rectLeft + scrollLeft;
      const clipLeftPx = clip.absoluteStart * pxPerSecRef.current;

      dragRef.current = {
        kind: 'sfx',
        clip,
        grabOffsetPx: clickCanvasPx - clipLeftPx,
        currentLeftPx: clipLeftPx,
      };
      setSfxDragOverride({ sfxId, leftPx: clipLeftPx });
      setSelection({ kind: 'sfx', sfxId });
    },
    [sfxClips],
  );

  // Music drag committing
  //
  // The engine owns playlist order and derives clip positions from that order
  // plus any crossfade transition durations. It does NOT accept arbitrary
  // absoluteStart values for music clips. So on drop we translate the pixel
  // position into up to two engine operations:
  //
  // 1. reorderPlaylist(fromIdx, toIdx)  — if the clip moved past a neighbour
  // 2. setTransition / removeTransition — based on overlap with neighbours
  //
  // Overlap in pixels / pxPerSec = the crossfade duration in seconds.
  // Ripple vs slip semantics:
  //   Default (ripple): only recompute the LEFT-side transition. The engine packs clips
  //   back-to-back, so leaving the right transition alone naturally pushes downstream
  //   clips along by the same delta, preserving B-C when the user only meant to edit A-B.
  //   Slip (Alt held): recompute both sides as a free-form move. After a reorder the old
  //   right neighbour isn't adjacent anymore, so we fall back to slip there too.
  const commitMusicDrop = useCallback(
    (drag: MusicDragState, isSlip: boolean) => {
      const pps = pxPerSecRef.current;
      const droppedStartSec = drag.currentLeftPx / pps;
      const draggedEntry = timeline[drag.originalIndex];
      const clipDurationSec = draggedEntry.absoluteEnd - draggedEntry.absoluteStart;
      const droppedCentreSec = droppedStartSec + clipDurationSec / 2;

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
      const reordered = newIndex !== drag.originalIndex;

      if (reordered) {
        engine.playlist.reorder(drag.originalIndex, newIndex);
      }

      const newTimeline = engine.getTimeline();
      const newIdx = newTimeline.findIndex((en) => en.entryId === drag.entryId);
      if (newIdx === -1) return;

      const dragged = newTimeline[newIdx];
      const leftNeighbour = newIdx > 0 ? newTimeline[newIdx - 1] : null;
      const rightNeighbour = newIdx < newTimeline.length - 1 ? newTimeline[newIdx + 1] : null;

      if (leftNeighbour) {
        const overlapSec = leftNeighbour.absoluteEnd - droppedStartSec;
        if (overlapSec > 0.1) {
          engine.playlist.setTransition(leftNeighbour.entryId, dragged.entryId, overlapSec);
        } else {
          engine.playlist.removeTransition(leftNeighbour.entryId, dragged.entryId);
        }
      }

      if (rightNeighbour && (isSlip || reordered)) {
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

  // SFX drag committing
  // The engine has no "update position" method for SFX, so we remove and re-add.
  const commitSfxDrop = useCallback(
    (drag: SfxDragState) => {
      const newStartSec = Math.max(0, drag.currentLeftPx / pxPerSecRef.current);
      engine.sfx.remove(drag.clip.id);
      engine.sfx.add({
        bufferId: drag.clip.bufferId,
        absoluteStart: newStartSec,
        duration: drag.clip.duration,
        bufferOffset: drag.clip.bufferOffset,
        gain: drag.clip.gain,
      });
      onSfxChange();
    },
    [engine, onSfxChange],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !scrollRef.current) return;
      const scrollLeft = scrollRef.current.scrollLeft;
      const rectLeft = scrollRef.current.getBoundingClientRect().left;
      const canvasPx = e.clientX - rectLeft + scrollLeft;
      const newLeftPx = Math.max(0, canvasPx - dragRef.current.grabOffsetPx);
      dragRef.current.currentLeftPx = newLeftPx;

      if (dragRef.current.kind === 'music') {
        setMusicDragOverride({ entryId: dragRef.current.entryId, leftPx: newLeftPx });
      } else {
        setSfxDragOverride({ sfxId: dragRef.current.clip.id, leftPx: newLeftPx });
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (!dragRef.current) return;
      if (dragRef.current.kind === 'music') {
        commitMusicDrop(dragRef.current, e.altKey);
        setMusicDragOverride(null);
      } else {
        commitSfxDrop(dragRef.current);
        setSfxDragOverride(null);
      }
      dragRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [commitMusicDrop, commitSfxDrop]);

  // Opens the TransitionModal for the boundary between two adjacent timeline entries.
  const openTransitionModal = useCallback(
    (fromIdx: number, toIdx: number) => {
      const fromEntry = timeline[fromIdx];
      const toEntry = timeline[toIdx];
      if (!fromEntry || !toEntry) return;
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

  // Right-clicking a music clip opens a custom context menu with transition + delete options.
  const onMusicClipContextMenu = useCallback(
    (e: React.MouseEvent, entryId: string) => {
      e.preventDefault();
      e.stopPropagation();

      const idx = timeline.findIndex((en) => en.entryId === entryId);
      if (idx === -1) return;

      setSelection({ kind: 'music', entryId });

      const items: TimelineContextMenuItem[] = [
        {
          label: 'Add transition before',
          disabled: idx === 0,
          onClick: () => openTransitionModal(idx - 1, idx),
        },
        {
          label: 'Add transition after',
          disabled: idx === timeline.length - 1,
          onClick: () => openTransitionModal(idx, idx + 1),
        },
        {
          label: 'Delete clip',
          onClick: () => {
            engine.playlist.remove(entryId);
            setSelection(null);
          },
        },
      ];

      setContextMenu({ x: e.clientX, y: e.clientY, items });
    },
    [timeline, engine, openTransitionModal],
  );

  // Right-clicking an SFX clip opens a simpler menu since SFX has no transitions.
  const onSfxClipContextMenu = useCallback(
    (e: React.MouseEvent, sfxId: string) => {
      e.preventDefault();
      e.stopPropagation();

      setSelection({ kind: 'sfx', sfxId });

      const items: TimelineContextMenuItem[] = [
        {
          label: 'Delete clip',
          onClick: () => {
            engine.sfx.remove(sfxId);
            onSfxChange();
            setSelection(null);
          },
        },
      ];

      setContextMenu({ x: e.clientX, y: e.clientY, items });
    },
    [engine, onSfxChange],
  );

  // Clicking the crossfade overlap indicator opens the TransitionModal directly.
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
    engine.playlist.removeTransition(transitionTarget.fromEntryId, transitionTarget.toEntryId);
    setTransitionTarget(null);
  }, [engine, transitionTarget]);

  const deleteSelection = useCallback(() => {
    if (!selection) return;
    if (selection.kind === 'music') {
      engine.playlist.remove(selection.entryId);
    } else {
      engine.sfx.remove(selection.sfxId);
      onSfxChange();
    }
    setSelection(null);
  }, [selection, engine, onSfxChange]);

  // Delete / Backspace removes the selected clip; Escape clears selection + menu.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isTyping =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isTyping) return;

      if (e.key === 'Escape') {
        setSelection(null);
        setContextMenu(null);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        e.preventDefault();
        deleteSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection, deleteSelection]);

  // Clicking empty timeline area deselects. Clip mousedown handlers stopPropagation,
  // so this only fires for background clicks.
  const onCanvasMouseDown = useCallback(() => {
    setSelection(null);
  }, []);

  // The playhead will seek to where the user clicks on the ticks
  const handleTicksClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      const rectLeft = scroll.getBoundingClientRect().left;
      const canvasPx = e.clientX - rectLeft + scroll.scrollLeft;
      const seekSec = Math.max(0, Math.min(canvasPx / pxPerSecRef.current, totalTime));
      engine.transport.seek(seekSec);
      if (playheadRef.current) {
        playheadRef.current.style.left = `${seekSec * pxPerSecRef.current}px`;
      }
    },
    [engine, totalTime],
  );

  // attach a non-passive wheel listener to the scroll area so preventDefault()
  // actually works
  // also handles zoom so it works anywhere on the timeline
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      const oldPps = pxPerSecRef.current;
      const delta = e.deltaY !== 0 ? e.deltaY : -e.deltaX;
      const factor = 1 - delta * ZOOM_SENSITIVITY;
      // prevent zooming out enough to see the canvas end
      const minPps = Math.max(
        MIN_PX_PER_SEC,
        containerWidthRef.current / effectiveDurationRef.current,
      );
      const newPps = Math.min(MAX_PX_PER_SEC, Math.max(minPps, oldPps * factor));
      if (newPps === oldPps) return;

      const rectLeft = el.getBoundingClientRect().left;
      const mouseOffsetInViewport = e.clientX - rectLeft;
      const mouseTimeSec = (el.scrollLeft + mouseOffsetInViewport) / oldPps;
      const newScrollLeft = mouseTimeSec * newPps - mouseOffsetInViewport;

      setPxPerSec(newPps);
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, newScrollLeft);
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div className="timeline">
      <div className="timeline_track_area">
        {/* Label sidebar */}
        <div className="timeline_lane_labels">
          <div className="timeline_lane_label" style={{ height: ticksRowHeight }}>
            <span>TX</span>
          </div>
          <div className="timeline_lane_label" style={{ height: laneHeight }}>
            <span>MX</span>
          </div>
          <div className="timeline_lane_label" style={{ height: laneHeight }}>
            <span>SFX</span>
          </div>
        </div>

        <div ref={scrollRef} className="timeline_scroll_area">
          <div
            className="timeline_canvas"
            style={{ width: timelineWidth, height: canvasHeight }}
            onMouseDown={onCanvasMouseDown}
          >
            {/* Time ticks */}
            <TimelineTicks
              totalTime={effectiveDuration}
              pxPerSec={pxPerSec}
              timelineWidth={timelineWidth}
              height={ticksRowHeight}
              onClick={handleTicksClick}
            />

            {/* Music lane background */}
            <div
              className="timeline_lane"
              style={{ top: musicLaneTop, width: timelineWidth, height: laneHeight }}
            />

            {/* SFX lane background */}
            <div
              className="timeline_lane timeline_lane--sfx"
              style={{ top: sfxLaneTop, width: timelineWidth, height: laneHeight }}
            />

            {/* Music clips */}
            {timeline.map((entry, idx) => {
              const isDragging = musicDragOverride?.entryId === entry.entryId;
              const leftPx = isDragging ? musicDragOverride.leftPx : entry.absoluteStart * pxPerSec;
              const widthPx = (entry.absoluteEnd - entry.absoluteStart) * pxPerSec;

              let overlapWidthPx = 0;
              if (idx > 0) {
                const leftNeighbour = timeline[idx - 1];
                // If the left neighbour is also being dragged (shouldn't happen, but shit happens lol)
                const neighbourRightPx =
                  musicDragOverride?.entryId === leftNeighbour.entryId
                    ? musicDragOverride.leftPx +
                      (leftNeighbour.absoluteEnd - leftNeighbour.absoluteStart) * pxPerSec
                    : leftNeighbour.absoluteEnd * pxPerSec;
                overlapWidthPx = Math.max(0, neighbourRightPx - leftPx);
              }

              return (
                <TimelineClip
                  key={entry.entryId}
                  entryId={entry.entryId}
                  title={entry.title}
                  leftPx={leftPx}
                  widthPx={widthPx}
                  pxPerSecond={pxPerSec}
                  clipTop={musicClipTop}
                  clipHeight={clipHeight}
                  zIndex={idx}
                  isDragging={isDragging}
                  isSelected={selection?.kind === 'music' && selection.entryId === entry.entryId}
                  overlapWidthPx={overlapWidthPx}
                  variant="music"
                  onMouseDown={onMusicClipMouseDown}
                  onContextMenu={onMusicClipContextMenu}
                  onOverlapClick={onOverlapClick}
                />
              );
            })}

            {/* SFX clips */}
            {sfxClips.map((clip, idx) => {
              const isDragging = sfxDragOverride?.sfxId === clip.id;
              const leftPx = isDragging ? sfxDragOverride.leftPx : clip.absoluteStart * pxPerSec;
              const widthPx = clip.duration * pxPerSec;

              return (
                <TimelineClip
                  key={clip.id}
                  entryId={clip.id}
                  title={libraryItems.find((i) => i.id === clip.bufferId)?.title ?? clip.bufferId}
                  leftPx={leftPx}
                  widthPx={widthPx}
                  pxPerSecond={pxPerSec}
                  clipTop={sfxClipTop}
                  clipHeight={clipHeight}
                  zIndex={idx}
                  isDragging={isDragging}
                  isSelected={selection?.kind === 'sfx' && selection.sfxId === clip.id}
                  overlapWidthPx={0}
                  variant="sfx"
                  onMouseDown={onSfxClipMouseDown}
                  onContextMenu={onSfxClipContextMenu}
                />
              );
            })}

            {/* Playhead */}
            <div
              ref={playheadRef}
              className="timeline_playhead"
              style={{ left: 0, height: canvasHeight }}
            >
              <div className="timeline_playhead_handle" />
            </div>
          </div>
        </div>
      </div>

      {transitionTarget &&
        (() => {
          const existing = engine.playlist
            .getTransitions()
            .find(
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

      {contextMenu && (
        <TimelineContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
