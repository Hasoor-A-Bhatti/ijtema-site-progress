export type ReportStatus =
  | "pending"
  | "overdue"
  | "completed"
  | "late";

export interface ReportDepartment {
  id: string;
  name: string;
  nazim_name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DepartmentReport {
  id: string;

  department_id: string;
  report_date: string;

  department_name_snapshot: string;
  nazim_name_snapshot: string;

  team_members_on_site: number | null;
  total_manhours: number | null;

  todays_activities: string | null;
  incidents_delays: string | null;
  work_proposed_tomorrow: string | null;
  additional_comments: string | null;

  deadline_at: string;
  submitted_at: string | null;

  template_version: number;

  created_at: string;
  updated_at: string;

  signature_name_aims_id: string | null;
}

export interface ReportWithDepartment
  extends DepartmentReport {
  department?: ReportDepartment;
}

export interface ReportFormValues {
  team_members_on_site: number | null;
  total_manhours: number | null;
  todays_activities: string;
  incidents_delays: string;
  work_proposed_tomorrow: string;
  additional_comments: string;
  signature_name_aims_id: string;
}

export interface DepartmentReportingState {
  department: ReportDepartment;
  report: DepartmentReport | null;
  status: ReportStatus;
  completedFields: number;
  totalFields: number;
}