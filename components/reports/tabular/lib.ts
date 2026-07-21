import type { ProjectGroup, TabularRow } from './types';

// Duplicated from ReportTabularPage.tsx for the same reason as types.ts —
// keep these tiny pure functions in sync if the server-side logic ever changes.
export function containsMalayalam(value: string) {
  return /[ഀ-ൿ]/.test(value);
}

export function verificationStatus(row: Pick<TabularRow, 'verified_date' | 'submitted_date'>) {
  if (row.verified_date) return 'Verified';
  if (row.submitted_date) return 'Pending Verification';
  return 'No Update';
}

export function indicatorStatus(row: Pick<TabularRow, 'is_stale' | 'has_no_progress'>) {
  return row.is_stale || row.has_no_progress ? 'Needs Attention' : 'On Track';
}

// Physical/financial % are always shown as whole numbers, matching the public site.
function roundPct(value: number) {
  return Math.round(value);
}

export function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

// Completion dates (completed_date / completion_date) are date-only fields with
// no meaningful time component — format without a time to avoid a misleading "12:00 am".
export function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(value);
}

// An indicator counts as completed only when both the physical progress has
// reached 100% AND that figure has actually been verified (verified_date set).
export function isIndicatorCompleted(row: Pick<TabularRow, 'physical_progress' | 'verified_date'>) {
  return row.physical_progress >= 100 && row.verified_date !== null;
}

// Physical: average of this set's own indicators' verified_percentage. Correct as
// "project physical %" when called with one project's indicators (spec: average of
// all indicator verified_percentage values). Do NOT call this with a multi-project
// flat list for department/report-level physical — use physicalRollup() instead,
// which averages per-project figures rather than per-indicator ones.
export function aggregate(rows: TabularRow[]) {
  const indicatorRows = rows.filter((row) => row.indicator_id !== null);
  const totalIndicators = indicatorRows.length;
  const completedIndicators = indicatorRows.filter((row) => isIndicatorCompleted(row)).length;
  const lagging = rows.filter((row) => row.is_stale || row.has_no_progress).length;
  const pending = rows.filter((row) => !row.verified_date && !!row.submitted_date).length;
  const images = rows.reduce((sum, row) => sum + row.image_count, 0);
  const videos = rows.reduce((sum, row) => sum + row.video_count, 0);
  const documents = rows.reduce((sum, row) => sum + row.document_count, 0);
  const physical = totalIndicators > 0
    ? roundPct(indicatorRows.reduce((sum, row) => sum + row.physical_progress, 0) / totalIndicators)
    : 0;

  return {
    totalIndicators,
    completedIndicators,
    lagging,
    pending,
    images,
    videos,
    documents,
    physical,
  };
}

// Financial %: sum of verified_financial_achievement across the given projects,
// divided by the sum of their project_cost — never an average of percentages.
// Projects with no recorded cost are excluded from both sides (their achievement
// can't be attributed a %); returns null ("N/A") when no project has a usable cost.
export function financialRollup(projects: Array<Pick<ProjectGroup, 'projectCost' | 'indicators'>>): number | null {
  const validProjects = projects.filter((project) => project.projectCost > 0);
  if (validProjects.length === 0) return null;

  const totalAchievement = validProjects.reduce(
    (sum, project) => sum + project.indicators.reduce((s, row) => s + row.financial_achievement, 0),
    0,
  );
  const totalCost = validProjects.reduce((sum, project) => sum + project.projectCost, 0);
  return totalCost > 0 ? roundPct((totalAchievement / totalCost) * 100) : null;
}

// Physical % at department/report level: average of each project's own physical %
// (every project weighted equally, regardless of indicator count). Uses each
// project's full-precision average rather than aggregate()'s rounded display
// value — rounding per project before averaging would drift the department
// figure away from a plain average of the raw underlying numbers.
export function physicalRollup(projects: Array<Pick<ProjectGroup, 'indicators'>>): number {
  if (projects.length === 0) return 0;
  const total = projects.reduce((sum, project) => {
    const indicatorRows = project.indicators.filter((row) => row.indicator_id !== null);
    if (indicatorRows.length === 0) return sum;
    return sum + indicatorRows.reduce((s, row) => s + row.physical_progress, 0) / indicatorRows.length;
  }, 0);
  return roundPct(total / projects.length);
}

export function countCompletedProjects(projects: ProjectGroup[]) {
  return projects.filter((project) => project.isCompleted).length;
}

// Rolled-up display values for department/project header rows: Verified only when
// every descendant is verified, Pending when some have been submitted, else No Update.
export function rollupVerification(rows: TabularRow[]) {
  const indicatorRows = rows.filter((row) => row.indicator_id !== null);
  if (indicatorRows.length === 0) return 'No Update';
  if (indicatorRows.every((row) => row.verified_date)) return 'Verified';
  if (indicatorRows.some((row) => row.submitted_date)) return 'Pending Verification';
  return 'No Update';
}

export function rollupStatus(rows: TabularRow[]) {
  return rows.some((row) => row.is_stale || row.has_no_progress) ? 'Needs Attention' : 'On Track';
}

export function rollupLastUpdate(rows: TabularRow[]): Date | null {
  const dates = rows
    .map((row) => row.last_progress_update)
    .filter((date): date is Date => date !== null);
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}
