import { useEffect, useRef, useState } from 'react';
import { Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { useAudioEngine } from '../audio/UseAudioEngine';
import { formatDuration } from '../../types/FormatDuration';
import type { SetListRecord } from '../../types/SetListRecord';
import '../styles/setlist.css';

type RepeatMode = 'off' | 'one' | 'all';

interface SetListProps {
  setLists: SetListRecord[];
  activeSetListId: string;
  onCreateSetList: () => void;
  onSwitchSetList: (id: string) => void;
  onRenameSetList: (id: string, name: string) => void;
  onDeleteSetList: (id: string) => void;
}

export default function SetList({
  setLists,
  activeSetListId,
  onCreateSetList,
  onSwitchSetList,
  onRenameSetList,
  onDeleteSetList,
}: SetListProps) {
  const { playlist, engine } = useAudioEngine();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Shuffle state
  const [isShuffled, setIsShuffled] = useState(false);
  const preShuffleOrderRef = useRef<string[]>([]);

  // Repeat state
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const repeatModeRef = useRef<RepeatMode>('off');
  const currentEntryIdRef = useRef<string | null>(null);
  const wasPlayingRef = useRef(false);

  // Keep repeatModeRef in sync so event callbacks always read the latest mode.
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  // Subscribe to engine events to implement repeat logic.
  // Uses refs instead of state to avoid stale closures in callbacks.
  useEffect(() => {
    currentEntryIdRef.current = engine.getCurrentEntry()?.entryId ?? null;

    const unsubSong = engine.on('songChange', ({ entryId }) => {
      // Only handle real track changes. songChange also fires on seek within the same track,
      // so without this guard, Repeat One would override seeks by jumping back to absoluteStart.
      if (
        repeatModeRef.current === 'one' &&
        currentEntryIdRef.current !== null &&
        entryId !== currentEntryIdRef.current
      ) {
        // A genuine song transition occurred - seek back to the start of the previous song.
        const prev = engine.getTimeline().find((e) => e.entryId === currentEntryIdRef.current);
        if (prev) {
          engine.transport.seek(prev.absoluteStart);
          return; // Don't update currentEntryIdRef - stay on the same song.
        }
      }
      currentEntryIdRef.current = entryId;
    });

    const unsubState = engine.on('stateChange', ({ state }) => {
      if (state === 'playing') {
        wasPlayingRef.current = true;
      } else if (state === 'stopped') {
        if (repeatModeRef.current === 'all' && wasPlayingRef.current) {
          // Natural end of playlist - restart from the beginning.
          wasPlayingRef.current = false;
          engine.transport.seek(0);
          void engine.transport.play();
        } else {
          wasPlayingRef.current = false;
        }
      }
    });

    return () => {
      unsubSong();
      unsubState();
    };
    // engine is a stable singleton - this runs exactly once on mount.
  }, [engine]);

  const handleRepeatCycle = () => {
    setRepeatMode((prev) => {
      if (prev === 'off') return 'one';
      if (prev === 'one') return 'all';
      return 'off';
    });
  };

  const activeSetList = setLists.find((sl) => sl.id === activeSetListId);
  const totalDuration = engine.getTotalDuration();
  const trackCount = playlist.length;

  const handleRenameStart = () => {
    setRenameValue(activeSetList?.name ?? '');
    setIsRenaming(true);
  };

  const handleRenameCommit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== activeSetList?.name) {
      onRenameSetList(activeSetListId, trimmed);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleRenameCommit();
    if (e.key === 'Escape') setIsRenaming(false);
  };

  const handleDeleteClick = () => {
    if (!activeSetList) return;
    const confirmed = window.confirm(`Delete "${activeSetList.name}"? This cannot be undone.`);
    if (confirmed) onDeleteSetList(activeSetListId);
  };

  // Drag handlers
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (toIndex: number) => {
    if (dragIndex !== null && dragIndex !== toIndex) {
      engine.playlist.reorder(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // Applies a target ordering (by entry ID) to the engine via sequential reorderPlaylist calls.
  // Tracks a local copy of the current order so index calculations stay correct after each move.
  const applyOrder = (targetIds: string[]) => {
    const current = engine.playlist.getEntries().map((e) => e.id);
    for (let i = 0; i < targetIds.length; i++) {
      const currentIdx = current.indexOf(targetIds[i]);
      if (currentIdx !== i) {
        engine.playlist.reorder(currentIdx, i);
        const [moved] = current.splice(currentIdx, 1);
        current.splice(i, 0, moved);
      }
    }
  };

  const handleShuffleToggle = () => {
    // Warn the user if shuffling will discard existing transitions.
    if (engine.playlist.getTransitions().length > 0) {
      const confirmed = window.confirm(
        (!isShuffled ? 'Shuffling' : 'Restoring original order') +
          ' will discard all transitions between tracks. Continue?',
      );
      if (!confirmed) return;
    }

    // Capture current playback position before reordering changes the timeline.
    const currentEntry = engine.getCurrentEntry();
    const offsetWithinSong = currentEntry
      ? engine.transport.getCurrentTime() - currentEntry.absoluteStart
      : 0;

    if (isShuffled) {
      // Restore pre-shuffle order, filtering out any tracks removed since shuffle was activated.
      const currentIds = new Set(engine.playlist.getEntries().map((e) => e.id));
      const restored = preShuffleOrderRef.current.filter((id) => currentIds.has(id));
      applyOrder(restored);
      setIsShuffled(false);
    } else {
      // Save current order, then shuffle all tracks except the one currently playing.
      preShuffleOrderRef.current = engine.playlist.getEntries().map((e) => e.id);
      const currentEntryId = currentEntry?.entryId ?? null;
      const others = playlist.filter((e) => e.id !== currentEntryId).map((e) => e.id);

      // Fisher-Yates shuffle
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }

      // Rebuild full order: playing track stays in place, rest are shuffled around it
      const shuffled: string[] = [];
      let othersIdx = 0;
      for (const entry of playlist) {
        if (entry.id === currentEntryId) {
          shuffled.push(entry.id);
        } else {
          shuffled.push(others[othersIdx++]);
        }
      }

      applyOrder(shuffled);
      setIsShuffled(true);
    }

    // After reordering, seek to the same position within the current song.
    // The song's absoluteStart will have changed in the new timeline layout.
    if (currentEntry) {
      const newEntry = engine.getTimeline().find((e) => e.entryId === currentEntry.entryId);
      if (newEntry) {
        engine.transport.seek(newEntry.absoluteStart + offsetWithinSong);
      }
    }
  };

  return (
    <div className="set-list">
      {/* Set List Picker */}
      <div className="setlist-switcher">
        <select
          className="setlist-select"
          value={activeSetListId}
          onChange={(e) => onSwitchSetList(e.target.value)}
          aria-label="Switch set list"
        >
          {setLists.map((sl) => (
            <option key={sl.id} value={sl.id}>
              {sl.name}
            </option>
          ))}
        </select>

        <button
          className="setlist-new-btn"
          onClick={onCreateSetList}
          title="Create new set list"
          aria-label="Create new set list"
        >
          +
        </button>
      </div>

      {/* Title & Actions */}
      <div className="setlist-title-row">
        {isRenaming ? (
          <input
            ref={renameInputRef}
            autoFocus
            className="setlist-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameCommit}
            onKeyDown={handleRenameKeyDown}
            aria-label="Rename set list"
            maxLength={40}
          />
        ) : (
          <button className="setlist-title-btn" onClick={handleRenameStart} title="Click to rename">
            <span className="setlist-title-text">{activeSetList?.name ?? '\u2014'}</span>
            <span className="setlist-edit-icon" aria-hidden="true">
              {'\u270E'}
            </span>
          </button>
        )}

        <button
          className={`setlist-shuffle-btn ${isShuffled ? 'setlist-shuffle-btn--active' : ''}`}
          onClick={handleShuffleToggle}
          title={isShuffled ? 'Restore original order' : 'Shuffle tracks'}
          aria-label={isShuffled ? 'Restore original order' : 'Shuffle tracks'}
          aria-pressed={isShuffled}
        >
          <Shuffle size={14} />
        </button>

        <button
          className={`setlist-repeat-btn ${repeatMode !== 'off' ? 'setlist-repeat-btn--active' : ''}`}
          onClick={handleRepeatCycle}
          title={
            repeatMode === 'off'
              ? 'Repeat: Off'
              : repeatMode === 'one'
                ? 'Repeat: One'
                : 'Repeat: All'
          }
          aria-label={
            repeatMode === 'off'
              ? 'Enable repeat one'
              : repeatMode === 'one'
                ? 'Enable repeat all'
                : 'Disable repeat'
          }
        >
          {repeatMode === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
        </button>

        {setLists.length > 1 && (
          <button
            className="setlist-delete-btn"
            onClick={handleDeleteClick}
            title="Delete this set list"
            aria-label="Delete set list"
          >
            {'\u2715'}
          </button>
        )}
      </div>

      {/* Track List */}
      <div className="setlist-content">
        {trackCount === 0 ? (
          <div className="setlist-empty">
            <span className="setlist-empty-icon">{'\u266A'}</span>
            <p className="setlist-empty-text">No tracks yet</p>
            <p className="setlist-empty-hint">Add songs to curate your set list.</p>
          </div>
        ) : (
          <ul className="setlist-track-list">
            {playlist.map((entry, index) => (
              <li
                key={entry.id}
                className={[
                  'setlist-track-item',
                  dragIndex === index ? 'setlist-track-item--dragging' : '',
                  dragOverIndex === index ? 'setlist-track-item--drag-over' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
              >
                <span className="setlist-drag-handle" aria-hidden="true">
                  {'\u283F'}
                </span>
                <span className="setlist-track-number">{index + 1}</span>
                <span className="setlist-track-title" title={entry.title}>
                  {entry.title}
                </span>
                <button
                  className="setlist-track-remove"
                  onClick={() => engine.playlist.remove(entry.id)}
                  title="Remove from set list"
                  aria-label={`Remove ${entry.title}`}
                >
                  {'\u{1F5D1}'}
                </button>
                <span className="setlist-track-duration">{formatDuration(entry.duration)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      {trackCount > 0 && (
        <div className="setlist-footer">
          <span className="setlist-footer-count">
            {trackCount} {trackCount === 1 ? 'track' : 'tracks'}
          </span>
          <span className="setlist-footer-duration">{formatDuration(totalDuration)}</span>
        </div>
      )}
    </div>
  );
}
