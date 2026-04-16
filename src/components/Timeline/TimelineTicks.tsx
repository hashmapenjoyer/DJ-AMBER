import { formatDuration } from '../../../types/FormatDuration';
import '../../styles/timeline.css';

interface TimelineTicksProps {
  totalTime: number;
  pxPerSec: number;
  timelineWidth: number;
  height: number;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  onClick: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export default function TimelineTicks({
  totalTime,
  pxPerSec,
  timelineWidth,
  height,
  onWheel,
  onClick,
}: TimelineTicksProps) {
  const targetPxPerTick = 80;
  const rawInterval = targetPxPerTick / pxPerSec;

  // Round to a "nice" number: 1, 2, 5, 10, 15, etcx
  const niceIntervals = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 3600];
  const interval =
    niceIntervals.find((n) => n >= rawInterval) ?? niceIntervals[niceIntervals.length - 1];

  const ticks: number[] = [];
  for (let s = 0; s <= totalTime; s += interval) ticks.push(s);

  return (
    <div
      className="timeline_ticks"
      style={{ width: timelineWidth, height }}
      onWheel={onWheel}
      onClick={onClick}
    >
      {ticks.map((s) => (
        <div key={s} className="timeline_tick" style={{ left: s * pxPerSec }}>
          <span className="timeline_tick_label">{formatDuration(s)}</span>
        </div>
      ))}
    </div>
  );
}
