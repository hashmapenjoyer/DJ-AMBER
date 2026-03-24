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
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const activeSetList = setLists.find((sl) => sl.id === activeSetListId);
  const totalDuration = engine.getTotalDuration();
  const trackCount = playlist.length;

  const handleRenameStart = () => {
    setRenameValue(activeSetList?.name ?? '');
    setIsRenaming(true);
    // Focus is handled by autoFocus on the input
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
    dragIndexRef.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (toIndex: number) => {
    const fromIndex = dragIndexRef.current;
    if (fromIndex !== null && fromIndex !== toIndex) {
      engine.reorderPlaylist(fromIndex, toIndex);
    }
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
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
            <span className="setlist-title-text">{activeSetList?.name ?? '—'}</span>
            <span className="setlist-edit-icon" aria-hidden="true">
              ✎
            </span>
          </button>
        )}

        {setLists.length > 1 && (
          <button
            className="setlist-delete-btn"
            onClick={handleDeleteClick}
            title="Delete this set list"
            aria-label="Delete set list"
          >
            ✕
          </button>
        )}
      </div>

      {/* Track List */}
      <div className="setlist-content">
        {trackCount === 0 ? (
          <div className="setlist-empty">
            <span className="setlist-empty-icon">♪</span>
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
                  dragIndexRef.current === index ? 'setlist-track-item--dragging' : '',
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
                  ⠿
                </span>
                <span className="setlist-track-number">{index + 1}</span>
                <span className="setlist-track-title" title={entry.title}>
                  {entry.title}
                </span>
                <span className="setlist-track-duration">{formatDuration(entry.duration)}</span>
                <button
                  className="setlist-track-remove"
                  onClick={() => engine.removeFromPlaylist(entry.id)}
                  title="Remove from set list"
                  aria-label={`Remove ${entry.title}`}
                >
                  🗑
                </button>
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
