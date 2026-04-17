import { formatDuration } from '../../../types/FormatDuration';
import { FadeType } from '../../../types/Fade';
import type { FadeType as FadeTypeValue } from '../../../types/Fade';
import { curvePath, FADE_OUT_COLOR, FADE_IN_COLOR } from '../fadeCurves';
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
  isSelected: boolean;
  overlapWidthPx: number;
  fadeOutType?: FadeTypeValue;
  fadeInType?: FadeTypeValue;
  variant: 'music' | 'sfx';
  onMouseDown: (e: React.MouseEvent, entryId: string) => void;
  onContextMenu?: (e: React.MouseEvent, entryId: string) => void;
  onOverlapClick?: (entryId: string) => void;
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
  isSelected,
  overlapWidthPx,
  fadeOutType,
  fadeInType,
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
        >
          <OverlapCurves
            width={overlapWidthPx}
            height={clipHeight}
            fadeOutType={fadeOutType ?? FadeType.LINEAR}
            fadeInType={fadeInType ?? FadeType.LINEAR}
          />
        </div>
      )}
    </>
  );
}

interface OverlapCurvesProps {
  width: number;
  height: number;
  fadeOutType: FadeTypeValue;
  fadeInType: FadeTypeValue;
}

function OverlapCurves({ width, height, fadeOutType, fadeInType }: OverlapCurvesProps) {
  if (width < 4 || height < 4) return null;

  const pad = Math.min(2, Math.floor(height / 6));
  const steps = Math.max(8, Math.min(40, Math.round(width / 4)));

  const renderCurve = (type: FadeTypeValue, invert: boolean, color: string) => {
    if (type === FadeType.NONE) {
      const y = (pad + 1).toFixed(1);
      return (
        <path
          d={`M 0,${y} H ${width}`}
          stroke={color}
          strokeWidth="1.25"
          fill="none"
          strokeLinecap="round"
          strokeDasharray="2 2"
          opacity="0.85"
        />
      );
    }
    return (
      <path
        d={curvePath(type, width, height, invert, pad, steps)}
        stroke={color}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
    );
  };

  return (
    <svg
      className="timeline_clip_overlap_curves"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {renderCurve(fadeOutType, false, FADE_OUT_COLOR)}
      {renderCurve(fadeInType, true, FADE_IN_COLOR)}
    </svg>
  );
}
