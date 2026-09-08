"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const SITE_BUDGET = 15000;

interface ExpenseReportSummary {
  reportDate: string;
  paid: number;
  submittedAt: string | null;
}

interface SiteExpenseResponse {
  success: true;
  budget: number;
  startDate: string;
  totalPaid: number;
  remainingBudget: number;
  overspend: number;
  spentPercent: number;
  remainingPercent: number;
  reportsCount: number;
  latestReportDate: string | null;
  reports: ExpenseReportSummary[];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "No reports yet";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(`${value}T12:00:00Z`));
}

function ProgressWheel({
  value,
  label,
  detail,
  colour,
}: {
  value: number;
  label: string;
  detail: string;
  colour: string;
}) {
  const safeValue = Math.min(Math.max(value, 0), 100);

  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="relative flex h-40 w-40 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${colour} ${safeValue}%, #e2e8f0 ${safeValue}% 100%)`,
        }}
      >
        <div className="absolute inset-[12px] flex flex-col items-center justify-center rounded-full bg-white">
          <span className="text-3xl font-bold text-slate-950">
            {Math.round(value)}%
          </span>

          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-800">
        {detail}
      </p>
    </div>
  );
}

export default function SiteExpenseTracker() {
  const [data, setData] =
    useState<SiteExpenseResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const loadExpenses =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const response =
          await fetch(
            "/api/site-expenses",
            {
              cache:
                "no-store",
            }
          );

        const body =
          (await response
            .json()
            .catch(
              () =>
                null
            )) as
            | SiteExpenseResponse
            | {
                error?: string;
              }
            | null;

        if (
          !response.ok ||
          !body ||
          !(
            "success" in
            body
          )
        ) {
          throw new Error(
            body &&
              "error" in
                body &&
              body.error
              ? body.error
              : "Site expense information could not be loaded."
          );
        }

        setData(
          body
        );
      } catch (
        loadError
      ) {
        setError(
          loadError instanceof
            Error
            ? loadError.message
            : "Site expense information could not be loaded."
        );
      } finally {
        setLoading(
          false
        );
      }
    }, []);

  useEffect(() => {
    const initialLoad =
      window.setTimeout(
        () => {
          void loadExpenses();
        },
        0
      );

    const refreshInterval =
      window.setInterval(
        () => {
          void loadExpenses();
        },
        60000
      );

    return () => {
      window.clearTimeout(
        initialLoad
      );

      window.clearInterval(
        refreshInterval
      );
    };
  }, [
    loadExpenses,
  ]);

  const budget =
    data?.budget ??
    SITE_BUDGET;

  const totalPaid =
    data?.totalPaid ??
    0;

  const remainingBudget =
    data?.remainingBudget ??
    SITE_BUDGET;

  const overspend =
    data?.overspend ??
    0;

  const spentPercent =
    data?.spentPercent ??
    0;

  const remainingPercent =
    data?.remainingPercent ??
    100;

  const latestReports =
    useMemo(
      () =>
        data?.reports.slice(
          0,
          5
        ) ?? [],
      [
        data,
      ]
    );

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Financial Position
            </p>

            <h3 className="mt-1 text-xl font-semibold">
              Site Expense Tracker
            </h3>

            <p className="mt-1 text-sm text-slate-300">
              Paid amounts recorded by Site Accounts from 07/09/2026 onwards.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadExpenses()
            }
            disabled={
              loading
            }
            className="w-fit rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"
          >
            {loading
              ? "Updating…"
              : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm font-medium text-red-700 sm:px-6">
          {error}
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="grid gap-7 xl:grid-cols-[1.15fr_1.85fr] xl:items-center">
          <div className="grid grid-cols-2 gap-5">
            <ProgressWheel
              value={
                spentPercent
              }
              label="Spent"
              detail={`${formatMoney(
                totalPaid
              )} paid`}
              colour="#dc2626"
            />

            <ProgressWheel
              value={
                remainingPercent
              }
              label="Remaining"
              detail={
                formatMoney(
                  remainingBudget
                )
              }
              colour="#16a34a"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Total Budget
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-950">
                {formatMoney(
                  budget
                )}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Fixed site budget
              </p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600">
                Total Paid
              </p>

              <p className="mt-2 text-2xl font-bold text-red-800">
                {loading
                  ? "—"
                  : formatMoney(
                      totalPaid
                    )}
              </p>

              <p className="mt-1 text-xs text-red-700">
                Across{" "}
                {data?.reportsCount ??
                  0}{" "}
                saved report
                {(data?.reportsCount ??
                  0) === 1
                  ? ""
                  : "s"}
              </p>
            </div>

            <div
              className={`rounded-2xl border p-4 ${
                overspend > 0
                  ? "border-red-200 bg-red-50"
                  : "border-emerald-200 bg-emerald-50"
              }`}
            >
              <p
                className={`text-[11px] font-semibold uppercase tracking-wide ${
                  overspend > 0
                    ? "text-red-600"
                    : "text-emerald-600"
                }`}
              >
                {overspend > 0
                  ? "Over Budget"
                  : "Remaining Budget"}
              </p>

              <p
                className={`mt-2 text-2xl font-bold ${
                  overspend > 0
                    ? "text-red-800"
                    : "text-emerald-800"
                }`}
              >
                {loading
                  ? "—"
                  : formatMoney(
                      overspend > 0
                        ? overspend
                        : remainingBudget
                    )}
              </p>

              <p
                className={`mt-1 text-xs ${
                  overspend > 0
                    ? "text-red-700"
                    : "text-emerald-700"
                }`}
              >
                {overspend > 0
                  ? "Paid expenses exceed the £15,000 budget."
                  : `${Math.round(
                      remainingPercent
                    )}% of budget remaining`}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Recent Expense
                  Reports
                </p>

                <p className="mt-0.5 text-xs text-slate-500">
                  Latest Site
                  Accounts paid
                  totals included
                  in the tracker.
                </p>
              </div>

              <span className="shrink-0 text-xs font-semibold text-slate-500">
                Latest{" "}
                {formatDate(
                  data?.latestReportDate ??
                    null
                )}
              </span>
            </div>

            {loading ? (
              <div className="p-6 text-center text-sm text-slate-500">
                Loading expense reports…
              </div>
            ) : latestReports.length ===
              0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No Site Accounts
                expense reports
                have been saved
                from 07/09/2026
                yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {latestReports.map(
                  (
                    report
                  ) => (
                    <div
                      key={
                        report.reportDate
                      }
                      className="flex items-center justify-between gap-4 px-4 py-3.5"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatDate(
                            report.reportDate
                          )}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {report.submittedAt
                            ? "Submitted report"
                            : "Saved draft"}
                        </p>
                      </div>

                      <span className="shrink-0 text-sm font-bold text-slate-950">
                        {formatMoney(
                          report.paid
                        )}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
          Remaining Budget =
          £15,000 minus the
          sum of all
          departmental
          amounts entered in
          the{" "}
          <span className="font-semibold text-slate-700">
            Paid
          </span>{" "}
          column of Site
          Accounts reports
          dated 07/09/2026 or
          later.
        </div>
      </div>
    </section>
  );
}