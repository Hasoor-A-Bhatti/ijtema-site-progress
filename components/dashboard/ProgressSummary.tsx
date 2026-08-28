import {
  STATUS_CONFIG,
  STATUS_ORDER,
} from "@/config/statuses";

import type {
  SiteArea,
  SiteStatus,
} from "@/types/site";

interface ProgressSummaryProps {
  areas: SiteArea[];
  statuses: Record<string, SiteStatus>;
}

export default function ProgressSummary({
  areas,
  statuses,
}: ProgressSummaryProps) {
  const counts = STATUS_ORDER.reduce(
    (result, status) => {
      result[status] = 0;
      return result;
    },
    {} as Record<SiteStatus, number>
  );

  let totalProgress = 0;

  areas.forEach((area) => {
    const status =
      statuses[area.id] ?? area.status;

    counts[status] += 1;

    const stageIndex =
      STATUS_ORDER.indexOf(status);

    totalProgress +=
      stageIndex /
      (STATUS_ORDER.length - 1);
  });

  const percentage =
    areas.length === 0
      ? 0
      : Math.round(
          (totalProgress / areas.length) * 100
        );

  return (
    <div className="flex items-center gap-4 overflow-x-auto border-b bg-white px-4 py-2">
      <div className="shrink-0">
        <span className="text-xs text-slate-500">
          Site Progress
        </span>

        <p className="text-lg font-semibold text-slate-900">
          {percentage}%
        </p>
      </div>

      <div className="h-8 w-px shrink-0 bg-slate-200" />

      {STATUS_ORDER.map((status) => (
        <div
          key={status}
          className="flex shrink-0 items-center gap-2 text-sm"
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{
              backgroundColor:
                STATUS_CONFIG[status].colour,
            }}
          />

          <span className="font-medium text-slate-700">
            {counts[status]}
          </span>
        </div>
      ))}
    </div>
  );
}