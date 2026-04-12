# DJ-AMBER Architecture Overview

Welcome to the codebase. This doc should give you enough context to navigate the project and understand why things are the way they are. For the nitty-gritty API details, check out [AUDIO_ENGINE.md](AUDIO_ENGINE.md). For formatting/lint rules, see [CODING_STANDARDS.md](CODING_STANDARDS.md).

---

## What Is This?

DJ-AMBER is a browser-based DJ application. You build a set list of songs, arrange them on a timeline with crossfade transitions, drop in sound effects, and hit play. All the audio runs through the Web Audio API, so no server, no plugins, everything happens client-side in the browser.

The stack is **React + TypeScript + Vite**. The UI is a single-page app with five main sections (navbar, music library, now playing, set list, and timeline).

---

## The Big Idea: Keep Audio Out of React

The core architectural decision is that all audio logic lives in plain TypeScript classes, completely separate from React. The React layer just listens for events and renders. It never owns audio state, never manages `AudioContext` lifecycles, and never touches `AudioBufferSourceNode`s directly.

This separation exists because trying to sync `AudioContext` state with React state is a total nightmare. So instead, we have a self-contained audio engine that React talks to through a single hook (`useAudioEngine`), which uses `useSyncExternalStore` under the hood to stay efficient.

---

## Project Layout

```
src/
├── audio/                  # The audio engine (pure TypeScript, zero React)
│   ├── AudioEngine.ts      # The mediator -- wires everything together
│   ├── TransportController  # Play/pause/stop/seek state machine
│   ├── PlaylistController   # Playlist + transition CRUD
│   ├── PlaylistManager      # Timeline math (internal to PlaylistController)
│   ├── Scheduler            # Look-ahead scheduling loop (internal)
│   ├── BufferCache          # Decoded audio buffer storage (internal)
│   ├── SfxController        # Sound effects management
│   ├── VolumeController     # Gain node graph
│   ├── EventEmitter         # Generic typed pub/sub
│   ├── UseAudioEngine       # The React hook
│   └── types.ts             # Shared type definitions
│
├── components/              # React UI components
│   ├── NavBar.tsx
│   ├── MusicLibrary.tsx
│   ├── NowPlaying.tsx
│   ├── SetList.tsx
│   ├── Timeline.tsx
│   └── HelpModal.tsx
│
├── styles/                  # CSS + design system tokens
├── data/                    # Mock data for development
└── App.tsx                  # Root component

types/                       # Shared TypeScript types (Clip, Fade, Track, etc.)
docs/                        # You are here
```

The `src/audio/` directory is the interesting part. Everything else is fairly standard React/Vite.

---

## The Mediator Pattern

`AudioEngine` is the central coordinator. It owns all the controllers, wires their callbacks together, and is the only class that knows about more than one subsystem. The controllers themselves have no idea each other exist, they just do their job and call an injected callback when something changes.

For example, when you add a song to the playlist:

1. `PlaylistController.append()` adds the entry and calls its `onChanged` callback
2. `AudioEngine` receives that callback and runs `recomputeAndSync()`
3. `PlaylistManager` recomputes the timeline (absolute start/end times, fade curves)
4. `Scheduler` gets the updated timeline so it knows what to play next
5. `AudioEngine` emits `playlistChange` and `timelineChange` events
6. React re-renders via `useSyncExternalStore`

No controller ever imports or references another controller. All cross-cutting coordination flows through the mediator. This keeps each class focused and testable in isolation.

---

## Controller Breakdown

Each controller owns exactly one responsibility:

| Class                   | What It Does                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **TransportController** | State machine for transport (`stopped -> playing -> paused -> ...`). Owns the playhead position.                                               |
| **PlaylistController**  | CRUD for playlist entries and transitions. Delegates data storage to PlaylistManager.                                                          |
| **PlaylistManager**     | Pure data + math. Stores entries, computes the timeline (absolute times, crossfade overlaps, fade curves). No audio, no side effects.          |
| **Scheduler**           | Look-ahead scheduling loop. Every 25ms, checks what needs to play in the next 200ms and schedules WebAudio nodes with hardware-precise timing. |
| **BufferCache**         | Decodes raw `ArrayBuffer`s into `AudioBuffer`s and stores them by ID.                                                                          |
| **VolumeController**    | Manages the gain node graph (master, music track, SFX track).                                                                                  |
| **SfxController**       | CRUD for sound effect clips placed on the timeline.                                                                                            |
| **EventEmitter**        | Generic, typed pub/sub with no external dependencies. `AudioEngine` extends this.                                                              |

