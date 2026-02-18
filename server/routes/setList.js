import express from 'express';

const router = express.Router();

/**
 * Set List Section
 * Developer: [Team Member 4]
 * Description: Set list component (30% width) - manages the queue/playlist of upcoming tracks
 */

// GET - Fetch the current set list
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    data: {
      setList: [],
      totalTracks: 0,
      currentIndex: 0,
      message: 'Set List section - Add tracks to the queue'
    }
  });
});

// GET - Fetch a specific track in the set list
router.get('/:id', (req, res) => {
  res.json({
    status: 'success',
    data: {
      id: req.params.id,
      message: 'Track details in set list'
    }
  });
});

// POST - Add a track to the set list
router.post('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Track added to set list',
    data: req.body
  });
});

// PUT - Reorder tracks in set list
router.put('/reorder', (req, res) => {
  res.json({
    status: 'success',
    message: 'Set list reordered',
    data: req.body
  });
});

// DELETE - Remove a track from set list
router.delete('/:id', (req, res) => {
  res.json({
    status: 'success',
    message: `Track ${req.params.id} removed from set list`
  });
});

export default router;
