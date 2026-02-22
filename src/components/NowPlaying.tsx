import { useState } from 'react';
import '../styles/now-playing.css';

// Mock lyrics data - replace with actual lyrics from API
const mockLyrics = [
  'Cruising through the city lights',
  'Neon signs reflecting in the rain',
  'Midnight drive, no destination',
  'Lost in the rhythm of the night',
];

interface Song {
  title: string;
  artist: string;
  album: string;
  duration: number;
  coverUrl: string;
}

const mockSong: Song = {
  title: 'Midnight Drive',
  artist: 'Neon Pulse',
  album: 'Frequency',
  duration: 245, // 4:05 in seconds
  coverUrl: 'https://i.scdn.co/image/ab67616d00001e02f1f915cc84f06ebe2d4b8746',
};

export default function NowPlaying() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(30); // 0:30 seconds
  const [currentLyricIndex, setCurrentLyricIndex] = useState(0);

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = (currentTime / mockSong.duration) * 100;

  return (
    <div className="now-playing-container">
      <div className="np-content">
        {/* Album Cover */}
        <div className="np-album-cover-wrapper">
          <img 
            src={mockSong.coverUrl} 
            alt={`${mockSong.album} cover`}
            className="np-album-cover"
          />
        </div>

        {/* Main Section */}
        <div className="np-main">
          {/* Song Info Header */}
          <div className="np-header">
            <h2 className="np-title">{mockSong.title}</h2>
            <p className="np-artist">{mockSong.artist}</p>
          </div>

          {/* Progress Bar */}
          <div className="np-progress-section">
            <span className="np-time">{formatTime(currentTime)}</span>
            <div className="np-progress-bar">
              <div className="np-progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <span className="np-time">{formatTime(mockSong.duration)}</span>
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
              className={`np-btn np-play-btn ${isPlaying ? 'active' : ''}`}
              onClick={handlePlay}
              title="Play"
            >
              ▶ Play
            </button>
            <button 
              className={`np-btn np-pause-btn ${!isPlaying ? 'active' : ''}`}
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
