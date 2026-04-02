import { formatDuration } from '../../../types/FormatDuration';
import '../../styles/timeline.css';

interface TimelineTicksProps {
  totalTime: number;
  pxPerSec: number;
  timelineWidth: number;
}

export default function TimelineTicks({ totalTime, pxPerSec, timelineWidth }: TimelineTicksProps) {
  const ticks: number[] = [];
  for (let s = 0; s <= totalTime; s += 30) ticks.push(s);

  return (
    <div className="timeline_ticks" style={{ width: timelineWidth }}>
      {ticks.map((s) => (
        <div key={s} className="timeline_tick" style={{ left: s * pxPerSec }}>
          <span className="timeline_tick_label">{formatDuration(s)}</span>
        </div>
      ))}
    </div>
  );
}
