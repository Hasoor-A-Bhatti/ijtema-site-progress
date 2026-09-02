import { NextResponse } from "next/server";

import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import {
  countCompletedReportFields,
  getReportDeadline,
  getReportStatus,
  isValidReportDate,
  REPORT_FIELD_COUNT,
} from "@/lib/reports/reportUtils";
import { supabaseServer } from "@/lib/supabaseServer";

import type {
  DepartmentReport,
  ReportDepartment,
  ReportStatus,
} from "@/types/reports";

export async function GET(
  request: Request
) {
  /*
   * 1. AUTHORISATION
   */
  const authorised =
    await hasValidEditorSession();

  if (!authorised) {
    return NextResponse.json(
      {
        error:
          "Editing access is required.",
      },
      {
        status: 401,
      }
    );
  }

  /*
   * 2. REPORT DATE
   */
  const url =
    new URL(request.url);

  const reportDate =
    url.searchParams.get(
      "date"
    );

  if (
    !isValidReportDate(
      reportDate
    )
  ) {
    return NextResponse.json(
      {
        error:
          "A valid report date is required.",
      },
      {
        status: 400,
      }
    );
  }

  /*
   * 3. LOAD DEPARTMENTS
   */
  const {
    data: departments,
    error:
      departmentsError,
  } = await supabaseServer
    .from(
      "report_departments"
    )
    .select("*")
    .eq("active", true)
    .order(
      "sort_order",
      {
        ascending: true,
      }
    );

  if (
    departmentsError
  ) {
    console.error(
      "Failed to load reporting departments:",
      departmentsError
    );

    return NextResponse.json(
      {
        error:
          "Reporting departments could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * 4. LOAD REPORTS FOR DATE
   */
  const {
    data: reports,
    error: reportsError,
  } = await supabaseServer
    .from(
      "department_reports"
    )
    .select("*")
    .eq(
      "report_date",
      reportDate
    );

  if (
    reportsError
  ) {
    console.error(
      "Failed to load department reports:",
      reportsError
    );

    return NextResponse.json(
      {
        error:
          "Site reports could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  const now =
    new Date();

  const defaultDeadline =
    getReportDeadline(
      reportDate
    );

  const reportMap =
    new Map(
      (
        reports as DepartmentReport[]
      ).map(
        (report) => [
          report.department_id,
          report,
        ]
      )
    );

  const states =
    (
      departments as ReportDepartment[]
    ).map(
      (department) => {
        const report =
          reportMap.get(
            department.id
          ) ?? null;

        const deadline =
          report
            ? new Date(
                report.deadline_at
              )
            : defaultDeadline;

        return {
          department,
          report,
          status:
            getReportStatus(
              report,
              deadline,
              now
            ),
          completedFields:
            countCompletedReportFields(
              report
            ),
          totalFields:
            REPORT_FIELD_COUNT,
          deadlineAt:
            deadline.toISOString(),
        };
      }
    );

  /*
   * 5. SUMMARY COUNTS
   */
  const summary: Record<
    ReportStatus,
    number
  > = {
    pending: 0,
    overdue: 0,
    completed: 0,
    late: 0,
  };

  states.forEach(
    (state) => {
      summary[
        state.status
      ] += 1;
    }
  );

  const submitted =
    summary.completed +
    summary.late;

  return NextResponse.json({
    success: true,

    reportDate,

    serverTime:
      now.toISOString(),

    deadlineAt:
      defaultDeadline.toISOString(),

    totalDepartments:
      states.length,

    submitted,

    summary,

    departments:
      states,
  });
}