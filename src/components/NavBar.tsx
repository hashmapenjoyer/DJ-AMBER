import { useState } from 'react';
import HelpModal from './HelpModal';
import logo from '../assets/logo.png';
import '../styles/navbar.css';

export default function NavBar() {
  const [showHelp, setShowHelp] = useState(false);

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
          <button
            className="navbar-help-btn"
            onClick={() => setShowHelp(true)}
            title="Help"
            aria-label="Open help modal"
          >
            ?
          </button>
        </div>
      </nav>

      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
}
