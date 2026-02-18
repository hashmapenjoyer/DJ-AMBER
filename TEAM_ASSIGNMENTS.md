# Team Member Assignment Guide

## Quick Reference for Each Developer

### Team Member 1: NavBar Development

**Frontend Files:**
- `src/components/NavBar.tsx` - Your React component
- `src/App.css` - Update `.navbar` styles if needed

**Backend Files:**
- `server/routes/navBar.js` - Your API endpoints

**API Base URL:** `http://localhost:3001/api/navbar`

**Key Endpoints:**
- `GET /api/navbar` - Fetch navbar config
- `POST /api/navbar` - Update navbar

---

### Team Member 2: Music Library Development

**Frontend Files:**
- `src/components/MusicLibrary.tsx` - Your React component
- `src/App.css` - Update `.music-library` styles if needed

**Backend Files:**
- `server/routes/musicLibrary.js` - Your API endpoints

**API Base URL:** `http://localhost:3001/api/music-library`

**Key Endpoints:**
- `GET /api/music-library` - Fetch all songs
- `GET /api/music-library/:id` - Get song details
- `POST /api/music-library` - Add song
- `DELETE /api/music-library/:id` - Remove song

---

### Team Member 3: Now Playing Development

**Frontend Files:**
- `src/components/NowPlaying.tsx` - Your React component
- `src/App.css` - Update `.now-playing` styles if needed

**Backend Files:**
- `server/routes/nowPlaying.js` - Your API endpoints

**API Base URL:** `http://localhost:3001/api/now-playing`

**Key Endpoints:**
- `GET /api/now-playing` - Fetch current track
- `POST /api/now-playing/play` - Start playback
- `POST /api/now-playing/pause` - Pause
- `POST /api/now-playing/resume` - Resume
- `POST /api/now-playing/stop` - Stop

---

### Team Member 4: Set List Development

**Frontend Files:**
- `src/components/SetList.tsx` - Your React component
- `src/App.css` - Update `.set-list` styles if needed

**Backend Files:**
- `server/routes/setList.js` - Your API endpoints

**API Base URL:** `http://localhost:3001/api/set-list`

**Key Endpoints:**
- `GET /api/set-list` - Fetch queue
- `GET /api/set-list/:id` - Get track details
- `POST /api/set-list` - Add to queue
- `PUT /api/set-list/reorder` - Reorder queue
- `DELETE /api/set-list/:id` - Remove from queue

---

### Team Member 5: Timeline Development

**Frontend Files:**
- `src/components/Timeline.tsx` - Your React component
- `src/App.css` - Update `.timeline` styles if needed

**Backend Files:**
- `server/routes/timeline.js` - Your API endpoints

**API Base URL:** `http://localhost:3001/api/timeline`

**Key Endpoints:**
- `GET /api/timeline` - Fetch timeline data
- `GET /api/timeline/:trackId` - Get track timeline
- `POST /api/timeline/seek` - Seek to position
- `POST /api/timeline/marker` - Add marker
- `DELETE /api/timeline/marker/:markerId` - Remove marker

---

## Do's and Don'ts

### ✅ Do:
- Work only in your assigned component and route files
- Keep your section's red border styling during development
- Test your API endpoints with curl or Postman
- Call other team members' APIs when you need data
- Update your component to fetch from your own backend

### ❌ Don't:
- Modify other team members' component files
- Remove or change red borders from layout
- Change the main layout structure in `App.tsx`
- Modify `App.css` main layout classes (only update your own section styles)
- Add new routes outside your section's route file

## Testing Your Work

### Test Frontend Component
1. Start dev server: `npm run dev`
2. Visit http://localhost:5173
3. Look for your labeled section with red border
4. Test interactions within your section

### Test Backend Endpoints
```bash
# Using curl (replace with your endpoints)
curl http://localhost:3001/api/your-section

# Or use Postman
# Import endpoints and test individual API calls
```

## Getting Help

- **Layout Issues?** - Contact the original project setup
- **API Issues?** - Check `server/routes/yourSection.js`
- **Frontend Issues?** - Check `src/components/YourSection.tsx`
- **Port/Server Issues?** - Restart with `npm run dev`
