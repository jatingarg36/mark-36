import type { Theme } from "../types";
import { Keyboard } from "lucide-react";

type ViewMode = "editor" | "split" | "preview";

type TopBarProps = {
  theme: Theme;
  onThemeToggle: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  hasActiveNote: boolean;
  isSidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  syncScrollEnabled: boolean;
  onSyncScrollToggle: () => void;
  onShowShortcuts: () => void;
  onBackupNow: () => void;
};

export function TopBar({
  theme,
  onThemeToggle,
  onExport,
  onImport,
  hasActiveNote,
  isSidebarCollapsed,
  onSidebarToggle,
  viewMode,
  onViewModeChange,
  syncScrollEnabled,
  onSyncScrollToggle,
  onShowShortcuts,
  onBackupNow
}: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-actions">
        <button className="button" onClick={onSidebarToggle}>
          {isSidebarCollapsed ? "Show Notes" : "Hide Notes"}
        </button>
        <div className="view-mode-tabs" role="tablist" aria-label="Editor view mode">
          <button
            className={`button ${viewMode === "editor" ? "button-primary" : ""}`}
            role="tab"
            aria-selected={viewMode === "editor"}
            onClick={() => onViewModeChange("editor")}
          >
            Editor
          </button>
          <button
            className={`button ${viewMode === "split" ? "button-primary" : ""}`}
            role="tab"
            aria-selected={viewMode === "split"}
            onClick={() => onViewModeChange("split")}
          >
            Split
          </button>
          <button
            className={`button ${viewMode === "preview" ? "button-primary" : ""}`}
            role="tab"
            aria-selected={viewMode === "preview"}
            onClick={() => onViewModeChange("preview")}
          >
            Preview
          </button>
        </div>
        <button className="button" onClick={onThemeToggle}>
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <button className="button" onClick={onSyncScrollToggle} disabled={viewMode !== "split"}>
          {syncScrollEnabled ? "Sync Scroll: On" : "Sync Scroll: Off"}
        </button>
        <label className="button">
          Import .md
          <input
            type="file"
            accept=".md,text/markdown,text/plain"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onImport(file);
              }
              event.currentTarget.value = "";
            }}
          />
        </label>
        <button className="button" onClick={onBackupNow}>
          Backup Now
        </button>
        <button className="button" onClick={onExport} disabled={!hasActiveNote}>
          Export .md
        </button>
        <button
          className="button shortcuts-button"
          onClick={onShowShortcuts}
          aria-label="Show keyboard shortcuts"
          title="Keyboard Shortcuts"
        >
          <Keyboard aria-hidden="true" size={18} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
