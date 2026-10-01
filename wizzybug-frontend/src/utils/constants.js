export const STATUS_LABELS = {
  reopened: "Reopened",
  open: "Open / New",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
  rejected: "Rejected",
  deferred: "Deferred",
  not_reproducible: "Not Reproducible",
};

export const STATUS_VALUES = Object.keys(STATUS_LABELS);

export const PRIORITY_LABELS = {
  critical: "P1-Immediate Fix",
  high: "P2-High",
  medium: "P3-Medium",
  low: "P4-Low",
};

export const SEVERITY_TO_PRIORITY = {
  "Blocker(System Crash/Data Loss)": "critical",
  Critical: "critical",
  Major: "high",
  Minor: "medium",
  Cosmetic: "low",
};

export const SEVERITY_LABELS = [
  "Blocker(System Crash/Data Loss)",
  "Critical",
  "Major",
  "Minor",
  "Cosmetic",
];
