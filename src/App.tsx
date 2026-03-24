import { useState, useEffect, useRef } from 'react';
import './App.css';
import NavBar from './components/NavBar';
import MusicLibrary from './components/MusicLibrary';
import NowPlaying from './components/NowPlaying';
import SetList from './components/SetList';
import Timeline from './components/Timeline';
import { useAudioEngine } from './audio/UseAudioEngine';
import type { SetListRecord } from '../types/SetListRecord';

const DEFAULT_SET_LIST_ID = 'default-set-list';

const INITIAL_SET_LISTS: SetListRecord[] = [
  { id: DEFAULT_SET_LIST_ID, name: 'Set List 1', tracks: [] },
];

// Dev-only mock data - remove once real audio upload is wired
const DEV_MOCK_CLIPS = [
  { bufferId: 'mock-1', title: 'Never Gonna Give You Up', duration: 100 },
  { bufferId: 'mock-2', title: 'All I Want for Christmas Is You', duration: 150 },
  { bufferId: 'mock-3', title: 'Revenge', duration: 100 },
  {
    bufferId: 'mock-4',
    title: 'Like a Prayer - Battle Royale Mix from "Deadpool and Wolverine"',
    duration: 164,
  },
] as const;

/** Returns a silent WAV ArrayBuffer for the given duration. */
function createSilentWav(durationSeconds: number, sampleRate = 44100): ArrayBuffer {
  const numSamples = Math.ceil(sampleRate * durationSeconds);
  const dataLength = numSamples * 2; // 16-bit mono
  const buf = new ArrayBuffer(44 + dataLength);
  const v = new DataView(buf);
  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataLength, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, dataLength, true);
  return buf; // zeroed by default (silence)
}

function App() {
  const { engine } = useAudioEngine();
  const [setLists, setSetLists] = useState<SetListRecord[]>(INITIAL_SET_LISTS);
  const [activeSetListId, setActiveSetListId] = useState<string>(DEFAULT_SET_LIST_ID);

  // Ref guard prevents double-seeding in StrictMode
  // Remove with DEV_MOCK_CLIPS once upload is real
  const mockSeededRef = useRef(false);
  useEffect(() => {
    if (mockSeededRef.current) return;
    mockSeededRef.current = true;
    void (async () => {
      for (const clip of DEV_MOCK_CLIPS) {
        const wav = createSilentWav(clip.duration);
        await engine.buffers.add(clip.bufferId, wav);
        engine.playlist.append(clip.bufferId, clip.title);
      }
    })();
    // engine is a stable singleton — this runs exactly once on mount
  }, [engine]);

  const loadSetListIntoEngine = (setList: SetListRecord) => {
    // Save the current playlist into the outgoing set list before clearing the engine
    setSetLists((prev) =>
      prev.map((sl) =>
        sl.id === activeSetListId
          ? {
              ...sl,
              tracks: engine.playlist.getEntries().map(({ bufferId, title, duration }) => ({
                bufferId,
                title,
                duration,
              })),
            }
          : sl,
      ),
    );

    engine.transport.stop();

    for (const entry of engine.playlist.getEntries()) {
      engine.playlist.remove(entry.id);
    }

    for (const track of setList.tracks) {
      if (engine.buffers.has(track.bufferId)) {
        engine.playlist.append(track.bufferId, track.title);
      }
    }
  };

  const handleCreateSetList = () => {
    const newId = crypto.randomUUID();
    const newSetList: SetListRecord = {
      id: newId,
      name: `Set List ${setLists.length + 1}`,
      tracks: [],
    };

    loadSetListIntoEngine(newSetList);
    setSetLists((prev) => [...prev, newSetList]);
    setActiveSetListId(newId);
  };

  const handleSwitchSetList = (id: string) => {
    if (id === activeSetListId) return;
    const target = setLists.find((sl) => sl.id === id);
    if (!target) return;

    loadSetListIntoEngine(target);
    setActiveSetListId(id);
  };

  const handleRenameSetList = (id: string, name: string) => {
    setSetLists((prev) => prev.map((sl) => (sl.id === id ? { ...sl, name } : sl)));
  };

  const handleDeleteSetList = (id: string) => {
    if (setLists.length <= 1) return;

    const remaining = setLists.filter((sl) => sl.id !== id);
    setSetLists(remaining);

    if (id === activeSetListId) {
      const next = remaining[0];
      loadSetListIntoEngine(next);
      setActiveSetListId(next.id);
    }
  };

  return (
    <div className="app-container">
      <NavBar />
      <div className="middle-section">
        <MusicLibrary />
        <NowPlaying />
        <SetList
          setLists={setLists}
          activeSetListId={activeSetListId}
          onCreateSetList={handleCreateSetList}
          onSwitchSetList={handleSwitchSetList}
          onRenameSetList={handleRenameSetList}
          onDeleteSetList={handleDeleteSetList}
        />
      </div>
      <Timeline />
    </div>
  );
}

export default App;
