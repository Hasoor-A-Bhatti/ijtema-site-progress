"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import DepartmentReportPanel from "./DepartmentReportPanel";

import {
  getLondonDateString,
} from "@/hooks/useSiteReports";

import type {
  SiteReportsData,
} from "@/hooks/useSiteReports";

import type {
  ReportStatus,
} from "@/types/reports";

type StatusFilter =
  | "all"
  | ReportStatus;

interface SiteReportsProps {
  reportDate: string;
  data: SiteReportsData | null;
  loading: boolean;
  error: string | null;
  onDateChange: (date: string) => void;
  onRefresh: () => Promise<void>;
}

const STATUS_FILTERS: Array<{
  value: StatusFilter;
  label: string;
}> = [
  {
    value: "all",
    label: "All",
  },
  {
    value: "pending",
    label: "Pending",
  },
  {
    value: "overdue",
    label: "Overdue",
  },
  {
    value: "late",
    label: "Late",
  },
  {
    value: "completed",
    label: "On Time",
  },
];

function addDays(
  date: string,
  amount: number
) {
  const [
    year,
    month,
    day,
  ] =
    date
      .split("-")
      .map(Number);

  const value =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + amount
      )
    );

  return [
    value.getUTCFullYear(),
    String(
      value.getUTCMonth() +
        1
    ).padStart(
      2,
      "0"
    ),
    String(
      value.getUTCDate()
    ).padStart(
      2,
      "0"
    ),
  ].join("-");
}

function formatDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
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
    | undefined
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
      timeZone:
        "Europe/London",
    }
  ).format(
    new Date(value)
  );
}

function getStatusPresentation(
  status: ReportStatus
) {
  switch (status) {
    case "completed":
      return {
        label: "On Time",
        dot:
          "bg-emerald-500",
        classes:
          "bg-emerald-50 text-emerald-700",
      };

    case "late":
      return {
        label: "Late",
        dot:
          "bg-amber-500",
        classes:
          "bg-amber-50 text-amber-700",
      };

    case "overdue":
      return {
        label:
          "Overdue",
        dot:
          "bg-red-500",
        classes:
          "bg-red-50 text-red-700",
      };

    default:
      return {
        label:
          "Pending",
        dot:
          "bg-blue-500",
        classes:
          "bg-blue-50 text-blue-700",
      };
  }
}

