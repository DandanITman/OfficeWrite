import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ColorPickerPopoverProps {
  anchor: HTMLElement | null;
  open: boolean;
  title: string;
  colors: readonly string[];
  value?: string | null;
  allowClear?: boolean;
  onSelect: (color: string | null) => void;
  onClose: () => void;
}

export function ColorPickerPopover({
  anchor,
  open,
  title,
  colors,
  value,
  allowClear = true,
  onSelect,
  onClose,
}: ColorPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [customColor, setCustomColor] = useState(value ?? '#000000');

  useEffect(() => {
    if (!open || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = 280;
    const maxLeft = Math.max(8, window.innerWidth - width - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);
    setPosition({ top: rect.bottom + 6, left });
    setCustomColor(value ?? '#000000');
  }, [anchor, open, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, onClose, open]);

  if (!open || !anchor) return null;

  return createPortal(
    <div
      ref={popoverRef}
      className="color-picker-popover"
      style={{ top: position.top, left: position.left }}
      role="dialog"
      aria-label={title}
      data-testid="color-picker-popover"
    >
      <div className="color-picker-title">{title}</div>
      <div className="color-picker-grid">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className={`color-swatch${value === color ? ' is-active' : ''}`}
            style={{ backgroundColor: color }}
            title={color}
            aria-label={color}
            data-testid={`color-swatch-${color}`}
            onClick={() => onSelect(color)}
          />
        ))}
      </div>
      <div className="color-picker-custom">
        <label className="color-picker-custom-label">
          Custom
          <input
            type="color"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            data-testid="color-picker-custom-input"
          />
        </label>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onSelect(customColor)}
          data-testid="color-picker-apply-custom"
        >
          Apply
        </button>
      </div>
      {allowClear && (
        <button
          type="button"
          className="color-picker-clear"
          onClick={() => onSelect(null)}
          data-testid="color-picker-clear"
        >
          No color
        </button>
      )}
    </div>,
    document.body,
  );
}
