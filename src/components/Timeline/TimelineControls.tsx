import { formatDuration } from '../../../types/FormatDuration';
import '../../styles/timeline.css';

interface TimelineControlsProps {
  isPlaying: boolean;
  currentTime: number;
  onPlayPause: () => void;
  onReturnToStart: () => void;
}

export default function TimelineControls({
  isPlaying,
  currentTime,
  onPlayPause,
  onReturnToStart,
}: TimelineControlsProps) {
  return (
    <div className="timeline_header">
      <div className="timeline_controls">
        <button className="timeline_btn" title="Return to start" onClick={onReturnToStart}>
          ⏮
        </button>
        <button className="timeline_play_btn timeline_btn" onClick={onPlayPause}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <span className="timeline_time_display">{formatDuration(currentTime)}</span>
      </div>
    </div>
  );
}
