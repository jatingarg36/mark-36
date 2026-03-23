import type { Theme } from "../types";
import { Archive, ArrowRightFromLine, Download, Keyboard, Link2, Monitor, Moon, Sun, Upload } from "lucide-react";

type ViewMode = "editor" | "split" | "preview";

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 20;

type TopBarProps = {
  theme: Theme;
  onThemeToggle: () => void;
  onExport: () => void;
  onExportDocx?: () => void;
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
  fontSize: number;
  onFontSizeChange: (size: number) => void;
};

export function TopBar({
  theme,
  onThemeToggle,
  onExport,
  onExportDocx,
  onImport,
  hasActiveNote,
  isSidebarCollapsed,
  onSidebarToggle,
  viewMode,
  onViewModeChange,
  syncScrollEnabled,
  onSyncScrollToggle,
  onShowShortcuts,
  onBackupNow,
  fontSize,
  onFontSizeChange
}: TopBarProps) {
  return (
    <header className="topbar">
      {/* Left group: sidebar + view mode + sync scroll */}
      <div className="topbar-group">
        {isSidebarCollapsed && (
          <>
            <button
              className="button topbar-icon-btn"
              onClick={onSidebarToggle}
              title="Show notes panel"
              aria-label="Show notes panel"
            >
              <ArrowRightFromLine aria-hidden="true" size={26} strokeWidth={2} />
            </button>
            <div className="topbar-divider" />
          </>
        )}

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

        <div className="topbar-divider" />

        <button
          className={`button topbar-sync-btn ${syncScrollEnabled && viewMode === "split" ? "topbar-sync-btn--active" : ""}`}
          onClick={onSyncScrollToggle}
          disabled={viewMode !== "split"}
          title={syncScrollEnabled ? "Sync scroll: on" : "Sync scroll: off"}
          aria-label={syncScrollEnabled ? "Disable sync scroll" : "Enable sync scroll"}
          aria-pressed={syncScrollEnabled}
        >
          <Link2 aria-hidden="true" size={16} strokeWidth={2} />
          Sync
        </button>
      </div>

      {/* Right group: theme + file actions + shortcuts */}
      <div className="topbar-group">
        <button
          className="button topbar-icon-btn"
          onClick={onThemeToggle}
          title={
            theme === "light" ? "Switch to dark mode" :
            theme === "dark"  ? "Follow system theme" :
                                "Switch to light mode"
          }
          aria-label={
            theme === "light" ? "Switch to dark mode" :
            theme === "dark"  ? "Follow system theme" :
                                "Switch to light mode"
          }
        >
          {theme === "light"
            ? <Sun     aria-hidden="true" size={26} strokeWidth={2} />
            : theme === "dark"
            ? <Moon    aria-hidden="true" size={26} strokeWidth={2} />
            : <Monitor aria-hidden="true" size={26} strokeWidth={2} />}
        </button>

        <div className="topbar-divider" />

        <label
          className="button topbar-file-btn"
          title="Import markdown file"
          aria-label="Import markdown file"
        >
          <Upload aria-hidden="true" size={16} strokeWidth={2} />
          Import
          <input
            type="file"
            accept=".md,.json,text/markdown,text/plain,application/json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.currentTarget.value = "";
            }}
          />
        </label>

        <button
          className="button topbar-file-btn"
          onClick={onBackupNow}
          title="Backup notes to disk"
          aria-label="Backup notes to disk"
        >
          <Archive aria-hidden="true" size={16} strokeWidth={2} />
          Backup
        </button>

        <button
          className="button topbar-file-btn"
          onClick={onExport}
          disabled={!hasActiveNote}
          title="Export current note as .md"
          aria-label="Export current note as markdown"
        >
          <Download aria-hidden="true" size={16} strokeWidth={2} />
          Export .md
        </button>

        {onExportDocx && (
          <button
            className="button topbar-file-btn"
            onClick={onExportDocx}
            disabled={!hasActiveNote}
            title="Export current note as .docx"
            aria-label="Export current note as Word document"
          >
            <Download aria-hidden="true" size={16} strokeWidth={2} />
            Export .docx
          </button>
        )}

        <div className="topbar-divider" />

        <div className="topbar-font-size-control">
          <button
            className="topbar-font-size-btn"
            onClick={() => onFontSizeChange(Math.max(FONT_SIZE_MIN, fontSize - 1))}
            disabled={fontSize <= FONT_SIZE_MIN}
            title={`Decrease font size (${fontSize}px)`}
            aria-label="Decrease font size"
          >
            A−
          </button>
          <span className="topbar-font-size-value">{fontSize}</span>
          <button
            className="topbar-font-size-btn"
            onClick={() => onFontSizeChange(Math.min(FONT_SIZE_MAX, fontSize + 1))}
            disabled={fontSize >= FONT_SIZE_MAX}
            title={`Increase font size (${fontSize}px)`}
            aria-label="Increase font size"
          >
            A+
          </button>
        </div>

        <div className="topbar-divider" />

        <button
          className="button topbar-icon-btn"
          onClick={onShowShortcuts}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts"
        >
          <Keyboard aria-hidden="true" size={26} strokeWidth={2} />
        </button>
      </div>
    </header>
  );
}
