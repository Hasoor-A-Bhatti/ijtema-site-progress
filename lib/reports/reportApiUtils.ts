import {
  SITE_ACCOUNTS_DEPARTMENT_ID,
  SITE_ACCOUNTS_FIELD_COUNT,
  isSiteAccountsTrackerValues,
  normaliseSiteAccountsForm,
  validateSiteAccountsForSubmission,
  type SiteAccountsStoredValues,
  type SiteAccountsTrackerValues,
} from "@/lib/reports/siteAccTracker";

export const REPORT_TIME_ZONE = "Europe/London";
export const REPORT_FIELD_COUNT = 7;

export type ReportStatus =
  | "pending"
  | "overdue"
  | "completed"
  | "late";

export interface ReportFormValues {
  team_members_on_site: number | null;
  total_manhours: number | null;
  todays_activities: string;
  incidents_delays: string;
  work_proposed_tomorrow: string;
  additional_comments: string;
  signature_name_aims_id: string;
}

export interface DepartmentReportRow extends ReportFormValues {
  id: string;
  department_id: string;
  department_name_snapshot: string;
  nazim_name_snapshot: string;
  report_date: string;
  deadline_at: string;
  submitted_at: string | null;
  custom_answers?: SiteAccountsTrackerValues | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReportDepartmentRow {
  id: string;
  name: string;
  nazim_name: string;
  sort_order?: number;
  active: boolean;
}

export function isValidReportDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function getLondonDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function timezoneOffset(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  const representedAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second
  );

  return representedAsUtc - date.getTime();
}

export function getReportDeadline(reportDate: string) {
  const [year, month, day] = reportDate.split("-").map(Number);

  const wallTime = new Date(
    Date.UTC(year, month - 1, day, 20, 0, 0)
  );

  let offset = timezoneOffset(wallTime);
  let result = new Date(wallTime.getTime() - offset);

  const correctedOffset = timezoneOffset(result);

  if (correctedOffset !== offset) {
    offset = correctedOffset;
    result = new Date(wallTime.getTime() - offset);
  }

  return result;
}

export function deriveReportStatus(
  report: DepartmentReportRow | null,
  deadline: Date,
  now = new Date()
): ReportStatus {
  if (report?.submitted_at) {
    const effectiveDeadline = report.deadline_at
      ? new Date(report.deadline_at)
      : deadline;

    return new Date(report.submitted_at).getTime() <=
      effectiveDeadline.getTime()
      ? "completed"
      : "late";
  }

  return now.getTime() > deadline.getTime()
    ? "overdue"
    : "pending";
}

export function getReportFieldCount(departmentId: string) {
  return departmentId === SITE_ACCOUNTS_DEPARTMENT_ID
    ? SITE_ACCOUNTS_FIELD_COUNT
    : REPORT_FIELD_COUNT;
}

export function countCompletedReportFields(
  report: DepartmentReportRow | null
) {
  if (!report) return 0;

  if (report.department_id === SITE_ACCOUNTS_DEPARTMENT_ID) {
    let count = 0;

    if (
      isSiteAccountsTrackerValues(report.custom_answers) &&
      report.custom_answers.total_budget !== null
    ) {
      count += 1;
    }

    // Questions 2-5 are the departmental matrix plus the three totals
    // automatically derived from that matrix.
    if (isSiteAccountsTrackerValues(report.custom_answers)) {
      count += 4;
    }

    if (report.signature_name_aims_id?.trim()) {
      count += 1;
    }

    return count;
  }

  let count = 0;

  if (report.team_members_on_site !== null) count += 1;
  if (report.total_manhours !== null) count += 1;
  if (report.todays_activities?.trim()) count += 1;
  if (report.incidents_delays?.trim()) count += 1;
  if (report.work_proposed_tomorrow?.trim()) count += 1;
  if (report.additional_comments?.trim()) count += 1;
  if (report.signature_name_aims_id?.trim()) count += 1;

  return count;
}

export function normaliseReportForm(input: unknown):
  | { values: ReportFormValues; error: null }
  | { values: null; error: string } {
  if (typeof input !== "object" || input === null) {
    return {
      values: null,
      error: "Invalid report information.",
    };
  }

  const body = input as Record<string, unknown>;
  const team = body.team_members_on_site;
  const manhours = body.total_manhours;

  if (
    team !== null &&
    team !== undefined &&
    (!Number.isInteger(team) || (team as number) < 0)
  ) {
    return {
      values: null,
      error:
        "Team members on site must be a whole number of 0 or more.",
    };
  }

  if (
    manhours !== null &&
    manhours !== undefined &&
    (typeof manhours !== "number" ||
      !Number.isFinite(manhours) ||
      manhours < 0)
  ) {
    return {
      values: null,
      error: "Total manhours must be 0 or more.",
    };
  }

  const textFields = [
    "todays_activities",
    "incidents_delays",
    "work_proposed_tomorrow",
    "additional_comments",
    "signature_name_aims_id",
  ] as const;

  for (const field of textFields) {
    if (
      body[field] !== undefined &&
      typeof body[field] !== "string"
    ) {
      return {
        values: null,
        error: "Invalid report text.",
      };
    }
  }

  return {
    error: null,
    values: {
      team_members_on_site:
        team === null || team === undefined
          ? null
          : (team as number),

      total_manhours:
        manhours === null || manhours === undefined
          ? null
          : (manhours as number),

      todays_activities:
        typeof body.todays_activities === "string"
          ? body.todays_activities.trim()
          : "",

      incidents_delays:
        typeof body.incidents_delays === "string"
          ? body.incidents_delays.trim()
          : "",

      work_proposed_tomorrow:
        typeof body.work_proposed_tomorrow === "string"
          ? body.work_proposed_tomorrow.trim()
          : "",

      additional_comments:
        typeof body.additional_comments === "string"
          ? body.additional_comments.trim()
          : "",

      signature_name_aims_id:
        typeof body.signature_name_aims_id === "string"
          ? body.signature_name_aims_id.trim()
          : "",
    },
  };
}

export function validateReportForSubmission(
  values: ReportFormValues
) {
  if (values.team_members_on_site === null) {
    return "Enter the number of team members on site.";
  }

  if (values.total_manhours === null) {
    return "Enter the total manhours.";
  }

  if (!values.todays_activities.trim()) {
    return "Enter today's activities.";
  }

  if (!values.incidents_delays.trim()) {
    return 'Complete Incidents/Delays. Enter "None" if there were none.';
  }

  if (!values.work_proposed_tomorrow.trim()) {
    return "Enter the work proposed for tomorrow.";
  }

  if (!values.additional_comments.trim()) {
    return 'Complete Additional Comments. Enter "None" if there are none.';
  }

  if (!values.signature_name_aims_id.trim()) {
    return "Enter the signatory Name & AIMS ID.";
  }

  return null;
}

export {
  normaliseSiteAccountsForm,
  validateSiteAccountsForSubmission,
};

export type {
  SiteAccountsStoredValues,
};