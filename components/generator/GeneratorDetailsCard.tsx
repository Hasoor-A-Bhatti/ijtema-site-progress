"use client";

import { useEffect, useMemo, useState } from "react";

import { useEditorAccess } from "@/components/editor/EditorAccessProvider";
import type {
  GeneratorFuelLog,
  GeneratorRatingHistoryEntry,
  SiteGenerator,
} from "@/types/generators";

interface GeneratorDetailsCardProps {
  generator: SiteGenerator;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

interface DailyRatingSummary {
  date: string;
  averageKva: number;
  endKva: number;
  changes: GeneratorRatingHistoryEntry[];
  isToday: boolean;
}

const LONDON_TIME_ZONE = "Europe/London";

function getLondonDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );

  return `${value.year}-${value.month}-${value.day}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: LONDON_TIME_ZONE,
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: LONDON_TIME_ZONE,
  }).format(new Date(value));
}

function formatKva(value: number) {
  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
  }).format(value)} kVA`;
}

function formatLitres(value: number) {
  return `${new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: 1,
  }).format(value)} L`;
}

function addDays(dateString: string, amount: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount, 12));

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/*
 * Convert midnight for a London calendar date into an actual UTC timestamp.
 * Doing this through Intl keeps the calculation correct across BST/GMT changes.
 */
function londonMidnightUtcMs(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const targetWallClock = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = targetWallClock;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: LONDON_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));

    const values = Object.fromEntries(
      parts.map((part) => [part.type, part.value])
    );

    const representedWallClock = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );

    const difference = targetWallClock - representedWallClock;
    guess += difference;

    if (difference === 0) break;
  }

  return guess;
}

function getRatingAt(
  generator: SiteGenerator,
  timestampMs: number
) {
  let rating = Number(generator.default_kva);

  const orderedHistory = [...generator.rating_history].sort(
    (a, b) =>
      new Date(a.changed_at).getTime() -
      new Date(b.changed_at).getTime()
  );

  for (const entry of orderedHistory) {
    if (new Date(entry.changed_at).getTime() >= timestampMs) {
      break;
    }

    rating = Number(entry.new_kva);
  }

  return rating;
}

function calculateDailyRating(
  generator: SiteGenerator,
  dateString: string,
  nowMs: number
): DailyRatingSummary | null {
  const startMs = londonMidnightUtcMs(dateString);
  const endMs = londonMidnightUtcMs(addDays(dateString, 1));
  const today = getLondonDateString(new Date(nowMs));
  const isToday = dateString === today;

  if (startMs > nowMs) return null;

  const effectiveEndMs = isToday ? Math.min(nowMs, endMs) : endMs;

  if (effectiveEndMs <= startMs) return null;

  const changes = [...generator.rating_history]
    .filter((entry) => {
      const timestamp = new Date(entry.changed_at).getTime();
      return timestamp >= startMs && timestamp < effectiveEndMs;
    })
    .sort(
      (a, b) =>
        new Date(a.changed_at).getTime() -
        new Date(b.changed_at).getTime()
    );

  let activeKva = getRatingAt(generator, startMs);
  let cursorMs = startMs;
  let weightedKvaMs = 0;

  for (const change of changes) {
    const changeMs = Math.min(
      Math.max(new Date(change.changed_at).getTime(), startMs),
      effectiveEndMs
    );

    weightedKvaMs += activeKva * (changeMs - cursorMs);
    activeKva = Number(change.new_kva);
    cursorMs = changeMs;
  }

  weightedKvaMs += activeKva * (effectiveEndMs - cursorMs);

  return {
    date: dateString,
    averageKva: weightedKvaMs / (effectiveEndMs - startMs),
    endKva: activeKva,
    changes,
    isToday,
  };
}

