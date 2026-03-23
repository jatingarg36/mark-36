export type ViewMode = "editor" | "split" | "preview";

export type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  viewMode?: ViewMode;
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
