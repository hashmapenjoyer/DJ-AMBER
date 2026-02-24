# DJ-AMBER Development Setup Guide

## Project Structure Overview

This project is organized into 5 independent sections, each with its own frontend component. This allows all 5 developers to work in parallel without stepping on each other's toes.

### Layout Architecture

```
┌──────────────────────────────────────────────────┐
│                   NavBar (10%)                   │ Team Member 1
├──────────────────┬──────────────────┬────────────┤
│                  │                  │            │
│  Music Library   │  Now Playing     │  Set List  │ 50% height
│   (30% width)    │  (40% width)     │ (30% width)│ Team Members 2, 3, 4
│                  │                  │            │
├──────────────────┴──────────────────┴────────────┤
│              Timeline (50% height)               │ Team Member 5
│           Stretches Full Width                   │
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

This command will start both the frontend server:
- **Frontend**: http://localhost:5173 (Vite dev server)

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

## Development Workflow

### For Frontend Development

1. Edit your assigned component in `src/components/YourSection.tsx`
2. Update styling in `src/App.css` if needed (keep red borders for section separation)
3. The frontend automatically hot-reloads as you save changes

## Important Notes

- **Red borders**: All sections have red 2px borders for clear visual separation during development
- **Independent development**: Each team member works only on their assigned files

## Next Steps

1. Install dependencies: `npm install`
2. Start development: `npm run dev`
3. Each team member starts working on their assigned component and backend routes
4. Integration happens naturally through the API endpoints

## Troubleshooting

**Port conflicts?**
- Frontend default: 5173
- Modify in `vite.config.ts` if needed

**Changes not reflecting?**
- Clear your browser cache (Ctrl+F5)
- Restart the development server (Ctrl+C and run `npm run dev` again)
