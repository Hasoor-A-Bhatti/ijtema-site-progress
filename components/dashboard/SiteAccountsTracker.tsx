"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  SITE_ACCOUNTS_DEPARTMENT_ID,
  SITE_ACCOUNTS_EXPENSE_DEPARTMENTS,
  createEmptySiteAccountsTracker,
  getSiteAccountsTotals,
  type SiteAccountsExpenseField,
  type SiteAccountsTrackerValues,
} from "@/lib/reports/siteAccTracker";

type ReportStatus =
  | "pending"
  | "overdue"
  | "completed"
  | "late";

interface DepartmentReportRow {
  id: string;
  department_id: string;
  department_name_snapshot: string;
  nazim_name_snapshot: string;
  report_date: string;
  deadline_at: string;
  submitted_at: string | null;
  custom_answers?: SiteAccountsTrackerValues | null;
  signature_name_aims_id: string;
}

interface HistoryRow extends DepartmentReportRow {
  status: ReportStatus;
  completedFields: number;
  totalFields: number;
}

interface DepartmentReportResponse {
  success: true;
  serverTime: string;
  reportDate: string;
  deadlineAt: string;
  department: {
    id: string;
    name: string;
    nazim_name: string;
  };
  report: DepartmentReportRow | null;
  status: ReportStatus;
  completedFields: number;
  totalFields: number;
  history: HistoryRow[];
}

interface SiteAccountsTrackerProps {
  reportDate?: string;
  onReportDateChange?: (date: string) => void;
  onReportChanged?: () => void | Promise<void>;
  onSessionExpired?: () => void;
}

interface ExpenseFormEntry {
  submitted: string;
  pending_approval: string;
  approved_remaining: string;
  paid: string;
}

interface TrackerFormState {
  total_budget: string;
  departmental_expenses: Record<string, ExpenseFormEntry>;
  signature_name_aims_id: string;
}

function getLondonDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
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

function addDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12));

  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function toInputValue(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function toMoneyNumber(value: string) {
  if (value.trim() === "") {
    return 0;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }

  return Math.round((numberValue + Number.EPSILON) * 100) / 100;
}

function emptyForm(): TrackerFormState {
  return {
    total_budget: "",
    departmental_expenses: Object.fromEntries(
      SITE_ACCOUNTS_EXPENSE_DEPARTMENTS.map((department) => [
        department.id,
        {
          submitted: "0",
          pending_approval: "0",
          approved_remaining: "0",
          paid: "0",
        },
      ])
    ),
    signature_name_aims_id: "",
  };
}

function reportToForm(
  report: DepartmentReportRow | null
): TrackerFormState {
  const form = emptyForm();
  const tracker = report?.custom_answers;

  if (tracker?.version === 1) {
    form.total_budget = toInputValue(tracker.total_budget);

    for (const department of SITE_ACCOUNTS_EXPENSE_DEPARTMENTS) {
      const entry = tracker.departmental_expenses?.[department.id];

      if (!entry) {
        continue;
      }

      form.departmental_expenses[department.id] = {
        submitted: toInputValue(entry.submitted),
        pending_approval: toInputValue(entry.pending_approval),
        approved_remaining: toInputValue(entry.approved_remaining),
        paid: toInputValue(entry.paid),
      };
    }
  }

  form.signature_name_aims_id =
    report?.signature_name_aims_id ?? "";

  return form;
}

function formPayload(form: TrackerFormState) {
  const tracker = createEmptySiteAccountsTracker();

  tracker.total_budget =
    form.total_budget.trim() === ""
      ? null
      : toMoneyNumber(form.total_budget);

  for (const department of SITE_ACCOUNTS_EXPENSE_DEPARTMENTS) {
    const entry = form.departmental_expenses[department.id];

    tracker.departmental_expenses[department.id] = {
      department_name: department.name,
      submitted: toMoneyNumber(entry?.submitted ?? "0"),
      pending_approval: toMoneyNumber(
        entry?.pending_approval ?? "0"
      ),
      approved_remaining: toMoneyNumber(
        entry?.approved_remaining ?? "0"
      ),
      paid: toMoneyNumber(entry?.paid ?? "0"),
    };
  }

  return {
    custom_answers: tracker,
    signature_name_aims_id: form.signature_name_aims_id,
  };
}

function statusInfo(status: ReportStatus) {
  switch (status) {
    case "completed":
      return {
        label: "Submitted On Time",
        shortLabel: "On Time",
        classes: "bg-emerald-50 text-emerald-700",
      };

    case "late":
      return {
        label: "Submitted Late",
        shortLabel: "Late",
        classes: "bg-amber-50 text-amber-700",
      };

    case "overdue":
      return {
        label: "Overdue",
        shortLabel: "Overdue",
        classes: "bg-red-50 text-red-700",
      };

    default:
      return {
        label: "Pending",
        shortLabel: "Pending",
        classes: "bg-blue-50 text-blue-700",
      };
  }
}

function MoneyInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
        £
      </span>

      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-7 pr-2 text-right text-sm font-medium text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      />
    </div>
  );
}

