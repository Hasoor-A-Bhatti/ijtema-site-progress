import {
  NextRequest,
  NextResponse,
} from "next/server";

import { getReportSession } from "@/lib/auth/reportSession";

import {
  countCompletedReportFields,
  deriveReportStatus,
  getLondonDateString,
  getReportDeadline,
  getReportFieldCount,
  isValidReportDate,
  type DepartmentReportRow,
  type ReportDepartmentRow,
} from "@/lib/reports/reportApiUtils";

import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let session;

  try {
    session = await getReportSession();
  } catch (error) {
    console.error("Report session check failed:", error);

    return NextResponse.json(
      {
        error:
          "Reporting authentication is not configured correctly.",
      },
      { status: 500 }
    );
  }

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Reporting sign-in is required.",
      },
      { status: 401 }
    );
  }

  if (session.role !== "admin") {
    return NextResponse.json(
      {
        error:
          "Admin reporting access is required.",
      },
      { status: 403 }
    );
  }

  const requestedDate =
    request.nextUrl.searchParams.get("date") ??
    getLondonDateString();

  if (!isValidReportDate(requestedDate)) {
    return NextResponse.json(
      {
        error:
          "Invalid report date.",
      },
      { status: 400 }
    );
  }

  const [
    departmentsResult,
    reportsResult,
  ] = await Promise.all([
    supabaseServer
      .from("report_departments")
      .select(
        "id,name,nazim_name,sort_order,active"
      )
      .eq(
        "active",
        true
      )
      .order(
        "sort_order",
        {
          ascending:
            true,
        }
      ),

    supabaseServer
      .from("department_reports")
      .select("*")
      .eq(
        "report_date",
        requestedDate
      ),
  ]);

  if (
    departmentsResult.error
  ) {
    console.error(
      "Report departments:",
      departmentsResult.error
    );

    return NextResponse.json(
      {
        error:
          "Departments could not be loaded.",
      },
      { status: 500 }
    );
  }

  if (
    reportsResult.error
  ) {
    console.error(
      "Department reports:",
      reportsResult.error
    );

    return NextResponse.json(
      {
        error:
          "Reports could not be loaded.",
      },
      { status: 500 }
    );
  }

  const departments =
    (departmentsResult.data ??
      []) as ReportDepartmentRow[];

  const reports =
    (reportsResult.data ??
      []) as DepartmentReportRow[];

  const reportMap =
    new Map(
      reports.map(
        (report) => [
          report.department_id,
          report,
        ]
      )
    );

  const now =
    new Date();

  const defaultDeadline =
    getReportDeadline(
      requestedDate
    );

  const departmentStates =
    departments.map(
      (department) => {
        const report =
          reportMap.get(
            department.id
          ) ?? null;

        const deadline =
          report?.deadline_at
            ? new Date(
                report.deadline_at
              )
            : defaultDeadline;

        const status =
          deriveReportStatus(
            report,
            deadline,
            now
          );

        const completedFields =
          countCompletedReportFields(
            report
          );

        return {
          departmentId:
            department.id,

          departmentName:
            department.name,

          nazimName:
            department.nazim_name,

          department,

          report,

          status,

          completedFields,

          draftCompletedFields:
            completedFields,

          totalFields:
            getReportFieldCount(
              department.id
            ),

          deadlineAt:
            deadline.toISOString(),
        };
      }
    );

  const pending =
    departmentStates.filter(
      (item) =>
        item.status ===
        "pending"
    ).length;

  const overdue =
    departmentStates.filter(
      (item) =>
        item.status ===
        "overdue"
    ).length;

  const completed =
    departmentStates.filter(
      (item) =>
        item.status ===
        "completed"
    ).length;

  const late =
    departmentStates.filter(
      (item) =>
        item.status ===
        "late"
    ).length;

  const submitted =
    completed + late;

  return NextResponse.json({
    success: true,

    reportDate:
      requestedDate,

    serverTime:
      now.toISOString(),

    deadlineAt:
      defaultDeadline.toISOString(),

    totalDepartments:
      departments.length,

    submitted,
    pending,
    overdue,
    completed,

    onTime:
      completed,

    late,

    summary: {
      total:
        departments.length,

      submitted,

      pending,

      overdue,

      completed,

      onTime:
        completed,

      late,
    },

    departments:
      departmentStates,
  });
}