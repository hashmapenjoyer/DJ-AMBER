import { useRef, useState } from 'react';
import { useAudioEngine } from '../audio/UseAudioEngine';
import { formatDuration } from '../../types/FormatDuration';
import type { SetListRecord } from '../../types/SetListRecord';
import '../styles/setlist.css';

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
    if (isShuffled) {
      // Restore pre-shuffle order, filtering out any tracks removed since shuffle was activated.
      const currentIds = new Set(engine.playlist.getEntries().map((e) => e.id));
      const restored = preShuffleOrderRef.current.filter((id) => currentIds.has(id));
      applyOrder(restored);
      setIsShuffled(false);
    } else {
      // Save current order, then shuffle all tracks except the one currently playing.
      preShuffleOrderRef.current = engine.playlist.getEntries().map((e) => e.id);
      const currentEntryId = engine.getCurrentEntry()?.entryId ?? null;
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
              {/* pencil: \u270E */}
              {'\u270E'}
            </span>
          </button>
        )}

        {/* shuffle: \u{1F500} */}
        <button
          className={`setlist-shuffle-btn ${isShuffled ? 'setlist-shuffle-btn--active' : ''}`}
          onClick={handleShuffleToggle}
          title={isShuffled ? 'Restore original order' : 'Shuffle tracks'}
          aria-label={isShuffled ? 'Restore original order' : 'Shuffle tracks'}
          aria-pressed={isShuffled}
        >
          {'\u{1F500}'}
        </button>

        {setLists.length > 1 && (
          <button
            className="setlist-delete-btn"
            onClick={handleDeleteClick}
            title="Delete this set list"
            aria-label="Delete set list"
          >
            {/* multiplication x: \u2715 */}
            {'\u2715'}
          </button>
        )}
      </div>

      {/* Track List */}
      <div className="setlist-content">
        {trackCount === 0 ? (
          <div className="setlist-empty">
            {/* eighth note: \u266A */}
            <span className="setlist-empty-icon">{'\u266A'}</span>
            <p className="setlist-empty-text">No tracks yet</p>
            <p className="setlist-empty-hint">
              Upload songs and drag them onto the timeline to build your set.
            </p>
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
                  {/* braille dots (drag handle): \u283F */}
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
                  {/* wastebasket: \u{1F5D1} */}
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
