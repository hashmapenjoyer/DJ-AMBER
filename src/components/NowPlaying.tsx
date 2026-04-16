import { useEffect, useRef, useCallback, useState } from 'react';
import { Music, Play, Pause } from 'lucide-react';
import '../styles/now-playing.css';
import { useAudioEngine } from '../audio/UseAudioEngine';
import { formatDuration } from '../../types/FormatDuration';
import type { LibraryItem } from '../../types/LibraryItem';

interface NowPlayingProps {
  libraryItems: LibraryItem[];
}

export default function NowPlaying({ libraryItems }: NowPlayingProps) {
  const { engine, currentSongTitle, currentSongArtist, transportState } = useAudioEngine();

  // slider positions: HP 0-100 maps to 20-2000 Hz, LP 0-100 maps to 200-20000 Hz
  const [hpSlider, setHpSlider] = useState(0);
  const [lpSlider, setLpSlider] = useState(100);

  const sliderToHighpass = (v: number) => 20 * Math.pow(100, v / 100);
  const sliderToLowpass = (v: number) => 200 * Math.pow(100, v / 100);

  const formatFreq = (hz: number): string => {
    if (hz >= 1000) return `${(hz / 1000).toFixed(hz >= 10000 ? 0 : 1)}k`;
    return `${Math.round(hz)}`;
  };

  const handleHpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setHpSlider(v);
    engine.volume.setHighpass(sliderToHighpass(v));
  };

  const handleLpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setLpSlider(v);
    engine.volume.setLowpass(sliderToLowpass(v));
  };

  const hpFreq = sliderToHighpass(hpSlider);
  const lpFreq = sliderToLowpass(lpSlider);
  const hpActive = hpSlider > 0;
  const lpActive = lpSlider < 100;

  const isPlaying = transportState === 'playing';
  const hasTrack = currentSongTitle !== '';

  const currentBufferId = engine.getCurrentEntry()?.bufferId;
  const coverUrl = currentBufferId
    ? libraryItems.find((item) => item.id === currentBufferId)?.coverUrl
    : undefined;

  // direct DOM refs (updated via rAF to avoid 60fps React re-renders)
  const fillRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef<HTMLSpanElement>(null);
  const totalTimeRef = useRef<HTMLSpanElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // drag tracking, ref so mousemove doesn't cause re-renders
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

  // rAF loop, updates fill width and time labels without React state
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
          {coverUrl ? (
            <img className="np-album-cover" src={coverUrl} alt="Album cover" />
          ) : (
            <div className="np-album-cover np-album-cover--placeholder">
              <Music className="np-music-icon" size={40} strokeWidth={1.5} />
            </div>
          )}
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

          {/* Filters */}
          <div className="np-filter-section">
            <span className="np-filter-title">Filters</span>
            <div className="np-filter-rows">
              <div className="np-filter-row">
                <div className="np-filter-row-header">
                  <span className="np-filter-label">HP</span>
                  <span className={`np-filter-value ${hpActive ? 'np-filter-value--active' : ''}`}>
                    {hpActive ? `${formatFreq(hpFreq)} Hz` : 'OFF'}
                  </span>
                </div>
                <input
                  type="range"
                  className="np-filter-slider"
                  min={0}
                  max={100}
                  value={hpSlider}
                  onChange={handleHpChange}
                />
              </div>
              <div className="np-filter-row">
                <div className="np-filter-row-header">
                  <span className="np-filter-label">LP</span>
                  <span className={`np-filter-value ${lpActive ? 'np-filter-value--active' : ''}`}>
                    {lpActive ? `${formatFreq(lpFreq)} Hz` : 'OFF'}
                  </span>
                </div>
                <input
                  type="range"
                  className="np-filter-slider"
                  min={0}
                  max={100}
                  value={lpSlider}
                  onChange={handleLpChange}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
