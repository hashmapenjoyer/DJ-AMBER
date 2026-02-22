import { useState } from 'react'

type Tab = 'music' | 'sfx'

export default function MusicLibrary() {
  const [activeTab, setActiveTab] = useState<Tab>('music')

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
        {activeTab === 'music' ? (
          <div className="library-panel">Music</div>
        ) : (
          <div className="library-panel">SFX</div>
        )}
      </div>
    </div>
  )
}