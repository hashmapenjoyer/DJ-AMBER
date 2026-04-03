import { useEffect, useRef, useState } from 'react';
import { useAudioEngine } from '../audio/UseAudioEngine';
import '../styles/now-playing.css';

// Mock lyrics data - replace with actual lyrics from API
const mockLyrics = [
  'Cruising through the city lights',
  'Neon signs reflecting in the rain',
  'Midnight drive, no destination',
  'Lost in the rhythm of the night',
];

type Seconds = number;

interface WaveformBuffer {
  peaks: number[];
  duration: Seconds;
}

/**
 * Generates waveform data from an AudioBuffer for visualization
 */
function generateWaveformData(buffer: AudioBuffer, targetPeaks: number = 256): WaveformBuffer {
  const peaks: number[] = [];
  const numChannels = buffer.numberOfChannels;
  const samplesPerPeak = Math.ceil(buffer.length / targetPeaks);

  for (let i = 0; i < targetPeaks; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, buffer.length);
    let maxAbs = 0;

    // Check all channels and find max amplitude
    for (let c = 0; c < numChannels; c++) {
      const channelData = buffer.getChannelData(c);
      for (let j = start; j < end; j++) {
        const abs = Math.abs(channelData[j]);
        if (abs > maxAbs) {
          maxAbs = abs;
        }
      }
    }

    peaks.push(maxAbs);
  }

  return { peaks, duration: buffer.duration };
}

/**
 * Draws a 3-second sliding window of waveform on canvas
 */
function drawWaveformWindow(
  canvas: HTMLCanvasElement,
  waveformData: WaveformBuffer,
  currentTime: Seconds,
  windowDuration: Seconds = 3,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const centerY = height / 2;

  // Clear canvas
  ctx.fillStyle = '#0a0e27';
  ctx.fillRect(0, 0, width, height);

  const { peaks, duration } = waveformData;
  if (peaks.length === 0 || duration === 0) return;

  // Calculate which peaks to show (3-second window from current time)
  const windowStart = Math.max(0, currentTime);
  const windowEnd = Math.min(duration, currentTime + windowDuration);
  const startIdx = (windowStart / duration) * peaks.length;
  const endIdx = (windowEnd / duration) * peaks.length;
  const startPeakIdx = Math.floor(startIdx);
  const endPeakIdx = Math.ceil(endIdx);
  const visibleCount = Math.max(1, endPeakIdx - startPeakIdx);

  // Draw bars for visible peaks
  ctx.fillStyle = '#6366f1';
  const barWidth = width / visibleCount;

  for (let i = 0; i < visibleCount; i++) {
    const peakIdx = startPeakIdx + i;
    if (peakIdx >= peaks.length) break;

    const peak = peaks[peakIdx];
    const barHeight = Math.max(1, peak * height * 0.85);
    const x = i * barWidth;

    if (barHeight > 0.5) {
      ctx.fillRect(x, centerY - barHeight / 2, Math.max(0.5, barWidth - 0.5), barHeight);
    }
  }
}

export default function NowPlaying() {
  const { engine, transportState } = useAudioEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [currentLyricIndex] = useState(0);

  // Get current entry (the playing song)
  const currentEntry = engine.getCurrentEntry();
  const currentSongDuration = currentEntry?.playDuration ?? 0;
  const title = currentEntry?.title ?? 'No song playing';

  const currentBuffer = currentEntry ? engine.getBuffer(currentEntry.bufferId) : null;
  const waveformData: WaveformBuffer | null = currentBuffer
    ? generateWaveformData(currentBuffer, 200)
    : null;

  // Update progress bar based on engine's timeline
  useEffect(() => {
    const updateProgress = () => {
      const absTime = engine.getCurrentTime();
      setCurrentTime(absTime);
    };

    // Update immediately
    updateProgress();

    // Update on interval while playing
    if (transportState === 'playing') {
      const interval = setInterval(updateProgress, 100);
      return () => clearInterval(interval);
    }
  }, [engine, transportState]);

  // Draw waveform when data or time changes
  useEffect(() => {
    if (canvasRef.current && waveformData && currentEntry) {
      // Calculate time within current song
      const timeInSong = currentTime - currentEntry.absoluteStart;
      drawWaveformWindow(canvasRef.current, waveformData, timeInSong, 3);
    }
  }, [waveformData, currentTime, currentEntry]);

  const handlePlay = () => {
    void engine.play();
  };

  const handlePause = () => {
    engine.pause();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress within the current song
  const timeInSong = currentEntry ? currentTime - currentEntry.absoluteStart : 0;
  const progressPercent = currentSongDuration > 0 ? (timeInSong / currentSongDuration) * 100 : 0;

  return (
    <div className="now-playing-container">
      <div className="np-content">
        {/* Waveform Thumbnail */}
        <div className="np-waveform-thumbnail">
          <canvas ref={canvasRef} width={100} height={100} className="np-waveform-canvas-small" />
        </div>

        {/* Main Section */}
        <div className="np-main">
          {/* Song Info Header */}
          <div className="np-header">
            <h2 className="np-title">{title}</h2>
            <p className="np-artist">{currentEntry?.bufferId ?? 'Unknown Artist'}</p>
          </div>

          {/* Progress Bar */}
          <div className="np-progress-section">
            <span className="np-time">{formatTime(timeInSong)}</span>
            <div className="np-progress-bar">
              <div className="np-progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <span className="np-time">{formatTime(currentSongDuration)}</span>
          </div>

          {/* Lyrics Section */}
          <div className="np-lyrics-section">
            {mockLyrics.map((lyric, index) => (
              <div
                key={index}
                className={`np-lyric-line ${
                  index === currentLyricIndex ? 'current' : ''
                } ${index < currentLyricIndex ? 'past' : 'upcoming'}`}
              >
                {lyric}
              </div>
            ))}
          </div>

          {/* Controls */}
          <div className="np-controls">
            <button
              className={`np-btn np-play-btn ${transportState === 'playing' ? 'active' : ''}`}
              onClick={handlePlay}
              title="Play"
            >
              ▶ Play
            </button>
            <button
              className={`np-btn np-pause-btn ${transportState !== 'playing' ? 'active' : ''}`}
              onClick={handlePause}
              title="Pause"
            >
              ⏸ Pause
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
