import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

/**
 * The shared controls every ribbon tab is built from.
 *
 * The ribbon is not a row of identical buttons: each group is a labelled box
 * whose contents mix one or two large buttons with rows of small ones,
 * split buttons that both act and open a menu, galleries, and a dialog launcher
 * in the corner. Building the tabs out of those pieces is what makes them read
 * as a word processor rather than as a generic toolbar.
 */

interface MenuContext {
  close: () => void;
}

const MenuCtx = createContext<MenuContext>({ close: () => undefined });

/** Close a ribbon menu from inside one of its items. */
export function useRibbonMenu(): MenuContext {
  return useContext(MenuCtx);
}

export function RibbonGroup({
  label,
  children,
  onLaunch,
  launchTitle,
  className,
  testId,
}: {
  label: string;
  children: ReactNode;
  /** Renders the dialog launcher in the group's bottom-right corner. */
  onLaunch?: () => void;
  launchTitle?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={`rb-group${className ? ` ${className}` : ''}`} data-testid={testId}>
      <div className="rb-group-body">{children}</div>
      <div className="rb-group-footer">
        <span className="rb-group-label">{label}</span>
        {onLaunch && (
          <button
            type="button"
            className="rb-launcher"
            title={launchTitle ?? `${label} options`}
            aria-label={launchTitle ?? `${label} options`}
            onClick={onLaunch}
          >
            {/* The launcher is a corner arrow, not a dropdown chevron -
                the distinct glyph is how users tell "opens the full dialog"
                apart from "opens a menu". */}
            <span aria-hidden>⌟</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** A vertical stack of small controls, as a word processor packs three rows into a group. */
export function RibbonStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`rb-stack${className ? ` ${className}` : ''}`}>{children}</div>;
}

/** A horizontal run of controls inside a stack row. */
export function RibbonLine({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`rb-line${className ? ` ${className}` : ''}`}>{children}</div>;
}

export function RibbonSeparator() {
  return <span className="rb-sep" aria-hidden />;
}

export type RibbonButtonSize = 'large' | 'small' | 'icon';

export interface RibbonButtonProps {
  icon?: ReactNode;
  label?: string;
  title: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  size?: RibbonButtonSize;
  testId?: string;
  className?: string;
  style?: CSSProperties;
}

export function RibbonButton({
  icon,
  label,
  title,
  onClick,
  active,
  disabled,
  size = 'small',
  testId,
  className,
  style,
}: RibbonButtonProps) {
  return (
    <button
      type="button"
      className={`rb-btn rb-btn--${size}${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      title={title}
      aria-label={label ? undefined : title}
      aria-pressed={active === undefined ? undefined : active}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      style={style}
    >
      {icon}
      {label && size !== 'icon' && <span className="rb-btn-label">{label}</span>}
    </button>
  );
}

function useAnchoredPosition(anchor: HTMLElement | null, open: boolean) {
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const left = Math.min(Math.max(6, rect.left), Math.max(6, window.innerWidth - 260));
      setPosition({ top: rect.bottom + 2, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchor, open]);

  return position;
}

/** An anchored popover: the surface every ribbon menu and gallery renders into. */
export function RibbonPopover({
  anchor,
  open,
  onClose,
  children,
  label,
  width,
  testId,
}: {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  width?: number;
  testId?: string;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const position = useAnchoredPosition(anchor, open);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (surfaceRef.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    };
    /**
     * Keyboard handling for the menu surface.
     *
     * The markup claimed `role="menu"` while implementing none of the contract:
     * nothing focused the menu when it opened, so a keyboard user could open
     * Paste or Styles and then Tab straight past the items into the next
     * ribbon control. That made the entire menu layer - bullets, numbering,
     * styles, margins, breaks, wrap text - mouse-only.
     */
    const items = () =>
      Array.from(
        surfaceRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([disabled]), button:not([disabled]), input, select',
        ) ?? [],
      );

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        anchor?.focus();
        return;
      }

      const focusable = items();
      if (!focusable.length) return;
      const index = focusable.indexOf(document.activeElement as HTMLElement);

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const next = (index + step + focusable.length) % focusable.length;
        focusable[index === -1 ? (step === 1 ? 0 : focusable.length - 1) : next]?.focus();
        return;
      }
      if (event.key === 'Home') {
        event.preventDefault();
        focusable[0]?.focus();
        return;
      }
      if (event.key === 'End') {
        event.preventDefault();
        focusable[focusable.length - 1]?.focus();
        return;
      }
      // Keep Tab inside the surface: leaving it while it is still open puts
      // focus somewhere the user cannot see.
      if (event.key === 'Tab') {
        event.preventDefault();
        const step = event.shiftKey ? -1 : 1;
        const next = (index + step + focusable.length) % focusable.length;
        focusable[index === -1 ? 0 : next]?.focus();
      }
    };

    // Focus the first item on open, after the portal has mounted.
    const raf = requestAnimationFrame(() => items()[0]?.focus());

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, onClose, open]);

  if (!open || !anchor) return null;

  return createPortal(
    <div
      ref={surfaceRef}
      className="rb-menu"
      role="menu"
      aria-label={label}
      data-testid={testId}
      style={{ top: position.top, left: position.left, width }}
    >
      <MenuCtx.Provider value={{ close: onClose }}>{children}</MenuCtx.Provider>
    </div>,
    document.body,
  );
}

/** A button that only opens a menu, drawn with the dropdown chevron. */
export function RibbonMenuButton({
  icon,
  label,
  title,
  size = 'small',
  active,
  disabled,
  testId,
  menuLabel,
  menuWidth,
  children,
}: {
  icon?: ReactNode;
  label?: string;
  title: string;
  size?: RibbonButtonSize;
  active?: boolean;
  disabled?: boolean;
  testId?: string;
  menuLabel?: string;
  menuWidth?: number;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`rb-btn rb-btn--${size} rb-btn--menu${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
        title={title}
        aria-label={label ? undefined : title}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        data-testid={testId}
        onClick={() => setOpen((value) => !value)}
      >
        {icon}
        {label && size !== 'icon' && <span className="rb-btn-label">{label}</span>}
        <ChevronDown size={size === 'large' ? 12 : 10} className="rb-chevron" aria-hidden />
      </button>
      <RibbonPopover
        anchor={buttonRef.current}
        open={open}
        onClose={close}
        label={menuLabel ?? title}
        width={menuWidth}
        testId={testId ? `${testId}-menu` : undefined}
      >
        {typeof children === 'function' ? children(close) : children}
      </RibbonPopover>
    </>
  );
}

/**
 * The split button: the face runs the default command, the chevron opens the
 * menu. Paste, Bullets and Numbering all behave this way.
 */
export function RibbonSplitButton({
  icon,
  label,
  title,
  onClick,
  size = 'large',
  active,
  disabled,
  testId,
  menuLabel,
  menuWidth,
  children,
}: {
  icon?: ReactNode;
  label: string;
  title: string;
  onClick: () => void;
  size?: 'large' | 'small';
  active?: boolean;
  disabled?: boolean;
  testId?: string;
  menuLabel?: string;
  menuWidth?: number;
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className={`rb-split rb-split--${size}${active ? ' is-active' : ''}`}>
      {/* The pressed state belongs on the button itself, not only on the
          wrapper: a screen reader reading the button cannot see a parent's
          class, and neither can anything else querying the control. */}
      <button
        type="button"
        className={`rb-split-main${active ? ' is-active' : ''}`}
        title={title}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        data-testid={testId}
      >
        {icon}
        <span className="rb-btn-label">{label}</span>
      </button>
      <button
        ref={toggleRef}
        type="button"
        className={`rb-split-toggle${open ? ' is-open' : ''}`}
        title={`${title} options`}
        aria-label={`${title} options`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        data-testid={testId ? `${testId}-more` : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown size={10} aria-hidden />
      </button>
      <RibbonPopover
        anchor={toggleRef.current}
        open={open}
        onClose={close}
        label={menuLabel ?? title}
        width={menuWidth}
        testId={testId ? `${testId}-menu` : undefined}
      >
        {typeof children === 'function' ? children(close) : children}
      </RibbonPopover>
    </div>
  );
}

export function RibbonMenuItem({
  label,
  hint,
  icon,
  checked,
  disabled,
  onClick,
  testId,
  keepOpen,
}: {
  label: string;
  hint?: string;
  icon?: ReactNode;
  checked?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  testId?: string;
  /** Leave the menu open, for the check-list menus like Show Markup. */
  keepOpen?: boolean;
}) {
  const { close } = useRibbonMenu();
  return (
    <button
      type="button"
      role="menuitem"
      className={`rb-menu-item${checked ? ' is-checked' : ''}`}
      disabled={disabled}
      data-testid={testId}
      onClick={() => {
        onClick?.();
        if (!keepOpen) close();
      }}
    >
      <span className="rb-menu-item-mark">{checked ? <Check size={13} /> : icon}</span>
      <span className="rb-menu-item-text">
        <span className="rb-menu-item-label">{label}</span>
        {hint && <span className="rb-menu-item-hint">{hint}</span>}
      </span>
    </button>
  );
}

export function RibbonMenuHeader({ label }: { label: string }) {
  return <div className="rb-menu-header">{label}</div>;
}

export function RibbonMenuSeparator() {
  return <div className="rb-menu-sep" role="separator" />;
}

/** A grid of visual choices, as the galleries present margins or styles. */
export function RibbonGallery({
  items,
  columns = 3,
  onPick,
  activeId,
}: {
  items: Array<{ id: string; label: string; hint?: string; preview?: ReactNode }>;
  columns?: number;
  onPick: (id: string) => void;
  activeId?: string;
}) {
  const { close } = useRibbonMenu();
  return (
    <div className="rb-gallery" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={`rb-gallery-item${activeId === item.id ? ' is-active' : ''}`}
          title={item.hint ? `${item.label}\n${item.hint}` : item.label}
          data-testid={`gallery-${item.id}`}
          onClick={() => {
            onPick(item.id);
            close();
          }}
        >
          {item.preview && <span className="rb-gallery-preview">{item.preview}</span>}
          <span className="rb-gallery-label">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/** A labelled numeric box, used by Layout's indent and spacing controls. */
export function RibbonSpin({
  label,
  value,
  step = 0.1,
  min = 0,
  max = 99,
  suffix,
  onChange,
  testId,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  onChange: (value: number) => void;
  testId?: string;
}) {
  return (
    <label className="rb-spin" title={label}>
      <span className="rb-spin-label">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        step={step}
        min={min}
        max={max}
        aria-label={label}
        data-testid={testId}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {suffix && <span className="rb-spin-suffix">{suffix}</span>}
    </label>
  );
}

/**
 * The font boxes: an editable field with a real dropdown beside it.
 *
 * Deliberately not an `<input list>` + `<datalist>`. A datalist filters its
 * options against whatever is already in the field, so a box that always holds
 * the current value could only ever offer that value back - the font list
 * showed "Calibri" and the size list showed "11". Worse, a datalist pick
 * arrives as an ordinary change event, so committing on change also fired on
 * any keystroke that happened to complete an option: that handed focus back to
 * the document mid-edit and let the next keypress overwrite the selection.
 *
 * So the list is owned here and is always complete, typing only narrows it, and
 * a value is committed on Enter, on blur, or on picking an option - never on a
 * keystroke.
 */
export function RibbonCombo({
  value,
  options,
  onCommit,
  title,
  width,
  testId,
  listId,
  previewFont,
}: {
  value: string;
  options: readonly string[];
  onCommit: (value: string) => void;
  title: string;
  width?: number;
  testId?: string;
  listId: string;
  /** Draw each option in the face it names, as the font gallery does. */
  previewFont?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => setDraft(value), [value]);

  // Only what the user has actually typed narrows the list. Opening it without
  // typing always shows every option, which is what makes the rest of the font
  // list reachable from a box that already reads "Calibri".
  const query = typed ? draft.trim().toLowerCase() : '';
  const visible = query ? options.filter((o) => o.toLowerCase().includes(query)) : options;

  const close = useCallback(() => {
    setOpen(false);
    setTyped(false);
    setHighlight(-1);
  }, []);

  const commit = useCallback(
    (next: string) => {
      close();
      const trimmed = next.trim();
      if (!trimmed) {
        setDraft(value);
        return;
      }
      setDraft(trimmed);
      onCommit(trimmed);
    },
    [close, onCommit, value],
  );

  return (
    <>
      <span className="rb-combo" ref={wrapRef} style={{ width }}>
        <input
          className="rb-combo-input"
          value={draft}
          title={title}
          aria-label={title}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          data-testid={testId}
          onChange={(event) => {
            // Never commit here. Typing only edits the draft and narrows the
            // list; the document is not touched until the user says so.
            setDraft(event.target.value);
            setTyped(true);
            setHighlight(-1);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (!open) {
                setTyped(false);
                setHighlight(-1);
                setOpen(true);
                return;
              }
              if (!visible.length) return;
              const step = event.key === 'ArrowDown' ? 1 : -1;
              setHighlight((current) => {
                const next = current + step;
                if (next < 0) return visible.length - 1;
                if (next >= visible.length) return 0;
                return next;
              });
              return;
            }
            if (event.key === 'Enter') {
              // Keep Enter out of the editor: it would split the paragraph, or
              // replace the very selection being formatted.
              event.preventDefault();
              event.stopPropagation();
              commit(open && highlight >= 0 ? visible[highlight] : draft);
              return;
            }
            if (event.key === 'Escape' && open) {
              event.preventDefault();
              event.stopPropagation();
              setDraft(value);
              close();
            }
          }}
          onBlur={() => {
            close();
            // Only when it actually changed: committing calls back into the
            // editor and takes focus, which must not happen for a passing blur.
            if (draft.trim() && draft !== value) commit(draft);
            else setDraft(value);
          }}
        />
        <button
          type="button"
          className="rb-combo-arrow"
          tabIndex={-1}
          aria-label={`${title} options`}
          data-testid={testId ? `${testId}-arrow` : undefined}
          // Keep focus in the field so opening the list does not fire a blur.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) close();
            else {
              setTyped(false);
              setHighlight(-1);
              setOpen(true);
            }
          }}
        >
          <ChevronDown size={11} aria-hidden />
        </button>
      </span>
      <RibbonPopover
        anchor={wrapRef.current}
        open={open}
        onClose={close}
        label={title}
        width={Math.max(width ?? 0, previewFont ? 210 : 88)}
        testId={testId ? `${testId}-list` : undefined}
      >
        <div className="rb-combo-list" id={`${listId}-list`} role="listbox" aria-label={title}>
          {visible.length ? (
            visible.map((option, index) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={option === value}
                className={`rb-menu-item${option === value ? ' is-checked' : ''}${
                  index === highlight ? ' is-highlighted' : ''
                }`}
                style={previewFont ? { fontFamily: `"${option}", sans-serif` } : undefined}
                // Commit on click, not on the blur that a click would cause.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commit(option)}
              >
                <span className="rb-menu-item-mark">
                  {option === value ? <Check size={13} /> : null}
                </span>
                <span className="rb-menu-item-text">
                  <span className="rb-menu-item-label">{option}</span>
                </span>
              </button>
            ))
          ) : (
            <div className="rb-combo-empty">No matches</div>
          )}
        </div>
      </RibbonPopover>
    </>
  );
}
