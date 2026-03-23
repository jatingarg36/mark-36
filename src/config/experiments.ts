/**
 * Experiment / feature-flag configuration.
 *
 * Set a flag to `true` to enable the feature for all users, `false` to disable it.
 * Add a new entry here whenever you want to gate a new feature behind a flag.
 */

export const Experiments = {
  /** Export the active note as a Word (.docx) document. */
  EXPORT_DOCX: "export_docx",
} as const;

export type ExperimentName = (typeof Experiments)[keyof typeof Experiments];

const experimentConfig: Record<ExperimentName, boolean> = {
  [Experiments.EXPORT_DOCX]: false,
};

export function isEnabled(experiment: ExperimentName): boolean {
  return experimentConfig[experiment] ?? false;
}
