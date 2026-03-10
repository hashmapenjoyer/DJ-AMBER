import { useState, useRef, useEffect, useCallback } from "react";
import '../styles/timeline.css';

// Represents the data for the draggable audio blocks
interface TimelineClip {
  id: string;
  name: string;
  duration: number;
  startTime: number;
}

// Constants 
const PX_PER_SEC  = 4;
const TOTAL_TIME = 900;
const HEADER_HEIGHT = 32;
const CLIP_HEIGHT = 32;
const TIMELINE_WIDTH = TOTAL_TIME * PX_PER_SEC;
const CANVAS_HEIGHT = HEADER_HEIGHT + CLIP_HEIGHT + 48;

const MOCK_CLIPS: TimelineClip[] = [
  { id: '1', name: 'Never Gonna Give You Up', duration: 100, startTime: 0 },
  { id: '2', name: 'All I Want for Chrismas Is You', duration: 150, startTime: 145},
  { id: '3', name: 'Revenge', duration: 100, startTime: 290},
];

export default function Timeline() {
  const [clips, setClips] = useState<TimelineClip[]>(MOCK_CLIPS);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const scrollRef  = useRef<HTMLDivElement>(null);

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
          setPlayhead(p => {
            const next = p + dt;
            if (next >= 900) { setIsPlaying(false); return 0; } // TODO: THIS IS HARDCODED AND NEEDS TO BE FIXED
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
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying]);


  // Clip dragging
  const dragState = useRef<{ clipId: string; offsetPx: number } | null>(null);
  
  const onClipMouseDown = useCallback((e: React.MouseEvent, clipId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const clip = clips.find(c => c.id === clipId)!;
    const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
    const rectLeft = scrollRef.current?.getBoundingClientRect().left ?? 0;
    const clickX = e.clientX - rectLeft + scrollLeft;
    dragState.current = {
      clipId,
      offsetPx: clickX - clip.startTime * PX_PER_SEC,
    };
  }, [clips]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragState.current || !scrollRef.current) return;
      const scrollLeft = scrollRef.current.scrollLeft;
      const rectLeft = scrollRef.current.getBoundingClientRect().left;
      const rawX = e.clientX - rectLeft + scrollLeft;
      const newStart = Math.max(0, (rawX - dragState.current.offsetPx) / PX_PER_SEC);
      setClips(prev => prev.map(c =>
        c.id === dragState.current!.clipId ? { ...c, startTime: newStart } : c
      ));
    };
    const onMouseUp = () => { dragState.current = null; };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, []);

  return (
    <div className="timeline">

      {/* Header/Controls */}
      <div className="timeline_header">
        <div className="timeline_controls">
          <button
            className="timeline_btn" 
            title="Return to start" 
            onClick={() => setPlayhead(0)}>⏮</button>
          <button className="timeline_play_btn" onClick={() => setIsPlaying(p => !p)}>
            {isPlaying ? '⏸' : '▶'}
          </button>
        </div>
      </div>

      {/* Track */}
      <div ref={scrollRef} className="timeline_scroll_area">
        <div className="timeline_canvas" style={{ width: TIMELINE_WIDTH, height: CANVAS_HEIGHT}}>
          
          {/* Time Ticks */}
          <div className="timeline_ticks" style={{ width: TIMELINE_WIDTH }}>
            {ticks.map(s => (
              <div key={s} className="timeline_tick"  style={{ left: s * PX_PER_SEC }}>
                <span className="timeline_tick_label">{s}</span>
              </div>
            ))}
          </div>

          {/* Lane background */}
          <div className="timeline_lane" style={{ top: HEADER_HEIGHT, width: TIMELINE_WIDTH }}/>

          {/* Clips */}
          {clips.map((clip, idx) => {
            return (
              <div
                className="timeline_clip"
                key={clip.id}
                onMouseDown={e => onClipMouseDown(e, clip.id)}
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
              left:   playhead * PX_PER_SEC,
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