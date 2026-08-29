import {
  getStatusLabel,
  STATUS_CONFIG,
  STATUS_ORDER,
} from "@/config/statuses";

import type {
  AreaType,
  SiteStatus,
} from "@/types/site";

interface ProgressControlsProps {
  status: SiteStatus;
  areaType: AreaType;
  onStatusChange: (status: SiteStatus) => void;
}

export default function ProgressControls({
  status,
  areaType,
  onStatusChange,
}: ProgressControlsProps) {
  const isInfrastructure =
    areaType === "fence" ||
    areaType === "rubber_tracking" ||
    areaType === "metal_tracking";

  /*
   * Infrastructure does not use the Amber
   * "Being Prepared" stage.
   */
  const availableStatuses = isInfrastructure
    ? STATUS_ORDER.filter(
        (stage) => stage !== "preparing"
      )
    : STATUS_ORDER;

  /*
   * Safety fallback:
   * If an infrastructure item somehow still has
   * the old "preparing" status, display it as Laid.
   */
  const displayStatus =
    isInfrastructure &&
    status === "preparing"
      ? "laid"
      : status;

  const currentStageIndex =
    availableStatuses.indexOf(
      displayStatus
    );

  const currentStage =
    currentStageIndex >= 0
      ? currentStageIndex + 1
      : 1;

  return (
    <div>
      {/* CURRENT PROGRESS */}
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-slate-700">
          Current Progress
        </span>

        <span className="text-sm text-slate-500">
          Stage {currentStage} of{" "}
          {availableStatuses.length}
        </span>
      </div>

      {/* PROGRESS BAR */}
      <div className="mt-3 flex gap-1.5">
        {availableStatuses.map(
          (stage, index) => (
            <div
              key={stage}
              className="h-2 flex-1 rounded-full transition-colors"
              style={{
                backgroundColor:
                  index <
                  currentStage
                    ? STATUS_CONFIG[
                        stage
                      ].colour
                    : "#E2E8F0",
              }}
            />
          )
        )}
      </div>

      {/* STATUS CONTROLS */}
      <div className="mt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Change Progress
        </p>

        <div className="grid gap-2">
          {availableStatuses.map(
            (statusKey) => {
              const config =
                STATUS_CONFIG[
                  statusKey
                ];

              const active =
                displayStatus ===
                statusKey;

              return (
                <button
                  key={statusKey}
                  type="button"
                  onClick={() =>
                    onStatusChange(
                      statusKey
                    )
                  }
                  className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    active
                      ? "border-slate-900 bg-slate-100 font-semibold text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        config.colour,
                    }}
                  />

                  <span className="flex-1">
                    {getStatusLabel(
                      statusKey,
                      areaType
                    )}
                  </span>

                  {active && (
                    <span className="text-xs font-normal text-slate-500">
                      Current
                    </span>
                  )}
                </button>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}