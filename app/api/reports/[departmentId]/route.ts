import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  canAccessDepartmentReport,
} from "@/lib/auth/reportSession";

import {
  countCompletedReportFields,
  deriveReportStatus,
  getLondonDateString,
  getReportDeadline,
  getReportFieldCount,
  isValidReportDate,
  normaliseReportForm,
  normaliseSiteAccountsForm,
  type DepartmentReportRow,
  type ReportDepartmentRow,
} from "@/lib/reports/reportApiUtils";

import {
  SITE_ACCOUNTS_DEPARTMENT_ID,
} from "@/lib/reports/siteAccTracker";

import {
  supabaseServer,
} from "@/lib/supabaseServer";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

interface RouteContext {
  params: Promise<{
    departmentId: string;
  }>;
}

async function getDepartment(
  departmentId: string
) {
  return supabaseServer
    .from(
      "report_departments"
    )
    .select(
      "id,name,nazim_name,sort_order,active"
    )
    .eq(
      "id",
      departmentId
    )
    .eq(
      "active",
      true
    )
    .maybeSingle();
}

function permissionError(
  status: number
) {
  return NextResponse.json(
    {
      error:
        status ===
        401
          ? "Reporting sign-in is required."
          : "You can only access your own department reports.",
    },
    {
      status,
    }
  );
}

function normaliseValues(
  departmentId: string,
  input: unknown
) {
  if (
    departmentId ===
    SITE_ACCOUNTS_DEPARTMENT_ID
  ) {
    return normaliseSiteAccountsForm(
      input
    );
  }

  return normaliseReportForm(
    input
  );
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const {
    departmentId,
  } =
    await context.params;

  const access =
    await canAccessDepartmentReport(
      departmentId
    );

  if (
    !access.allowed
  ) {
    return permissionError(
      access.status
    );
  }

  const reportDate =
    request.nextUrl.searchParams.get(
      "date"
    ) ??
    getLondonDateString();

  if (
    !isValidReportDate(
      reportDate
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid report date.",
      },
      {
        status: 400,
      }
    );
  }

  const departmentResult =
    await getDepartment(
      departmentId
    );

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
    departmentResult.data as ReportDepartmentRow;

  const [
    reportResult,
    historyResult,
  ] =
    await Promise.all([
      supabaseServer
        .from(
          "department_reports"
        )
        .select("*")
        .eq(
          "department_id",
          departmentId
        )
        .eq(
          "report_date",
          reportDate
        )
        .maybeSingle(),

      supabaseServer
        .from(
          "department_reports"
        )
        .select("*")
        .eq(
          "department_id",
          departmentId
        )
        .lte(
          "report_date",
          reportDate
        )
        .order(
          "report_date",
          {
            ascending:
              false,
          }
        )
        .limit(30),
    ]);

  if (
    reportResult.error
  ) {
    console.error(
      "Department report load failed:",
      reportResult.error
    );

    return NextResponse.json(
      {
        error:
          "Report could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  if (
    historyResult.error
  ) {
    console.error(
      "Department report history failed:",
      historyResult.error
    );

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
      null) as DepartmentReportRow | null;

  const deadline =
    report?.deadline_at
      ? new Date(
          report.deadline_at
        )
      : getReportDeadline(
          reportDate
        );

  const now =
    new Date();

  const totalFields =
    getReportFieldCount(
      departmentId
    );

  const history =
    (
      (historyResult.data ??
        []) as DepartmentReportRow[]
    ).map(
      (item) => {
        const status =
          deriveReportStatus(
            item,

            item.deadline_at
              ? new Date(
                  item.deadline_at
                )
              : getReportDeadline(
                  item.report_date
                ),

            now
          );

        const completedFields =
          countCompletedReportFields(
            item
          );

        return {
          ...item,

          report:
            item,

          status,

          completedFields,

          totalFields:
            getReportFieldCount(
              item.department_id
            ),
        };
      }
    );

  return NextResponse.json({
    success: true,

    serverTime:
      now.toISOString(),

    reportDate,

    deadlineAt:
      deadline.toISOString(),

    department,

    report,

    status:
      deriveReportStatus(
        report,
        deadline,
        now
      ),

    completedFields:
      countCompletedReportFields(
        report
      ),

    totalFields,

    history,
  });
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const {
    departmentId,
  } =
    await context.params;

  const access =
    await canAccessDepartmentReport(
      departmentId
    );

  if (
    !access.allowed
  ) {
    return permissionError(
      access.status
    );
  }

  const reportDate =
    request.nextUrl.searchParams.get(
      "date"
    ) ??
    getLondonDateString();

  if (
    !isValidReportDate(
      reportDate
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid report date.",
      },
      {
        status: 400,
      }
    );
  }

  const departmentResult =
    await getDepartment(
      departmentId
    );

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

  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid report information.",
      },
      {
        status: 400,
      }
    );
  }

  const rawValues =
    typeof body ===
      "object" &&
    body !== null &&
    "values" in body
      ? (
          body as {
            values: unknown;
          }
        ).values
      : body;

  const validated =
    normaliseValues(
      departmentId,
      rawValues
    );

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

  const department =
    departmentResult.data as ReportDepartmentRow;

  const existingResult =
    await supabaseServer
      .from(
        "department_reports"
      )
      .select("*")
      .eq(
        "department_id",
        departmentId
      )
      .eq(
        "report_date",
        reportDate
      )
      .maybeSingle();

  if (
    existingResult.error
  ) {
    console.error(
      "Existing department report check failed:",
      existingResult.error
    );

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

  if (
    existingResult.data
  ) {
    result =
      await supabaseServer
        .from(
          "department_reports"
        )
        .update({
          ...validated.values,
        })
        .eq(
          "id",
          existingResult
            .data.id
        )
        .select("*")
        .single();
  } else {
    result =
      await supabaseServer
        .from(
          "department_reports"
        )
        .insert({
          department_id:
            departmentId,

          report_date:
            reportDate,

          department_name_snapshot:
            department.name,

          nazim_name_snapshot:
            department.nazim_name,

          deadline_at:
            getReportDeadline(
              reportDate
            ).toISOString(),

          ...validated.values,
        })
        .select("*")
        .single();
  }

  if (
    result.error ||
    !result.data
  ) {
    console.error(
      "Department report save failed:",
      result.error
    );

    return NextResponse.json(
      {
        error:
          "Report could not be saved.",
      },
      {
        status: 500,
      }
    );
  }

  const report =
    result.data as DepartmentReportRow;

  const deadline =
    report.deadline_at
      ? new Date(
          report.deadline_at
        )
      : getReportDeadline(
          reportDate
        );

  return NextResponse.json({
    success: true,

    report,

    status:
      deriveReportStatus(
        report,
        deadline
      ),

    completedFields:
      countCompletedReportFields(
        report
      ),

    totalFields:
      getReportFieldCount(
        departmentId
      ),
  });
}