import { useEffect, useRef, useState } from 'react';
import type { LibraryItem } from '../../types/LibraryItem';
import { formatDuration } from '../../types/FormatDuration';

type Tab = 'music' | 'sfx';

interface MusicLibraryProps {
  items: LibraryItem[];
  onUpload: (files: File[], category: Tab) => Promise<void>;
  onDelete: (id: string) => void;
  onAddToSetList: (id: string) => void;
  onAddSfxToTimeline: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

export default function MusicLibrary({
  items,
  onUpload,
  onDelete,
  onAddToSetList,
  onAddSfxToTimeline,
  onRename,
}: MusicLibraryProps) {
  const [activeTab, setActiveTab] = useState<Tab>('music');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const handleAddItem = (id: string) => {
    if (activeTab === 'sfx') {
      onAddSfxToTimeline(id);
    } else {
      onAddToSetList(id);
    }
  };

  const filteredItems = items
    .filter((item) => item.category === activeTab)
    .filter((item) => item.title.toLowerCase().includes(searchQuery.toLowerCase()));

  // Auto-focus the rename input whenever rename mode activates
  useEffect(() => {
    if (renamingId !== null) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingId]);

  const startRenaming = (item: LibraryItem) => {
    setRenamingId(item.id);
    setRenameValue(item.title);
  };

  const commitRename = () => {
    if (renamingId === null) return;
    const trimmed = renameValue.trim();
    if (trimmed.length > 0) {
      onRename(renamingId, trimmed);
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const handleTitleDoubleClick = (e: React.MouseEvent, item: LibraryItem) => {
    // Prevent the <li>'s onDoubleClick (add to set list) from also firing
    e.stopPropagation();
    startRenaming(item);
  };

  const handleTitleContextMenu = (e: React.MouseEvent, item: LibraryItem) => {
    // Suppress the browser's native context menu and enter rename mode instead
    e.preventDefault();
    e.stopPropagation();
    startRenaming(item);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitRename();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    e.target.value = '';
    setIsLoading(true);
    void onUpload(fileArray, activeTab).finally(() => {
      setIsLoading(false);
    });
  };

  return (
    <div className="music-library">
      <div className="library-tabs">
        <button
          className={`library-tab ${activeTab === 'music' ? 'active' : ''}`}
          onClick={() => setActiveTab('music')}
        >
          {'\u266A '} Music
        </button>
        <button
          className={`library-tab ${activeTab === 'sfx' ? 'active' : ''}`}
          onClick={() => setActiveTab('sfx')}
        >
          {'\u26A1'} SFX
        </button>
      </div>

      <div className="library-search">
        <span className="library-search-icon">{'\u{1F50D}'}</span>
        <input
          type="text"
          className="library-search-input"
          placeholder={activeTab === 'music' ? 'Search music...' : 'Search SFX...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="library-content">
        {filteredItems.length === 0 ? (
          <div className="library-empty">
            <span className="library-empty-icon">
              {activeTab === 'music' ? '\u266A' : '\u26A1'}
            </span>
            <p className="library-empty-text">No {activeTab === 'music' ? 'music' : 'SFX'} yet</p>
            <p className="library-empty-hint">
              Upload {activeTab === 'music' ? 'songs' : 'sound effects'} to get started.
            </p>
          </div>
        ) : (
          <ul className="library-list">
            {filteredItems.map((item) => (
              <li
                key={item.id}
                className="library-item"
                onDoubleClick={() => onAddToSetList(item.id)}
              >
                <span className="library-item-icon">
                  {item.category === 'music' ? '\u266A' : '\u26A1'}
                </span>

                {renamingId === item.id ? (
                  <input
                    ref={renameInputRef}
                    className="library-item-rename-input"
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={handleRenameKeyDown}
                    onBlur={commitRename}
                    aria-label={`Rename ${item.title}`}
                  />
                ) : (
                  <span
                    className="library-item-title"
                    onDoubleClick={(e) => handleTitleDoubleClick(e, item)}
                    onContextMenu={(e) => handleTitleContextMenu(e, item)}
                    title="Double-click or right-click to rename"
                  >
                    {item.title}
                  </span>
                )}

                <div className="library-item-actions">
                  <button
                    className="library-action-btn library-add-btn"
                    onClick={() => handleAddItem(item.id)}
                    title={activeTab === 'sfx' ? 'Add to SFX timeline' : 'Add to set list'}
                    aria-label={`Add ${item.title} to ${activeTab === 'sfx' ? 'SFX timeline' : 'set list'}`}
                  >
                    +
                  </button>
                  <button
                    className="library-action-btn library-delete-btn"
                    onClick={() => onDelete(item.id)}
                    title="Remove from library"
                    aria-label={`Delete ${item.title}`}
                  >
                    {'\u{1F5D1}'}
                  </button>
                  <span className="library-item-duration">{formatDuration(item.duration)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isLoading && (
        <div className="library-loading">
          <div className="library-loading-spinner"></div>
          <p className="library-loading-text">Processing files...</p>
        </div>
      )}

      <div className="library-upload">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <button className="library-upload-btn" onClick={handleUploadClick}>
          + Upload {activeTab === 'music' ? 'Music' : 'SFX'}
        </button>
      </div>
    </div>
  );
}
