import { NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_BUDGET = 15000;
const START_DATE = "2026-09-07";
const SITE_ACCOUNTS_DEPARTMENT_ID = "site-accounts";

interface SiteAccountsExpenseEntry {
  paid?: unknown;
}

interface SiteAccountsCustomAnswers {
  version?: unknown;
  departmental_expenses?: Record<
    string,
    SiteAccountsExpenseEntry
  > | null;
}

interface SiteAccountsReportRow {
  report_date: string;
  submitted_at: string | null;
  custom_answers: SiteAccountsCustomAnswers | null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function readMoney(value: unknown) {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  ) {
    return value;
  }

  if (
    typeof value === "string" &&
    value.trim() !== ""
  ) {
    const parsed = Number(value);

    if (
      Number.isFinite(parsed) &&
      parsed >= 0
    ) {
      return parsed;
    }
  }

  return 0;
}

function getReportPaidTotal(
  customAnswers: SiteAccountsCustomAnswers | null
) {
  const departmentalExpenses =
    customAnswers?.departmental_expenses;

  if (
    !departmentalExpenses ||
    typeof departmentalExpenses !== "object"
  ) {
    return 0;
  }

  return roundMoney(
    Object.values(departmentalExpenses).reduce(
      (sum, entry) => {
        return sum + readMoney(entry?.paid);
      },
      0
    )
  );
}

export async function GET() {
  const result = await supabaseServer
    .from("department_reports")
    .select(
      "report_date,submitted_at,custom_answers"
    )
    .eq(
      "department_id",
      SITE_ACCOUNTS_DEPARTMENT_ID
    )
    .gte(
      "report_date",
      START_DATE
    )
    .not(
      "submitted_at",
      "is",
      null
    )
    .order(
      "report_date",
      {
        ascending: false,
      }
    )
    .order(
      "submitted_at",
      {
        ascending: false,
      }
    );

  if (result.error) {
    console.error(
      "Site expense tracker load failed:",
      result.error
    );

    return NextResponse.json(
      {
        error:
          "Site expense information could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }

  const rows =
    (result.data ??
      []) as SiteAccountsReportRow[];

  const reports =
    rows.map(
      (row) => ({
        reportDate:
          row.report_date,

        submittedAt:
          row.submitted_at,

        paid:
          getReportPaidTotal(
            row.custom_answers
          ),
      })
    );

  /*
   * IMPORTANT:
   * The dashboard uses ONLY the most recent submitted
   * Site Accounts report when calculating the current
   * financial position.
   *
   * It does NOT add together the Paid totals from
   * previous reporting days.
   */
  const latestReport =
    reports[0] ??
    null;

  const totalPaid =
    roundMoney(
      latestReport?.paid ??
        0
    );

  const remainingBudget =
    roundMoney(
      Math.max(
        SITE_BUDGET -
          totalPaid,
        0
      )
    );

  const overspend =
    roundMoney(
      Math.max(
        totalPaid -
          SITE_BUDGET,
        0
      )
    );

  const spentPercent =
    SITE_BUDGET >
    0
      ? Math.round(
          (
            totalPaid /
            SITE_BUDGET
          ) *
            1000
        ) /
        10
      : 0;

  const remainingPercent =
    SITE_BUDGET >
    0
      ? Math.round(
          (
            remainingBudget /
            SITE_BUDGET
          ) *
            1000
        ) /
        10
      : 0;

  return NextResponse.json({
    success: true,

    budget:
      SITE_BUDGET,

    startDate:
      START_DATE,

    totalPaid,

    remainingBudget,

    overspend,

    spentPercent,

    remainingPercent,

    reportsCount:
      reports.length,

    latestReportDate:
      latestReport
        ?.reportDate ??
      null,

    reports,
  });
}
