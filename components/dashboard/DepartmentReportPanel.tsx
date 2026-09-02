"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  DepartmentReport,
  ReportDepartment,
  ReportFormValues,
  ReportStatus,
} from "@/types/reports";

interface HistoryEntry {
  report:
    DepartmentReport;

  status:
    ReportStatus;
}

interface DepartmentReportResponse {
  success: true;

  department:
    ReportDepartment;

  report:
    | DepartmentReport
    | null;

  reportDate:
    string;

  status:
    ReportStatus;

  deadlineAt:
    string;

  completedFields:
    number;

  totalFields:
    number;

  history:
    HistoryEntry[];
}

interface DepartmentReportPanelProps {
  departmentId:
    string;

  reportDate:
    string;

  onClose:
    () => void;

  onOpenDate:
    (
      date:
        string
    ) => void;

  onReportChanged:
    () => void;
}

const EMPTY_VALUES: ReportFormValues =
  {
    team_members_on_site:
      null,

    total_manhours:
      null,

    todays_activities:
      "",

    incidents_delays:
      "",

    work_proposed_tomorrow:
      "",

    additional_comments:
      "",

    signature_name_aims_id:
      "",
  };

function toFormValues(
  report:
    | DepartmentReport
    | null
): ReportFormValues {
  if (!report) {
    return {
      ...EMPTY_VALUES,
    };
  }

  return {
    team_members_on_site:
      report.team_members_on_site,

    total_manhours:
      report.total_manhours,

    todays_activities:
      report.todays_activities ??
      "",

    incidents_delays:
      report.incidents_delays ??
      "",

    work_proposed_tomorrow:
      report.work_proposed_tomorrow ??
      "",

    additional_comments:
      report.additional_comments ??
      "",

    signature_name_aims_id:
      report.signature_name_aims_id ??
      "",
  };
}

function formatDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "numeric",

      month:
        "long",

      year:
        "numeric",

      timeZone:
        "Europe/London",
    }
  ).format(
    new Date(
      `${date}T12:00:00Z`
    )
  );
}

function formatTime(
  value:
    | string
    | null
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour:
        "2-digit",

      minute:
        "2-digit",

      timeZone:
        "Europe/London",
    }
  ).format(
    new Date(value)
  );
}

function getStatusPresentation(
  status:
    ReportStatus
) {
  switch (
    status
  ) {
    case "completed":
      return {
        label:
          "On Time",

        classes:
          "bg-emerald-50 text-emerald-700",
      };

    case "late":
      return {
        label:
          "Late",

        classes:
          "bg-amber-50 text-amber-700",
      };

    case "overdue":
      return {
        label:
          "Overdue",

        classes:
          "bg-red-50 text-red-700",
      };

    default:
      return {
        label:
          "Pending",

        classes:
          "bg-blue-50 text-blue-700",
      };
  }
}

