import { useState, useEffect } from 'react';
import './App.css';
import NavBar from './components/NavBar';
import MusicLibrary from './components/MusicLibrary';
import NowPlaying from './components/NowPlaying';
import SetList from './components/SetList';
import Timeline from './components/Timeline/Timeline';
import { useAudioEngine } from './audio/UseAudioEngine';
// import { extractMetadata } from './audio/extractMetadata';
import { extractMetadataWithShazam } from './audio/extractMetadata';
import type { SetListRecord } from '../types/SetListRecord';
import type { LibraryItem } from '../types/LibraryItem';

const DEFAULT_SET_LIST_ID = 'default-set-list';

const INITIAL_SET_LISTS: SetListRecord[] = [
  { id: DEFAULT_SET_LIST_ID, name: 'Set List 1', tracks: [] },
];

function App() {
  const { engine } = useAudioEngine();
  const [masterVolume, setMasterVolume] = useState(1);
  const [setLists, setSetLists] = useState<SetListRecord[]>(INITIAL_SET_LISTS);
  const [activeSetListId, setActiveSetListId] = useState<string>(DEFAULT_SET_LIST_ID);
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [sfxClips, setSfxClips] = useState(() => [...engine.sfx.getClips()]);

  // Called by Timeline after a drag-drop repositions an SFX clip, and by
  // handleAddSfxToTimeline after adding one from the library.
  const handleSfxChange = () => setSfxClips([...engine.sfx.getClips()]);

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if the user is typing in an input or textarea
      const isTyping =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isTyping) return;

      // Spacebar: Play/Pause
      if (e.code === 'Space') {
        e.preventDefault(); // Prevents the page from jumping down

        const state = engine.transport.getState();

        if (state === 'playing') {
          engine.transport.pause();
        } else {
          engine.transport.play().catch((err: unknown) => {
            console.error('Playback failed to start:', err);
          });
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [engine]);

  // --- Library handlers ---

  const handleLibraryUpload = async (files: File[], category: 'music' | 'sfx'): Promise<void> => {
    const duplicates: string[] = [];
    const failures: string[] = [];

    // Snapshot existing hashes once so we don't restart the scan as items stream in
    const existingHashes = new Set(
      libraryItems.filter((item) => item.category === category).map((item) => item.hash),
    );
    // Claimed within this batch, prevents two identical files from both being added
    const claimedHashes = new Set<string>();

    const processFile = async (file: File): Promise<void> => {
      try {
        // Read the raw bytes first - needed for both hashing and decoding.
        const arrayBuffer = await file.arrayBuffer();

        const [hashBuffer, { title, artist, coverUrl }] = await Promise.all([
          crypto.subtle.digest('SHA-256', arrayBuffer),
          extractMetadataWithShazam(file),
        ]);

        const hash = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        if (existingHashes.has(hash) || claimedHashes.has(hash)) {
          duplicates.push(file.name);
          return;
        }
        claimedHashes.add(hash);

        const bufferId = crypto.randomUUID();
        const audioBuffer = await engine.buffers.add(bufferId, arrayBuffer);

        const newItem: LibraryItem = {
          id: bufferId,
          title,
          filename: file.name,
          hash,
          artist,
          duration: Math.round(audioBuffer.duration),
          category,
          coverUrl,
        };

        // Stream results into the library as each file finishes rather than
        // waiting for the whole batch
        setLibraryItems((prev) => [...prev, newItem]);
      } catch {
        failures.push(file.name);
      }
    };

    await Promise.all(files.map(processFile));

    if (duplicates.length > 0) {
      window.alert(`Skipped duplicate(s): ${duplicates.join(', ')}`);
    }

    if (failures.length > 0) {
      window.alert(
        `Could not decode: ${failures.join(', ')}\nMake sure the files are valid audio.`,
      );
    }
  };

  const handleLibraryDelete = (id: string) => {
    const item = libraryItems.find((i) => i.id === id);
    if (!item) return;

    const activePlaylist = engine.playlist.getEntries();
    const inActivePlaylist = activePlaylist.some((entry) => entry.bufferId === id);
    const inSavedSetList = setLists.some(
      (sl) => sl.id !== activeSetListId && sl.tracks.some((t) => t.bufferId === id),
    );
    const inUse = inActivePlaylist || inSavedSetList;

    if (inUse) {
      const confirmed = window.confirm(
        `"${item.title}" is in use in a set list. Deleting it will remove it from all set lists. Continue?`,
      );
      if (!confirmed) return;

      const snapshot = [...activePlaylist];
      for (const entry of snapshot) {
        if (entry.bufferId === id) {
          engine.playlist.remove(entry.id);
        }
      }

      setSetLists((prev) =>
        prev.map((sl) => ({
          ...sl,
          tracks: sl.tracks.filter((t) => t.bufferId !== id),
        })),
      );
    } else {
      const confirmed = window.confirm(`Delete "${item.title}" from your library?`);
      if (!confirmed) return;
    }

    engine.buffers.remove(id);
    setLibraryItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAddToSetList = (id: string) => {
    const item = libraryItems.find((i) => i.id === id);
    if (!item) return;
    engine.playlist.append(id, item.title, item.artist);
  };

  const handleAddSfxToTimeline = (id: string) => {
    const item = libraryItems.find((i) => i.id === id);
    if (!item) return;
    engine.sfx.add({
      bufferId: id,
      absoluteStart: engine.transport.getCurrentTime(),
      duration: item.duration,
      bufferOffset: 0,
      gain: 1.0,
    });
    handleSfxChange();
  };

  const handleLibraryRename = (id: string, newTitle: string) => {
    setLibraryItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item)),
    );

    engine.playlist.updateTitleByBufferId(id, newTitle);
  };

  // --- Set list handlers ---

  const loadSetListIntoEngine = (setList: SetListRecord) => {
    const currentTracks = engine.playlist
      .getEntries()
      .map(({ bufferId, title, artist, duration }) => ({
        bufferId,
        title,
        artist,
        duration,
      }));

    setSetLists((prev) =>
      prev.map((sl) => (sl.id === activeSetListId ? { ...sl, tracks: currentTracks } : sl)),
    );

    engine.transport.stop();

    for (const entry of engine.playlist.getEntries()) {
      engine.playlist.remove(entry.id);
    }

    for (const track of setList.tracks) {
      if (engine.buffers.has(track.bufferId)) {
        engine.playlist.append(track.bufferId, track.title, track.artist);
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

  const handleMasterVolumeChange = (value: number) => {
    setMasterVolume(value);
    engine.volume.setMaster(value);
  };

  return (
    <div className="app-container">
      <NavBar masterVolume={masterVolume} onMasterVolumeChange={handleMasterVolumeChange} />
      <div className="middle-section">
        <MusicLibrary
          items={libraryItems}
          onUpload={handleLibraryUpload}
          onDelete={handleLibraryDelete}
          onAddToSetList={handleAddToSetList}
          onAddSfxToTimeline={handleAddSfxToTimeline}
          onRename={handleLibraryRename}
        />
        <NowPlaying libraryItems={libraryItems} />
        <SetList
          setLists={setLists}
          activeSetListId={activeSetListId}
          onCreateSetList={handleCreateSetList}
          onSwitchSetList={handleSwitchSetList}
          onRenameSetList={handleRenameSetList}
          onDeleteSetList={handleDeleteSetList}
        />
      </div>
      <div className="timeline-container">
        <Timeline sfxClips={sfxClips} libraryItems={libraryItems} onSfxChange={handleSfxChange} />
      </div>
    </div>
  );
}

export default App;
