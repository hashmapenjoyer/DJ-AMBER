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
          {/* Getting Started */}
          <section className="help-section">
            <h3 className="help-section-title">Getting Started</h3>
            <p className="help-text">
              DJ AMBER is a music mixing and sequencing tool for creating layered audio tracks and
              smooth transitions.
            </p>
            <ul className="help-tips">
              <li>Upload or browse clips from the Music Library</li>
              <li>Drag clips onto the Timeline to begin building your track</li>
              <li>Arrange and adjust clips to shape your final mix</li>
            </ul>
          </section>

          {/* Controls */}
          <section className="help-section">
            <h3 className="help-section-title">Controls</h3>
            <p className="help-text">
              Use keyboard and navigation controls to work quickly and precisely.
            </p>

            <div className="help-subsection">
              <h4 className="help-subsection-title">Keyboard Shortcuts</h4>
              <ul className="help-tips">
                <li>
                  <kbd>Spacebar</kbd> - Play or pause playback
                </li>
                <li>
                  <kbd>Esc</kbd> - Close the help modal or deselect a clip
                </li>
                <li>
                  <kbd>Alt</kbd> + drag - Overlap clips freely without pushing others
                </li>
                <li>
                  <kbd>Delete</kbd> / <kbd>Backspace</kbd> - Remove selected clip
                </li>
              </ul>
            </div>

            <div className="help-subsection">
              <h4 className="help-subsection-title">Timeline Navigation</h4>
              <ul className="help-tips">
                <li>
                  <kbd>Scroll</kbd> - Zoom in and out of the timeline
                </li>
                <li>
                  <kbd>Shift</kbd> + <kbd>Scroll</kbd> - Pan earlier or later
                </li>
                <li>Use horizontal trackpad gestures to pan the timeline</li>
              </ul>
            </div>
          </section>

          {/* Music Library */}
          <section className="help-section">
            <h3 className="help-section-title">Music Library</h3>
            <p className="help-text">
              The Music Library lets you browse and add audio clips to your project.
            </p>
            <ul className="help-tips">
              <li>Search for clips by name or category</li>
              <li>
                Click the <strong>+</strong> button to add a clip to your project
              </li>
              <li>Drag clips directly onto the Timeline to place them</li>
            </ul>
          </section>

          {/* Timeline */}
          <section className="help-section">
            <h3 className="help-section-title">Timeline</h3>
            <p className="help-text">
              The Timeline is where you arrange and shape your composition.
            </p>
            <ul className="help-tips">
              <li>Position clips to control timing and sequence</li>
              <li>Adjust clip edges to refine transitions</li>
              <li>Layer clips to create more complex soundscapes</li>
            </ul>
          </section>

          {/* Set List */}
          <section className="help-section">
            <h3 className="help-section-title">Set List</h3>
            <p className="help-text">
              The Set List controls the order and playback behavior of tracks in your project.
            </p>
            <ul className="help-tips">
              <li>
                Create a new set list using the <strong>+</strong> button
              </li>
              <li>Drag and drop tracks to reorder them</li>
              <li>
                Use Shuffle to randomize playback order without interrupting the current track
              </li>
              <li>Use Repeat to cycle between repeating one track, all tracks, or none</li>
            </ul>
          </section>

          {/* Now Playing */}
          <section className="help-section">
            <h3 className="help-section-title">Now Playing</h3>
            <p className="help-text">
              The Now Playing panel shows the active track and playback controls.
            </p>
            <ul className="help-tips">
              <li>Use play and pause to control playback</li>
              <li>Track progress using the playback bar</li>
              <li>Navigate within a track using the progress bar</li>
            </ul>
          </section>

          {/* Tips & Tricks */}
          <section className="help-section">
            <h3 className="help-section-title">Tips & Tricks</h3>
            <p className="help-text">
              These tips can help you create smoother and more polished mixes.
            </p>
            <ul className="help-tips">
              <li>Layer clips to create richer sound combinations</li>
              <li>Fine-tune timing and fades for smoother transitions</li>
              <li>Use the progress bar to quickly navigate your project</li>
              <li>
                Dragging a clip edits the transition on its left side while preserving others. Hold{' '}
                <kbd>Alt</kbd> to override and overlap freely.
              </li>
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
