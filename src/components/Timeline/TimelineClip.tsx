import { formatDuration } from '../../../types/FormatDuration';
import '../../styles/timeline.css';
 
const HEADER_HEIGHT = 32;
 
interface TimelineClipProps {
  entryId: string;
  title: string;
  leftPx: number;
  widthPx: number;
  pxPerSecond: number;
  zIndex: number;
  isDragging: boolean;
  overlapWidthPx: number;
  onMouseDown: (e: React.MouseEvent, entryId: string) => void;
}
 
export default function TimelineClip({
  entryId,
  title,
  leftPx,
  widthPx,
  zIndex,
  pxPerSecond,
  isDragging,
  overlapWidthPx,
  onMouseDown,
}: TimelineClipProps) {
  const clipDuration = widthPx / pxPerSecond; // widthPx = duration * pxPerSecond
 
  return (
    <>
      <div
        className={`timeline_clip${isDragging ? ' timeline_clip--dragging' : ''}`}
        onMouseDown={(e) => onMouseDown(e, entryId)}
        style={{
          left: leftPx,
          top: HEADER_HEIGHT + 8,
          width: widthPx,
          zIndex: 5 + zIndex,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <div className="timeline_clip_label">
          <span className="timeline_clip_name">{title}</span>
          <span className="timeline_clip_duration">{formatDuration(clipDuration)}</span>
        </div>
      </div>
 
      {overlapWidthPx > 0 && (
        <div
          className="timeline_clip_overlap"
          style={{
            width: overlapWidthPx,
            left: leftPx,
            top: HEADER_HEIGHT + 8,
            zIndex: 10 + zIndex,
            cursor: isDragging ? 'grabbing' : 'pointer',
          }}
          title={`Crossfade: ${formatDuration(overlapWidthPx / 4)}`}
        />
      )}
    </>
  );
}