import { useState, useRef } from "react";
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
const CLIP_HEIGHT = 16;

export default function Timeline() {

  const [isPlaying, setIsPlaying] = useState(false);

  const scrollRef  = useRef<HTMLDivElement>(null);

  const ticks: number[] = [];
  for (let s = 0; s <= TOTAL_TIME; s += 30) ticks.push(s);

  const timelineWidth = TOTAL_TIME * PX_PER_SEC;
  const canvasHeight  = HEADER_HEIGHT + CLIP_HEIGHT + 16;

  return (
    <div className="timeline">

      {/* Header/Controls */}
      <div className="timeline_header">
        <div className="timeline_controls">
          <button className="timeline_btn" title="Return to start">⏮</button>
          <button className="timeline_play_btn" onClick={() => setIsPlaying(p => !p)}>
            {isPlaying ? '⏸' : '▶'}
          </button>
        </div>
      </div>

      {/* Track */}
      <div ref={scrollRef} className="timeline_scroll_area">
        <div className="timeline_canvas" style={{ width: timelineWidth, height: canvasHeight}}>
          
          {/* Time Ticks */}
          <div className="timeline_ticks" style={{ width: timelineWidth }}>
            {ticks.map(s => (
              <div key={s} className="timeline_tick"  style={{ left: s * PX_PER_SEC }}>
                <span className="timeline_tick_label">{s}</span>
              </div>
            ))}
          </div>

          {/* Lane background */}
          <div className="timeline_lane" style={{ top: HEADER_HEIGHT, width: timelineWidth }}/>
        </div>
      </div>

    </div>
  );
}