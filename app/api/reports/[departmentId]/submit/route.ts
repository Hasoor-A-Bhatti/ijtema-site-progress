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

interface DepartmentRow {
  id: string;
  name: string;
  nazim_name: string;
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

function statusOf(
  report: DepartmentReport
): ReportStatus {
  if (!report.submitted_at) {
    return new Date().getTime() >
      new Date(report.deadline_at).getTime()
      ? "overdue"
      : "pending";
  }

  return new Date(report.submitted_at).getTime() <=
    new Date(report.deadline_at).getTime()
    ? "completed"
    : "late";
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

function submissionError(
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

export async function POST(
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

  const body = await request
    .json()
    .catch(() => null);

  const rawValues =
    typeof body === "object" &&
    body !== null &&
    "values" in body
      ? (body as { values: unknown }).values
      : body;

  const validated =
    normaliseForm(rawValues);

  if (
    validated.error ||
    !validated.values
  ) {
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

  const validationError =
    submissionError(validated.values);

  if (validationError) {
    return NextResponse.json(
      {
        error: validationError,
      },
      {
        status: 400,
      }
    );
  }

  const departmentResult =
    await supabaseServer
      .from("report_departments")
      .select(
        "id,name,nazim_name,active"
      )
      .eq("id", departmentId)
      .eq("active", true)
      .maybeSingle();

  if (
    departmentResult.error ||
    !departmentResult.data
  ) {
    return NextResponse.json(
      {
        error:
          "Department could not be found.",
      },
      {
        status: 404,
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

  /*
   * If already officially submitted, do NOT
   * overwrite the original submitted_at.
   */
  if (existingResult.data?.submitted_at) {
    const report =
      existingResult.data as DepartmentReport;

    return NextResponse.json({
      success: true,
      alreadySubmitted: true,
      report,
      status: statusOf(report),
    });
  }

  const now =
    new Date().toISOString();

  /*
   * EXISTING DRAFT
   */
  if (existingResult.data) {
    /*
     * Only succeeds while submitted_at is still NULL.
     * This protects the first submission timestamp
     * from concurrent requests.
     */
    const updateResult =
      await supabaseServer
        .from("department_reports")
        .update({
          ...validated.values,
          submitted_at: now,
        })
        .eq("id", existingResult.data.id)
        .is("submitted_at", null)
        .select("*")
        .maybeSingle();

    if (updateResult.error) {
      console.error(updateResult.error);

      return NextResponse.json(
        {
          error:
            "Report could not be submitted.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Another request may have submitted it
     * milliseconds before this one.
     */
    if (!updateResult.data) {
      const reread =
        await supabaseServer
          .from("department_reports")
          .select("*")
          .eq("id", existingResult.data.id)
          .single();

      if (
        reread.error ||
        !reread.data
      ) {
        return NextResponse.json(
          {
            error:
              "Report submission could not be confirmed.",
          },
          {
            status: 500,
          }
        );
      }

      const report =
        reread.data as DepartmentReport;

      return NextResponse.json({
        success: true,
        alreadySubmitted: true,
        report,
        status: statusOf(report),
      });
    }

    const report =
      updateResult.data as DepartmentReport;

    return NextResponse.json({
      success: true,
      alreadySubmitted: false,
      report,
      status: statusOf(report),
    });
  }

  /*
   * NO DRAFT EXISTS:
   * create and submit in one operation.
   */
  const insertResult =
    await supabaseServer
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

        submitted_at: now,
      })
      .select("*")
      .single();

  if (
    insertResult.error ||
    !insertResult.data
  ) {
    console.error(insertResult.error);

    /*
     * Unique constraint may have been hit by
     * a near-simultaneous submission.
     */
    const reread =
      await supabaseServer
        .from("department_reports")
        .select("*")
        .eq("department_id", departmentId)
        .eq("report_date", reportDate)
        .maybeSingle();

    if (
      reread.data?.submitted_at
    ) {
      const report =
        reread.data as DepartmentReport;

      return NextResponse.json({
        success: true,
        alreadySubmitted: true,
        report,
        status: statusOf(report),
      });
    }

    return NextResponse.json(
      {
        error:
          "Report could not be submitted.",
      },
      {
        status: 500,
      }
    );
  }

  const report =
    insertResult.data as DepartmentReport;

  return NextResponse.json({
    success: true,
    alreadySubmitted: false,
    report,
    status: statusOf(report),
  });
}