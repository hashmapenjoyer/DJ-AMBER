import { useState, type CSSProperties } from 'react';
import { VolumeX, Volume2 } from 'lucide-react';
import HelpModal from './HelpModal';
import logo from '../assets/logo.png';
import '../styles/navbar.css';

interface NavBarProps {
  masterVolume: number;
  onMasterVolumeChange: (value: number) => void;
}

export default function NavBar({ masterVolume, onMasterVolumeChange }: NavBarProps) {
  const [showHelp, setShowHelp] = useState(false);
  const volumePercent = Math.round(masterVolume * 100);

  return (
    <>
      <nav className="navbar">
        {/* Left Section: Logo and App Name */}
        <div className="navbar-left">
          <div className="navbar-logo-container">
            <img src={logo} alt="DJ AMBER Logo" className="navbar-logo" />
          </div>
          <h1 className="navbar-title">DJ AMBER</h1>
        </div>

        {/* Right Section: Help Button */}
        <div className="navbar-right">
          <div className="navbar-volume">
            <button
              className={`navbar-volume-icon ${volumePercent === 0 ? 'lit' : 'dim'}`}
              onClick={() => onMasterVolumeChange(0)}
              aria-label="Mute"
              title="Mute"
            >
              <VolumeX size={18} />
            </button>
            <input
              id="master-volume"
              className="navbar-volume-slider"
              type="range"
              min={0}
              max={100}
              step={1}
              value={volumePercent}
              onChange={(event) => onMasterVolumeChange(Number(event.target.value) / 100)}
              aria-label="Master volume"
              style={{ '--volume-percent': `${volumePercent}%` } as CSSProperties}
            />
            <button
              className={`navbar-volume-icon ${volumePercent > 0 ? 'lit' : 'dim'}`}
              onClick={() => onMasterVolumeChange(1)}
              aria-label="Max volume"
              title="Max volume"
            >
              <Volume2 size={18} />
            </button>
          </div>
          <button
            className="navbar-help-btn"
            onClick={() => setShowHelp(true)}
            title="Help"
            aria-label="Open help modal"
          >
            FAQ
          </button>
        </div>
      </nav>

      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
}
