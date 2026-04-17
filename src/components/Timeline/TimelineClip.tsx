import { formatDuration } from '../../../types/FormatDuration';
import ClipWaveform from './ClipWaveform';
import '../../styles/timeline.css';

interface TimelineClipProps {
  entryId: string;
  title: string;
  bufferId: string;
  bufferOffset: number;
  playDuration: number;
  leftPx: number;
  widthPx: number;
  pxPerSecond: number;
  clipTop: number;
  clipHeight: number;
  zIndex: number;
  isDragging: boolean;
  isSelected: boolean;
  overlapWidthPx: number;
  variant: 'music' | 'sfx';
  onMouseDown: (e: React.MouseEvent, entryId: string) => void;
  onContextMenu?: (e: React.MouseEvent, entryId: string) => void;
  onOverlapClick?: (entryId: string) => void;
}

// tuned to feel present without fighting the label for attention
const MUSIC_WAVEFORM_COLOR = 'rgba(245, 168, 52, 0.55)';
const SFX_WAVEFORM_COLOR = 'rgba(56, 189, 190, 0.55)';

export default function TimelineClip({
  entryId,
  title,
  bufferId,
  bufferOffset,
  playDuration,
  leftPx,
  widthPx,
  zIndex,
  pxPerSecond,
  clipTop,
  clipHeight,
  isDragging,
  isSelected,
  overlapWidthPx,
  variant,
  onMouseDown,
  onContextMenu,
  onOverlapClick,
}: TimelineClipProps) {
  const clipDuration = widthPx / pxPerSecond;

  const selectedSuffix = isSelected ? ' timeline_clip--selected' : '';
  const baseClass =
    variant === 'sfx'
      ? `timeline_clip timeline_clip--sfx${isDragging ? ' timeline_clip--sfx-dragging' : ''}${selectedSuffix}`
      : `timeline_clip${isDragging ? ' timeline_clip--dragging' : ''}${selectedSuffix}`;

  const waveformColor = variant === 'sfx' ? SFX_WAVEFORM_COLOR : MUSIC_WAVEFORM_COLOR;

  return (
    <>
      <div
        className={baseClass}
        onMouseDown={(e) => onMouseDown(e, entryId)}
        onContextMenu={onContextMenu ? (e) => onContextMenu(e, entryId) : undefined}
        style={{
          left: leftPx,
          top: clipTop,
          width: widthPx,
          height: clipHeight,
          zIndex: 5 + zIndex,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <ClipWaveform
          bufferId={bufferId}
          bufferOffset={bufferOffset}
          playDuration={playDuration}
          widthPx={widthPx}
          heightPx={clipHeight}
          color={waveformColor}
        />
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
          onClick={
            onOverlapClick
              ? (e) => {
                  e.stopPropagation();
                  onOverlapClick(entryId);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
