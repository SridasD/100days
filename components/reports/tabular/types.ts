// Mirrors the shapes in ReportTabularPage.tsx. Duplicated (not imported) so this
// client-side tree never pulls that file's `db` import into the browser bundle.
export type TabularRow = {
  indicator_id: number | null;
  administrative_department: string;
  department_name: string;
  hod_names: string;
  project_code: string;
  project_name: string;
  indicator_name: string;
  physical_progress: number;
  financial_progress: number | null;
  financial_achievement: number;
  submitted_date: Date | null;
  verified_date: Date | null;
  completed_date: Date | null;
  last_progress_update: Date | null;
  is_stale: boolean;
  has_no_progress: boolean;
  image_count: number;
  video_count: number;
  document_count: number;
  project_is_completed: boolean;
};

export type ProjectGroup = {
  key: string;
  agencyName: string;
  hodNames: string;
  projectCode: string;
  projectName: string;
  isCompleted: boolean;
  completedDate: Date | null;
  projectCost: number;
  indicators: TabularRow[];
};

export type DepartmentGroup = {
  name: string;
  projects: ProjectGroup[];
};

export type Summary = {
  totalIndicators: number;
  completedIndicators: number;
  lagging: number;
  pending: number;
  images: number;
  videos: number;
  documents: number;
  physical: number;
  financial: number | null;
};

export type ReportFilters = {
  search: string;
  department: string;
  agency: string;
  verification: string;
  status: string;
};
