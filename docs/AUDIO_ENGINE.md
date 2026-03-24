# DJ-AMBER Audio Engine

This should cover everything you need to know to work with the audio engine from React components. The internals are explained too, but if you just want to know how to use it [click here](#using-the-engine-from-react).

---

## Overall Structure

The audio engine is a set of plain TypeScript classes that sit completely outside of React. `AudioEngine` is a **mediator** that wires together focused controllers. Each one owns a single responsibility. React **should only listen and render.**

```
src/audio/
|-- AudioEngine.ts          <- mediator: wires controllers, emits events
|-- TransportController.ts  <- play/pause/stop/seek, transport state machine
|-- PlaylistController.ts   <- playlist + transition CRUD
|-- SfxController.ts        <- SFX clip management
|-- VolumeController.ts     <- gain node graph + volume setters
|-- useAudioEngine.ts       <- the React hook that wraps it
|-- PlaylistManager.ts      <- playlist + crossfade math (internal)
|-- Scheduler.ts            <- look-ahead scheduling loop (internal)
|-- BufferCache.ts           <- decoded AudioBuffer storage (internal)
|-- EventEmitter.ts         <- typed pub/sub (no external deps)
|-- types.ts                <- all the shared types
```

The node graph looks like this:

```
AudioBufferSourceNode
  |--> GainNode (per-clip fades)
        |--> GainNode (musicTrackGain/sfxTrackGain)   [VolumeController]
              |--> GainNode (masterGain)               [VolumeController]
                    |--> ctx.destination
```

---

## Using the Engine from React

### 1. Import the hook

```tsx
import { useAudioEngine } from '@/audio/useAudioEngine';
```

### 2. What the hook gives you

```tsx
const { engine, transportState, playlist, timeline, currentSongTitle } = useAudioEngine();
```

| Value | Type | When it updates |
|---|---|---|
| `engine` | `AudioEngine` | Never, it's a stable singleton |
| `transportState` | `'stopped' \| 'playing' \| 'paused'` | On play/pause/stop |
| `playlist` | `ReadonlyArray<PlaylistEntry>` | When songs are added/removed/reordered |
| `timeline` | `ReadonlyArray<ScheduledEntry>` | When playlist or transitions change |
| `currentSongTitle` | `string` | When the currently playing song changes |

I used `useSyncExternalStore` under the hood so it should be pretty easy to use + efficient.

### 3. Transport controls

```tsx
// async bc audio programming on browsers is dumb and painful
await engine.transport.play();

// pause (remembers position)
engine.transport.pause();

// stop (resets to 0)
engine.transport.stop();

// seek to a position in seconds (2:00 in this case)
engine.transport.seek(120);
```

### 4. Loading audio files

Before you can add a song to the playlist, you need to decode and cache its audio data. You supply the ID. Just use `crypto.randomUUID()` preferably.

```tsx
const handleFileInput = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const bufferId = crypto.randomUUID();
  await engine.buffers.add(bufferId, arrayBuffer);

  // now you can add it to the playlist
  engine.playlist.append(bufferId, file.name);
};
```

`engine.buffers.add()` resolves with the decoded `AudioBuffer` if you need it, but you don't have to use the return value.

### 5. Managing the playlist

```tsx
// add to the end
engine.playlist.append(bufferId, title);

// insert at a specific index
engine.playlist.insert(2, bufferId, title);

// remove by entry ID (not buffer ID!!)
engine.playlist.remove(entryId);

// since we're doing drag-and-drop reorder, this is specifically for that use-case
engine.playlist.reorder(fromIndex, toIndex);

// read current state
const entries = engine.playlist.getEntries(); // ReadonlyArray<PlaylistEntry>
```

Each `PlaylistEntry` has:
```ts
{
  id: string;       // entry ID for remove, transitions, etc.
  bufferId: string; // the decoded audio buffer ID
  title: string;
  duration: number; // seconds
}
```

**Note:** Removing the currently-playing song does a 50ms fade-out so it doesn't click. You don't have to do anything special cuz I'm the goat.

### 6. Crossfade transitions

```tsx
// add/update a crossfade (you need both entry IDs from getEntries())
engine.playlist.setTransition(fromEntryId, toEntryId, durationSeconds);

// with specific fade curve types
import { FadeType } from '@/types/Fade';
engine.playlist.setTransition(fromEntryId, toEntryId, 5, FadeType.EXPONENTIAL, FadeType.LINEAR);

// remove it
engine.playlist.removeTransition(fromEntryId, toEntryId);
```

Transitions are clamped to the shorter of the two songs' durations, so you can't accidentally create an impossible overlap. They also only work between adjacent entries, so if you reorder the playlist we prune any invalid ones automatically.

If you change a transition while something is playing, it updates the gain automation on the currently-playing nodes in-place. Hopefully. Have not been able to test this bit yet.

### 7. SFX clips

```tsx
const sfxId = engine.sfx.add({
  bufferId,           // decoded buffer ID (load it first with buffers.add)
  absoluteStart: 30,  // start at 30s on the timeline
  duration: 5,        // play for 5 seconds
  bufferOffset: 0,    // start from the beginning of the buffer (or trim the start)
  gain: 0.8,          // 0.0–1.0
});

// remove it later
engine.sfx.remove(sfxId);
```

### 8. Volume controls

Separate gain stages so you can control the overall playlist volume vs. sfx volume.

```tsx
engine.volume.setMaster(0.8); // affects everything
engine.volume.setMusic(0.6);  // affects only the music track
engine.volume.setSfx(1.0);    // affects only SFX clips
```

All values are linear gain (`0.0`–`1.0`).

### 9. The playhead (do NOT use state for this!!)

`engine.transport.getCurrentTime()` is pure arithmetic (`transportTimeAtPlay + elapsed`), so it's ok to call 60 times per second and costs essentially nothing. So help me god if you put it in a React state we will be re-rendering 60 times per second and I will blow up your computer.

Just use a `requestAnimationFrame` loop. I AI'd an example for your convenience:

```tsx
useEffect(() => {
  if (transportState !== 'playing') return;

  let rafId: number;
  const tick = () => {
    const t = engine.transport.getCurrentTime(); // cheap, no side effects
    drawPlayhead(t);                             // update canvas or DOM directly
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return () => cancelAnimationFrame(rafId);
}, [transportState, engine]);
```

### 10. Waveform rendering

You can get the raw `AudioBuffer` and `AudioContext` for waveform visualization:

```tsx
const ctx = engine.ctx;                            // AudioContext
const buffer = engine.buffers.get(bufferId);       // AudioBuffer | undefined
const duration = engine.buffers.getDuration(id);   // Seconds | undefined
```

The `ScheduledEntry[]` from `timeline` gives you each song's `absoluteStart` and `absoluteEnd` positions on the timeline, which is what you should need to lay out the waveforms correctly.

### 11. Misc

```tsx
engine.transport.getState();         // 'stopped' | 'playing' | 'paused'
engine.getTotalDuration();           // total length of the set in seconds
engine.getCurrentEntry();            // ScheduledEntry | undefined (the currently-playing song)
engine.playlist.getEntries();        // ReadonlyArray<PlaylistEntry>
engine.getTimeline();                // ReadonlyArray<ScheduledEntry>
engine.playlist.getTransitions();    // ReadonlyArray<Transition>
engine.sfx.getClips();               // ReadonlyArray<SfxClip>
engine.buffers.has(id);              // boolean (is this buffer loaded?)
```

---

## How the Timeline Works

`PlaylistManager.computeTimeline()` is the main part of the scheduling logic. It turns the ordered playlist + transitions into a flat array of `ScheduledEntry` objects with absolute start/end times.

```
Playlist: A (180s), B (200s), C (150s)
Transitions: A→B (5s crossfade), B→C (3s crossfade)

A: absoluteStart=0,   absoluteEnd=180,  fades=[fadeOut 175->180]
B: absoluteStart=175, absoluteEnd=375,  fades=[fadeIn 0->5, fadeOut 197->200]
C: absoluteStart=372, absoluteEnd=522,  fades=[fadeIn 0->3]
Total duration: 522s
```

A crossfade of N seconds means song B starts N seconds *before* song A ends. The cursor is pulled back by that overlap amount when computing where each song starts.

Each `ScheduledEntry` looks like:

```ts
{
  entryId: string;
  bufferId: string;
  title: string;
  absoluteStart: number; // seconds from start of set
  absoluteEnd: number;
  bufferOffset: number;  // where in the buffer to start from (usually 0)
  playDuration: number;  // how long to play from that offset
  fades: Fade[];         // fade curves, relative to clip local time
}
```

**Important:** Fade offsets in `Fade` are relative to the clip's local time (seconds from clip start), not the global timeline. So a fadeIn that lasts the first 5 seconds of a clip has `startOffset: 0, endOffset: 5`, regardless of where the clip sits on the timeline.

---

## How the Scheduler Works

The `Scheduler` uses a lookahead pattern I 'borrowed' from [Chris Wilson](https://www.html5rocks.com/en/tutorials/audio/scheduling/). A `setInterval` fires every 25ms and schedules any WebAudio nodes that fall within the next 200ms of playback.

This decouples the scheduling timer (which sucks bc it's JS) from the audio playback itself (which is hardware-precise).

Seeks during playback work by stopping all active nodes and restarting the scheduler from the new position. If the seek lands in the middle of a song, the scheduler computes the correct `bufferOffset` and starts the `AudioBufferSourceNode` at the right point in the buffer.

Live editing (adding/removing songs, changing transitions while playing) is handled by `AudioEngine.recomputeAndSync()`, which:
1. Recomputes the timeline
2. Cancels any nodes that haven't started yet (future nodes)
3. Updates gain automation on currently-audible nodes in-place
4. Emits `timelineChange` and `playlistChange` so React updates

---

## Events Reference

The engine emits these events. `useAudioEngine` subscribes to all of them for you, but if you need to listen directly for some reason:

```tsx
const unsub = engine.on('stateChange', ({ state }) => {
  console.log('transport is now:', state);
});

// cleanup
unsub();
```

| Event | Payload | When |
|---|---|---|
| `stateChange` | `{ state: TransportState }` | play/pause/stop |
| `playlistChange` | `{ entries: PlaylistEntry[] }` | any playlist mutation |
| `timelineChange` | `{ entries: ScheduledEntry[] }` | any playlist or transition mutation |
| `songChange` | `{ entryId: string, title: string }` | currently-playing song changes |
| `error` | `{ message: string, error?: unknown }` | something went wrong \:P |

---

## Stuff You'll Probably Use

### Load a file and add it to the playlist

```tsx
const addTrack = async (file: File) => {
  const bufferId = crypto.randomUUID();
  const arrayBuffer = await file.arrayBuffer();
  await engine.buffers.add(bufferId, arrayBuffer);
  engine.playlist.append(bufferId, file.name);
};
```

### Progress bar / scrubber

```tsx
useEffect(() => {
  if (transportState !== 'playing') return;
  let id: number;
  const tick = () => {
    const progress = engine.transport.getCurrentTime() / engine.getTotalDuration();
    progressBarRef.current!.style.width = `${progress * 100}%`;
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}, [transportState, engine]);

// clicking the scrubber, seek directly
const handleScrubClick = (e: React.MouseEvent) => {
  const pct = e.nativeEvent.offsetX / e.currentTarget.clientWidth;
  engine.transport.seek(pct * engine.getTotalDuration());
};
```

### Show the now-playing song

```tsx
// currentSongTitle updates w/useSyncExternalStore, so it's safe to put in JSX
const { currentSongTitle } = useAudioEngine();
return <div>{currentSongTitle || 'Nothing playing'}</div>;
```

### Render the timeline waveforms

```tsx
// this one is ai generated bc I'm a bum
const { engine, timeline } = useAudioEngine();

// timeline is ReadonlyArray<ScheduledEntry> sorted by absoluteStart
// totalDuration lets you compute pixel positions
const total = engine.getTotalDuration();

return timeline.map(entry => {
  const buffer = engine.buffers.get(entry.bufferId);
  const leftPct = (entry.absoluteStart / total) * 100;
  const widthPct = ((entry.absoluteEnd - entry.absoluteStart) / total) * 100;
  return (
    <WaveformClip
      key={entry.entryId}
      buffer={buffer}
      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
    />
  );
});
```

### Set a crossfade between two adjacent songs

```tsx
const { playlist } = useAudioEngine();

const setCrossfade = (fromIdx: number, durationSeconds: number) => {
  const from = playlist[fromIdx];
  const to = playlist[fromIdx + 1];
  if (!from || !to) return;
  engine.playlist.setTransition(from.id, to.id, durationSeconds);
};
```