export default function SiteReports({
  reportDate,
  data,
  loading,
  error,
  onDateChange,
  onRefresh,
}: SiteReportsProps) {
  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>(
      "all"
    );

  const [
    selectedDepartmentId,
    setSelectedDepartmentId,
  ] =
    useState<string | null>(
      null
    );

  const [
    now,
    setNow,
  ] =
    useState(
      new Date()
    );

  const reportPanelRef =
    useRef<HTMLDivElement | null>(
      null
    );

  /*
   * Keep the deadline countdown
   * reasonably fresh.
   */
  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          setNow(
            new Date()
          );
        },
        30000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, []);

  /*
   * When a department is selected on mobile,
   * bring the report workspace straight into view.
   */
  useEffect(() => {
    if (
      !selectedDepartmentId
    ) {
      return;
    }

    const timeout =
      window.setTimeout(
        () => {
          reportPanelRef.current
            ?.scrollIntoView({
              behavior:
                "smooth",
              block:
                "start",
            });
        },
        50
      );

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [
    selectedDepartmentId,
  ]);

  const today =
    getLondonDateString();

  const filteredDepartments =
    useMemo(() => {
      if (!data) {
        return [];
      }

      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return data.departments.filter(
        (item) => {
          const matchesSearch =
            !normalizedSearch ||
            item.department.name
              .toLowerCase()
              .includes(
                normalizedSearch
              ) ||
            item.department.nazim_name
              .toLowerCase()
              .includes(
                normalizedSearch
              );

          const matchesStatus =
            statusFilter ===
              "all" ||
            item.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      data,
      search,
      statusFilter,
    ]);

  const submittedPercentage =
    data &&
    data.totalDepartments >
      0
      ? Math.round(
          (
            data.submitted /
            data.totalDepartments
          ) *
            100
        )
      : 0;

  let deadlineMessage =
    "Deadline 20:00";

  let deadlineClasses =
    "bg-slate-100 text-slate-700";

  if (data) {
    const difference =
      new Date(
        data.deadlineAt
      ).getTime() -
      now.getTime();

    if (
      difference > 0
    ) {
      const hours =
        Math.floor(
          difference /
            3600000
        );

      const minutes =
        Math.floor(
          (
            difference %
            3600000
          ) /
            60000
        );

      deadlineMessage =
        hours > 0
          ? `${hours}h ${minutes}m remaining`
          : `${minutes}m remaining`;

      deadlineClasses =
        difference <=
        3600000
          ? "bg-amber-50 text-amber-700"
          : "bg-blue-50 text-blue-700";
    } else {
      const outstanding =
        data.summary
          .overdue;

      deadlineMessage =
        outstanding >
        0
          ? `Deadline passed · ${outstanding} outstanding`
          : "Deadline passed · all submitted";

      deadlineClasses =
        outstanding >
        0
          ? "bg-red-50 text-red-700"
          : "bg-emerald-50 text-emerald-700";
    }
  }

  const selectedDepartment =
    data?.departments.find(
      (item) =>
        item.department
          .id ===
        selectedDepartmentId
    );

  return (
    <div className="p-3 sm:p-6">
      {/* REPORTING HEADER */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Daily Reporting
            </p>

            <h3 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">
              {formatDate(
                reportDate
              )}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Department
              reports due by
              20:00.
            </p>
          </div>

          {/* DATE CONTROLS */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() =>
                onDateChange(
                  addDays(
                    reportDate,
                    -1
                  )
                )
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg text-slate-700 transition hover:bg-slate-50"
            >
              ←
            </button>

            <input
              type="date"
              value={
                reportDate
              }
              max={today}
              onChange={(
                event
              ) => {
                if (
                  event.target
                    .value
                ) {
                  onDateChange(
                    event
                      .target
                      .value
                  );
                }
              }}
              className="h-11 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-2 text-sm font-medium text-slate-700 sm:flex-none sm:px-3 sm:text-base"
            />

            <button
              type="button"
              aria-label="Next day"
              disabled={
                reportDate >=
                today
              }
              onClick={() =>
                onDateChange(
                  addDays(
                    reportDate,
                    1
                  )
                )
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-lg text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
            >
              →
            </button>

            {reportDate !==
              today && (
              <button
                type="button"
                onClick={() =>
                  onDateChange(
                    today
                  )
                }
                className="hidden h-11 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white sm:block"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {reportDate !==
          today && (
          <button
            type="button"
            onClick={() =>
              onDateChange(
                today
              )
            }
            className="mt-3 h-10 w-full rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white sm:hidden"
          >
            Return to Today
          </button>
        )}

        {error ? (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void onRefresh()
              }
              className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* REPORTING POSITION */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
              {/* SUBMITTED */}
              <div className="col-span-2 rounded-xl bg-slate-950 p-4 text-white xl:col-span-1">
                <div className="flex items-end justify-between gap-3 xl:block">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Submitted
                    </p>

                    <p className="mt-1 text-3xl font-bold">
                      {loading
                        ? "—"
                        : `${
                            data?.submitted ??
                            0
                          }/${
                            data?.totalDepartments ??
                            19
                          }`}
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-slate-300 xl:mt-1 xl:text-xs xl:font-normal xl:text-slate-400">
                    {
                      submittedPercentage
                    }
                    % complete
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 p-3.5 text-emerald-700 sm:p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                  On Time
                </p>

                <p className="mt-1 text-2xl font-bold sm:mt-2 sm:text-3xl">
                  {loading
                    ? "—"
                    : data
                        ?.summary
                        .completed ??
                      0}
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-3.5 text-blue-700 sm:p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                  Pending
                </p>

                <p className="mt-1 text-2xl font-bold sm:mt-2 sm:text-3xl">
                  {loading
                    ? "—"
                    : data
                        ?.summary
                        .pending ??
                      0}
                </p>
              </div>

              <div className="rounded-xl bg-red-50 p-3.5 text-red-700 sm:p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                  Overdue
                </p>

                <p className="mt-1 text-2xl font-bold sm:mt-2 sm:text-3xl">
                  {loading
                    ? "—"
                    : data
                        ?.summary
                        .overdue ??
                      0}
                </p>
              </div>

              <div className="rounded-xl bg-amber-50 p-3.5 text-amber-700 sm:p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                  Late
                </p>

                <p className="mt-1 text-2xl font-bold sm:mt-2 sm:text-3xl">
                  {loading
                    ? "—"
                    : data
                        ?.summary
                        .late ??
                      0}
                </p>
              </div>
            </div>

            {/* DEADLINE */}
            <div className="mt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${deadlineClasses}`}
                >
                  {
                    deadlineMessage
                  }
                </span>

                <span className="text-xs font-medium text-slate-500">
                  Deadline:
                  20:00
                </span>
              </div>

              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-950 transition-all"
                  style={{
                    width:
                      `${submittedPercentage}%`,
                  }}
                />
              </div>
            </div>
          </>
        )}
      </section>

      {/* DEPARTMENT AREA */}
      <section className="mt-4 sm:mt-5">
        {/* LIST HEADER + FILTERS
            Hidden on mobile while a report is open.
            Still visible beside the report on XL screens.
        */}
        <div
          className={`flex-col gap-3 xl:flex xl:flex-row xl:items-end xl:justify-between ${
            selectedDepartmentId
              ? "hidden"
              : "flex"
          }`}
        >
          <div>
            <h3 className="font-semibold text-slate-950">
              Department
              Reports
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Select a
              department to
              complete or
              review its
              report.
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <input
              type="search"
              value={search}
              onChange={(
                event
              ) =>
                setSearch(
                  event.target
                    .value
                )
              }
              placeholder="Search department or Nazim..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 xl:w-[280px]"
            />

            {/* Horizontal scroll is much cleaner
                than wrapping five filters on phones.
            */}
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="flex w-max gap-1 rounded-xl bg-slate-100 p-1">
                {STATUS_FILTERS.map(
                  (
                    filter
                  ) => (
                    <button
                      key={
                        filter.value
                      }
                      type="button"
                      onClick={() =>
                        setStatusFilter(
                          filter.value
                        )
                      }
                      className={`min-h-9 shrink-0 rounded-lg px-3 text-xs font-semibold transition ${
                        statusFilter ===
                        filter.value
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {
                        filter.label
                      }
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          className={`mt-4 grid gap-5 ${
            selectedDepartmentId
              ? "xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.4fr)]"
              : ""
          }`}
        >
          {/* DEPARTMENT LIST
              Mobile:
              hidden as soon as report opens.

              Desktop:
              stays visible on the left.
          */}
          <div
            className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${
              selectedDepartmentId
                ? "hidden xl:block"
                : "block"
            }`}
          >
            {loading ? (
              <div className="p-10 text-center text-sm text-slate-500">
                Loading
                department
                reports...
              </div>
            ) : filteredDepartments.length ===
              0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No matching
                  departments
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Try a
                  different
                  search or
                  status
                  filter.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredDepartments.map(
                  (
                    item
                  ) => {
                    const presentation =
                      getStatusPresentation(
                        item.status
                      );

                    const draftStarted =
                      Boolean(
                        item.report
                      ) &&
                      !item
                        .report
                        ?.submitted_at;

                    const progress =
                      Math.round(
                        (
                          item.completedFields /
                          item.totalFields
                        ) *
                          100
                      );

                    return (
                      <button
                        key={
                          item
                            .department
                            .id
                        }
                        type="button"
                        onClick={() =>
                          setSelectedDepartmentId(
                            item
                              .department
                              .id
                          )
                        }
                        className={`w-full px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5 ${
                          selectedDepartmentId ===
                          item
                            .department
                            .id
                            ? "bg-slate-50"
                            : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {
                                item
                                  .department
                                  .name
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-500">
                              Nazim:{" "}
                              {
                                item
                                  .department
                                  .nazim_name
                              }
                            </p>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${presentation.classes}`}
                          >
                            {
                              presentation.label
                            }
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 text-xs">
                          <span className="text-slate-500">
                            {item
                              .report
                              ?.submitted_at
                              ? `Submitted ${formatTime(
                                  item
                                    .report
                                    .submitted_at
                                )}`
                              : draftStarted
                                ? `Draft ${item.completedFields}/${item.totalFields}`
                                : "Not started"}
                          </span>

                          <span className="shrink-0 font-semibold text-slate-500">
                            Open →
                          </span>
                        </div>

                        {draftStarted && (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all"
                              style={{
                                width:
                                  `${progress}%`,
                              }}
                            />
                          </div>
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* SELECTED REPORT */}
          {selectedDepartmentId && (
            <div
              ref={
                reportPanelRef
              }
              className="min-w-0 scroll-mt-3"
            >
              {/* MOBILE REPORT NAVIGATION */}
              <div className="mb-3 xl:hidden">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedDepartmentId(
                      null
                    )
                  }
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left shadow-sm transition active:bg-slate-50"
                >
                  <span className="text-lg text-slate-500">
                    ←
                  </span>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      All
                      Departments
                    </p>

                    {selectedDepartment && (
                      <p className="truncate text-xs text-slate-500">
                        {
                          selectedDepartment
                            .department
                            .name
                        }
                      </p>
                    )}
                  </div>
                </button>
              </div>

              <DepartmentReportPanel
                departmentId={
                  selectedDepartmentId
                }
                reportDate={
                  reportDate
                }
                onClose={() =>
                  setSelectedDepartmentId(
                    null
                  )
                }
                onOpenDate={(
                  date
                ) => {
                  onDateChange(
                    date
                  );
                }}
                onReportChanged={() => {
                  void onRefresh();
                }}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}