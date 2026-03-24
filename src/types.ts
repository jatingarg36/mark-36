export type ViewMode = "editor" | "split" | "preview";

export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  viewMode?: ViewMode;
  /** Experiment: SIDEBAR_PINNING — whether this note is pinned to the top */
  pinned?: boolean;
  /** Experiment: SIDEBAR_FOLDERS_TAGS — folder this note belongs to */
  folder?: string;
};

export type Theme = "light" | "dark" | "system";

export type WorkspaceState = {
  activeNoteId: string | null;
  viewMode: ViewMode;
  isSidebarCollapsed: boolean;
  syncScrollEnabled: boolean;
  splitRatio: number;
  searchTerm: string;
  fontSize: number;
};
