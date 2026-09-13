"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useEditorAccess,
} from "@/components/editor/EditorAccessProvider";

import type {
  SiteTowerLight,
  TowerLightStatus,
  TowerLightStatusHistoryEntry,
} from "@/types/towerLights";

interface TowerLightDetailsCardProps {
  light: SiteTowerLight;
  onClose: () => void;
  onChanged:
    () => Promise<void>;
}

const LONDON_TIME_ZONE =
  "Europe/London";

function getLondonDateString(
  date = new Date()
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          LONDON_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      date
    );

  const values =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ]
      )
    );

  return `${values.year}-${values.month}-${values.day}`;
}

function londonMidnightUtcMs(
  dateString: string
) {
  const [
    year,
    month,
    day,
  ] =
    dateString
      .split("-")
      .map(Number);

  const targetWallClock =
    Date.UTC(
      year,
      month - 1,
      day,
      0,
      0,
      0
    );

  let guess =
    targetWallClock;

  for (
    let attempt = 0;
    attempt < 3;
    attempt += 1
  ) {
    const parts =
      new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone:
            LONDON_TIME_ZONE,
          year:
            "numeric",
          month:
            "2-digit",
          day:
            "2-digit",
          hour:
            "2-digit",
          minute:
            "2-digit",
          second:
            "2-digit",
          hourCycle:
            "h23",
        }
      ).formatToParts(
        new Date(guess)
      );

    const values =
      Object.fromEntries(
        parts.map(
          (part) => [
            part.type,
            part.value,
          ]
        )
      );

    const representedWallClock =
      Date.UTC(
        Number(
          values.year
        ),
        Number(
          values.month
        ) - 1,
        Number(
          values.day
        ),
        Number(
          values.hour
        ),
        Number(
          values.minute
        ),
        Number(
          values.second
        )
      );

    const difference =
      targetWallClock -
      representedWallClock;

    guess +=
      difference;

    if (
      difference === 0
    ) {
      break;
    }
  }

  return guess;
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day:
        "numeric",
      month:
        "short",
      hour:
        "2-digit",
      minute:
        "2-digit",
      timeZone:
        LONDON_TIME_ZONE,
    }
  ).format(
    new Date(value)
  );
}

function formatDuration(
  milliseconds: number
) {
  const safeMs =
    Math.max(
      0,
      milliseconds
    );

  const totalMinutes =
    Math.round(
      safeMs /
        60000
    );

  const hours =
    Math.floor(
      totalMinutes /
        60
    );

  const minutes =
    totalMinutes %
    60;

  if (
    hours === 0
  ) {
    return `${minutes}m`;
  }

  return `${hours}h ${String(
    minutes
  ).padStart(
    2,
    "0"
  )}m`;
}

function statusLabel(
  status: TowerLightStatus
) {
  if (
    status === "on"
  ) {
    return "On";
  }

  if (
    status === "down"
  ) {
    return "Down";
  }

  return "Off";
}

function statusClasses(
  status: TowerLightStatus
) {
  if (
    status === "on"
  ) {
    return "border-amber-300 bg-amber-50 text-amber-800";
  }

  if (
    status === "down"
  ) {
    return "border-red-300 bg-red-50 text-red-700";
  }

  return "border-slate-300 bg-slate-50 text-slate-700";
}

function orderedHistory(
  light: SiteTowerLight
) {
  return [
    ...light.status_history,
  ].sort(
    (
      a,
      b
    ) =>
      new Date(
        a.changed_at
      ).getTime() -
      new Date(
        b.changed_at
      ).getTime()
  );
}

/*
 * Find the status that was active at a particular
 * instant. If the instant predates the first change,
 * the first history row's old_status is the correct
 * starting state.
 */
function getStatusAt(
  light: SiteTowerLight,
  timestampMs: number
): TowerLightStatus {
  const history =
    orderedHistory(
      light
    );

  if (
    history.length ===
    0
  ) {
    return light.status;
  }

  let status =
    history[0]
      .old_status;

  for (
    const entry of history
  ) {
    const changedAt =
      new Date(
        entry.changed_at
      ).getTime();

    if (
      changedAt >
      timestampMs
    ) {
      break;
    }

    status =
      entry.new_status;
  }

  return status;
}

function calculateOnTime(
  light: SiteTowerLight,
  startMs: number,
  endMs: number
) {
  if (
    endMs <= startMs
  ) {
    return 0;
  }

  const history =
    orderedHistory(
      light
    ).filter(
      (entry) => {
        const time =
          new Date(
            entry.changed_at
          ).getTime();

        return (
          time >=
            startMs &&
          time <=
            endMs
        );
      }
    );

  let status =
    getStatusAt(
      light,
      startMs
    );

  let cursor =
    startMs;

  let onTime =
    0;

  for (
    const entry of history
  ) {
    const time =
      Math.min(
        Math.max(
          new Date(
            entry.changed_at
          ).getTime(),
          startMs
        ),
        endMs
      );

    if (
      status === "on"
    ) {
      onTime +=
        time -
        cursor;
    }

    status =
      entry.new_status;

    cursor =
      time;
  }

  if (
    status === "on"
  ) {
    onTime +=
      endMs -
      cursor;
  }

  return onTime;
}

