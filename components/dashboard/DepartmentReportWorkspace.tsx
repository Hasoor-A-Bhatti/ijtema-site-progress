"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

interface DepartmentSessionView {
  role: "department";
  departmentId: string;
  departmentName: string;
  nazimName: string;
}

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
  team_members_on_site: number | null;
  total_manhours: number | null;
  todays_activities: string;
  incidents_delays: string;
  work_proposed_tomorrow: string;
  additional_comments: string;
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

interface FormState {
  team_members_on_site: string;
  total_manhours: string;
  todays_activities: string;
  incidents_delays: string;
  work_proposed_tomorrow: string;
  additional_comments: string;
  signature_name_aims_id: string;
}

interface DepartmentReportWorkspaceProps {
  session: DepartmentSessionView;
  onSessionExpired: () => void;
}

const EMPTY_FORM: FormState = {
  team_members_on_site: "",
  total_manhours: "",
  todays_activities: "",
  incidents_delays: "",
  work_proposed_tomorrow: "",
  additional_comments: "",
  signature_name_aims_id: "",
};

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
    timeZone: "Europe/London",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDateLong(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(`${value}T12:00:00Z`));
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

function reportToForm(report: DepartmentReportRow | null): FormState {
  if (!report) return { ...EMPTY_FORM };

  return {
    team_members_on_site:
      report.team_members_on_site === null
        ? ""
        : String(report.team_members_on_site),
    total_manhours:
      report.total_manhours === null
        ? ""
        : String(report.total_manhours),
    todays_activities: report.todays_activities ?? "",
    incidents_delays: report.incidents_delays ?? "",
    work_proposed_tomorrow: report.work_proposed_tomorrow ?? "",
    additional_comments: report.additional_comments ?? "",
    signature_name_aims_id: report.signature_name_aims_id ?? "",
  };
}

function formPayload(form: FormState) {
  return {
    team_members_on_site:
      form.team_members_on_site.trim() === ""
        ? null
        : Number(form.team_members_on_site),
    total_manhours:
      form.total_manhours.trim() === ""
        ? null
        : Number(form.total_manhours),
    todays_activities: form.todays_activities,
    incidents_delays: form.incidents_delays,
    work_proposed_tomorrow: form.work_proposed_tomorrow,
    additional_comments: form.additional_comments,
    signature_name_aims_id: form.signature_name_aims_id,
  };
}

