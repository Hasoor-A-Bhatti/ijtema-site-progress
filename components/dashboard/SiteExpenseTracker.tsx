"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const SITE_BUDGET = 15000;

const EXPENSE_UNLOCK_PASSWORD =
  "IjtemaExpenses123!";

const EXPENSE_UNLOCK_SESSION_KEY =
  "ijtema_expense_tracker_unlocked";

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
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [unlocked, setUnlocked] =
    useState(false);

  const [unlockChecked, setUnlockChecked] =
    useState(false);

  const [showUnlockForm, setShowUnlockForm] =
    useState(false);

  const [unlockPassword, setUnlockPassword] =
    useState("");

  const [unlockError, setUnlockError] =
    useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const saved =
          window.sessionStorage.getItem(
            EXPENSE_UNLOCK_SESSION_KEY
          );

        setUnlocked(saved === "true");
      } catch {
        setUnlocked(false);
      } finally {
        setUnlockChecked(true);
      }
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

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
    if (!unlocked) {
      return;
    }

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
    unlocked,
  ]);

  function unlockTracker() {
    setUnlockError(null);

    if (
      unlockPassword !==
      EXPENSE_UNLOCK_PASSWORD
    ) {
      setUnlockError(
        "Incorrect expense tracker password."
      );
      return;
    }

    try {
      window.sessionStorage.setItem(
        EXPENSE_UNLOCK_SESSION_KEY,
        "true"
      );
    } catch {
      // The tracker still unlocks even if storage is unavailable.
    }

    setUnlocked(true);
    setShowUnlockForm(false);
    setUnlockPassword("");
  }

  function lockTracker() {
    try {
      window.sessionStorage.removeItem(
        EXPENSE_UNLOCK_SESSION_KEY
      );
    } catch {
      // Ignore storage failures.
    }

    setUnlocked(false);
    setData(null);
    setError(null);
    setShowUnlockForm(false);
    setUnlockPassword("");
    setUnlockError(null);
  }

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

  if (!unlockChecked) {
    return (
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex min-h-[300px] items-center justify-center bg-slate-950 px-5 py-10 text-white">
          <div className="text-center">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-slate-600 border-t-white" />
            <p className="mt-4 text-sm font-medium text-slate-300">
              Checking expense tracker access…
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!unlocked) {
    return (
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => {
            setShowUnlockForm(true);
            setUnlockError(null);
          }}
          className="group relative flex min-h-[320px] w-full items-center justify-center overflow-hidden bg-slate-950 px-5 py-10 text-left text-white"
        >
          <div className="pointer-events-none absolute inset-0 opacity-20">
            <div className="absolute left-[12%] top-[18%] h-28 w-28 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute bottom-[12%] right-[10%] h-36 w-36 rounded-full bg-white/10 blur-3xl" />
          </div>

          <div className="relative z-10 max-w-md text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 transition group-hover:bg-white/15">
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Financial Position
            </p>

            <h3 className="mt-1 text-xl font-semibold sm:text-2xl">
              Site Expense Tracker Locked
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              Expense information is restricted. Click to unlock the tracker.
            </p>

            <span className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition group-hover:bg-slate-100">
              Unlock Expense Tracker
            </span>
          </div>
        </button>

        {showUnlockForm && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Unlock expense tracker"
              className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="bg-slate-950 px-6 py-5 text-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Restricted Access
                    </p>
                    <h3 className="mt-1 text-xl font-semibold">
                      Unlock Expense Tracker
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUnlockForm(false);
                      setUnlockPassword("");
                      setUnlockError(null);
                    }}
                    aria-label="Close unlock window"
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl text-slate-400 transition hover:bg-white/10 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  unlockTracker();
                }}
                className="p-6"
              >
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">
                    Password
                  </span>

                  <input
                    type="password"
                    autoFocus
                    autoComplete="current-password"
                    value={unlockPassword}
                    onChange={(event) => {
                      setUnlockPassword(event.target.value);
                      if (unlockError) {
                        setUnlockError(null);
                      }
                    }}
                    placeholder="Enter expense tracker password"
                    className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </label>

                {unlockError && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
                    {unlockError}
                  </div>
                )}

                <button
                  type="submit"
                  className="mt-5 min-h-12 w-full rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Unlock Tracker
                </button>
              </form>
            </div>
          </div>
        )}
      </section>
    );
  }

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
              Current budget position based on the latest submitted Site Accounts report.
            </p>
          </div>

          <div className="flex items-center gap-2">
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

            <button
              type="button"
              onClick={lockTracker}
              className="w-fit rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
            >
              Lock
            </button>
          </div>
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
                Latest Total Paid
              </p>

              <p className="mt-2 text-2xl font-bold text-red-800">
                {loading
                  ? "—"
                  : formatMoney(
                      totalPaid
                    )}
              </p>

              <p className="mt-1 text-xs text-red-700">
                {data?.latestReportDate
                  ? `From ${formatDate(
                      data.latestReportDate
                    )}`
                  : "No submitted report yet"}
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
                  Submitted Expense Reports
                </p>

                <p className="mt-0.5 text-xs text-slate-500">
                  The newest submitted report is used for the current budget position.
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
                No submitted Site Accounts expense reports are available from 07/09/2026 onwards.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {latestReports.map(
                  (
                    report,
                    index
                  ) => (
                    <div
                      key={`${report.reportDate}-${report.submittedAt ?? index}`}
                      className="flex items-center justify-between gap-4 px-4 py-3.5"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatDate(
                              report.reportDate
                            )}
                          </p>

                          {index === 0 && (
                            <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                              Current
                            </span>
                          )}
                        </div>

                        <p className="mt-0.5 text-xs text-slate-500">
                          Submitted report
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
          total{" "}
          <span className="font-semibold text-slate-700">
            Paid
          </span>{" "}
          amount recorded in
          the most recent
          submitted Site
          Accounts report.
          Previous reporting
          days are not added
          together.
        </div>
      </div>
    </section>
  );
}
