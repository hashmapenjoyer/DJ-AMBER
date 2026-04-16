import { useState } from 'react';
import './App.css';
import NavBar from './components/NavBar';
import MusicLibrary from './components/MusicLibrary';
import NowPlaying from './components/NowPlaying';
import SetList from './components/SetList';
import Timeline from './components/Timeline/Timeline';
import { useAudioEngine } from './audio/UseAudioEngine';
import { extractMetadata } from './audio/extractMetadata';
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

  // --- Library handlers ---

  const handleLibraryUpload = async (files: File[], category: 'music' | 'sfx'): Promise<void> => {
    const newItems: LibraryItem[] = [];
    const duplicates: string[] = [];
    const failures: string[] = [];

    for (const file of files) {
      const isDuplicate =
        libraryItems.some((item) => item.filename === file.name && item.category === category) ||
        newItems.some((item) => item.filename === file.name);

      if (isDuplicate) {
        duplicates.push(file.name);
        continue;
      }

      try {
        const bufferId = crypto.randomUUID();
        const [arrayBuffer, { title, artist, coverUrl }] = await Promise.all([
          file.arrayBuffer(),
          extractMetadata(file),
        ]);
        const audioBuffer = await engine.buffers.add(bufferId, arrayBuffer);

        newItems.push({
          id: bufferId,
          title,
          filename: file.name,
          artist,
          duration: Math.round(audioBuffer.duration),
          category,
          coverUrl,
        });
      } catch {
        failures.push(file.name);
      }
    }

    if (newItems.length > 0) {
      setLibraryItems((prev) => [...prev, ...newItems]);
    }

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

  const handleLibraryRename = (id: string, newTitle: string) => {
    setLibraryItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item)),
    );

    engine.updateEntryTitle(id, newTitle);
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
      <Timeline />
    </div>
  );
}

export default App;
