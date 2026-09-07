import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  canAccessDepartmentReport,
} from "@/lib/auth/reportSession";

import {
  deriveReportStatus,
  getLondonDateString,
  getReportDeadline,
  isValidReportDate,
  normaliseReportForm,
  normaliseSiteAccountsForm,
  validateReportForSubmission,
  validateSiteAccountsForSubmission,
  type DepartmentReportRow,
  type ReportDepartmentRow,
  type ReportFormValues,
  type SiteAccountsStoredValues,
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

function permissionError(
  status: number
) {
  return NextResponse.json(
    {
      error:
        status ===
        401
          ? "Reporting sign-in is required."
          : "You can only submit reports for your own department.",
    },
    {
      status,
    }
  );
}

export async function POST(
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

  const isSiteAccounts =
    departmentId ===
    SITE_ACCOUNTS_DEPARTMENT_ID;

  const validated =
    isSiteAccounts
      ? normaliseSiteAccountsForm(
          rawValues
        )
      : normaliseReportForm(
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

  const submissionError =
    isSiteAccounts
      ? validateSiteAccountsForSubmission(
          validated.values as SiteAccountsStoredValues
        )
      : validateReportForSubmission(
          validated.values as ReportFormValues
        );

  if (
    submissionError
  ) {
    return NextResponse.json(
      {
        error:
          submissionError,
      },
      {
        status: 400,
      }
    );
  }

  const departmentResult =
    await supabaseServer
      .from(
        "report_departments"
      )
      .select(
        "id,name,nazim_name,active"
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
      "Existing report check failed:",
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

  const now =
    new Date().toISOString();

  /*
   * Already officially submitted.
   *
   * Update the answers but deliberately
   * preserve the original submitted_at value.
   */
  if (
    existingResult.data
      ?.submitted_at
  ) {
    const updateResult =
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

    if (
      updateResult.error ||
      !updateResult.data
    ) {
      console.error(
        "Submitted report update failed:",
        updateResult.error
      );

      return NextResponse.json(
        {
          error:
            "Report could not be updated.",
        },
        {
          status: 500,
        }
      );
    }

    const report =
      updateResult.data as DepartmentReportRow;

    return NextResponse.json({
      success: true,

      alreadySubmitted:
        true,

      report,

      status:
        deriveReportStatus(
          report,

          report.deadline_at
            ? new Date(
                report.deadline_at
              )
            : getReportDeadline(
                reportDate
              )
        ),
    });
  }

  /*
   * Existing draft:
   * convert it into an official submission.
   */
  if (
    existingResult.data
  ) {
    const updateResult =
      await supabaseServer
        .from(
          "department_reports"
        )
        .update({
          ...validated.values,

          submitted_at:
            now,
        })
        .eq(
          "id",
          existingResult
            .data.id
        )
        .is(
          "submitted_at",
          null
        )
        .select("*")
        .maybeSingle();

    if (
      updateResult.error
    ) {
      console.error(
        "Report submit failed:",
        updateResult.error
      );

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
     * Protect against two submission requests
     * arriving at nearly the same time.
     */
    if (
      !updateResult.data
    ) {
      const reread =
        await supabaseServer
          .from(
            "department_reports"
          )
          .select("*")
          .eq(
            "id",
            existingResult
              .data.id
          )
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
        reread.data as DepartmentReportRow;

      return NextResponse.json({
        success: true,

        alreadySubmitted:
          true,

        report,

        status:
          deriveReportStatus(
            report,

            report.deadline_at
              ? new Date(
                  report.deadline_at
                )
              : getReportDeadline(
                  reportDate
                )
          ),
      });
    }

    const report =
      updateResult.data as DepartmentReportRow;

    return NextResponse.json({
      success: true,

      alreadySubmitted:
        false,

      report,

      status:
        deriveReportStatus(
          report,

          report.deadline_at
            ? new Date(
                report.deadline_at
              )
            : getReportDeadline(
                reportDate
              )
        ),
    });
  }

  /*
   * No draft exists yet:
   * create and submit in one operation.
   */
  const insertResult =
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

        submitted_at:
          now,
      })
      .select("*")
      .single();

  if (
    insertResult.error ||
    !insertResult.data
  ) {
    console.error(
      "Report insert/submit failed:",
      insertResult.error
    );

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
    insertResult.data as DepartmentReportRow;

  return NextResponse.json({
    success: true,

    alreadySubmitted:
      false,

    report,

    status:
      deriveReportStatus(
        report,

        report.deadline_at
          ? new Date(
              report.deadline_at
            )
          : getReportDeadline(
              reportDate
            )
      ),
  });
}