import { useEffect, useRef, useCallback } from 'react';
import { Music, Play, Pause } from 'lucide-react';
import '../styles/now-playing.css';
import { useAudioEngine } from '../audio/UseAudioEngine';
import { formatDuration } from '../../types/FormatDuration';

export default function NowPlaying() {
  const { engine, currentSongTitle, currentSongArtist, transportState } = useAudioEngine();

  const isPlaying = transportState === 'playing';
  const hasTrack = currentSongTitle !== '';

  // direct DOM refs — updated via rAF to avoid 60fps React re-renders
  const fillRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef<HTMLSpanElement>(null);
  const totalTimeRef = useRef<HTMLSpanElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // drag tracking — ref so mousemove doesn't cause re-renders
  const isDragging = useRef(false);

  const getSeekTime = useCallback(
    (clientX: number): number => {
      const bar = progressBarRef.current;
      if (!bar) return 0;
      const rect = bar.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const entry = engine.getCurrentEntry();
      if (!entry) return 0;
      return entry.absoluteStart + fraction * entry.playDuration;
    },
    [engine],
  );

  // rAF loop — updates fill width and time labels without React state
  useEffect(() => {
    const tick = () => {
      const entry = engine.getCurrentEntry();
      const trackStart = entry?.absoluteStart ?? 0;
      const trackDuration = entry?.playDuration ?? 0;
      const current = Math.max(0, engine.transport.getCurrentTime() - trackStart);
      const pct = trackDuration > 0 ? (current / trackDuration) * 100 : 0;

      if (fillRef.current) fillRef.current.style.width = `${pct}%`;
      if (currentTimeRef.current) currentTimeRef.current.textContent = formatDuration(current);
      if (totalTimeRef.current) totalTimeRef.current.textContent = formatDuration(trackDuration);

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [engine]);

  // drag-to-seek: attach mousemove/mouseup on document so cursor can leave the bar
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      engine.transport.seek(getSeekTime(e.clientX));
    };
    const onUp = () => {
      isDragging.current = false;
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [engine, getSeekTime]);

  const handleBarMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    engine.transport.seek(getSeekTime(e.clientX));
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      engine.transport.pause();
    } else {
      void engine.transport.play();
    }
  };

  return (
    <div className="now-playing-container">
      <div className="np-content">
        {/* Album Cover */}
        <div className="np-album-cover-wrapper">
          <div className="np-album-cover np-album-cover--placeholder">
            <Music className="np-music-icon" size={40} strokeWidth={1.5} />
          </div>
        </div>

        {/* Main Section */}
        <div className="np-main">
          <div className="np-header">
            <h2 className="np-title">{hasTrack ? currentSongTitle : 'No track playing'}</h2>
            <p className="np-artist">{hasTrack ? currentSongArtist : '—'}</p>
          </div>

          {/* Progress bar */}
          <div className="np-progress-section">
            <span className="np-time" ref={currentTimeRef}>
              0:00
            </span>
            <div className="np-progress-bar" ref={progressBarRef} onMouseDown={handleBarMouseDown}>
              <div className="np-progress-fill" ref={fillRef} style={{ width: '0%' }} />
            </div>
            <span className="np-time" ref={totalTimeRef}>
              0:00
            </span>
          </div>

          {/* Controls */}
          <div className="np-controls">
            <button
              className={`np-btn ${isPlaying ? 'active' : ''}`}
              onClick={handlePlayPause}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
