"use client";

import { useEffect } from "react";

import { STATUS_CONFIG } from "@/config/statuses";
import useDashboardData from "@/hooks/useDashboardData";

import type { SiteStatus } from "@/types/site";

interface DashboardOverlayProps {
  onClose: () => void;
}

const STATUS_ORDER: SiteStatus[] = [
  "not_started",
  "laid",
  "preparing",
  "ready_for_inspection",
  "completed",
];

const STATUS_LABELS: Record<SiteStatus, string> = {
  not_started: "Not Started",
  laid: "Laid / Established",
  preparing: "Being Prepared",
  ready_for_inspection: "Ready for Inspection",
  completed: "Fully Completed",
};

function formatTime(date: Date | null) {
  if (!date) return "Updating...";

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export default function DashboardOverlay({
  onClose,
}: DashboardOverlayProps) {
  const {
    metrics,
    loading,
    error,
    lastUpdated,
    refresh,
  } = useDashboardData();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const attentionPreview =
    metrics.attentionAreas.slice(0, 8);

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/45 p-0 backdrop-blur-sm sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Site dashboard"
        onMouseDown={(event) => event.stopPropagation()}
        className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden bg-slate-50 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-3xl"
      >
        {/* HEADER */}
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-semibold text-slate-950 sm:text-2xl">
                Site Overview
              </h2>

              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Live
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              National Ijtema 2026 operational progress
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dashboard"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl text-slate-500 transition hover:bg-slate-100 active:bg-slate-200"
          >
            ×
          </button>
        </header>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {error && (
            <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">
                {error}
              </p>

              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-sm"
              >
                Retry
              </button>
            </div>
          )}

          {/* TOP OVERVIEW */}
          <section className="grid gap-4 lg:grid-cols-[1.3fr_2fr]">
            {/* OVERALL PROGRESS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Overall Site Progress
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Combined progress across all tracked areas.
                </p>
              </div>

              <div className="mt-6 flex items-center gap-6">
                <div
                  className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(#0f172a ${metrics.overallProgress}%, #e2e8f0 ${metrics.overallProgress}% 100%)`,
                  }}
                >
                  <div className="absolute inset-[9px] flex items-center justify-center rounded-full bg-white">
                    <span className="text-2xl font-bold text-slate-950">
                      {loading
                        ? "—"
                        : `${metrics.overallProgress}%`}
                    </span>
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="text-3xl font-bold text-slate-950">
                    {metrics.totalAreas}
                  </p>

                  <p className="text-sm text-slate-500">
                    tracked site areas
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {metrics.readyForInspection} ready
                    </span>

                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {metrics.fullyCompleted} complete
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* KEY METRICS */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Urgent Issues
                </p>

                <p
                  className={`mt-3 text-3xl font-bold ${
                    metrics.urgentOutstanding > 0
                      ? "text-red-600"
                      : "text-slate-950"
                  }`}
                >
                  {metrics.urgentOutstanding}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  across {metrics.areasWithUrgentIssues} areas
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Equipment
                </p>

                <p className="mt-3 text-3xl font-bold text-slate-950">
                  {metrics.equipmentProgress}%
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  physically on site
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Ready
                </p>

                <p className="mt-3 text-3xl font-bold text-blue-600">
                  {metrics.readyForInspection}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  awaiting inspection
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Completed
                </p>

                <p className="mt-3 text-3xl font-bold text-emerald-600">
                  {metrics.fullyCompleted}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  fully signed off
                </p>
              </div>
            </div>
          </section>

          {/* STATUS PIPELINE */}
          <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-950">
                  Site Status
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Current distribution across the progress workflow.
                </p>
              </div>
            </div>

            {/* SEGMENTED BAR */}
            <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
              {STATUS_ORDER.map((status) => {
                const count = metrics.statusCounts[status];

                const width =
                  metrics.totalAreas > 0
                    ? (count / metrics.totalAreas) * 100
                    : 0;

                return (
                  <div
                    key={status}
                    title={`${STATUS_LABELS[status]}: ${count}`}
                    style={{
                      width: `${width}%`,
                      backgroundColor:
                        STATUS_CONFIG[status].colour,
                    }}
                  />
                );
              })}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
              {STATUS_ORDER.map((status) => (
                <div
                  key={status}
                  className="rounded-xl border border-slate-200 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          STATUS_CONFIG[status].colour,
                      }}
                    />

                    <p className="truncate text-xs font-medium text-slate-600">
                      {STATUS_LABELS[status]}
                    </p>
                  </div>

                  <p className="mt-2 text-2xl font-bold text-slate-950">
                    {metrics.statusCounts[status]}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* LOWER SECTION */}
          <section className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            {/* ATTENTION */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-slate-950">
                      Areas Needing Attention
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Outstanding issues and equipment requirements.
                    </p>
                  </div>

                  {metrics.attentionAreas.length > 0 && (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      {metrics.attentionAreas.length} areas
                    </span>
                  )}
                </div>
              </div>

              {attentionPreview.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-lg font-bold text-emerald-600">
                    ✓
                  </div>

                  <p className="mt-3 font-semibold text-slate-900">
                    No outstanding attention items
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    All tracked issues and equipment requirements are clear.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {attentionPreview.map((area) => (
                    <div
                      key={area.id}
                      className="flex items-center justify-between gap-4 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              backgroundColor:
                                STATUS_CONFIG[area.status]
                                  .colour,
                            }}
                          />

                          <p className="truncate text-sm font-semibold text-slate-900">
                            {area.name}
                          </p>
                        </div>

                        <p className="mt-1 pl-[18px] text-xs text-slate-500">
                          {STATUS_LABELS[area.status]}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        {area.urgentCount > 0 && (
                          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                            {area.urgentCount} urgent
                          </span>
                        )}

                        {area.equipmentOutstanding > 0 && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            {area.equipmentOutstanding} equipment
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* EQUIPMENT SUMMARY */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-950">
                Equipment Readiness
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Physical delivery and confirmation across the site.
              </p>

              <div className="mt-6">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-3xl font-bold text-slate-950">
                      {metrics.equipmentProgress}%
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      equipment quantities on site
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-slate-700">
                    {metrics.equipmentConfirmed}/
                    {metrics.equipmentRequirements}
                  </p>
                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{
                      width: `${metrics.equipmentProgress}%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  {metrics.equipmentConfirmed} of{" "}
                  {metrics.equipmentRequirements} requirements
                  fully confirmed.
                </p>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Ready for inspection
                  </span>

                  <span className="font-semibold text-blue-600">
                    {metrics.readyForInspection}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-slate-500">
                    Fully completed
                  </span>

                  <span className="font-semibold text-emerald-600">
                    {metrics.fullyCompleted}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <footer className="mt-5 flex items-center justify-between gap-4 px-1 text-xs text-slate-400">
            <p>
              Last updated {formatTime(lastUpdated)}
            </p>

            <p>Live Supabase data</p>
          </footer>
        </div>
      </div>
    </div>
  );
}