export default function DepartmentReportPanel({
  departmentId,
  reportDate,
  onClose,
  onOpenDate,
  onReportChanged,
}: DepartmentReportPanelProps) {
  const [
    data,
    setData,
  ] =
    useState<DepartmentReportResponse | null>(
      null
    );

  const [
    values,
    setValues,
  ] =
    useState<ReportFormValues>(
      EMPTY_VALUES
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null
    );

  const loadReport =
    useCallback(
      async () => {
        try {
          setError(
            null
          );

          const response =
            await fetch(
              `/api/reports/${encodeURIComponent(
                departmentId
              )}?date=${encodeURIComponent(
                reportDate
              )}`,
              {
                cache:
                  "no-store",
              }
            );

          const result =
            (await response
              .json()
              .catch(
                () => ({})
              )) as
              | DepartmentReportResponse
              | {
                  error?:
                    string;
                };

          if (
            !response.ok
          ) {
            throw new Error(
              "error" in
                  result &&
                result.error
                ? result.error
                : "The department report could not be loaded."
            );
          }

          const reportData =
            result as DepartmentReportResponse;

          setData(
            reportData
          );

          setValues(
            toFormValues(
              reportData.report
            )
          );
        } catch (
          loadError
        ) {
          console.error(
            "Failed to load department report:",
            loadError
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "The department report could not be loaded."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        departmentId,
        reportDate,
      ]
    );

  /*
   * Reload when department/date changes.
   */
  useEffect(() => {
    const timeout =
      window.setTimeout(
        () => {
          setLoading(
            true
          );

          setMessage(
            null
          );

          void loadReport();
        },
        0
      );

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [
    loadReport,
  ]);

  /*
   * Live completion count.
   */
  const completedFields =
    useMemo(() => {
      let total =
        0;

      if (
        values.team_members_on_site !==
        null
      ) {
        total +=
          1;
      }

      if (
        values.total_manhours !==
        null
      ) {
        total +=
          1;
      }

      if (
        values.todays_activities.trim()
      ) {
        total +=
          1;
      }

      if (
        values.incidents_delays.trim()
      ) {
        total +=
          1;
      }

      if (
        values.work_proposed_tomorrow.trim()
      ) {
        total +=
          1;
      }

      if (
        values.additional_comments.trim()
      ) {
        total +=
          1;
      }

      if (
        values.signature_name_aims_id.trim()
      ) {
        total +=
          1;
      }

      return total;
    }, [
      values,
    ]);

  const progress =
    Math.round(
      (
        completedFields /
        7
      ) *
        100
    );

  const readyToSubmit =
    completedFields ===
    7;

  function updateField<
    K extends
      keyof ReportFormValues,
  >(
    key:
      K,

    value:
      ReportFormValues[K]
  ) {
    setValues(
      (
        current
      ) => ({
        ...current,

        [key]:
          value,
      })
    );

    setMessage(
      null
    );
  }

  /*
   * SAVE DRAFT
   */
  async function saveDraft(
    showConfirmation =
      true
  ) {
    setSaving(
      true
    );

    setError(
      null
    );

    setMessage(
      null
    );

    try {
      const response =
        await fetch(
          `/api/reports/${encodeURIComponent(
            departmentId
          )}`,
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  reportDate,

                  ...values,
                }
              ),
          }
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({})
          )) as {
          report?:
            DepartmentReport;

          status?:
            ReportStatus;

          error?:
            string;
        };

      if (
        !response.ok ||
        !result.report
      ) {
        throw new Error(
          result.error ??
            "The report could not be saved."
        );
      }

      const savedReport =
        result.report;

      setData(
        (
          current
        ) =>
          current
            ? {
                ...current,

                report:
                  savedReport,

                status:
                  result.status ??
                  current.status,

                completedFields,

                totalFields:
                  7,
              }
            : current
      );

      if (
        showConfirmation
      ) {
        setMessage(
          savedReport.submitted_at
            ? "Report changes saved."
            : "Draft saved."
        );
      }

      onReportChanged();

      return savedReport;
    } catch (
      saveError
    ) {
      console.error(
        "Failed to save report:",
        saveError
      );

      setError(
        saveError instanceof
          Error
          ? saveError.message
          : "The report could not be saved."
      );

      return null;
    } finally {
      setSaving(
        false
      );
    }
  }

  /*
   * SUBMIT REPORT
   */
  async function submitReport() {
    const departmentName =
      data?.department
        .name ??
      "department";

    if (
      !window.confirm(
        `Submit the ${departmentName} report for ${formatDate(
          reportDate
        )}?\n\nThe original submission time will be permanently recorded.`
      )
    ) {
      return;
    }

    setSubmitting(
      true
    );

    setError(
      null
    );

    setMessage(
      null
    );

    try {
      /*
       * Save the latest form content first.
       */
      const savedReport =
        await saveDraft(
          false
        );

      if (
        !savedReport
      ) {
        return;
      }

      const response =
        await fetch(
          `/api/reports/${encodeURIComponent(
            departmentId
          )}/submit`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  reportDate,
                }
              ),
          }
        );

      const result =
        (await response
          .json()
          .catch(
            () => ({})
          )) as {
          report?:
            DepartmentReport;

          status?:
            ReportStatus;

          error?:
            string;

          alreadySubmitted?:
            boolean;
        };

      if (
        !response.ok ||
        !result.report
      ) {
        throw new Error(
          result.error ??
            "The report could not be submitted."
        );
      }

      const submittedReport =
        result.report;

      setData(
        (
          current
        ) =>
          current
            ? {
                ...current,

                report:
                  submittedReport,

                status:
                  result.status ??
                  current.status,

                completedFields:
                  7,

                totalFields:
                  7,
              }
            : current
      );

      if (
        result.status ===
        "late"
      ) {
        setMessage(
          "Report submitted successfully and recorded as late."
        );
      } else {
        setMessage(
          "Report submitted successfully and recorded as on time."
        );
      }

      onReportChanged();
    } catch (
      submitError
    ) {
      console.error(
        "Failed to submit report:",
        submitError
      );

      setError(
        submitError instanceof
          Error
          ? submitError.message
          : "The report could not be submitted."
      );
    } finally {
      setSubmitting(
        false
      );
    }
  }

  if (
    loading
  ) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Loading
        department
        report...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error ??
          "The report could not be loaded."}
      </div>
    );
  }

  const statusPresentation =
    getStatusPresentation(
      data.status
    );

  const submitted =
    Boolean(
      data.report
        ?.submitted_at
    );

  return (
    <div className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* REPORT HEADER */}
      <div className="rounded-t-2xl border-b border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-xs">
              Daily Site
              Report
            </p>

            <h3 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">
              {
                data
                  .department
                  .name
              }
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              Nazim:{" "}
              <span className="font-semibold text-slate-800">
                {
                  data
                    .department
                    .nazim_name
                }
              </span>
            </p>

            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              {formatDate(
                reportDate
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-start gap-2">
            <span
              className={`rounded-full px-2.5 py-1.5 text-xs font-semibold sm:px-3 ${statusPresentation.classes}`}
            >
              {
                statusPresentation.label
              }
            </span>

            {/* Desktop close.
                Mobile already has "All Departments".
            */}
            <button
              type="button"
              onClick={
                onClose
              }
              aria-label="Close report"
              className="hidden h-10 w-10 items-center justify-center rounded-lg text-xl text-slate-500 transition hover:bg-slate-200 xl:flex"
            >
              ×
            </button>
          </div>
        </div>

        {/* COMPLETION */}
        <div className="mt-4 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">
            Report
            completion
          </span>

          <span className="font-semibold text-slate-900">
            {
              completedFields
            }
            /7
          </span>
        </div>

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-slate-800 transition-all"
            style={{
              width:
                `${progress}%`,
            }}
          />
        </div>

        {submitted && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="text-slate-500">
                Official
                submission
              </span>

              <span className="font-semibold text-slate-900">
                {formatTime(
                  data.report
                    ?.submitted_at ??
                    null
                )}
              </span>
            </div>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              Original
              submission
              time is
              preserved if
              the report is
              edited later.
            </p>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {/* ERROR */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* SUCCESS */}
        {message && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        {/* AUTO METADATA */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-medium text-slate-400 sm:text-xs">
              Date
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-900 sm:text-sm">
              {formatDate(
                reportDate
              )}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-medium text-slate-400 sm:text-xs">
              Department
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-900 sm:text-sm">
              {
                data
                  .department
                  .name
              }
            </p>
          </div>

          <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-1">
            <p className="text-[11px] font-medium text-slate-400 sm:text-xs">
              Nazim
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-900 sm:text-sm">
              {
                data
                  .department
                  .nazim_name
              }
            </p>
          </div>
        </div>

        {/* WORKFORCE */}
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Workforce
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Team Members
                on Site
              </span>

              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={
                  values.team_members_on_site ??
                  ""
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "team_members_on_site",

                    event.target
                      .value ===
                      ""
                      ? null
                      : Number(
                          event
                            .target
                            .value
                        )
                  )
                }
                className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Total
                Manhours
              </span>

              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.5"
                value={
                  values.total_manhours ??
                  ""
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "total_manhours",

                    event.target
                      .value ===
                      ""
                      ? null
                      : Number(
                          event
                            .target
                            .value
                        )
                  )
                }
                className="mt-2 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>
        </div>

        {/* DAILY UPDATE */}
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
            Daily Update
          </p>

          <div className="mt-3 grid gap-5">
            <label>
              <span className="text-sm font-semibold text-slate-700">
                Today&apos;s
                Activities
              </span>

              <textarea
                rows={5}
                value={
                  values.todays_activities
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "todays_activities",
                    event.target
                      .value
                  )
                }
                placeholder="Summarise the department's work completed today..."
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-700">
                Incidents /
                Delays
              </span>

              <textarea
                rows={4}
                value={
                  values.incidents_delays
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "incidents_delays",
                    event.target
                      .value
                  )
                }
                placeholder="Record incidents, delays or blockers. Enter 'None' if there were none."
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-700">
                Work Proposed
                for Tomorrow
              </span>

              <textarea
                rows={4}
                value={
                  values.work_proposed_tomorrow
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "work_proposed_tomorrow",
                    event.target
                      .value
                  )
                }
                placeholder="Set out the department's planned work for tomorrow..."
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label>
              <span className="text-sm font-semibold text-slate-700">
                Additional
                Comments /
                Highlights
              </span>

              <textarea
                rows={4}
                value={
                  values.additional_comments
                }
                onChange={(
                  event
                ) =>
                  updateField(
                    "additional_comments",
                    event.target
                      .value
                  )
                }
                placeholder="Record achievements, concerns or additional highlights. Enter 'None' if not applicable."
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-base leading-6 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>
        </div>

        {/* SIGNATURE */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-white">
              ✓
            </div>

            <div className="min-w-0 flex-1">
              <label className="block">
                <span className="text-sm font-semibold text-slate-900">
                  Signature —
                  Enter Name
                  &amp; AIMS ID
                </span>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Enter your
                  full name
                  and AIMS ID
                  to confirm
                  responsibility
                  for this
                  report.
                </p>

                <input
                  type="text"
                  value={
                    values.signature_name_aims_id
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "signature_name_aims_id",
                      event.target
                        .value
                    )
                  }
                  placeholder="Full Name — AIMS ID"
                  autoComplete="off"
                  className="mt-3 h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </label>

              <p className="mt-2 text-xs text-slate-400">
                Required for
                official
                submission.
                It may remain
                blank while
                saving a draft.
              </p>
            </div>
          </div>
        </div>

        {/* MOBILE STICKY ACTION BAR */}
        <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-y border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:static sm:mx-0 sm:border-x-0 sm:border-b-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pt-5 sm:shadow-none sm:backdrop-blur-none">
          <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
            <p className="text-xs text-slate-500">
              {submitted
                ? "Official report submitted"
                : `${completedFields} of 7 required fields completed`}
            </p>

            {!submitted && (
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  readyToSubmit
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {readyToSubmit
                  ? "Ready"
                  : `${progress}%`}
              </span>
            )}
          </div>

          <div
            className={`grid gap-2 sm:flex sm:justify-end sm:gap-3 ${
              submitted
                ? "grid-cols-1"
                : "grid-cols-2"
            }`}
          >
            <button
              type="button"
              disabled={
                saving ||
                submitting
              }
              onClick={() =>
                void saveDraft()
              }
              className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:px-5"
            >
              {saving
                ? "Saving..."
                : submitted
                  ? "Save Changes"
                  : "Save Draft"}
            </button>

            {!submitted && (
              <button
                type="button"
                disabled={
                  saving ||
                  submitting ||
                  !readyToSubmit
                }
                onClick={() =>
                  void submitReport()
                }
                className="min-h-12 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 active:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 sm:min-h-11 sm:px-5"
              >
                {submitting
                  ? "Submitting..."
                  : "Submit Report"}
              </button>
            )}
          </div>
        </div>

        {/* HISTORY */}
        <div className="mt-8 border-t border-slate-200 pt-5">
          <div>
            <h4 className="font-semibold text-slate-900">
              Report History
            </h4>

            <p className="mt-1 text-sm text-slate-500">
              Previous
              reports for
              this
              department.
            </p>
          </div>

          {data.history.length ===
          0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                No previous
                reports have
                been
                recorded.
              </p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {data.history
                .slice(
                  0,
                  10
                )
                .map(
                  ({
                    report,
                    status,
                  }) => {
                    const historyStatus =
                      getStatusPresentation(
                        status
                      );

                    return (
                      <button
                        key={
                          report.id
                        }
                        type="button"
                        onClick={() =>
                          onOpenDate(
                            report.report_date
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatDate(
                              report.report_date
                            )}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {report.submitted_at
                              ? `Submitted ${formatTime(
                                  report.submitted_at
                                )}`
                              : "Draft / not submitted"}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${historyStatus.classes}`}
                          >
                            {
                              historyStatus.label
                            }
                          </span>

                          <span className="text-sm text-slate-400">
                            →
                          </span>
                        </div>
                      </button>
                    );
                  }
                )}
            </div>
          )}
        </div>

        {/*
         * Extra space on mobile so the final
         * history row isn't cramped against
         * the bottom of the dashboard.
         */}
        <div className="h-4 sm:hidden" />
      </div>
    </div>
  );
}