The "internal" classes (`PlaylistManager`, `Scheduler`, `BufferCache`) are not exposed on the public API. They're implementation details that only `AudioEngine` or their parent controller interacts with.

---

## How the Classes Relate

```
AudioEngine (extends EventEmitter<AudioEngineEvents>)
│
├── owns TransportController
├── owns PlaylistController
│        └── uses PlaylistManager (pure data layer)
├── owns SfxController
├── owns VolumeController
├── owns Scheduler
└── owns BufferCache
```

- **Inheritance** is used once: `AudioEngine extends EventEmitter`. This gives the engine typed event emission without pulling in a third-party library.
- **Composition** is used everywhere else. Controllers are instantiated in `AudioEngine`'s constructor and wired together via callbacks.
- **Dependency injection** via constructor parameters. Controllers receive callbacks like `onChanged`, `onStateChange`, `onSongChange` -- they don't import the things they notify.

---

## Types and the Type System

Shared types live in two places:

- `types/` at the project root -- domain types used across the app (`Clip`, `Fade`, `Track`, `LibraryItem`, etc.). These use branded types for safety (e.g., `ID`, `Seconds`, `Gain` are distinct from plain `string`/`number`).
- `src/audio/types.ts` -- audio-engine-specific types (`PlaylistEntry`, `ScheduledEntry`, `Transition`, `TransportState`, `SfxClip`, etc.).

The branded utility types (`ID`, `Seconds`, `Gain`) prevent you from accidentally passing a gain value where a duration is expected. TypeScript catches it at compile time.

---

## Coding Standards

The project enforces a consistent style through ESLint (flat config) + Prettier + strict TypeScript. The highlights:

- **`private` keyword** over `#private` fields (enforced by lint)
- **No `I` prefix** on interfaces (`IUser` -> just `User`)
- **`import type`** for type-only imports
- **camelCase** for variables/functions, **PascalCase** for types/components
- **Strict mode** enabled in TypeScript -- unused variables are errors, not warnings
- **2-space indentation**, single quotes, semicolons, trailing commas

CI runs `npm run lint` on every PR to `main`. See [CODING_STANDARDS.md](CODING_STANDARDS.md) for the full rule set.

---

## Security and User Data

Everything runs client-side. Audio files are decoded and held in memory. they're never sent to a server, never persisted to `localStorage` or `IndexedDB`, and never leave the browser tab. Set lists live in React state and are also not persisted anywhere. When you close the tab, everything is gone.

There's no authentication, no user accounts, and no backend. The app doesn't store user data, so there's nothing to secure in that regard. If persistence is added later, that would need its own security review.

---

## The React Layer

React components consume the engine through a single hook:

```tsx
const { engine, transportState, playlist, timeline, currentSongTitle } = useAudioEngine();
```

The hook creates a singleton `AudioEngine` instance and subscribes to its events via `useSyncExternalStore`. Components call methods on the engine imperatively (`engine.transport.play()`, `engine.playlist.append(...)`) and receive state updates reactively through the hook's return values.

The five main UI components (NavBar, MusicLibrary, NowPlaying, SetList, Timeline) are independent -- each was built by a different team member and they don't import from each other. Shared state flows through the audio engine, not through React props or context drilling.

---

## Quick Glossary

| Term                | Meaning                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| **Entry**           | A song in the playlist (`PlaylistEntry`)                                                       |
| **Transition**      | A crossfade between two adjacent entries                                                       |
| **Timeline**        | The computed array of `ScheduledEntry` objects with absolute start/end times                   |
| **Scheduled Entry** | An entry enriched with absolute times and fade curves -- what the scheduler actually plays      |
| **Buffer**          | A decoded `AudioBuffer` stored in `BufferCache`                                                |
| **Transport**       | The play/pause/stop/seek state machine                                                         |
| **Mediator**        | `AudioEngine` -- the class that wires all the controllers together                              |
| **Look-ahead**      | The scheduling strategy: check every 25ms, schedule 200ms ahead, let WebAudio handle precision |