export default function SiteAccountsTracker({
  reportDate: controlledReportDate,
  onReportDateChange,
  onReportChanged,
  onSessionExpired,
}: SiteAccountsTrackerProps) {
  const [internalReportDate, setInternalReportDate] = useState(
    getLondonDateString()
  );

  const reportDate = controlledReportDate ?? internalReportDate;

  const [data, setData] =
    useState<DepartmentReportResponse | null>(null);

  const [form, setForm] = useState<TrackerFormState>(() =>
    emptyForm()
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const changeReportDate = useCallback(
    (nextDate: string) => {
      if (!nextDate) {
        return;
      }

      if (controlledReportDate === undefined) {
        setInternalReportDate(nextDate);
      }

      onReportDateChange?.(nextDate);
    },
    [controlledReportDate, onReportDateChange]
  );

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/reports/${SITE_ACCOUNTS_DEPARTMENT_ID}?date=${encodeURIComponent(
          reportDate
        )}`,
        {
          cache: "no-store",
        }
      );

      if (response.status === 401 || response.status === 403) {
        onSessionExpired?.();

        if (!onSessionExpired) {
          throw new Error("Your reporting session has expired.");
        }

        return;
      }

      const body = (await response.json().catch(() => null)) as
        | DepartmentReportResponse
        | { error?: string }
        | null;

      if (!response.ok || !body || !("success" in body)) {
        throw new Error(
          body && "error" in body && body.error
            ? body.error
            : "Site Accounts tracker could not be loaded."
        );
      }

      setData(body);
      setForm(reportToForm(body.report));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Site Accounts tracker could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired, reportDate]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadReport();
    }, 0);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [loadReport]);

  const tracker = useMemo(
    () => formPayload(form).custom_answers,
    [form]
  );

  const totals = useMemo(
    () => getSiteAccountsTotals(tracker),
    [tracker]
  );

  const status = statusInfo(data?.status ?? "pending");

  const recentHistory = useMemo(
    () => data?.history.slice(0, 7) ?? [],
    [data]
  );

  function updateExpense(
    departmentId: string,
    field: SiteAccountsExpenseField,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      departmental_expenses: {
        ...current.departmental_expenses,
        [departmentId]: {
          ...current.departmental_expenses[departmentId],
          [field]: value,
        },
      },
    }));
  }

  async function saveDraft() {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/reports/${SITE_ACCOUNTS_DEPARTMENT_ID}?date=${encodeURIComponent(
          reportDate
        )}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: formPayload(form),
          }),
        }
      );

      if (response.status === 401 || response.status === 403) {
        onSessionExpired?.();

        if (!onSessionExpired) {
          throw new Error("Your reporting session has expired.");
        }

        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            error?: string;
          }
        | null;

      if (!response.ok || !body?.success) {
        throw new Error(body?.error ?? "Tracker could not be saved.");
      }

      setSuccessMessage(
        data?.report?.submitted_at
          ? "Changes saved. The original submission time has been preserved."
          : "Draft saved successfully."
      );

      await loadReport();
      await onReportChanged?.();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Tracker could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitReport() {
    const confirmed = window.confirm(
      data?.report?.submitted_at
        ? "Save these changes to the submitted Site Accounts tracker? The original submission time will remain unchanged."
        : "Submit the Site Accounts tracker? The summary totals are calculated automatically from the departmental entries."
    );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/reports/${SITE_ACCOUNTS_DEPARTMENT_ID}/submit?date=${encodeURIComponent(
          reportDate
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: formPayload(form),
          }),
        }
      );

      if (response.status === 401 || response.status === 403) {
        onSessionExpired?.();

        if (!onSessionExpired) {
          throw new Error("Your reporting session has expired.");
        }

        return;
      }

      const body = (await response.json().catch(() => null)) as
        | {
            success?: boolean;
            alreadySubmitted?: boolean;
            error?: string;
          }
        | null;

      if (!response.ok || !body?.success) {
        throw new Error(
          body?.error ?? "Tracker could not be submitted."
        );
      }

      setSuccessMessage(
        body.alreadySubmitted
          ? "Tracker updated successfully. The original submission time has been preserved."
          : "Site Accounts tracker submitted successfully."
      );

      await loadReport();
      await onReportChanged?.();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Tracker could not be submitted."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-950 px-4 py-5 text-white sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Department Reporting
              </p>

              <h3 className="mt-1 text-xl font-semibold sm:text-2xl">
                Site Accounts · Account Tracker
              </h3>

              <p className="mt-1 text-sm text-slate-300">
                Nazim: {data?.department.nazim_name ?? "—"}
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${status.classes}`}
            >
              {status.label}
            </span>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {formatDate(reportDate)}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Daily deadline: 20:00 · Europe/London
                {data?.report?.submitted_at
                  ? ` · Submitted ${formatTime(
                      data.report.submitted_at
                    )}`
                  : ""}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Previous day"
                onClick={() => changeReportDate(addDays(reportDate, -1))}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ←
              </button>

              <input
                type="date"
                value={reportDate}
                onChange={(event) =>
                  changeReportDate(event.target.value)
                }
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"
              />

              <button
                type="button"
                aria-label="Next day"
                onClick={() => changeReportDate(addDays(reportDate, 1))}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:px-6">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 sm:px-6">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading Site Accounts tracker…
          </div>
        ) : (
          <div className="space-y-6 p-4 sm:p-6">
            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                1 · Budget
              </p>

              <h4 className="mt-1 text-base font-semibold text-slate-950">
                Total Budget Amount
              </h4>

              <div className="mt-3 max-w-sm">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">
                    £
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={form.total_budget}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        total_budget: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                    className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-4 text-lg font-semibold text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              </div>
            </section>

            <section className="border-t border-slate-200 pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                2 · Departmental Expenses
              </p>

              <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <h4 className="text-base font-semibold text-slate-950">
                  Expense Position by Department
                </h4>

                <p className="text-xs text-slate-500">
                  Enter £0 where there is no amount.
                </p>
              </div>

              <div className="mt-4 space-y-3 lg:hidden">
                {SITE_ACCOUNTS_EXPENSE_DEPARTMENTS.map(
                  (department) => {
                    const entry =
                      form.departmental_expenses[department.id];

                    return (
                      <div
                        key={department.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {department.name}
                        </p>

                        <div className="mt-3">
                          <label className="block">
                            <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">
                              Amount Paid
                            </span>

                            <MoneyInput
                              value={entry?.paid ?? "0"}
                              ariaLabel={`${department.name} Amount Paid`}
                              onChange={(value) =>
                                updateExpense(
                                  department.id,
                                  "paid",
                                  value
                                )
                              }
                            />
                          </label>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-slate-200 lg:block">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="sticky left-0 z-10 w-[320px] bg-slate-100 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Department
                      </th>

                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Amount Paid
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100 bg-white">
                    {SITE_ACCOUNTS_EXPENSE_DEPARTMENTS.map(
                      (department) => {
                        const entry =
                          form.departmental_expenses[department.id];

                        return (
                          <tr key={department.id}>
                            <td className="sticky left-0 z-10 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
                              {department.name}
                            </td>

                            <td className="min-w-[180px] px-4 py-2">
                              <MoneyInput
                                value={entry?.paid ?? "0"}
                                ariaLabel={`${department.name} Amount Paid`}
                                onChange={(value) =>
                                  updateExpense(
                                    department.id,
                                    "paid",
                                    value
                                  )
                                }
                              />
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="border-t border-slate-200 pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                3–5 · Automatic Summary
              </p>

              <h4 className="mt-1 text-base font-semibold text-slate-950">
                Account Summary
              </h4>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Total Budget
                  </p>

                  <p className="mt-2 text-xl font-bold text-slate-950">
                    {form.total_budget.trim() === ""
                      ? "—"
                      : formatMoney(
                          toMoneyNumber(form.total_budget)
                        )}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    Total Expenses Paid
                  </p>

                  <p className="mt-2 text-xl font-bold text-emerald-800">
                    {formatMoney(totals.paid)}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                    Total Remaining Amount
                  </p>

                  <p className="mt-2 text-xl font-bold text-blue-800">
                    {formatMoney(totals.remaining)}
                  </p>

                  <p className="mt-1 text-[11px] leading-4 text-blue-700">
                    Approved expenses not yet cleared / paid.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Total Pending Approval
                  </p>

                  <p className="mt-2 text-xl font-bold text-amber-900">
                    {formatMoney(totals.pendingApproval)}
                  </p>
                </div>
              </div>
            </section>

            <section className="border-t border-slate-200 pt-6">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  Signature — Name &amp; AIMS ID
                </span>

                <input
                  type="text"
                  value={form.signature_name_aims_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      signature_name_aims_id: event.target.value,
                    }))
                  }
                  placeholder="Full name and AIMS ID"
                  className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </label>
            </section>
          </div>
        )}

        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:flex sm:items-center sm:justify-between sm:px-6">
          <p className="mb-3 text-xs text-slate-500 sm:mb-0">
            {data?.report?.submitted_at
              ? "Already submitted. Later edits preserve the original submission time."
              : "Save Draft does not count as official submission."}
          </p>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              type="button"
              disabled={saving || submitting || loading}
              onClick={() => void saveDraft()}
              className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>

            <button
              type="button"
              disabled={saving || submitting || loading}
              onClick={() => void submitReport()}
              className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {submitting
                ? "Submitting…"
                : data?.report?.submitted_at
                  ? "Save Changes"
                  : "Submit Tracker"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <h3 className="font-semibold text-slate-950">
            Site Accounts History
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Recent account tracker submissions and drafts.
          </p>
        </div>

        {recentHistory.length === 0 ? (
          <div className="p-7 text-center text-sm text-slate-500">
            No previous Site Accounts reports are available yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentHistory.map((item) => {
              const historyStatus = statusInfo(item.status);

              const historyTotals = item.custom_answers
                ? getSiteAccountsTotals(item.custom_answers)
                : null;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    changeReportDate(item.report_date)
                  }
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-slate-50 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(item.report_date)}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {historyTotals
                        ? `Paid ${formatMoney(
                            historyTotals.paid
                          )} · Remaining ${formatMoney(
                            historyTotals.remaining
                          )}`
                        : "Draft started"}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${historyStatus.classes}`}
                  >
                    {historyStatus.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
