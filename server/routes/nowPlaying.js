import express from 'express';

const router = express.Router();

/**
 * Now Playing Section
 * Developer: [Team Member 3]
 * Description: Now playing component (40% width) - displays currently playing track and playback controls
 */

// GET - Fetch currently playing track
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    data: {
      currentTrack: null,
      isPlaying: false,
      duration: 0,
      currentTime: 0,
      message: 'Now Playing section - Add playback information'
    }
  });
});

// POST - Set the current playing track
router.post('/play', (req, res) => {
  res.json({
    status: 'success',
    message: 'Track playback started',
    data: req.body
  });
});

// POST - Pause current track
router.post('/pause', (req, res) => {
  res.json({
    status: 'success',
    message: 'Track paused'
  });
});

// POST - Resume current track
router.post('/resume', (req, res) => {
  res.json({
    status: 'success',
    message: 'Track resumed'
  });
});

// POST - Stop current track
router.post('/stop', (req, res) => {
  res.json({
    status: 'success',
    message: 'Track stopped'
  });
});

export default router;
