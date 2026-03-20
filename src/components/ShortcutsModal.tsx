type ShortcutItem = {
  combo: string;
  description: string;
};

type ShortcutsModalProps = {
  shortcuts: ShortcutItem[];
  onClose: () => void;
};

export function ShortcutsModal({ shortcuts, onClose }: ShortcutsModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="button" onClick={onClose} aria-label="Close shortcuts">
            Close
          </button>
        </div>
        <div className="shortcuts-list">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.combo} className="shortcut-row">
              <kbd>{shortcut.combo}</kbd>
              <span>{shortcut.description}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