export default function TowerLightDetailsCard({
  light,
  onClose,
  onChanged,
}: TowerLightDetailsCardProps) {
  const {
    canEdit,
    loading:
      accessLoading,
    requestEditingAccess,
  } =
    useEditorAccess();

  const [
    updating,
    setUpdating,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    success,
    setSuccess,
  ] =
    useState<
      string | null
    >(null);

  const [
    nowMs,
    setNowMs,
  ] =
    useState<
      number | null
    >(null);

  useEffect(() => {
    const initialTimer =
      window.setTimeout(
        () => {
          setNowMs(
            Date.now()
          );
        },
        0
      );

    const interval =
      window.setInterval(
        () => {
          setNowMs(
            Date.now()
          );
        },
        60000
      );

    return () => {
      window.clearTimeout(
        initialTimer
      );

      window.clearInterval(
        interval
      );
    };
  }, []);

  const statistics =
    useMemo(() => {
      if (
        nowMs === null
      ) {
        return {
          todayOnMs:
            0,
          totalOnMs:
            0,
          onCycles:
            0,
          downEvents:
            0,
        };
      }

      const todayStart =
        londonMidnightUtcMs(
          getLondonDateString(
            new Date(
              nowMs
            )
          )
        );

      const createdAt =
        new Date(
          light.created_at
        ).getTime();

      return {
        todayOnMs:
          calculateOnTime(
            light,
            Math.max(
              todayStart,
              createdAt
            ),
            nowMs
          ),
        totalOnMs:
          calculateOnTime(
            light,
            createdAt,
            nowMs
          ),
        onCycles:
          light.status_history.filter(
            (entry) =>
              entry.new_status ===
              "on"
          ).length,
        downEvents:
          light.status_history.filter(
            (entry) =>
              entry.new_status ===
              "down"
          ).length,
      };
    }, [
      light,
      nowMs,
    ]);

  const latestChange:
    TowerLightStatusHistoryEntry
    | null =
      light
        .status_history[
          0
        ] ??
      null;

  async function updateStatus(
    nextStatus:
      TowerLightStatus
  ) {
    if (
      light.status ===
      nextStatus
    ) {
      return;
    }

    if (
      nextStatus ===
        "down" &&
      !window.confirm(
        `Mark ${light.name} as DOWN? A red fault pulse will immediately appear on the map.`
      )
    ) {
      return;
    }

    setUpdating(
      true
    );

    setError(null);
    setSuccess(null);

    try {
      const response =
        await fetch(
          `/api/tower-lights/${encodeURIComponent(
            light.id
          )}`,
          {
            method:
              "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                status:
                  nextStatus,
              }),
          }
        );

      const body =
        (await response
          .json()
          .catch(
            () => null
          )) as
          | {
              success?: boolean;
              error?: string;
            }
          | null;

      if (
        response.status ===
          401 ||
        response.status ===
          403
      ) {
        throw new Error(
          "Editing access has expired. Enable editing again."
        );
      }

      if (
        !response.ok ||
        !body?.success
      ) {
        throw new Error(
          body?.error ??
            "Tower light status could not be updated."
        );
      }

      setSuccess(
        nextStatus ===
          "on"
          ? `${light.name} switched on. Operating time is now being counted.`
          : nextStatus ===
              "off"
            ? `${light.name} switched off.`
            : `${light.name} marked down. The red map warning is active.`
      );

      await onChanged();
    } catch (
      updateError
    ) {
      setError(
        updateError instanceof
          Error
          ? updateError.message
          : "Tower light status could not be updated."
      );
    } finally {
      setUpdating(
        false
      );
    }
  }

  return (
    <aside className="absolute inset-x-3 bottom-3 z-40 flex max-h-[72%] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:left-auto sm:right-4 sm:top-4 sm:bottom-auto sm:w-[390px] sm:max-h-[calc(100%-2rem)]">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-amber-600 bg-gradient-to-br from-amber-500 to-amber-600 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-4 w-4 items-center justify-center">
                  {light.status ===
                    "on" && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-200 opacity-70" />
                  )}

                  <span
                    className={`relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white/70 ${
                      light.status ===
                      "down"
                        ? "bg-red-500"
                        : "bg-yellow-300"
                    }`}
                  />
                </span>

                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
                  Site Lighting
                </p>
              </div>

              <h2 className="mt-1 text-2xl font-bold">
                {
                  light.name
                }
              </h2>

              <p className="mt-1 text-sm text-amber-100">
                Tower light · map position{" "}
                {Math.round(
                  Number(
                    light.x
                  )
                )}
                ,{" "}
                {Math.round(
                  Number(
                    light.y
                  )
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={
                onClose
              }
              aria-label="Close tower light details"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl text-amber-100 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-5 [-webkit-overflow-scrolling:touch]">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Current Status
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-700">
                {light.status ===
                "on"
                  ? "Light operating normally"
                  : light.status ===
                      "down"
                    ? "Fault / unavailable"
                    : "Intentionally switched off"}
              </p>
            </div>

            <span
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${statusClasses(
                light.status
              )}`}
            >
              {statusLabel(
                light.status
              )}
            </span>
          </div>

          {light.status ===
            "down" && (
            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600 text-base font-black text-white">
                !
              </div>

              <div>
                <p className="text-sm font-bold text-red-900">
                  Tower Light Down
                </p>

                <p className="mt-0.5 text-xs leading-5 text-red-700">
                  This light has been flagged as unavailable. A red warning pulse is active on the site map.
                </p>
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                On Today
              </p>

              <p className="mt-1 text-xl font-bold text-amber-950">
                {formatDuration(
                  statistics.todayOnMs
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                Total On Time
              </p>

              <p className="mt-1 text-xl font-bold text-blue-950">
                {formatDuration(
                  statistics.totalOnMs
                )}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Switch-On Cycles
              </p>

              <p className="mt-1 text-xl font-bold text-slate-950">
                {
                  statistics.onCycles
                }
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Down Events
              </p>

              <p className={`mt-1 text-xl font-bold ${
                statistics.downEvents >
                0
                  ? "text-red-700"
                  : "text-slate-950"
              }`}>
                {
                  statistics.downEvents
                }
              </p>
            </div>
          </div>

          {latestChange && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Last Change
              </p>

              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">
                  {statusLabel(
                    latestChange.old_status
                  )}{" "}
                  →{" "}
                  {statusLabel(
                    latestChange.new_status
                  )}
                </p>

                <span className="text-xs font-medium text-slate-500">
                  {formatDateTime(
                    latestChange.changed_at
                  )}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-medium text-emerald-700">
              {success}
            </div>
          )}

          {!canEdit &&
            !accessLoading && (
            <button
              type="button"
              onClick={() =>
                requestEditingAccess(
                  () => {}
                )
              }
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              Enable Editing to Control Light
            </button>
          )}

          {canEdit && (
            <section className="mt-5 rounded-2xl border border-slate-200 p-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  Light Controls
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Every genuine status change is timestamped automatically for post-event operating-hour and fault reporting.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={
                    updating ||
                    light.status ===
                      "on"
                  }
                  onClick={() =>
                    void updateStatus(
                      "on"
                    )
                  }
                  className="min-h-11 rounded-xl border border-amber-300 bg-amber-50 px-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:cursor-default disabled:bg-amber-500 disabled:text-white disabled:opacity-100"
                >
                  Turn On
                </button>

                <button
                  type="button"
                  disabled={
                    updating ||
                    light.status ===
                      "off"
                  }
                  onClick={() =>
                    void updateStatus(
                      "off"
                    )
                  }
                  className="min-h-11 rounded-xl border border-slate-300 bg-slate-50 px-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-default disabled:bg-slate-700 disabled:text-white disabled:opacity-100"
                >
                  Turn Off
                </button>

                <button
                  type="button"
                  disabled={
                    updating ||
                    light.status ===
                      "down"
                  }
                  onClick={() =>
                    void updateStatus(
                      "down"
                    )
                  }
                  className="min-h-11 rounded-xl border border-red-300 bg-red-50 px-2 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-default disabled:bg-red-600 disabled:text-white disabled:opacity-100"
                >
                  Mark Down
                </button>
              </div>

              {updating && (
                <p className="mt-2 text-center text-xs font-medium text-slate-500">
                  Updating light status…
                </p>
              )}
            </section>
          )}

          <section className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  Status History
                </h3>

                <p className="mt-0.5 text-xs text-slate-500">
                  Complete timestamped audit trail.
                </p>
              </div>

              <span className="text-xs font-semibold text-slate-500">
                {
                  light
                    .status_history
                    .length
                }{" "}
                changes
              </span>
            </div>

            {light
              .status_history
              .length ===
            0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No status changes have been recorded yet.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {light.status_history.map(
                  (
                    entry
                  ) => (
                    <div
                      key={
                        entry.id
                      }
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {statusLabel(
                            entry.old_status
                          )}{" "}
                          →{" "}
                          {statusLabel(
                            entry.new_status
                          )}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDateTime(
                            entry.changed_at
                          )}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClasses(
                          entry.new_status
                        )}`}
                      >
                        {statusLabel(
                          entry.new_status
                        )}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
}
