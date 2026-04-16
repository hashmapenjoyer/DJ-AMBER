import { useRef, useEffect, useCallback, useState } from 'react';
import { useAudioEngine } from '../../audio/UseAudioEngine';
import type { SfxClip } from '../../audio/types';
import TimelineTicks from './TimelineTicks';
import TimelineClip from './TimelineClip';
import '../../styles/timeline.css';

// Zoom limits (px per second)
const MIN_PX_PER_SEC = 0.5;
const MAX_PX_PER_SEC = 64;
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

interface TimelineProps {
  sfxClips: SfxClip[];
  onSfxChange: () => void;
}

export default function Timeline({ sfxClips, onSfxChange }: TimelineProps) {
  const { engine, transportState, timeline } = useAudioEngine();

  const scrollRef = useRef<HTMLDivElement>(null);
  const totalTime = engine.getTotalDuration() || 900;

  // Resizing (tbh idk how good this implementation is, but it works :) )
  const [containerSize, setContainerSize] = useState({ width: 800, height: 240 });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
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

  const CANVAS_HEIGHT = ticksRowHeight + laneHeight * 2;

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

  const timelineWidth = totalTime * pxPerSec;

  const playheadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transportState !== 'playing') return;
    let rafId: number;
    const tick = () => {
      if (playheadRef.current) {
        playheadRef.current.style.left = `${engine.transport.getCurrentTime() * pxPerSecRef.current}px`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [transportState, engine]);

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

  const onMusicClipMouseDown = useCallback(
    (e: React.MouseEvent, entryId: string) => {
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
    },
    [timeline],
  );

  // SFX dragging
  const onSfxClipMouseDown = useCallback(
    (e: React.MouseEvent, sfxId: string) => {
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
  const commitMusicDrop = useCallback(
    (drag: MusicDragState) => {
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

      if (newIndex !== drag.originalIndex) {
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

    const onMouseUp = () => {
      if (!dragRef.current) return;
      if (dragRef.current.kind === 'music') {
        commitMusicDrop(dragRef.current);
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

  // The playhead will seek to where the user clicks on the ticks
  const handleTicksClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    const rectLeft = scroll.getBoundingClientRect().left;
    const canvasPx = e.clientX - rectLeft + scroll.scrollLeft;
    const seekSec = Math.max(0, Math.min(canvasPx / pxPerSecRef.current, totalTime));
    engine.transport.seek(seekSec);
    if (playheadRef.current) {
      playheadRef.current.style.left = `${seekSec * pxPerSecRef.current}px`;
    }
  }, [engine, totalTime]);

  // Scrolling on the ticks section will zoom in/out, resizing clips
  const handleTicksWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const scroll = scrollRef.current;
    if (!scroll) return;

    const oldPps = pxPerSecRef.current;
    const delta = e.deltaY !== 0 ? e.deltaY : -e.deltaX;
    const factor = 1 - delta * ZOOM_SENSITIVITY;
    const newPps = Math.min(MAX_PX_PER_SEC, Math.max(MIN_PX_PER_SEC, oldPps * factor));
    if (newPps === oldPps) return;

    const rectLeft = scroll.getBoundingClientRect().left;
    const mouseOffsetInViewport = e.clientX - rectLeft;
    const mouseTimeSec = (scroll.scrollLeft + mouseOffsetInViewport) / oldPps;
    const newScrollLeft = mouseTimeSec * newPps - mouseOffsetInViewport;

    setPxPerSec(newPps);
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = Math.max(0, newScrollLeft);
      }
    });
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
        <div className="timeline_canvas" style={{ width: timelineWidth, height: CANVAS_HEIGHT }}>
          {/* Time ticks */}
          <TimelineTicks
            totalTime={totalTime}
            pxPerSec={pxPerSec}
            timelineWidth={timelineWidth}
            height={ticksRowHeight}
            onWheel={handleTicksWheel}
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
                overlapWidthPx={overlapWidthPx}
                variant="music"
                onMouseDown={onMusicClipMouseDown}
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
                title={clip.bufferId}
                leftPx={leftPx}
                widthPx={widthPx}
                pxPerSecond={pxPerSec}
                clipTop={sfxClipTop}
                clipHeight={clipHeight}
                zIndex={idx}
                isDragging={isDragging}
                overlapWidthPx={0}
                variant="sfx"
                onMouseDown={onSfxClipMouseDown}
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
      </div>
    </div>
  );
}