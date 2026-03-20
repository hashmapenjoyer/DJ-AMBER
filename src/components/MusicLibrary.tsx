import { useState } from 'react';
import { mockLibrary } from '../data/mockLibrary';
import { formatDuration } from '../../types/FormatDuration';

type Tab = 'music' | 'sfx'

export default function MusicLibrary() {
  const [activeTab, setActiveTab] = useState<Tab>('music')

  const filteredItems = mockLibrary.filter((item) => item.category === activeTab);

  return (
    <div className="music-library">
      <div className="library-tabs">
        <button
          className={`library-tab ${activeTab === 'music' ? 'active' : ''}`}
          onClick={() => setActiveTab('music')}
        >
          Music
        </button>
        <button
          className={`library-tab ${activeTab === 'sfx' ? 'active' : ''}`}
          onClick={() => setActiveTab('sfx')}
        >
          SFX
        </button>
      </div>

      <div className="library-content">
        <ul className="library-list">
          {filteredItems.map((item) => (
            <li key={item.id} className="library-item">
              <span className="library-item-title">{item.title}</span>
              <span className="library-item-duration">{formatDuration(item.duration)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="library-upload">
        <button className="library-upload-btn">
          + Upload {activeTab === 'music' ? 'Music' : 'SFX'}
        </button>
      </div>
    </div>
  );
}
