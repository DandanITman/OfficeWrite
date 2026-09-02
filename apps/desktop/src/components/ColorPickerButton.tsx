import { useRef, useState, type ReactNode } from 'react';
import { ColorPickerPopover } from './ColorPickerPopover';

interface ColorPickerButtonProps {
  title: string;
  colors: readonly string[];
  value?: string | null;
  allowClear?: boolean;
  className?: string;
  active?: boolean;
  onSelect: (color: string | null) => void;
  children: ReactNode;
}

export function ColorPickerButton({
  title,
  colors,
  value,
  allowClear = true,
  className,
  active,
  onSelect,
  children,
}: ColorPickerButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        title={title}
        aria-expanded={open}
        data-active={active ? 'true' : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        {children}
        {value && (
          <span
            className="color-picker-indicator"
            style={{ backgroundColor: value }}
            aria-hidden
          />
        )}
      </button>
      <ColorPickerPopover
        anchor={buttonRef.current}
        open={open}
        title={title}
        colors={colors}
        value={value}
        allowClear={allowClear}
        onSelect={(color) => {
          onSelect(color);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
