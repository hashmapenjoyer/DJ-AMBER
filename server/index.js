import express from 'express';
import cors from 'cors';
import navBarRoutes from './routes/navBar.js';
import musicLibraryRoutes from './routes/musicLibrary.js';
import nowPlayingRoutes from './routes/nowPlaying.js';
import setListRoutes from './routes/setList.js';
import timelineRoutes from './routes/timeline.js';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/navbar', navBarRoutes);
app.use('/api/music-library', musicLibraryRoutes);
app.use('/api/now-playing', nowPlayingRoutes);
app.use('/api/set-list', setListRoutes);
app.use('/api/timeline', timelineRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Backend is running!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
