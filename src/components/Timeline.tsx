import { useState } from "react";

//Represents the data for the draggable audio blocks
interface TimelineClip {
  id: string;
  name: string;
  duration: number;
  startTime: number;
}

export default function Timeline() {

  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="timeline">
      <div className="header">
        <div className="controls">
          <button
            title="Return to start"
          >⏮</button>
          <button
            onClick={() => setIsPlaying(p => !p)}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
        </div>
      </div>
    </div>
  );
}
