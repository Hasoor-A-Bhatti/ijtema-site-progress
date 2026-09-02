import {
  STATUS_CONFIG,
} from "@/config/statuses";

import type {
  DashboardMetrics,
} from "@/hooks/useDashboardData";

import type {
  SiteStatus,
} from "@/types/site";

interface SiteSummaryProps {
  metrics: DashboardMetrics;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  onRefresh: () => Promise<void>;
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
    timeZone: "Europe/London",
  }).format(date);
}

function formatAreaType(areaType: string) {
  if (areaType === "metal_tracking") return "Metal tracking";
  if (areaType === "rubber_tracking") return "Rubber tracking";
  if (areaType === "fence") return "Fence";
  if (areaType === "service_pad") return "Service pad";
  if (areaType === "site_yard") return "Site yard";
  if (areaType === "cabin") return "Cabin";

  return "Site area";
}

export default function SiteSummary({
  metrics,
  loading,
  error,
  lastUpdated,
  onRefresh,
}: SiteSummaryProps) {
  const attentionPreview =
    metrics.attentionAreas.slice(0, 8);

  const inspectionPreview =
    metrics.inspectionQueue.slice(0, 7);

  const urgentPreview =
    metrics.urgentIssues.slice(0, 6);

  const equipmentPreview =
    metrics.equipmentAttention.slice(0, 5);

  const activeWorkstreams =
    metrics.workstreams.filter(
      (workstream) => workstream.total > 0
    );

  const slowestWorkstream =
    [...activeWorkstreams].sort(
      (a, b) => a.progress - b.progress
    )[0];

  const conferenceFocus: string[] = [];

  if (metrics.urgentOutstanding > 0) {
    conferenceFocus.push(
      `${metrics.urgentOutstanding} unresolved urgent issue${
        metrics.urgentOutstanding === 1 ? "" : "s"
      } across ${metrics.areasWithUrgentIssues} area${
        metrics.areasWithUrgentIssues === 1 ? "" : "s"
      }.`
    );
  }

  if (slowestWorkstream) {
    conferenceFocus.push(
      `${slowestWorkstream.label} is currently the least advanced workstream at ${slowestWorkstream.progress}%.`
    );
  }

  if (metrics.readyForInspection > 0) {
    conferenceFocus.push(
      `${metrics.readyForInspection} feature${
        metrics.readyForInspection === 1 ? " is" : "s are"
      } ready for inspection.`
    );
  }

  if (metrics.areasWithEquipmentIssues > 0) {
    conferenceFocus.push(
      `${metrics.areasWithEquipmentIssues} area${
        metrics.areasWithEquipmentIssues === 1 ? " has" : "s have"
      } outstanding equipment requirements.`
    );
  }

  if (conferenceFocus.length === 0) {
    conferenceFocus.push(
      "No urgent issues, inspection queues or equipment blockers currently require escalation."
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {error && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">
            {error}
          </p>

          <button
            type="button"
            onClick={() => void onRefresh()}
            className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* CONFERENCE FOCUS */}
      <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Daily Conference
            </p>

            <h3 className="mt-1 text-xl font-semibold">
              Today&apos;s Conference Focus
            </h3>
          </div>

          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
            {metrics.attentionAreas.length} priority areas
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {conferenceFocus.slice(0, 4).map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="flex gap-3 rounded-xl bg-white/[0.07] p-3.5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                {index + 1}
              </span>

              <p className="text-sm leading-6 text-slate-200">
                {item}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* SITE POSITION */}
      <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_2fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">
            Overall Site Position
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Combined progress across all tracked work.
          </p>

          <div className="mt-6 flex items-center gap-6">
            <div
              className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#0f172a ${metrics.overallProgress}%, #e2e8f0 ${metrics.overallProgress}% 100%)`,
              }}
            >
              <div className="absolute inset-[10px] flex items-center justify-center rounded-full bg-white">
                <span className="text-3xl font-bold text-slate-950">
                  {loading
                    ? "—"
                    : `${metrics.overallProgress}%`}
                </span>
              </div>
            </div>

            <div>
              <p className="text-3xl font-bold text-slate-950">
                {metrics.totalAreas}
              </p>

              <p className="text-sm text-slate-500">
                tracked features
              </p>

              <div className="mt-4 space-y-1 text-sm">
                <p className="font-medium text-blue-700">
                  {metrics.readyForInspection} ready for inspection
                </p>

                <p className="font-medium text-emerald-700">
                  {metrics.fullyCompleted} fully completed
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* WORKSTREAMS */}
        <div className="grid gap-3 sm:grid-cols-2">
          {metrics.workstreams.map((workstream) => (
            <div
              key={workstream.key}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {workstream.label}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {workstream.total} tracked
                  </p>
                </div>

                <span className="text-2xl font-bold text-slate-950">
                  {workstream.total > 0
                    ? `${workstream.progress}%`
                    : "—"}
                </span>
              </div>

              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-800 transition-all"
                  style={{
                    width: `${workstream.progress}%`,
                  }}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                  {workstream.completed} complete
                </span>

                <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
                  {workstream.ready} ready
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRIORITIES + INSPECTION */}
      <section className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-950">
                  Priority Actions
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Issues and blockers requiring conference attention.
                </p>
              </div>

              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                {metrics.attentionAreas.length}
              </span>
            </div>
          </div>

          {attentionPreview.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 font-bold text-emerald-600">
                ✓
              </div>

              <p className="mt-3 font-semibold text-slate-900">
                No current blockers
              </p>

              <p className="mt-1 text-sm text-slate-500">
                All urgent and equipment attention items are clear.
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
                            STATUS_CONFIG[area.status].colour,
                        }}
                      />

                      <p className="truncate text-sm font-semibold text-slate-900">
                        {area.name}
                      </p>
                    </div>

                    <p className="mt-1 pl-[18px] text-xs text-slate-500">
                      {formatAreaType(area.areaType)} ·{" "}
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

        {/* INSPECTION QUEUE */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">
                  Inspection Queue
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Work awaiting final inspection.
                </p>
              </div>

              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                {metrics.inspectionQueue.length}
              </span>
            </div>
          </div>

          {inspectionPreview.length === 0 ? (
            <div className="p-7 text-center text-sm text-slate-500">
              Nothing currently awaiting inspection.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {inspectionPreview.map((item) => (
                <div key={item.id} className="px-5 py-3.5">
                  <p className="text-sm font-semibold text-slate-900">
                    {item.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatAreaType(item.areaType)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* URGENT + EQUIPMENT */}
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">
                  Urgent Issues
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Unresolved issues requiring action.
                </p>
              </div>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  metrics.urgentOutstanding > 0
                    ? "bg-red-50 text-red-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {metrics.urgentOutstanding}
              </span>
            </div>
          </div>

          {urgentPreview.length === 0 ? (
            <div className="p-7 text-center text-sm text-slate-500">
              No unresolved urgent issues.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {urgentPreview.map((issue) => (
                <div key={issue.id} className="px-5 py-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {issue.areaName}
                  </p>

                  <p className="mt-1 text-sm leading-5 text-slate-600">
                    {issue.taskText}
                  </p>

                  <p className="mt-2 text-xs text-slate-400">
                    {formatAreaType(issue.areaType)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-slate-950">
                Equipment Readiness
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Physical delivery and confirmation across the site.
              </p>
            </div>

            <span className="text-3xl font-bold text-slate-950">
              {metrics.equipmentProgress}%
            </span>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{
                width: `${metrics.equipmentProgress}%`,
              }}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Confirmed
            </span>

            <span className="font-semibold text-slate-900">
              {metrics.equipmentConfirmed}/
              {metrics.equipmentRequirements}
            </span>
          </div>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Most affected areas
            </p>

            {equipmentPreview.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                No outstanding equipment.
              </p>
            ) : (
              <div className="mt-2 divide-y divide-slate-100">
                {equipmentPreview.map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <span className="truncate text-sm font-medium text-slate-700">
                      {area.name}
                    </span>

                    <span className="shrink-0 text-xs font-semibold text-amber-700">
                      {area.outstandingRequirements} outstanding
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* DETAILED STATUS */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h3 className="font-semibold text-slate-950">
            Detailed Status Distribution
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Current position across the complete site workflow.
          </p>
        </div>

        <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-slate-100">
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

      <footer className="mt-5 flex items-center justify-between gap-4 px-1 text-xs text-slate-400">
        <p>
          Last updated {formatTime(lastUpdated)}
        </p>

        <p>Live operational data</p>
      </footer>
    </div>
  );
}