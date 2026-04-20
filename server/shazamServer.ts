import express from 'express';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { Shazam } = require('node-shazam');

const app = express();
const PORT = 3001;

app.use(express.json());

// Keep uploaded bytes in memory; we flush to a temp file because
// Shazam needs a file path rather than a buffer.
const upload = multer({ storage: multer.memoryStorage() });

const shazam = new Shazam();

interface ShazamResponse {
  title: string | null;
  artist: string | null;
  coverUrl: string | null;
}

async function recogniseBuffer(
  buffer: Buffer,
  originalName: string,
): Promise<Record<string, unknown> | null> {
  const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const tmpPath = path.join(os.tmpdir(), `shazam-${Date.now()}-${safeName}`);
  try {
    fs.writeFileSync(tmpPath, buffer);
    return (await shazam.recognise(tmpPath, 'en-US')) as Record<string, unknown>;
  } finally {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // intentionally empty
    }
  }
}

app.post('/api/shazam', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No audio file provided' });
    return;
  }

  console.log(`[shazam-server] Fingerprint: "${req.file.originalname}" (${req.file.size} bytes)`);

  try {
    const result = await recogniseBuffer(req.file.buffer, req.file.originalname);

    console.log('[shazam-server] Fingerprint raw result:', JSON.stringify(result, null, 2));

    const track = (result as any)?.track;

    if (!track?.title) {
      console.log('[shazam-server] Song not recognized.');
      res.status(404).json({ error: 'Song not recognized' });
      return;
    }

    const payload: ShazamResponse = {
      title: track.title ?? null,
      artist: track.subtitle ?? null, // raw Shazam API uses "subtitle" for the artist
      coverUrl: track.images?.coverarthq ?? track.images?.coverart ?? null,
    };

    console.log('[shazam-server] Fingerprint payload:', payload);
    res.json(payload);
  } catch (err) {
    console.error('[shazam-server] Fingerprint failed:', err);
    res.status(500).json({ error: 'Recognition failed' });
  }
});

app.post('/api/shazam/search', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No audio file provided' });
    return;
  }

  console.log(`[shazam-server] Cover art search: "${req.file.originalname}"`);

  try {
    const result = await recogniseBuffer(req.file.buffer, req.file.originalname);

    console.log('[shazam-server] Search raw result:', JSON.stringify(result, null, 2));

    const track = (result as any)?.track;

    // Only extract cover art - never use the recognised title/artist, since
    // the caller already has trusted tag values for those fields.
    const coverUrl: string | null = track?.images?.coverarthq ?? track?.images?.coverart ?? null;

    console.log(`[shazam-server] Cover art URL: ${coverUrl}`);
    res.json({ coverUrl });
  } catch (err) {
    // A failed fingerprint just means no art available - not a server error.
    console.warn('[shazam-server] Cover art search failed, returning null:', err);
    res.json({ coverUrl: null });
  }
});

app.listen(PORT, () => {
  console.log(`[shazam-server] Listening on http://localhost:${PORT}`);
  console.log('[shazam-server] POST /api/shazam        - audio fingerprinting');
  console.log('[shazam-server] POST /api/shazam/search - cover art by audio fingerprint');
});
