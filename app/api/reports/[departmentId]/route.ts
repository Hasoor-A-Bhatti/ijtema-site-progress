import { NextResponse } from "next/server";

import { hasValidEditorSession } from "@/lib/auth/requireEditorSession";
import {
  countCompletedReportFields,
  getReportDeadline,
  getReportStatus,
  isValidReportDate,
  REPORT_FIELD_COUNT,
  validateReportForm,
} from "@/lib/reports/reportUtils";
import { supabaseServer } from "@/lib/supabaseServer";

import type {
  DepartmentReport,
  ReportDepartment,
} from "@/types/reports";

interface RouteContext {
  params: Promise<{
    departmentId: string;
  }>;
}

/*
 * GET CURRENT REPORT + HISTORY
 */
export async function GET(
  request: Request,
  context: RouteContext
) {
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
   * DEPARTMENT
   */
  const {
    data: department,
    error:
      departmentError,
  } = await supabaseServer
    .from(
      "report_departments"
    )
    .select("*")
    .eq(
      "id",
      cleanDepartmentId
    )
    .eq(
      "active",
      true
    )
    .maybeSingle();

  if (
    departmentError
  ) {
    console.error(
      "Failed to load report department:",
      departmentError
    );

    return NextResponse.json(
      {
        error:
          "The department could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  if (!department) {
    return NextResponse.json(
      {
        error:
          "Reporting department not found.",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * SELECTED DATE REPORT
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
      "Failed to load department report:",
      reportError
    );

    return NextResponse.json(
      {
        error:
          "The department report could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  /*
   * REPORT HISTORY
   *
   * Keep this limited for now.
   * The UI can display the latest 30 reports.
   */
  const {
    data: history,
    error: historyError,
  } = await supabaseServer
    .from(
      "department_reports"
    )
    .select("*")
    .eq(
      "department_id",
      cleanDepartmentId
    )
    .lt(
      "report_date",
      reportDate
    )
    .order(
      "report_date",
      {
        ascending: false,
      }
    )
    .limit(30);

  if (
    historyError
  ) {
    console.error(
      "Failed to load report history:",
      historyError
    );

    return NextResponse.json(
      {
        error:
          "The department's report history could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  const now =
    new Date();

  const deadline =
    report
      ? new Date(
          report.deadline_at
        )
      : getReportDeadline(
          reportDate
        );

  const historyWithStatus =
    (
      history as DepartmentReport[]
    ).map(
      (historicalReport) => ({
        report:
          historicalReport,
        status:
          getReportStatus(
            historicalReport,
            new Date(
              historicalReport.deadline_at
            ),
            now
          ),
      })
    );

  return NextResponse.json({
    success: true,

    department:
      department as ReportDepartment,

    report:
      report as DepartmentReport | null,

    reportDate,

    status:
      getReportStatus(
        report as DepartmentReport | null,
        deadline,
        now
      ),

    deadlineAt:
      deadline.toISOString(),

    completedFields:
      countCompletedReportFields(
        report as DepartmentReport | null
      ),

    totalFields:
      REPORT_FIELD_COUNT,

    history:
      historyWithStatus,
  });
}

/*
 * SAVE / UPDATE DRAFT
 */
export async function PATCH(
  request: Request,
  context: RouteContext
) {
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

  if (
    typeof body !==
      "object" ||
    body === null
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid report data.",
      },
      {
        status: 400,
      }
    );
  }

  const {
    reportDate,
    ...reportValues
  } = body as {
    reportDate?: unknown;
    [key: string]:
      unknown;
  };

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

  const validation =
    validateReportForm(
      reportValues
    );

  if (
    !validation.success
  ) {
    return NextResponse.json(
      {
        error:
          validation.error,
      },
      {
        status: 400,
      }
    );
  }

  /*
   * MAKE SURE DEPARTMENT EXISTS
   */
  const {
    data: department,
    error:
      departmentError,
  } = await supabaseServer
    .from(
      "report_departments"
    )
    .select(
      "id, name, nazim_name"
    )
    .eq(
      "id",
      cleanDepartmentId
    )
    .eq(
      "active",
      true
    )
    .maybeSingle();

  if (
    departmentError
  ) {
    console.error(
      "Failed to check department:",
      departmentError
    );

    return NextResponse.json(
      {
        error:
          "The reporting department could not be checked.",
      },
      {
        status: 500,
      }
    );
  }

  if (!department) {
    return NextResponse.json(
      {
        error:
          "Reporting department not found.",
      },
      {
        status: 404,
      }
    );
  }

  /*
   * SEE IF A REPORT ALREADY EXISTS
   */
  const {
    data: existingReport,
    error:
      existingError,
  } = await supabaseServer
    .from(
      "department_reports"
    )
    .select("id")
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
    existingError
  ) {
    console.error(
      "Failed to check existing report:",
      existingError
    );

    return NextResponse.json(
      {
        error:
          "The existing report could not be checked.",
      },
      {
        status: 500,
      }
    );
  }

  let savedReport:
    DepartmentReport | null =
      null;

  if (existingReport) {
    /*
     * Preserve submitted_at.
     *
     * Editing an already-submitted report therefore
     * cannot change whether it was originally on time
     * or late.
     */
    const {
      data,
      error,
    } = await supabaseServer
      .from(
        "department_reports"
      )
      .update({
        ...validation.values,
      })
      .eq(
        "id",
        existingReport.id
      )
      .select("*")
      .single();

    if (error) {
      console.error(
        "Failed to update report:",
        error
      );

      return NextResponse.json(
        {
          error:
            "The report could not be saved.",
        },
        {
          status: 500,
        }
      );
    }

    savedReport =
      data as DepartmentReport;
  } else {
    /*
     * The database trigger automatically supplies:
     *
     * department_name_snapshot
     * nazim_name_snapshot
     * deadline_at
     */
    const {
      data,
      error,
    } = await supabaseServer
      .from(
        "department_reports"
      )
      .insert({
        department_id:
          cleanDepartmentId,
        report_date:
          reportDate,
        ...validation.values,
      })
      .select("*")
      .single();

    if (error) {
      console.error(
        "Failed to create report draft:",
        error
      );

      return NextResponse.json(
        {
          error:
            "The report draft could not be created.",
        },
        {
          status: 500,
        }
      );
    }

    savedReport =
      data as DepartmentReport;
  }

  return NextResponse.json({
    success: true,

    report:
      savedReport,

    status:
      getReportStatus(
        savedReport,
        new Date(
          savedReport.deadline_at
        )
      ),

    completedFields:
      countCompletedReportFields(
        savedReport
      ),

    totalFields:
      REPORT_FIELD_COUNT,
  });
}