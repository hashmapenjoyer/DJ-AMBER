import { useRef, useState } from 'react';
import type { LibraryItem } from '../../types/LibraryItem';
import { formatDuration } from '../../types/FormatDuration';

type Tab = 'music' | 'sfx';

interface MusicLibraryProps {
  items: LibraryItem[];
  onUpload: (files: File[], category: Tab) => Promise<void>;
  onDelete: (id: string) => void;
  onAddToSetList: (id: string) => void;
}

export default function MusicLibrary({
  items,
  onUpload,
  onDelete,
  onAddToSetList,
}: MusicLibraryProps) {
  const [activeTab, setActiveTab] = useState<Tab>('music');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredItems = items
    .filter((item) => item.category === activeTab)
    .filter((item) => item.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    e.target.value = '';
    void onUpload(fileArray, activeTab);
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
                <span className="library-item-title">{item.title}</span>
                <div className="library-item-actions">
                  <button
                    className="library-action-btn library-add-btn"
                    onClick={() => onAddToSetList(item.id)}
                    title="Add to set list"
                    aria-label={`Add ${item.title} to set list`}
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
