import { useEffect, useRef } from 'react';
import '../../styles/timeline.css';

export interface TimelineContextMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface TimelineContextMenuProps {
  x: number;
  y: number;
  items: TimelineContextMenuItem[];
  onClose: () => void;
}

export default function TimelineContextMenu({ x, y, items, onClose }: TimelineContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', onDocMouseDown);
    return () => window.removeEventListener('mousedown', onDocMouseDown);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="timeline_context_menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          className="timeline_context_menu_item"
          disabled={item.disabled}
          onClick={() => {
            if (item.disabled) return;
            item.onClick();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