export default function DepartmentReportWorkspace({
  session,
  onSessionExpired,
}: DepartmentReportWorkspaceProps) {
  const today = getLondonDateString();
  const [reportDate, setReportDate] = useState(today);
  const [data, setData] = useState<DepartmentReportResponse | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/reports/${encodeURIComponent(
          session.departmentId
        )}?date=${encodeURIComponent(reportDate)}`,
        {
          cache: "no-store",
        }
      );

      if (response.status === 401 || response.status === 403) {
        onSessionExpired();
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
            : "Report could not be loaded."
        );
      }

      setData(body);
      setForm(reportToForm(body.report));
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Report could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [onSessionExpired, reportDate, session.departmentId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadReport();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [loadReport]);

  const status = statusInfo(data?.status ?? "pending");
  const completedFields = data?.completedFields ?? 0;
  const totalFields = data?.totalFields ?? 7;
  const completionPercent = Math.round(
    (completedFields / Math.max(totalFields, 1)) * 100
  );

  const recentHistory = useMemo(
    () => data?.history.slice(0, 7) ?? [],
    [data]
  );

  async function saveDraft() {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/reports/${encodeURIComponent(
          session.departmentId
        )}?date=${encodeURIComponent(reportDate)}`,
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
        onSessionExpired();
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!response.ok || !body?.success) {
        throw new Error(body?.error ?? "Report could not be saved.");
      }

      setSuccessMessage(
        data?.report?.submitted_at
          ? "Report changes saved. The original submission time has been preserved."
          : "Draft saved successfully."
      );

      await loadReport();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Report could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitReport() {
    const confirmed = window.confirm(
      data?.report?.submitted_at
        ? "Save these changes to your already submitted report? The original submission time will remain unchanged."
        : "Submit this report? Please confirm all seven fields are complete."
    );

    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/reports/${encodeURIComponent(
          session.departmentId
        )}/submit?date=${encodeURIComponent(reportDate)}`,
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
        onSessionExpired();
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; alreadySubmitted?: boolean; error?: string }
        | null;

      if (!response.ok || !body?.success) {
        throw new Error(body?.error ?? "Report could not be submitted.");
      }

      setSuccessMessage(
        body.alreadySubmitted
          ? "Report updated successfully. Your original submission time has been preserved."
          : "Report submitted successfully."
      );

      await loadReport();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Report could not be submitted."
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
                {session.departmentName}
              </h3>

              <p className="mt-1 text-sm text-slate-300">
                Nazim: {session.nazimName}
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${status.classes}`}
            >
              {status.label}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
          <div className="bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Completion
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {loading ? "—" : `${completedFields}/${totalFields}`}
            </p>
          </div>

          <div className="bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Progress
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-950">
              {loading ? "—" : `${completionPercent}%`}
            </p>
          </div>

          <div className="bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Deadline
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-950">20:00</p>
          </div>

          <div className="bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Status
            </p>
            <p className="mt-1 text-lg font-bold text-slate-950">
              {loading ? "—" : status.shortLabel}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-950">Report Date</h3>
            <p className="mt-1 text-sm text-slate-500">
              {formatDateLong(reportDate)}
            </p>
          </div>

          <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-2 sm:flex">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setReportDate(addDays(reportDate, -1))}
              className="flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg text-slate-700 hover:bg-slate-50 sm:w-11"
            >
              ←
            </button>

            <input
              type="date"
              value={reportDate}
              max={today}
              onChange={(event) =>
                event.target.value && setReportDate(event.target.value)
              }
              className="h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />

            <button
              type="button"
              aria-label="Next day"
              disabled={reportDate >= today}
              onClick={() => setReportDate(addDays(reportDate, 1))}
              className="flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg text-slate-700 hover:bg-slate-50 disabled:opacity-35 sm:w-11"
            >
              →
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      )}

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-950">Daily Report</h3>
              <p className="mt-1 text-sm text-slate-500">
                Complete all seven fields before official submission.
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {completedFields}/{totalFields} complete
            </span>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900 transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading report…
          </div>
        ) : (
          <div className="space-y-5 p-4 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  Team Members on Site
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={form.team_members_on_site}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      team_members_on_site: event.target.value,
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder="e.g. 12"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">
                  Total Manhours
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  value={form.total_manhours}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      total_manhours: event.target.value,
                    }))
                  }
                  className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  placeholder="e.g. 84"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-slate-800">
                Today&apos;s Activities
              </span>
              <textarea
                rows={5}
                value={form.todays_activities}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    todays_activities: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Summarise work completed today…"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-800">
                Incidents / Delays
              </span>
              <textarea
                rows={4}
                value={form.incidents_delays}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    incidents_delays: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder='Enter "None" if there were no incidents or delays.'
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-800">
                Work Proposed for Tomorrow
              </span>
              <textarea
                rows={4}
                value={form.work_proposed_tomorrow}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    work_proposed_tomorrow: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Outline tomorrow's planned work…"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-800">
                Additional Comments / Highlights
              </span>
              <textarea
                rows={4}
                value={form.additional_comments}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    additional_comments: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder='Enter "None" if there are no additional comments.'
              />
            </label>

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
                className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                placeholder="Full name and AIMS ID"
              />
            </label>
          </div>
        )}

        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:flex sm:items-center sm:justify-between sm:px-6">
          <p className="mb-3 text-xs text-slate-500 sm:mb-0">
            {data?.report?.submitted_at
              ? "This report has already been submitted. Later edits keep the original submission time."
              : "Saving a draft does not count as official submission."}
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
                  : "Submit Report"}
            </button>
          </div>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
          <h3 className="font-semibold text-slate-950">My Report History</h3>
          <p className="mt-1 text-sm text-slate-500">
            Recent reporting history for {session.departmentName} only.
          </p>
        </div>

        {recentHistory.length === 0 ? (
          <div className="p-7 text-center text-sm text-slate-500">
            No previous reports are available yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentHistory.map((item) => {
              const historyStatus = statusInfo(item.status);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setReportDate(item.report_date)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-slate-50 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatDate(item.report_date)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.completedFields}/{item.totalFields} fields complete
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
