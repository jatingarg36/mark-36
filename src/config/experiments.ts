/**
 * Experiment / feature-flag configuration.
 *
 * Set a flag to `true` to enable the feature for all users, `false` to disable it.
 * Add a new entry here whenever you want to gate a new feature behind a flag.
 *
 * SIDEBAR experiments can be enabled independently or combined freely.
 * SIDEBAR_FOLDERS_TAGS, SIDEBAR_PINNING, and SIDEBAR_DRAG_DROP layer on top
 * of each other — enable any subset you like.
 */

import { useFeatureGate, useStatsigClient } from "@statsig/react-bindings";
import { statsigClient } from "./statsig";

export const Experiments = {
  /** Export the active note as a Word (.docx) document. */
  EXPORT_DOCX: "export_docx",
  /** Upgrade editor to CodeMirror */
  EDITOR_UPGRADE: "editor_upgrade",
  /** Enable Zen Mode distraction-free writing */
  ZEN_MODE: "zen_mode",
  /** Enable Extended Markdown plugins (tasklists, math, mermaid) */
  EXTENDED_MARKDOWN: "extended_markdown",
  /** Enable exact active-line mapping for scroll sync */
  SCROLL_SYNC_POLISH: "scroll_sync_polish",
  /** Enable Quality of Life features (Word/Reading counter, Image drag & drop) */
  QOL_FEATURES: "qol_features",
  /** Enable smooth CSS transitions for UI state changes like sidebar collapse */
  SMOOTH_ANIMATIONS: "smooth_animations",
  /**
   * Enables Google OAuth sign-in. When false, no auth UI is rendered, no tokens
   * are read or written, and no requests are made to the auth backend.
   * Flip to true to activate the sign-in feature end-to-end.
   */
  ENABLE_AUTH: "enable_auth",
  /**
   * Sidebar organisation experiments — mutually exclusive.
   * Enable at most ONE of the three below at a time.
   */
  /** Organise notes into folders and filter by auto-extracted #tags */
  SIDEBAR_FOLDERS_TAGS: "sidebar_folders_tags",
  /** Pin important notes to the top of the sidebar */
  SIDEBAR_PINNING: "sidebar_pinning",
  /** Manually reorder notes in the sidebar via drag-and-drop */
  SIDEBAR_DRAG_DROP: "sidebar_drag_drop",
} as const;

export type ExperimentName = (typeof Experiments)[keyof typeof Experiments];

const experimentConfig: Record<ExperimentName, boolean> = {
  [Experiments.EXPORT_DOCX]: false,
  [Experiments.EDITOR_UPGRADE]: false,
  [Experiments.ZEN_MODE]: true,
  [Experiments.EXTENDED_MARKDOWN]: true,
  [Experiments.SCROLL_SYNC_POLISH]: false,
  [Experiments.QOL_FEATURES]: true,
  [Experiments.SMOOTH_ANIMATIONS]: true,
  [Experiments.ENABLE_AUTH]: false,
  [Experiments.SIDEBAR_FOLDERS_TAGS]: true,
  [Experiments.SIDEBAR_PINNING]: true,
  [Experiments.SIDEBAR_DRAG_DROP]: false,
};

/** React hook to get a feature flag value from Statsig with fallback to local config. */
export function useExperimentFlag(experiment: ExperimentName): boolean {
  const { isLoading } = useStatsigClient();
  const { value } = useFeatureGate(experiment);
  
  // If SDK is still loading, return the local fallback.
  if (isLoading) {
    return experimentConfig[experiment] ?? false;
  }

  return value;
}

/** Synchronous check for feature flags, useful in non-React code. */
export function isEnabled(experiment: ExperimentName): boolean {
  try {
    // Attempt to use Statsig client for synchronous check
    return statsigClient.checkGate(experiment) || experimentConfig[experiment] || false;
  } catch (error) {
    // Catch if statsigClient is not initialized yet or checkGate fails
    return experimentConfig[experiment] ?? false;
  }
}

/** Union of all sidebar-organisation experiment names. */
export type SidebarExperiment =
  | typeof Experiments.SIDEBAR_FOLDERS_TAGS
  | typeof Experiments.SIDEBAR_PINNING
  | typeof Experiments.SIDEBAR_DRAG_DROP;

/** Priority-ordered list — first enabled one wins. */
const SIDEBAR_EXPERIMENTS: readonly SidebarExperiment[] = [
  Experiments.SIDEBAR_FOLDERS_TAGS,
  Experiments.SIDEBAR_PINNING,
  Experiments.SIDEBAR_DRAG_DROP,
];

/**
 * Returns the active sidebar-organisation experiment, or `null` if none is
 * enabled. Because the three experiments are mutually exclusive, this always
 * returns at most one value regardless of how many flags are set to `true`.
 */
export function getActiveSidebarExperiment(): SidebarExperiment | null {
  return SIDEBAR_EXPERIMENTS.find(isEnabled) ?? null;
}
