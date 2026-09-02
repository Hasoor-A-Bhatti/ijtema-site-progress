import { NextResponse } from "next/server";

import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import {
  getReportStatus,
  getSubmissionValidationError,
  isValidReportDate,
} from "@/lib/reports/reportUtils";
import { supabaseServer } from "@/lib/supabaseServer";

import type {
  DepartmentReport,
} from "@/types/reports";

interface RouteContext {
  params: Promise<{
    departmentId: string;
  }>;
}

export async function POST(
  request: Request,
  context: RouteContext
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

  const {
    departmentId,
  } = await context.params;

  const cleanDepartmentId =
    departmentId.trim();

  /*
   * 2. REQUEST
   */
  let body: unknown;

  try {
    body =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid request body.",
      },
      {
        status: 400,
      }
    );
  }

  const reportDate =
    typeof body ===
      "object" &&
    body !== null &&
    "reportDate" in body
      ? (
          body as {
            reportDate?: unknown;
          }
        ).reportDate
      : undefined;

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
   * 3. FIND REPORT
   */
  const {
    data: report,
    error: reportError,
  } = await supabaseServer
    .from(
      "department_reports"
    )
    .select("*")
    .eq(
      "department_id",
      cleanDepartmentId
    )
    .eq(
      "report_date",
      reportDate
    )
    .maybeSingle();

  if (
    reportError
  ) {
    console.error(
      "Failed to load report for submission:",
      reportError
    );

    return NextResponse.json(
      {
        error:
          "The report could not be checked.",
      },
      {
        status: 500,
      }
    );
  }

  if (!report) {
    return NextResponse.json(
      {
        error:
          "Please save the report before submitting it.",
      },
      {
        status: 409,
      }
    );
  }

  const existingReport =
    report as DepartmentReport;

  /*
   * 4. ALREADY SUBMITTED
   *
   * Preserve the original submission time.
   */
  if (
    existingReport.submitted_at
  ) {
    return NextResponse.json({
      success: true,

      alreadySubmitted:
        true,

      report:
        existingReport,

      status:
        getReportStatus(
          existingReport,
          new Date(
            existingReport.deadline_at
          )
        ),
    });
  }

  /*
   * 5. VALIDATE ALL REQUIRED QUESTIONS
   */
  const validationError =
    getSubmissionValidationError(
      existingReport
    );

  if (
    validationError
  ) {
    return NextResponse.json(
      {
        error:
          validationError,
      },
      {
        status: 409,
      }
    );
  }

  /*
   * 6. OFFICIAL SUBMISSION
   *
   * The first submitted_at timestamp becomes the
   * permanent basis for Completed vs Late.
   */
  const submittedAt =
    new Date().toISOString();

  const {
    data: submittedReport,
    error: submitError,
  } = await supabaseServer
    .from(
      "department_reports"
    )
    .update({
      submitted_at:
        submittedAt,
    })
    .eq(
      "id",
      existingReport.id
    )
    .is(
      "submitted_at",
      null
    )
    .select("*")
    .maybeSingle();

  if (
    submitError
  ) {
    console.error(
      "Failed to submit report:",
      submitError
    );

    return NextResponse.json(
      {
        error:
          "The report could not be submitted.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * Protect against two devices submitting
   * at virtually the same moment.
   */
  if (!submittedReport) {
    const {
      data: latestReport,
    } = await supabaseServer
      .from(
        "department_reports"
      )
      .select("*")
      .eq(
        "id",
        existingReport.id
      )
      .single();

    if (!latestReport) {
      return NextResponse.json(
        {
          error:
            "The report submission could not be confirmed.",
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,

      alreadySubmitted:
        true,

      report:
        latestReport,

      status:
        getReportStatus(
          latestReport as DepartmentReport,
          new Date(
            latestReport.deadline_at
          )
        ),
    });
  }

  const finalReport =
    submittedReport as DepartmentReport;

  return NextResponse.json({
    success: true,

    alreadySubmitted:
      false,

    report:
      finalReport,

    status:
      getReportStatus(
        finalReport,
        new Date(
          finalReport.deadline_at
        )
      ),
  });
}