export default function GeneratorDetailsCard({
  generator,
  onClose,
  onChanged,
}: GeneratorDetailsCardProps) {
  const {
    canEdit,
    loading: accessLoading,
    requestEditingAccess,
  } = useEditorAccess();

  const [kva, setKva] = useState(String(generator.kva));
  const [fuelDate, setFuelDate] = useState(getLondonDateString());
  const [litres, setLitres] = useState("");
  const [savingKva, setSavingKva] = useState(false);
  const [addingFuel, setAddingFuel] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /*
   * Keep the current time in state so the render remains pure.
   * The value is populated after mount and refreshed once per minute,
   * which keeps today's time-weighted average current without calling
   * Date.now() during render.
   */
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    /*
     * Defer the initial clock update to the next task.
     * This avoids React's set-state-in-effect lint rule while still
     * keeping all time reads outside the render phase.
     */
    const initialTimer = window.setTimeout(() => {
      setNowMs(Date.now());
    }, 0);

    const refreshTimer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(refreshTimer);
    };
  }, []);

  const dailyTotals = useMemo(() => {
    const totals = new Map<string, number>();

    generator.fuel_logs.forEach((log) => {
      totals.set(
        log.log_date,
        (totals.get(log.log_date) ?? 0) + Number(log.litres)
      );
    });

    return Array.from(totals.entries()).sort(([a], [b]) =>
      b.localeCompare(a)
    );
  }, [generator.fuel_logs]);

  const dailyRatingSummaries = useMemo(() => {
    if (nowMs === null) {
      return [];
    }

    const today = getLondonDateString(new Date(nowMs));
    const createdDate = getLondonDateString(new Date(generator.created_at));

    const firstHistoryDate = generator.rating_history.length
      ? getLondonDateString(
          new Date(
            [...generator.rating_history].sort(
              (a, b) =>
                new Date(a.changed_at).getTime() -
                new Date(b.changed_at).getTime()
            )[0].changed_at
          )
        )
      : today;

    const earliestRelevantDate =
      createdDate > firstHistoryDate ? firstHistoryDate : createdDate;

    const dates: string[] = [];
    let cursor = today;

    for (let index = 0; index < 7; index += 1) {
      if (cursor < earliestRelevantDate) break;
      dates.push(cursor);
      cursor = addDays(cursor, -1);
    }

    return dates
      .map((date) => calculateDailyRating(generator, date, nowMs))
      .filter((summary): summary is DailyRatingSummary => Boolean(summary));
  }, [generator, nowMs]);

  const todayRating = dailyRatingSummaries[0] ?? null;

  async function saveKva() {
    const numericKva = Number(kva);

    if (!Number.isFinite(numericKva) || numericKva <= 0) {
      setError("Enter a valid kVA rating.");
      return;
    }

    if (numericKva === Number(generator.kva)) {
      setError("This is already the current generator rating.");
      return;
    }

    setSavingKva(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/generators/${encodeURIComponent(generator.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kva: numericKva }),
        }
      );

      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Editing access has expired. Enable editing again."
        );
      }

      if (!response.ok || !body?.success) {
        throw new Error(
          body?.error ?? "Generator rating could not be saved."
        );
      }

      setSuccess(
        `Generator rating updated from ${formatKva(
          Number(generator.kva)
        )} to ${formatKva(numericKva)}. The change has been added to the rating history.`
      );

      await onChanged();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Generator rating could not be saved."
      );
    } finally {
      setSavingKva(false);
    }
  }

  async function addFuel() {
    const numericLitres = Number(litres);

    if (!fuelDate) {
      setError("Choose a fuel date.");
      return;
    }

    if (!Number.isFinite(numericLitres) || numericLitres <= 0) {
      setError("Enter a valid number of litres.");
      return;
    }

    setAddingFuel(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/generators/${encodeURIComponent(generator.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logDate: fuelDate, litres: numericLitres }),
        }
      );

      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Editing access has expired. Enable editing again."
        );
      }

      if (!response.ok || !body?.success) {
        throw new Error(body?.error ?? "Fuel entry could not be saved.");
      }

      setLitres("");
      setSuccess(
        `${formatLitres(numericLitres)} added to ${generator.name}.`
      );
      await onChanged();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Fuel entry could not be saved."
      );
    } finally {
      setAddingFuel(false);
    }
  }

  async function removeFuel(log: GeneratorFuelLog) {
    if (
      !window.confirm(
        `Remove the ${formatLitres(log.litres)} fuel entry from ${formatDate(
          log.log_date
        )}?`
      )
    ) {
      return;
    }

    setDeletingId(log.id);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/generators/${encodeURIComponent(generator.id)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fuelLogId: log.id }),
        }
      );

      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (response.status === 401 || response.status === 403) {
        throw new Error(
          "Editing access has expired. Enable editing again."
        );
      }

      if (!response.ok || !body?.success) {
        throw new Error(body?.error ?? "Fuel entry could not be removed.");
      }

      setSuccess("Fuel entry removed.");
      await onChanged();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Fuel entry could not be removed."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <aside className="absolute inset-x-3 bottom-3 z-40 flex max-h-[72%] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:left-auto sm:right-4 sm:top-4 sm:bottom-auto sm:w-[390px] sm:max-h-[calc(100%-2rem)]">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-red-900 bg-red-700 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 rounded-[3px] border border-white/50 bg-red-500" />
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-100">
                  Site Generator
                </p>
              </div>

              <h2 className="mt-1 text-2xl font-bold">{generator.name}</h2>

              <p className="mt-1 text-sm text-red-100">
                {generator.kva} kVA
                {generator.sync_group ? ` · ${generator.sync_group}` : ""}
                {generator.description ? ` · ${generator.description}` : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close generator details"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-2xl text-red-100 transition hover:bg-white/10 hover:text-white"
            >
              ×
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain p-5 [-webkit-overflow-scrolling:touch]">
          {/* Keep the existing current-rating card exactly as the primary card. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Power Rating
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-950">
                {generator.kva} kVA
              </p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-red-500">
                Total Fuel Added
              </p>
              <p className="mt-1 text-2xl font-bold text-red-800">
                {formatLitres(generator.total_fuel_litres)}
              </p>
            </div>
          </div>

          {todayRating && (
            <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
                    Today&apos;s Average Rating
                  </p>
                  <p className="mt-1 text-2xl font-bold text-blue-950">
                    {formatKva(todayRating.averageKva)}
                  </p>
                </div>

                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700 shadow-sm">
                  Live average
                </span>
              </div>

              <p className="mt-2 text-xs leading-5 text-blue-700">
                Time-weighted from midnight to now. If the rating does not
                change, the daily average stays at the active rating for the
                whole day.
              </p>
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

          {!canEdit && !accessLoading && (
            <button
              type="button"
              onClick={() => requestEditingAccess(() => {})}
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              Enable Editing to Update Generator
            </button>
          )}

          {canEdit && (
            <>
              <section className="mt-5 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">
                      Generator Rating
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Every saved change is timestamped and retained in the
                      rating history.
                    </p>
                  </div>

                  <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
                    Default {formatKva(generator.default_kva)}
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={kva}
                      onChange={(event) => setKva(event.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-14 text-sm font-semibold text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      kVA
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={savingKva}
                    onClick={() => void saveKva()}
                    className="rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {savingKva ? "Saving…" : "Save"}
                  </button>
                </div>
              </section>

              <section className="mt-4 rounded-2xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold text-slate-950">
                  Add Fuel
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Record each delivery/refuel separately. Daily and overall
                  totals are calculated automatically.
                </p>

                <div className="mt-3 grid grid-cols-[1fr_0.8fr] gap-2">
                  <input
                    type="date"
                    value={fuelDate}
                    onChange={(event) => setFuelDate(event.target.value)}
                    className="h-11 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-950 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />

                  <div className="relative">
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      inputMode="decimal"
                      value={litres}
                      onChange={(event) => setLitres(event.target.value)}
                      placeholder="0"
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 pr-8 text-sm font-medium text-slate-950 outline-none placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                      L
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={addingFuel}
                  onClick={() => void addFuel()}
                  className="mt-2 min-h-11 w-full rounded-xl bg-red-700 px-4 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-50"
                >
                  {addingFuel ? "Adding…" : "Add Fuel Entry"}
                </button>
              </section>
            </>
          )}

          <section className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  Power Rating History
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Daily averages use the amount of time spent at each rating.
                </p>
              </div>

              <span className="text-xs font-semibold text-slate-500">
                {generator.rating_history.length} changes
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {dailyRatingSummaries.map((day) => (
                <div
                  key={day.date}
                  className="overflow-hidden rounded-xl border border-slate-200"
                >
                  <div className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {formatDate(day.date)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {day.isToday ? "Average so far" : "Final daily average"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-950">
                        {formatKva(day.averageKva)}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                        End {formatKva(day.endKva)}
                      </p>
                    </div>
                  </div>

                  {day.changes.length === 0 ? (
                    <div className="px-3 py-2.5 text-xs text-slate-500">
                      No rating changes. Rating remained at {formatKva(day.endKva)}.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {day.changes.map((change) => (
                        <div
                          key={change.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5"
                        >
                          <span className="text-xs font-medium text-slate-500">
                            {formatTime(change.changed_at)}
                          </span>

                          <span className="text-xs font-semibold text-slate-800">
                            {formatKva(Number(change.old_kva))} → {formatKva(Number(change.new_kva))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-950">
                  Fuel by Day
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Running history for this generator.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {generator.fuel_logs.length} entries
              </span>
            </div>

            {dailyTotals.length === 0 ? (
              <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No fuel has been recorded yet.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {dailyTotals.map(([date, dayTotal]) => {
                  const dayLogs = generator.fuel_logs.filter(
                    (log) => log.log_date === date
                  );

                  return (
                    <div
                      key={date}
                      className="overflow-hidden rounded-xl border border-slate-200"
                    >
                      <div className="flex items-center justify-between bg-slate-50 px-3 py-2.5">
                        <p className="text-sm font-semibold text-slate-800">
                          {formatDate(date)}
                        </p>
                        <p className="text-sm font-bold text-slate-950">
                          {formatLitres(dayTotal)}
                        </p>
                      </div>

                      {dayLogs.length > 1 || canEdit ? (
                        <div className="divide-y divide-slate-100">
                          {dayLogs.map((log) => (
                            <div
                              key={log.id}
                              className="flex items-center justify-between gap-3 px-3 py-2.5"
                            >
                              <span className="text-xs font-medium text-slate-500">
                                Fuel entry
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-800">
                                  +{formatLitres(Number(log.litres))}
                                </span>
                                {canEdit && (
                                  <button
                                    type="button"
                                    disabled={deletingId === log.id}
                                    onClick={() => void removeFuel(log)}
                                    className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                                  >
                                    {deletingId === log.id ? "…" : "Remove"}
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
}
