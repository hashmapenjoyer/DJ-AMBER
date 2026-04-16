import { formatDuration } from '../../../types/FormatDuration';
import '../../styles/timeline.css';

interface TimelineClipProps {
  entryId: string;
  title: string;
  leftPx: number;
  widthPx: number;
  pxPerSecond: number;
  clipTop: number;
  clipHeight: number;
  zIndex: number;
  isDragging: boolean;
  overlapWidthPx: number;
  variant: 'music' | 'sfx';
  onMouseDown: (e: React.MouseEvent, entryId: string) => void;
}

export default function TimelineClip({
  entryId,
  title,
  leftPx,
  widthPx,
  zIndex,
  pxPerSecond,
  clipTop,
  clipHeight,
  isDragging,
  overlapWidthPx,
  variant,
  onMouseDown,
}: TimelineClipProps) {
  const clipDuration = widthPx / pxPerSecond;

  const baseClass =
    variant === 'sfx'
      ? `timeline_clip timeline_clip--sfx${isDragging ? ' timeline_clip--sfx-dragging' : ''}`
      : `timeline_clip${isDragging ? ' timeline_clip--dragging' : ''}`;

  return (
    <>
      <div
        className={baseClass}
        onMouseDown={(e) => onMouseDown(e, entryId)}
        style={{
          left: leftPx,
          top: clipTop,
          width: widthPx,
          height: clipHeight,
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
            top: clipTop,
            height: clipHeight,
            zIndex: 10 + zIndex,
            cursor: isDragging ? 'grabbing' : 'pointer',
          }}
          title={`Crossfade: ${formatDuration(overlapWidthPx / pxPerSecond)}`}
        />
      )}
    </>
  );
}
