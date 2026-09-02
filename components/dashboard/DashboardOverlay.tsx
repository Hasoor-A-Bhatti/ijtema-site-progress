"use client";

import {
  useEffect,
  useState,
} from "react";

import EquipmentLoans from "./EquipmentLoans";
import SiteReports from "./SiteReports";
import SiteSummary from "./SiteSummary";

import {
  useEditorAccess,
} from "@/components/editor/EditorAccessProvider";

import useDashboardData from "@/hooks/useDashboardData";

import useSiteReports, {
  getLondonDateString,
} from "@/hooks/useSiteReports";

interface DashboardOverlayProps {
  onClose: () => void;
}

type DashboardTab =
  | "summary"
  | "reports"
  | "equipment";

function formatDate(
  date: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "numeric",
      month:
        "short",
      timeZone:
        "Europe/London",
    }
  ).format(
    new Date(
      `${date}T12:00:00Z`
    )
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
      />

      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function DashboardOverlay({
  onClose,
}: DashboardOverlayProps) {
  const [
    activeTab,
    setActiveTab,
  ] =
    useState<DashboardTab>(
      "summary"
    );

  const [
    reportDate,
    setReportDate,
  ] =
    useState(
      getLondonDateString()
    );

  const {
    canEdit,
    loading:
      accessLoading,
    requestEditingAccess,
  } =
    useEditorAccess();

  const {
    metrics,
    loading:
      siteLoading,
    error:
      siteError,
    lastUpdated:
      siteLastUpdated,
    refresh:
      refreshSite,
  } =
    useDashboardData();

  const {
    data:
      reportsData,
    loading:
      reportsLoading,
    error:
      reportsError,
    refresh:
      refreshReports,
  } =
    useSiteReports(
      reportDate,
      canEdit
    );

  useEffect(() => {
    function handleKeyDown(
      event:
        KeyboardEvent
    ) {
      if (
        event.key ===
        "Escape"
      ) {
        onClose();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    onClose,
  ]);

  /*
   * If editing access expires while a protected
   * dashboard module is open, safely return to
   * Site Summary.
   */
  useEffect(() => {
    if (
      accessLoading ||
      canEdit ||
      activeTab ===
        "summary"
    ) {
      return;
    }

    const timeout =
      window.setTimeout(
        () => {
          setActiveTab(
            "summary"
          );
        },
        0
      );

    return () => {
      window.clearTimeout(
        timeout
      );
    };
  }, [
    accessLoading,
    canEdit,
    activeTab,
  ]);

  function openProtectedTab(
    tab:
      | "reports"
      | "equipment"
  ) {
    if (
      accessLoading
    ) {
      return;
    }

    if (canEdit) {
      setActiveTab(
        tab
      );

      return;
    }

    requestEditingAccess(
      () => {
        setActiveTab(
          tab
        );
      }
    );
  }

  const reportsSubmitted =
    canEdit &&
    !reportsLoading
      ? `${reportsData?.submitted ?? 0}/${
          reportsData?.totalDepartments ??
          19
        }`
      : canEdit
        ? "—"
        : "Locked";

  const reportsOverdue =
    canEdit &&
    !reportsLoading
      ? String(
          reportsData
            ?.summary
            .overdue ??
            0
        )
      : "—";

  const overdueCount =
    reportsData
      ?.summary
      .overdue ??
    0;

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/45 p-0 backdrop-blur-sm sm:p-4"
      onMouseDown={
        onClose
      }
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Site operations dashboard"
        onMouseDown={(
          event
        ) =>
          event.stopPropagation()
        }
        className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden bg-slate-50 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl"
      >
        {/* HEADER */}
        <header className="border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-semibold text-slate-950 sm:text-2xl">
                  Site
                  Operations
                </h2>

                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />

                  Live
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                National Ijtema
                2026 · Daily
                conference
                command centre
              </p>
            </div>

            <button
              type="button"
              onClick={
                onClose
              }
              aria-label="Close dashboard"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl text-slate-500 transition hover:bg-slate-100 active:bg-slate-200"
            >
              ×
            </button>
          </div>

          {/* DASHBOARD NAVIGATION */}
          <div className="overflow-x-auto px-4 sm:px-6">
            <div className="flex w-max min-w-full gap-1">
              <button
                type="button"
                onClick={() =>
                  setActiveTab(
                    "summary"
                  )
                }
                className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  activeTab ===
                  "summary"
                    ? "border-slate-950 text-slate-950"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Site Summary
              </button>

              <button
                type="button"
                disabled={
                  accessLoading
                }
                onClick={() =>
                  openProtectedTab(
                    "reports"
                  )
                }
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition disabled:cursor-wait ${
                  activeTab ===
                  "reports"
                    ? "border-slate-950 text-slate-950"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {!canEdit &&
                  !accessLoading && (
                    <LockIcon />
                  )}

                Site Reports
              </button>

              <button
                type="button"
                disabled={
                  accessLoading
                }
                onClick={() =>
                  openProtectedTab(
                    "equipment"
                  )
                }
                className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition disabled:cursor-wait ${
                  activeTab ===
                  "equipment"
                    ? "border-slate-950 text-slate-950"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {!canEdit &&
                  !accessLoading && (
                    <LockIcon />
                  )}

                Equipment Loans
              </button>
            </div>
          </div>
        </header>

        {/* DESKTOP CONFERENCE STRIP
            Hidden globally on phones.
        */}
        <div className="hidden border-b border-slate-200 bg-slate-50 px-4 py-3 sm:block sm:px-6">
          <div className="grid grid-cols-3 gap-2 xl:grid-cols-6">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Site Progress
              </p>

              <p className="mt-1 text-xl font-bold text-slate-950">
                {siteLoading
                  ? "—"
                  : `${metrics.overallProgress}%`}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Urgent Issues
              </p>

              <p
                className={`mt-1 text-xl font-bold ${
                  metrics.urgentOutstanding >
                  0
                    ? "text-red-600"
                    : "text-slate-950"
                }`}
              >
                {
                  metrics
                    .urgentOutstanding
                }
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Ready to
                Inspect
              </p>

              <p className="mt-1 text-xl font-bold text-blue-600">
                {
                  metrics
                    .readyForInspection
                }
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Completed
              </p>

              <p className="mt-1 text-xl font-bold text-emerald-600">
                {
                  metrics
                    .fullyCompleted
                }
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                openProtectedTab(
                  "reports"
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:bg-slate-50"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Reports ·{" "}
                {formatDate(
                  reportDate
                )}
              </p>

              <p
                className={`mt-1 font-bold ${
                  canEdit
                    ? "text-xl text-slate-950"
                    : "text-sm text-slate-500"
                }`}
              >
                {
                  reportsSubmitted
                }
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                openProtectedTab(
                  "reports"
                )
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:bg-slate-50"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Reports
                Overdue
              </p>

              <p
                className={`mt-1 text-xl font-bold ${
                  canEdit &&
                  overdueCount >
                    0
                    ? "text-red-600"
                    : "text-slate-950"
                }`}
              >
                {
                  reportsOverdue
                }
              </p>
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab ===
            "summary" && (
            <SiteSummary
              metrics={
                metrics
              }
              loading={
                siteLoading
              }
              error={
                siteError
              }
              lastUpdated={
                siteLastUpdated
              }
              onRefresh={
                refreshSite
              }
            />
          )}

          {activeTab ===
            "reports" &&
            canEdit && (
              <SiteReports
                reportDate={
                  reportDate
                }
                data={
                  reportsData
                }
                loading={
                  reportsLoading
                }
                error={
                  reportsError
                }
                onDateChange={
                  setReportDate
                }
                onRefresh={
                  refreshReports
                }
              />
            )}

          {activeTab ===
            "equipment" &&
            canEdit && (
              <EquipmentLoans
                enabled={
                  canEdit
                }
              />
            )}
        </div>
      </div>
    </div>
  );
}