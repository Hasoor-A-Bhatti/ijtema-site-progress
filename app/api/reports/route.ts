import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

import type {
  DepartmentReport,
  ReportStatus,
} from "@/types/reports";

export const dynamic = "force-dynamic";

const TIME_ZONE = "Europe/London";
const REPORT_FIELDS = 7;

interface DepartmentRow {
  id: string;
  name: string;
  nazim_name: string;
  sort_order: number;
  active: boolean;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function londonDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
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
    timeZone: TIME_ZONE,
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

function reportDeadline(reportDate: string) {
  const [year, month, day] =
    reportDate.split("-").map(Number);

  const wallTime = new Date(
    Date.UTC(year, month - 1, day, 20, 0, 0)
  );

  let offset = timezoneOffset(wallTime);

  let result = new Date(
    wallTime.getTime() - offset
  );

  const correctedOffset = timezoneOffset(result);

  if (correctedOffset !== offset) {
    offset = correctedOffset;

    result = new Date(
      wallTime.getTime() - offset
    );
  }

  return result;
}

function reportStatus(
  report: DepartmentReport | null,
  deadline: Date,
  now: Date
): ReportStatus {
  if (report?.submitted_at) {
    return new Date(report.submitted_at).getTime() <=
      new Date(report.deadline_at ?? deadline).getTime()
      ? "completed"
      : "late";
  }

  return now.getTime() > deadline.getTime()
    ? "overdue"
    : "pending";
}

function completedFields(
  report: DepartmentReport | null
) {
  if (!report) return 0;

  let count = 0;

  if (report.team_members_on_site !== null) count++;
  if (report.total_manhours !== null) count++;

  if (report.todays_activities?.trim()) count++;
  if (report.incidents_delays?.trim()) count++;
  if (report.work_proposed_tomorrow?.trim()) count++;
  if (report.additional_comments?.trim()) count++;
  if (report.signature_name_aims_id?.trim()) count++;

  return count;
}

export async function GET(
  request: NextRequest
) {
  const requestedDate =
    request.nextUrl.searchParams.get("date") ??
    londonDate();

  if (!validDate(requestedDate)) {
    return NextResponse.json(
      {
        error: "Invalid report date.",
      },
      {
        status: 400,
      }
    );
  }

  const [departmentsResult, reportsResult] =
    await Promise.all([
      supabaseServer
        .from("report_departments")
        .select(
          "id,name,nazim_name,sort_order,active"
        )
        .eq("active", true)
        .order("sort_order", {
          ascending: true,
        }),

      supabaseServer
        .from("department_reports")
        .select("*")
        .eq("report_date", requestedDate),
    ]);

  if (departmentsResult.error) {
    console.error(
      "Report departments:",
      departmentsResult.error
    );

    return NextResponse.json(
      {
        error: "Departments could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  if (reportsResult.error) {
    console.error(
      "Department reports:",
      reportsResult.error
    );

    return NextResponse.json(
      {
        error: "Reports could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  const departments =
    (departmentsResult.data ?? []) as DepartmentRow[];

  const reports =
    (reportsResult.data ?? []) as DepartmentReport[];

  const reportMap = new Map(
    reports.map((report) => [
      report.department_id,
      report,
    ])
  );

  const now = new Date();
  const defaultDeadline = reportDeadline(requestedDate);

  const departmentStates = departments.map(
    (department) => {
      const report =
        reportMap.get(department.id) ?? null;

      const deadline = report?.deadline_at
        ? new Date(report.deadline_at)
        : defaultDeadline;

      const status = reportStatus(
        report,
        deadline,
        now
      );

      return {
        /*
         * Existing UI-friendly values.
         */
        departmentId: department.id,
        departmentName: department.name,
        nazimName: department.nazim_name,

        department,
        report,
        status,

        completedFields: completedFields(report),
        totalFields: REPORT_FIELDS,
      };
    }
  );

  const pending = departmentStates.filter(
    (item) => item.status === "pending"
  ).length;

  const overdue = departmentStates.filter(
    (item) => item.status === "overdue"
  ).length;

  const completed = departmentStates.filter(
    (item) => item.status === "completed"
  ).length;

  const late = departmentStates.filter(
    (item) => item.status === "late"
  ).length;

  const submitted = completed + late;

  return NextResponse.json({
    success: true,

    reportDate: requestedDate,
    serverTime: now.toISOString(),
    deadlineAt: defaultDeadline.toISOString(),

    totalDepartments: departments.length,

    submitted,
    pending,
    overdue,
    completed,
    late,

    summary: {
      total: departments.length,
      submitted,
      pending,
      overdue,
      completed,
      late,
    },

    departments: departmentStates,
  });
}