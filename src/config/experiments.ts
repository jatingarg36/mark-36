/**
 * Experiment / feature-flag configuration.
 *
 * Set a flag to `true` to enable the feature for all users, `false` to disable it.
 * Add a new entry here whenever you want to gate a new feature behind a flag.
 */

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
} as const;

export type ExperimentName = (typeof Experiments)[keyof typeof Experiments];

const experimentConfig: Record<ExperimentName, boolean> = {
  [Experiments.EXPORT_DOCX]: false,
  [Experiments.EDITOR_UPGRADE]: false,
  [Experiments.ZEN_MODE]: true,
  [Experiments.EXTENDED_MARKDOWN]: true,
  [Experiments.SCROLL_SYNC_POLISH]: false,
  [Experiments.QOL_FEATURES]: true,
};

export function isEnabled(experiment: ExperimentName): boolean {
  return experimentConfig[experiment] ?? false;
}
