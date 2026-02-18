import express from 'express';

const router = express.Router();

/**
 * Music Library Section
 * Developer: [Team Member 2]
 * Description: Music library component (30% width) - displays available songs/tracks
 */

// GET - Fetch all songs from library
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    data: {
      songs: [],
      totalSongs: 0,
      message: 'Music Library section - Add songs to the library'
    }
  });
});

// GET - Fetch a specific song by ID
router.get('/:id', (req, res) => {
  res.json({
    status: 'success',
    data: {
      id: req.params.id,
      message: 'Song details endpoint'
    }
  });
});

// POST - Add a new song to the library
router.post('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Song added to library',
    data: req.body
  });
});

// DELETE - Remove a song from the library
router.delete('/:id', (req, res) => {
  res.json({
    status: 'success',
    message: `Song ${req.params.id} removed from library`
  });
});

export default router;
