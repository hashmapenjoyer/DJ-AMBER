import { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/timeline.css';
import { useAudioEngine } from '../audio/UseAudioEngine';

// Constants
const PX_PER_SEC = 4;
const TOTAL_TIME = 900;
const HEADER_HEIGHT = 32;
const CLIP_HEIGHT = 32;
const TIMELINE_WIDTH = TOTAL_TIME * PX_PER_SEC;
const CANVAS_HEIGHT = HEADER_HEIGHT + CLIP_HEIGHT + 48;

export default function Timeline() {
  const { engine, timeline, playlist } = useAudioEngine();

  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Visual-only drag position, engine is updated on mouse-up
  const [dragVisualStart, setDragVisualStart] = useState<{ id: string; startTime: number } | null>(
    null,
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  // Substitute visual drag position for the clip being dragged
  const displayClips = timeline.map((entry) => ({
    id: entry.entryId,
    name: entry.title,
    duration: entry.playDuration,
    startTime:
      dragVisualStart?.id === entry.entryId ? dragVisualStart.startTime : entry.absoluteStart,
  }));

  // Timeline ticks
  const ticks: number[] = [];
  for (let s = 0; s <= TOTAL_TIME; s += 30) ticks.push(s);

  // "Playing"
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      const tick = (ts: number) => {
        if (lastTsRef.current !== null) {
          const dt = (ts - lastTsRef.current) / 1000;
          setPlayhead((p) => {
            const next = p + dt;
            if (next >= engine.getTotalDuration()) {
              setIsPlaying(false);
              return 0;
            } // TODO: THIS IS HARDCODED AND NEEDS TO BE FIXED
            return next;
          });
        }
        lastTsRef.current = ts;
        rafRef.current = requestAnimationFrame(tick);
      };
      lastTsRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  // Clip dragging
  const dragState = useRef<{ clipId: string; offsetPx: number } | null>(null);

  const onClipMouseDown = useCallback(
    (e: React.MouseEvent, clipId: string) => {
      e.preventDefault();
      e.stopPropagation();
      const clip = displayClips.find((c) => c.id === clipId)!;
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
      const rectLeft = scrollRef.current?.getBoundingClientRect().left ?? 0;
      const clickX = e.clientX - rectLeft + scrollLeft;
      dragState.current = {
        clipId,
        offsetPx: clickX - clip.startTime * PX_PER_SEC,
      };
    },
    [displayClips],
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragState.current || !scrollRef.current) return;
      const scrollLeft = scrollRef.current.scrollLeft;
      const rectLeft = scrollRef.current.getBoundingClientRect().left;
      const rawX = e.clientX - rectLeft + scrollLeft;
      const newStart = Math.max(0, (rawX - dragState.current.offsetPx) / PX_PER_SEC);
      setDragVisualStart({ id: dragState.current.clipId, startTime: newStart });
    };
    const onMouseUp = () => {
      if (dragState.current && dragVisualStart) {
        // Resolve new order from visual positions and sync to engine
        const sorted = [...displayClips].sort((a, b) => a.startTime - b.startTime);
        const originalOrder = playlist.map((e) => e.id);
        const newOrder = sorted.map((c) => c.id);

        const draggedId = dragState.current.clipId;
        const fromIdx = originalOrder.indexOf(draggedId);
        const toIdx = newOrder.indexOf(draggedId);

        if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
          engine.reorderPlaylist(fromIdx, toIdx);
        }
      }

      dragState.current = null;
      setDragVisualStart(null);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragVisualStart, displayClips, playlist, engine]);

  return (
    <div className="timeline">
      {/* Header/Controls */}
      <div className="timeline_header">
        <div className="timeline_controls">
          <button className="timeline_btn" title="Return to start" onClick={() => setPlayhead(0)}>
            ⏮
          </button>
          <button className="timeline_play_btn" onClick={() => setIsPlaying((p) => !p)}>
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
                <span className="timeline_tick_label">{s}</span>
              </div>
            ))}
          </div>

          {/* Lane background */}
          <div className="timeline_lane" style={{ top: HEADER_HEIGHT, width: TIMELINE_WIDTH }} />

          {/* Clips */}
          {displayClips.map((clip, idx) => {
            return (
              <div
                className="timeline_clip"
                key={clip.id}
                onMouseDown={(e) => onClipMouseDown(e, clip.id)}
                style={{
                  left: clip.startTime * PX_PER_SEC,
                  top: HEADER_HEIGHT + 8,
                  width: clip.duration * PX_PER_SEC,
                  borderColor: '#00dabd',
                  zIndex: 5 + idx,
                }}
              >
                {/* Label */}
                <div className="timeline_clip_label">
                  <span className="timeline_clip_name">{clip.name}</span>
                  <span className="timeline_clip_duration">{clip.duration}</span>
                </div>
              </div>
            );
          })}

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
