import { useEffect } from 'react';
import '../styles/help-modal.css';

interface HelpModalProps {
  onClose: () => void;
}

export default function HelpModal({ onClose }: HelpModalProps) {
  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="help-modal-backdrop" onClick={handleBackdropClick}>
      <div className="help-modal">
        {/* Header */}
        <div className="help-modal-header">
          <h2 className="help-modal-title">How to Use DJ AMBER</h2>
          <button
            className="help-modal-close"
            onClick={onClose}
            title="Close"
            aria-label="Close help modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="help-modal-content">
          <section className="help-section">
            <h3 className="help-section-title">Getting Started</h3>
            <p className="help-text">
              DJ AMBER is a powerful music mixing and sequencing tool. Use it to create, edit, and
              play custom music tracks with layered clips and effects.
            </p>
          </section>

          <section className="help-section">
            <h3 className="help-section-title">Music Library</h3>
            <p className="help-text">
              Browse and select audio clips from the Music Library panel on the left. Search for
              clips by name or category to quickly find what you need.
            </p>
          </section>

          <section className="help-section">
            <h3 className="help-section-title">Timeline</h3>
            <p className="help-text">
              Drag clips from the Music Library onto the Timeline to add them to your project. Use
              the Timeline to arrange clips, set timing, and create your composition.
            </p>
          </section>

          <section className="help-section">
            <h3 className="help-section-title">Now Playing</h3>
            <p className="help-text">
              The Now Playing panel displays the currently selected track with playback controls,
              progress bar, and real-time lyrics display. Use the play and pause buttons to control
              playback.
            </p>
          </section>

          <section className="help-section">
            <h3 className="help-section-title">Keyboard Shortcuts</h3>
            <ul className="help-shortcuts">
              <li>
                <kbd>Spacebar</kbd> - Play/Pause
              </li>
              <li>
                <kbd>Delete</kbd> - Remove selected clip
              </li>
              <li>
                <kbd>Esc</kbd> - Close this help modal
              </li>
            </ul>
          </section>

          <section className="help-section">
            <h3 className="help-section-title">Tips & Tricks</h3>
            <ul className="help-tips">
              <li>Layer multiple clips to create rich soundscapes</li>
              <li>Adjust timing and fades for smooth transitions</li>
              <li>Use the progress bar to navigate through your project</li>
              <li>Save your projects frequently to avoid losing work</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="help-modal-footer">
          <button className="help-modal-button" onClick={onClose}>
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
}
