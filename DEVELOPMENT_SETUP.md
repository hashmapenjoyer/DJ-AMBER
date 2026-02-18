# DJ-AMBER Development Setup Guide

## Project Structure Overview

This project is organized into 5 independent sections, each with its own frontend component and backend API route. This allows all 5 developers to work in parallel without stepping on each other's toes.

### Layout Architecture

```
┌─────────────────────────────────────────────────┐
│                   NavBar (10%)                   │ Team Member 1
├──────────────────┬──────────────────┬────────────┤
│                  │                  │            │
│  Music Library   │  Now Playing     │  Set List  │ 50% height
│   (30% width)    │  (40% width)     │ (30% width)│ Team Members 2, 3, 4
│                  │                  │            │
├──────────────────┴──────────────────┴────────────┤
│              Timeline (50% height)                │ Team Member 5
│           Stretches Full Width                    │
└──────────────────────────────────────────────────┘
```

## Assigned Sections by Developer

1. **Team Member 1**: NavBar - `src/components/NavBar.tsx`
2. **Team Member 2**: Music Library - `src/components/MusicLibrary.tsx`
3. **Team Member 3**: Now Playing - `src/components/NowPlaying.tsx`
4. **Team Member 4**: Set List - `src/components/SetList.tsx`
5. **Team Member 5**: Timeline - `src/components/Timeline.tsx`

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation

```bash
npm install
```

### Running the Project

```bash
npm run dev
```

This command will start both the frontend and backend servers concurrently:
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:3001 (Express API server)

## Architecture

### Frontend Structure

```
src/
├── components/          # Individual section components
│   ├── NavBar.tsx
│   ├── MusicLibrary.tsx
│   ├── NowPlaying.tsx
│   ├── SetList.tsx
│   └── Timeline.tsx
├── App.tsx              # Main layout container
├── App.css              # Layout styling
└── main.tsx
```

### Backend Structure

```
server/
├── index.js             # Express server setup
└── routes/
    ├── navBar.js        # NavBar API endpoints
    ├── musicLibrary.js  # Music Library API endpoints
    ├── nowPlaying.js    # Now Playing API endpoints
    ├── setList.js       # Set List API endpoints
    └── timeline.js      # Timeline API endpoints
```

## Backend API Endpoints

### Health Check
- **GET** `/api/health` - Check if backend is running

### NavBar Routes (Team Member 1)
- **GET** `/api/navbar` - Fetch navbar configuration
- **POST** `/api/navbar` - Update navbar settings

### Music Library Routes (Team Member 2)
- **GET** `/api/music-library` - Fetch all songs
- **GET** `/api/music-library/:id` - Fetch song details
- **POST** `/api/music-library` - Add song to library
- **DELETE** `/api/music-library/:id` - Remove song from library

### Now Playing Routes (Team Member 3)
- **GET** `/api/now-playing` - Fetch currently playing track
- **POST** `/api/now-playing/play` - Start playback
- **POST** `/api/now-playing/pause` - Pause playback
- **POST** `/api/now-playing/resume` - Resume playback
- **POST** `/api/now-playing/stop` - Stop playback

### Set List Routes (Team Member 4)
- **GET** `/api/set-list` - Fetch set list queue
- **GET** `/api/set-list/:id` - Fetch track details
- **POST** `/api/set-list` - Add track to queue
- **PUT** `/api/set-list/reorder` - Reorder tracks
- **DELETE** `/api/set-list/:id` - Remove track from queue

### Timeline Routes (Team Member 5)
- **GET** `/api/timeline` - Fetch timeline/waveform data
- **GET** `/api/timeline/:trackId` - Fetch track timeline
- **POST** `/api/timeline/seek` - Update playback position
- **POST** `/api/timeline/marker` - Add cue point
- **DELETE** `/api/timeline/marker/:markerId` - Remove cue point

## Development Workflow

### For Frontend Development

1. Edit your assigned component in `src/components/YourSection.tsx`
2. Update styling in `src/App.css` if needed (keep red borders for section separation)
3. The frontend automatically hot-reloads as you save changes

### For Backend Development

1. Edit your assigned route file in `server/routes/yourSection.js`
2. The backend automatically restarts as you save changes (using `--watch` flag)
3. Test endpoints using Postman, curl, or your frontend component

### Component to Backend Connection Example

```typescript
// In your React component
async function fetchData() {
  const response = await fetch('http://localhost:3001/api/your-section');
  const data = await response.json();
  return data;
}
```

## Important Notes

- **Red borders**: All sections have red 2px borders for clear visual separation during development
- **Independent development**: Each team member works only on their assigned files
- **No conflicts**: Backend API routes are isolated per section (/api/section-name)
- **Concurrent development**: Frontend and backend run simultaneously
- **CORS enabled**: Backend has CORS enabled to allow frontend requests from any origin

## Next Steps

1. Install dependencies: `npm install`
2. Start development: `npm run dev`
3. Each team member starts working on their assigned component and backend routes
4. Integration happens naturally through the API endpoints

## Troubleshooting

**Backend not running?**
```bash
npm install concurrently
npm run dev
```

**Port conflicts?**
- Frontend default: 5173
- Backend default: 3001
- Modify in `vite.config.ts` and `server/index.js` if needed

**Changes not reflecting?**
- Clear your browser cache (Ctrl+F5)
- Restart the development server (Ctrl+C and run `npm run dev` again)
