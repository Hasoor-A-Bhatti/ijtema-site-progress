import {
  NextRequest,
  NextResponse,
} from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

import type {
  DepartmentReport,
  ReportFormValues,
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

  return (
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second
    ) - date.getTime()
  );
}

function reportDeadline(reportDate: string) {
  const [year, month, day] =
    reportDate.split("-").map(Number);

  const wallTime = new Date(
    Date.UTC(year, month - 1, day, 20)
  );

  const offset = timezoneOffset(wallTime);

  let result = new Date(
    wallTime.getTime() - offset
  );

  const correctedOffset = timezoneOffset(result);

  if (correctedOffset !== offset) {
    result = new Date(
      wallTime.getTime() - correctedOffset
    );
  }

  return result;
}

function reportStatus(
  report: DepartmentReport | null,
  deadline: Date,
  now = new Date()
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

function countFields(
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

function normaliseForm(
  input: unknown
):
  | {
      values: ReportFormValues;
      error: null;
    }
  | {
      values: null;
      error: string;
    } {
  if (
    typeof input !== "object" ||
    input === null
  ) {
    return {
      values: null,
      error: "Invalid report information.",
    };
  }

  const body = input as Record<string, unknown>;

  const team =
    body.team_members_on_site;

  const manhours =
    body.total_manhours;

  if (
    team !== null &&
    team !== undefined &&
    (!Number.isInteger(team) ||
      (team as number) < 0)
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
      error:
        "Total manhours must be 0 or more.",
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

async function getDepartment(
  departmentId: string
) {
  return supabaseServer
    .from("report_departments")
    .select(
      "id,name,nazim_name,sort_order,active"
    )
    .eq("id", departmentId)
    .eq("active", true)
    .maybeSingle();
}

/*
 * GET ONE DEPARTMENT REPORT
 */
export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{
      departmentId: string;
    }>;
  }
) {
  const { departmentId } = await context.params;

  const reportDate =
    request.nextUrl.searchParams.get("date") ??
    londonDate();

  if (!validDate(reportDate)) {
    return NextResponse.json(
      {
        error: "Invalid report date.",
      },
      {
        status: 400,
      }
    );
  }

  const departmentResult =
    await getDepartment(departmentId);

  if (
    departmentResult.error ||
    !departmentResult.data
  ) {
    return NextResponse.json(
      {
        error: "Department could not be found.",
      },
      {
        status: 404,
      }
    );
  }

  const department =
    departmentResult.data as DepartmentRow;

  const [reportResult, historyResult] =
    await Promise.all([
      supabaseServer
        .from("department_reports")
        .select("*")
        .eq("department_id", departmentId)
        .eq("report_date", reportDate)
        .maybeSingle(),

      supabaseServer
        .from("department_reports")
        .select("*")
        .eq("department_id", departmentId)
        .lte("report_date", reportDate)
        .order("report_date", {
          ascending: false,
        })
        .limit(30),
    ]);

  if (reportResult.error) {
    console.error(reportResult.error);

    return NextResponse.json(
      {
        error: "Report could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  if (historyResult.error) {
    console.error(historyResult.error);

    return NextResponse.json(
      {
        error:
          "Report history could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  const report =
    (reportResult.data ??
      null) as DepartmentReport | null;

  const deadline = report?.deadline_at
    ? new Date(report.deadline_at)
    : reportDeadline(reportDate);

  const now = new Date();

  const history = (
    (historyResult.data ??
      []) as DepartmentReport[]
  ).map((item) => ({
    ...item,

    status: reportStatus(
      item,
      new Date(item.deadline_at),
      now
    ),
  }));

  return NextResponse.json({
    success: true,

    serverTime: now.toISOString(),
    reportDate,
    deadlineAt: deadline.toISOString(),

    department,
    report,

    status: reportStatus(
      report,
      deadline,
      now
    ),

    completedFields: countFields(report),
    totalFields: REPORT_FIELDS,

    history,
  });
}

/*
 * SAVE DRAFT / SAVE CHANGES
 */
export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      departmentId: string;
    }>;
  }
) {
  const { departmentId } = await context.params;

  const reportDate =
    request.nextUrl.searchParams.get("date") ??
    londonDate();

  if (!validDate(reportDate)) {
    return NextResponse.json(
      {
        error: "Invalid report date.",
      },
      {
        status: 400,
      }
    );
  }

  const departmentResult =
    await getDepartment(departmentId);

  if (
    departmentResult.error ||
    !departmentResult.data
  ) {
    return NextResponse.json(
      {
        error: "Department could not be found.",
      },
      {
        status: 404,
      }
    );
  }

  const body = await request
    .json()
    .catch(() => null);

  /*
   * Supports both:
   *
   * JSON.stringify(form)
   *
   * and
   *
   * JSON.stringify({ values: form })
   */
  const rawValues =
    typeof body === "object" &&
    body !== null &&
    "values" in body
      ? (body as { values: unknown }).values
      : body;

  const validated = normaliseForm(rawValues);

  if (validated.error || !validated.values) {
    return NextResponse.json(
      {
        error:
          validated.error ??
          "Invalid report information.",
      },
      {
        status: 400,
      }
    );
  }

  const department =
    departmentResult.data as DepartmentRow;

  const existingResult =
    await supabaseServer
      .from("department_reports")
      .select("*")
      .eq("department_id", departmentId)
      .eq("report_date", reportDate)
      .maybeSingle();

  if (existingResult.error) {
    console.error(existingResult.error);

    return NextResponse.json(
      {
        error:
          "Existing report could not be checked.",
      },
      {
        status: 500,
      }
    );
  }

  let result;

  if (existingResult.data) {
    /*
     * submitted_at is deliberately NOT changed.
     * The initial submission time is preserved.
     */
    result = await supabaseServer
      .from("department_reports")
      .update({
        ...validated.values,
      })
      .eq("id", existingResult.data.id)
      .select("*")
      .single();
  } else {
    result = await supabaseServer
      .from("department_reports")
      .insert({
        department_id: departmentId,
        report_date: reportDate,

        department_name_snapshot:
          department.name,

        nazim_name_snapshot:
          department.nazim_name,

        deadline_at:
          reportDeadline(reportDate).toISOString(),

        ...validated.values,
      })
      .select("*")
      .single();
  }

  if (result.error || !result.data) {
    console.error(result.error);

    return NextResponse.json(
      {
        error: "Report could not be saved.",
      },
      {
        status: 500,
      }
    );
  }

  const report =
    result.data as DepartmentReport;

  const deadline =
    new Date(report.deadline_at);

  return NextResponse.json({
    success: true,

    report,

    status: reportStatus(
      report,
      deadline
    ),

    completedFields:
      countFields(report),

    totalFields:
      REPORT_FIELDS,
  });
}